import { useEffect, useRef, useState } from "react";
import { DURACAO_S, roteiro } from "../roteiro";
import { abrirCanal, type Comando, type EstadoPalco } from "./canal";

const relogio = (s: number) => `${s < 0 ? "-" : ""}${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, "0")}`;

/** Janela do apresentador: fala, cronômetro, próximo slide, placar e estado da conexão. */
export function JanelaDoApresentador() {
  const [estado, setEstado] = useState<EstadoPalco | null>(null);
  const [agora, setAgora] = useState(Date.now());
  const canal = useRef<ReturnType<typeof abrirCanal> | null>(null);

  useEffect(() => {
    const c = abrirCanal((m) => m.tipo === "estado" && setEstado(m.estado));
    canal.current = c;
    c.enviar({ tipo: "pedir-estado" });
    const tique = setInterval(() => setAgora(Date.now()), 500);
    return () => {
      clearInterval(tique);
      c.fechar();
    };
  }, []);

  const mandar = (comando: Comando) => canal.current?.enviar({ tipo: "comando", comando });

  if (!estado) {
    return <main className="apresentador"><p>Abra a apresentação na outra janela. Esta tela acompanha sozinha.</p></main>;
  }
  const slide = roteiro[estado.indice]!;
  const proximo = roteiro[estado.indice + 1];
  const restante = estado.inicio === null ? DURACAO_S : DURACAO_S - Math.floor((agora - estado.inicio) / 1000);
  const conexao = { conectando: "Conectando…", ao_vivo: "Ao vivo", ensaio: "Sem rede: dados do ensaio" }[estado.pitch.conexao];

  return (
    <main className="apresentador">
      <header>
        <p className={restante < 30 ? "apresentador__relogio apresentador__relogio--fim" : "apresentador__relogio"} role="timer">{relogio(restante)}</p>
        <p>Slide {estado.indice + 1} de {roteiro.length} · entra em {slide.inicio}{slide.passos ? ` · passo ${estado.passo + 1} de ${slide.passos + 1}` : ""}</p>
        <p>{conexao} · {estado.pitch.confirmaram} confirmaram de {estado.pitch.acessaram} · {estado.pitch.revelado ? "revelado" : "não revelado"}{estado.leve ? " · modo leve" : ""}{estado.preto ? " · TELA PRETA" : ""}</p>
      </header>
      <section>
        <h1>{slide.titulo}</h1>
        <p className="apresentador__fala">{slide.notas}</p>
        {(estado.pitch.aviso || estado.avisoDemo) && <p className="apresentador__aviso" role="alert">{[estado.pitch.aviso, estado.avisoDemo].filter(Boolean).join(" ")}</p>}
      </section>
      <footer>
        <p>Depois: {proximo ? proximo.titulo : "fim"}</p>
        <div className="apresentador__botoes">
          <button type="button" onClick={() => mandar("anterior")}>← Anterior</button>
          <button type="button" onClick={() => mandar("proximo")}>Próximo →</button>
          <button type="button" onClick={() => mandar("revelar")}>Revelar (R)</button>
          <button type="button" onClick={() => mandar("cronometro")}>Reiniciar cronômetro</button>
        </div>
      </footer>
    </main>
  );
}
