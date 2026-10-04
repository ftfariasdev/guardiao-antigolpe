# Guardião Antigolpe

> Antes de pagar, pergunte ao Guardião.

PWA que analisa mensagens suspeitas e avisa a família antes do Pix.

## Começar

```bash
pnpm install
cp .env.example .env
pnpm db:up
pnpm --filter @guardiao/api db:generate
pnpm --filter @guardiao/api db:migrate
pnpm dev
```

- App: http://localhost:5173
- API: http://localhost:3000/api/v1/saude
- Pitch: http://localhost:5174

## Produção

- App: https://guardiao-antigolpe.vercel.app
- API: https://api-production-c752.up.railway.app/api/v1/saude
- Pitch: https://guardiao-pitch.vercel.app

Cada push na `main` publica na Vercel (app e pitch) e no Railway (API); as migrações rodam no pré-deploy da API.

Contexto completo, regras e links da documentação em [CLAUDE.md](./CLAUDE.md).
