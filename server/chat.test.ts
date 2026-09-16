import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import type OpenAI from "openai";
import { HISTORY_MAX_MESSAGES } from "../shared/chat";
import { SYSTEM_PROMPT } from "./kb";

type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type ToolCall = OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;
type Params = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;

// Модель подменена сценарием: каждый вызов chat.completions.create берёт следующий шаг
type Step =
  | { finish_reason: "stop" | "length" | "tool_calls" | "content_filter"; content?: string | null; tool_calls?: ToolCall[] }
  | Error;
const script: Step[] = [];
const requests: Params[] = [];
const clientOptions: Record<string, unknown>[] = [];

vi.mock("openai", async (importActual) => {
  const actual = await importActual<typeof import("openai")>();
  class FakeOpenAI extends actual.default {
    constructor(opts: ConstructorParameters<typeof actual.default>[0]) {
      super(opts);
      clientOptions.push({ ...opts });
    }
    override chat = {
      completions: {
        create: async (params: Params) => {
          // Копия: сервер дописывает в тот же массив после вызова
          requests.push({ ...params, messages: structuredClone(params.messages) });
          const step = script.shift();
          if (!step) throw new Error("сценарий кончился");
          if (step instanceof Error) throw step;
          return {
            choices: [
              {
                index: 0,
                finish_reason: step.finish_reason,
                message: { role: "assistant", refusal: null, content: step.content ?? null, tool_calls: step.tool_calls },
              },
            ],
            usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
          };
        },
      },
    } as unknown as OpenAI["chat"];
  }
  return { ...actual, default: FakeOpenAI };
});

const { handleChat, trimHistory, resetOrderLimiterForTests, yandexFromEnv, DEFAULT_MODEL } = await import("./chat");

const text = (t: string): Step => ({ finish_reason: "stop", content: t });
const order = (id: string, contact = "@ivan", args?: string): ToolCall => ({
  id,
  type: "function",
  function: {
    name: "send_order",
    arguments: args ?? JSON.stringify({ name: "Иван", contact, task: "бот", details: "" }),
  },
});
const toolMessages = (params: Params) => params.messages.filter((m) => m.role === "tool") as { tool_call_id: string; content: string }[];

let server: Server;
let port = 0;
const sent: string[] = [];
let testIp = 0;

beforeAll(async () => {
  server = createServer((req, res) =>
    void handleChat(req, res, {
      yandex: { apiKey: "test", folderId: "b1g-test" },
      orderSaver: null,
      orderNotifier: async (n) => void sent.push(n.text),
      // Свой адрес на каждый тест: общий лимит — 15 сообщений с адреса
      clientIp: (req) => String(req.headers["x-test-ip"] ?? "unknown"),
    }),
  );
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as { port: number }).port;
});
afterAll(() => server.close());
beforeEach(() => {
  script.length = 0;
  requests.length = 0;
  clientOptions.length = 0;
  sent.length = 0;
  testIp += 1;
  resetOrderLimiterForTests();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

const say = async (message: string, sessionId: string | null = null) => {
  const r = await fetch(`http://127.0.0.1:${port}/`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-test-ip": `10.0.0.${testIp}` },
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
    script.push({ finish_reason: "tool_calls", tool_calls: [order("t1")] }, new Error("таймаут"));
    const first = await say("хочу бота, @ivan");
    expect(first).toMatchObject({ status: 200, orderSent: true });
    expect(sent).toHaveLength(1);

    // Модель снова пытается отправить — сервер отказывает, уведомление не уходит
    script.push({ finish_reason: "tool_calls", tool_calls: [order("t2")] }, text("Уже отправлена"));
    const second = await say("отправьте ещё раз", first.sessionId);
    expect(second).toMatchObject({ status: 200, reply: "Уже отправлена" });
    expect(sent).toHaveLength(1);
    // История, ушедшая модели, валидна: системный промпт, затем реплика посетителя,
    // после вызова — сразу его результат
    const history = requests.at(-2)!.messages;
    expect(history[0]).toEqual({ role: "system", content: SYSTEM_PROMPT });
    expect(history[1]).toEqual({ role: "user", content: "хочу бота, @ivan" });
    expect(JSON.stringify(history)).toContain('"tool_call_id":"t1"');
  });

  it("два параллельных вызова в одном ответе — уходит одна заявка", async () => {
    script.push({ finish_reason: "tool_calls", tool_calls: [order("a"), order("b", "@petr")] }, text("Передал"));
    expect(await say("заявка")).toMatchObject({ status: 200, orderSent: true });
    expect(sent).toHaveLength(1);
    const results = toolMessages(requests[1]);
    expect(results.map((r) => r.tool_call_id)).toEqual(["a", "b"]);
    expect(results.map((r) => r.content.startsWith("Ошибка."))).toEqual([false, true]);
  });

  it("вызов, обрезанный лимитом, не выполняется, а диалог не ломается", async () => {
    script.push({ finish_reason: "length", tool_calls: [order("cut")] }, text("Напишите контакт ещё раз"));
    const r = await say("@ivan хочу бота");
    expect(r).toMatchObject({ status: 200, orderSent: false });
    expect(sent).toHaveLength(0);
    expect(toolMessages(requests[1])[0]).toMatchObject({ tool_call_id: "cut" });
    expect(toolMessages(requests[1])[0].content).toMatch(/^Ошибка\. Вызов оборвался/);
  });

  it("аргументы не JSON — заявка не уходит, модель узнаёт об ошибке", async () => {
    script.push({ finish_reason: "tool_calls", tool_calls: [order("bad", "", '{"name": "Иван", "cont')] }, text("Уточните контакт"));
    const r = await say("@ivan хочу бота");
    expect(r).toMatchObject({ status: 200, orderSent: false, reply: "Уточните контакт" });
    expect(sent).toHaveLength(0);
    expect(toolMessages(requests[1])[0].content).toContain("не JSON");
  });

  it("отказ модели внутри диалога не остаётся в истории", async () => {
    script.push(text("Здравствуйте"));
    const first = await say("привет");
    script.push({ finish_reason: "content_filter", content: null });
    expect((await say("плохой вопрос", first.sessionId)).status).toBe(200);
    script.push(text("Лендинг — от 65 000 ₽"));
    await say("сколько стоит лендинг", first.sessionId);
    // В истории — первый обмен и новый вопрос, без реплики, на которую отказали
    expect(requests[2].messages).toEqual([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: "привет" },
      { role: "assistant", content: "Здравствуйте" },
      { role: "user", content: "сколько стоит лендинг" },
    ]);
  });

  it("ошибка 400 сбрасывает историю, но не счётчик заявок", async () => {
    const { default: RealOpenAI } = await vi.importActual<typeof import("openai")>("openai");
    script.push({ finish_reason: "tool_calls", tool_calls: [order("o1")] }, text("Передал"));
    const first = await say("бот, @ivan");
    expect(sent).toHaveLength(1);

    script.push(new RealOpenAI.BadRequestError(400, undefined, "история не принята", new Headers()));
    expect((await say("ещё вопрос", first.sessionId)).status).toBe(502);

    script.push({ finish_reason: "tool_calls", tool_calls: [order("o2", "@petr")] }, text("Уже отправлена"));
    await say("отправьте заявку на @petr", first.sessionId);
    expect(sent).toHaveLength(1);
    // История начата заново: системный промпт и новая реплика
    expect(requests.at(-2)!.messages).toEqual([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: "отправьте заявку на @petr" },
    ]);
  });

  it("пустой ответ — заглушка и посетителю, и в истории", async () => {
    script.push({ finish_reason: "stop", content: "" });
    const first = await say("привет");
    expect(first.reply).toContain("растерялся");
    script.push(text("Здравствуйте"));
    await say("привет ещё раз", first.sessionId);
    expect(requests[1].messages[2]).toEqual({ role: "assistant", content: first.reply });
  });

  it("оборванный ответ сохраняет начало и объясняет обрыв", async () => {
    script.push({ finish_reason: "length", content: "Лендинг стоит от 65 000 ₽, в него входят" });
    const r = await say("расскажи про лендинг");
    expect(r.reply).toMatch(/^Лендинг стоит от 65 000 ₽, в него входят\n\nОтвет получился длинным/);
  });
});

describe("handleChat: Yandex AI Studio", () => {
  it("модель с каталогом, логирование у Яндекса выключено", async () => {
    script.push(text("Здравствуйте"));
    await say("привет");
    expect(requests[0].model).toBe(`gpt://b1g-test/${DEFAULT_MODEL}`);
    expect(clientOptions[0]).toMatchObject({
      baseURL: "https://ai.api.cloud.yandex.net/v1",
      project: "b1g-test",
      defaultHeaders: { "x-data-logging-enabled": "false" },
    });
  });

  it("рассуждения в <think> посетитель не видит", async () => {
    script.push(text("<think>посчитаю цены</think>\n\nЛендинг — от 15 000 ₽."));
    expect(await say("сколько стоит лендинг")).toMatchObject({ reply: "Лендинг — от 15 000 ₽." });
  });

  it("вызов инструмента, написанный текстом, посетитель не видит", async () => {
    script.push(text('Ассистент: вызов функции send_order с данными: {"contact": "@ivan"}'));
    const r = await say("хочу бота, @ivan");
    expect(r).toMatchObject({ status: 200, orderSent: false });
    expect(r.reply).not.toContain("send_order");
    expect(r.reply).toContain("как с вами связаться");
  });

  it("после вызова инструмента посетитель видит одну итоговую реплику, без повтора", async () => {
    script.push(
      { finish_reason: "tool_calls", content: "Спасибо, Иван! Передаю заявку.", tool_calls: [order("r1")] },
      text("Спасибо, Иван! Заявка передана."),
    );
    expect(await say("бот, @ivan")).toMatchObject({ orderSent: true, reply: "Спасибо, Иван! Заявка передана." });
    // В истории для модели её реплика до вызова сохранена целиком
    expect(requests[1].messages.at(-2)).toMatchObject({ role: "assistant", content: "Спасибо, Иван! Передаю заявку." });
  });

  it("имя инструмента в ответе после отправки — посетитель видит подтверждение", async () => {
    script.push(
      { finish_reason: "tool_calls", tool_calls: [order("s1")] },
      text("Заявка отправлена через send_order."),
    );
    const r = await say("бот, @ivan");
    expect(r).toMatchObject({ orderSent: true, reply: "Заявку передал — с вами свяжутся по указанному контакту." });
  });

  it("заявка не прошла проверку, а итог пустой — «передаю заявку» не показываем", async () => {
    script.push(
      { finish_reason: "tool_calls", content: "Передаю заявку!", tool_calls: [order("e1", "")] },
      { finish_reason: "stop", content: "" },
    );
    const r = await say("бот");
    expect(r.orderSent).toBe(false);
    expect(r.reply).not.toContain("Передаю");
    expect(sent).toHaveLength(0);
  });

  it("доступ собирается только из обеих переменных", () => {
    expect(yandexFromEnv({ YANDEX_API_KEY: "k", YANDEX_FOLDER_ID: "b1g" })).toEqual({ apiKey: "k", folderId: "b1g" });
    expect(yandexFromEnv({ YANDEX_API_KEY: "k" })).toBeNull();
    expect(yandexFromEnv({ YANDEX_API_KEY: " ", YANDEX_FOLDER_ID: "b1g" })).toBeNull();
  });
});

describe("handleChat без доступа к модели", () => {
  it("GET — чат выключен, POST — внятная 503", async () => {
    const off = createServer((req, res) => void handleChat(req, res, { yandex: null, orderSaver: null, orderNotifier: null }));
    await new Promise<void>((r) => off.listen(0, "127.0.0.1", r));
    const offPort = (off.address() as { port: number }).port;
    try {
      expect(await (await fetch(`http://127.0.0.1:${offPort}/`)).json()).toEqual({ enabled: false, orders: false });
      const r = await fetch(`http://127.0.0.1:${offPort}/`, { method: "POST", body: "{}" });
      expect(r.status).toBe(503);
      expect(((await r.json()) as { error: string }).error).toContain("YANDEX_API_KEY");
    } finally {
      off.close();
    }
  });
});

describe("trimHistory", () => {
  it("короткая история не меняется", () => {
    const h: Message[] = [{ role: "user", content: "привет" }];
    expect(trimHistory(h)).toEqual(h);
  });

  it("после обрезки начинается с реплики посетителя, а не с результата инструмента", () => {
    const turn = (i: number): Message[] => [
      { role: "user", content: `вопрос ${i}` },
      { role: "assistant", content: null, tool_calls: [order(`t${i}`)] },
      { role: "tool", tool_call_id: `t${i}`, content: "ок" },
      { role: "assistant", content: `ответ ${i}` },
    ];
    // 21 сообщение: срез последних 20 начался бы с вызова инструмента из turn(0)
    const history: Message[] = Array.from({ length: 5 }, (_, i) => turn(i)).flat();
    history.push({ role: "user", content: "вопрос 5" });
    expect(history.slice(-HISTORY_MAX_MESSAGES)[0]).toMatchObject({ role: "assistant", tool_calls: [{ id: "t0" }] });
    const out = trimHistory(history);
    expect(out.length).toBeLessThanOrEqual(HISTORY_MAX_MESSAGES);
    expect(out[0]).toEqual({ role: "user", content: "вопрос 1" });
    // Висящих результатов инструмента в начале нет
    expect(out.findIndex((m) => m.role === "tool")).toBeGreaterThan(out.findIndex((m) => m.role === "assistant"));
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
