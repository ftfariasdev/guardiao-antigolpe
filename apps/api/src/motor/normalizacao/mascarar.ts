/**
 * Mascaramento de dados pessoais. Roda antes das regras e do LLM, então nem os sinais
 * guardados no banco nem o provedor de IA recebem CPF, cartão, telefone ou e-mail.
 */

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const CARTAO = /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g;
const CPF = /(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g;
const TELEFONE = /(?<!\d)(?:\+?55[ -]?)?\(?\d{2}\)?[ -]?9?\d{4}[ -]?\d{4}(?!\d)/g;

function passaNoLuhn(digitos: string): boolean {
  let soma = 0;
  let dobrar = false;
  for (let i = digitos.length - 1; i >= 0; i--) {
    let n = Number(digitos[i]);
    if (dobrar) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    soma += n;
    dobrar = !dobrar;
  }
  return soma % 10 === 0;
}

export function mascarar(texto: string): string {
  return texto
    .replace(EMAIL, "[EMAIL]")
    .replace(CARTAO, (achado) => (passaNoLuhn(achado.replace(/\D/g, "")) ? "[CARTAO]" : achado))
    .replace(CPF, "[CPF]")
    .replace(TELEFONE, "[TELEFONE]");
}
