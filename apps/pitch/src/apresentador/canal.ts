import type { EstadoPitch } from "../tempo-real/sessao";

/** Estado que a tela do palco publica para a janela do apresentador. */
export interface EstadoPalco {
  indice: number;
  passo: number;
  pitch: EstadoPitch;
  /** Quando o cronômetro começou (ms desde 1970), ou null se ainda não começou. */
  inicio: number | null;
  leve: boolean;
  preto: boolean;
  avisoDemo: string;
}

export type Comando = "proximo" | "anterior" | "revelar" | "zerar" | "leve" | "preto" | "cronometro";

export type Mensagem = { tipo: "estado"; estado: EstadoPalco } | { tipo: "comando"; comando: Comando } | { tipo: "pedir-estado" };

/** As duas janelas conversam pelo BroadcastChannel do navegador, sem passar pela rede. */
export function abrirCanal(aoReceber: (m: Mensagem) => void): { enviar: (m: Mensagem) => void; fechar: () => void } {
  if (typeof BroadcastChannel === "undefined") return { enviar: () => {}, fechar: () => {} };
  const canal = new BroadcastChannel("guardiao-pitch");
  canal.onmessage = (e: MessageEvent<Mensagem>) => aoReceber(e.data);
  return { enviar: (m) => canal.postMessage(m), fechar: () => canal.close() };
}
