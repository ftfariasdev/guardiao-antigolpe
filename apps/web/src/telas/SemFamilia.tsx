import type { SessaoAberta } from "@guardiao/shared";
import { useId, useState, type FormEvent } from "react";
import { api, ErroApi } from "../api";
import { Escudo, IconeCasa, IconeConvidar, IconeSair } from "../componentes/Icones";

interface Props {
  token: string;
  /** Nome da conta; vira o nome da pessoa na família. */
  nome: string;
  /** Token do convite, quando a pessoa chegou pelo link ou QR. */
  convite: string | null;
  aoEntrar: (sessao: SessaoAberta) => void;
  aoSair: () => void;
}

/** Aceita o link inteiro do convite ou só o código dele. */
function codigoDoConvite(texto: string): string {
  const limpo = texto.trim();
  return /convite=([\w-]+)/.exec(limpo)?.[1] ?? limpo;
}

/** Quem tem conta mas ainda não está em nenhuma família: cria uma ou entra por convite. */
export function SemFamilia({ token, nome, convite, aoEntrar, aoSair }: Props) {
  const [familia, setFamilia] = useState("");
  const [parentesco, setParentesco] = useState("");
  const [colado, setColado] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const ids = { familia: useId(), parentesco: useId(), convite: useId() };
  const pessoa = () => ({ nome, ...(parentesco.trim() ? { parentesco: parentesco.trim() } : {}) });

  async function tentar(acao: () => Promise<SessaoAberta>) {
    setEnviando(true);
    setErro("");
    try {
      aoEntrar(await acao());
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não consegui conectar. Confira a internet e tente de novo.");
      setEnviando(false);
    }
  }

  function criar(evento: FormEvent) {
    evento.preventDefault();
    if (!familia.trim()) return setErro("Dê um nome para a família.");
    void tentar(() => api.criarFamilia({ ...pessoa(), nome_familia: familia.trim() }, token));
  }

  function usarConvite(evento: FormEvent) {
    evento.preventDefault();
    const codigo = convite ?? codigoDoConvite(colado);
    if (codigo.length < 20) return setErro("Cole o link do convite que o guardião mandou.");
    void tentar(() => api.aceitarConvite(codigo, pessoa(), token));
  }

  return (
    <main className="tela tela--larga">
      <header className="cabecalho">
        <Escudo />
        <span className="cabecalho__nome">Guardião</span>
        <div className="cabecalho__acoes">
          <button type="button" className="botao botao--secundario botao--compacto" onClick={aoSair}><IconeSair tamanho={22} />Sair</button>
        </div>
      </header>
      <div className="bloco">
        <h1 className="titulo" tabIndex={-1}>Olá, {nome}</h1>
        <p className="apoio">
          {convite ? "Sua conta está pronta e você tem um convite. Falta só entrar na família." : "Sua conta está pronta. Agora crie uma família ou entre em uma que já existe."}
        </p>
      </div>

      <div className="bloco">
        <label className="rotulo" htmlFor={ids.parentesco}>Seu parentesco (opcional)</label>
        <input id={ids.parentesco} className="campo campo--linha campo--curto" value={parentesco} maxLength={30} autoComplete="off" placeholder="filha, neto, mãe…" onChange={(e) => setParentesco(e.target.value)} />
        <p className="aviso-erro" role="alert">{erro}</p>
      </div>

      <section className={`cartao${convite ? " cartao--destaque" : ""}`} aria-labelledby="sf-entrar">
        <h2 id="sf-entrar" className="subtitulo com-icone"><span className="selo" aria-hidden="true"><IconeConvidar tamanho={22} /></span><span>{convite ? "Você foi convidado" : "Entrar em uma família"}</span></h2>
        <form className="bloco" onSubmit={usarConvite}>
          {convite ? (
            <p className="apoio">Um guardião convidou você. Toque para entrar na família dele.</p>
          ) : (
            <>
              <p className="apoio">Peça o convite a um guardião da família e cole aqui o link que ele mandar.</p>
              <label className="rotulo" htmlFor={ids.convite}>Link do convite</label>
              <input id={ids.convite} className="campo campo--linha" value={colado} maxLength={300} autoComplete="off" autoCapitalize="none" spellCheck={false} onChange={(e) => setColado(e.target.value)} />
            </>
          )}
          <button type="submit" className={`botao ${convite ? "botao--principal" : "botao--secundario"}`} disabled={enviando}>Entrar na família</button>
        </form>
      </section>

      <section className="cartao" aria-labelledby="sf-criar">
        <h2 id="sf-criar" className="subtitulo com-icone"><span className="selo" aria-hidden="true"><IconeCasa tamanho={22} /></span><span>Criar uma família</span></h2>
        <form className="bloco" onSubmit={criar}>
          <p className="apoio">Você vira o primeiro guardião e convida a pessoa que quer proteger.</p>
          <label className="rotulo" htmlFor={ids.familia}>Nome da família</label>
          <input id={ids.familia} className="campo campo--linha" value={familia} maxLength={60} autoComplete="off" placeholder="Família Silva" onChange={(e) => setFamilia(e.target.value)} />
          <button type="submit" className={`botao ${convite ? "botao--secundario" : "botao--principal"}`} disabled={enviando}>Criar família</button>
        </form>
      </section>
    </main>
  );
}
