import { useEffect, useState } from "react";
import { Escudo, IconeCheck } from "../../componentes/Icones";

const ETAPAS = ["Li a mensagem", "Procurei sinais de golpe", "Conferindo com a inteligência artificial"];

interface Props {
  aoCancelar: () => void;
}

export function Analisando({ aoCancelar }: Props) {
  const [atual, setAtual] = useState(0);

  // As duas primeiras etapas são rápidas no servidor; a última fica aberta até a resposta chegar.
  useEffect(() => {
    if (atual >= ETAPAS.length - 1) return;
    const relogio = setTimeout(() => setAtual((n) => n + 1), 700);
    return () => clearTimeout(relogio);
  }, [atual]);

  return (
    <main className="tela">
      <header className="cabecalho">
        <Escudo />
        <span className="cabecalho__nome">Guardião</span>
      </header>
      <div className="bloco bloco--centro">
        <Escudo largura={124} pensando />
        <h1 className="titulo" tabIndex={-1}>Analisando a mensagem</h1>
        <p className="apoio">Leva poucos segundos. Não pague nada enquanto isso.</p>
      </div>
      <ol className="cartao etapas" aria-label="Etapas da análise">
        {ETAPAS.map((etapa, i) => (
          <li key={etapa} className={i === atual ? "etapa etapa--atual" : "etapa"} aria-current={i === atual ? "step" : undefined} hidden={i > atual}>
            <span className={i < atual ? "etapa__marca etapa__marca--feita" : "etapa__marca"} aria-hidden="true">
              {i < atual ? <IconeCheck tamanho={18} /> : <span className="etapa__ponto" />}
            </span>
            {etapa}
            <span className="so-leitor">{i < atual ? " (feito)" : " (em andamento)"}</span>
          </li>
        ))}
      </ol>
      <button type="button" className="botao botao--secundario botao--fim" onClick={aoCancelar}>Cancelar</button>
    </main>
  );
}
