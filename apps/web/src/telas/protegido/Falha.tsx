import { Cabecalho } from "../../componentes/Cabecalho";
import { IconeAlerta } from "../../componentes/Icones";

interface Props {
  aoTentarDeNovo: () => void;
  aoVoltar: () => void;
  aoAbrirAcessibilidade: () => void;
}

export const FALA_FALHA = "Não consegui analisar agora. Não pague nada por enquanto. Tente de novo ou fale com alguém de confiança.";

/** Sem resposta da API a tela pede cautela (âmbar); nunca libera. */
export function Falha({ aoTentarDeNovo, aoVoltar, aoAbrirAcessibilidade }: Props) {
  return (
    <main className="tela">
      <Cabecalho aoAbrirAcessibilidade={aoAbrirAcessibilidade} />
      <section className="semaforo semaforo--amarelo" aria-labelledby="falha-titulo">
        <div className="semaforo__topo">
          <span className="semaforo__icone" aria-hidden="true"><IconeAlerta /></span>
          <h1 id="falha-titulo" className="semaforo__palavra" tabIndex={-1}>Não consegui analisar</h1>
        </div>
        <p className="semaforo__frase">Pode ser a internet. Não pague nada por enquanto.</p>
      </section>
      <section className="cartao cartao--destaque">
        <h2 className="subtitulo">O que fazer agora</h2>
        <p>Tente de novo daqui a pouco ou fale com alguém de confiança antes de pagar.</p>
      </section>
      <div className="bloco botao--fim">
        <button type="button" className="botao botao--principal botao--grande" onClick={aoTentarDeNovo}>Tentar de novo</button>
        <button type="button" className="botao botao--secundario" onClick={aoVoltar}>Voltar ao início</button>
      </div>
    </main>
  );
}
