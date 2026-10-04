import { trechoOriginal, type TextoNormalizado } from "../normalizacao/texto.js";
import { linkSuspeito } from "./links.js";
import type { Forca, SinalRegra } from "./tipos.js";

/**
 * Catálogo de regras de texto (doc "Regras, prompt e avaliação do motor"):
 * 2 gatilhos, 11 sinais fortes e 6 fracos. Os padrões rodam sobre o texto normalizado
 * (minúsculas, sem acentos) e cada regra devolve o trecho exato que a disparou.
 */

interface Achado {
  inicio: number;
  fim: number;
}

export interface RegraTexto {
  codigo: string;
  forca: Forca;
  explicacao: string;
  /** Só vale se outra regra também disparou (ex.: urgência só conta junto de pedido de dinheiro). */
  exige?: string;
  procurar: (normalizado: string) => Achado | null;
}

/**
 * Trecho da mesma frase: qualquer coisa que não encerre a frase, até `max` caracteres.
 * O ponto entre dois dígitos ("R$ 1.800") é separador de milhar, não fim de frase.
 */
const ate = (max: number) => `(?:[^.!?\\n]|(?<=\\d)\\.(?=\\d)){0,${max}}`;

function porPadroes(...padroes: RegExp[]): RegraTexto["procurar"] {
  return (normalizado) => {
    for (const padrao of padroes) {
      const m = padrao.exec(normalizado);
      if (m) return { inicio: m.index, fim: m.index + m[0].length };
    }
    return null;
  };
}

const VERBO_ENVIAR = "(?:faz|faca|fazer|manda|mande|mandar|envia|envie|enviar|transfere|transfira|transferir|deposita|deposite|depositar)";
const VERBO_PASSAR = "(?:passa|passe|passar|informa|informe|informar|envia|envie|enviar|manda|mande|mandar|confirma|confirme|confirmar|digita|digite|digitar|atualiza|atualize|atualizar|fala|fale|diz|diga)";

export const REGRAS_TEXTO: RegraTexto[] = [
  /* ---------- Gatilhos ---------- */
  {
    codigo: "pedido_dinheiro",
    forca: "gatilho",
    explicacao: "A mensagem pede dinheiro, Pix ou pagamento.",
    procurar: porPadroes(
      new RegExp(`\\b${VERBO_ENVIAR}\\b${ate(40)}\\b(?:pix|transferencia|deposito|dinheiro|reais|r\\$ ?\\d|\\d{2,})`),
      new RegExp(`\\b(?:pague|pagar|paga|quite|quitar|transfira|transferir|deposite)\\b${ate(40)}`),
      new RegExp(`\\b(?:preciso|precisando|precisava) de ${ate(15)}\\d[\\d.,]*(?: reais)?`),
      new RegExp(`\\bme ajudar? com ${ate(10)}\\d[\\d.,]*`),
      /\bpagamento (?:apenas |so |somente |unicamente )?(?:por|via|no|em) pix\b/,
      new RegExp(`\\b(?:minimo|apenas|somente) de r\\$ ?\\d[\\d.,]*${ate(15)}pix`),
      new RegExp(`\\bme empresta${ate(30)}`),
    ),
  },
  {
    codigo: "pedido_dados",
    forca: "gatilho",
    explicacao: "A mensagem pede senha, código ou dados pessoais.",
    procurar: porPadroes(
      new RegExp(
        `\\b${VERBO_PASSAR}\\b${ate(40)}\\b(?:senha|codigo|token|cvv|numero do cartao|foto do (?:cartao|documento|rg|cpf)|selfie|dados)\\b${ate(25)}`,
      ),
      new RegExp(`\\bqual (?:e )?(?:a|o) (?:sua |seu )?(?:senha|codigo|token|cvv)\\b${ate(25)}`),
    ),
  },

  /* ---------- Sinais fortes ---------- */
  {
    codigo: "troca_numero",
    forca: "forte",
    explicacao: "Golpistas dizem que trocaram de número para fingir ser alguém da família.",
    procurar: porPadroes(
      /\b(?:mudei|troquei) de (?:numero|celular|telefone|chip)\b/,
      /\b(?:num |em um |no |meu |esse e meu |com )?(?:numero novo|novo numero)\b/,
      /\bcelular (?:quebrou|quebrado|estragou|estragado|molhou|foi roubado|perdido)\b/,
      /\bperdi (?:o |meu )?celular\b/,
      /\bsalva (?:esse|este|ai|o meu)(?: numero| contato)?\b/,
    ),
  },
  {
    codigo: "urgencia_dinheiro",
    forca: "forte",
    exige: "pedido_dinheiro",
    explicacao: "Pressa para pagar é o sinal mais comum de golpe.",
    procurar: porPadroes(
      /\bate (?:as |a )?\d{1,2}(?: ?h(?:oras)?|:\d{2})\b/,
      /\b(?:vence|expira|so|somente|apenas|pague|pagar|ainda) hoje\b/,
      /\b(?:urgente|urgencia|imediatamente|o quanto antes|com urgencia)\b/,
      // Leva junto as palavras anteriores, para o trecho mostrado fazer sentido sozinho.
      /(?:\b[\w$]+ ){0,3}\b(?:agora|hoje)\b/,
    ),
  },
  {
    codigo: "falsa_central",
    forca: "forte",
    explicacao: "Banco de verdade não avisa de fraude assim nem pede para você agir por mensagem.",
    procurar: porPadroes(
      /\bcentral de (?:seguranca|atendimento|fraudes?|relacionamento)\b/,
      /\bsetor de (?:fraudes?|seguranca|prevencao)\b/,
      new RegExp(`\\b(?:identificamos|detectamos|constatamos|houve)${ate(30)}\\b(?:compra|transacao|movimentacao|tentativa|acesso)${ate(25)}`),
      /\b(?:compra|transacao|movimentacao) (?:nao reconhecida|suspeita|indevida)\b/,
      /\b(?:sua |a )?conta (?:foi |esta |sera )?(?:invadida|clonada|hackeada|bloqueada|comprometida)\b/,
    ),
  },
  {
    codigo: "conta_segura",
    forca: "forte",
    explicacao: "Não existe conta segura: banco nenhum pede para você transferir seu dinheiro.",
    procurar: porPadroes(
      /\bconta (?:segura|de seguranca|protegida|reserva|temporaria)\b/,
      /\b(?:para |pra )?proteger (?:o |seu |o seu )?(?:saldo|dinheiro)\b/,
    ),
  },
  {
    codigo: "portador_cartao",
    forca: "forte",
    explicacao: "Banco nenhum manda buscar o cartão em casa nem pede para cortar o cartão.",
    procurar: porPadroes(
      new RegExp(`\\b(?:portador|motoboy|mensageiro|funcionario|entregador)${ate(40)}\\b(?:retirar|buscar|recolher|coletar|pegar)${ate(20)}`),
      new RegExp(`\\b(?:retirar|buscar|recolher|coletar)${ate(15)}\\bcartao\\b`),
      new RegExp(`\\b(?:corte|cortar|quebre)${ate(20)}\\b(?:cartao|ao meio|chip)\\b`),
    ),
  },
  {
    codigo: "instalar_app",
    forca: "forte",
    explicacao: "Pedir para instalar um aplicativo é um jeito de o golpista controlar o seu celular.",
    procurar: porPadroes(
      new RegExp(`\\b(?:instale|instalar|instala|baixe|baixar|baixa)\\b${ate(30)}\\b(?:app|aplicativo|programa|modulo)\\b${ate(25)}`),
      /\b(?:anydesk|teamviewer|quicksupport|rustdesk|acesso remoto)\b/,
    ),
  },
  {
    codigo: "sigilo",
    forca: "forte",
    explicacao: "Quem pede segredo não quer que você confira com alguém de confiança.",
    procurar: porPadroes(
      new RegExp(`\\bnao (?:conta|fala|diz|comenta|avisa)${ate(10)}\\b(?:pra|pro|para|a|ao) (?:ninguem|o pai|a mae|pai|mae|seu \\w+|sua \\w+|ele|ela)\\b`),
      /\bnao (?:conta|fala|diz|comenta) (?:nada|isso)\b/,
      /\bapaga(?:r)? (?:essa|esta|a) (?:mensagem|conversa)\b/,
      /\b(?:fica|e) (?:so )?entre (?:nos|a gente)\b/,
      /\bdepois (?:eu )?(?:te |lhe )?explico\b/,
    ),
  },
  {
    codigo: "conta_terceiro",
    forca: "forte",
    explicacao: "O dinheiro iria para a conta de outra pessoa, não de quem está pedindo.",
    procurar: porPadroes(
      /\b(?:na |pra |para a |a )?conta (?:do|da|de) (?:meu|minha|um|uma) \w+/,
      /\bconta de (?:outra pessoa|terceiros?)\b/,
      /\b(?:chave|pix) (?:do|da) (?:meu|minha) \w+/,
      /\bmeu pix (?:esta|ta|esta com|ta com) (?:bloqueado|problema|limite)\b/,
    ),
  },
  {
    codigo: "link_suspeito",
    forca: "forte",
    explicacao: "Esse endereço não é o site oficial. Links assim levam a páginas falsas.",
    procurar: linkSuspeito,
  },
  {
    codigo: "taxa_liberacao",
    forca: "forte",
    explicacao: "Ninguém precisa pagar para receber. Cobrar taxa antes de liberar algo é golpe.",
    procurar: porPadroes(
      new RegExp(`\\b(?:taxa|tarifa|deposito|pagamento|valor)\\b${ate(45)}\\b(?:liberar|liberacao|desbloque\\w+|sacar|saque|receb\\w+|retirar|retirada|ativar)\\b`),
      new RegExp(`\\b(?:liberar|liberacao|desbloque\\w+|sacar|saque)\\b${ate(30)}\\b(?:taxa|tarifa|pagamento)\\b`),
    ),
  },
  {
    codigo: "ganho_irreal",
    forca: "forte",
    explicacao: "Dinheiro fácil ou lucro garantido não existe. É isca para você depositar.",
    procurar: porPadroes(
      new RegExp(`\\bganhe${ate(30)}\\b(?:por dia|por hora|por tarefa|por semana|sem sair de casa)${ate(20)}`),
      new RegExp(`\\b(?:rendimento|retorno|lucro|ganho)s?\\b${ate(30)}\\b(?:garantido|ao dia|diario|por dia)\\b`),
      /\b\d+(?:[.,]\d+)? ?% (?:ao|por) dia\b/,
      /\b(?:renda (?:extra|facil)|dinheiro facil|curtindo videos|avaliando produtos)\b/,
    ),
  },

  /* ---------- Sinais fracos ---------- */
  {
    codigo: "saudacao_generica",
    forca: "fraco",
    explicacao: "Quem conhece você chama pelo nome, não de cliente.",
    procurar: porPadroes(/\b(?:prezad[oa]|car[oa]|estimad[oa])(?:\(a\))? (?:cliente|usuari[oa]|senhor|senhora|correntista|beneficiari[oa])\b/),
  },
  {
    codigo: "premio",
    forca: "fraco",
    explicacao: "Prêmio ou pontos que você não esperava costumam ser isca.",
    procurar: porPadroes(
      /\b(?:sorteio|sortead[oa]|premio|premiad[oa]|voce ganhou|parabens, voce)\b/,
      new RegExp(`\\bpontos${ate(30)}\\b(?:expiram|vencem|resgat\\w+)`),
      /\bresgate (?:agora|ja|seus|seu)\b/,
    ),
  },
  {
    codigo: "ameaca",
    forca: "fraco",
    explicacao: "Ameaça de bloqueio ou de nome sujo serve para assustar e apressar você.",
    procurar: porPadroes(
      /\bsera (?:bloquead|cancelad|suspens|protestad|negativad|encerrad)\w*/,
      new RegExp(`\\b(?:evitar|evite)${ate(10)}\\b(?:bloqueio|cancelamento|suspensao|protesto)${ate(20)}`),
      /\b(?:serasa|spc|protesto em cartorio|nome sujo|negativad[oa]|limpar (?:o |seu )?nome)\b/,
    ),
  },
  {
    codigo: "desconto_hoje",
    forca: "fraco",
    explicacao: "Desconto que só vale hoje serve para você não ter tempo de conferir.",
    procurar: porPadroes(
      new RegExp(`\\bdesconto${ate(30)}\\bhoje\\b`),
      new RegExp(`\\b(?:so|somente|apenas) hoje${ate(30)}\\bdesconto\\b`),
    ),
  },
  {
    codigo: "apelo_emocional",
    forca: "fraco",
    explicacao: "Desespero na mensagem é usado para você agir sem pensar.",
    procurar: porPadroes(
      /\b(?:desesperad[oa]|socorro|pelo amor de deus)\b/,
      /\b(?:me ajuda|preciso (?:muito )?(?:de|da) (?:sua )?ajuda|favor urgente)\b/,
    ),
  },
  {
    codigo: "parente_generico",
    forca: "fraco",
    explicacao: "A mensagem chama você de mãe, pai ou vó, mas isso qualquer pessoa pode escrever.",
    procurar: porPadroes(
      /(?:^|[.!?] )(?:(?:oi+|ola|oie|bom dia|boa tarde|boa noite),? )?(?:mae|mamae|pai|papai|vo|vovo|vozinha|tia|tio|madrinha|padrinho)\b/,
    ),
  },
];

export function aplicarRegrasTexto(texto: TextoNormalizado): SinalRegra[] {
  const sinais: SinalRegra[] = [];
  for (const regra of REGRAS_TEXTO) {
    const achado = regra.procurar(texto.normalizado);
    if (!achado) continue;
    const trecho = trechoOriginal(texto, achado.inicio, achado.fim);
    if (!trecho) continue;
    sinais.push({ codigo: regra.codigo, origem: "regra", forca: regra.forca, trecho, explicacao: regra.explicacao });
  }
  const codigos = new Set(sinais.map((s) => s.codigo));
  const exigidoPor = new Map(REGRAS_TEXTO.filter((r) => r.exige).map((r) => [r.codigo, r.exige as string]));
  return sinais.filter((s) => !exigidoPor.has(s.codigo) || codigos.has(exigidoPor.get(s.codigo) as string));
}
