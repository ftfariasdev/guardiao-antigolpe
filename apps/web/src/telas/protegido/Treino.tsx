import type { TreinoDetalhe } from "@guardiao/shared";
import { useState } from "react";
import { api } from "../../api";
import { Escudo, IconeVoltar } from "../../componentes/Icones";
import type { Sessao } from "../../sessao";

interface Props {
  sessao: Sessao;
  treino: TreinoDetalhe;
  aoTerminar: () => void;
}

/**
 * Treino ("vacina"): um golpe simulado, avisado como treino desde o começo.
 * Ganha escudos quem escolhe mostrar ao Guardião em vez de pagar.
 */
export function Treino({ sessao, treino, aoTerminar }: Props) {
  const [feito, setFeito] = useState<TreinoDetalhe | null>(treino.resultado === "pendente" ? null : treino);
  const [recado, setRecado] = useState("");

  async function escolher(resultado: "encaminhou" | "caiu") {
    try {
      setFeito(await api.responderTreino(sessao.token, treino.id, resultado));
    } catch {
      setRecado("Não consegui registrar agora. Tente de novo.");
    }
  }

  return (
    <main className="tela">
      <header className="cabecalho">
        <button type="button" className="botao-redondo" aria-label="Voltar" onClick={aoTerminar}><IconeVoltar tamanho={24} /></button>
        <h1 className="titulo titulo--menor" tabIndex={-1}>Treino antigolpe</h1>
      </header>
      <p className="apoio">{treino.enviado_por} mandou um treino. Esta mensagem é de mentira, só para praticar.</p>
      <section className="cartao" aria-labelledby="treino-mensagem">
        <h2 id="treino-mensagem" className="subtitulo">Imagine que você recebeu isto:</h2>
        <p className="mensagem-simulada">{treino.conteudo}</p>
      </section>
      <p role="alert">{recado}</p>
      {feito ? (
        <section className="cartao cartao--destaque" role="status">
          <h2 className="subtitulo com-icone"><Escudo largura={26} /><span>{feito.resultado === "encaminhou" ? `Muito bem! Você ganhou ${feito.pontos} escudos` : "Era um treino. Nada foi pago"}</span></h2>
          <p>{treino.licao}</p>
          {feito.resultado !== "encaminhou" && <p>Da próxima vez, mostre a mensagem ao Guardião antes de fazer qualquer coisa.</p>}
          <button type="button" className="botao botao--principal botao--grande" onClick={aoTerminar}>Voltar ao início</button>
        </section>
      ) : (
        <div className="bloco botao--fim">
          <p className="rotulo">O que você faria?</p>
          <button type="button" className="botao botao--principal botao--grande" onClick={() => escolher("encaminhou")}>Mostrar ao Guardião</button>
          <button type="button" className="botao botao--secundario" onClick={() => escolher("caiu")}>Fazer o que a mensagem pede</button>
        </div>
      )}
    </main>
  );
}
