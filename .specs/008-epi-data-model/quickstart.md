# Quickstart — Validação do modelo de dados de EPIs

Guia para provar que a fatia funciona. Detalhes de campos/constraints estão em
[data-model.md](./data-model.md) e [contracts/schema-and-migrations.md](./contracts/schema-and-migrations.md).

## Pré-requisitos

- Dependências instaladas (`npm install`).
- Para a integração: um **Postgres efêmero** (ex.: branch do Supabase / Postgres local em
  Docker) com:
  - `INTEGRATION_DATABASE_URL` — conexão **owner** (aplica migration, papel admin).
  - `INTEGRATION_APP_RUNTIME_URL` — conexão como papel `app_runtime` (prova o RLS).
- Para (re)gerar a migration: `DATABASE_URL_UNPOOLED` definido (o `drizzle-kit` exige a var).

## 1. Checagens locais (sem banco)

```bash
npm run lint          # ESLint
npx tsc --noEmit      # tipos (strict)
npm run test          # unit — inclui epi-validation.test.ts
```

**Esperado**: lint e tipos verdes; unit verde (os schemas zod dos enums e de quantidade > 0
passam).

## 2. (Re)gerar a migration — apenas se mudar o schema (ex.: aplicar o delta FR-002a)

```bash
DATABASE_URL_UNPOOLED="postgres://x:x@localhost:5432/x" \
  ./node_modules/.bin/drizzle-kit generate --name epi_data_model
```

Depois, **adicionar à mão** ao SQL gerado os `GRANT … TO app_runtime` e os
`CREATE TRIGGER set_updated_at_<t>` das 6 tabelas (padrão da `0005`). Ver o contrato §2.

## 3. Integração (Postgres efêmero) — prova RLS + constraints

```bash
INTEGRATION_DATABASE_URL="postgres://owner:...@host:5432/db" \
INTEGRATION_APP_RUNTIME_URL="postgres://app_runtime:...@host:5432/db" \
  npm run test:integration
```

**Esperado** (todas as suítes de EPI rodam, não `skip`):

- `epi-migration-shape.test.ts`: 6 tabelas com RLS, policy `app_runtime`, GRANT, trigger,
  `org_id` NOT NULL+indexado, enums corretos, FK → `categories`.
- `epi-constraints.test.ts`: `quantity > 0` e `balance/min_quantity ≥ 0` rejeitam inválidos;
  UNIQUE de estoque/risco/token; ON DELETE RESTRICT/CASCADE; **(novo)** item com `type` ≠ ao da
  categoria é rejeitado (FR-002a).
- `epi-catalog/-stock/-deliveries/-delivery-items/-risk` + `stock-movements` `*-isolation.test.ts`:
  leitura só vê o tenant ativo; escrita cross-tenant é rejeitada pelo WITH CHECK.

## 4. Mapa de aceite (spec → verificação)

| Critério (spec) | Onde se prova |
| --------------- | ------------- |
| SC-001 (6 tabelas, reuso de categories) | migration-shape |
| SC-002 (isolamento 100%) | 6× isolation |
| SC-003 (campos do ePGR) | data-model + constraints |
| SC-004 (quantidade/saldo inválidos rejeitados) | constraints |
| SC-005 (token único global) | constraints |
| SC-006 (regras de exclusão) | constraints |
| SC-007 (suítes + lint + tipos verdes) | passos 1 e 3 |
| FR-002a (tipo item == categoria) | constraints (caso novo) |

> Sem Docker/Postgres no ambiente atual, as suítes de integração ficam em `describe.skip`. Para
> aceite final, rodar o passo 3 contra um Postgres efêmero.
