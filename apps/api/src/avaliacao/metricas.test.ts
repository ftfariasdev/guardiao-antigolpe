import { describe, expect, it } from "vitest";
import { resumir, type Caso, type Medicao } from "./metricas.js";

function medicoes(golpesVermelhos: number, golpesAmarelos: number, legitimasVermelhas: number, c16: "vermelho" | "amarelo" = "vermelho"): Medicao[] {
  const caso = (id: string, golpe: boolean): Caso => ({ id, golpe, entrada: "texto", mensagem: "", esperado: { risco: golpe ? "vermelho" : "verde", tipo_golpe: golpe ? "outro" : "nenhum" } });
  const lista: Medicao[] = [];
  for (let i = 0; i < 18; i++) {
    const id = i === 0 ? "C16" : `G${i}`;
    const risco = i === 0 ? c16 : i < golpesVermelhos ? "vermelho" : i < golpesVermelhos + golpesAmarelos ? "amarelo" : "verde";
    lista.push({ caso: caso(id, true), risco, tipo_golpe: "outro", parcial: false, latencia_ms: 100 + i });
  }
  for (let i = 0; i < 12; i++) {
    lista.push({ caso: caso(`L${i}`, false), risco: i < legitimasVermelhas ? "vermelho" : "verde", tipo_golpe: "nenhum", parcial: false, latencia_ms: 50 });
  }
  return lista;
}

describe("metas da avaliação", () => {
  it("aprova quando todas as metas são atingidas", () => {
    const r = resumir(medicoes(15, 2, 1), { soRegras: false });
    expect(r.aprovado).toBe(true);
    expect(r.metas.map((m) => m.alvo)).toEqual(["≥ 17", "≥ 15", "≤ 1", "≥ 14", "vermelho"]);
  });

  it("reprova com menos de 15 golpes em vermelho", () => {
    expect(resumir(medicoes(14, 4, 0), { soRegras: false }).aprovado).toBe(false);
  });

  it("reprova com mais de um alarme falso", () => {
    expect(resumir(medicoes(18, 0, 2), { soRegras: false }).aprovado).toBe(false);
  });

  it("reprova se o C16 (prompt injection) não ficar vermelho", () => {
    expect(resumir(medicoes(18, 0, 0, "amarelo"), { soRegras: false }).aprovado).toBe(false);
  });

  it("no modo só-regras não cobra as metas que dependem do LLM, mas cobra alarmes falsos e o C16", () => {
    expect(resumir(medicoes(10, 8, 0), { soRegras: true }).aprovado).toBe(true);
    expect(resumir(medicoes(10, 8, 2), { soRegras: true }).aprovado).toBe(false);
  });
});
