import type { SessaoAberta } from "@guardiao/shared";
import { useEffect, useId, useState, type FormEvent } from "react";
import { api, ErroApi } from "../api";
import { Escudo } from "../componentes/Icones";

interface Props {
  /** Token do convite, quando a pessoa chegou pelo link ou QR. */
  convite: string | null;
  aoEntrar: (sessao: SessaoAberta) => void;
}

const SENHA_MINIMA = 8;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Modo = "convite" | "criar" | "entrar";

/**
 * Primeira tela de quem ainda não tem sessão. Quem chega por convite só diz o nome (sem senha);
 * os demais criam a conta, sem precisar de família ainda, ou entram com a conta que já têm.
 */
export function Entrada({ convite, aoEntrar }: Props) {
  const [modo, setModo] = useState<Modo>(convite ? "convite" : "criar");
  const [nome, setNome] = useState("");
  const [parentesco, setParentesco] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const ids = { nome: useId(), parentesco: useId(), email: useId(), senha: useId(), dica: useId(), erro: useId() };

  // Ao trocar de modo, o leitor de tela recomeça do título.
  useEffect(() => {
    document.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }, [modo]);

  function conferir(): string {
    if (modo === "convite") return nome.trim() ? "" : "Diga o seu nome para continuar.";
    if (!EMAIL_VALIDO.test(email.trim())) return "Confira o e-mail.";
    if (modo === "entrar") return senha ? "" : "Digite a sua senha.";
    if (!nome.trim()) return "Diga o seu nome para continuar.";
    return senha.length >= SENHA_MINIMA ? "" : `A senha precisa ter pelo menos ${SENHA_MINIMA} letras ou números.`;
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const problema = conferir();
    if (problema) return setErro(problema);
    setEnviando(true);
    setErro("");
    try {
      const conta = { email: email.trim(), senha };
      if (modo === "convite" && convite) aoEntrar(await api.aceitarConvite(convite, { nome: nome.trim(), ...(parentesco.trim() ? { parentesco: parentesco.trim() } : {}) }));
      else if (modo === "entrar") aoEntrar(await api.entrar(conta));
      else aoEntrar(await api.criarConta({ nome: nome.trim(), ...conta }));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não consegui conectar. Confira a internet e tente de novo.");
      setEnviando(false);
    }
  }

  const trocar = (novo: Modo) => {
    setErro("");
    setModo(novo);
  };

  const TEXTOS: Record<Modo, { titulo: string; apoio: string; botao: string }> = {
    convite: { titulo: "Você foi convidado", apoio: "Diga como você se chama para entrar na família.", botao: "Entrar na família" },
    criar: {
      titulo: "Proteja quem você ama",
      apoio: convite
        ? "Crie a sua conta. Em seguida você entra na família que convidou você."
        : "Crie a sua conta. Depois você cria uma família ou entra em uma que já existe.",
      botao: "Criar conta",
    },
    entrar: { titulo: "Entrar na sua conta", apoio: "Use o e-mail e a senha que você criou.", botao: "Entrar" },
  };
  const { titulo, apoio, botao } = TEXTOS[modo];

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
        {modo !== "entrar" && (
          <>
            <label className="rotulo" htmlFor={ids.nome}>Seu nome</label>
            <input id={ids.nome} className="campo campo--linha" value={nome} maxLength={60} autoComplete="given-name" placeholder={modo === "convite" ? "Como a família chama você" : "Ana"} onChange={(e) => setNome(e.target.value)} />
          </>
        )}
        {modo === "convite" && (
          <>
            <label className="rotulo" htmlFor={ids.parentesco}>Parentesco (opcional)</label>
            <input id={ids.parentesco} className="campo campo--linha" value={parentesco} maxLength={30} autoComplete="off" placeholder="filha, neto, mãe…" onChange={(e) => setParentesco(e.target.value)} />
          </>
        )}
        {modo !== "convite" && (
          <>
            <label className="rotulo" htmlFor={ids.email}>E-mail</label>
            <input id={ids.email} className="campo campo--linha" type="email" inputMode="email" value={email} maxLength={120} autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="voce@exemplo.com.br" onChange={(e) => setEmail(e.target.value)} />
            <label className="rotulo" htmlFor={ids.senha}>Senha</label>
            <input id={ids.senha} className="campo campo--linha" type="password" value={senha} maxLength={100} autoComplete={modo === "entrar" ? "current-password" : "new-password"} aria-describedby={modo === "criar" ? ids.dica : undefined} onChange={(e) => setSenha(e.target.value)} />
            {modo === "criar" && <p id={ids.dica} className="apoio">Pelo menos {SENHA_MINIMA} letras ou números. Com ela você entra em qualquer aparelho.</p>}
          </>
        )}
        <p id={ids.erro} className="aviso-erro" role="alert">{erro}</p>
        <button type="submit" className="botao botao--principal botao--grande botao--fim" disabled={enviando}>{enviando ? "Entrando…" : botao}</button>
        {modo === "convite" && <button type="button" className="botao botao--secundario" onClick={() => trocar("entrar")}>Já tenho conta: entrar com ela</button>}
        {modo === "criar" && <button type="button" className="botao botao--secundario" onClick={() => trocar("entrar")}>Já tenho conta: entrar</button>}
        {modo === "entrar" && <button type="button" className="botao botao--secundario" onClick={() => trocar("criar")}>Criar uma conta nova</button>}
        {modo !== "convite" && convite && <button type="button" className="botao botao--secundario" onClick={() => trocar("convite")}>Entrar só com o convite, sem senha</button>}
        {modo === "criar" && !convite && <p className="apoio">Recebeu um convite? Abra o link ou aponte a câmera para o QR Code que seu guardião mostrou.</p>}
      </form>
    </main>
  );
}
