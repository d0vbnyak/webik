/**
 * API админки внутри dev-сервера Vite (см. vite.config.ts).
 *
 * База — PGlite в папке .data/pglite: настоящий Postgres без установки, данные
 * переживают перезапуск. Экземпляр один на процесс: Vite перезагружает модуль
 * при правках, а открыть одну папку PGlite дважды нельзя.
 *
 * DEV_AUTOLOGIN=1 в .env включает GET /api/dev/login — вход без пароля под
 * dev@webik.local. Нужен для проверки админки в браузере. Существует только
 * здесь: в прод-точку входа server/main.ts этот маршрут не попадает.
 * Не запускайте Vite с --host, если в локальной базе реальные данные.
 */
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { getRequestListener, type HttpBindings } from "@hono/node-server";
import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createPgliteDb, migrate, type Db } from "./db/db";
import { createApp } from "./api/app";
import { SESSION_DAYS, createSession, createUser, sessionCookieName } from "./api/auth";
import { clientIp } from "./http";
import type { OrderNotifier } from "./orders";

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

const g = globalThis as typeof globalThis & { __webikDevDb?: Promise<Db> };

async function openDevDb(): Promise<Db> {
  const db = await createPgliteDb(".data/pglite");
  try {
    const applied = await migrate(db);
    if (applied.length) console.log(`[api] миграции: ${applied.join(", ")}`);
    return db;
  } catch (e) {
    // Закрываем, иначе следующая попытка откроет второй экземпляр на ту же папку
    await db.close().catch(() => {});
    throw e;
  }
}

// Обработчик живёт, пока Vite не перезагрузит модуль: лимитер входа и таймеры
// не должны пересоздаваться на каждый запрос
let handler: Promise<Handler> | null = null;

type DevOptions = { autologin: boolean; orderNotifier: OrderNotifier | null };

export function getDevHandler(opts: DevOptions): Promise<Handler> {
  handler ??= buildDevHandler(opts);
  handler.catch(() => {
    handler = null;
  });
  return handler;
}

/** База разработки — одна на процесс. Её же берёт чат (vite.config.ts), чтобы писать заявки в CRM. */
export function getDevDb(): Promise<Db> {
  if (!g.__webikDevDb) {
    g.__webikDevDb = openDevDb();
    // Упавшую инициализацию не запоминаем — следующий запрос попробует снова
    g.__webikDevDb.catch(() => {
      g.__webikDevDb = undefined;
    });
  }
  return g.__webikDevDb;
}

async function buildDevHandler(opts: DevOptions): Promise<Handler> {
  const db = await getDevDb();
  // База открыта раньше, чем появились новые миграции, — докатываем их
  const applied = await migrate(db);
  if (applied.length) console.log(`[api] миграции: ${applied.join(", ")}`);

  const root = new Hono<{ Bindings: HttpBindings }>();
  if (opts.autologin) {
    root.get("/api/dev/login", async (c) => {
      const [existing] = await db.query<{ id: string }>("select id from users where email = 'dev@webik.local'");
      const userId = existing?.id ?? (await createUser(db, "dev@webik.local", randomBytes(24).toString("hex"))).id;
      setCookie(c, sessionCookieName(false), await createSession(db, userId), {
        httpOnly: true,
        sameSite: "Strict",
        path: "/",
        maxAge: SESSION_DAYS * 86400,
      });
      return c.redirect("/admin");
    });
  }
  root.route("/", createApp({
    db,
    secureCookies: false,
    clientIp: (c) => clientIp(c, () => false),
    orderNotifier: opts.orderNotifier,
  }));
  return getRequestListener(root.fetch) as Handler;
}
