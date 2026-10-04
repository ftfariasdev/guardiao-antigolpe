import { describe, expect, it } from "vitest";
import { maiorRisco, SaidaLLM } from "./index";

describe("maiorRisco", () => {
  it("vale sempre o maior", () => {
    expect(maiorRisco("verde", "amarelo")).toBe("amarelo");
    expect(maiorRisco("vermelho", "verde")).toBe("vermelho");
    expect(maiorRisco("amarelo", "amarelo")).toBe("amarelo");
  });
});

describe("SaidaLLM", () => {
  it("recusa risco fora do sem\u00e1foro", () => {
    const r = SaidaLLM.safeParse({ risco: "azul", tipo_golpe: "outro", titulo: "x", sinais: [], acao: "x", confianca: 0.5 });
    expect(r.success).toBe(false);
  });
});
