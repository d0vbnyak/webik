import { defineConfig } from "vitest/config";

// Тесты — только на чистую логику (lib/*.test.ts). DOM не нужен → node-окружение.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
