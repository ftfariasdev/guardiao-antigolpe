import type { ContextoLLM } from "./prompt.js";

export interface ImagemEntrada {
  media_type: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  /** Conteúdo em base64, mantido só em memória. */
  base64: string;
}

export interface PedidoLLM extends ContextoLLM {
  imagem?: ImagemEntrada;
}

/**
 * Interface própria na frente do SDK, para o motor poder trocar de provedor.
 * Devolve a entrada bruta da ferramenta registrar_analise; quem valida é o motor.
 * Qualquer falha (rede, timeout, recusa, resposta sem a ferramenta) vira exceção.
 */
export interface ProvedorLLM {
  analisar(pedido: PedidoLLM, sinal: AbortSignal): Promise<unknown>;
}
