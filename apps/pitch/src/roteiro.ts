/** Roteiro do pitch (doc "Apresentação programada e roteiro da demo"). */
export interface Slide {
  id: string;
  inicio: string;
  titulo: string;
  notas: string;
  cena3d?: boolean;
  aoVivo?: boolean;
}

export const roteiro: Slide[] = [
  { id: "brinde", inicio: "0:00", titulo: "Os 10 primeiros a confirmar ganham um fone Bluetooth", notas: "Antes de começar, um recado: os 10 primeiros que confirmarem ganham um fone. Escaneiem aí.", aoVivo: true },
  { id: "painel", inicio: "0:40", titulo: "Quantas pessoas caíram?", notas: "Olha quantos já confirmaram.", aoVivo: true },
  { id: "revelacao", inicio: "1:00", titulo: "Isso foi apenas uma simulação.", notas: "[N] de vocês caíram em menos de um minuto. O golpe funciona porque explora a pressa.", cena3d: true, aoVivo: true },
  { id: "24-milhoes", inicio: "1:15", titulo: "24 milhões", notas: "24 milhões de brasileiros caíram em golpe de Pix ou boleto em um ano." },
  { id: "med", inicio: "1:35", titulo: "9,3%", notas: "Do dinheiro contestado no MED em 2025, só 9,3% voltou." },
  { id: "solucao", inicio: "1:50", titulo: "Antes de pagar, pergunte ao Guardião.", notas: "Por isso criamos o Guardião.", cena3d: true },
  { id: "demo", inicio: "2:05", titulo: "Demo ao vivo", notas: "Dona Cida à esquerda, Ana à direita. Isso é o app funcionando, não um vídeo.", aoVivo: true },
  { id: "motor", inicio: "3:15", titulo: "Como funciona", notas: "Regras e IA rodam juntas. Se a IA falhar, a resposta nunca é 'pode pagar'." },
  { id: "diferenciais", inicio: "3:40", titulo: "Família antes do Pix · Palavra-senha · Treino", notas: "Nenhuma ferramenta junta os três." },
  { id: "resultados", inicio: "4:10", titulo: "[X] de [Y] golpes detectados", notas: "Testamos com [Y] mensagens de golpe e [Z] legítimas." },
  { id: "fechamento", inicio: "4:30", titulo: "Golpe não se recupera. Se previne.", notas: "Antes de pagar, pergunte ao Guardião. Obrigado.", cena3d: true },
];
