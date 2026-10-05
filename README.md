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

## Produção

- App: https://guardiao-antigolpe.vercel.app
- API: https://api-production-c752.up.railway.app/api/v1/saude
- Pitch: https://guardiao-pitch.vercel.app

Cada push na `main` publica na Vercel (app e pitch) e no Railway (API); as migrações rodam no pré-deploy da API.

Contexto completo, regras e links da documentação em [CLAUDE.md](./CLAUDE.md).
