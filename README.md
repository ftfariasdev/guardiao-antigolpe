<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="packages/brand/logo-escuro.svg">
    <img src="packages/brand/logo-claro.svg" alt="Guardião Antigolpe" width="360">
  </picture>
</p>

<p align="center"><strong>Antes de pagar, pergunte ao Guardião.</strong></p>

<p align="center">
  <a href="https://github.com/ftfariasdev/guardiao-antigolpe/actions/workflows/ci.yml"><img src="https://github.com/ftfariasdev/guardiao-antigolpe/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
</p>

<p align="center">
  <a href="https://guardiao-antigolpe.vercel.app">App</a> ·
  <a href="https://guardiao-pitch.vercel.app">Pitch</a> ·
  <a href="https://api-production-c752.up.railway.app/api/v1/saude">API</a>
</p>

---

O Guardião Antigolpe é um PWA que analisa mensagens suspeitas e avisa um familiar **antes** do pagamento. Foi pensado para pessoas idosas: texto grande, linguagem simples e uma ação por tela.

É o MVP do pitch da Semana da Tecnologia, desenvolvido por uma pessoa só.

## Como funciona

1. **A pessoa protegida** cola a mensagem, o link ou o Pix copia e cola, ou lê um QR com a câmera.
2. **O motor** aplica regras fixas e consulta um LLM. O risco final é sempre o maior dos dois.
3. **O resultado** aparece como semáforo, com ícone e palavra, e explica o que levantou a suspeita.
4. **O guardião** recebe o alerta em tempo real e responde. Sem resposta em 5 minutos, o alerta vai para o próximo guardião.

Além da análise, o app tem palavra-senha da família, convite por QR, treino com golpes simulados e o fluxo "Já paguei".

### Garantias do projeto

| Garantia | O que significa |
| --- | --- |
| Fail-safe | Erro, timeout ou resposta inválida do LLM resulta em no mínimo amarelo, nunca verde |
| Nunca manda pagar | O desbloqueio vem do guardião, não do app |
| Privacidade | CPF, cartão, telefone e e-mail são mascarados antes do LLM; a mídia original não é gravada em disco |
| Segredos | Tokens de sessão e convite guardados só como SHA-256; palavra-senha com argon2id |
| Acessibilidade | WCAG 2.1 AA: texto do protegido ≥ 20 px, alvos de toque ≥ 48 px, resultado anunciado por leitor de tela |

A lista completa de regras e convenções está no [CLAUDE.md](./CLAUDE.md).

## Estrutura

```text
apps/web        PWA (React + Vite): protegido, guardião e simulador do pitch
apps/api        Fastify + Prisma + Socket.IO
apps/pitch      apresentação programada (React + React Three Fiber)
packages/brand  tokens.css / tokens.ts, logos e ícones
packages/shared schemas Zod do contrato da API e tipos dos eventos
packages/brcode parser do Pix copia e cola (BR Code) e CRC16
avaliacao/      casos rotulados do motor (casos.json)
```

## Começar

Requisitos: Node 22.12 ou mais novo, pnpm 9 e Docker.

```bash
pnpm install
cp .env.example .env            # e preencha as chaves
pnpm db:up                      # Postgres no Docker, porta 5433
pnpm --filter @guardiao/api db:generate
pnpm --filter @guardiao/api db:migrate
pnpm dev
```

| Serviço | Endereço local |
| --- | --- |
| App | http://localhost:5173 |
| API | http://localhost:3000/api/v1/saude |
| Pitch | http://localhost:5174 |

Sem `ANTHROPIC_API_KEY` o app funciona só com as regras: toda análise sai marcada como parcial e no mínimo amarela.

## Testes e medição

```bash
pnpm test && pnpm typecheck   # os testes da API usam o banco guardiao_teste (precisa do db:up)
pnpm avaliar --so-regras      # mede os 60 casos só com as regras
pnpm avaliar                  # motor completo; precisa de ANTHROPIC_API_KEY no .env
pnpm carga                    # 300 conexões no golpe simulado do pitch; precisa de ADMIN_TOKEN
```

O conjunto de avaliação tem 36 golpes e 24 mensagens legítimas. Só com as regras, 28 dos 36 golpes saem em vermelho e nenhuma legítima sai em vermelho. O motor completo ainda não foi medido contra a API real.

Metas e detalhes em [avaliacao/README.md](./avaliacao/README.md).

## Pitch

A apresentação fica em `apps/pitch` e também está publicada em https://guardiao-pitch.vercel.app.

Para controlar a sessão da plateia (revelar, zerar, preparar a demo), rode local com o token de admin. A versão publicada não leva esse token, porque ele ficaria exposto no navegador.

```bash
cp apps/pitch/.env.example apps/pitch/.env.local   # API, app e o ADMIN_TOKEN da API
pnpm --filter @guardiao/pitch dev                  # http://localhost:5174
```

### Teclas

| Tecla | Ação |
| --- | --- |
| `→`, `Espaço` ou passador | Próximo slide ou próximo passo |
| `←` | Anterior |
| `R` | Revela a simulação em todos os celulares |
| `Z` duas vezes | Zera os contadores |
| `P` | Abre a janela do apresentador (fala, cronômetro, placar, conexão) |
| `D` | Prepara as contas de demonstração do slide 7 |
| `V` | Troca a demo ao vivo pelo vídeo de backup (`apps/pitch/public/video/demo.mp4`) |
| `B` / `F` / `L` | Tela preta / tela cheia / modo leve |

### Bom saber

- **Plateia:** entra pelo QR do slide 1 ou digitando `<endereço do app>/#pitch`.
- **Demo sem LLM:** com `DEMO_MODE=true` na API, as duas mensagens do roteiro respondem pelo cache.
- **Cenas 3D:** os slides 3, 6 e 11 têm o escudo em 3D. `L` troca pelo escudo 2D; sem WebGL isso acontece sozinho.
- **Atalhos de URL:** `?slide=7` abre direto num slide; `?slide=3&quadro=0.5` congela a cena 3D num ponto da animação.
- **CORS:** a origem do pitch precisa estar em `CORS_ORIGINS` da API que ele usa.

### PDF dos slides

`http://localhost:5174/?imprimir` mostra os 11 slides em sequência para "Imprimir como PDF". Pelo terminal, com o pitch rodando:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-pdf-header-footer --print-to-pdf=apps/pitch/pdf/guardiao-pitch.pdf "http://localhost:5174/?imprimir"
```

## Produção

| Serviço | Onde | Endereço |
| --- | --- | --- |
| App | Vercel | https://guardiao-antigolpe.vercel.app |
| Pitch | Vercel | https://guardiao-pitch.vercel.app |
| API | Railway | https://api-production-c752.up.railway.app/api/v1/saude |

Cada push na `main` publica os três. As migrações rodam no pré-deploy da API.

## Documentação

- [CLAUDE.md](./CLAUDE.md): contexto, regras que não podem ser quebradas, convenções e plano.
- [avaliacao/README.md](./avaliacao/README.md): casos rotulados e metas do motor.
- [docs/adr/0001-chamada-ao-llm.md](./docs/adr/0001-chamada-ao-llm.md): decisão sobre a chamada ao LLM.
- [packages/brand/README.md](./packages/brand/README.md): logos, ícones e tokens da marca.
