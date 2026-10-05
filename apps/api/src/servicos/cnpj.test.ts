import { describe, expect, it } from "vitest";
import { criarConsultaCnpj } from "./cnpj.js";

const resposta = { razao_social: "ESCOLA PEQUENO SABER LTDA", data_inicio_atividade: "2012-03-01", descricao_situacao_cadastral: "ATIVA", municipio: "CURITIBA", outro_campo: 1 };

describe("consulta de CNPJ (BrasilAPI)", () => {
  it("traduz a resposta e guarda em cache por uma hora", async () => {
    let chamadas = 0;
    let relogio = 0;
    const consultar = criarConsultaCnpj(async (url) => {
      chamadas++;
      expect(url).toBe("https://brasilapi.com.br/api/cnpj/v1/11222333000181");
      return { ok: true, json: async () => resposta };
    }, () => relogio);
    const info = await consultar("11.222.333/0001-81");
    expect(info).toEqual({ razao_social: "ESCOLA PEQUENO SABER LTDA", data_abertura: "2012-03-01", situacao: "ATIVA", municipio: "CURITIBA" });
    await consultar("11222333000181");
    expect(chamadas).toBe(1);
    relogio = 61 * 60 * 1000;
    await consultar("11222333000181");
    expect(chamadas).toBe(2);
  });

  it.each([
    ["API fora do ar", async () => { throw new Error("rede"); }],
    ["CNPJ não encontrado", async () => ({ ok: false, json: async () => ({}) })],
    ["resposta inesperada", async () => ({ ok: true, json: async () => ({ erro: "manutenção" }) })],
  ] as const)("%s → null, sem lançar erro", async (_nome, buscar) => {
    await expect(criarConsultaCnpj(buscar)("11222333000181")).resolves.toBeNull();
  });

  it("não consulta nada que não tenha 14 dígitos", async () => {
    const consultar = criarConsultaCnpj(async () => { throw new Error("não deveria chamar"); });
    await expect(consultar("98765432100")).resolves.toBeNull();
  });
});
