import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: "./src/teste/preparar-banco.ts",
    // Os testes de integração dividem o mesmo banco.
    fileParallelism: false,
  },
});
