import type { ReactNode } from "react";
import { Escudo, Marca, MolduraCelular, NumeroGrande, Qr } from "../componentes/base";
import { APP_URL, REPO_URL } from "../config";
import { medicao } from "../medicao";
import type { ContasDemo } from "../tempo-real/demo";
import type { EstadoPitch } from "../tempo-real/sessao";

export interface PropsSlide {
  /** Passo da animação dentro do slide (0 = só a entrada). */
  passo: number;
  pitch: EstadoPitch;
  demo: { contas: ContasDemo | null; alertaChegando: boolean; video: boolean; erro: string };
  /** Modo impressão (?imprimir): tudo aparece pronto, sem iframes nem vídeo. */
  estatico?: boolean;
}

const linkDoSimulador = (sessao: string | null) => `${APP_URL}/#pitch=${sessao ?? "00000000-0000-4000-8000-000000000000"}`;
const semProtocolo = (url: string) => url.replace(/^https?:\/\//, "");
const mostra = (passo: number, n: number, estatico?: boolean) => (estatico || passo >= n ? "aparece aparece--sim" : "aparece");

/** 1. Visual neutro de evento, de propósito sem a marca: precisa parecer um aviso comum. */
function Brinde({ pitch }: PropsSlide) {
  return (
    <div className="slide slide--isca">
      <div className="coluna">
        <p className="isca__selo">Só para quem está nesta palestra</p>
        <h1 className="isca__titulo">Os 10 primeiros a confirmar ganham um fone Bluetooth</h1>
        <p className="isca__texto">Aponte a câmera do celular para o código.</p>
        <p className="isca__link">Ou digite: {semProtocolo(APP_URL)}/#pitch</p>
      </div>
      <div className="cartao-qr"><Qr url={linkDoSimulador(pitch.sessao)} rotulo="QR Code do brinde" /></div>
    </div>
  );
}

/** 2. Painel ao vivo. */
function Painel({ pitch }: PropsSlide) {
  const desconfiaram = Math.max(0, pitch.acessaram - pitch.confirmaram);
  const porcento = pitch.acessaram ? Math.round((pitch.confirmaram / pitch.acessaram) * 100) : 0;
  return (
    <div className="slide slide--painel">
      <div className="coluna">
        <p className="ao-vivo"><span />Ao vivo</p>
        <h1>Quantas pessoas caíram?</h1>
        <div className="placar">
          <p><NumeroGrande valor={pitch.confirmaram} className="acento" /><span>tocaram em Confirmar</span></p>
          <p><NumeroGrande valor={desconfiaram} /><span>desconfiaram e não tocaram</span></p>
        </div>
        <div className="barra" role="img" aria-label={`${porcento}% de quem abriu tocou em Confirmar`}><span style={{ width: `${porcento}%` }} /></div>
        <p className="apoio">{porcento}% de quem abriu a página tocou em Confirmar</p>
      </div>
      <div className="cartao-qr"><Qr url={linkDoSimulador(pitch.sessao)} rotulo="QR Code da sessão" /><p>Escaneie e participe</p></div>
    </div>
  );
}

/** 3. Revelação (cena 3D 1 no D7). */
function Revelacao({ pitch }: PropsSlide) {
  return (
    <div className="slide slide--centro">
      <Escudo largura={220} />
      <h1>Isso foi apenas uma <span className="acento">simulação</span>.</h1>
      <p className="frase"><NumeroGrande valor={pitch.confirmaram} className="numero--linha acento" /> de vocês tocaram em Confirmar em menos de um minuto.</p>
    </div>
  );
}

function VinteQuatroMilhoes() {
  return (
    <div className="slide slide--centro">
      <p className="gigante"><NumeroGrande valor={24} /> milhões</p>
      <p className="frase">de brasileiros caíram em golpe de Pix ou boleto em um ano</p>
    </div>
  );
}

function Med({ estatico }: PropsSlide) {
  return (
    <div className="slide slide--centro">
      <p className="gigante acento"><NumeroGrande valor={9.3} formatar={(n) => `${n.toFixed(1).replace(".", ",")}%`} /></p>
      <div className={estatico ? "barra barra--med barra--pronta" : "barra barra--med"} role="img" aria-label="Barra quase vazia: 9,3%"><span /></div>
      <p className="frase">do dinheiro contestado no MED em 2025 voltou</p>
    </div>
  );
}

/** 6. Solução (cena 3D 2 no D7). */
function Solucao() {
  return (
    <div className="slide slide--centro">
      <Escudo largura={240} pulsando />
      <h1>Antes de pagar, pergunte ao Guardião.</h1>
    </div>
  );
}

/** 7. Demo ao vivo: o app de verdade em duas molduras. */
function Demo({ demo, estatico }: PropsSlide) {
  if (estatico) {
    return (
      <div className="slide slide--centro">
        <h1>Demo ao vivo</h1>
        <p className="frase">A Dona Cida mostra a mensagem ao Guardião. A filha recebe o alerta antes do Pix.</p>
      </div>
    );
  }
  if (demo.video) {
    return (
      <div className="slide slide--centro">
        {/* Vídeo de backup: gravado no ensaio e salvo em public/video/demo.mp4. */}
        <video className="video-backup" src="/video/demo.mp4" controls autoPlay>
          <track kind="captions" />
        </video>
      </div>
    );
  }
  const frame = (perfil: "cida" | "ana", token: string) => `${APP_URL}/?perfil=${perfil}#sessao=${token}`;
  return (
    <div className="slide slide--demo">
      <MolduraCelular titulo="Dona Cida" url={demo.contas && frame("cida", demo.contas.cida)}>
        <p>{demo.erro || "Contas de demonstração ainda não preparadas."}</p>
        <p>Aperte <kbd>D</kbd> para preparar.</p>
      </MolduraCelular>
      <MolduraCelular titulo="Ana, a filha" url={demo.contas && frame("ana", demo.contas.ana)} tremendo={demo.alertaChegando}>
        <p>O alerta aparece aqui, antes do Pix.</p>
      </MolduraCelular>
    </div>
  );
}

const CAMADAS = [
  { nome: "Entrada", texto: "Texto, print, áudio, link, Pix copia e cola ou QR Code" },
  { nome: "Regras + IA", texto: "Rodam ao mesmo tempo, cada uma com o trecho que justifica o sinal" },
  { nome: "Fusão", texto: "Vale o maior risco. Se a IA falhar, a resposta nunca é “pode pagar”" },
  { nome: "Resultado", texto: "Semáforo em linguagem simples, e a família avisada antes do Pix" },
];

function Motor({ passo, estatico }: PropsSlide) {
  return (
    <div className="slide slide--lista">
      <h1>Como funciona</h1>
      <ol className="camadas">
        {CAMADAS.map((c, i) => (
          <li key={c.nome} className={mostra(passo, i, estatico)}><strong>{c.nome}</strong><span>{c.texto}</span></li>
        ))}
      </ol>
    </div>
  );
}

const DIFERENCIAIS = [
  { nome: "Família antes do Pix", texto: "O guardião é avisado enquanto ainda dá tempo de impedir." },
  { nome: "Palavra-senha", texto: "Uma palavra que só a família sabe, para desmascarar o falso parente." },
  { nome: "Treino", texto: "Golpes de mentira dentro do app, para praticar sem risco." },
];

function Diferenciais({ passo, estatico }: PropsSlide) {
  return (
    <div className="slide slide--lista">
      <h1>O que só o Guardião junta</h1>
      <ul className="cartoes">
        {DIFERENCIAIS.map((d, i) => (
          <li key={d.nome} className={mostra(passo, i, estatico)}><strong>{d.nome}</strong><span>{d.texto}</span></li>
        ))}
      </ul>
      <p className="selo-acessibilidade">Acessível: texto grande, alto contraste e leitura em voz alta</p>
    </div>
  );
}

function Resultados() {
  return (
    <div className="slide slide--centro">
      {medicao ? (
        <>
          <p className="gigante"><NumeroGrande valor={medicao.golpesDetectados} className="acento" /> de {medicao.golpes}</p>
          <p className="frase">golpes detectados no conjunto de avaliação</p>
          <p className="apoio">{medicao.golpes} mensagens de golpe e {medicao.legitimas} legítimas · {medicao.alarmesFalsos} alarme(s) falso(s) em vermelho</p>
        </>
      ) : (
        <>
          <p className="gigante">— de —</p>
          <p className="frase">golpes detectados no conjunto de avaliação</p>
          <p className="apoio">Números a preencher em src/medicao.ts depois da medição com o LLM</p>
        </>
      )}
    </div>
  );
}

/** 11. Fechamento (cena 3D 3 no D7). */
function Fechamento() {
  return (
    <div className="slide slide--painel">
      <div className="coluna">
        <Escudo largura={140} />
        <h1>Golpe não se recupera.<br /><span className="acento">Se previne.</span></h1>
        <p className="frase">Antes de pagar, pergunte ao Guardião.</p>
      </div>
      <div className="cartao-qr"><Qr url={REPO_URL} rotulo="QR Code do repositório" /><p>Código do projeto</p></div>
    </div>
  );
}

export const SLIDES: Record<string, (props: PropsSlide) => ReactNode> = {
  brinde: Brinde,
  painel: Painel,
  revelacao: Revelacao,
  "24-milhoes": VinteQuatroMilhoes,
  med: Med,
  solucao: Solucao,
  demo: Demo,
  motor: Motor,
  diferenciais: Diferenciais,
  resultados: Resultados,
  fechamento: Fechamento,
};

export { Marca };
