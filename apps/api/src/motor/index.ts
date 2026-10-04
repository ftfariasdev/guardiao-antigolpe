import { decodificarBRCode, extrairBRCode, type DadosBRCode } from "@guardiao/brcode";
import type { DadosPix, TipoEntrada } from "@guardiao/shared";
import { fundir, validarSaidaLLM, type ResultadoFusao } from "./fusao.js";
import type { ImagemEntrada, ProvedorLLM } from "./llm/provedor.js";
import { mascarar } from "./normalizacao/mascarar.js";
import { normalizar } from "./normalizacao/texto.js";
import { aplicarRegrasPix, CHAVES_DENUNCIADAS_DEMO, instrucaoConferirNome, type InfoCnpj } from "./regras/pix.js";
import { aplicarRegrasTexto } from "./regras/texto.js";
import type { SinalRegra } from "./regras/tipos.js";

export interface EntradaMotor {
  tipo_entrada: TipoEntrada;
  /** Texto da mensagem, do OCR do print ou da transcrição do áudio; pode trazer um Pix copia e cola. */
  texto: string;
  /** Print original, só em memória, para o LLM ver os sinais visuais. */
  imagem?: ImagemEntrada;
}

export interface DependenciasMotor {
  /** null quando não há provedor configurado: o motor responde só com as regras, como parcial. */
  llm: ProvedorLLM | null;
  timeoutLlmMs: number;
  consultarCnpj?: (cnpj: string) => Promise<InfoCnpj | null>;
  chavesDenunciadas?: ReadonlySet<string>;
  agora?: () => Date;
}

export interface ResultadoMotor extends ResultadoFusao {
  pix: DadosPix | null;
  /** Valor pedido: o do Pix ou o primeiro "R$" citado na mensagem. Vai no alerta ao guardião. */
  valor: number | null;
  latencia_ms: number;
  /** Por que o LLM não entrou no resultado; nunca traz conteúdo da mensagem. */
  falha_llm: "sem_provedor" | "tempo_esgotado" | "erro" | "resposta_invalida" | null;
}

const MARCADOR_PIX = "[CÓDIGO PIX]";

function valorCitado(normalizado: string): number | null {
  const m = /r\$ ?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{2}))?/.exec(normalizado);
  if (!m) return null;
  return Number(`${(m[1] as string).replace(/\./g, "")}.${m[2] ?? "00"}`);
}

function separarPix(texto: string): { semCodigo: string; dados: DadosBRCode | null } {
  const codigo = extrairBRCode(texto);
  if (!codigo) return { semCodigo: texto, dados: null };
  const semCodigo = texto.replace(codigo, MARCADOR_PIX);
  try {
    return { semCodigo, dados: decodificarBRCode(codigo) };
  } catch {
    // Parece um Pix, mas não dá para ler: segue como texto, sem os dados.
    return { semCodigo, dados: null };
  }
}

async function chamarLLM(
  llm: ProvedorLLM,
  pedido: Parameters<ProvedorLLM["analisar"]>[0],
  timeoutMs: number,
): Promise<{ bruto: unknown; falha: null } | { bruto: null; falha: "tempo_esgotado" | "erro" }> {
  const controle = new AbortController();
  let relogio: NodeJS.Timeout | undefined;
  const estouro = new Promise<"estouro">((resolver) => {
    relogio = setTimeout(() => {
      controle.abort();
      resolver("estouro");
    }, timeoutMs);
  });
  try {
    const r = await Promise.race([llm.analisar(pedido, controle.signal), estouro]);
    if (r === "estouro") return { bruto: null, falha: "tempo_esgotado" };
    return { bruto: r, falha: null };
  } catch {
    return { bruto: null, falha: controle.signal.aborted ? "tempo_esgotado" : "erro" };
  } finally {
    clearTimeout(relogio);
  }
}

/**
 * Analisa uma mensagem: normaliza, mascara, aplica as regras, consulta o LLM e funde.
 * Nunca lança por falha do LLM: erro, timeout ou resposta inválida viram no mínimo amarelo.
 */
export async function analisar(entrada: EntradaMotor, deps: DependenciasMotor): Promise<ResultadoMotor> {
  const inicio = performance.now();
  const agora = deps.agora?.() ?? new Date();

  const { semCodigo, dados } = separarPix(entrada.texto);
  const mascarado = mascarar(semCodigo);
  const texto = normalizar(mascarado);

  const sinaisRegras: SinalRegra[] = aplicarRegrasTexto(texto);
  let cnpj: InfoCnpj | null = null;
  if (dados) {
    if (dados.tipo_chave === "cnpj" && dados.chave && deps.consultarCnpj) {
      cnpj = await deps.consultarCnpj(dados.chave).catch(() => null);
    }
    // Um código Pix na mensagem conta como pedido de dinheiro.
    if (!sinaisRegras.some((s) => s.codigo === "pedido_dinheiro")) {
      sinaisRegras.unshift({
        codigo: "pedido_dinheiro",
        origem: "regra",
        forca: "gatilho",
        trecho: MARCADOR_PIX,
        explicacao: "A mensagem traz um código Pix para você pagar.",
      });
    }
    sinaisRegras.push(
      ...aplicarRegrasPix({
        dados,
        mensagem: texto.normalizado,
        cnpj,
        agora,
        chavesDenunciadas: deps.chavesDenunciadas ?? CHAVES_DENUNCIADAS_DEMO,
      }),
    );
  }

  let falha_llm: ResultadoMotor["falha_llm"] = "sem_provedor";
  let saidaLLM = null;
  if (deps.llm) {
    const r = await chamarLLM(
      deps.llm,
      { tipo_entrada: entrada.tipo_entrada, texto: mascarado, sinaisRegras, pix: dados, imagem: entrada.imagem },
      deps.timeoutLlmMs,
    );
    falha_llm = r.falha;
    if (r.falha === null) {
      saidaLLM = validarSaidaLLM(r.bruto);
      if (saidaLLM === null) falha_llm = "resposta_invalida";
    }
  }

  const fusao = fundir({
    sinaisRegras,
    saidaLLM,
    texto: mascarado,
    instrucaoPix: dados ? instrucaoConferirNome(texto.normalizado, dados, cnpj) : null,
  });

  const pix: DadosPix | null = dados && {
    chave: dados.chave,
    tipo_chave: dados.tipo_chave,
    nome_declarado: dados.nome_declarado,
    cidade: dados.cidade,
    valor: dados.valor,
    crc_valido: dados.crc_valido,
    cnpj: cnpj && { razao_social: cnpj.razao_social, data_abertura: cnpj.data_abertura, situacao: cnpj.situacao },
  };

  const valor = dados?.valor ?? valorCitado(texto.normalizado);
  return { ...fusao, pix, valor, latencia_ms: Math.round(performance.now() - inicio), falha_llm };
}

export type { ImagemEntrada, ProvedorLLM } from "./llm/provedor.js";
export type { InfoCnpj } from "./regras/pix.js";
