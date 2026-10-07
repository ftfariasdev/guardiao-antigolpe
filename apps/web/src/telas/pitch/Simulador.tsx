import type { EventosPitch } from "@guardiao/shared";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { api, BASE_API } from "../../api";
import { Escudo, IconeCheck, IconeSom } from "../../componentes/Icones";
import { falar, temVoz } from "../../voz";

/**
 * Golpe simulado do pitch. A página não tem nenhum campo: só um botão.
 * O servidor recebe apenas um identificador aleatório criado aqui e se a pessoa abriu ou tocou.
 */
function idDoVisitante(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const LICOES = [
  "Sorteio surpresa e contagem regressiva são iscas para você agir sem pensar.",
  "Pix de 1 centavo “para validar” é um golpe comum.",
  "Antes de pagar, pergunte ao Guardião.",
];
const FALA = `Isso foi apenas uma simulação do pitch, para demonstrar a facilidade de cair em um golpe. Nada foi coletado. ${LICOES.join(" ")}`;

export function Simulador({ sessaoId }: { sessaoId: string }) {
  const [revelado, setRevelado] = useState(false);
  const [segundos, setSegundos] = useState(119);
  const visitante = useRef(idDoVisitante());

  useEffect(() => {
    const id = visitante.current;
    // Falha de rede não muda nada para a pessoa: o contador é bônus do palco.
    void api.eventoPitch(sessaoId, id, "acessou").catch(() => {});
    void api.sessaoPitch(sessaoId).then((s) => s.status !== "aberta" && setRevelado(true)).catch(() => {});
    const socket: Socket<EventosPitch> = io(`${BASE_API}/pitch`, { auth: { sessao: sessaoId } });
    socket.on("pitch:revelar", () => setRevelado(true));
    socket.on("pitch:reset", () => setRevelado(false));
    return () => {
      socket.close();
    };
  }, [sessaoId]);

  useEffect(() => {
    if (revelado) return;
    const relogio = setInterval(() => setSegundos((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(relogio);
  }, [revelado]);

  useEffect(() => {
    document.documentElement.dataset.theme = revelado ? "pitch" : "";
    if (revelado) document.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
    return () => {
      document.documentElement.dataset.theme = "";
    };
  }, [revelado]);

  function confirmar() {
    void api.eventoPitch(sessaoId, visitante.current, "confirmou").catch(() => {});
    setRevelado(true);
  }

  if (revelado) {
    return (
      <main className="tela revelacao">
        {temVoz && (
          <div className="cabecalho__acoes">
            <button type="button" className="botao-redondo" aria-label="Ouvir esta mensagem em voz alta" onClick={() => falar(FALA, false)}><IconeSom tamanho={24} /></button>
          </div>
        )}
        <Escudo largura={76} />
        <div className="bloco">
          <h1 className="titulo" tabIndex={-1}>Isso foi apenas uma <span className="revelacao__acento">simulação</span>.</h1>
          <p className="apoio">Uma simulação do pitch para demonstrar a facilidade de cair em um golpe. Nada foi coletado.</p>
        </div>
        <ol className="passos">
          {LICOES.map((licao, i) => (
            <li key={licao} className="cartao passo">
              <span className="revelacao__numero" aria-hidden="true">{i + 1}</span>
              <p>{licao}</p>
            </li>
          ))}
        </ol>
        <p className="botao--fim revelacao__marca">Guardião <span className="revelacao__acento">Antigolpe</span></p>
      </main>
    );
  }

  const relogio = `${String(Math.floor(segundos / 60)).padStart(2, "0")}:${String(segundos % 60).padStart(2, "0")}`;
  // Visual de propósito diferente do Guardião: precisa parecer um aviso comum de evento.
  return (
    <main className="tela isca">
      <p className="isca__marca"><span className="isca__icone" aria-hidden="true">★</span>Sorteio do Evento</p>
      <p className="isca__selo">Só para quem está nesta palestra</p>
      <div className="bloco">
        <h1 className="isca__titulo" tabIndex={-1}>Participe do sorteio desta palestra</h1>
        <p className="isca__texto">Para validar sua participação, confirme um Pix de R$ 0,01 em 1 toque. O resultado sai no fim da palestra.</p>
      </div>
      <div className="isca__urgencia">
        <p><strong>Inscrições abertas</strong><span className="valor">encerram em {relogio}</span></p>
        <div className="isca__barra" aria-hidden="true"><span /></div>
        <p>Muita gente desta sala já confirmou</p>
      </div>
      <p className="isca__chave"><IconeCheck tamanho={22} />Sua chave Pix foi encontrada automaticamente</p>
      <button type="button" className="isca__botao botao--fim" onClick={confirmar}>Confirmar e participar</button>
      <p className="isca__letrinha">Participação só durante a palestra. Ao confirmar, você aceita os termos.</p>
    </main>
  );
}
