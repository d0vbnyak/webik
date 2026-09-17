/**
 * Чтение сайта компании для ИИ: главная и до двух страниц «о компании» / «услуги»
 * → чистый текст.
 *
 * Адрес сайта приходит из CRM, то есть от пользователя, поэтому запросы
 * защищены от SSRF: сервер не должен ходить на свои и чужие внутренние адреса
 * (localhost, docker-сеть, соседний прод на этом же сервере). Проверка стоит
 * в DNS-резолве самого соединения — адрес, который проверили, и адрес, куда
 * подключились, совпадают, подменить DNS между ними нельзя. Каждый редирект
 * проверяется так же.
 *
 * Текст страницы достаёт defuddle (замена Mozilla Readability) поверх
 * linkedom. Лендинги он иногда режет слишком сильно — тогда берём весь текст body.
 */
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net, { BlockList } from "node:net";
import zlib from "node:zlib";
import { parseHTML } from "linkedom";
import { Defuddle } from "defuddle/node";

/**
 * Сайт не прочитан. searchable: false — адрес заведомо негодный (внутренняя
 * сеть, мусор, домена нет), платный веб-поиск по нему бесполезен.
 */
export class SiteError extends Error {
  constructor(
    message: string,
    readonly searchable = true,
  ) {
    super(message);
  }
}

/** Сколько нужно от DOM linkedom: в серверном tsconfig типов DOM нет. */
type El = { getAttribute(name: string): string | null; textContent: string | null; remove(): void };
type Doc = ReturnType<typeof parseHTML>["document"];
const all = (doc: Doc, selector: string) => Array.from(doc.querySelectorAll(selector)) as unknown as El[];

export const SITE_LIMITS = {
  /** Весь разбор одной страницы, мс */
  pageTimeoutMs: 15_000,
  /** Сжатый ответ, байт */
  maxRawBytes: 3 * 1024 * 1024,
  /** Распакованный HTML, байт */
  maxHtmlBytes: 3 * 1024 * 1024,
  maxRedirects: 4,
  /** Страниц кроме главной */
  extraPages: 2,
  /** Текста с одной страницы, символов */
  pageChars: 6000,
  /** Текста со всего сайта, символов — около 4 тыс. токенов */
  totalChars: 14_000,
  /** Короче — defuddle, скорее всего, срезал лендинг: берём весь body */
  minExtractChars: 500,
} as const;

// Списки раздельные: BlockList сверяет IPv4 и с IPv6-правилами (как ::ffff:a.b.c.d),
// и правило ::ffff:0:0/96 в общем списке запретило бы весь IPv4
const BLOCKED_V4 = new BlockList();
for (const [addr, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) BLOCKED_V4.addSubnet(addr, prefix, "ipv4");
const BLOCKED_V6 = new BlockList();
for (const [addr, prefix] of [
  // ::/96 — в том числе :: и ::1; ::ffff:0:0/96 — IPv4 внутри IPv6: у настоящего сайта такого адреса нет
  // ::ffff:0:0:0/96 — IPv4-translated, fec0::/10 — устаревшие site-local
  ["::", 96], ["::ffff:0:0", 96], ["::ffff:0:0:0", 96], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["100::", 64],
  ["2001::", 32], ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
] as const) BLOCKED_V6.addSubnet(addr, prefix, "ipv6");

/** Адрес, на который сервер ходить не должен. Нераспознанный — тоже запрещён. */
export function isBlockedAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return BLOCKED_V4.check(ip, "ipv4");
  if (family === 6) return BLOCKED_V6.check(ip, "ipv6");
  return true;
}

const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true, family: options.family, hints: options.hints }, (err, addresses) => {
    const cb = callback as (e: Error | null, a: string | dns.LookupAddress[], f?: number) => void;
    if (err) {
      // Домена нет — искать нечего; временный сбой DNS (EAI_AGAIN) — не повод отказываться от поиска
      const missing = err.code === "ENOTFOUND" || err.code === "ENODATA";
      return cb(new SiteError(missing ? `Домен ${hostname} не найден` : "Не удалось найти адрес сайта", !missing), "", 4);
    }
    // Хоть один внутренний адрес — отказ целиком: иначе соединение может уйти на него
    if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
      return cb(new SiteError(`Адрес ${hostname} ведёт во внутреннюю сеть`, false), "", 4);
    }
    if (options.all) cb(null, addresses);
    else cb(null, addresses[0].address, addresses[0].family);
  });
};

/** Проверка адреса до запроса: схема, порт, логин в адресе, IP-литерал. */
export function checkUrl(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new SiteError("Адрес сайта должен начинаться с http или https", false);
  if (url.username || url.password) throw new SiteError("Адрес сайта с логином не поддерживается", false);
  if (url.port && url.port !== "80" && url.port !== "443") throw new SiteError("Нестандартный порт сайта не поддерживается", false);
  // IP-литерал соединение не резолвит — проверяем здесь
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && isBlockedAddress(host)) throw new SiteError("Адрес сайта ведёт во внутреннюю сеть", false);
  if (!host.includes(".") && !net.isIP(host)) throw new SiteError("Некорректный адрес сайта", false);
}

/** Варианты адреса главной: как записано в CRM, без схемы — сначала https. */
export function homepageCandidates(website: string): URL[] {
  const raw = website.trim();
  if (!raw || /\s/.test(raw)) throw new SiteError("Некорректный адрес сайта", false);
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  const variants = withScheme ? [raw] : [`https://${raw}`, `http://${raw}`];
  const urls: URL[] = [];
  for (const v of variants) {
    try {
      urls.push(new URL(v));
    } catch {
      throw new SiteError("Некорректный адрес сайта", false);
    }
  }
  return urls;
}

const HEADERS = {
  "user-agent": "Mozilla/5.0 (compatible; WebIK/1.0; +https://webik.tech)",
  accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
  "accept-language": "ru,en;q=0.5",
  "accept-encoding": "gzip, deflate, br",
};

type Raw = { status: number; location: string | null; contentType: string; body: Buffer };

function requestOnce(url: URL, deadline: number): Promise<Raw> {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === "https:" ? https : http;
    let settled = false;
    const fail = (e: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      req.destroy();
      reject(e instanceof SiteError ? e : new SiteError(networkMessage(e)));
    };
    const req = mod.request(url, { method: "GET", headers: HEADERS, lookup: safeLookup, agent: false }, (res) => {
      const status = res.statusCode ?? 0;
      const location = typeof res.headers.location === "string" ? res.headers.location : null;
      const contentType = String(res.headers["content-type"] ?? "");
      if (status >= 300 && status < 400) {
        res.resume();
        settled = true;
        clearTimeout(timer);
        req.destroy();
        return resolve({ status, location, contentType, body: Buffer.alloc(0) });
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > SITE_LIMITS.maxRawBytes) return fail(new SiteError("Страница слишком большая"));
        chunks.push(chunk);
      });
      res.on("error", fail);
      res.on("end", () => {
        if (settled) return;
        try {
          const body = decompress(Buffer.concat(chunks), String(res.headers["content-encoding"] ?? ""));
          settled = true;
          clearTimeout(timer);
          resolve({ status, location, contentType, body });
        } catch (e) {
          fail(e as Error);
        }
      });
    });
    const timer = setTimeout(
      () => fail(new SiteError(`Сайт не ответил вовремя (на страницу — ${SITE_LIMITS.pageTimeoutMs / 1000} с)`)),
      Math.max(0, deadline - Date.now()),
    );
    req.on("error", fail);
    req.end();
  });
}

function networkMessage(e: Error): string {
  const code = (e as { code?: string }).code ?? "";
  if (/CERT|SSL|TLS|SELF_SIGNED/i.test(code)) return "У сайта неисправный сертификат HTTPS";
  if (code === "ECONNREFUSED") return "Сайт не принимает соединения";
  if (code === "ECONNRESET") return "Сайт оборвал соединение";
  return "Не удалось открыть сайт";
}

function decompress(body: Buffer, encoding: string): Buffer {
  const opts = { maxOutputLength: SITE_LIMITS.maxHtmlBytes };
  try {
    switch (encoding.trim().toLowerCase()) {
      case "gzip":
      case "x-gzip":
        return zlib.gunzipSync(body, opts);
      case "deflate":
        return zlib.inflateSync(body, opts);
      case "br":
        return zlib.brotliDecompressSync(body, opts);
      case "":
      case "identity":
        return body;
      default:
        throw new SiteError("Непонятное сжатие ответа сайта");
    }
  } catch (e) {
    if (e instanceof SiteError) throw e;
    throw new SiteError("Страница слишком большая или повреждена");
  }
}

/**
 * HTML в строку. Много российских сайтов до сих пор в windows-1251: кодировка
 * берётся из заголовка, затем из <meta>, иначе UTF-8.
 */
export function decodeHtml(body: Buffer, contentType: string): string {
  const head = body.subarray(0, 4096).toString("latin1");
  const charset =
    /charset\s*=\s*["']?([\w-]+)/i.exec(contentType)?.[1] ??
    /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1] ??
    "utf-8";
  try {
    return new TextDecoder(charset.toLowerCase()).decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

/** Одна страница с редиректами. Каждый шаг проверяется заново. */
export async function fetchPage(start: URL): Promise<{ url: URL; html: string }> {
  const deadline = Date.now() + SITE_LIMITS.pageTimeoutMs;
  let url = start;
  for (let hop = 0; hop <= SITE_LIMITS.maxRedirects; hop++) {
    try {
      checkUrl(url);
    } catch (e) {
      // Негоден адрес, куда увёл редирект, а не сам сайт: веб-поиск по домену ещё может помочь
      if (hop > 0 && e instanceof SiteError) throw new SiteError(e.message, true);
      throw e;
    }
    const res = await requestOnce(url, deadline);
    if (res.status >= 300 && res.status < 400) {
      if (!res.location) throw new SiteError(`Сайт ответил ${res.status} без адреса перехода`);
      url = new URL(res.location, url);
      continue;
    }
    if (res.status >= 400) throw new SiteError(`Сайт ответил ошибкой ${res.status}`);
    if (res.contentType && !/html/i.test(res.contentType)) throw new SiteError("По адресу сайта не HTML-страница");
    return { url, html: decodeHtml(res.body, res.contentType) };
  }
  throw new SiteError("Слишком много переадресаций");
}

/** Ссылки на страницы, где обычно есть факты о компании. */
const USEFUL_LINK = /о[-\s]?компани|о[-\s]?нас|about|o-?kompan|o-?nas|услуг|uslug|servic|обслуживан|obsluzh|охран|ohran|okhran|опт|opt/i;
const SKIP_LINK = /\.(pdf|jpe?g|png|gif|webp|svg|docx?|xlsx?|zip|rar)$/i;
/** Контакты и вакансии фактов для письма не дают, а под USEFUL_LINK попадают через «about» */
const SKIP_PAGE = /contact|kontakt|контакт|vakans|vacanc|вакан|politi|полит/i;

function sameSite(a: URL, b: URL): boolean {
  const strip = (h: string) => h.toLowerCase().replace(/^www\./, "");
  return strip(a.hostname) === strip(b.hostname);
}

export function pickExtraPages(document: Doc, base: URL, limit: number): URL[] {
  const found: URL[] = [];
  const seen = new Set([base.origin + base.pathname]);
  for (const a of all(document, "a[href]")) {
    if (found.length >= limit) break;
    const href = a.getAttribute("href") ?? "";
    const label = `${a.textContent ?? ""} ${href}`;
    if (!USEFUL_LINK.test(label) || SKIP_PAGE.test(label)) continue;
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (!sameSite(url, base) || (url.protocol !== "http:" && url.protocol !== "https:") || SKIP_LINK.test(url.pathname)) continue;
    const key = url.origin + url.pathname;
    if (seen.has(key)) continue;
    seen.add(key);
    url.hash = "";
    found.push(url);
  }
  return found;
}

function squeeze(text: string): string {
  return text.replace(/[ \t ]+/g, " ").replace(/\s*\n\s*/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Текст страницы: заголовок, описание и основное содержимое. */
export async function extractText(html: string, url: URL): Promise<{ text: string; links: URL[] }> {
  const { document } = parseHTML(html);
  // Ссылки — до defuddle: он правит документ
  const links = pickExtraPages(document, url, SITE_LIMITS.extraPages);
  const title = squeeze(document.querySelector("title")?.textContent ?? "");
  const description = squeeze(document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "");

  let body = "";
  try {
    // Без location defuddle берёт адрес из canonical и на относительном пишет ошибку в консоль
    Object.defineProperty(document, "location", { value: { href: url.href }, configurable: true });
    // useAsync: false — асинхронные экстракторы defuddle сами ходят в сеть (youtube, reddit…)
    // через fetch, мимо safeLookup и лимитов. Нам нужен только разбор уже скачанного HTML
    const parsed = await Defuddle(document as unknown as Parameters<typeof Defuddle>[0], url.href, {
      markdown: true,
      useAsync: false,
    });
    body = squeeze(parsed.content ?? "");
  } catch {
    body = "";
  }
  if (body.length < SITE_LIMITS.minExtractChars) {
    const { document: fresh } = parseHTML(html);
    for (const el of all(fresh, "script, style, noscript, svg, template, iframe")) el.remove();
    const whole = squeeze(fresh.body?.textContent ?? "");
    if (whole.length > body.length) body = whole;
  }

  const parts = [title && `Заголовок: ${title}`, description && `Описание: ${description}`, body].filter(Boolean);
  return { text: parts.join("\n").slice(0, SITE_LIMITS.pageChars), links };
}

export type SitePage = { url: string; text: string };
export type SiteText = { pages: SitePage[]; text: string };

/**
 * Главная и до двух полезных страниц. Главная не открылась — SiteError;
 * дополнительные страницы — по возможности, их ошибки не мешают.
 */
export async function readSite(website: string): Promise<SiteText> {
  let home: { url: URL; html: string } | null = null;
  let lastError: Error | null = null;
  for (const candidate of homepageCandidates(website)) {
    try {
      home = await fetchPage(candidate);
      break;
    } catch (e) {
      lastError = e as Error;
      // Адрес заведомо негодный — пробовать http вместо https бессмысленно
      if (lastError instanceof SiteError && !lastError.searchable) break;
    }
  }
  if (!home) throw lastError instanceof SiteError ? lastError : new SiteError("Не удалось открыть сайт");

  const homeUrl = home.url;
  const first = await extractText(home.html, homeUrl);
  const pages: SitePage[] = [{ url: homeUrl.href, text: first.text }];
  const extra = await Promise.allSettled(
    first.links.map(async (link) => {
      const page = await fetchPage(link);
      // Переадресация увела на другой сайт — такую страницу не берём
      if (!sameSite(page.url, homeUrl)) throw new SiteError("чужой сайт");
      return { url: page.url.href, text: (await extractText(page.html, page.url)).text };
    }),
  );
  // Две ссылки могут привести на одну страницу через переадресацию
  for (const r of extra) {
    if (r.status === "fulfilled" && r.value.text && !pages.some((p) => p.url === r.value.url)) pages.push(r.value);
  }

  const text = pages
    .map((p) => `### ${p.url}\n${p.text}`)
    .join("\n\n")
    .slice(0, SITE_LIMITS.totalChars);
  return { pages, text };
}
