import { DEMO_MENSAGEM_FALSO_PARENTE, DEMO_PIX_LOJA } from "@guardiao/shared";
import { describe, expect, it } from "vitest";
import { mandaPagar } from "../motor/fusao.js";
import { analisar, type DependenciasMotor } from "../motor/index.js";
import { cnpjComCacheDeDemo, llmComCacheDeDemo } from "./cache.js";

/** Como no palco sem internet: nenhum provedor de IA e a consulta de CNPJ fora do ar. */
const semRede: DependenciasMotor = {
  llm: llmComCacheDeDemo(null),
  timeoutLlmMs: 50,
  consultarCnpj: cnpjComCacheDeDemo(async () => { throw new Error("sem internet"); }),
  agora: () => new Date("2026-10-05"),
};

describe("DEMO_MODE: roteiro do palco sem internet", () => {
  it("passo 3: a mensagem de falso parente sai vermelha, completa e com a palavra-senha", async () => {
    const r = await analisar({ tipo_entrada: "texto", texto: DEMO_MENSAGEM_FALSO_PARENTE }, semRede);
    expect(r).toMatchObject({ risco: "vermelho", tipo_golpe: "falso_parente", parcial: false, sugerir_palavra_senha: true, valor: 1800 });
    expect(r.acao).toMatch(/^Não pague/);
    expect(r.sinais.map((s) => s.codigo)).toEqual(expect.arrayContaining(["troca_numero", "urgencia_dinheiro", "promessa_de_devolver"]));
  });

  it("passo 6: o Pix da loja sai amarelo, com a empresa conferida e o nome a conferir no banco", async () => {
    const r = await analisar({ tipo_entrada: "pix", texto: DEMO_PIX_LOJA }, semRede);
    expect(r).toMatchObject({ risco: "amarelo", parcial: false, valor: 1249 });
    expect(r.pix).toMatchObject({ nome_declarado: "BELA CASA MOVEIS LTDA", cidade: "MANAUS", crc_valido: true, cnpj: { situacao: "ATIVA" } });
    expect(r.acao).toContain("confira se aparece o nome BELA CASA MOVEIS LTDA");
    expect(mandaPagar(r.acao)).toBe(false);
    expect(r.sinais.map((s) => s.codigo)).toEqual(expect.arrayContaining(["desconto_hoje", "cidade_diferente"]));
  });

  it("fora do roteiro o fail-safe continua valendo: sem provedor, nunca verde", async () => {
    const r = await analisar({ tipo_entrada: "texto", texto: "Lembrete: sua consulta é amanhã às 9h." }, semRede);
    expect(r).toMatchObject({ risco: "amarelo", parcial: true });
  });
});
