import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Эндпоинт чата на dev-сервере.
 *
 * Ключ модели читается здесь, на сервере, и во фронтенд не попадает:
 * loadEnv с пустым префиксом отдаёт все переменные из .env, а в браузер Vite
 * подставляет только те, что начинаются на VITE_.
 *
 * Работает только в `npm run dev`. Собранный `npm run build` — статика, у неё
 * сервера нет: для продакшена тот же обработчик переносится в Supabase Edge
 * Function, а фронтенд зовёт её адрес вместо /api/chat.
 */
function chatApi(mode: string): Plugin {
  const apiKey = loadEnv(mode, process.cwd(), "").ANTHROPIC_API_KEY;

  return {
    name: "webik-chat-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/chat", (req, res, next) => {
        // Обработчик грузится через Vite, чтобы правки подхватывались без
        // перезапуска сервера.
        server
          .ssrLoadModule("/server/chat.ts")
          .then((mod) => mod.handleChat(req, res, apiKey))
          .catch(next);
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), chatApi(mode)],
}));
