import { simbolo } from "@guardiao/brand";
import QRCode from "qrcode";
import { useEffect, useState, type ReactNode } from "react";

const semMovimento = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Número grande com contagem crescente de até 1,2 s; com movimento reduzido já aparece pronto. */
export function NumeroGrande({ valor, formatar = (n) => Math.round(n).toLocaleString("pt-BR"), className = "" }: { valor: number; formatar?: (n: number) => string; className?: string }) {
  const [mostrado, setMostrado] = useState(() => (semMovimento() ? valor : 0));
  useEffect(() => {
    if (semMovimento()) return setMostrado(valor);
    const de = mostrado;
    const inicio = performance.now();
    let quadro = 0;
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / 1200);
      setMostrado(de + (valor - de) * (1 - (1 - t) ** 3));
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
    // A contagem recomeça do número que está na tela sempre que o valor muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);
  return <span className={`numero ${className}`}>{formatar(mostrado)}</span>;
}

/** Escudo da marca em 2D. As cenas 3D do D7 usam a mesma geometria. */
export function Escudo({ largura = 120, pulsando = false }: { largura?: number; pulsando?: boolean }) {
  return (
    <svg className={pulsando ? "escudo escudo--pulsando" : "escudo"} width={largura} height={(largura * 102) / 84} viewBox={simbolo.viewBox} aria-hidden="true">
      <path d={simbolo.escudo} fill="var(--azul)" />
      {simbolo.pontos.map((p, i) => (
        <circle key={p.cx} className={`escudo__ponto escudo__ponto--${i + 1}`} cx={p.cx} cy={p.cy} r={p.r} fill={i === 2 ? "var(--ciano)" : "#FFFFFF"} />
      ))}
    </svg>
  );
}

export function Marca() {
  return (
    <p className="marca"><Escudo largura={34} /><span>Guardião <span className="acento fino">Antigolpe</span></span></p>
  );
}

export function Qr({ url, rotulo }: { url: string; rotulo: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let vivo = true;
    void QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }).then((s) => vivo && setSvg(s));
    return () => {
      vivo = false;
    };
  }, [url]);
  return <div className="qr" role="img" aria-label={rotulo} dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** Moldura de celular com o app de verdade rodando dentro, em tamanho de celular. */
export function MolduraCelular({ titulo, url, tremendo = false, children }: { titulo: string; url: string | null; tremendo?: boolean; children?: ReactNode }) {
  return (
    <figure className={tremendo ? "moldura moldura--tremendo" : "moldura"}>
      <figcaption>{titulo}</figcaption>
      <div className="moldura__tela">
        {url ? <iframe src={url} title={titulo} allow="clipboard-read; clipboard-write" /> : <div className="moldura__vazia">{children}</div>}
      </div>
    </figure>
  );
}
