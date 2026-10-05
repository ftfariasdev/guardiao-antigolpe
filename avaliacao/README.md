# Avaliação do motor

`casos.json` tem 60 casos (36 golpes, 24 legítimas): os 30 do doc do motor (C01 a C30) e a ampliação do D5 (C31 a C60). O script fica em `apps/api/src/avaliacao/`.

```bash
pnpm avaliar               # motor completo; precisa de ANTHROPIC_API_KEY no .env
pnpm avaliar --so-regras   # só as regras, sem chamar o LLM
```

Imprime uma linha por caso e um resumo, e sai com código 1 se alguma meta não for atingida.

Metas, nas proporções do doc (17/18, 15/18, 14/18 e 1/12): com 60 casos, ≥ 34/36 golpes em amarelo ou
vermelho; ≥ 30/36 em vermelho; ≤ 2/24 legítimas em vermelho; ≥ 28/36 com o tipo certo; C16 (prompt
injection) obrigatoriamente vermelho.

No modo só-regras toda análise sai parcial (nunca verde), então "golpes em vermelho" e "tipo certo"
são medidos mas não cobrados. O CI roda o modo só-regras em todo push e o motor completo quando
o motor ou os casos mudam (workflow `avaliacao.yml`, com o secret `ANTHROPIC_API_KEY`).

Os casos de entrada `imagem` são avaliados pelo texto do print (o que o OCR entregaria); as imagens
em `avaliacao/imagens/` ainda não existem.
