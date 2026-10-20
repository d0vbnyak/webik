import { describe, expect, it } from "vitest";
import { matchJob } from "./filter";
import { extractStateData, parseFlRss, parseFreelanceRu, parseKwork, rublesIn } from "./sources";

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
      budgetRub: 20000,
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

  it("стоп-слова не режут обычные заказы студии", () => {
    expect(topics("Чат-бот для консультаций клиентов")).toEqual(["Чат-бот"]);
    expect(topics("Лендинг для онлайн-обучения")).toEqual(["Сайт / лендинг"]);
    expect(topics("Лендинг с видео")).toEqual(["Сайт / лендинг"]);
    expect(topics("Бот для записи на фотосессию")).toEqual(["Чат-бот"]);
    expect(topics("ИИ-бот для фотостудии")).toEqual(["Чат-бот", "ИИ"]);
    expect(topics("Сайт для фотостудии с ИИ-ассистентом")).toEqual(["ИИ"]);
    expect(topics("SEO-оптимизация и редизайн сайта")).toEqual(["Редизайн"]);
    expect(topics("AI-фотосессия для бренда")).toBeNull();
    expect(topics("Фото товаров через нейросеть")).toBeNull();
    expect(topics("Генерация AI-видео для Reels")).toBeNull();
    expect(topics("Нужен SEO для сайта")).toBeNull();
    expect(topics("Нужно продвижение сайта")).toBeNull();
  });

  it("порог бюджета не трогает заказы без бюджета", () => {
    expect(matchJob(job("Лендинг", "", 5000), { minBudget: 10000 })).toBeNull();
    expect(matchJob(job("Лендинг", "", 15000), { minBudget: 10000 })).not.toBeNull();
    expect(matchJob(job("Лендинг", "", null), { minBudget: 10000 })).not.toBeNull();
  });
});

describe("бюджет", () => {
  it("первое число, не рубли — null", () => {
    expect(rublesIn("от 1 000 до 5 000 ₽")).toBe(1000);
    expect(rublesIn("2 000 ₽ / заказ")).toBe(2000);
    expect(rublesIn("500 $")).toBeNull();
    expect(rublesIn("по договорённости")).toBeNull();
  });
});

