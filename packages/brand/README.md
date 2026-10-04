# brand/ — identidade do Guardião Antigolpe

Paleta **Escudo**, logo **Escudo-balão**, fontes **Atkinson Hyperlegible** (app) e **Sora** (títulos e pitch).
Os textos do logo já estão convertidos em curvas: os SVGs não dependem de fonte instalada.

| Arquivo | Uso |
| --- | --- |
| `logo-claro.svg` / `.png` | Logo sobre fundo claro (app, README, documentos) |
| `logo-escuro.svg` / `.png` | Logo sobre fundo escuro (pitch e apresentação) |
| `simbolo.svg` | Só o símbolo, colorido |
| `simbolo-branco.svg` | Símbolo branco para fundos coloridos |
| `app-icon.svg` | Fonte vetorial do ícone do app |
| `icon-192.png`, `icon-512.png` | Ícones da PWA (`purpose: any`) |
| `icon-maskable-512.png` | Ícone adaptável do Android (`purpose: maskable`) |
| `apple-touch-icon.png` | Ícone do iPhone (180 px) |
| `favicon.svg`, `favicon.ico` | Aba do navegador |
| `tokens.css` | Variáveis CSS; modo pitch com `data-theme="pitch"`; acessibilidade com `data-texto`, `data-contraste`, `data-espaco` e `data-movimento` |
| `tokens.ts` | Os mesmos tokens em TS, mais a geometria do símbolo para o 3D |
| `manifest.webmanifest` | Manifesto da PWA com ícones e Web Share Target |

## Onde colocar no monorepo

Sugestão: `packages/brand/` com estes arquivos; o `apps/web` e o `apps/pitch` importam daqui.
Os ícones e o manifesto vão para a pasta pública do app (ex.: `public/brand/`).

```html
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/brand/favicon.ico" sizes="48x48">
<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">
<meta name="theme-color" content="#2D5BE3">
```

## Regras rápidas

- Verde, âmbar e vermelho são do semáforo: nunca na marca.
- Ciano só sobre fundo escuro.
- Semáforo sempre com ícone e palavra, nunca só cor.
- Não usar o losango do Pix nem logos de bancos.
- No 3D: extrude `simbolo.escudo` (de `tokens.ts`) com `THREE.ExtrudeGeometry` via `SVGLoader`; o terceiro ponto pulsa durante a análise.

Fontes: Atkinson Hyperlegible, Sora e JetBrains Mono, todas sob SIL Open Font License (Google Fonts).
