import { Cabecalho } from "../../componentes/Cabecalho";
import type { TreinoDetalhe } from "@guardiao/shared";
import { Escudo, IconeColar, IconeCompartilhar, IconeQr } from "../../componentes/Icones";

import type { Sessao } from "../../sessao";

interface Props {
  sessao: Sessao;
  treino: TreinoDetalhe | null;
  aoColar: () => void;
  aoLerQr: () => void;
  /** Só nos perfis de demonstração do pitch. */
  aoAbrirConversa?: () => void;
  aoAbrirTreino: () => void;
  aoAbrirAcessibilidade: () => void;
  aoOuvir: (texto: string) => void;
}

const CHAMADA = "Recebeu algo estranho? Mostre para o Guardião antes de pagar.";

export function Inicio({ sessao, treino, aoColar, aoLerQr, aoAbrirConversa, aoAbrirTreino, aoAbrirAcessibilidade, aoOuvir }: Props) {
  const SAUDACAO = `Olá, ${sessao.membro.nome}`;
  const guardioes = sessao.familia.membros.filter((m) => m.papel === "guardiao");
  return (
    <main className="tela tela--larga">
      <Cabecalho aoAbrirAcessibilidade={aoAbrirAcessibilidade} aoOuvir={() => aoOuvir(`${SAUDACAO} ${CHAMADA} Toque em Colar mensagem.`)} />
      <div className="bloco">
        <h1 className="titulo" tabIndex={-1}>{SAUDACAO}</h1>
        <p className="apoio">{CHAMADA}</p>
      </div>
      <button type="button" className="botao botao--principal botao--grande" onClick={aoColar}>
        <IconeColar />
        Colar mensagem
      </button>
      <button type="button" className="botao botao--secundario botao--grande" onClick={aoLerQr}>
        <IconeQr />
        Ler QR Code do Pix
      </button>
      {aoAbrirConversa && (
        <button type="button" className="botao botao--secundario" onClick={aoAbrirConversa}>Abrir mensagens (demonstração)</button>
      )}
      {treino && (
        <button type="button" className="cartao cartao--destaque cartao--botao" onClick={aoAbrirTreino}>
          <span className="com-icone"><Escudo largura={26} /><strong>{treino.enviado_por} mandou um treino</strong></span>
          <span className="apoio">Toque para praticar. É rápido.</span>
        </button>
      )}
      <div className="cartao cartao--dica">
        <span className="selo" aria-hidden="true"><IconeCompartilhar tamanho={22} /></span>
        <p>Copie a mensagem no WhatsApp, volte aqui e toque em <strong>Colar mensagem</strong>.</p>
      </div>
      {guardioes.length > 0 && (
        <section className="bloco botao--fim" aria-labelledby="inicio-guardioes">
          <h2 id="inicio-guardioes" className="apoio rotulo-secao">Quem cuida de você</h2>
          <ul className="guardioes">
            {guardioes.map((g) => (
              <li key={g.id} className="cartao membro">
                <span className="membro__inicial" aria-hidden="true">{g.nome[0]?.toUpperCase()}</span>
                <span><strong>{g.nome}</strong>{g.parentesco && (<><br />{g.parentesco}</>)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
