import type { SessaoCriada } from "@guardiao/shared";
import { useEffect, useId, useState, type FormEvent } from "react";
import { api, ErroApi } from "../api";
import { Escudo } from "../componentes/Icones";

interface Props {
  /** Token do convite, quando a pessoa chegou pelo link ou QR. */
  convite: string | null;
  aoEntrar: (sessao: SessaoCriada) => void;
}

const SENHA_MINIMA = 8;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Primeira tela de quem ainda não tem sessão. Quem chega por convite só diz o nome;
 * o guardião cria a conta (família + e-mail e senha) ou entra com a conta que já tem.
 */
export function Entrada({ convite, aoEntrar }: Props) {
  const [modo, setModo] = useState<"criar" | "entrar">("criar");
  const [nome, setNome] = useState("");
  const [parentesco, setParentesco] = useState("");
  const [familia, setFamilia] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const ids = { nome: useId(), parentesco: useId(), familia: useId(), email: useId(), senha: useId(), dica: useId(), erro: useId() };
  const entrando = !convite && modo === "entrar";

  // Ao trocar entre criar e entrar, o leitor de tela recomeça do título.
  useEffect(() => {
    document.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }, [modo]);

  function conferir(): string {
    if (convite) return nome.trim() ? "" : "Diga o seu nome para continuar.";
    if (!EMAIL_VALIDO.test(email.trim())) return "Confira o e-mail.";
    if (entrando) return senha ? "" : "Digite a sua senha.";
    if (!familia.trim() || !nome.trim()) return "Preencha o nome da família e o seu nome.";
    return senha.length >= SENHA_MINIMA ? "" : `A senha precisa ter pelo menos ${SENHA_MINIMA} letras ou números.`;
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const problema = conferir();
    if (problema) return setErro(problema);
    setEnviando(true);
    setErro("");
    try {
      const pessoa = { nome: nome.trim(), ...(parentesco.trim() ? { parentesco: parentesco.trim() } : {}) };
      const conta = { email: email.trim(), senha };
      if (convite) aoEntrar(await api.aceitarConvite(convite, pessoa));
      else if (entrando) aoEntrar(await api.entrar(conta));
      else aoEntrar(await api.criarFamilia({ ...pessoa, ...conta, nome_familia: familia.trim() }));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não consegui conectar. Confira a internet e tente de novo.");
      setEnviando(false);
    }
  }

  const titulo = convite ? "Você foi convidado" : entrando ? "Entrar na sua conta" : "Proteja quem você ama";
  const apoio = convite
    ? "Diga como você se chama para entrar na família."
    : entrando
      ? "Use o e-mail e a senha que você criou."
      : "Crie a sua conta e convide a pessoa que você quer proteger. O Guardião avisa você antes de ela pagar um golpe.";
  const botao = enviando ? "Entrando…" : convite ? "Entrar na família" : entrando ? "Entrar" : "Criar conta";

  return (
    <main className="tela">
      <header className="cabecalho">
        <Escudo />
        <span className="cabecalho__nome">Guardião</span>
      </header>
      <div className="bloco">
        <h1 className="titulo" tabIndex={-1}>{titulo}</h1>
        <p className="apoio">{apoio}</p>
      </div>
      <form className="bloco bloco--cresce" onSubmit={enviar} noValidate>
        {!convite && !entrando && (
          <>
            <label className="rotulo" htmlFor={ids.familia}>Nome da família</label>
            <input id={ids.familia} className="campo campo--linha" value={familia} maxLength={60} autoComplete="off" placeholder="Família Silva" onChange={(e) => setFamilia(e.target.value)} />
          </>
        )}
        {!entrando && (
          <>
            <label className="rotulo" htmlFor={ids.nome}>Seu nome</label>
            <input id={ids.nome} className="campo campo--linha" value={nome} maxLength={60} autoComplete="given-name" placeholder={convite ? "Como a família chama você" : "Ana"} onChange={(e) => setNome(e.target.value)} />
            <label className="rotulo" htmlFor={ids.parentesco}>Parentesco (opcional)</label>
            <input id={ids.parentesco} className="campo campo--linha" value={parentesco} maxLength={30} autoComplete="off" placeholder="filha, neto, mãe…" onChange={(e) => setParentesco(e.target.value)} />
          </>
        )}
        {!convite && (
          <>
            <label className="rotulo" htmlFor={ids.email}>E-mail</label>
            <input id={ids.email} className="campo campo--linha" type="email" inputMode="email" value={email} maxLength={120} autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="voce@exemplo.com.br" onChange={(e) => setEmail(e.target.value)} />
            <label className="rotulo" htmlFor={ids.senha}>Senha</label>
            <input id={ids.senha} className="campo campo--linha" type="password" value={senha} maxLength={100} autoComplete={entrando ? "current-password" : "new-password"} aria-describedby={entrando ? undefined : ids.dica} onChange={(e) => setSenha(e.target.value)} />
            {!entrando && <p id={ids.dica} className="apoio">Pelo menos {SENHA_MINIMA} letras ou números. Com ela você entra em qualquer aparelho.</p>}
          </>
        )}
        <p id={ids.erro} className="aviso-erro" role="alert">{erro}</p>
        <button type="submit" className="botao botao--principal botao--grande botao--fim" disabled={enviando}>{botao}</button>
        {!convite && (
          <button type="button" className="botao botao--secundario" onClick={() => { setErro(""); setModo(entrando ? "criar" : "entrar"); }}>
            {entrando ? "Criar uma conta nova" : "Já tenho conta: entrar"}
          </button>
        )}
        {!convite && !entrando && <p className="apoio">Recebeu um convite? Abra o link ou aponte a câmera para o QR Code que seu guardião mostrou.</p>}
      </form>
    </main>
  );
}
