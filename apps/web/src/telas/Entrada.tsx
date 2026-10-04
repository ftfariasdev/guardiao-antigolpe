import type { SessaoCriada } from "@guardiao/shared";
import { useId, useState, type FormEvent } from "react";
import { api, ErroApi } from "../api";
import { Escudo } from "../componentes/Icones";

interface Props {
  /** Token do convite, quando a pessoa chegou pelo link ou QR. */
  convite: string | null;
  aoEntrar: (sessao: SessaoCriada) => void;
}

/** Primeira tela de quem ainda não tem sessão: aceitar o convite ou criar a família. */
export function Entrada({ convite, aoEntrar }: Props) {
  const [nome, setNome] = useState("");
  const [parentesco, setParentesco] = useState("");
  const [familia, setFamilia] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const ids = { nome: useId(), parentesco: useId(), familia: useId(), erro: useId() };

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!nome.trim() || (!convite && !familia.trim())) return setErro("Preencha os campos para continuar.");
    setEnviando(true);
    setErro("");
    try {
      const dados = { nome: nome.trim(), ...(parentesco.trim() ? { parentesco: parentesco.trim() } : {}) };
      aoEntrar(convite ? await api.aceitarConvite(convite, dados) : await api.criarFamilia({ ...dados, nome_familia: familia.trim() }));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não consegui conectar. Confira a internet e tente de novo.");
      setEnviando(false);
    }
  }

  return (
    <main className="tela">
      <header className="cabecalho">
        <Escudo />
        <span className="cabecalho__nome">Guardião</span>
      </header>
      <div className="bloco">
        <h1 className="titulo" tabIndex={-1}>{convite ? "Você foi convidado" : "Proteja quem você ama"}</h1>
        <p className="apoio">
          {convite
            ? "Diga como você se chama para entrar na família."
            : "Crie a família e convide a pessoa que você quer proteger. O Guardião avisa você antes de ela pagar um golpe."}
        </p>
      </div>
      <form className="bloco bloco--cresce" onSubmit={enviar} noValidate>
        {!convite && (
          <>
            <label className="rotulo" htmlFor={ids.familia}>Nome da família</label>
            <input id={ids.familia} className="campo campo--linha" value={familia} maxLength={60} autoComplete="off" placeholder="Família Silva" onChange={(e) => setFamilia(e.target.value)} />
          </>
        )}
        <label className="rotulo" htmlFor={ids.nome}>Seu nome</label>
        <input id={ids.nome} className="campo campo--linha" value={nome} maxLength={60} autoComplete="given-name" placeholder={convite ? "Como a família chama você" : "Ana"} onChange={(e) => setNome(e.target.value)} />
        <label className="rotulo" htmlFor={ids.parentesco}>Parentesco (opcional)</label>
        <input id={ids.parentesco} className="campo campo--linha" value={parentesco} maxLength={30} autoComplete="off" placeholder="filha, neto, mãe…" onChange={(e) => setParentesco(e.target.value)} />
        <p id={ids.erro} className="aviso-erro" role="alert">{erro}</p>
        <button type="submit" className="botao botao--principal botao--grande botao--fim" disabled={enviando}>
          {enviando ? "Entrando…" : convite ? "Entrar na família" : "Criar família"}
        </button>
        {!convite && <p className="apoio">Recebeu um convite? Abra o link ou aponte a câmera para o QR Code que seu guardião mostrou.</p>}
      </form>
    </main>
  );
}
