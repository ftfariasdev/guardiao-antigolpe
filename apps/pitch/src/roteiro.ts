/** Roteiro do pitch (doc "Apresentação programada e roteiro da demo"): ordem, tempo e fala. */
export interface Slide {
  id: string;
  /** Minuto em que o slide entra, no pitch de 3:00. */
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
  { id: "brinde", inicio: "0:00", titulo: "Participe do sorteio desta palestra", notas: "Antes de começar, um recado: tem um sorteio para quem está nesta sala. Escaneiem aí para participar.", aoVivo: true },
  { id: "painel", inicio: "0:25", titulo: "Quantas pessoas caíram?", notas: "Olha quantos já confirmaram. (Aperte R para revelar ao passar para o próximo.)", aoVivo: true },
  { id: "revelacao", inicio: "0:40", titulo: "Isso foi apenas uma simulação.", notas: "[N] de vocês caíram em menos de um minuto. Ninguém aqui é ingênuo: o golpe funciona porque explora a pressa.", legenda: "O golpe funciona porque explora a pressa.", cena3d: true, aoVivo: true },
  { id: "24-milhoes", inicio: "0:50", titulo: "24 milhões", notas: "24 milhões de brasileiros caíram em golpe de Pix ou boleto em um ano. (Fonte: Fórum Brasileiro de Segurança Pública e Datafolha, julho de 2024 a junho de 2025.)", legenda: "de brasileiros caíram em golpe de Pix ou boleto em um ano" },
  { id: "med", inicio: "1:05", titulo: "9,3%", notas: "Do dinheiro contestado no MED em 2025, só 9,3% voltou. Depois do Pix, quase nada volta. (Fonte: Banco Central, apresentação do MED 2.0: em 2025 foram recuperados em média 9,3% do valor contestado.)", legenda: "do dinheiro contestado no MED em 2025 voltou" },
  { id: "solucao", inicio: "1:15", titulo: "Antes de pagar, pergunte ao Guardião.", notas: "Por isso criamos o Guardião.", cena3d: true },
  { id: "demo", inicio: "1:25", titulo: "Demo ao vivo", notas: "Dona Cida à esquerda, Ana à direita. 1) A mensagem chegou. 2) Compartilhar → Guardião. 3) Vermelho em segundos. 4) O celular da filha recebe o alerta, antes do Pix. 5) Liguei, era golpe. 6) Pix da loja: qual nome conferir. Se travar: V toca o vídeo.", aoVivo: true },
  { id: "diferenciais", inicio: "2:10", titulo: "O que só o Guardião junta", notas: "Detectar golpe outras ferramentas já fazem. Nenhuma junta família antes do Pix, palavra-senha e treino.", passos: 2 },
  { id: "resultados", inicio: "2:30", titulo: "Golpes barrados", notas: "Testamos com 36 mensagens de golpe e 24 legítimas. Só as regras, antes da IA, barraram 28 golpes e nenhuma mensagem legítima. Os outros 8 saem com aviso de cuidado." },
  { id: "fechamento", inicio: "2:45", titulo: "Golpe não se recupera. Se previne.", notas: "Antes de pagar, pergunte ao Guardião. Obrigado.", legenda: "Antes de pagar, pergunte ao Guardião.", cena3d: true },
];

export const DURACAO_S = 3 * 60;
