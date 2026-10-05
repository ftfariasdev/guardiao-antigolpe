import { DEMO_CNPJ_LOJA, DEMO_MENSAGEM_FALSO_PARENTE, DEMO_PIX_LOJA_TEXTO, type SaidaLLM } from "@guardiao/shared";
import type { InfoCnpj, ProvedorLLM } from "../motor/index.js";
import { simplificar } from "../motor/normalizacao/texto.js";

/**
 * DEMO_MODE: as entradas do roteiro do palco pulam o LLM e a consulta de CNPJ e recebem
 * um resultado pronto. Assim a demo não depende da internet do evento nem do provedor de IA.
 * Qualquer outra mensagem segue o caminho normal.
 */
const RESPOSTAS: { texto: string; saida: SaidaLLM }[] = [
  {
    texto: DEMO_MENSAGEM_FALSO_PARENTE,
    saida: {
      risco: "vermelho",
      tipo_golpe: "falso_parente",
      titulo: "Isso parece o golpe do falso parente",
      sinais: [{ codigo: "promessa_de_devolver", trecho: "Te devolvo amanhã", explicacao: "Prometer devolver logo serve para você não pensar duas vezes." }],
      acao: "Não pague. Ligue para o número antigo da sua filha ou pergunte a palavra-senha da família.",
      confianca: 0.96,
    },
  },
  {
    texto: DEMO_PIX_LOJA_TEXTO,
    saida: {
      risco: "amarelo",
      tipo_golpe: "compra_falsa",
      titulo: "O Pix parece ser da loja, mas vale conferir",
      sinais: [{ codigo: "cidade_diferente", trecho: "Bela Casa Móveis de Curitiba", explicacao: "A mensagem diz que a loja é de Curitiba, mas o Pix é de Manaus." }],
      acao: "Confira o nome no app do banco antes de qualquer coisa.",
      confianca: 0.7,
    },
  },
];

/** Compara pelo texto simplificado, com o código Pix já trocado pelo marcador. */
function respostaDoRoteiro(texto: string): SaidaLLM | null {
  const recebido = simplificar(texto);
  return RESPOSTAS.find((r) => recebido.includes(simplificar(r.texto)))?.saida ?? null;
}

export function llmComCacheDeDemo(real: ProvedorLLM | null): ProvedorLLM {
  return {
    async analisar(pedido, sinal) {
      const pronta = respostaDoRoteiro(pedido.texto);
      if (pronta) return pronta;
      if (!real) throw new Error("sem_provedor");
      return real.analisar(pedido, sinal);
    },
  };
}

export function cnpjComCacheDeDemo(real: (cnpj: string) => Promise<InfoCnpj | null>) {
  return async (cnpj: string): Promise<InfoCnpj | null> => {
    if (cnpj.replace(/\D/g, "") === DEMO_CNPJ_LOJA.cnpj) {
      const { razao_social, data_abertura, situacao, municipio } = DEMO_CNPJ_LOJA;
      return { razao_social, data_abertura, situacao, municipio };
    }
    return real(cnpj);
  };
}
