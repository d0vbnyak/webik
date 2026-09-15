/**
 * API админки WebIK.
 *
 *   POST /api/auth/login    { email, password, totp? } → cookie сессии
 *   POST /api/auth/logout
 *   GET  /api/auth/session  → { user } или { user: null }
 *   POST /api/db            описание запроса (query.ts) → { data, error }
 *   POST /api/order         заявка с сайта { name, contact, task, details } → Telegram
 *
 * Защита от CSRF: cookie с SameSite=Strict, и каждый POST обязан нести
 * заголовок X-WebIK: 1 — чужой сайт не может выставить его без CORS-разрешения.
 * НЕ добавлять CORS-middleware: вместе с ним эта защита перестаёт работать.
 *
 * Лимиты входа:
 *   - 5 неудач за 15 минут с одного адреса (IPv6 — с одной /64);
 *   - 10 неудач за 15 минут на email существующего пользователя — кроме
 *     доверенного устройства (браузера, откуда уже входили): так посторонний
 *     не запрёт админа, перебирая пароли к его адресу;
 *   - 5 неверных кодов подряд — код не принимается 15 минут (счётчик в базе);
 *   - одна проверка пароля за раз, отдельная очередь для доверенного браузера,
 *     ожидание не дольше 1,5 с.
 * Любая неудача входа — один и тот же ответ: по нему нельзя понять, что именно
 * не так (пароль, код или блокировка).
 */
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Db } from "../db/db";
import {
  DEVICE_DAYS,
  EMAIL_MAX,
  LoginLimiter,
  LoginStats,
  PASSWORD_MAX,
  SESSION_DAYS,
  Semaphore,
  checkCredentials,
  createSession,
  createTrustedDevice,
  deleteSession,
  deviceCookieName,
  isTokenFormat,
  isTrustedDevice,
  limiterIpKey,
  logLoginEvent,
  normalizeEmail,
  pruneLoginEvents,
  sessionCookieName,
  sessionUser,
  touchTrustedDevice,
  userExists,
  type SessionUser,
} from "./auth";
import { QueryError, buildQuery, referenceChecks, validateRequest } from "./query";
import { OrderLimiter, submitOrder, type OrderNotifier } from "../orders";
import { validateOrder } from "../../shared/order";
import { TELEGRAM_HANDLE } from "../../shared/contacts";

export type AppOptions = {
  db: Db;
  /** С HTTPS — true: cookie Secure и с префиксом __Host-. На localhost — false. */
  secureCookies: boolean;
  /** Адрес клиента (см. server/http.ts). */
  clientIp: (c: Context) => string;
  limiter?: LoginLimiter;
  /** Проверки пароля для остальных и для доверенного браузера — раздельно. */
  passwordChecks?: Semaphore;
  trustedPasswordChecks?: Semaphore;
  /** Ожидание свободной проверки, мс. */
  passwordWaitMs?: number;
  /** Отправка заявок с сайта в Telegram (server/orders.ts). null — не настроена. */
  orderNotifier?: OrderNotifier | null;
  orderLimiter?: OrderLimiter;
};

type Env = { Variables: { user: SessionUser } };

const IP_MAX_FAILS = 5;
const EMAIL_MAX_FAILS = 10;
const LOGIN_FAILED = "Неверный email, пароль или код";

export function createApp(opts: AppOptions) {
  const { db } = opts;
  const limiter = opts.limiter ?? new LoginLimiter();
  const passwordChecks = opts.passwordChecks ?? new Semaphore(1);
  const trustedPasswordChecks = opts.trustedPasswordChecks ?? new Semaphore(1);
  const passwordWaitMs = opts.passwordWaitMs ?? 1500;
  const stats = new LoginStats();

  // Сводка отказов раз в минуту и чистка журнала раз в час — по таймеру, не на каждый запрос
  setInterval(() => {
    const line = stats.flush();
    if (line) console.warn(`[auth] отказы входа за минуту: ${line}`);
  }, 60_000).unref();
  setInterval(() => void pruneLoginEvents(db).catch(() => {}), 60 * 60_000).unref();
  const SESSION = sessionCookieName(opts.secureCookies);
  const DEVICE = deviceCookieName(opts.secureCookies);
  const cookieBase = { httpOnly: true, secure: opts.secureCookies, sameSite: "Strict" as const, path: "/" };

  const app = new Hono<Env>().basePath("/api");

  app.use("*", async (c, next) => {
    if (c.req.method !== "GET" && c.req.method !== "HEAD" && c.req.header("x-webik") !== "1") {
      return c.json({ error: "Запрос отклонён" }, 403);
    }
    await next();
    c.header("Cache-Control", "no-store");
  });

  // Размер тела считается по реально прочитанным байтам — работает и без Content-Length
  const tooLarge = (c: Context) => c.json({ error: "Слишком большой запрос", data: null }, 413);
  app.use("/auth/*", bodyLimit({ maxSize: 8 * 1024, onError: tooLarge }));
  app.use("/db", bodyLimit({ maxSize: 2 * 1024 * 1024, onError: tooLarge }));
  app.use("/order", bodyLimit({ maxSize: 16 * 1024, onError: tooLarge }));

  /**
   * Пользователь по cookie сессии. Браузер может прислать несколько cookie с одним
   * именем (старая с другим Path) — проверяем каждую, а не только первую.
   * В проде имя с префиксом __Host-, такую cookie не подсунуть с поддомена.
   */
  const sessionTokens = (c: Context): string[] =>
    (c.req.header("cookie") ?? "")
      .split(";")
      .map((part) => part.trim())
      .filter((part) => part.startsWith(`${SESSION}=`))
      .map((part) => part.slice(SESSION.length + 1))
      // Не похожие на токен отсеиваются без запроса к базе
      .filter(isTokenFormat)
      .slice(0, 3);

  const currentUser = async (c: Context): Promise<SessionUser | null> => {
    for (const token of sessionTokens(c)) {
      const user = await sessionUser(db, token);
      if (user) return user;
    }
    return null;
  };

  const readJson = async (c: Context): Promise<Record<string, unknown> | null> => {
    try {
      const body = await c.req.json();
      return body && typeof body === "object" && !Array.isArray(body) ? body : null;
    } catch {
      return null;
    }
  };

  app.post("/auth/login", async (c) => {
    const body = await readJson(c);
    const email = typeof body?.email === "string" ? body.email : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const totp = typeof body?.totp === "string" && body.totp.trim() ? body.totp : undefined;
    if (!email || !password) return c.json({ error: "Введите email и пароль" }, 400);
    if (email.length > EMAIL_MAX || password.length > PASSWORD_MAX || (totp && totp.length > 10)) {
      return c.json({ error: LOGIN_FAILED }, 400);
    }

    const ip = opts.clientIp(c);
    const ipLimit = { key: `ip:${limiterIpKey(ip)}`, max: IP_MAX_FAILS };
    // Заблокированный адрес отсекаем сразу — без очереди и без запросов к базе
    const ipBlocked = limiter.blockedFor([ipLimit]);
    if (ipBlocked > 0) {
      stats.add("rate_limited");
      c.header("Retry-After", String(ipBlocked));
      return c.json({ error: `Слишком много попыток. Попробуйте через ${Math.ceil(ipBlocked / 60)} мин.` }, 429);
    }

    const deviceToken = getCookie(c, DEVICE);
    const trusted = await isTrustedDevice(db, deviceToken, email);

    // Сначала место в очереди, потом лимитер: отказ «занято» не оставляет следов в лимитере
    const release = await (trusted ? trustedPasswordChecks : passwordChecks).acquire(passwordWaitMs);
    if (!release) {
      stats.add("busy");
      c.header("Retry-After", "2");
      return c.json({ error: "Сервер занят, повторите через пару секунд" }, 429);
    }

    try {
      const limits = [ipLimit];
      // Счётчик по email — только для настоящих пользователей: мусорные адреса не создают ключей
      if (!trusted && (await userExists(db, email))) {
        limits.push({ key: `email:${normalizeEmail(email)}`, max: EMAIL_MAX_FAILS });
      }
      const reserved = limiter.reserve(limits);
      if ("retryAfter" in reserved) {
        stats.add("rate_limited");
        c.header("Retry-After", String(reserved.retryAfter));
        return c.json({ error: `Слишком много попыток. Попробуйте через ${Math.ceil(reserved.retryAfter / 60)} мин.` }, 429);
      }

      const result = await checkCredentials(db, email, password, totp, { trustedDevice: trusted });
      if (!result.ok) {
        await logLoginEvent(db, ip, email, result.reason);
        return c.json({ error: LOGIN_FAILED }, 401);
      }

      reserved.release();
      await logLoginEvent(db, ip, email, "ok");
      // Старая сессия этого браузера больше не нужна
      await deleteSession(db, getCookie(c, SESSION));
      setCookie(c, SESSION, await createSession(db, result.user.id), { ...cookieBase, maxAge: SESSION_DAYS * 86400 });
      if (trusted) {
        await touchTrustedDevice(db, deviceToken);
      } else {
        setCookie(c, DEVICE, await createTrustedDevice(db, result.user.id), { ...cookieBase, maxAge: DEVICE_DAYS * 86400 });
      }
      return c.json({ user: { id: result.user.id, email: result.user.email } });
    } finally {
      release();
    }
  });

  app.post("/auth/logout", async (c) => {
    for (const token of sessionTokens(c)) await deleteSession(db, token);
    deleteCookie(c, SESSION, { path: "/", secure: opts.secureCookies });
    return c.json({ ok: true });
  });

  app.get("/auth/session", async (c) => {
    const user = await currentUser(c);
    return c.json({ user });
  });

  app.use("/db", async (c, next) => {
    const user = await currentUser(c);
    if (!user) return c.json({ data: null, error: { message: "Сессия истекла — войдите снова" } }, 401);
    c.set("user", user);
    await next();
  });

  app.post("/db", async (c) => {
    const userId = c.get("user").id;
    try {
      const req = validateRequest(await readJson(c));
      for (const check of referenceChecks(req, userId)) {
        const found = await db.query(check.sql, check.params);
        if (found.length !== check.expected) throw new QueryError(`Ссылка ${check.column} ведёт на несуществующую запись`);
      }
      const { sql, params } = buildQuery(req, userId);
      const rows = await db.query(sql, params);
      return c.json({ data: req.columns || req.action === "select" ? rows : null, error: null });
    } catch (e) {
      if (e instanceof QueryError) return c.json({ data: null, error: { message: e.message } }, 400);
      // Ошибки Postgres (нарушение check, unique) — понятный текст без внутренностей
      const pg = e as { code?: string };
      if (pg.code && /^(22|23)/.test(pg.code)) {
        return c.json({ data: null, error: { message: pgMessage(pg.code), code: pg.code } }, 400);
      }
      console.error("[api/db]", (e as Error).message);
      return c.json({ data: null, error: { message: "Ошибка сервера" } }, 500);
    }
  });

  // Заявка с сайта. Публичный маршрут: сессия не нужна, защита — лимиты и поле-ловушка
  const orderLimiter = opts.orderLimiter ?? new OrderLimiter();
  app.post("/order", async (c) => {
    const body = await readJson(c);
    // Поле-ловушка скрыто от людей; заполнил — бот. Отвечаем «ок», чтобы он не подбирал обход
    // В логе — на случай, если поле заполнит автозаполнение браузера у живого клиента
    if (typeof body?.website === "string" && body.website !== "") {
      console.warn("[order] сработало поле-ловушка, заявка не отправлена");
      return c.json({ ok: true });
    }

    const order = validateOrder(body);
    if ("error" in order) return c.json({ error: order.error }, 400);

    const result = await submitOrder(order, "form", opts.clientIp(c), {
      notify: opts.orderNotifier ?? null,
      limiter: orderLimiter,
    });
    if (result.ok) return c.json({ ok: true });
    const direct = `Напишите напрямую в Telegram ${TELEGRAM_HANDLE}.`;
    switch (result.reason) {
      case "rate_limited":
        return c.json({ error: `Заявок с вашего адреса уже много. ${direct}` }, 429);
      case "not_configured":
        return c.json({ error: `Приём заявок временно не работает. ${direct}` }, 503);
      default:
        return c.json({ error: `Не получилось отправить заявку. ${direct}` }, 502);
    }
  });

  app.notFound((c) => c.json({ error: "Не найдено" }, 404));
  app.onError((e, c) => {
    console.error("[api]", e.message);
    return c.json({ error: "Ошибка сервера" }, 500);
  });

  return app;
}

function pgMessage(code: string): string {
  switch (code) {
    case "23505":
      return "Такая запись уже есть";
    case "23503":
      return "Связанная запись не найдена";
    case "23514":
      return "Значение не проходит проверку";
    case "23502":
      return "Не заполнено обязательное поле";
    default:
      return "Некорректные данные";
  }
}
