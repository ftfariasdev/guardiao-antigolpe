# Perguntas prováveis da banca

Respostas curtas, para falar em até 30 segundos cada. Os números vêm da medição de 12/10/2026 (`pnpm avaliar --so-regras`).

## 1. Privacidade e LGPD: o que vocês guardam das mensagens?

Guardamos o mínimo para a família acompanhar: o resultado, o valor pedido e os sinais, cada um com o trecho curto que o justifica. O texto completo da mensagem não é guardado, e a mídia original nunca é gravada em disco. Antes de qualquer texto ir para a IA, CPF, cartão, telefone e e-mail são mascarados. Os logs não têm dados pessoais, e tokens e senhas ficam só como hash. Quem remove uma pessoa da família apaga junto as análises e os alertas dela.

## 2. Quanto custa a IA? Isso escala?

As regras rodam primeiro, em milissegundos e sem custo por mensagem. Sozinhas elas já barraram 28 dos 36 golpes do nosso conjunto. A IA entra como segunda opinião, uma chamada curta por análise. Ainda não medimos o custo com a chave real, então não tenho um valor por mensagem para afirmar hoje; o desenho permite chamar a IA só nos casos em que as regras ficam em dúvida.

## 3. E o falso positivo? Não vai assustar à toa?

No conjunto de teste, nenhuma das 24 mensagens legítimas saiu em vermelho. Sem a IA, elas saem em amarelo ("confira antes de pagar"), porque a regra do projeto é nunca dizer "pode pagar" quando a análise está incompleta. O custo de um amarelo é uma ligação para a filha; o custo de um verde errado é o dinheiro perdido.

## 4. Por que não é só um chatbot?

Três diferenças. Primeiro, a família: o guardião é avisado em tempo real, antes do Pix, e é ele quem libera. Segundo, o fail-safe: se a IA cair, a resposta é no mínimo amarela, nunca verde. Terceiro, o público: texto grande, uma ação por tela, leitura em voz alta. Um chatbot exige que a pessoa idosa saiba perguntar; aqui ela só compartilha a mensagem.

## 5. Qual é o modelo de negócio?

Para a família, gratuito no básico. As hipóteses que queremos validar são plano familiar com mais guardiões e histórico, e parceria com bancos, operadoras e planos de saúde, que já gastam com fraude contra clientes idosos. Ainda são hipóteses: o MVP foi feito para provar que o aviso antes do Pix funciona.

## 6. Vocês não veem o nome real de quem recebe o Pix. Isso não é um limite?

É, e o app diz isso. O nome dentro do código Pix é escrito por quem gerou o código e pode ser inventado. Por isso conferimos o que dá para conferir antes do pagamento (código alterado, CNPJ novo ou inativo, cidade diferente, pessoa física cobrando por empresa) e terminamos toda análise de Pix dizendo qual nome deve aparecer no app do banco. Ver o nome real exigiria integração com o banco, que é um próximo passo.

## 7. Aguenta muita gente?

O golpe simulado que vocês acabaram de ver foi testado com 300 conexões simultâneas: 300 de 300 conectaram e a revelação chegou em todos em menos de 100 ms. A análise por regras leva poucos milissegundos. O gargalo previsível é a IA, e para ele o fail-safe já existe: com timeout de 8 segundos, a resposta sai amarela em vez de travar.

## 8. Quais são os próximos passos?

Quatro, nesta ordem: medir o motor completo com a IA nos 60 casos; analisar print e áudio, que hoje ainda não entram (o app recebe texto, link, Pix copia e cola e QR Code); piloto com famílias reais para medir quanto tempo o guardião leva para responder; e conversar com um banco sobre a conferência do recebedor.

## Se perguntarem algo que não sei

"Ainda não medi isso, então não vou chutar um número. O que eu medi foi: 28 de 36 golpes barrados só pelas regras e nenhuma mensagem legítima barrada."
