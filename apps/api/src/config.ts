import { z } from "zod";

const booleano = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const Esquema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().default(""),
  WHISPER_API_KEY: z.string().default(""),
  VAPID_PUBLIC_KEY: z.string().default(""),
  VAPID_PRIVATE_KEY: z.string().default(""),
  VAPID_SUBJECT: z.string().default("mailto:contato@exemplo.com.br"),
  ADMIN_TOKEN: z.string().default(""),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
  DEMO_MODE: booleano,
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  ESCALONAMENTO_MIN: z.coerce.number().int().positive().default(5),
});

export type Config = z.infer<typeof Esquema>;

export function lerConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const r = Esquema.safeParse(env);
  if (!r.success) {
    const faltando = r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuração inválida:\n${faltando}`);
  }
  return r.data;
}
