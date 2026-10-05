import { useCallback, useEffect, useRef, useState } from "react";
import { abrirCanal, type Comando, type EstadoPalco } from "./apresentador/canal";
import { JanelaDoApresentador } from "./apresentador/Janela";
import { APP_URL } from "./config";
import { roteiro } from "./roteiro";
import { Marca, SLIDES, type PropsSlide } from "./slides";
import { useDemo } from "./tempo-real/demo";
import { usePitch } from "./tempo-real/sessao";

const parametros = new URLSearchParams(window.location.search);

export function App() {
  if (parametros.has("apresentador")) return <JanelaDoApresentador />;
  if (parametros.has("imprimir")) return <Impressao />;
  return <Palco />;
}

/** Base 16:9 de 1920 × 1080, escalada para caber em qualquer projetor. */
function useEscala() {
  const [escala, setEscala] = useState(1);
  useEffect(() => {
    const medir = () => setEscala(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);
  return escala;
}

function tocarAlerta() {
  try {
    const audio = new AudioContext();
    [880, 1175].forEach((frequencia, i) => {
      const nota = audio.createOscillator();
      const volume = audio.createGain();
      nota.frequency.value = frequencia;
      volume.gain.setValueAtTime(0.25, audio.currentTime + i * 0.18);
      volume.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + i * 0.18 + 0.3);
      nota.connect(volume).connect(audio.destination);
      nota.start(audio.currentTime + i * 0.18);
      nota.stop(audio.currentTime + i * 0.18 + 0.3);
    });
  } catch {
    /* sem áudio: a moldura ainda treme */
  }
}

function Palco() {
  const escala = useEscala();
  // `?slide=7` abre direto num slide: útil para ensaiar um trecho.
  const [indice, setIndice] = useState(() => Math.min(roteiro.length, Math.max(1, Number(parametros.get("slide")) || 1)) - 1);
  const [passo, setPasso] = useState(0);
  const [inicio, setInicio] = useState<number | null>(null);
  const [leve, setLeve] = useState(false);
  const [preto, setPreto] = useState(false);
  const [video, setVideo] = useState(false);
  const [alertaChegando, setAlertaChegando] = useState(false);
  const ultimoZ = useRef(0);

  const { estado: pitch, revelar, zerar } = usePitch(true);
  const demo = useDemo(true, () => {
    // O computador não vibra: a moldura da Ana treme e toca o som de notificação.
    setAlertaChegando(true);
    tocarAlerta();
    setTimeout(() => setAlertaChegando(false), 1500);
  });

  const slide = roteiro[indice]!;

  const proximo = useCallback(() => {
    setInicio((i) => i ?? Date.now());
    if (passo < (slide.passos ?? 0)) return setPasso(passo + 1);
    if (indice < roteiro.length - 1) {
      setIndice(indice + 1);
      setPasso(0);
    }
  }, [indice, passo, slide.passos]);

  const anterior = useCallback(() => {
    if (passo > 0) return setPasso(passo - 1);
    if (indice > 0) {
      setIndice(indice - 1);
      setPasso(roteiro[indice - 1]?.passos ?? 0);
    }
  }, [indice, passo]);

  const executar = useCallback(
    (comando: Comando) => {
      if (comando === "proximo") proximo();
      if (comando === "anterior") anterior();
      if (comando === "revelar") void revelar();
      if (comando === "zerar") void zerar();
      if (comando === "leve") setLeve((v) => !v);
      if (comando === "preto") setPreto((v) => !v);
      if (comando === "cronometro") setInicio(null);
    },
    [proximo, anterior, revelar, zerar],
  );

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tecla = e.key.toLowerCase();
      if (["arrowright", " ", "pagedown"].includes(tecla)) executar("proximo");
      else if (["arrowleft", "pageup"].includes(tecla)) executar("anterior");
      else if (tecla === "r") executar("revelar");
      else if (tecla === "z") {
        // Zerar apaga o placar: só vale apertando duas vezes em menos de 2 s.
        if (Date.now() - ultimoZ.current < 2000) executar("zerar");
        ultimoZ.current = Date.now();
      } else if (tecla === "l") executar("leve");
      else if (tecla === "b") executar("preto");
      else if (tecla === "f") void document.documentElement.requestFullscreen?.();
      else if (tecla === "p") window.open(`${window.location.pathname}?apresentador`, "apresentador", "width=900,height=700");
      else if (tecla === "d") void demo.preparar();
      else if (tecla === "v") setVideo((v) => !v);
      else return;
      e.preventDefault();
    };
    // Teclas apertadas com o foco dentro de uma moldura da demo chegam por mensagem do app.
    const aoReceber = (e: MessageEvent) => {
      if (e.origin !== new URL(APP_URL).origin || e.data?.tipo !== "guardiao-pitch-tecla") return;
      if (e.data.tecla === "ArrowRight" || e.data.tecla === "PageDown") executar("proximo");
      if (e.data.tecla === "ArrowLeft" || e.data.tecla === "PageUp") executar("anterior");
    };
    window.addEventListener("keydown", aoTeclar);
    window.addEventListener("message", aoReceber);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      window.removeEventListener("message", aoReceber);
    };
  }, [executar, demo]);

  // Publica o estado para a janela do apresentador e obedece aos comandos dela.
  const estadoPalco: EstadoPalco = { indice, passo, pitch, inicio, leve, preto, avisoDemo: demo.erro };
  const referencia = useRef(estadoPalco);
  referencia.current = estadoPalco;
  const canal = useRef<ReturnType<typeof abrirCanal> | null>(null);
  const executarAtual = useRef(executar);
  executarAtual.current = executar;
  useEffect(() => {
    const c = abrirCanal((m) => {
      if (m.tipo === "comando") executarAtual.current(m.comando);
      if (m.tipo === "pedir-estado") c.enviar({ tipo: "estado", estado: referencia.current });
    });
    canal.current = c;
    return () => c.fechar();
  }, []);
  useEffect(() => {
    canal.current?.enviar({ tipo: "estado", estado: estadoPalco });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice, passo, pitch, inicio, leve, preto, demo.erro]);

  const Conteudo = SLIDES[slide.id]!;
  const props: PropsSlide = { passo, pitch, leve, demo: { contas: demo.contas, alertaChegando, video, erro: demo.erro } };

  return (
    <div className="projetor" data-leve={leve || undefined}>
      <main className="palco" style={{ transform: `translate(-50%, -50%) scale(${escala})` }} aria-live="polite">
        {/* A chave refaz o slide a cada troca: é o que dispara o fade de entrada. */}
        <section key={slide.id} className="quadro" aria-label={`Slide ${indice + 1} de ${roteiro.length}: ${slide.titulo}`}>
          <Conteudo {...props} />
          {slide.legenda && slide.id !== "24-milhoes" && slide.id !== "med" && slide.id !== "fechamento" && <p className="legenda">{slide.legenda}</p>}
          {slide.id !== "brinde" && <footer className="rodape"><Marca /><span>{indice + 1} / {roteiro.length}</span></footer>}
        </section>
      </main>
      {preto && <div className="tela-preta" aria-label="Tela preta" />}
    </div>
  );
}

/** `?imprimir`: todos os slides em sequência, prontos para "Imprimir como PDF" (plano C). */
function Impressao() {
  const pitch = { sessao: null, acessaram: 0, confirmaram: 0, revelado: true, conexao: "ensaio" as const, aviso: "" };
  const props: PropsSlide = { passo: 99, pitch, demo: { contas: null, alertaChegando: false, video: false, erro: "" }, estatico: true };
  return (
    <div className="impressao">
      {roteiro.map((slide, i) => {
        const Conteudo = SLIDES[slide.id]!;
        return (
          <section key={slide.id} className="quadro quadro--impresso" aria-label={`Slide ${i + 1}: ${slide.titulo}`}>
            <Conteudo {...props} />
            {slide.id !== "brinde" && <footer className="rodape"><Marca /><span>{i + 1} / {roteiro.length}</span></footer>}
          </section>
        );
      })}
    </div>
  );
}
