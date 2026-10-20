import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { handleUpdate, type BotContext, type Update } from "./bot";
import type { Job, Source } from "./sources";
import { bump, emptyState, learnedBlock, learnedRules, loadState, saveState, statsText, type State } from "./state";
import {
  formatJob,
  rejectButton,
  telegram,
  telegramApi,
  TelegramError,
  undoButton,
  type Telegram,
  type TelegramApi,
} from "./telegram";
import { checkOnce } from "./watch";

const sample: Job = {
  key: "fl:1",
  source: "FL.ru",
  title: "Лендинг <для> R&D",
  description: "слово ".repeat(200),
  url: "https://www.fl.ru/projects/1/x.html",
  budget: "10 000 ₽",
  budgetRub: 10000,
  category: "Сайты / Лендинги",
};

describe("telegram", () => {
  const reply = (status: number, body: object) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

  it("«chat not found» — не повод выбрасывать заказ, ошибка разметки — повод", async () => {
    const notFound = telegram(telegramApi("t", reply(400, { ok: false, description: "Bad Request: chat not found" })), "1");
    await expect(notFound.send("x")).rejects.toMatchObject({ permanent: false });
    const badHtml = telegram(telegramApi("t", reply(400, { ok: false, description: "Bad Request: can't parse entities" })), "1");
    await expect(badHtml.send("x")).rejects.toMatchObject({ permanent: true });
  });

  it("ошибка без токена в тексте", async () => {
    const tg = telegram(telegramApi("SECRET123", reply(401, { ok: false, description: "Unauthorized" })), "1");
    await expect(tg.send("x")).rejects.not.toThrow(/SECRET123/);
  });

  it("заказ уходит с кнопкой «Не то»", async () => {
    const bodies: { reply_markup?: unknown }[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ ok: true, result: {} }));
    }) as typeof fetch;
    await telegram(telegramApi("t", fetchImpl), "1").send("<b>x</b>", "fl:7");
    expect(bodies[0].reply_markup).toEqual(rejectButton("fl:7"));
  });
});

describe("память", () => {
  it("пишется и читается; нет файла — пустая; старый формат дополняется", async () => {
    const dir = await mkdtemp(join(tmpdir(), "freelance-"));
    const path = join(dir, "sub", "seen.json");
    expect((await loadState(path)).keys).toEqual([]);
    const state = { ...emptyState(), sources: ["Kwork"], keys: ["kwork:1"] };
    // Две записи разом не мешают друг другу
    await Promise.all([saveState(path, state), saveState(path, state)]);
    expect(await loadState(path)).toEqual(state);

    await writeFile(path, JSON.stringify({ sources: ["FL.ru"], keys: ["fl:1"] }));
    expect(await loadState(path)).toMatchObject({ sources: ["FL.ru"], keys: ["fl:1"], sent: [], rejected: [], updateOffset: 0 });
  });
});

describe("обучение на «Не то»", () => {
  const sent = (key: string, title: string, category: string | null) => ({ key, title, source: "FL.ru", category, at: "" });
  const reject = (...keys: string[]) => keys.map((key) => ({ key, at: "" }));

  it("раздел выучивается после 3 «Не то», если это почти всё присланное из него", () => {
    const state = emptyState();
    state.sent = [
      sent("1", "Чат-бот для стоматологии", "Мессенджеры / Боты"),
      sent("2", "Телеграм бот записи", "Мессенджеры / Боты"),
      sent("3", "Бот для магазина", "Мессенджеры / Боты"),
      sent("4", "Лендинг для школы", "Сайты / Лендинги"),
    ];
    state.rejected = reject("1", "2");
    expect(learnedRules(state).categories).toEqual([]);
    state.rejected = reject("1", "2", "3");
    const rules = learnedRules(state);
    expect(rules.categories).toEqual(["Мессенджеры / Боты"]);
    expect(learnedBlock({ title: "Ещё бот", category: "Мессенджеры / Боты" }, rules)).toBe("раздел «Мессенджеры / Боты»");
    expect(learnedBlock({ title: "Лендинг", category: "Сайты / Лендинги" }, rules)).toBeNull();
  });

  it("слово выучивается, только если не встречалось в неотклонённых", () => {
    const state = emptyState();
    state.sent = [
      sent("1", "Бот для казино", null),
      sent("2", "Сайт казино под ключ", null),
      sent("3", "Лендинг казино", null),
      sent("4", "Сайт для пекарни", null),
    ];
    state.rejected = reject("1", "2", "3");
    // «сайт» есть и в неотклонённом «Сайт для пекарни» — не выучивается
    expect(learnedRules(state).words).toEqual(["казино"]);
    expect(learnedBlock({ title: "Сделать лендинг для казино", category: null }, learnedRules(state))).toBe("слово «казино…»");
  });
});

describe("кнопки и /stats", () => {
  function fakeBot() {
    const calls: { method: string; params: Record<string, unknown> }[] = [];
    const api = (async (method: string, params: Record<string, unknown> = {}) => {
      calls.push({ method, params });
      return [];
    }) as TelegramApi;
    const state = emptyState();
    const ctx: BotContext = { api, state, chatId: "42", sourceNames: ["FL.ru", "Kwork"], persist: async () => {}, log: () => {} };
    return { calls, state, ctx };
  }
  const press = (data: string, chat = 42): Update => ({
    update_id: 1,
    callback_query: { id: "q", data, message: { chat: { id: chat }, message_id: 9 } },
  });

  it("«Не то» запоминает заказ и меняет кнопку на «Вернуть», «Вернуть» — отменяет", async () => {
    const { calls, state, ctx } = fakeBot();
    await handleUpdate(press("no:fl:5"), ctx);
    await handleUpdate(press("no:fl:5"), ctx); // двойное нажатие не считается дважды
    expect(state.rejected.map((r) => r.key)).toEqual(["fl:5"]);
    expect(Object.values(state.days)[0].rejected).toBe(1);
    expect(calls.find((c) => c.method === "editMessageReplyMarkup")?.params.reply_markup).toEqual(undoButton("fl:5"));

    await handleUpdate(press("undo:fl:5"), ctx);
    expect(state.rejected).toEqual([]);
    expect(Object.values(state.days)[0].rejected).toBe(0);
    expect(calls.at(-1)?.params.reply_markup).toEqual(rejectButton("fl:5"));
  });

  it("чужой чат игнорируется", async () => {
    const { calls, state, ctx } = fakeBot();
    await handleUpdate(press("no:fl:5", 666), ctx);
    await handleUpdate({ update_id: 2, message: { chat: { id: 666 }, text: "/stats" } }, ctx);
    expect(state.rejected).toEqual([]);
    expect(calls.map((c) => c.method)).toEqual(["answerCallbackQuery"]);
  });

  it("/stats отвечает счётчиками и состоянием площадок", async () => {
    const { calls, state, ctx } = fakeBot();
    const now = new Date();
    bump(state, "read", 40, now);
    bump(state, "sent", 5, now);
    state.status["FL.ru"] = { ok: true, at: now.toISOString(), count: 120 };
    await handleUpdate({ update_id: 3, message: { chat: { id: 42 }, text: "/stats@webik_bot" } }, ctx);
    const text = String(calls[0].params.text);
    expect(text).toContain("Сегодня: новых заказов 40, прислано 5, «Не то» 0");
    expect(text).toContain("✅ FL.ru — 120 заказов");
    expect(text).toContain("⏳ Kwork — ещё не проверялась");
    expect(text).toContain("Фильтр пока ничего не выучил");
  });

  it("неработающая площадка — с какого времени и почему", () => {
    const state = emptyState();
    const now = new Date();
    state.status.Kwork = { ok: false, at: now.toISOString(), count: 0, error: "Kwork ответил 503", failingSince: now.toISOString() };
    expect(statsText(state, ["Kwork"], now)).toMatch(/❌ Kwork — не читается с \d\d:\d\d: Kwork ответил 503/);
  });
});

describe("сообщение", () => {
  it("экранирует HTML и укорачивает описание", () => {
    const text = formatJob(sample, ["Сайт / лендинг"]);
    expect(text).toContain("<b>Лендинг &lt;для&gt; R&amp;D</b>");
    expect(text).toContain("10 000 ₽ · FL.ru · Сайты / Лендинги");
    expect(text).toContain("#Сайт_лендинг");
    expect(text).toContain("…");
    expect(text.length).toBeLessThan(800);
    expect(text).toContain('<a href="https://www.fl.ru/projects/1/x.html">Открыть заказ</a>');
  });
});

describe("проход", () => {
  const source = (jobs: Job[]): Source => ({ name: "FL.ru", fetchJobs: async () => jobs });
  const landing = (id: number): Job => ({ ...sample, key: `fl:${id}`, title: `Лендинг ${id}` });
  const boring = (id: number): Job => ({ ...sample, key: `fl:${id}`, title: `Бухгалтерия ${id}` });
  const withState = (patch: Partial<State>): State => ({ ...emptyState(), ...patch });

  function recorder(fail?: (n: number) => Error | null): Telegram & { sent: string[]; keys: (string | undefined)[] } {
    const sent: string[] = [];
    const keys: (string | undefined)[] = [];
    return {
      sent,
      keys,
      async send(html, key) {
        const err = fail?.(sent.length);
        if (err) throw err;
        sent.push(html);
        keys.push(key);
      },
    };
  }
  const run = (jobs: Job[], state: State, tg: Telegram | null) =>
    checkOnce({ sources: [source(jobs)], state, filter: { minBudget: 0 }, telegram: tg, log: () => {}, pauseMs: 0 });

  it("первый проход по площадке только запоминает, следующий шлёт новые подходящие", async () => {
    const state = emptyState();
    const tg = recorder();
    await run([landing(1)], state, tg);
    expect(tg.sent).toEqual([]);
    expect(state.sources).toEqual(["FL.ru"]);

    const r = await run([landing(1), landing(2), landing(2), boring(3)], state, tg);
    expect(r.sent).toBe(1);
    expect(tg.sent).toHaveLength(1);
    expect(tg.sent[0]).toContain("Лендинг 2");
    expect(tg.keys).toEqual(["fl:2"]);
    expect(state.keys).toEqual(["fl:1", "fl:2", "fl:3"]);
    expect(state.sent.map((s) => s.key)).toEqual(["fl:2"]);
    expect(Object.values(state.days)[0]).toMatchObject({ read: 2, sent: 1 });
    expect(state.status["FL.ru"]).toMatchObject({ ok: true, count: 4 });

    await run([landing(1), landing(2), boring(3)], state, tg);
    expect(tg.sent).toHaveLength(1);
  });

  it("сбой сети оставляет заказ на следующий проход, отказ Telegram — нет", async () => {
    const state = withState({ sources: ["FL.ru"] });
    await run([landing(1), landing(2)], state, recorder(() => new Error("fetch failed")));
    expect(state.keys).toEqual([]);

    // Первое сообщение отклонено навсегда, второе ушло
    let calls = 0;
    const tg = recorder(() => (calls++ === 0 ? new TelegramError("Telegram ответил 400", true) : null));
    await run([landing(1), landing(2)], state, tg);
    expect(state.keys).toEqual(["fl:1", "fl:2"]);
    expect(tg.sent).toHaveLength(1);
  });

  it("выученное правило отсекает заказ", async () => {
    const state = withState({
      sources: ["FL.ru"],
      sent: [1, 2, 3].map((i) => ({ key: `fl:${i}`, title: `Лендинг казино ${i}`, source: "FL.ru", category: null, at: "" })),
      rejected: [1, 2, 3].map((i) => ({ key: `fl:${i}`, at: "" })),
    });
    const tg = recorder();
    const r = await run([{ ...landing(9), title: "Лендинг для казино", category: null }, landing(10)], state, tg);
    expect(r).toMatchObject({ sent: 1, muted: 1 });
    expect(tg.sent[0]).toContain("Лендинг 10");
  });

  it("площадка с ошибкой не мешает остальным и помнит, с какого времени не читается", async () => {
    const broken: Source = { name: "Kwork", fetchJobs: async () => Promise.reject(new Error("503")) };
    const state = withState({ sources: ["FL.ru", "Kwork"] });
    const opts = { sources: [broken, source([landing(5)])], state, filter: { minBudget: 0 }, log: () => {}, pauseMs: 0 };

    // Пробный запуск память не трогает
    expect(await checkOnce({ ...opts, telegram: null })).toEqual({ found: 1, sent: 1, muted: 0, failedSources: ["Kwork"] });
    expect(state).toEqual(withState({ sources: ["FL.ru", "Kwork"], since: state.since }));

    await checkOnce({ ...opts, telegram: recorder() });
    const since = state.status.Kwork.failingSince;
    expect(state.status.Kwork).toMatchObject({ ok: false, error: "503" });
    await new Promise((r) => setTimeout(r, 5));
    await checkOnce({ ...opts, telegram: recorder() });
    expect(state.status.Kwork.failingSince).toBe(since);
  });
});
