/**
 * Прод-сервер WebIK: API админки + раздача собранного сайта (dist/).
 *
 * Переменные окружения:
 *   DATABASE_URL        postgres://… — обязательно
 *   PORT                по умолчанию 8080
 *   STATIC_DIR          папка сборки, по умолчанию ./dist
 *   TRUSTED_PROXY_HOST  имя прокси в docker-сети (caddy): только его
 *                       X-Forwarded-For считается адресом клиента
 *   SECURE_COOKIES      0 — только для локальной проверки без HTTPS
 *
 * Чат сайта (/api/chat) здесь не подключён: Anthropic API не обслуживает Россию,
 * в проде чат вернётся вместе с российской моделью.
 */
import { Hono } from "hono";
import { serve, type HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createPgDb, migrate } from "./db/db";
import { createApp } from "./api/app";
import { clientIp, trustedProxyByHost } from "./http";

process.on("unhandledRejection", (e) => {
  console.error("[webik] необработанная ошибка:", (e as Error)?.message ?? e);
});

const env = process.env;
if (!env.DATABASE_URL) {
  console.error("Не задан DATABASE_URL");
  process.exit(1);
}
const port = Number(env.PORT ?? 8080);
const staticDir = path.resolve(env.STATIC_DIR ?? "dist");
const secureCookies = env.SECURE_COOKIES !== "0";
const isTrustedProxy = trustedProxyByHost(env.TRUSTED_PROXY_HOST);

const db = await createPgDb(env.DATABASE_URL);
const applied = await migrate(db);
if (applied.length) console.log(`[db] миграции: ${applied.join(", ")}`);

// CSP: только свои скрипты. Внешнее — шрифты Google и видео героя с CloudFront.
// Инлайн-стили разрешены: их ставит библиотека анимаций.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "media-src 'self' https://d8j0ntlcm91z4.cloudfront.net",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const root = new Hono<{ Bindings: HttpBindings }>();

root.use("*", async (c, next) => {
  await next();
  c.header("Content-Security-Policy", CSP);
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Frame-Options", "DENY");
});

root.get("/healthz", async (c) => {
  await db.query("select 1");
  return c.text("ok");
});

root.route("/", createApp({ db, secureCookies, clientIp: (c) => clientIp(c, isTrustedProxy) }));

// Статика сборки; остальные пути — index.html (маршрутизация на клиенте)
root.use("/*", serveStatic({ root: path.relative(process.cwd(), staticDir) || "." }));
const indexHtml = await readFile(path.join(staticDir, "index.html"), "utf8").catch(() => null);
root.get("*", (c) => (indexHtml ? c.html(indexHtml) : c.text("Сборка не найдена", 404)));

const server = serve({ fetch: root.fetch, port, hostname: "0.0.0.0" }, (info) => {
  console.log(`[webik] слушаю :${info.port}, статика ${staticDir}`);
});

const shutdown = () => {
  server.close(() => void db.close().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
