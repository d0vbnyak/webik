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
 *   SMTP_PASS …         письмо о каждой заявке с сайта (переменные — в server/orders.ts)
 *   TELEGRAM_BOT_TOKEN  то же в Telegram (с Timeweb не работает, см. server/orders.ts)
 *   TELEGRAM_CHAT_ID    Ничего не задано — заявки идут только в CRM
 *   YANDEX_API_KEY      ИИ-ассистент на сайте (Yandex AI Studio, server/chat.ts).
 *   YANDEX_FOLDER_ID    Нужны обе. Не заданы — чат выключен, и виджет
 *                       ассистента показывает форму заявки (POST /api/order).
 */
import { Hono } from "hono";
import { serve, type HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { RESPONSE_ALREADY_SENT } from "@hono/node-server/utils/response";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createPgDb, migrate } from "./db/db";
import { createApp } from "./api/app";
import { clientIp, trustedProxyByHost } from "./http";
import { handleChat, yandexFromEnv } from "./chat";
import { crmOrderSaver, notifiersFromEnv } from "./orders";

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
const orderNotifier = notifiersFromEnv(env);
if (!orderNotifier) console.warn("[webik] SMTP_PASS не задан — уведомлений о заявках нет, только CRM");
const yandex = yandexFromEnv(env);
if (!yandex) console.warn("[webik] YANDEX_API_KEY или YANDEX_FOLDER_ID не заданы — чат выключен, в виджете форма заявки");

const db = await createPgDb(env.DATABASE_URL);
const applied = await migrate(db);
if (applied.length) console.log(`[db] миграции: ${applied.join(", ")}`);

// CSP: только свои скрипты. Внешнее — шрифты Google.
// Инлайн-стили разрешены: их ставит библиотека анимаций.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "media-src 'self'",
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

if (yandex) {
  // Чат работает с Node-запросом напрямую (он же подключён к dev-серверу Vite),
  // поэтому отвечает сам, а Hono сообщаем, что ответ уже отправлен.
  // Адрес посетителя — через доверенный прокси, как у входа в админку: иначе
  // все посетители делили бы один лимит на адрес Caddy.
  const orderSaver = crmOrderSaver(db);
  root.on(["GET", "POST"], "/api/chat", async (c) => {
    await handleChat(c.env.incoming, c.env.outgoing, {
      yandex,
      orderSaver,
      orderNotifier,
      clientIp: () => clientIp(c, isTrustedProxy),
    });
    return RESPONSE_ALREADY_SENT;
  });
} else {
  // Чат выключен: виджет спрашивает GET и показывает форму заявки.
  // На POST — понятный ответ вместо «Запрос отклонён» (демо-чат на «Возможностях»)
  // orders: принимаются ли заявки. Нет — виджет сразу показывает контакты вместо формы.
  // Заявки пишутся в CRM этой же базы, так что приём есть всегда
  root.get("/api/chat", (c) => c.json({ enabled: false, orders: true }));
  root.post("/api/chat", (c) =>
    c.json({ error: "ИИ-ассистент временно отдыхает. Оставьте заявку в окне справа внизу — ответим сами." }, 503),
  );
}

root.route("/", createApp({ db, secureCookies, clientIp: (c) => clientIp(c, isTrustedProxy), orderNotifier }));

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
