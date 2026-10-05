import type { AlertaNovo, RespostaAlerta } from "@guardiao/shared";

/**
 * Tudo que sai do servidor para os aparelhos: Socket.IO e Web Push.
 * As rotas e o job de escalonamento só conhecem esta interface.
 */
export interface Notificador {
  /** Avisa um guardião de um alerta novo (ou escalado para ele). */
  alertaNovo(guardiaoId: string, dados: AlertaNovo): Promise<void>;
  /** Avisa a família que o guardião respondeu; destrava a tela do protegido. */
  alertaRespondido(familiaId: string, dados: { alerta_id: string; resposta: RespostaAlerta; guardiao: string }): void;
  alertaEscalado(familiaId: string, dados: { alerta_id: string; proximo_guardiao: string }): void;
  /** Entrega um golpe simulado ao protegido, dentro do app. */
  treinoNovo(protegidoId: string, dados: { treino_id: string; conteudo: string }): void;
}

export const notificadorMudo: Notificador = {
  alertaNovo: async () => {},
  alertaRespondido: () => {},
  alertaEscalado: () => {},
  treinoNovo: () => {},
};
