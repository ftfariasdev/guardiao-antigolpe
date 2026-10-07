import type { AlertaDetalhe, RespostaAlerta } from "@guardiao/shared";
import { useEffect, useState } from "react";
import { api, ErroApi } from "../../api";
import { IconeAlerta, IconeRelogio, IconeVoltar, IconeX } from "../../componentes/Icones";
import type { Sessao } from "../../sessao";

interface Props {
  sessao: Sessao;
  alertaId: string;
  aoVoltar: () => void;
  aoResponder: () => void;
}

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NOMES: Record<string, string> = {
  falso_parente: "falso parente", falsa_central: "falsa central", falso_boleto: "cobrança falsa", falso_emprego: "falso emprego",
  falso_motoboy: "falso motoboy", link_falso: "link falso", falso_investimento: "falso investimento", compra_falsa: "compra falsa",
};

export function AlertaGuardiao({ sessao, alertaId, aoVoltar, aoResponder }: Props) {
  const [alerta, setAlerta] = useState<AlertaDetalhe | null>(null);
  const [recado, setRecado] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Abrir o alerta já o marca como visto.
  useEffect(() => {
    let vivo = true;
    api
      .marcarVisto(sessao.token, alertaId)
      .then((a) => vivo && setAlerta(a))
      .catch((e) => vivo && setRecado(e instanceof ErroApi && e.status === 404 ? "Este alerta não é mais seu: outro guardião foi avisado." : "Não consegui abrir o alerta. Tente de novo."));
    return () => {
      vivo = false;
    };
  }, [sessao.token, alertaId]);

  async function responder(resposta: RespostaAlerta) {
    setEnviando(true);
    try {
      setAlerta(await api.responder(sessao.token, alertaId, resposta));
      aoResponder();
    } catch (e) {
      setRecado(e instanceof ErroApi ? e.message : "Não consegui enviar a resposta. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const vermelho = alerta?.analise.risco === "vermelho";
  const tipo = alerta ? NOMES[alerta.analise.tipo_golpe] : undefined;

  return (
    <main className="tela tela--larga">
      <header className="cabecalho">
        <button type="button" className="botao-redondo" aria-label="Voltar" onClick={aoVoltar}><IconeVoltar tamanho={24} /></button>
        <h1 className="titulo titulo--menor" tabIndex={-1}>Alerta da família</h1>
      </header>
      <p role="alert">{recado}</p>
      {alerta && (
        <>
          <section className="cartao">
            <span className={`etiqueta etiqueta--${alerta.analise.risco}`}>
              {vermelho ? <IconeX tamanho={16} /> : <IconeAlerta tamanho={16} />}
              {vermelho ? "Golpe provável" : "Atenção"}
            </span>
            <p>
              <strong>{alerta.protegido.nome}</strong> recebeu {vermelho && tipo ? <>uma mensagem de <strong>{tipo}</strong></> : "uma mensagem que merece conferência"}
              {alerta.valor ? <> pedindo <strong className="valor">{MOEDA.format(alerta.valor)}</strong></> : null}.
            </p>
            {alerta.status !== "respondido" && <p className="apoio">A tela de {alerta.protegido.nome} pede para não pagar até você responder.</p>}
          </section>

          {alerta.status === "respondido" ? (
            <section className="cartao cartao--destaque" role="status">
              <h2 className="subtitulo">Você respondeu</h2>
              <p>{alerta.resposta === "era_golpe" ? `Era golpe. A tela de ${alerta.protegido.nome} avisa para não pagar.` : `Você conferiu. A tela de ${alerta.protegido.nome} mostra que você verificou.`}</p>
            </section>
          ) : (
            <div className="bloco">
              <p className="apoio">Fale com {alerta.protegido.nome} antes de responder:</p>
              <button type="button" className="botao botao--perigo" disabled={enviando} onClick={() => responder("era_golpe")}>Liguei, era golpe</button>
              <button type="button" className="botao botao--secundario" disabled={enviando} onClick={() => responder("pode_seguir")}>Verifiquei, pode seguir</button>
            </div>
          )}

          {alerta.analise.sinais.length > 0 && (
            <section className="cartao" aria-labelledby="alerta-sinais">
              <h2 id="alerta-sinais" className="subtitulo">Sinais encontrados</h2>
              <ul className="sinais">
                {alerta.analise.sinais.filter((s) => s.trecho !== "[CÓDIGO PIX]").map((s) => (
                  <li key={s.codigo}><p className="sinais__trecho">“{s.trecho}”</p><p className="apoio">{s.explicacao}</p></li>
                ))}
              </ul>
            </section>
          )}

          {alerta.status !== "respondido" && alerta.proximo_guardiao && (
            <p className="com-icone apoio botao--fim"><IconeRelogio tamanho={22} /><span>Sem resposta em 5 min, avisamos {alerta.proximo_guardiao}, o próximo guardião.</span></p>
          )}
        </>
      )}
    </main>
  );
}
