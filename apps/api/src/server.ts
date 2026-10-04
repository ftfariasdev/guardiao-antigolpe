import { PrismaClient } from "@prisma/client";
import { lerConfig } from "./config.js";
import { criarApp } from "./app.js";
import { criarProvedorAnthropic } from "./motor/llm/anthropic.js";

const config = lerConfig();
const prisma = new PrismaClient();

// Sem chave, o motor responde só com as regras e toda análise sai como parcial (nunca verde).
const llm = config.ANTHROPIC_API_KEY
  ? criarProvedorAnthropic({ apiKey: config.ANTHROPIC_API_KEY, modelo: config.LLM_MODEL, timeoutMs: config.LLM_TIMEOUT_MS })
  : null;

const app = await criarApp({
  config,
  motor: { llm, timeoutLlmMs: config.LLM_TIMEOUT_MS },
  verificarBanco: async () => {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  },
});

await app.listen({ port: config.PORT, host: "0.0.0.0" });

for (const sinal of ["SIGINT", "SIGTERM"] as const) {
  process.on(sinal, async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}
