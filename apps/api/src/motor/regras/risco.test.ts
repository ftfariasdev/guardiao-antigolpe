import { describe, expect, it } from "vitest";
import { riscoDasRegras, tipoPelasRegras } from "./risco.js";
import type { Forca, SinalRegra } from "./tipos.js";

const s = (codigo: string, forca: Forca): SinalRegra => ({ codigo, forca, origem: "regra", trecho: "x", explicacao: "x" });
const gatilho = s("pedido_dinheiro", "gatilho");
const forte = (codigo = "troca_numero") => s(codigo, "forte");
const fraco = (codigo: string) => s(codigo, "fraco");

describe("risco das regras", () => {
  it.each([
    ["gatilho + 1 forte", [gatilho, forte()], "vermelho"],
    ["2 fortes", [forte(), forte("sigilo")], "vermelho"],
    ["conta_segura sozinho", [forte("conta_segura")], "vermelho"],
    ["portador_cartao sozinho", [forte("portador_cartao")], "vermelho"],
    ["pix_chave_denunciada sozinho", [forte("pix_chave_denunciada")], "vermelho"],
    ["1 forte sem gatilho", [forte()], "amarelo"],
    ["gatilho + 2 fracos", [gatilho, fraco("premio"), fraco("ameaca")], "amarelo"],
    ["3 fracos", [fraco("premio"), fraco("ameaca"), fraco("apelo_emocional")], "amarelo"],
    ["gatilho sozinho", [gatilho], "verde"],
    ["gatilho + 1 fraco", [gatilho, fraco("parente_generico")], "verde"],
    ["2 fracos", [fraco("premio"), fraco("ameaca")], "verde"],
    ["nada", [], "verde"],
  ] as const)("%s → %s", (_nome, sinais, esperado) => {
    expect(riscoDasRegras([...sinais])).toBe(esperado);
  });
});

describe("tipo pelas regras (quando o LLM não respondeu)", () => {
  it.each([
    ["troca_numero", "falso_parente"],
    ["falsa_central", "falsa_central"],
    ["conta_segura", "falsa_central"],
    ["portador_cartao", "falso_motoboy"],
    ["taxa_liberacao", "falso_emprego"],
    ["ganho_irreal", "falso_investimento"],
    ["link_suspeito", "link_falso"],
    ["pix_crc_invalido", "falso_boleto"],
    ["sigilo", "outro"],
  ] as const)("%s indica %s", (codigo, tipo) => {
    expect(tipoPelasRegras([gatilho, forte(codigo)])).toBe(tipo);
  });

  it("sem risco pelas regras não nomeia golpe", () => {
    expect(tipoPelasRegras([fraco("parente_generico")])).toBe("nenhum");
    expect(tipoPelasRegras([])).toBe("nenhum");
  });
});
