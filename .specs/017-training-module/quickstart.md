# Quickstart — Módulo de Treinamentos (Fase 04)

Branch: `feature/training-module` (a partir de `develop`). Última migration base: `0015`; esta leva
adiciona a **`0016_training_module`**.

## Ordem de implementação (Fundação → US1 → US2 → US3 → US4)

1. **Fundação (#28)** — schema `src/shared/db/schema/trainings.ts` (enum + 3 tabelas, molde
   `companies`/`epis`) → reexport em `schema/index.ts` → `npm run db:generate` → editar a migration
   gerada (`0016_training_module.sql`) para incluir GRANT + trigger `set_updated_at` + `pgPolicy` como
   SQL custom (padrão `0007`). Funções puras `computeValidUntil` (D1) e `classifyTrainingStatus` (D2) +
   schemas Zod em `src/shared/domains/pgr/trainings.ts`, com testes unit primeiro (TDD).
2. **US1 (#29)** — `repositories/training-catalog.ts` (+ `countDependents`), `actions/pgr/
training-catalog.ts`, REST `app/api/v1/training-catalog/**`, telas `(protected)/training-catalog/**`,
   docs + Postman.
3. **US2 (#30)** — `repositories/training-records.ts`, `actions/pgr/training-records.ts` (`valid_until`
   via D1 no servidor), REST, entrada natural em `employees/[id]`, docs + Postman.
4. **US3 (#31)** — `repositories/training-compliance.ts` (helper D5 + vencimento + resumo), leitura em
   Server Component/action, UI de vencimento com filtro de janela.
5. **US4 (#80)** — `repositories/job-role-required-trainings.ts` + conformidade (reusa D5+D2),
   `actions/pgr/job-role-required-trainings.ts`, REST, aba "Treinamentos Obrigatórios" em `employees/
[id]`, relatório de não-conformes, docs + Postman.

## Migration

```bash
npm run db:generate        # emite a migration a partir do schema
# editar 0016_training_module.sql: GRANT + trigger set_updated_at + CREATE POLICY (SQL custom)
npm run db:migrate         # aplica via DATABASE_URL_UNPOOLED (owner)
```

## Gates de qualidade (a fatia não fecha sem verdes)

```bash
npm run check              # format:check + lint + typecheck + unit
npm run test:integration   # Postgres efêmero (INTEGRATION_DATABASE_URL[/_ADMIN])
```

## Verificações-chave por história

- **Fundação**: `computeValidUntil` (5 periodicidades + `single→null`); `classifyTrainingStatus`
  (`missing/expired/due_soon/ok` + `single`=ok + fronteiras hoje/hoje+30/hoje+90); RLS/isolamento,
  FKs, CHECK `workload_hours>0`, UNIQUEs, cascatas (employee/job_role) e RESTRICT (catálogo em uso).
- **US1**: 5 operações; `404` cross-tenant; `409` nome duplicado; `dependents` bloqueia exclusão em uso;
  `FORBIDDEN` para `client`.
- **US2**: grava `valid_until` correto e `single→null`; `completed_at` futuro → `VALIDATION`;
  funcionário/treinamento cross-tenant → erro sem gravar.
- **US3**: lista/resume por status; `single` fora do cômputo; reciclagem move o status (D5); isolamento.
- **US4**: add idempotente/remove; conformidade (`missing` + último-registro); funcionário sem função =
  conforme por vacuidade; isolamento; `FORBIDDEN` para `client`.

## Referências de código (copiar padrão, não código de outros módulos)

- Tabela multi-tenant + RLS: `src/shared/db/schema/companies.ts` · modelo análogo: `schema/epis.ts` +
  `migrations/0007_epi_data_model.sql`.
- CRUD 1:1: `repositories/companies.ts` + `actions/pgr/companies.ts` + `app/api/v1/companies/**`.
- Window function pura: `domains/pgr/stock-movements.ts` (`computeRunningBalance`).
- API surface / docs: `docs/api/api-design.md` + `docs/api/sst-manager.postman_collection.json`.
