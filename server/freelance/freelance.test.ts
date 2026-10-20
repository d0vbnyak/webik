import { describe, expect, it } from "vitest";
import { matchJob } from "./filter";
import { extractStateData, parseFlRss, parseFreelanceRu, parseKwork, type Job, type Source } from "./sources";
import { formatJob, TelegramError, type Telegram } from "./telegram";
import { checkOnce, type Seen } from "./watch";

// Куски настоящих страниц от 20.10.2026, урезанные до нужного
const FL_RSS = `<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel><title>Заказы на FL.ru</title>
  <item>
    <title><![CDATA[Настройка Kanban-доски в Miro (Бюджет: 10 000  &#8381;, для всех)]]></title>
    <link>https://www.fl.ru/projects/5525989/nastroyka-kanban-doski.html</link>
    <description><![CDATA[Нужно настроить Kanban&nbsp;в Miro.<br/>- объект / ID;]]></description>
    <category><![CDATA[Автоматизация бизнеса / Внедрение CRM]]></category>
  </item>
  <item>
    <title><![CDATA[Редизайн сайта (для всех)]]></title>
    <link>https://www.fl.ru/projects/5525990/redizayn.html</link>
    <description><![CDATA[Сайт 2012 года]]></description>
  </item>
</channel></rss>`;

const KWORK_HTML = `<script>window.stateData={"categories":{"11":{"id":"11","name":"Разработка и IT","cats":[{"id":"37","name":"Сайт под ключ"}]}},
"wants":[{"id":3267982,"name":"Разработка продающего лендинга","description":"Здравствуйте! \\r\\nТребуется лендинг \\"под ключ\\" {}","priceLimit":"20000.00","possiblePriceLimit":60000,"category_id":"37"}]};window.firebaseConfig={"a":1};</script>`;

const FREELANCE_RU_HTML = `<div class="task-feed-list"><article class="task-card"><div class="task-card__main">
  <a class="task-card__title-link" href="/task/view/13127" title="Автоматизация а make">
    Автоматизация а make            </a>
  <p class="task-card__desc">Я заменил модули Open AI на Deepseek.</p>
  <div class="task-card__chips"><span class="task-chip task-chip--cat">ИИ и Нейросети</span></div>
</div><div class="task-card__side"><div class="task-card__budget">
  <span class="bold">2 000 &#8381;</span> <span class="cost-unit">/ заказ</span></div></div></article></div>`;

describe("площадки", () => {
  it("FL.ru: бюджет вынимается из заголовка, сущности раскрываются", () => {
    const [kanban, redesign] = parseFlRss(FL_RSS);
    expect(kanban).toMatchObject({
      key: "fl:5525989",
      title: "Настройка Kanban-доски в Miro",
      budget: "10 000 ₽",
      budgetRub: 10000,
      category: "Автоматизация бизнеса / Внедрение CRM",
    });
    expect(kanban.description).toBe("Нужно настроить Kanban в Miro.\n- объект / ID;");
    expect(redesign).toMatchObject({ key: "fl:5525990", title: "Редизайн сайта", budget: null, budgetRub: null, category: null });
  });

  it("Kwork: stateData вырезается, даже когда за ним идёт другой код, а в строках скобки и кавычки", () => {
    expect(() => extractStateData("<html></html>")).toThrow(/stateData/);
    const [job] = parseKwork(KWORK_HTML);
    expect(job).toMatchObject({
      key: "kwork:3267982",
      url: "https://kwork.ru/projects/3267982/view",
      budget: "20 000 ₽, допустимо до 60 000 ₽",
      budgetRub: 60000,
      category: "Разработка и IT / Сайт под ключ",
    });
    expect(job.description).toBe('Здравствуйте!\nТребуется лендинг "под ключ" {}');
  });

  it("freelance.ru: карточка ленты", () => {
    expect(parseFreelanceRu(FREELANCE_RU_HTML)).toEqual([
      {
        key: "freelance.ru:13127",
        source: "freelance.ru",
        title: "Автоматизация а make",
        description: "Я заменил модули Open AI на Deepseek.",
        url: "https://freelance.ru/task/view/13127",
        budget: "2 000 ₽ / заказ",
        budgetRub: 2000,
        category: "ИИ и Нейросети",
      },
    ]);
  });
});

const job = (title: string, description = "", budgetRub: number | null = null) => ({ title, description, budgetRub });
const topics = (title: string, description = "") => matchJob(job(title, description), { minBudget: 0 })?.topics ?? null;

describe("фильтр", () => {
  it("находит темы студии в заголовке", () => {
    expect(topics("Редизайн сайта стоматологии")).toEqual(["Редизайн"]);
    expect(topics("Переделать старый сайт на WordPress")).toContain("Редизайн");
    expect(topics("Нужен лендинг для курсов")).toEqual(["Сайт / лендинг"]);
    expect(topics("Сделать сайт визитку")).toEqual(["Сайт / лендинг"]);
    expect(topics("Telegram-бот консультант на Python (OpenAI API)")).toEqual(["Чат-бот", "ИИ"]);
    expect(topics("ИИ ассистент")).toEqual(["ИИ"]);
    expect(topics("Интеграция голосового робота с amoCRM")).toEqual(["Автоматизация"]);
  });

  it("не путает похожие слова", () => {
    expect(topics("Доработка работ по ремонту")).toBeNull(); // «бот» внутри «работ»
    expect(topics("Купить пиино")).toBeNull(); // «ии» внутри слова
    expect(topics("Подготовка векторных файлов (CDR/AI)")).toBeNull();
  });

  it("редизайн ищется и в описании, остальное — только в заголовке", () => {
    expect(topics("Нужен дизайнер", "У нас устаревший сайт, хотим обновить сайт целиком")).toEqual(["Редизайн"]);
    expect(topics("Дизайн листовки", "Как у нашего чат-бота")).toBeNull();
  });

  it("стоп-слова в заголовке отсекают заказ", () => {
    expect(topics("AI-фотосессия для ювелирного бренда")).toBeNull();
    expect(topics("Оформление презентации. Не ИИ")).toBeNull();
    expect(topics("Вакансия: разработчик чат-ботов")).toBeNull();
  });

  it("порог бюджета не трогает заказы без бюджета", () => {
    expect(matchJob(job("Лендинг", "", 5000), { minBudget: 10000 })).toBeNull();
    expect(matchJob(job("Лендинг", "", 15000), { minBudget: 10000 })).not.toBeNull();
    expect(matchJob(job("Лендинг", "", null), { minBudget: 10000 })).not.toBeNull();
  });
});

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

  function recorder(fail?: (n: number) => Error | null): Telegram & { sent: string[] } {
    const sent: string[] = [];
    return {
      sent,
      async send(html) {
        const err = fail?.(sent.length);
        if (err) throw err;
        sent.push(html);
      },
    };
  }
  const run = (jobs: Job[], seen: Seen, tg: Telegram | null) =>
    checkOnce({ sources: [source(jobs)], seen, filter: { minBudget: 0 }, telegram: tg, log: () => {}, pauseMs: 0 });

  it("первый проход по площадке только запоминает, следующий шлёт новые подходящие", async () => {
    const seen: Seen = { sources: [], keys: [] };
    const tg = recorder();
    await run([landing(1)], seen, tg);
    expect(tg.sent).toEqual([]);
    expect(seen.sources).toEqual(["FL.ru"]);

    const r = await run([landing(1), landing(2), landing(2), boring(3)], seen, tg);
    expect(r.sent).toBe(1);
    expect(tg.sent).toHaveLength(1);
    expect(tg.sent[0]).toContain("Лендинг 2");
    expect(seen.keys).toEqual(["fl:1", "fl:2", "fl:3"]);

    await run([landing(1), landing(2), boring(3)], seen, tg);
    expect(tg.sent).toHaveLength(1);
  });

  it("сбой сети оставляет заказ на следующий проход, отказ Telegram — нет", async () => {
    const seen: Seen = { sources: ["FL.ru"], keys: [] };
    await run([landing(1), landing(2)], seen, recorder(() => new Error("fetch failed")));
    expect(seen.keys).toEqual([]);

    // Первое сообщение отклонено навсегда, второе ушло
    let calls = 0;
    const tg = recorder(() => (calls++ === 0 ? new TelegramError("Telegram ответил 400", true) : null));
    await run([landing(1), landing(2)], seen, tg);
    expect(seen.keys).toEqual(["fl:1", "fl:2"]);
    expect(tg.sent).toHaveLength(1);
  });

  it("площадка с ошибкой не мешает остальным; пробный запуск не трогает память", async () => {
    const broken: Source = { name: "Kwork", fetchJobs: async () => Promise.reject(new Error("503")) };
    const seen: Seen = { sources: ["FL.ru", "Kwork"], keys: [] };
    const r = await checkOnce({ sources: [broken, source([landing(5)])], seen, filter: { minBudget: 0 }, telegram: null, log: () => {} });
    expect(r).toEqual({ found: 1, sent: 1, failedSources: ["Kwork"] });
    expect(seen).toEqual({ sources: ["FL.ru", "Kwork"], keys: [] });
  });
});
