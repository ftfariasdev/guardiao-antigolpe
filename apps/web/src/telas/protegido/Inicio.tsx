import { Cabecalho } from "../../componentes/Cabecalho";
import { IconeColar, IconeCompartilhar } from "../../componentes/Icones";

interface Props {
  aoColar: () => void;
  aoAbrirAcessibilidade: () => void;
  aoOuvir: (texto: string) => void;
}

const SAUDACAO = "Olá!";
const CHAMADA = "Recebeu algo estranho? Mostre para o Guardião antes de pagar.";

export function Inicio({ aoColar, aoAbrirAcessibilidade, aoOuvir }: Props) {
  return (
    <main className="tela">
      <Cabecalho aoAbrirAcessibilidade={aoAbrirAcessibilidade} aoOuvir={() => aoOuvir(`${SAUDACAO} ${CHAMADA} Toque em Colar mensagem.`)} />
      <div className="bloco">
        <h1 className="titulo" tabIndex={-1}>{SAUDACAO}</h1>
        <p className="apoio">{CHAMADA}</p>
      </div>
      <button type="button" className="botao botao--principal botao--grande" onClick={aoColar}>
        <IconeColar />
        Colar mensagem
      </button>
      <div className="cartao cartao--dica">
        <span className="selo" aria-hidden="true"><IconeCompartilhar tamanho={22} /></span>
        <p>Copie a mensagem no WhatsApp, volte aqui e toque em <strong>Colar mensagem</strong>.</p>
      </div>
    </main>
  );
}
