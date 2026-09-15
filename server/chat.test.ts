import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import type Anthropic from "@anthropic-ai/sdk";
import { HISTORY_MAX_MESSAGES } from "../shared/chat";
import { SYSTEM_PROMPT } from "./kb";

// Модель подменена сценарием: каждый вызов messages.create берёт следующий шаг
type Step = Partial<Anthropic.Message> | Error;
const script: Step[] = [];
const requests: Anthropic.MessageCreateParams[] = [];

vi.mock("@anthropic-ai/sdk", async (importActual) => {
  const actual = await importActual<typeof import("@anthropic-ai/sdk")>();
  class FakeAnthropic extends actual.default {
    override messages = {
      create: async (params: Anthropic.MessageCreateParams) => {
        // Копия: сервер дописывает в тот же массив после вызова
        requests.push({ ...params, messages: structuredClone(params.messages) });
        const step = script.shift();
        if (!step) throw new Error("сценарий кончился");
        if (step instanceof Error) throw step;
        return { stop_details: null, ...step };
      },
    } as unknown as Anthropic["messages"];
  }
  return { ...actual, default: FakeAnthropic };
});

const { handleChat, trimHistory, resetOrderLimiterForTests } = await import("./chat");

const text = (t: string): Anthropic.Message["content"][number] => ({ type: "text", text: t, citations: null });
const order = (id: string, contact = "@ivan"): Anthropic.Message["content"][number] => ({
  type: "tool_use",
  id,
  name: "send_order",
  input: { name: "Иван", contact, task: "бот", details: "" },
  caller: { type: "direct" },
} as Anthropic.ToolUseBlock);

let server: Server;
let port = 0;
const sent: string[] = [];

beforeAll(async () => {
  server = createServer((req, res) =>
    void handleChat(req, res, { apiKey: "test", orderNotifier: async (t) => void sent.push(t) }),
  );
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as { port: number }).port;
});
afterAll(() => server.close());
beforeEach(() => {
  script.length = 0;
  requests.length = 0;
  sent.length = 0;
  resetOrderLimiterForTests();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

// У каждого теста свой адрес не нужен: лимит чата — 15 сообщений на адрес, тестов меньше
const say = async (message: string, sessionId: string | null = null) => {
  const r = await fetch(`http://127.0.0.1:${port}/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, message }),
  });
  const data = (await r.json()) as Record<string, unknown>;
  return { status: r.status, ...data } as { status: number; sessionId: string; reply: string; orderSent: boolean };
};

describe("handleChat: заявки", () => {
  it("GET сообщает, включён ли чат", async () => {
    expect(await (await fetch(`http://127.0.0.1:${port}/`)).json()).toEqual({ enabled: true, orders: true });
  });

  it("сбой модели после отправки — посетитель видит успех, повтор не шлёт дубль", async () => {
    script.push({ stop_reason: "tool_use", content: [order("t1")] }, new Error("таймаут"));
    const first = await say("хочу бота, @ivan");
    expect(first).toMatchObject({ status: 200, orderSent: true });
    expect(sent).toHaveLength(1);

    // Модель снова пытается отправить — сервер отказывает, в Telegram ничего не уходит
    script.push({ stop_reason: "tool_use", content: [order("t2")] }, { stop_reason: "end_turn", content: [text("Уже отправлена")] });
    const second = await say("отправьте ещё раз", first.sessionId);
    expect(second).toMatchObject({ status: 200, reply: "Уже отправлена" });
    expect(sent).toHaveLength(1);
    // История, ушедшая модели, валидна: после tool_use сразу его результат
    const history = requests.at(-2)!.messages;
    expect(history[0]).toEqual({ role: "user", content: "хочу бота, @ivan" });
    expect(JSON.stringify(history)).toContain('"tool_use_id":"t1"');
  });

  it("два параллельных вызова в одном ответе — уходит одна заявка", async () => {
    script.push(
      { stop_reason: "tool_use", content: [order("a"), order("b", "@petr")] },
      { stop_reason: "end_turn", content: [text("Передал")] },
    );
    expect(await say("заявка")).toMatchObject({ status: 200, orderSent: true });
    expect(sent).toHaveLength(1);
    const results = requests[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[];
    expect(results.map((r) => r.is_error)).toEqual([false, true]);
  });

  it("вызов, обрезанный лимитом, не выполняется, а диалог не ломается", async () => {
    script.push(
      { stop_reason: "max_tokens", content: [order("cut")] },
      { stop_reason: "end_turn", content: [text("Напишите контакт ещё раз")] },
    );
    const r = await say("@ivan хочу бота");
    expect(r).toMatchObject({ status: 200, orderSent: false });
    expect(sent).toHaveLength(0);
    const result = (requests[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];
    expect(result).toMatchObject({ tool_use_id: "cut", is_error: true });
  });

  it("отказ модели не остаётся в истории", async () => {
    script.push({ stop_reason: "refusal", content: [] });
    const first = await say("плохой вопрос");
    expect(first.status).toBe(200);
    script.push({ stop_reason: "end_turn", content: [text("Здравствуйте")] });
    await say("привет", first.sessionId);
    expect(requests[1].messages).toEqual([{ role: "user", content: "привет" }]);
  });
});

describe("trimHistory", () => {
  it("короткая история не меняется", () => {
    const h: Anthropic.MessageParam[] = [{ role: "user", content: "привет" }];
    expect(trimHistory(h)).toEqual(h);
  });

  it("после обрезки начинается с реплики посетителя, а не с результата инструмента", () => {
    const turn = (i: number): Anthropic.MessageParam[] => [
      { role: "user", content: `вопрос ${i}` },
      { role: "assistant", content: [{ type: "tool_use", id: `t${i}`, name: "send_order", input: {} }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: `t${i}`, content: "ок" }] },
      { role: "assistant", content: `ответ ${i}` },
    ];
    // 21 сообщение: срез последних 20 начался бы с вызова инструмента
    const history = [{ role: "assistant", content: "лишнее" } as Anthropic.MessageParam, ...Array.from({ length: 5 }, (_, i) => turn(i)).flat()];
    const out = trimHistory(history);
    expect(out.length).toBeLessThanOrEqual(HISTORY_MAX_MESSAGES);
    expect(out[0]).toEqual({ role: "user", content: "вопрос 0" });
  });
});

describe("промпт бота", () => {
  it("знает новые контакты и не знает старую почту", () => {
    expect(SYSTEM_PROMPT).toContain("@d0vbnyak");
    expect(SYSTEM_PROMPT).toContain("dev.d0vbnyak@gmail.com");
    expect(SYSTEM_PROMPT).not.toContain("hello@webik.ru");
    expect(SYSTEM_PROMPT).toContain("send_order");
  });
});
