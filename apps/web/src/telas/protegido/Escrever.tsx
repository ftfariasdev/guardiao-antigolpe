import { useId, useState, type FormEvent } from "react";
import { IconeColar, IconeVoltar } from "../../componentes/Icones";

interface Props {
  textoInicial: string;
  aoAnalisar: (texto: string) => void;
  aoVoltar: () => void;
}

const LIMITE = 5000;

export function Escrever({ textoInicial, aoAnalisar, aoVoltar }: Props) {
  const [texto, setTexto] = useState(textoInicial);
  const [aviso, setAviso] = useState("");
  const idCampo = useId();
  const idAviso = useId();

  async function colar() {
    try {
      const copiado = await navigator.clipboard.readText();
      if (copiado.trim()) {
        setTexto(copiado.slice(0, LIMITE));
        setAviso("Mensagem colada. Agora toque em Analisar.");
      } else {
        setAviso("Não achei nada copiado. Copie a mensagem e tente de novo.");
      }
    } catch {
      setAviso("Não consegui colar sozinho. Toque e segure na caixa abaixo e escolha Colar.");
    }
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!texto.trim()) {
      setAviso("Cole ou escreva a mensagem primeiro.");
      return;
    }
    aoAnalisar(texto.trim());
  }

  return (
    <main className="tela">
      <header className="cabecalho">
        <button type="button" className="botao-redondo" aria-label="Voltar" onClick={aoVoltar}>
          <IconeVoltar tamanho={24} />
        </button>
        <h1 className="titulo titulo--menor" tabIndex={-1}>Mostre a mensagem</h1>
      </header>
      <form className="bloco bloco--cresce" onSubmit={enviar} noValidate>
        <label className="rotulo" htmlFor={idCampo}>Mensagem que você recebeu</label>
        <textarea
          id={idCampo}
          className="campo"
          value={texto}
          maxLength={LIMITE}
          rows={7}
          aria-describedby={idAviso}
          placeholder="Cole aqui a mensagem, o link ou o código do Pix"
          onChange={(e) => setTexto(e.target.value)}
        />
        <p id={idAviso} className="apoio" role="status" aria-live="polite">{aviso}</p>
        <button type="button" className="botao botao--secundario" onClick={colar}>
          <IconeColar tamanho={24} />
          Colar o que copiei
        </button>
        <button type="submit" className="botao botao--principal botao--grande botao--fim">Analisar</button>
      </form>
    </main>
  );
}
