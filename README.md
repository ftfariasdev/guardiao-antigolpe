# Guardião Antigolpe

> Antes de pagar, pergunte ao Guardião.

PWA que analisa mensagens suspeitas e avisa a família antes do Pix.

## Começar

```bash
pnpm install
cp .env.example .env
pnpm db:up                      # Postgres na porta 5433
pnpm --filter @guardiao/api db:generate
pnpm --filter @guardiao/api db:migrate
pnpm dev
```

- App: http://localhost:5173
- API: http://localhost:3000/api/v1/saude
- Pitch: http://localhost:5174

## Motor de análise

```bash
pnpm test                   # inclui um teste por regra do motor
pnpm avaliar --so-regras    # mede os 30 casos só com as regras
pnpm avaliar                # motor completo; precisa de ANTHROPIC_API_KEY no .env
pnpm carga                  # 300 conexões no golpe simulado do pitch; precisa de ADMIN_TOKEN
```

Detalhes em [avaliacao/README.md](./avaliacao/README.md).

## Pitch

A apresentação (`apps/pitch`) roda no notebook do palco e nunca vai para a internet.

```bash
cp apps/pitch/.env.example apps/pitch/.env.local   # API, app e o ADMIN_TOKEN da API
pnpm --filter @guardiao/pitch dev                  # http://localhost:5174
```

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

- A plateia entra pelo QR do slide 1 ou digitando `<endereço do app>/#pitch`.
- Com `DEMO_MODE=true` na API, as duas mensagens do roteiro respondem pelo cache, sem depender do LLM.
- `http://localhost:5174/?imprimir` mostra os 11 slides em sequência para "Imprimir como PDF".
- A origem `http://localhost:5174` precisa estar em `CORS_ORIGINS` da API que o pitch usa.

## Produção

- App: https://guardiao-antigolpe.vercel.app
- API: https://api-production-c752.up.railway.app/api/v1/saude
- Pitch: https://guardiao-pitch.vercel.app

Cada push na `main` publica na Vercel (app e pitch) e no Railway (API); as migrações rodam no pré-deploy da API.

Contexto completo, regras e links da documentação em [CLAUDE.md](./CLAUDE.md).
