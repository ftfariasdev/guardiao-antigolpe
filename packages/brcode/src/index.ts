/**
 * Parser do BR Code do Pix (padrão EMV QRCPS-MPM) usado no Pix copia e cola e no QR Code.
 *
 * Atenção: o nome dentro do BR Code é escrito por quem gerou o código e pode ser falso.
 * O nome verdadeiro do dono da chave só aparece no app do banco, na confirmação.
 */

export type TipoChave = "cpf" | "cnpj" | "telefone" | "email" | "aleatoria" | "desconhecida";

export interface DadosBRCode {
  chave: string | null;
  tipo_chave: TipoChave;
  nome_declarado: string | null;
  cidade: string | null;
  valor: number | null;
  txid: string | null;
  /** URL do Pix dinâmico (campo 25), quando existir. */
  url: string | null;
  dinamico: boolean;
  crc_valido: boolean;
}

export class ErroBRCode extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroBRCode";
  }
}

const GUI_PIX = "br.gov.bcb.pix";

/** CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF), como exige o padrão do Pix. */
export function crc16(texto: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(texto)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Lê uma sequência de campos ID (2) + tamanho (2) + valor. */
export function lerCampos(texto: string): Map<string, string> {
  const campos = new Map<string, string>();
  let i = 0;
  while (i < texto.length) {
    const id = texto.slice(i, i + 2);
    const tamanho = Number(texto.slice(i + 2, i + 4));
    if (id.length < 2 || !/^\d{2}$/.test(texto.slice(i + 2, i + 4)) || Number.isNaN(tamanho)) {
      throw new ErroBRCode(`Campo malformado na posição ${i}`);
    }
    const valor = texto.slice(i + 4, i + 4 + tamanho);
    if (valor.length !== tamanho) {
      throw new ErroBRCode(`Campo ${id} termina antes do tamanho informado`);
    }
    campos.set(id, valor);
    i += 4 + tamanho;
  }
  return campos;
}

export function tipoDaChave(chave: string | null): TipoChave {
  if (!chave) return "desconhecida";
  if (chave.includes("@")) return "email";
  if (/^\+55\d{10,11}$/.test(chave)) return "telefone";
  if (/^\d{14}$/.test(chave)) return "cnpj";
  if (/^\d{11}$/.test(chave)) return "cpf";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chave)) return "aleatoria";
  return "desconhecida";
}

/** Decodifica um Pix copia e cola. Lança ErroBRCode se a estrutura estiver quebrada. */
export function decodificarBRCode(entrada: string): DadosBRCode {
  const payload = entrada.trim();
  if (!payload.startsWith("000201")) {
    throw new ErroBRCode("Não parece um Pix copia e cola (deve começar com 000201)");
  }
  const campos = lerCampos(payload);

  const crcInformado = campos.get("63");
  const crc_valido =
    !!crcInformado && payload.endsWith(crcInformado) && crc16(payload.slice(0, -4)) === crcInformado.toUpperCase();

  let chave: string | null = null;
  let url: string | null = null;
  for (let id = 26; id <= 51; id++) {
    const conta = campos.get(String(id));
    if (!conta) continue;
    const sub = lerCampos(conta);
    if (sub.get("00")?.toLowerCase() !== GUI_PIX) continue;
    chave = sub.get("01") ?? null;
    url = sub.get("25") ?? null;
    break;
  }

  const adicionais = campos.get("62");
  const txidBruto = adicionais ? lerCampos(adicionais).get("05") ?? null : null;
  const valorTexto = campos.get("54");

  return {
    chave,
    tipo_chave: tipoDaChave(chave),
    nome_declarado: campos.get("59") ?? null,
    cidade: campos.get("60") ?? null,
    valor: valorTexto ? Number(valorTexto) : null,
    txid: txidBruto && txidBruto !== "***" ? txidBruto : null,
    url,
    dinamico: url !== null,
    crc_valido,
  };
}

/** Procura um Pix copia e cola dentro de um texto qualquer (mensagem, OCR, transcrição). */
export function extrairBRCode(texto: string): string | null {
  // O código vem numa linha só; nomes e cidades dentro dele podem ter espaços.
  for (const linha of texto.split(/\r?\n/)) {
    const inicio = linha.indexOf("000201");
    if (inicio < 0) continue;
    const resto = linha.slice(inicio);
    const finais = [...resto.matchAll(/6304[0-9A-Fa-f]{4}/g)].map((m) => (m.index ?? 0) + 8);
    if (finais.length === 0) continue;
    // Prefere o trecho cujo CRC confere; se nenhum conferir, fica com o mais longo.
    const valido = finais.find((fim) => crc16(resto.slice(0, fim - 4)) === resto.slice(fim - 4, fim).toUpperCase());
    return resto.slice(0, valido ?? finais[finais.length - 1]);
  }
  return null;
}

function campo(id: string, valor: string): string {
  return id + String(valor.length).padStart(2, "0") + valor;
}

/** Gera um Pix copia e cola estático. Usado em testes e nos dados de demonstração. */
export function gerarBRCode(dados: {
  chave: string;
  nome: string;
  cidade: string;
  valor?: number;
  txid?: string;
}): string {
  const conta = campo("00", GUI_PIX) + campo("01", dados.chave);
  const corpo =
    campo("00", "01") +
    campo("26", conta) +
    campo("52", "0000") +
    campo("53", "986") +
    (dados.valor !== undefined ? campo("54", dados.valor.toFixed(2)) : "") +
    campo("58", "BR") +
    campo("59", dados.nome.slice(0, 25)) +
    campo("60", dados.cidade.slice(0, 15)) +
    campo("62", campo("05", dados.txid ?? "***")) +
    "6304";
  return corpo + crc16(corpo);
}
