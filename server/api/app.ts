/**
 * API админки WebIK.
 *
 *   POST /api/auth/login    { email, password } → cookie сессии
 *   POST /api/auth/logout
 *   GET  /api/auth/session  → { user } или { user: null }
 *   POST /api/db            описание запроса (query.ts) → { data, error }
 *
 * Защита от CSRF: cookie с SameSite=Strict, и каждый POST обязан нести
 * заголовок X-WebIK: 1 — чужой сайт не может выставить его без CORS-разрешения,
 * а CORS мы не разрешаем никому.
 */
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Db } from "../db/db";
import {
  LoginLimiter,
  SESSION_COOKIE,
  SESSION_DAYS,
  login,
  logout,
  sessionUser,
  type SessionUser,
} from "./auth";
import { QueryError, buildQuery, referenceChecks, type DbRequest } from "./query";

export type AppOptions = {
  db: Db;
  /** Secure-cookie: в продакшене за HTTPS — true, на localhost — false. */
  secureCookies: boolean;
  /** Адрес клиента для лимита входа. За прокси — из X-Forwarded-For, иначе — сокет. */
  clientIp: (c: Context) => string;
  limiter?: LoginLimiter;
};

type Env = { Variables: { user: SessionUser } };

const MAX_BODY = 2 * 1024 * 1024;

export function createApp(opts: AppOptions) {
  const { db } = opts;
  const limiter = opts.limiter ?? new LoginLimiter();
  const app = new Hono<Env>().basePath("/api");

  app.use("*", async (c, next) => {
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      if (c.req.header("x-webik") !== "1") return c.json({ error: "Запрос отклонён" }, 403);
      const length = Number(c.req.header("content-length") ?? 0);
      if (length > MAX_BODY) return c.json({ error: "Слишком большой запрос" }, 413);
    }
    await next();
    c.header("Cache-Control", "no-store");
  });

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
    if (!email || !password || password.length > 1000) return c.json({ error: "Введите email и пароль" }, 400);

    const keys = [`ip:${opts.clientIp(c)}`, `email:${email.trim().toLowerCase()}`];
    const wait = limiter.retryAfter(keys);
    if (wait > 0) {
      c.header("Retry-After", String(wait));
      return c.json({ error: `Слишком много попыток. Попробуйте через ${Math.ceil(wait / 60)} мин.` }, 429);
    }

    const result = await login(db, email, password);
    if (!result) {
      limiter.fail(keys);
      return c.json({ error: "Неверный email или пароль" }, 401);
    }
    limiter.reset(keys);
    setCookie(c, SESSION_COOKIE, result.token, {
      httpOnly: true,
      secure: opts.secureCookies,
      sameSite: "Strict",
      path: "/api",
      maxAge: SESSION_DAYS * 24 * 60 * 60,
    });
    return c.json({ user: result.user });
  });

  app.post("/auth/logout", async (c) => {
    await logout(db, getCookie(c, SESSION_COOKIE));
    deleteCookie(c, SESSION_COOKIE, { path: "/api", secure: opts.secureCookies });
    return c.json({ ok: true });
  });

  app.get("/auth/session", async (c) => {
    const user = await sessionUser(db, getCookie(c, SESSION_COOKIE));
    return c.json({ user });
  });

  app.use("/db", async (c, next) => {
    const user = await sessionUser(db, getCookie(c, SESSION_COOKIE));
    if (!user) return c.json({ data: null, error: { message: "Сессия истекла — войдите снова" } }, 401);
    c.set("user", user);
    await next();
  });

  app.post("/db", async (c) => {
    const req = (await readJson(c)) as DbRequest | null;
    if (!req) return c.json({ data: null, error: { message: "Некорректный запрос" } }, 400);
    const userId = c.get("user").id;
    try {
      for (const check of referenceChecks(req, userId)) {
        const found = await db.query(check.sql, check.params);
        if (found.length !== check.expected) throw new QueryError(`Ссылка ${check.column} ведёт на несуществующую запись`);
      }
      const { sql, params } = buildQuery(req, userId);
      const rows = await db.query(sql, params);
      return c.json({ data: req.columns || req.action === "select" ? rows : null, error: null });
    } catch (e) {
      if (e instanceof QueryError) return c.json({ data: null, error: { message: e.message } }, 400);
      // Ошибки Postgres (нарушение check, unique) — текст полезен в форме, но без внутренностей
      const pg = e as { code?: string; message?: string };
      if (pg.code && /^(22|23)/.test(pg.code)) {
        return c.json({ data: null, error: { message: pgMessage(pg.code), code: pg.code } }, 400);
      }
      console.error("[api/db]", e);
      return c.json({ data: null, error: { message: "Ошибка сервера" } }, 500);
    }
  });

  app.notFound((c) => c.json({ error: "Не найдено" }, 404));
  app.onError((e, c) => {
    console.error("[api]", e);
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
