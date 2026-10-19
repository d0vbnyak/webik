import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { crmOrderSaver, notifiersFromEnv } from "./server/orders";
import { yandexFromEnv } from "./server/ai/yandex";

/**
 * Эндпоинт чата на dev-сервере.
 *
 * Ключ модели и токен Telegram читаются здесь, на сервере, и во фронтенд не
 * попадают: loadEnv с пустым префиксом отдаёт все переменные из .env и
 * окружения, а в браузер Vite подставляет только те, что начинаются на VITE_.
 *
 * Модель — Yandex AI Studio: нужны YANDEX_API_KEY и YANDEX_FOLDER_ID в .env или
 * в окружении. Без них виджет показывает форму заявки. В проде чат подключает
 * server/main.ts по тем же переменным.
 */
function chatApi(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    name: "webik-chat-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/chat", (req, res, next) => {
        // Обработчик грузится через Vite, чтобы правки подхватывались без
        // перезапуска сервера.
        // Заявки из чата пишутся в ту же базу PGlite, что у админки (server/dev.ts)
        Promise.all([server.ssrLoadModule("/server/chat.ts"), server.ssrLoadModule("/server/dev.ts")])
          .then(async ([chat, dev]) =>
            chat.handleChat(req, res, {
              yandex: chat.yandexFromEnv(env),
              orderSaver: crmOrderSaver(await dev.getDevDb()),
              orderNotifier: notifiersFromEnv(env),
            }),
          )
          .catch(next);
      });
    },
  };
}

/**
 * API админки и заявок на dev-сервере: /api/* (кроме /api/chat) обслуживает
 * server/dev.ts с локальной базой PGlite. В продакшене то же приложение
 * запускает server/main.ts.
 */
function adminApi(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), "");
  const autologin = env.DEV_AUTOLOGIN === "1";

  return {
    name: "webik-admin-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith("/api/") || url.startsWith("/api/chat")) return next();
        server
          .ssrLoadModule("/server/dev.ts")
          .then((mod) => mod.getDevHandler({ autologin, orderNotifier: notifiersFromEnv(env), yandex: yandexFromEnv(env) }))
          .then((handle) => handle(req, res))
          .catch(next);
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), chatApi(mode), adminApi(mode)],
  // Список заменяет значения Vite по умолчанию, поэтому .git и .env перечислены явно.
  // .data — локальная база PGlite и рабочие файлы: dev-сервер их не отдаёт
  server: { fs: { deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/.data/**"] } },
}));
