import { ResultadoAnalise } from "@guardiao/shared";
import { describe, expect, it } from "vitest";
import { criarApp } from "./app.js";
import { lerConfig } from "./config.js";

const motor = { llm: null, timeoutLlmMs: 50 };
const config = lerConfig({ NODE_ENV: "test", DATABASE_URL: "postgresql://x:y@localhost:5432/z" });

describe("GET /api/v1/saude", () => {
  it("responde 200 quando o banco está de pé", async () => {
    const app = await criarApp({ config, motor, verificarBanco: async () => true });
    const r = await app.inject({ method: "GET", url: "/api/v1/saude" });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ ok: true, banco: "ok" });
  });

  it("responde 503 quando o banco não responde", async () => {
    const app = await criarApp({ config, motor, verificarBanco: async () => { throw new Error("fora"); } });
    const r = await app.inject({ method: "GET", url: "/api/v1/saude" });
    expect(r.statusCode).toBe(503);
    expect(r.json()).toMatchObject({ ok: false, banco: "erro" });
  });
});

describe("lerConfig", () => {
  it("falha sem DATABASE_URL", () => {
    expect(() => lerConfig({})).toThrow(/DATABASE_URL/);
  });
});

describe("POST /api/v1/analises", () => {
  const criar = () => criarApp({ config, motor, verificarBanco: async () => true });
  const enviar = async (payload: unknown) => (await criar()).inject({ method: "POST", url: "/api/v1/analises", payload: payload as object });

  it("devolve o resultado no contrato ResultadoAnalise", async () => {
    const r = await enviar({ tipo_entrada: "texto", texto: "Oi mãe, mudei de número. Faz um Pix de 900 pra mim hoje?" });
    expect(r.statusCode).toBe(200);
    const corpo = ResultadoAnalise.parse(r.json());
    expect(corpo).toMatchObject({ risco: "vermelho", tipo_golpe: "falso_parente", parcial: true, alerta: null });
  });

  it("sem LLM, mensagem inofensiva sai amarela, nunca verde", async () => {
    const r = await enviar({ texto: "Lembrete: sua consulta é amanhã às 9h." });
    expect(r.json()).toMatchObject({ risco: "amarelo", parcial: true });
  });

  it("recusa corpo sem texto com o formato de erro da API", async () => {
    const r = await enviar({ texto: "   " });
    expect(r.statusCode).toBe(400);
    expect(r.json()).toMatchObject({ erro: { codigo: "requisicao_invalida" } });
  });

  it("limita a 10 análises por minuto", async () => {
    const app = await criar();
    const status: number[] = [];
    for (let i = 0; i < 11; i++) {
      status.push((await app.inject({ method: "POST", url: "/api/v1/analises", payload: { texto: "oi" } })).statusCode);
    }
    expect(status.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(status[10]).toBe(429);
  });
});
