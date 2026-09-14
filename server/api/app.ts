/**
 * API админки WebIK.
 *
 *   POST /api/auth/login    { email, password, totp? } → cookie сессии
 *   POST /api/auth/logout
 *   GET  /api/auth/session  → { user } или { user: null }
 *   POST /api/db            описание запроса (query.ts) → { data, error }
 *
 * Защита от CSRF: cookie с SameSite=Strict, и каждый POST обязан нести
 * заголовок X-WebIK: 1 — чужой сайт не может выставить его без CORS-разрешения.
 * НЕ добавлять CORS-middleware: вместе с ним эта защита перестаёт работать.
 *
 * Лимиты входа (в памяти процесса):
 *   - 5 неудач за 15 минут с одного адреса (IPv6 — с одной /64);
 *   - 10 неудач за 15 минут на один email — кроме доверенного устройства
 *     (браузера, откуда уже входили): так посторонний не запрёт админа,
 *     перебирая пароли к его адресу;
 *   - не больше двух одновременных проверок пароля на весь сервер.
 */
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Db } from "../db/db";
import {
  DEVICE_DAYS,
  EMAIL_MAX,
  LoginLimiter,
  PASSWORD_MAX,
  SESSION_DAYS,
  Semaphore,
  checkCredentials,
  createSession,
  createTrustedDevice,
  deleteSession,
  deviceCookieName,
  isTrustedDevice,
  limiterIpKey,
  logLoginEvent,
  normalizeEmail,
  sessionCookieName,
  sessionUser,
  type SessionUser,
} from "./auth";
import { QueryError, buildQuery, referenceChecks, validateRequest } from "./query";

export type AppOptions = {
  db: Db;
  /** С HTTPS — true: cookie Secure и с префиксом __Host-. На localhost — false. */
  secureCookies: boolean;
  /** Адрес клиента (см. server/http.ts). */
  clientIp: (c: Context) => string;
  limiter?: LoginLimiter;
  passwordChecks?: Semaphore;
};

type Env = { Variables: { user: SessionUser } };

const IP_MAX_FAILS = 5;
const EMAIL_MAX_FAILS = 10;

export function createApp(opts: AppOptions) {
  const { db } = opts;
  const limiter = opts.limiter ?? new LoginLimiter();
  const passwordChecks = opts.passwordChecks ?? new Semaphore(2);
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
    const totp = typeof body?.totp === "string" ? body.totp : undefined;
    if (!email || !password) return c.json({ error: "Введите email и пароль" }, 400);
    if (email.length > EMAIL_MAX || password.length > PASSWORD_MAX || (totp && totp.length > 10)) {
      return c.json({ error: "Неверный email или пароль" }, 400);
    }

    const ip = opts.clientIp(c);
    const limits = [{ key: `ip:${limiterIpKey(ip)}`, max: IP_MAX_FAILS }];
    if (!(await isTrustedDevice(db, getCookie(c, DEVICE), email))) {
      limits.push({ key: `email:${normalizeEmail(email)}`, max: EMAIL_MAX_FAILS });
    }

    const reserved = limiter.reserve(limits);
    if ("retryAfter" in reserved) {
      await logLoginEvent(db, ip, email, "rate_limited");
      c.header("Retry-After", String(reserved.retryAfter));
      return c.json({ error: `Слишком много попыток. Попробуйте через ${Math.ceil(reserved.retryAfter / 60)} мин.` }, 429);
    }

    const release = passwordChecks.tryAcquire();
    if (!release) {
      reserved.release(); // сервер занят — это не неудачная попытка
      await logLoginEvent(db, ip, email, "busy");
      c.header("Retry-After", "2");
      return c.json({ error: "Сервер занят, повторите через пару секунд" }, 429);
    }
    let result;
    try {
      result = await checkCredentials(db, email, password, totp);
    } finally {
      release();
    }

    if (!result.ok) {
      // Запрос кода — не ошибка пароля: попытку не считаем
      if (result.reason === "need_totp") reserved.release();
      await logLoginEvent(db, ip, email, result.reason);
      if (result.reason === "need_totp") return c.json({ error: "Введите код из приложения", needTotp: true }, 401);
      if (result.reason === "bad_totp") return c.json({ error: "Неверный код", needTotp: true }, 401);
      return c.json({ error: "Неверный email или пароль" }, 401);
    }

    reserved.release();
    await logLoginEvent(db, ip, email, "ok");
    // Старая сессия этого браузера больше не нужна
    await deleteSession(db, getCookie(c, SESSION));
    setCookie(c, SESSION, await createSession(db, result.user.id), { ...cookieBase, maxAge: SESSION_DAYS * 86400 });
    if (!(await isTrustedDevice(db, getCookie(c, DEVICE), email))) {
      setCookie(c, DEVICE, await createTrustedDevice(db, result.user.id), { ...cookieBase, maxAge: DEVICE_DAYS * 86400 });
    }
    return c.json({ user: { id: result.user.id, email: result.user.email } });
  });

  app.post("/auth/logout", async (c) => {
    await deleteSession(db, getCookie(c, SESSION));
    deleteCookie(c, SESSION, { path: "/", secure: opts.secureCookies });
    return c.json({ ok: true });
  });

  app.get("/auth/session", async (c) => {
    const user = await sessionUser(db, getCookie(c, SESSION));
    return c.json({ user });
  });

  app.use("/db", async (c, next) => {
    const user = await sessionUser(db, getCookie(c, SESSION));
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
