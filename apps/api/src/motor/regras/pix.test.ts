import { decodificarBRCode, gerarBRCode } from "@guardiao/brcode";
import { describe, expect, it } from "vitest";
import { simplificar } from "../normalizacao/texto.js";
import { aplicarRegrasPix, instrucaoConferirNome, type InfoCnpj } from "./pix.js";

const AGORA = new Date("2026-10-04T12:00:00Z");
const pix = (chave: string, nome: string, cidade = "SAO PAULO") => decodificarBRCode(gerarBRCode({ chave, nome, cidade, valor: 100 }));
const empresa = (dias: number, situacao = "ATIVA", municipio?: string): InfoCnpj => ({
  razao_social: "ESCOLA PEQUENO SABER LTDA",
  data_abertura: new Date(AGORA.getTime() - dias * 86_400_000).toISOString().slice(0, 10),
  situacao,
  municipio,
});

function codigos(mensagem: string, dados = pix("11222333000181", "ESCOLA PEQUENO SABER LTDA"), cnpj: InfoCnpj | null = null, denunciadas = new Set<string>()) {
  return aplicarRegrasPix({ dados, mensagem: simplificar(mensagem), cnpj, agora: AGORA, chavesDenunciadas: denunciadas }).map((s) => s.codigo);
}

describe("regras do Pix", () => {
  it("Pix legítimo de empresa antiga, ativa e com nome igual não dispara nada", () => {
    expect(codigos("Segue o Pix da mensalidade da escola", undefined, empresa(4200))).toEqual([]);
  });

  it("pix_crc_invalido: código adulterado", () => {
    const codigo = gerarBRCode({ chave: "11222333000181", nome: "ESCOLA", cidade: "SAO PAULO" });
    const adulterado = codigo.slice(0, -1) + (codigo.endsWith("0") ? "1" : "0");
    expect(codigos("Segue o Pix", decodificarBRCode(adulterado))).toContain("pix_crc_invalido");
    expect(codigos("Segue o Pix", decodificarBRCode(codigo))).not.toContain("pix_crc_invalido");
  });

  it("pix_cnpj_recente: empresa aberta há menos de 90 dias", () => {
    expect(codigos("Pague sua dívida", undefined, empresa(20))).toContain("pix_cnpj_recente");
    expect(codigos("Pague sua dívida", undefined, empresa(90))).not.toContain("pix_cnpj_recente");
  });

  it("pix_cnpj_inativo: situação diferente de ativa", () => {
    expect(codigos("Pague sua dívida", undefined, empresa(4000, "BAIXADA"))).toContain("pix_cnpj_inativo");
    expect(codigos("Pague sua dívida", undefined, empresa(4000, "Ativa"))).not.toContain("pix_cnpj_inativo");
  });

  it("pix_pessoa_cobrando_empresa: mensagem fala de empresa, chave e nome são de pessoa", () => {
    expect(codigos("Quite sua fatura de energia", pix("98765432100", "MARCOS A SILVA"))).toContain("pix_pessoa_cobrando_empresa");
    expect(codigos("Oi, segue meu Pix do bolo", pix("98765432100", "MARCOS A SILVA"))).not.toContain("pix_pessoa_cobrando_empresa");
  });

  it("pix_nome_divergente: a empresa citada não aparece no nome do recebedor", () => {
    expect(codigos("Segue o Pix da sua conta de luz", pix("45123987000150", "RECUPERA FACIL LTDA"))).toContain("pix_nome_divergente");
    expect(codigos("Segue o Pix da sua conta de luz", pix("12345678000199", "ENERGIA DISTRIBUIDORA"))).not.toContain("pix_nome_divergente");
  });

  it("pix_chave_denunciada: chave na lista de denúncias", () => {
    const denunciadas = new Set(["golpe@exemplo.com.br"]);
    expect(codigos("Segue o Pix", pix("golpe@exemplo.com.br", "LOJA BOA LTDA"), null, denunciadas)).toContain("pix_chave_denunciada");
    expect(codigos("Segue o Pix", pix("loja@exemplo.com.br", "LOJA BOA LTDA"), null, denunciadas)).not.toContain("pix_chave_denunciada");
  });

  it("pix_cidade_divergente: cidade do código diferente da cidade da empresa", () => {
    expect(codigos("Segue o Pix", pix("11222333000181", "ESCOLA", "SAO PAULO"), empresa(4000, "ATIVA", "Curitiba"))).toContain("pix_cidade_divergente");
    expect(codigos("Segue o Pix", pix("11222333000181", "ESCOLA", "CURITIBA"), empresa(4000, "ATIVA", "Curitiba"))).not.toContain("pix_cidade_divergente");
  });

  it("a instrução final manda conferir a razão social e nunca manda pagar", () => {
    const frase = instrucaoConferirNome("mensalidade da escola", pix("11222333000181", "ESCOLA"), empresa(4000));
    expect(frase).toContain("ESCOLA PEQUENO SABER LTDA");
    expect(frase).toMatch(/não pague\.$/);
    expect(frase.length).toBeLessThanOrEqual(200);
  });

  it("sem consulta de CNPJ, a instrução usa a empresa citada na mensagem", () => {
    expect(instrucaoConferirNome("conta de luz", pix("98765432100", "MARCOS A SILVA"), null)).toContain("da empresa de energia");
  });
});
