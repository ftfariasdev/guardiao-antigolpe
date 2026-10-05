import { IconeVoltar } from "../../componentes/Icones";

interface Props {
  guardiao: string | null;
  aoVoltar: () => void;
}

const PASSOS: { titulo: string; texto: string }[] = [
  {
    titulo: "Ligue agora para o seu banco",
    texto: "Use o número do verso do cartão ou o aplicativo. Diga: “Fui vítima de golpe e quero pedir a devolução do Pix pelo MED”. Quanto antes, maior a chance de o dinheiro voltar.",
  },
  {
    titulo: "Guarde as provas",
    texto: "Não apague a conversa. Tire print das mensagens e guarde o comprovante do pagamento.",
  },
  {
    titulo: "Faça um boletim de ocorrência",
    texto: "Pode ser pela delegacia online do seu estado ou em uma delegacia. O banco pode pedir o número do boletim.",
  },
  {
    titulo: "Não pague mais nada",
    texto: "Quem promete recuperar o seu dinheiro cobrando uma taxa está aplicando outro golpe.",
  },
];

/** "Já paguei, e agora?": o que fazer nas primeiras horas, em passos curtos. */
export function JaPaguei({ guardiao, aoVoltar }: Props) {
  return (
    <main className="tela">
      <header className="cabecalho">
        <button type="button" className="botao-redondo" aria-label="Voltar" onClick={aoVoltar}><IconeVoltar tamanho={24} /></button>
        <h1 className="titulo titulo--menor" tabIndex={-1}>Já paguei, e agora?</h1>
      </header>
      <p>Calma. Isso acontece com muita gente, e ainda dá para agir. Faça nesta ordem:</p>
      <ol className="passos">
        {PASSOS.map((passo, i) => (
          <li key={passo.titulo} className="cartao passo">
            <span className="passo__numero" aria-hidden="true">{i + 1}</span>
            <div className="bloco bloco--junto">
              <h2 className="subtitulo">{passo.titulo}</h2>
              <p>{passo.texto}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="cartao cartao--destaque">
        {guardiao ? `Fale também com ${guardiao}. Você não precisa resolver isso sem ajuda.` : "Peça ajuda a alguém de confiança. Você não precisa resolver isso sem ajuda."}
      </p>
      <button type="button" className="botao botao--secundario botao--fim" onClick={aoVoltar}>Voltar</button>
    </main>
  );
}
