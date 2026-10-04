# 0001 — Chamada ao LLM: modelo, temperatura e ferramenta

Data: 2026-10-04 (D2)

O doc do motor pede temperatura 0, até 800 tokens de saída e resposta por ferramenta forçada.
Nos modelos atuais da Anthropic (Opus 5.5, Sonnet 5.5) isso não é aceito: `temperature` e
`tool_choice` forçado são recusados com erro 400, e o raciocínio fica sempre ligado.

Decisão:

- O modelo vem de `LLM_MODEL` (padrão `claude-opus-5-5`).
- A ferramenta `registrar_analise` usa `strict: true` com `tool_choice: auto`; o prompt manda
  chamá-la. Se o modelo não chamar, a análise sai como parcial (fail-safe).
- Nos modelos com raciocínio sempre ligado: esforço `low` e teto de 4096 tokens, porque o
  raciocínio entra na conta. No `claude-haiku-4-5` valem temperatura 0 e 800 tokens, como no doc.
- Recusa por classificador de segurança usa o fallback do servidor (`fallbacks: "default"`).
- Os limites de tamanho (título 60, ação 200) são aplicados cortando o texto antes do schema Zod,
  em vez de descartar a análise inteira.

Em aberto: medir latência e acerto com a chave real e escolher entre Opus 5.5 e Haiku 4.5
dentro do timeout de 8 s.

## Produção roda com tsx

A API importa `@guardiao/shared` e `@guardiao/brcode`, que são publicados como fonte TypeScript.
Compilar só a API com `tsc` deixaria esses imports apontando para `.ts`. Por isso `start` usa
`tsx src/server.ts` e `build` faz `prisma generate` + checagem de tipos.
