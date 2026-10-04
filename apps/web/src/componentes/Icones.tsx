import { simbolo } from "@guardiao/brand";
import type { ReactNode } from "react";

/** Ícones de traço, sempre decorativos: o texto ao lado (ou o aria-label do botão) é que informa. */
function Traco({ tamanho = 26, grosso = 2, children }: { tamanho?: number; grosso?: number; children: ReactNode }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grosso} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

type Props = { tamanho?: number };

export const IconeColar = (p: Props) => <Traco {...p}><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></Traco>;
export const IconeAcessibilidade = (p: Props) => <Traco {...p}><circle cx="12" cy="4.5" r="1.8" /><path d="M5 8.5l7 1.5 7-1.5M12 10v4.5M12 14.5 9 21M12 14.5l3 6.5" /></Traco>;
export const IconeSom = (p: Props) => <Traco {...p}><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></Traco>;
export const IconeVoltar = (p: Props) => <Traco grosso={2.5} {...p}><path d="m15 18-6-6 6-6" /></Traco>;
export const IconeCompartilhar = (p: Props) => <Traco {...p}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></Traco>;
export const IconeChave = (p: Props) => <Traco {...p}><circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 9.3-9.3M17 6l3 3M14 9l2 2" /></Traco>;
export const IconeCheck = (p: Props) => <Traco grosso={3} {...p}><path d="M20 6 9 17l-5-5" /></Traco>;
export const IconeAlerta = (p: Props) => <Traco grosso={3} {...p}><path d="M12 6v8M12 18.5v.01" /></Traco>;
export const IconeX = (p: Props) => <Traco grosso={3} {...p}><path d="M18 6 6 18M6 6l12 12" /></Traco>;

/** Símbolo da marca. Com `pensando`, os pontos pulsam em sequência durante a análise. */
export function Escudo({ largura = 30, pensando = false }: { largura?: number; pensando?: boolean }) {
  return (
    <svg className={pensando ? "escudo escudo--pensando" : "escudo"} width={largura} height={(largura * 102) / 84} viewBox={simbolo.viewBox} aria-hidden="true" focusable="false">
      <path className="escudo__corpo" d={simbolo.escudo} />
      {simbolo.pontos.map((p, i) => (
        <circle key={p.cx} className={`escudo__ponto escudo__ponto--${i + 1}`} cx={p.cx} cy={p.cy} r={p.r} />
      ))}
    </svg>
  );
}
