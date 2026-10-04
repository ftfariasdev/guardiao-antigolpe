import { PrismaClient } from "@prisma/client";
import { lerConfig } from "./config.js";
import { criarApp } from "./app.js";

const config = lerConfig();
const prisma = new PrismaClient();

const app = await criarApp({
  config,
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
