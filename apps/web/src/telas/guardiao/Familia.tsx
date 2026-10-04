import type { AlertaDetalhe, ItemHistorico } from "@guardiao/shared";
import { useEffect, useId, useState, type FormEvent } from "react";
import { api, ErroApi } from "../../api";
import { IconeAcessibilidade, IconeChave, IconeConvidar, IconeSino } from "../../componentes/Icones";
import { ativarAvisos, avisosAtivos, temPush } from "../../push";
import type { Sessao } from "../../sessao";

interface Props {
  sessao: Sessao;
  pendentes: AlertaDetalhe[];
  historico: ItemHistorico[];
  aoConvidar: (papel: "protegido" | "guardiao") => void;
  aoAbrirAlerta: (id: string) => void;
  aoAbrirAcessibilidade: () => void;
  aoMudarFamilia: () => void;
}

const ORDINAL = ["1ª", "2ª", "3ª"];
const DATA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function desfecho(item: ItemHistorico): string {
  if (item.alerta?.resposta === "era_golpe") return "Era golpe";
  if (item.alerta?.resposta === "pode_seguir") return "Conferido";
  if (item.risco === "verde") return "Seguro";
  return "Sem resposta";
}

export function Familia({ sessao, pendentes, historico, aoConvidar, aoAbrirAlerta, aoAbrirAcessibilidade, aoMudarFamilia }: Props) {
  const { familia, membro, token } = sessao;
  const protegido = familia.membros.find((m) => m.papel === "protegido");
  const guardioes = familia.membros.filter((m) => m.papel === "guardiao");
  const [avisos, setAvisos] = useState<"ativos" | "inativos" | "negados" | "indisponiveis">(temPush ? "inativos" : "indisponiveis");
  const [editandoSenha, setEditandoSenha] = useState(false);
  const [palavra, setPalavra] = useState("");
  const [recado, setRecado] = useState("");
  const idPalavra = useId();

  useEffect(() => {
    void avisosAtivos().then((ativos) => ativos && setAvisos("ativos"));
  }, []);

  async function ligarAvisos() {
    try {
      const r = await ativarAvisos(token, membro.id);
      setAvisos(r === "ativado" ? "ativos" : r === "negado" ? "negados" : "indisponiveis");
    } catch {
      setRecado("Não consegui ativar os avisos agora. Tente de novo.");
    }
  }

  async function salvarPalavra(evento: FormEvent) {
    evento.preventDefault();
    try {
      await api.definirPalavraSenha(token, familia.id, palavra);
      setPalavra("");
      setEditandoSenha(false);
      setRecado("Palavra-senha guardada. Combine com a família por telefone ou pessoalmente.");
      aoMudarFamilia();
    } catch (e) {
      setRecado(e instanceof ErroApi ? e.message : "Não consegui salvar. Tente de novo.");
    }
  }

  return (
    <main className="tela">
      <header className="cabecalho">
        <div className="bloco bloco--junto">
          <h1 className="titulo titulo--menor" tabIndex={-1}>{familia.nome}</h1>
          <p className="apoio">{protegido ? `Protegendo ${protegido.nome}` : "Falta convidar a pessoa protegida"}</p>
        </div>
        <div className="cabecalho__acoes">
          <button type="button" className="botao-redondo" aria-label="Acessibilidade" onClick={aoAbrirAcessibilidade}><IconeAcessibilidade /></button>
        </div>
      </header>

      <p className="so-leitor" role="status" aria-live="polite">{recado}</p>
      {recado && <p className="cartao" aria-hidden="true">{recado}</p>}

      {pendentes.length > 0 && (
        <section className="bloco" aria-labelledby="fam-pendentes">
          <h2 id="fam-pendentes" className="subtitulo">Esperando a sua resposta</h2>
          {pendentes.map((a) => (
            <button key={a.id} type="button" className={`alerta-pendente alerta-pendente--${a.analise.risco}`} onClick={() => aoAbrirAlerta(a.id)}>
              <strong>{a.analise.risco === "vermelho" ? "Golpe provável" : "Atenção"}: {a.protegido.nome}</strong>
              <span>{a.analise.titulo}. Toque para ver.</span>
            </button>
          ))}
        </section>
      )}

      <section className="cartao" aria-labelledby="fam-membros">
        <h2 id="fam-membros" className="subtitulo">Quem está na família</h2>
        <ul className="membros">
          {protegido && (
            <li className="membro">
              <span className="membro__inicial membro__inicial--protegido" aria-hidden="true">{protegido.nome[0]?.toUpperCase()}</span>
              <span><strong>{protegido.nome}</strong><br /><span className="apoio">Pessoa protegida</span></span>
            </li>
          )}
          {guardioes.map((g, i) => (
            <li key={g.id} className="membro">
              <span className="membro__inicial" aria-hidden="true">{g.nome[0]?.toUpperCase()}</span>
              <span>
                <strong>{g.nome}{g.id === membro.id ? " (você)" : ""}</strong><br />
                <span className="apoio">{g.parentesco ? `${g.parentesco[0]?.toUpperCase()}${g.parentesco.slice(1)}, ` : ""}{ORDINAL[i]} pessoa a ser avisada</span>
              </span>
            </li>
          ))}
        </ul>
        {!protegido && (
          <button type="button" className="botao botao--principal" onClick={() => aoConvidar("protegido")}><IconeConvidar tamanho={22} />Convidar a pessoa protegida</button>
        )}
        {guardioes.length < 3 && (
          <button type="button" className="botao botao--secundario" onClick={() => aoConvidar("guardiao")}><IconeConvidar tamanho={22} />Convidar guardião</button>
        )}
      </section>

      <section className="cartao" aria-labelledby="fam-avisos">
        <h2 id="fam-avisos" className="subtitulo com-icone"><span className="selo" aria-hidden="true"><IconeSino tamanho={22} /></span><span>Avisos neste aparelho</span></h2>
        {avisos === "ativos" && <p>Ativados. Você recebe o alerta mesmo com o app fechado.</p>}
        {avisos === "inativos" && (<><p className="apoio">Ative para receber o alerta mesmo com o app fechado.</p><button type="button" className="botao botao--principal" onClick={ligarAvisos}>Ativar avisos</button></>)}
        {avisos === "negados" && <p>Os avisos estão bloqueados neste navegador. Libere as notificações nas configurações do site.</p>}
        {avisos === "indisponiveis" && <p className="apoio">Este navegador não recebe avisos com o app fechado. Deixe o Guardião aberto para ver os alertas.</p>}
      </section>

      <section className="cartao" aria-labelledby="fam-senha">
        <h2 id="fam-senha" className="subtitulo com-icone"><span className="selo" aria-hidden="true"><IconeChave tamanho={22} /></span><span>Palavra-senha da família</span></h2>
        <p className="apoio">{familia.tem_palavra_senha ? "Definida. Ninguém consegue vê-la, nem o app." : "Uma palavra que só a família sabe, para conferir quem pede dinheiro."}</p>
        {editandoSenha ? (
          <form className="bloco" onSubmit={salvarPalavra}>
            <label className="rotulo" htmlFor={idPalavra}>Nova palavra-senha</label>
            <input id={idPalavra} className="campo campo--linha" value={palavra} minLength={3} maxLength={60} autoComplete="off" onChange={(e) => setPalavra(e.target.value)} />
            <button type="submit" className="botao botao--principal" disabled={palavra.trim().length < 3}>Guardar</button>
          </form>
        ) : (
          <button type="button" className="botao botao--secundario" onClick={() => setEditandoSenha(true)}>{familia.tem_palavra_senha ? "Trocar" : "Definir"}</button>
        )}
      </section>

      <section className="cartao" aria-labelledby="fam-historico">
        <h2 id="fam-historico" className="subtitulo">Últimos alertas</h2>
        {historico.length === 0 ? (
          <p className="apoio">Nenhuma mensagem analisada ainda.</p>
        ) : (
          <ul className="historico">
            {historico.map((item) => (
              <li key={item.id}>
                <span>{DATA.format(new Date(item.criado_em))} · {item.titulo}</span>
                <strong className={`texto-risco texto-risco--${item.risco}`}>{desfecho(item)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
