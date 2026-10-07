# Guardião Antigolpe — contexto para o Claude Code

Leia este arquivo antes de qualquer tarefa. As decisões abaixo já foram tomadas na documentação; não as reabra sem que eu peça.

## O que é

PWA que analisa mensagens suspeitas (texto, print, áudio, link, Pix copia e cola, QR) e avisa um familiar guardião **antes** do pagamento. Público principal: pessoas idosas ("Dona Cida"). MVP para o pitch da Semana da Tecnologia, desenvolvido por uma pessoa só.

Slogan: "Antes de pagar, pergunte ao Guardião."

## Documentação (fonte da verdade)

- Escopo, casos de uso e requisitos: https://claude.ai/code/artifact/f65b3cf7-ea23-4a3b-afff-21e5f36c290a
- Identidade visual: https://claude.ai/code/artifact/094d6c55-ff6f-45dc-9ac2-f8522884d015
- Arquitetura técnica (stack, dados, API, eventos): https://claude.ai/code/artifact/354f8e7b-1115-40e1-94cf-a6a051853841
- Regras, prompt e avaliação do motor: https://claude.ai/code/artifact/9be75c73-4a03-46c2-aa41-c15049d81925
- Protótipos de tela: https://claude.ai/artifact/2aCMYm3HGUfyRpQc4BjfiY
- Apresentação programada e roteiro da demo: https://claude.ai/code/artifact/a40eb616-ebb9-4bf9-8873-0591da002ca1

## Estrutura

```text
apps/web        PWA (React + Vite): protegido, guardião, simulador e painel do pitch
apps/api        Fastify + Prisma + Socket.IO
apps/pitch      apresentação programada (React + React Three Fiber)
packages/brand  tokens.css / tokens.ts, logos e ícones
packages/shared schemas Zod do contrato da API e tipos dos eventos
packages/brcode parser do Pix copia e cola (BR Code) e CRC16, testado
avaliacao/      casos rotulados do motor (casos.json)
```

## Comandos

```bash
pnpm install
cp .env.example .env            # e preencha as chaves
pnpm db:up                      # Postgres no Docker (porta 5433)
pnpm --filter @guardiao/api db:generate
pnpm --filter @guardiao/api db:migrate
pnpm dev                        # api :3000, web :5173, pitch :5174
pnpm test && pnpm typecheck     # os testes da API usam o banco guardiao_teste (precisa do db:up)
pnpm avaliar                    # mede o motor nos 60 casos (--so-regras dispensa a chave)
pnpm carga                      # teste de carga do pitch: 300 conexões (precisa de ADMIN_TOKEN)
```

## Regras que nunca podem ser quebradas

1. **Fail-safe:** erro, timeout ou resposta inválida do LLM resulta em no mínimo **amarelo**, nunca verde (`parcial: true`).
2. **Fusão:** o risco final é o maior entre regras e LLM (`maiorRisco` em `@guardiao/shared`).
3. **Nunca mandar pagar.** O app nunca instrui a pagar; o desbloqueio vem do guardião ("Seu guardião verificou").
4. **Privacidade:** mídia original nunca é gravada em disco; CPF, cartão, telefone e e-mail são mascarados antes do LLM; logs sem dados pessoais.
5. **Segredos:** tokens de sessão e convite guardados só como SHA-256; palavra-senha e senha do guardião com argon2id e nunca lidas de volta; chaves de API só na API.
6. **Sinais do LLM** precisam citar um trecho que existe no texto; senão são descartados.
7. **Semáforo** sempre com ícone + palavra, nunca só cor. Verde, âmbar e vermelho nunca aparecem na marca.
8. **Acessibilidade (WCAG 2.1 AA):** texto do protegido ≥ 20 px, alvos de toque ≥ 48 px, rótulos em todo botão, resultado anunciado com `aria-live`, ajustes de texto/contraste/movimento via atributos `data-*` de `tokens.css`.
9. **Golpe simulado do pitch:** nenhum campo que envie dados; só eventos anônimos (`visitante_id` aleatório).

## Conta e acesso

- O guardião tem conta com e-mail e senha (`POST /familias` cria, `POST /sessoes` entra, `DELETE /sessao` sai, `PUT /conta` cria o login de quem entrou por convite). Decisão de 06/10/2026, que substitui o "sem senha" do doc de arquitetura.
- A pessoa protegida continua entrando só por convite, sem senha e sem "Sair".
- O e-mail nunca volta nas respostas da API; o erro de login é sempre o mesmo. Trocar e recuperar senha ficaram fora do MVP.
- Menu de acesso rápido (`componentes/Menu.tsx`) para os dois perfis; as molduras de demonstração do pitch (`?perfil=`) não mostram o menu.

## Convenções

- TypeScript estrito em tudo; validação com Zod; schemas compartilhados em `packages/shared`.
- Nomes de domínio em português: `familias`, `analises`, `alertas`, `treinos`.
- JSON da API em snake_case, como no contrato.
- Pasta da apresentação se chama `pitch`; não usar a palavra "telão" em código ou textos.
- Toda regra do motor tem teste; toda mudança no prompt roda `avaliacao/` no CI.
- Tela do protegido: linguagem simples, sem jargão, uma ação principal por tela.

## Plano

O app está congelado desde o D6: daqui em diante só correções, pitch e ensaio.

- [x] D1: monorepo, tokens, schemas compartilhados, parser do Pix, `/api/v1/saude`, schema do Prisma
- [x] D1: primeira migração, deploy vazio (Vercel + Railway) com `/saude` respondendo
- [ ] D2: motor (normalização, regras, LLM, fusão) + script de avaliação no CI
- [x] D3: telas do protegido (início, análise, resultados) com acessibilidade
- [x] D4: família, convite por QR, alertas em tempo real, push e escalonamento
- [x] D5: Pix + CNPJ, treino, "Já paguei"; medição ampliada; teste de carga com 300 conexões
- [x] D6: congelar funcionalidades; esqueleto do pitch
- [ ] D6: gravar o vídeo de backup da demo em `apps/pitch/public/video/demo.mp4` (só dá para fazer à mão)
- [x] D7: cenas 3D, modo leve, PDF
- [ ] D7: ensaios cronometrados e checklist da véspera (doc da apresentação)
