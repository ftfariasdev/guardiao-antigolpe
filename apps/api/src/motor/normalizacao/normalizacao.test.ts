import { describe, expect, it } from "vitest";
import { mascarar } from "./mascarar.js";
import { normalizar, trechoOriginal } from "./texto.js";

describe("normalizar", () => {
  it("tira acentos, põe em minúsculas e junta espaços", () => {
    expect(normalizar("Mãe,  MUDEI de\nnúmero").normalizado).toBe("mae, mudei de numero");
  });

  it("devolve o trecho como a pessoa escreveu", () => {
    const t = normalizar("Oi MÃE, mudei de número!");
    const i = t.normalizado.indexOf("mudei de numero");
    expect(trechoOriginal(t, i, i + "mudei de numero".length)).toBe("mudei de número");
  });
});

describe("mascarar", () => {
  it("troca CPF, telefone, e-mail e cartão válido por marcadores", () => {
    const saida = mascarar("CPF 123.456.789-09, tel (11) 98765-4321, ana@exemplo.com.br, cartão 4111 1111 1111 1111");
    expect(saida).toBe("CPF [CPF], tel [TELEFONE], [EMAIL], cartão [CARTAO]");
  });

  it("não mexe em valores, códigos curtos nem sequências que não passam no Luhn", () => {
    const texto = "Pix de R$ 1.800 até as 15h, código 482913, pedido 1234 5678 9012 3456";
    expect(mascarar(texto)).toBe(texto);
  });
});
