import type { SaidaLLM } from "@guardiao/shared";

/**
 * Exemplos few-shot: um para cada um dos 8 tipos de golpe e dois legítimos.
 * São de um conjunto próprio; nunca copie casos de avaliacao/casos.json para cá,
 * para não inflar a medida de acerto.
 */
export const EXEMPLOS: { mensagem: string; saida: SaidaLLM }[] = [
  {
    mensagem: "Oi vó, sou eu. Meu celular caiu na água e estou usando esse número. Consegue me transferir 650 ainda de manhã? Não comenta com a mãe.",
    saida: {
      risco: "vermelho",
      tipo_golpe: "falso_parente",
      titulo: "Isso parece o golpe do falso parente",
      sinais: [
        { codigo: "troca_numero", trecho: "estou usando esse número", explicacao: "Golpistas dizem que trocaram de número para fingir ser alguém da família." },
        { codigo: "pedido_dinheiro", trecho: "Consegue me transferir 650 ainda de manhã?", explicacao: "Pede dinheiro com pressa, sem dar tempo de conferir." },
        { codigo: "sigilo", trecho: "Não comenta com a mãe", explicacao: "Pede segredo para você não conferir com a família." },
      ],
      acao: "Não transfira. Ligue para o número antigo do seu neto ou pergunte a palavra-senha da família.",
      confianca: 0.95,
    },
  },
  {
    mensagem: "Banco informa: tentativa de acesso indevido na sua conta. Para sua proteção, informe a senha do cartão e o código que enviaremos por SMS ao nosso atendente.",
    saida: {
      risco: "vermelho",
      tipo_golpe: "falsa_central",
      titulo: "Isso parece o golpe da falsa central",
      sinais: [
        { codigo: "falsa_central", trecho: "tentativa de acesso indevido na sua conta", explicacao: "Assusta você com um problema na conta para ganhar sua confiança." },
        { codigo: "pedido_dados", trecho: "informe a senha do cartão e o código", explicacao: "Banco de verdade nunca pede senha nem código." },
      ],
      acao: "Não passe senha nem código. Ligue para o banco pelo número que está no verso do seu cartão.",
      confianca: 0.96,
    },
  },
  {
    mensagem: "Último aviso: seu IPVA está em atraso. Regularize hoje com 70% de abatimento pelo Pix abaixo e evite a apreensão do veículo.",
    saida: {
      risco: "vermelho",
      tipo_golpe: "falso_boleto",
      titulo: "Cobrança suspeita: pode ser boleto falso",
      sinais: [
        { codigo: "desconto_hoje", trecho: "Regularize hoje com 70% de abatimento", explicacao: "Desconto grande que só vale hoje serve para você não conferir." },
        { codigo: "ameaca", trecho: "evite a apreensão do veículo", explicacao: "Ameaça para assustar e apressar você." },
        { codigo: "cobranca_fora_do_canal", trecho: "pelo Pix abaixo", explicacao: "Órgão público não cobra imposto por mensagem com Pix." },
      ],
      acao: "Não pague por esta mensagem. Confira a dívida no site oficial do governo ou peça ajuda ao seu guardião.",
      confianca: 0.92,
    },
  },
  {
    mensagem: "Vaga home office! Receba R$ 180 por tarefa avaliando hotéis. Para ativar sua conta de colaborador, envie a taxa de cadastro de R$ 35.",
    saida: {
      risco: "vermelho",
      tipo_golpe: "falso_emprego",
      titulo: "Isso parece o golpe do falso emprego",
      sinais: [
        { codigo: "ganho_irreal", trecho: "Receba R$ 180 por tarefa avaliando hotéis", explicacao: "Ninguém paga tanto por uma tarefa tão simples." },
        { codigo: "taxa_liberacao", trecho: "envie a taxa de cadastro de R$ 35", explicacao: "Emprego de verdade não cobra para você começar." },
      ],
      acao: "Não envie dinheiro. Emprego de verdade não cobra taxa. Bloqueie o contato.",
      confianca: 0.95,
    },
  },
  {
    mensagem: "Seu cartão foi clonado. Não saia de casa: nosso funcionário passará aí para recolher o cartão. Entregue dentro de um envelope junto com a senha anotada.",
    saida: {
      risco: "vermelho",
      tipo_golpe: "falso_motoboy",
      titulo: "Isso parece o golpe do falso motoboy",
      sinais: [
        { codigo: "portador_cartao", trecho: "nosso funcionário passará aí para recolher o cartão", explicacao: "Banco nenhum manda buscar cartão na sua casa." },
        { codigo: "pedido_dados", trecho: "junto com a senha anotada", explicacao: "Ninguém do banco pede a sua senha." },
      ],
      acao: "Não entregue o cartão a ninguém. Ligue para o banco pelo número do verso do cartão.",
      confianca: 0.97,
    },
  },
  {
    mensagem: "Detectamos um débito pendente no seu CPF. Consulte e evite a negativação: receita-consulta-cpf.top/regularizar",
    saida: {
      risco: "vermelho",
      tipo_golpe: "link_falso",
      titulo: "Esse link parece falso",
      sinais: [
        { codigo: "link_suspeito", trecho: "receita-consulta-cpf.top/regularizar", explicacao: "Esse endereço não é o site oficial do governo." },
        { codigo: "ameaca", trecho: "evite a negativação", explicacao: "Ameaça para você clicar sem pensar." },
      ],
      acao: "Não clique no link. Se quiser conferir, entre no site oficial digitando o endereço você mesma.",
      confianca: 0.93,
    },
  },
  {
    mensagem: "Grupo VIP de cripto: dobre seu dinheiro em 7 dias com lucro certo. Só 10 vagas, entrada a partir de R$ 300.",
    saida: {
      risco: "vermelho",
      tipo_golpe: "falso_investimento",
      titulo: "Isso parece golpe de investimento",
      sinais: [
        { codigo: "ganho_irreal", trecho: "dobre seu dinheiro em 7 dias com lucro certo", explicacao: "Lucro certo e rápido não existe. É isca." },
        { codigo: "pressa", trecho: "Só 10 vagas", explicacao: "Dizem que as vagas estão acabando para você decidir com pressa." },
        { codigo: "pedido_dinheiro", trecho: "entrada a partir de R$ 300", explicacao: "Pedem um depósito para você entrar." },
      ],
      acao: "Não envie dinheiro. Investimento com lucro garantido é golpe. Converse com seu guardião.",
      confianca: 0.94,
    },
  },
  {
    mensagem: "Geladeira frost free nova por R$ 499, estoque acabando. Aceitamos somente Pix antecipado, entrega em 20 dias.",
    saida: {
      risco: "vermelho",
      tipo_golpe: "compra_falsa",
      titulo: "Essa oferta parece compra falsa",
      sinais: [
        { codigo: "preco_irreal", trecho: "Geladeira frost free nova por R$ 499", explicacao: "O preço está muito abaixo do normal." },
        { codigo: "so_pix", trecho: "Aceitamos somente Pix antecipado", explicacao: "Pagando antes por Pix você não consegue o dinheiro de volta." },
      ],
      acao: "Não compre por esta mensagem. Procure a loja pelo site oficial e peça ajuda ao seu guardião.",
      confianca: 0.88,
    },
  },
  {
    mensagem: "Olá, Sra. Cida! Seus exames ficaram prontos. A retirada é no balcão do laboratório, de segunda a sexta, das 7h às 17h.",
    saida: {
      risco: "verde",
      tipo_golpe: "nenhum",
      titulo: "Não encontrei sinais de golpe",
      sinais: [],
      acao: "Pode ficar tranquila. Se depois pedirem dinheiro, senha ou código, mostre para mim de novo.",
      confianca: 0.9,
    },
  },
  {
    mensagem: "Seu boleto de novembro já pode ser consultado no aplicativo. Débito automático programado para o dia 20.",
    saida: {
      risco: "verde",
      tipo_golpe: "nenhum",
      titulo: "Não encontrei sinais de golpe",
      sinais: [],
      acao: "Não precisa fazer nada por esta mensagem. Se quiser conferir, abra o aplicativo que você já usa.",
      confianca: 0.85,
    },
  },
];
