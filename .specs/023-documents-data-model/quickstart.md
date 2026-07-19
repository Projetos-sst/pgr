# Quickstart — Validar a fatia 023 (documents-data-model)

**Pré-requisitos**: deps instaladas (`npm i`); para integração, um Postgres efêmero com
`INTEGRATION_DATABASE_URL` (e opcionalmente `INTEGRATION_DATABASE_URL_ADMIN`) — receita em
`src/__tests__/integration/_helpers/db.ts` (nunca SQLite, nunca o banco de dev).

## 1. Gerar e conferir a migration

```bash
npm run db:generate   # deve emitir src/shared/db/migrations/0025_documents_data_model.sql
```

Conferir no SQL gerado (checklist do contrato §1): 3 enums, 3 tabelas, ENABLE RLS, FKs com os
ON DELETE do data-model, UNIQUE `NULLS NOT DISTINCT` de pastas, UNIQUE de (org, grupo, versão),
índices (incl. o parcial do vínculo polimórfico), 3 policies de isolamento — e **apendar** o SQL
custom (GRANTs + triggers `set_updated_at`, padrão `0023_schedule_events.sql`).

## 2. Rodar os testes

```bash
npm run test                                     # unit — classifyDocumentValidity + zod
npm run test:integration                         # migration aplicada + RLS + constraints + claim
npx jest --selectProjects integration -t "claim" # só a suíte de concorrência da fila
```

O harness de integração aplica as migrations automaticamente (split por
`--> statement-breakpoint`); não é preciso aplicar manualmente.

## 3. Quality gates (antes de concluir)

```bash
npm run check   # format:check + lint + typecheck + unit
```

## 4. O que provar (mapa teste → critério)

| Suíte                                               | Prova                                                                                                |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `unit/domains/documents/validity.test.ts`           | SC-004 — validade derivada por função pura (datas fixas, fuso SP)                                    |
| `integration/shared/db/documents-isolation.test.ts` | SC-001 — RLS/isolamento das 3 tabelas (leitura sem GUC → vazio; escrita cross-tenant → rejeitada)    |
| `integration/shared/db/folders-model.test.ts`       | SC-002 — hierarquia com raiz; irmã duplicada (incl. raiz) rejeitada; RESTRICT de pasta não-vazia     |
| `integration/shared/db/documents-model.test.ts`     | FR-003/005 — UNIQUE (org, grupo, versão); CHECK do vínculo completo-ou-vazio; CHECKs de version/size |
| `integration/shared/db/jobs-claim.test.ts`          | SC-003 — claim concorrente obtém 1×; stale claim retorna à fila; attempts incrementa                 |

## 5. Aplicar no banco de dev (opcional, após revisão)

```bash
npm run db:migrate   # usa DATABASE_URL_UNPOOLED (conexão owner)
```
