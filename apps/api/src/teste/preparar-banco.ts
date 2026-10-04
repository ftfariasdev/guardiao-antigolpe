import { execFileSync } from "node:child_process";

export const URL_BANCO_TESTE = process.env.DATABASE_URL_TESTE ?? "postgresql://guardiao:guardiao@localhost:5433/guardiao_teste";

/** Aplica as migrações no banco de teste antes de todos os testes (cria o banco se não existir). */
export default function prepararBanco() {
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: URL_BANCO_TESTE }, stdio: "pipe" });
}
