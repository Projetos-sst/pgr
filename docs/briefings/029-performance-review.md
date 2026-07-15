# Briefing — Fatia 029: Revisão de performance (pré-lançamento)

**Issue**: #50 · `[Fase 07] 12 · Revisão de performance`
**Branch**: `feature/029-performance-review` (base: `develop`)
**Data**: 2026-07-15

## Resultado: base sólida; 1 trade-off consciente (cache)

## 1. Índices — ✅ cobertura excelente

Toda tabela tenant tem índice em `org_id` (`idx_<tabela>_org_id`) e nas colunas de FK usadas em join
(`company_id`, `ges_id`, `job_role_id`, `risk_id`, `employee_id`, `training_id`, `catalog_id`,
`delivery_id`, `stock_id`). Índices compostos onde há filtro combinado quente:
`idx_ai_usage_events_org_kind_created`, `idx_signature_requests_org_id_created_at`,
`idx_schedule_events_org_date`.

- **Toda busca frequente começa por `org_id`** (critério do issue) — atendido: `withOrg` fixa o tenant e
  as queries filtram `org_id` explicitamente, com índice correspondente.
- As agregações do dashboard (#47) e pendências (#61) fazem `count`/`group by`/join sobre colunas
  indexadas. Filtros de vencimento (`valid_until < hoje`, `action_deadline < hoje`,
  `balance < min_quantity`) reduzem um conjunto **já pequeno por tenant** — o índice de `org_id` domina.

**Nenhum índice novo adicionado**: acrescentar compostos especulativos viola YAGNI e o próprio issue
pede _medir e ajustar_. Recomenda-se `EXPLAIN ANALYZE` sob dados reais antes de otimizar.

## 2. Queries N+1 — ✅ nenhuma

Varredura dos repositórios: **sem `await` dentro de `.map`/`for`**. O padrão é uma query por operação
(joins e agregações no banco, não em loop de aplicação). Ex.: `getDashboardSummary` roda as contagens em
`Promise.all` (paralelas, uma ida ao banco cada), e as leituras com `exposedWorkers`/histórico usam
`sum()`/window function em vez de laço.

## 3. Cache de leitura — ⚠️ trade-off consciente

**112 arquivos usam `force-dynamic`; zero usa cache do Next** (`cacheTag`/`cacheLife`/`unstable_cache`).
Ou seja: toda leitura vai ao banco. É a escolha **segura** para multi-tenant (impossível servir dado
cacheado de outra organização), ao custo de não reaproveitar leituras quentes.

**Recomendação (follow-up, não-bloqueante para o lançamento):** introduzir cache de leitura **por tag de
organização** nas telas mais pesadas (dashboard, listagens), invalidando por `revalidateTag(orgId)` em
cada escrita do tenant. Exige disciplina de invalidação por tenant — fazer **guiado por medição**, não
antes. Enquanto isso, `force-dynamic` é correto e seguro.

## 4. Critérios de aceite (issue) × estado

| Critério                                           | Estado                                          |
| -------------------------------------------------- | ----------------------------------------------- |
| Índices — `org_id` no início das buscas frequentes | ✅ atendido                                     |
| Identificar/corrigir N+1                           | ✅ nenhuma encontrada                           |
| Estratégia de cache de leituras (tags por org)     | ⚠️ recomendado como follow-up medido            |
| Medir e ajustar telas/queries mais pesadas         | 🔎 requer ambiente com dados reais (pós-deploy) |

## 5. Correções aplicadas

**Nenhuma** — a base já está bem indexada e sem N+1. Otimizações de cache/índice devem ser **guiadas por
medição** (`EXPLAIN ANALYZE` + métricas de produção), conforme o próprio issue. Este PR é o **registro da
revisão** + o plano de otimização orientado a dados.
