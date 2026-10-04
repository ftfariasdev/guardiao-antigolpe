/** Regra link_suspeito: encurtador, IP no lugar do domínio ou domínio que imita uma marca. */

const ENDERECO = /\b(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,}|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?(\/[^\s]*)?/g;

const ENCURTADORES = new Set([
  "bit.ly", "tinyurl.com", "cutt.ly", "is.gd", "t.co", "goo.gl", "ow.ly", "rb.gy", "shre.ink",
  "encurtador.com.br", "abre.ai", "l1nk.dev", "tiny.cc", "t.ly", "encr.pw", "s.id",
]);

const TLDS_BARATOS = new Set(["online", "site", "xyz", "top", "click", "shop", "live", "store", "icu", "vip", "buzz", "cfd", "sbs", "info", "link", "app"]);

/** Marca citada no domínio → domínios oficiais. Fora deles, o domínio está imitando a marca. */
const MARCAS: Record<string, string[]> = {
  correios: ["correios.com.br"],
  inss: ["gov.br"],
  gov: ["gov.br"],
  receita: ["gov.br"],
  detran: ["gov.br"],
  caixa: ["caixa.gov.br"],
  bradesco: ["bradesco.com.br", "bradesco"],
  itau: ["itau.com.br", "itau"],
  santander: ["santander.com.br"],
  nubank: ["nubank.com.br", "nu.com.br"],
  bancodobrasil: ["bb.com.br"],
  serasa: ["serasa.com.br", "serasaexperian.com.br"],
  mercadolivre: ["mercadolivre.com.br", "mercadolibre.com"],
  mercadopago: ["mercadopago.com.br"],
  magalu: ["magazineluiza.com.br", "magalu.com"],
  netflix: ["netflix.com"],
  whatsapp: ["whatsapp.com"],
  pix: ["bcb.gov.br"],
};

const EXTENSOES_DE_ARQUIVO = new Set(["pdf", "jpg", "jpeg", "png", "doc", "docx", "txt", "mp3", "ogg"]);

function pertence(dominio: string, oficial: string): boolean {
  return dominio === oficial || dominio.endsWith(`.${oficial}`);
}

function suspeito(dominio: string): boolean {
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(dominio)) return true;
  if ([...ENCURTADORES].some((e) => pertence(dominio, e))) return true;
  const partes = dominio.split(".");
  const tld = partes[partes.length - 1] as string;
  const semPontuacao = dominio.replace(/[.-]/g, "");
  for (const [marca, oficiais] of Object.entries(MARCAS)) {
    const citaMarca = marca.length <= 4 ? partes.some((p) => p.split("-").includes(marca)) : semPontuacao.includes(marca);
    if (citaMarca && !oficiais.some((o) => pertence(dominio, o))) return true;
  }
  return TLDS_BARATOS.has(tld) && dominio.includes("-");
}

export function linkSuspeito(normalizado: string): { inicio: number; fim: number } | null {
  for (const m of normalizado.matchAll(ENDERECO)) {
    const dominio = (m[1] as string).replace(/^www\./, "");
    const tld = dominio.slice(dominio.lastIndexOf(".") + 1);
    if (EXTENSOES_DE_ARQUIVO.has(tld)) continue;
    if (suspeito(dominio)) {
      const fim = m.index + m[0].replace(/[.,;:!?)]+$/, "").length;
      return { inicio: m.index, fim };
    }
  }
  return null;
}
