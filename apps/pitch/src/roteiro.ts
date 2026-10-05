/** Roteiro do pitch (doc "Apresentação programada e roteiro da demo"): ordem, tempo e fala. */
export interface Slide {
  id: string;
  /** Minuto em que o slide entra, no pitch de 5:00. */
  inicio: string;
  titulo: string;
  /** Resumo da fala, mostrado na janela do apresentador. */
  notas: string;
  /** Legenda da fala na tela principal, nos slides em que ela ajuda quem não ouve bem. */
  legenda?: string;
  /** Quantos passos de animação o slide tem além da entrada. */
  passos?: number;
  cena3d?: boolean;
  aoVivo?: boolean;
}

export const roteiro: Slide[] = [
  { id: "brinde", inicio: "0:00", titulo: "Os 10 primeiros a confirmar ganham um fone Bluetooth", notas: "Antes de começar, um recado: os 10 primeiros que confirmarem ganham um fone. Escaneiem aí.", aoVivo: true },
  { id: "painel", inicio: "0:40", titulo: "Quantas pessoas caíram?", notas: "Olha quantos já confirmaram. (Aperte R para revelar ao passar para o próximo.)", aoVivo: true },
  { id: "revelacao", inicio: "1:00", titulo: "Isso foi apenas uma simulação.", notas: "[N] de vocês caíram em menos de um minuto. Ninguém aqui é ingênuo: o golpe funciona porque explora a pressa.", legenda: "O golpe funciona porque explora a pressa.", cena3d: true, aoVivo: true },
  { id: "24-milhoes", inicio: "1:15", titulo: "24 milhões", notas: "24 milhões de brasileiros caíram em golpe de Pix ou boleto em um ano.", legenda: "de brasileiros caíram em golpe de Pix ou boleto em um ano" },
  { id: "med", inicio: "1:35", titulo: "9,3%", notas: "Do dinheiro contestado no MED em 2025, só 9,3% voltou. Depois do Pix, quase nada volta.", legenda: "do dinheiro contestado no MED em 2025 voltou" },
  { id: "solucao", inicio: "1:50", titulo: "Antes de pagar, pergunte ao Guardião.", notas: "Por isso criamos o Guardião.", cena3d: true },
  { id: "demo", inicio: "2:05", titulo: "Demo ao vivo", notas: "Dona Cida à esquerda, Ana à direita. 1) A mensagem chegou. 2) Compartilhar → Guardião. 3) Vermelho em segundos. 4) O celular da filha recebe o alerta, antes do Pix. 5) Liguei, era golpe. 6) Pix da loja: qual nome conferir. Se travar: V toca o vídeo.", aoVivo: true },
  { id: "motor", inicio: "3:15", titulo: "Como funciona", notas: "Regras e IA rodam juntas. Se a IA falhar, a resposta nunca é 'pode pagar'.", passos: 3 },
  { id: "diferenciais", inicio: "3:40", titulo: "O que só o Guardião junta", notas: "Detectar golpe outras ferramentas já fazem. Nenhuma junta família antes do Pix, palavra-senha e treino.", passos: 2 },
  { id: "resultados", inicio: "4:10", titulo: "Golpes detectados", notas: "Testamos com [Y] mensagens de golpe e [Z] legítimas." },
  { id: "fechamento", inicio: "4:30", titulo: "Golpe não se recupera. Se previne.", notas: "Antes de pagar, pergunte ao Guardião. Obrigado.", legenda: "Antes de pagar, pergunte ao Guardião.", cena3d: true },
];

export const DURACAO_S = 5 * 60;
