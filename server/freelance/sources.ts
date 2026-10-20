/**
 * Площадки с заказами: загрузка и разбор в общий вид.
 *
 * Разбор отделён от загрузки — парсеры чистые и проверяются на сохранённых
 * кусках страниц (freelance.test.ts). Официальных API для чтения ленты у
 * площадок нет, поэтому:
 *   - FL.ru — RSS-лента по разделам;
 *   - Kwork — JSON, который страница /projects кладёт в window.stateData;
 *   - freelance.ru — обычный HTML ленты /task.
 * Habr Freelance закрыт (tasks.rss отвечает 410), Weblancer без ленты.
 *
 * Поменяли вёрстку — падает разбор одной площадки, остальные работают:
 * ошибки ловит watch.ts и пишет в лог.
 */
import { DOMParser, parseHTML } from "linkedom";

export type Job = {
  /** Уникален среди всех площадок: «fl:5525989», «kwork:3267982». */
  key: string;
  source: SourceName;
  title: string;
  description: string;
  url: string;
  /** Как написано на площадке: «10 000 ₽», «до 20 000 ₽». null — по договорённости. */
  budget: string | null;
  /** Число для фильтра по бюджету, в рублях. null — не указан. */
  budgetRub: number | null;
  category: string | null;
};

export type SourceName = "FL.ru" | "Kwork" | "freelance.ru";

export type Source = { name: SourceName; fetchJobs: (fetchImpl?: typeof fetch) => Promise<Job[]> };

/** Сколько нужно от DOM linkedom: в серверном tsconfig типов DOM нет. */
type El = {
  getAttribute(name: string): string | null;
  textContent: string | null;
  innerHTML: string;
  querySelector(selector: string): El | null;
  querySelectorAll(selector: string): Iterable<unknown>;
};
const all = (root: { querySelectorAll(selector: string): Iterable<unknown> }, selector: string) =>
  Array.from(root.querySelectorAll(selector)) as El[];

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

async function get(url: string, fetchImpl: typeof fetch): Promise<string> {
  const res = await fetchImpl(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "ru-RU,ru;q=0.9" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${url} ответил ${res.status}`);
  return res.text();
}

/** Текст без тегов, сущностей и лишних пробелов. */
export function plainText(html: string): string {
  const { document } = parseHTML(`<!doctype html><html><body><div>${html.replace(/<br\s*\/?>/gi, "\n")}</div></body></html>`);
  const text = document.querySelector("div")?.textContent ?? "";
  return text
    .replace(/\r/g, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** «10 000», «20000.00» → 10000. Не число — null. */
export function parseRub(s: string): number | null {
  const n = Number(s.replace(/[\s ]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

const rub = (n: number) => `${n.toLocaleString("ru-RU").replace(/ /g, " ")} ₽`;

// ─── FL.ru ──────────────────────────────────────────────────────────────────

/**
 * Разделы FL.ru, которые читаем. Общая лента all.xml отстаёт и короче,
 * поэтому — по разделам. Номера — параметр category в адресе RSS:
 * 2 «Сайты», 3 «Дизайн», 5 «Программирование», 31 «AI — искусственный интеллект»,
 * 34 «Мессенджеры», 40 «Интернет-магазины», 41 «Автоматизация бизнеса»
 * (сверено 21.10.2026: несуществующий номер отдаёт ленту из одного заказа).
 */
export const FL_CATEGORIES = [2, 3, 5, 31, 34, 40, 41];

/** Разбор RSS FL.ru. Бюджет FL.ru пишет в заголовке: «… (Бюджет: 10 000 ₽, для всех)». */
export function parseFlRss(xml: string): Job[] {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const jobs: Job[] = [];
  for (const item of all(doc, "item")) {
    const field = (name: string) => item.querySelector(name)?.textContent?.trim() ?? "";
    const url = field("link");
    const id = url.match(/\/projects\/(\d+)/)?.[1];
    if (!id) continue;

    let title = plainText(field("title"));
    let budget: string | null = null;
    let budgetRub: number | null = null;
    const tail = title.match(/\s*\(Бюджет:\s*([^,)]+)[^)]*\)\s*$/);
    if (tail) {
      title = title.slice(0, tail.index).trim();
      budget = tail[1].trim();
      budgetRub = parseRub(budget.replace(/[^\d\s.,]/g, ""));
    } else {
      title = title.replace(/\s*\([^)]*\)\s*$/, "").trim();
    }

    jobs.push({
      key: `fl:${id}`,
      source: "FL.ru",
      title,
      description: plainText(field("description")),
      url,
      budget,
      budgetRub,
      category: field("category") || null,
    });
  }
  return jobs;
}

export const flSource: Source = {
  name: "FL.ru",
  async fetchJobs(fetchImpl = fetch) {
    const feeds = await Promise.all(
      FL_CATEGORIES.map((c) => get(`https://www.fl.ru/rss/all.xml?category=${c}`, fetchImpl).then(parseFlRss)),
    );
    return feeds.flat();
  },
};

// ─── Kwork ──────────────────────────────────────────────────────────────────

/**
 * Разделы биржи Kwork: 11 «Разработка и IT», 15 «Дизайн».
 * На странице 12 заказов, свежие сверху; читаем по две страницы.
 */
export const KWORK_CATEGORIES = [11, 15];
const KWORK_PAGES = 2;

/** Достаёт объект из `window.stateData={…}` — за ним в том же скрипте идут другие присваивания. */
export function extractStateData(html: string): unknown {
  const marker = "window.stateData=";
  const start = html.indexOf(marker);
  if (start < 0) throw new Error("Kwork: на странице нет window.stateData");
  const from = start + marker.length;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = from; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return JSON.parse(html.slice(from, i + 1));
  }
  throw new Error("Kwork: stateData не закрыт");
}

type KworkWant = { id: number; name: string; description: string; priceLimit: string; possiblePriceLimit?: number; category_id: string };
type KworkCategory = { id: string; name: string; cats?: KworkCategory[] };

export function parseKwork(html: string): Job[] {
  const data = extractStateData(html) as { wants?: KworkWant[]; categories?: Record<string, KworkCategory> };
  if (!Array.isArray(data.wants)) throw new Error("Kwork: в stateData нет списка wants");

  const categoryNames = new Map<string, string>();
  for (const parent of Object.values(data.categories ?? {})) {
    for (const cat of parent.cats ?? []) categoryNames.set(String(cat.id), `${parent.name} / ${cat.name}`);
  }

  return data.wants.map((w) => {
    const price = parseRub(w.priceLimit);
    const upTo = w.possiblePriceLimit && price && w.possiblePriceLimit > price ? w.possiblePriceLimit : null;
    return {
      key: `kwork:${w.id}`,
      source: "Kwork" as const,
      title: plainText(w.name),
      description: plainText(w.description),
      url: `https://kwork.ru/projects/${w.id}/view`,
      budget: price ? (upTo ? `${rub(price)}, допустимо до ${rub(upTo)}` : rub(price)) : null,
      budgetRub: upTo ?? price,
      category: categoryNames.get(String(w.category_id)) ?? null,
    };
  });
}

export const kworkSource: Source = {
  name: "Kwork",
  async fetchJobs(fetchImpl = fetch) {
    const pages = [];
    for (const c of KWORK_CATEGORIES) {
      for (let page = 1; page <= KWORK_PAGES; page++) {
        // По очереди, а не разом: не похоже на всплеск и не ловит антибот
        pages.push(parseKwork(await get(`https://kwork.ru/projects?c=${c}&page=${page}`, fetchImpl)));
      }
    }
    return pages.flat();
  },
};

// ─── freelance.ru ───────────────────────────────────────────────────────────

export function parseFreelanceRu(html: string): Job[] {
  const { document } = parseHTML(html);
  const jobs: Job[] = [];
  for (const card of all(document, "article.task-card")) {
    const link = card.querySelector("a.task-card__title-link");
    const href = link?.getAttribute("href") ?? "";
    const id = href.match(/\/task\/view\/(\d+)/)?.[1];
    if (!link || !id) continue;

    const budgetText = plainText(card.querySelector(".task-card__budget")?.innerHTML ?? "");
    const budgetRub = parseRub(budgetText.replace(/[^\d\s.,]/g, ""));
    jobs.push({
      key: `freelance.ru:${id}`,
      source: "freelance.ru",
      title: plainText(link.innerHTML),
      description: plainText(card.querySelector(".task-card__desc")?.innerHTML ?? ""),
      url: `https://freelance.ru/task/view/${id}`,
      budget: budgetRub ? budgetText : null,
      budgetRub,
      category:
        all(card, ".task-chip--cat")
          .map((c) => plainText(c.innerHTML))
          .join(", ") || null,
    });
  }
  return jobs;
}

export const freelanceRuSource: Source = {
  name: "freelance.ru",
  async fetchJobs(fetchImpl = fetch) {
    return parseFreelanceRu(await get("https://freelance.ru/task", fetchImpl));
  },
};

export const ALL_SOURCES: Source[] = [flSource, kworkSource, freelanceRuSource];
