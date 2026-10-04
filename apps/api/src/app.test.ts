import { describe, expect, it } from "vitest";
import { criarApp } from "./app.js";
import { lerConfig } from "./config.js";

const config = lerConfig({ NODE_ENV: "test", DATABASE_URL: "postgresql://x:y@localhost:5432/z" });

describe("GET /api/v1/saude", () => {
  it("responde 200 quando o banco está de pé", async () => {
    const app = await criarApp({ config, verificarBanco: async () => true });
    const r = await app.inject({ method: "GET", url: "/api/v1/saude" });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ ok: true, banco: "ok" });
  });

  it("responde 503 quando o banco não responde", async () => {
    const app = await criarApp({ config, verificarBanco: async () => { throw new Error("fora"); } });
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
