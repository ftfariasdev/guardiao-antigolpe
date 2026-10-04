import { Escudo, IconeAcessibilidade, IconeSom } from "./Icones";

interface Props {
  aoAbrirAcessibilidade: () => void;
  /** Quando presente, mostra o botão de ouvir a tela em voz alta. */
  aoOuvir?: () => void;
}

export function Cabecalho({ aoAbrirAcessibilidade, aoOuvir }: Props) {
  return (
    <header className="cabecalho">
      <Escudo />
      <span className="cabecalho__nome">Guardião</span>
      <div className="cabecalho__acoes">
        <button type="button" className="botao-redondo" aria-label="Acessibilidade" onClick={aoAbrirAcessibilidade}>
          <IconeAcessibilidade />
        </button>
        {aoOuvir && (
          <button type="button" className="botao-redondo" aria-label="Ouvir esta tela em voz alta" onClick={aoOuvir}>
            <IconeSom tamanho={24} />
          </button>
        )}
      </div>
    </header>
  );
}
