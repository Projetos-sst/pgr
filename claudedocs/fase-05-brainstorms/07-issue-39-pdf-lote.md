# Issue #39 · Geração de PDF em lote (jobs + Vercel Cron)

**Objetivo:** action enfileira em `jobs`; Route Handler de cron processa; retry por
`attempts`; progresso na UI. **A fatia operacionalmente mais arriscada da fase.**

**Depende de:** #33 (`jobs`), #37 (cliente PDF).

## ⚠️ Tradução para o Modelo B

- `lib/jobs.ts` → `src/shared/**`. Testes: Postgres efêmero, nunca SQLite.

## Decisões a cravar

1. **Auth do cron:** `GET /api/cron/[job]` fica **fora** do `restHandler` (não há
   sessão/tenant) — valida `Authorization: Bearer ${CRON_SECRET}` e precisa entrar na
   lista de rotas liberadas do `proxy.ts` (como `/sign/(.*)` na fatia 012).
   **A issue não menciona o proxy — esquecer isso quebra tudo.**
2. **Tenant no processamento — a discussão arquitetural mais delicada:** o cron
   atravessa tenants. Padrão sugerido:
   - (a) _claim_ dos pendentes numa leitura administrativa (bypass documentado;
     precedentes: `caepi-upsert.ts` / policy dedicada de worker);
   - (b) para **cada job**, abrir `withOrg(job.org_id)` — PDF e escritas em `documents`
     100% isoladas por job.
     Merece seção própria no spec.
3. **Concorrência/idempotência:** crons podem sobrepor. Claim atômico:
   `UPDATE jobs SET status='processing', attempts=attempts+1 WHERE id IN (SELECT … WHERE
status='pending' … FOR UPDATE SKIP LOCKED) RETURNING *`
   (precedente de `FOR UPDATE`: stock-movements).
4. **Timebox:** função da Vercel tem limite — processar N jobs por tick (5–10) e
   devolver; o resto fica para o próximo tick.
5. **Retry & stale claim:** `attempts < MAX (3?)` → volta a `pending`; senão `failed`
   com erro em `result`. Job `processing` preso (função morreu) → `locked_at` mais velho
   que X volta a `pending` (coluna prevista no #33).
6. **Progresso na UI:** `batch_id` no lote → "x/y concluídos" por polling (padrão da 010).
7. **⚠️ Risco nº 1 de viabilidade:** limite de Vercel Cron por plano — o plano hobby
   restringe a execuções diárias. **Verificar o plano da conta antes**; pode forçar
   alternativa (trigger manual + cron externo).

## Testes

- Integração chamando o Route Handler de cron com o secret (e sem → 401).
- Claim concorrente (dois ticks simultâneos não processam o mesmo job).
- Retry: falha incrementa `attempts`; estouro vira `failed` com erro registrado.
- Isolamento: jobs de org A nunca escrevem documentos em org B.

## Insumos para o /speckit-specify

- **Branch:** `feature/batch-pdf-generation` (da issue)
- **User stories:** (P1) gerar vários PDFs de uma vez sem travar; (P2) acompanhar progresso.
- **Success criteria:** pedido em lote responde imediato; jobs processados com retry;
  cron protegido por secret.
- **Edge cases:** lote grande; Gotenberg fora do ar; reprocessamento; cron sobreposto.
