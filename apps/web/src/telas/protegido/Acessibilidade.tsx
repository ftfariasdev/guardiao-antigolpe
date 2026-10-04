import type { AjustesAcessibilidade } from "@guardiao/brand";
import { IconeVoltar } from "../../componentes/Icones";
import { temVoz } from "../../voz";

interface Props {
  ajustes: AjustesAcessibilidade;
  mudar: (mudanca: Partial<AjustesAcessibilidade>) => void;
  restaurar: () => void;
  aoVoltar: () => void;
}

const NIVEIS: AjustesAcessibilidade["texto"][] = [100, 125, 150, 175];
const podeVibrar = typeof navigator !== "undefined" && "vibrate" in navigator;

function Chave({ titulo, descricao, ligado, aoMudar }: { titulo: string; descricao: string; ligado: boolean; aoMudar: (ligado: boolean) => void }) {
  return (
    <li className="chave">
      <div className="chave__texto">
        <strong>{titulo}</strong>
        <span className="apoio">{descricao}</span>
      </div>
      <button type="button" className="chave__botao" role="switch" aria-checked={ligado} aria-label={titulo} onClick={() => aoMudar(!ligado)}>
        <span className="chave__trilho" aria-hidden="true"><span className="chave__pino" /></span>
        <span className="chave__estado">{ligado ? "Ligado" : "Desligado"}</span>
      </button>
    </li>
  );
}

export function Acessibilidade({ ajustes: a, mudar, restaurar, aoVoltar }: Props) {
  return (
    <main className="tela">
      <header className="cabecalho">
        <button type="button" className="botao-redondo" aria-label="Voltar" onClick={aoVoltar}>
          <IconeVoltar tamanho={24} />
        </button>
        <h1 className="titulo titulo--menor" tabIndex={-1}>Acessibilidade</h1>
      </header>

      <section className="bloco" aria-labelledby="ac-texto">
        <h2 id="ac-texto" className="subtitulo">Tamanho do texto</h2>
        <div className="cartao amostra" aria-hidden="true">
          <strong>Não pague ainda.</strong>
          <span>Ligue para o número antigo da sua filha.</span>
        </div>
        <div className="niveis" role="group" aria-labelledby="ac-texto">
          {NIVEIS.map((nivel, i) => (
            <button key={nivel} type="button" className="nivel" aria-pressed={a.texto === nivel} aria-label={`Texto em ${nivel}%`} onClick={() => mudar({ texto: nivel })}>
              <span className="nivel__letra" style={{ fontSize: `${0.8 + i * 0.25}rem` }} aria-hidden="true">A</span>
              <span className="nivel__rotulo">{nivel}%</span>
            </button>
          ))}
        </div>
      </section>

      <section className="cartao" aria-labelledby="ac-ver">
        <h2 id="ac-ver" className="subtitulo">Ver e ouvir</h2>
        <ul className="chaves">
          <Chave titulo="Alto contraste" descricao="Preto, branco e amarelo, para enxergar melhor" ligado={a.contraste === "alto"} aoMudar={(v) => mudar({ contraste: v ? "alto" : "normal" })} />
          <Chave titulo="Mais espaço no texto" descricao="Linhas e letras mais separadas" ligado={a.espaco === "amplo"} aoMudar={(v) => mudar({ espaco: v ? "amplo" : "normal" })} />
          {temVoz && <Chave titulo="Ler o resultado em voz alta" descricao="Fala sozinho assim que a análise termina" ligado={a.vozAutomatica} aoMudar={(v) => mudar({ vozAutomatica: v })} />}
          {temVoz && <Chave titulo="Voz mais devagar" descricao="Para entender com calma" ligado={a.vozLenta} aoMudar={(v) => mudar({ vozLenta: v })} />}
        </ul>
      </section>

      <section className="cartao" aria-labelledby="ac-movimento">
        <h2 id="ac-movimento" className="subtitulo">Movimento e toque</h2>
        <ul className="chaves">
          <Chave titulo="Reduzir animações" descricao="Tira movimentos e efeitos da tela" ligado={a.movimento === "reduzido"} aoMudar={(v) => mudar({ movimento: v ? "reduzido" : "normal" })} />
          {podeVibrar && <Chave titulo="Vibrar quando houver risco" descricao="Vibração forte e diferente no vermelho" ligado={a.vibrarNoRisco} aoMudar={(v) => mudar({ vibrarNoRisco: v })} />}
          <Chave titulo="Modo simples" descricao="Só o resultado e um botão por tela" ligado={a.modoSimples} aoMudar={(v) => mudar({ modoSimples: v })} />
        </ul>
      </section>

      <button type="button" className="botao botao--secundario botao--fim" onClick={restaurar}>Restaurar padrão</button>
    </main>
  );
}
