# Issue #38 · Geração de PDF de documento único

**Objetivo:** Server Action dispara geração via `after()` do Next 16; usuário não espera;
feedback quando ficar pronto.

**Depende de:** #37 (cliente PDF) e da decisão de `documents.status` no #33.

## ⚠️ Tradução para o Modelo B

- `features/*` → `src/shared/server/actions/*` + telas em `src/app/(protected)/*`.
- Testes: Postgres efêmero, nunca SQLite.

## O problema central é o feedback, não a geração

`after()` roda pós-resposta — a action retorna "aceito" antes de existir PDF.

1. **Feedback — recomendação: polling** (precedente: polling ~3s da fatia 010 de
   assinaturas) sobre um status `generating|ready|failed`.
   Alternativas descartadas: esperar síncrono (viola Princípio IV); usar a fila `jobs`
   para 1 doc (mata a distinção com o #39).
2. **Onde vive o status:** se a geração produz um novo documento no GED, o próprio
   registro `documents` nasce `generating` e vira `ready` — unifica com o GED e dá o
   download (#35) de graça. Ligar com a decisão de `documents.status` no #33
   (ciclo de vida, não validade).
3. **`after()` + tenant — ponto fácil de errar:** dentro do `after()` não há request
   context garantido. Capturar `orgId`/`userId` **antes** e passar por closure; o
   trabalho interno abre `withOrg(orgId)` explicitamente.
4. **Falha:** try/catch no `after()` marca `failed` + `logTenantEvent`; UI mostra
   "falhou, tentar de novo". Sem retry automático aqui (retry é papel do #39).
5. **Limite da Vercel:** `after()` conta no tempo máximo da função — ok para doc único;
   é o argumento formal de por que lote vai pro cron.

## Testes

- Extrair o "core de geração" (`{orgId, documentId}` → resultado) e testar direto,
  sem depender do `after()`.
- Integração com Gotenberg mockado; isolamento cross-tenant do registro gerado.

## Insumos para o /speckit-specify

- **Branch:** `feature/single-document-pdf` (da issue)
- **User story (P1):** como gestor de SST, quero gerar o PDF de um documento sem travar a tela.
- **Success criteria:** resposta imediata; PDF disponível logo após; falha comunicada e
  re-tentável manualmente.
- **Edge cases:** Gotenberg indisponível; documento sem dados suficientes; usuário
  dispara duas gerações seguidas do mesmo documento (idempotência/lock leve).
