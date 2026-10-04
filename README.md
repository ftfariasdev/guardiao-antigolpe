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

Contexto completo, regras e links da documentação em [CLAUDE.md](./CLAUDE.md).
