import { defineConfig } from "vitest/config";

// Тесты: чистая логика (lib/*.test.ts, shared/*.test.ts) и API на PGlite (server/**/*.test.ts).
// DOM не нужен → node-окружение.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "shared/**/*.test.ts", "server/**/*.test.ts"],
  },
});
