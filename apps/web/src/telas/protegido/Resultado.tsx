import { semaforo, type AjustesAcessibilidade } from "@guardiao/brand";
import type { ResultadoAnalise } from "@guardiao/shared";
import { Cabecalho } from "../../componentes/Cabecalho";
import { IconeAlerta, IconeCheck, IconeChave, IconeRelogio, IconeSom, IconeX } from "../../componentes/Icones";

const ICONES = { check: IconeCheck, alerta: IconeAlerta, x: IconeX };
const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Palavra do semáforo. Com Pix, o verde não diz "pode seguir": a pessoa ainda confere o nome no banco. */
export function palavraDoRisco(r: ResultadoAnalise): string {
  if (r.risco === "amarelo") return "Confira antes de pagar";
  if (r.risco === "verde" && r.pix) return "Sem sinais de golpe";
  return semaforo[r.risco].rotulo;
}

/** Texto lido em voz alta e anunciado ao leitor de tela. */
export function resumoFalado(r: ResultadoAnalise): string {
  return [palavraDoRisco(r), r.titulo, r.acao].join(". ").replace(/\.\./g, ".");
}

/** Frase dita quando o guardião responde. O desbloqueio vem do guardião, nunca do app. */
export function falaDaResposta(r: ResultadoAnalise): string {
  if (r.alerta?.resposta === "era_golpe") return `${r.alerta.guardiao} confirmou: era golpe. Não pague.`;
  if (r.alerta?.resposta === "pode_seguir") return `Seu guardião verificou. ${r.alerta.guardiao} conferiu esta mensagem.`;
  return "";
}

function EstadoDoAlerta({ alerta }: { alerta: NonNullable<ResultadoAnalise["alerta"]> }) {
  if (alerta.resposta === "era_golpe") {
    return (
      <section className="semaforo semaforo--vermelho" role="status">
        <div className="semaforo__topo">
          <span className="semaforo__icone" aria-hidden="true"><IconeX /></span>
          <h2 className="semaforo__palavra semaforo__palavra--menor">Era golpe</h2>
        </div>
        <p><strong>{alerta.guardiao}</strong> confirmou: era golpe. Não pague.</p>
      </section>
    );
  }
  if (alerta.resposta === "pode_seguir") {
    return (
      <section className="semaforo semaforo--verde" role="status">
        <div className="semaforo__topo">
          <span className="semaforo__icone" aria-hidden="true"><IconeCheck /></span>
          <h2 className="semaforo__palavra semaforo__palavra--menor">Seu guardião verificou</h2>
        </div>
        <p><strong>{alerta.guardiao}</strong> conferiu esta mensagem. Se ficar em dúvida, fale de novo com {alerta.guardiao}.</p>
      </section>
    );
  }
  return (
    <div className="cartao cartao--dica" role="status">
      <span className="selo" aria-hidden="true"><IconeRelogio tamanho={22} /></span>
      <p><strong>{alerta.guardiao} já recebeu o aviso.</strong><br /><span className="apoio">Aguardando a resposta. Não pague enquanto isso.</span></p>
    </div>
  );
}

/** O código Pix em si não é um "ponto de atenção": os dados dele já aparecem no cartão do Pix. */
const MARCADOR_PIX = "[CÓDIGO PIX]";

interface Props {
  resultado: ResultadoAnalise;
  ajustes: AjustesAcessibilidade;
  aoVoltar: () => void;
  aoOuvir: (texto: string) => void;
  aoJaPaguei: () => void;
  aoAbrirAcessibilidade: () => void;
}

export function Resultado({ resultado: r, ajustes, aoVoltar, aoOuvir, aoJaPaguei, aoAbrirAcessibilidade }: Props) {
  const Icone = ICONES[semaforo[r.risco].icone];
  const simples = ajustes.modoSimples;
  const sinais = r.sinais.filter((s) => s.trecho !== MARCADOR_PIX);
  // Depois que o guardião confere, a resposta dele vem na frente; o aviso do app deixa de mandar.
  const conferido = r.alerta?.resposta === "pode_seguir";
  const tituloSinais = r.risco === "vermelho" ? "Por que achamos isso" : "Pontos de atenção";

  return (
    <main className="tela">
      <Cabecalho aoAbrirAcessibilidade={aoAbrirAcessibilidade} />

      {r.alerta?.resposta && <EstadoDoAlerta alerta={r.alerta} />}

      {!conferido && (
        <>
          <section className={`semaforo semaforo--${r.risco}`} aria-labelledby="resultado-titulo">
            <div className="semaforo__topo">
              <span className="semaforo__icone" aria-hidden="true"><Icone /></span>
              <h1 id="resultado-titulo" className="semaforo__palavra" tabIndex={-1}>{palavraDoRisco(r)}</h1>
            </div>
            <p className="semaforo__frase">{r.titulo}</p>
            {r.parcial && !/não consegui/i.test(r.titulo) && <p className="semaforo__nota">Não consegui conferir tudo agora. Por segurança, trate com cuidado.</p>}
          </section>

          <section className="cartao cartao--destaque" aria-labelledby="resultado-acao">
            <h2 id="resultado-acao" className="subtitulo">O que fazer agora</h2>
            <p>{r.acao}</p>
            {r.sugerir_palavra_senha && !/palavra-senha/i.test(r.acao) && (
              <p className="com-icone">
                <span className="selo" aria-hidden="true"><IconeChave tamanho={22} /></span>
                <span>Pergunte a <strong>palavra-senha da família</strong>. Só a sua família sabe.</span>
              </p>
            )}
          </section>
        </>
      )}

      {r.alerta && !r.alerta.resposta && <EstadoDoAlerta alerta={r.alerta} />}

      {!simples && r.pix && (
        <section className="cartao" aria-labelledby="resultado-pix">
          <h2 id="resultado-pix" className="subtitulo">O que o código Pix mostra</h2>
          <dl className="dados">
            <dt>Recebedor</dt><dd><strong>{r.pix.nome_declarado ?? "Não informado"}</strong></dd>
            {r.pix.cnpj && (<><dt>Empresa</dt><dd>{r.pix.cnpj.razao_social}. {r.pix.cnpj.situacao.toLowerCase()}, aberta em {r.pix.cnpj.data_abertura.slice(0, 4)}</dd></>)}
            <dt>Valor</dt><dd className="valor"><strong>{r.pix.valor === null ? "Em aberto" : MOEDA.format(r.pix.valor)}</strong></dd>
            <dt>Cidade do Pix</dt><dd>{r.pix.cidade ?? "Não informada"}</dd>
          </dl>
        </section>
      )}

      {!simples && sinais.length > 0 && (
        <section className="cartao" aria-labelledby="resultado-sinais">
          <h2 id="resultado-sinais" className="subtitulo">{tituloSinais}</h2>
          <ul className="sinais">
            {sinais.map((s) => (
              <li key={s.codigo}>
                <p className="sinais__trecho">“{s.trecho}”</p>
                <p className="apoio">{s.explicacao}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!simples && r.risco === "verde" && (
        <div className="cartao cartao--dica">
          <span className="selo" aria-hidden="true"><IconeChave tamanho={22} /></span>
          <p>Lembrete: nunca passe senha ou código recebido por SMS, nem para quem diz ser do banco.</p>
        </div>
      )}

      <div className="bloco botao--fim">
        <button type="button" className="botao botao--principal botao--grande" onClick={aoVoltar}>
          {r.risco === "verde" ? "Voltar ao início" : "Analisar outra mensagem"}
        </button>
        {!simples && (
          <button type="button" className="botao botao--secundario" onClick={() => aoOuvir(resumoFalado(r))}>
            <IconeSom tamanho={24} />
            Ouvir em voz alta
          </button>
        )}
        {r.risco !== "verde" && (
          <button type="button" className="botao botao--secundario" onClick={aoJaPaguei}>Já paguei, e agora?</button>
        )}
      </div>
    </main>
  );
}
