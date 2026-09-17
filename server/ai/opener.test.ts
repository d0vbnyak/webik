import type OpenAI from "openai";
import { describe, expect, it } from "vitest";
import {
  OpenerError,
  createOpener,
  draftWarnings,
  hostOf,
  normalizeDraft,
  quoteInText,
  type OpenerDraft,
} from "./opener";
import { SiteError, type SiteText } from "./site";

const SITE_TEXT =
  "### https://ohrana.ru/\nЗаголовок: Охрана-Сервис\nБесплатный выезд инженера в день обращения. " +
  "Более 300 объектов на пультовой охране. Оптовые поставки оборудования Hikvision. ".repeat(4);

const site = (text = SITE_TEXT): SiteText => ({ pages: [{ url: "https://ohrana.ru/", text }], text });

const GOOD: OpenerDraft = {
  business: "Монтаж видеонаблюдения и пультовая охрана в Казани.",
  fit: "да",
  variant: "Б",
  hook: "Больше 300 объектов на пультовой охране",
  quote: "Более 300 объектов на пультовой охране",
  first_line: "У вас больше 300 объектов на пультовой охране — представляю, сколько вопросов от клиентов в неделю.",
};

type Step = string | Error;

/** Подставной клиент: каждый вызов модели берёт следующий шаг сценария. */
function fakeClient(steps: Step[], search?: Partial<OpenAI.Responses.Response> | Error) {
  const chatCalls: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming[] = [];
  const searchCalls: OpenAI.Responses.ResponseCreateParamsNonStreaming[] = [];
  const client = {
    chat: {
      completions: {
        create: async (params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming) => {
          chatCalls.push(params);
          const step = steps.shift();
          if (step === undefined) throw new Error("сценарий кончился");
          if (step instanceof Error) throw step;
          return {
            choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", refusal: null, content: step } }],
            usage: { prompt_tokens: 3000, completion_tokens: 400, total_tokens: 3400 },
          };
        },
      },
    },
    responses: {
      create: async (params: OpenAI.Responses.ResponseCreateParamsNonStreaming) => {
        searchCalls.push(params);
        if (!search) throw new Error("поиск не ожидался");
        if (search instanceof Error) throw search;
        return search;
      },
    },
  } as unknown as OpenAI;
  return { client, chatCalls, searchCalls };
}

const yandex = { apiKey: "k", folderId: "b1gfolder" };
const input = { company: "Охрана-Сервис", city: "Казань", website: "ohrana.ru" };

describe("createOpener", () => {
  it("читает сайт, спрашивает модель, проверяет цитату и считает рубли", async () => {
    const { client, chatCalls } = fakeClient([JSON.stringify(GOOD)]);
    const opener = createOpener({ yandex, client, readSite: async () => site() });
    const result = await opener(input);

    expect(result).toMatchObject({ ...GOOD, quoteFound: true, source: "site", pages: ["https://ohrana.ru/"], warnings: [] });
    // 3000 × 0,3 + 400 × 0,5 за 1000 токенов
    expect(result.costRub).toBe(1.1);

    const call = chatCalls[0];
    expect(call.model).toBe("gpt://b1gfolder/deepseek-v4-flash");
    expect(call.response_format).toMatchObject({ type: "json_schema" });
    const schema = (call.response_format as { json_schema: { schema: Record<string, unknown> } }).json_schema.schema;
    expect(schema.required).toEqual(["business", "fit", "variant", "hook", "quote", "first_line"]);
    expect(schema.additionalProperties).toBe(false);
    // Правила схемы — в промпте: description модели Яндекса не читают
    expect(call.messages[0].content).toContain('"variant": ровно одна заглавная кириллическая буква');
    const user = String(call.messages[1].content);
    expect(user).toContain("Компания: Охрана-Сервис");
    expect(user).toContain("Бесплатный выезд инженера");
  });

  it("ответ не по схеме — повтор; латинская A и кавычки чинятся", async () => {
    const latin = { ...GOOD, variant: "A", first_line: `«${GOOD.first_line}»` };
    const { client, chatCalls } = fakeClient(["не JSON", JSON.stringify({ ...GOOD, fit: "может быть" }), JSON.stringify(latin)]);
    const result = await createOpener({ yandex, client, readSite: async () => site() })(input);
    expect(chatCalls).toHaveLength(3);
    expect(result.variant).toBe("А");
    expect(result.first_line).toBe(GOOD.first_line);
  });

  it("латинская B — не угадываем «Б» или «В», а повторяем запрос", async () => {
    const { client, chatCalls } = fakeClient([JSON.stringify({ ...GOOD, variant: "B" }), JSON.stringify({ ...GOOD, variant: "В" })]);
    const result = await createOpener({ yandex, client, readSite: async () => site() })(input);
    expect(chatCalls).toHaveLength(2);
    expect(result.variant).toBe("В");
  });

  it("заведомо негодный адрес — 422 без платного поиска", async () => {
    const { client, searchCalls } = fakeClient([]);
    const opener = createOpener({
      yandex,
      client,
      readSite: async () => {
        throw new SiteError("Адрес сайта ведёт во внутреннюю сеть", false);
      },
    });
    await expect(opener(input)).rejects.toMatchObject({ status: 422, message: expect.stringContaining("внутреннюю сеть") });
    expect(searchCalls).toHaveLength(0);
  });

  it("три ответа не по схеме — ошибка 502", async () => {
    const { client } = fakeClient(["{}", "{}", "{}"]);
    const opener = createOpener({ yandex, client, readSite: async () => site() });
    await expect(opener(input)).rejects.toMatchObject({ status: 502 });
  });

  it("выдуманная цитата — предупреждение", async () => {
    const { client } = fakeClient([JSON.stringify({ ...GOOD, quote: "Работаем с 1995 года по всей России" })]);
    const result = await createOpener({ yandex, client, readSite: async () => site() })(input);
    expect(result.quoteFound).toBe(false);
    expect(result.warnings.join(" ")).toContain("Цитаты нет в тексте сайта");
  });

  it("сайт не открылся — веб-поиск по домену, store: false", async () => {
    const found = "Факты: «Более 300 объектов на пультовой охране». Бесплатный выезд инженера. ".repeat(3);
    const { client, searchCalls } = fakeClient([JSON.stringify(GOOD)], {
      output_text: found,
      output: [
        { type: "web_search_call", id: "ws", status: "completed" },
        {
          type: "message",
          id: "m",
          role: "assistant",
          status: "completed",
          content: [
            {
              type: "output_text",
              text: found,
              annotations: [{ type: "url_citation", url: "https://ohrana.ru/about", title: "", start_index: 0, end_index: 1 }],
            },
          ],
        },
      ] as unknown as OpenAI.Responses.Response["output"],
      usage: {
        input_tokens: 600,
        input_tokens_details: { cached_tokens: 0, tool_tokens: 400 },
        output_tokens: 200,
        total_tokens: 1200,
      } as unknown as OpenAI.Responses.ResponseUsage,
    });
    const opener = createOpener({
      yandex,
      client,
      readSite: async () => {
        throw new SiteError("Сайт ответил ошибкой 503");
      },
    });
    const result = await opener({ ...input, website: "https://www.ohrana.ru/" });

    expect(searchCalls[0]).toMatchObject({
      model: "gpt://b1gfolder/aliceai-llm",
      store: false,
      tools: [{ type: "web_search", filters: { allowed_domains: ["ohrana.ru"] } }],
    });
    expect(result.source).toBe("search");
    expect(result.pages).toEqual(["https://ohrana.ru/about"]);
    expect(result.warnings.join(" ")).toContain("поиска Яндекса");
    // поиск 0,488 + aliceai-llm (600 + 400 страниц) × 0,5 + 200 × 1,2 + deepseek 1,1
    expect(result.costRub).toBe(2.33);
  });

  it("сайт пустой и поиск ничего не дал — 422 с причиной", async () => {
    const { client } = fakeClient([], new Error("400 unsupported tool"));
    const opener = createOpener({ yandex, client, readSite: async () => site("Заголовок: Сайт") });
    const err = await opener(input).catch((e) => e);
    expect(err).toBeInstanceOf(OpenerError);
    expect(err.status).toBe(422);
    expect(err.message).toContain("на сайте почти нет текста");
  });

  it("не SiteError при чтении сайта — не глушится", async () => {
    const { client } = fakeClient([]);
    const opener = createOpener({
      yandex,
      client,
      readSite: async () => {
        throw new TypeError("баг");
      },
    });
    await expect(opener(input)).rejects.toThrow(TypeError);
  });

  it("лимит: 21-й запрос за 10 минут — 429, до модели не доходит", async () => {
    const { client, chatCalls } = fakeClient(Array.from({ length: 20 }, () => JSON.stringify(GOOD)));
    const opener = createOpener({ yandex, client, readSite: async () => site() });
    for (let i = 0; i < 20; i++) await opener(input);
    await expect(opener(input)).rejects.toMatchObject({ status: 429 });
    expect(chatCalls).toHaveLength(20);
  });
});

describe("проверки черновика", () => {
  it("цитата ищется без учёта регистра, ё, кавычек и пробелов", () => {
    expect(quoteInText("«Более 300 объектов»  на ПУЛЬТОВОЙ охране!", SITE_TEXT)).toBe(true);
    expect(quoteInText("Ёлки-палки, монтаж", "ёлки палки монтаж и сервис")).toBe(true);
    expect(quoteInText("300", SITE_TEXT)).toBe(false); // слишком короткая — не доказательство
    expect(quoteInText("оборудования", SITE_TEXT)).toBe(false); // одно слово — тоже
    expect(quoteInText("Авторизованный СЦ", "Сервисный центр. Авторизованный СЦ TRASSIR")).toBe(true);
    expect(quoteInText("Работаем с 1995 года", SITE_TEXT)).toBe(false);
  });

  it("запрещённые скриптом обороты помечаются, в том числе кириллические слова целиком", () => {
    const warn = (first_line: string) => draftWarnings({ ...GOOD, first_line }, true, "site").join(" ");
    expect(warn("Изучил ваш замечательный сайт!")).toMatch(/комплимент.*восклицательный/);
    expect(warn("Мы с командой поможем")).toContain("«мы» или «команда»");
    expect(warn("Наша студия давно работает")).toContain("«мы» или «команда»");
    expect(warn("Здравствуйте, увидел у вас выезд")).toContain("приветствие");
    expect(warn("У вас многолетний опыт")).toContain("опыт или клиенты");
    // «мы» внутри слова — не срабатывает
    expect(warn("Увидел, что вы монтируете умные замки и системы доступа")).toBe("");
    expect(warn("а".repeat(221))).toContain("длиннее 220");
  });

  it("пустая строка и «не наш» — свои предупреждения", () => {
    const w = draftWarnings({ ...GOOD, fit: "нет", hook: "", quote: "", first_line: "" }, false, "site");
    expect(w).toEqual([
      "Похоже, компания не из нашей ниши — проверьте, прежде чем писать.",
      "Зацепку на сайте не нашёл — посмотрите сайт сами.",
    ]);
  });

  it("нормализация не ломает чужие типы", () => {
    expect(normalizeDraft(null)).toBeNull();
    expect(normalizeDraft({ variant: "в — счета", fit: "Да." })).toEqual({ variant: "В", fit: "да" });
    expect(normalizeDraft({ variant: "C" })).toEqual({ variant: "C" }); // не по схеме — повтор
  });

  it("домен для поиска — без www и схемы", () => {
    expect(hostOf("www.ohrana.ru")).toBe("ohrana.ru");
    expect(hostOf("https://ohrana.ru/uslugi")).toBe("ohrana.ru");
    expect(hostOf("::")).toBeNull();
  });
});
