# Revisão de véspera

Feita em 12/10/2026 na branch `revisao-vespera` (tag `pre-revisao` no ponto de partida). Nada foi enviado para a `main` nem alterado em produção.

## 1. Resumo

- **Código:** pronto. Tipos, build, 204 testes e a avaliação passam; a demo do slide 7 deu igual em 5 execuções seguidas.
- **Configuração de palco:** não está pronta. O `apps/pitch/.env.local` aponta para `localhost`, então o QR do slide 1 levaria a plateia a `localhost:5173`. Precisa das URLs e do `ADMIN_TOKEN` de produção.
- **Produção sem `DEMO_MODE`:** a demo funciona, mas mostra "Não consegui conferir tudo" e depende da consulta externa de CNPJ. Recomendo ligar `DEMO_MODE=true` no Railway.
- **Sem plano B de vídeo:** `apps/pitch/public/video/demo.mp4` não existe; a tecla `V` mostra um player vazio.
- **Duas correções aguardam merge:** as duas afetam o palco (seção 3). Elas só valem depois do merge na `main` ou rodando o pitch e o app desta branch.

## 2. O que foi testado

As capturas estão em `.playwright-mcp/vespera/` (pasta local, fora do git).

| Item | Como | Resultado | Evidência |
| --- | --- | --- | --- |
| Install limpo, tipos, build | `pnpm install --frozen-lockfile`, `typecheck`, `build` | Passou | Saída do terminal |
| Testes | `pnpm test` | 204 passaram (API 181, brcode 15, pitch 6, shared 2) | Saída do terminal |
| Avaliação do motor (só regras) | `pnpm avaliar --so-regras` | 36/36 golpes detectados, 28/36 em vermelho, 0/24 alarmes falsos, tipo certo 28/36, C16 em vermelho | Saída do terminal |
| Roteiro da demo pela API, 5 vezes | `.playwright-mcp/demo-api.mjs` | Igual nas 5: vermelho, 1 alerta, resposta "era golpe", Pix amarelo | Saída do script |
| Mesmo roteiro com `DEMO_MODE=true` | API temporária na porta 3100 | Igual nas 5, sem "parcial", Pix com o sinal de cidade diferente | Saída do script |
| Demo do slide 7 no navegador, 5 vezes | Playwright, 1920×1080 | Igual nas 5: vermelho em 0,6 a 2 s, alerta na Ana em até 2,2 s, resposta chega na Cida em 0,2 s, Pix amarelo | `demo-1` a `demo-4` |
| 11 slides, modos normal e leve | Playwright em 1920×1080, 1366×768, 1280×720 e 1024×768 | Sem erro de console, sem corte, sem rolagem, sem texto de exemplo; canvas 3D só nos slides 3, 6 e 11 e ausente no modo leve | `slide-*.png` |
| Abertura com a plateia | 3 celulares simulados pelo link `/#pitch` | Placar 2 de 3 ao vivo, revelação nos 3, zerar com `Z Z` volta a isca | `simulador-*.png` |
| Janela do apresentador | `?apresentador` | Cronômetro 5:00, notas, próximo slide, placar e estado sincronizados | `apresentador.png` |
| Tela preta (`B`), PDF (`?imprimir`) | Playwright e Chrome headless | Tela preta ok; PDF com 11 páginas | `pitch.pdf` |
| Carga do pitch | `pnpm carga` contra a API local | 300/300 conexões, 450/450 eventos, revelação em 300/300 (p95 86 ms) | Saída do terminal |
| Conta, família, convite, análise, alerta, "pode seguir" | Playwright, pela tela | Passou; a tela da protegida mostra "Seu guardião verificou" e não manda pagar | `app-*.png` |
| Responsividade do app | 9 tamanhos (360×640 a 1920×1080, retrato e paisagem) em 16 telas | Sem rolagem horizontal, sem botão fora da tela, alvos ≥ 48 px, texto do protegido ≥ 20 px | `app-*-360.png`, `app-*-1366.png` |
| Texto em 175% com alto contraste, 360 px | Playwright | Sem rolagem horizontal; foco de teclado visível (contorno de 4 px) | `app-*-texto175-360.png` |
| Golpe simulado sem campos | Contagem de `input`, `form` na isca | Zero | Saída do script |
| Fail-safe | Avaliação e demo com chave inválida | Toda análise sai parcial e no mínimo amarela | Saída do terminal |
| Produção | `GET /saude`, CORS, bundles, logs do Railway | `/saude` ok; CORS aceita só os dois sites; sem segredo nos bundles nem no git; logs só com aviso de versão do Prisma | Relatório da auditoria |

**Não testado:** Web Push real, escalonamento por tempo no navegador (só nos testes da API), tela de treino, QR pela câmera, instalação da PWA, zoom de 200% do navegador, leitor de tela, tela cheia (`F`), passador físico, fluidez das cenas 3D, build estático offline, carga contra produção e qualquer fluxo de escrita em produção.

## 3. O que foi corrigido

| Commit | Prioridade | Correção |
| --- | --- | --- |
| `8798fa8` | P1 | A moldura da Ana no slide 7 mostrava "Remover", "Tornar guardião" e o cartão "Crie seu e-mail e senha". Na moldura de demonstração (`?perfil=`) isso não aparece mais. |
| `1d616b7` | P0 | O painel seguia numa sessão antiga depois de um teste de carga ou ensaio em outro navegador: placar em zero e revelação sem chegar em quem entrou pelo link digitado. Agora o painel abre uma sessão nova quando a guardada não é mais a do link curto. |
| (este commit) | P1 | Slides 4 e 5 ganharam a fonte com link, e as notas do apresentador também. Os dois números foram conferidos: 24 milhões (Fórum Brasileiro de Segurança Pública e Datafolha, jul/2024 a jun/2025) e 9,3% (Banco Central, apresentação do MED 2.0). |

## 4. Pendências

| Prioridade | Problema | Recomendação |
| --- | --- | --- |
| P0 | `apps/pitch/.env.local` aponta para `localhost`; o QR sairia errado. O `ADMIN_TOKEN` local é diferente do de produção. | Corrigir: URLs e token de produção no `.env.local` do notebook do palco. Preciso do seu OK (variável de ambiente). |
| P0 | Pitch publicado (`guardiao-pitch.vercel.app`) não tem token: `R` não revela nos celulares e `Z` não zera. | Aceitar: usar o pitch local no palco; o publicado serve só para mostrar os slides. |
| P1 | Produção sem `DEMO_MODE`: a demo mostra "Não consegui conferir tudo" e o Pix depende da consulta externa de CNPJ. | Corrigir: `DEMO_MODE=true` no Railway. Preciso do seu OK. |
| P1 | Sessão do pitch em produção está com 3 acessos e 3 confirmações de teste. | Corrigir: `Z Z` no pitch local com o token, antes de começar. |
| P1 | Sem vídeo de backup. | Corrigir: gravar hoje, depois de ligar o `DEMO_MODE`. |
| P1 | Slide 8 diz "Texto, print, áudio, link, Pix copia e cola ou QR Code", mas print e áudio não existem no app. | Corrigir o texto ou saber responder; é texto de slide, então aguardo sua decisão. |
| P1 | Compartilhar do Android para o app instalado cai em página 404 (`/compartilhar` não existe). | Esconder: tirar o `share_target` do manifesto. Não fiz porque mexe no que o celular instalado registra; a demo usa a conversa simulada. |
| P2 | Limites de login e cadastro (5 por minuto) são compartilhados entre todos, porque a API vê o IP do proxy. | Aceitar para amanhã; não ligar `trustProxy` agora. |
| P2 | O token do convite aparece na URL registrada no log da API. | Corrigir depois do pitch. |
| P2 | Recarregar a tela de convite depois de o convite ser usado mostra "Esta família já tem uma pessoa protegida". | Aceitar. |
| P2 | No notebook (1366 px) o menu do guardião quebra em duas linhas. | Aceitar. |
| P2 | Pitch sem favicon (404 no console). | Aceitar. |
| P2 | O link para digitar (`guardiao-antigolpe.vercel.app/#pitch`) é longo e aparece pequeno. | Aceitar; o QR é o caminho principal. |

## 5. Features extras

Todas foram feitas em 06/10 e nenhuma faz parte do roteiro.

| Feature | Estado | Entra na demo? |
| --- | --- | --- |
| Conta com e-mail e senha, login, "Sair" | Estável no teste local | Não |
| Conta sem família | Estável no teste local | Não |
| Menu de acesso rápido | Estável; já fica oculto nas molduras | Não |
| Trocar papel, remover, sair da família, ordem dos avisos | Estável nos testes da API e do dia 06/10; agora oculto nas molduras | Não |
| Layout para computador | Estável em 1024, 1366 e 1920 px | Só se abrir o app fora das molduras |
| Pitch publicado na Vercel | Mostra os slides; sem controle da plateia | Não usar no palco |
| Isca do sorteio | Estável | Sim, slide 1 |

## 6. O que só você consegue conferir

- Projetor: resolução, proporção (testei até 4:3 simulado) e contraste do slide 1, que é claro.
- Som do alerta e volume no palco.
- QR do slide 1 em celulares reais, incluindo iPhone, à distância da última fila.
- Internet do evento ou hotspot, com o notebook e um celular.
- Ensaio cronometrado, duas vezes, com o passador.
- Pendrive com o PDF dos slides e o vídeo de backup.
- Web Push no seu celular, se for mostrar.

## 7. Amanhã

**Na véspera (hoje), nesta ordem**

1. Dar o OK para o merge de `revisao-vespera` na `main` e esperar o deploy.
2. Ligar `DEMO_MODE=true` no Railway.
3. Ajustar `apps/pitch/.env.local`: `VITE_API_URL` e `VITE_APP_URL` de produção e `VITE_ADMIN_TOKEN` igual ao `ADMIN_TOKEN` do Railway.
4. Gravar o vídeo de backup em `apps/pitch/public/video/demo.mp4`.

**Para subir no notebook do palco**

```bash
git checkout main && git pull
```

```bash
pnpm install
```

```bash
pnpm --filter @guardiao/pitch dev
```

Abra `http://localhost:5174` no Chrome. O app e a API são os de produção; não precisa de banco local.

**Checklist de 10 minutos antes**

1. `https://api-production-c752.up.railway.app/api/v1/saude` responde `ok`.
2. Slide 1: o texto "Ou digite" mostra `guardiao-antigolpe.vercel.app/#pitch`, não `localhost`.
3. Ler o QR com o seu celular e tocar em Confirmar: o slide 2 conta 1.
4. `R` revela no seu celular. Depois `Z Z` e conferir que o placar voltou a zero.
5. Slide 7: `D` prepara as contas; as duas molduras abrem.
6. Rodar a demo uma vez até o Pix. Depois `D` de novo para começar limpo.
7. `P` abre a janela do apresentador; reiniciar o cronômetro.
8. `V` no slide 7 toca o vídeo; `V` de novo volta.
9. `F` para tela cheia; `L` se as cenas 3D engasgarem no projetor.
10. Voltar ao slide 1, notebook na tomada, notificações desligadas.
