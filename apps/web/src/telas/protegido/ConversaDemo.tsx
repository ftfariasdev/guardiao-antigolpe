import { DEMO_MENSAGEM_FALSO_PARENTE, DEMO_PIX_LOJA, DEMO_PIX_LOJA_TEXTO, type TipoEntrada } from "@guardiao/shared";
import { useState } from "react";
import { IconeCompartilhar, IconeVoltar } from "../../componentes/Icones";

interface Props {
  aoCompartilhar: (texto: string, tipo: TipoEntrada) => void;
  aoVoltar: () => void;
}

const MENSAGENS: { de: string; visivel: string; enviar: string; tipo: TipoEntrada }[] = [
  { de: "Número desconhecido", visivel: DEMO_MENSAGEM_FALSO_PARENTE, enviar: DEMO_MENSAGEM_FALSO_PARENTE, tipo: "texto" },
  { de: "Bela Casa Móveis", visivel: `${DEMO_PIX_LOJA_TEXTO}\n[Pix copia e cola]`, enviar: DEMO_PIX_LOJA, tipo: "pix" },
];

/**
 * Conversa de mentira para a demo do pitch (só nos perfis de demonstração).
 * Faz as vezes do aplicativo de mensagens: tocar em Compartilhar e escolher o Guardião.
 */
export function ConversaDemo({ aoCompartilhar, aoVoltar }: Props) {
  const [aberta, setAberta] = useState<number | null>(null);
  const escolhida = aberta === null ? null : MENSAGENS[aberta];

  return (
    <main className="tela">
      <header className="cabecalho">
        <button type="button" className="botao-redondo" aria-label="Voltar" onClick={aoVoltar}><IconeVoltar tamanho={24} /></button>
        <h1 className="titulo titulo--menor" tabIndex={-1}>Mensagens</h1>
      </header>
      <p className="apoio">Conversa de demonstração.</p>
      <ul className="bloco">
        {MENSAGENS.map((m, i) => (
          <li key={m.de} className="bloco">
            <p className="rotulo">{m.de}</p>
            <p className="mensagem-simulada">{m.visivel}</p>
            <button type="button" className="botao botao--secundario" onClick={() => setAberta(i)}><IconeCompartilhar tamanho={22} />Compartilhar</button>
          </li>
        ))}
      </ul>
      {escolhida && (
        <div className="cartao cartao--destaque folha" role="dialog" aria-label="Compartilhar com">
          <p className="rotulo">Compartilhar com</p>
          <button type="button" className="botao botao--principal botao--grande" onClick={() => aoCompartilhar(escolhida.enviar, escolhida.tipo)}>Guardião</button>
          <button type="button" className="botao botao--secundario" onClick={() => setAberta(null)}>Cancelar</button>
        </div>
      )}
    </main>
  );
}
