import { describe, expect, it } from "vitest";
import { crc16, decodificarBRCode, ErroBRCode, extrairBRCode, gerarBRCode, tipoDaChave } from "../src/index";

describe("crc16", () => {
  it("bate com o vetor de teste do CRC-16/CCITT-FALSE", () => {
    expect(crc16("123456789")).toBe("29B1");
  });
});

describe("decodificarBRCode", () => {
  const pix = gerarBRCode({
    chave: "12345678000199",
    nome: "BELA CASA MOVEIS LTDA",
    cidade: "MANAUS",
    valor: 1249,
    txid: "PEDIDO123",
  });

  it("lê chave, nome, cidade, valor e txid", () => {
    expect(decodificarBRCode(pix)).toEqual({
      chave: "12345678000199",
      tipo_chave: "cnpj",
      nome_declarado: "BELA CASA MOVEIS LTDA",
      cidade: "MANAUS",
      valor: 1249,
      txid: "PEDIDO123",
      url: null,
      dinamico: false,
      crc_valido: true,
    });
  });

  it("acusa CRC inválido quando um caractere é adulterado", () => {
    const adulterado = pix.replace("MANAUS", "MANAUZ");
    expect(decodificarBRCode(adulterado).crc_valido).toBe(false);
  });

  it("aceita espaços nas pontas", () => {
    expect(decodificarBRCode(`  ${pix}\n`).crc_valido).toBe(true);
  });

  it("recusa texto que não é Pix", () => {
    expect(() => decodificarBRCode("oi mãe, mudei de número")).toThrow(ErroBRCode);
  });

  it("recusa estrutura quebrada", () => {
    expect(() => decodificarBRCode("000201269")).toThrow(ErroBRCode);
  });

  it("trata txid *** como ausente", () => {
    const semTxid = gerarBRCode({ chave: "+5511999998888", nome: "MARIA S", cidade: "SAO PAULO" });
    const dados = decodificarBRCode(semTxid);
    expect(dados.txid).toBeNull();
    expect(dados.valor).toBeNull();
    expect(dados.tipo_chave).toBe("telefone");
  });
});

describe("tipoDaChave", () => {
  it.each([
    ["12345678901", "cpf"],
    ["12345678000199", "cnpj"],
    ["+5511987654321", "telefone"],
    ["loja@exemplo.com.br", "email"],
    ["123e4567-e89b-12d3-a456-426614174000", "aleatoria"],
    ["xyz", "desconhecida"],
  ] as const)("%s é %s", (chave, tipo) => {
    expect(tipoDaChave(chave)).toBe(tipo);
  });
});

describe("extrairBRCode", () => {
  it("encontra o Pix no meio de uma mensagem", () => {
    const pix = gerarBRCode({ chave: "12345678901", nome: "JOAO P", cidade: "CURITIBA", valor: 287.4 });
    const mensagem = `Segue o Pix da sua conta de luz com desconto:\n${pix}\nPague hoje!`;
    expect(extrairBRCode(mensagem)).toBe(pix);
  });

  it("devolve null quando não há Pix", () => {
    expect(extrairBRCode("nenhum código aqui")).toBeNull();
  });
});
