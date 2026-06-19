# Quickstart — Cadastros base do PGR

Como gerar/aplicar a migration `0005_*` e rodar os testes desta fatia. Pré-requisitos:
schema `0000`–`0004` aplicado; `.env.local` com `DATABASE_URL_UNPOOLED` (owner) para o
drizzle-kit e, para integração, `INTEGRATION_DATABASE_URL` (admin) +
`INTEGRATION_APP_RUNTIME_URL` (papel `app_runtime`).

## 1. Declarar os schemas

Crie um arquivo por tabela em `src/shared/db/schema/` (`work-units.ts`, `ges.ts`,
`job-roles.ts`, `categories.ts`, `employees.ts`, `ges-job-roles.ts`), os 4 `pgEnum`, e
estenda `companies.ts` — seguindo `contracts/schema-and-migrations.md` e `data-model.md`.
Re-exporte tudo no `index.ts`. Use `companies.ts`/`tenant-probe.ts` como referência do
padrão de RLS (`pgPolicy` + `.enableRLS()`).

## 2. Gerar a migration

```bash
npx drizzle-kit generate          # produz src/shared/db/migrations/0005_*.sql + meta
```

Revise o SQL gerado e **anexe** (cada bloco com `--> statement-breakpoint`):

- `GRANT SELECT, INSERT, UPDATE, DELETE ON public.<t> TO app_runtime;` para as 6 tabelas.
- `CREATE TRIGGER set_updated_at_<t> … EXECUTE FUNCTION public.set_updated_at();` para as 6
  tabelas + `companies` (a função já existe desde `0001`).

Confira a ordem dos statements (enums → ALTER companies → tabelas por dependência de FK →
índices/constraints → policies → GRANTs → triggers).

> Se `companies` tiver alguma linha com `razao_social` nula no ambiente alvo, normalize-a
> **antes** do `SET NOT NULL` (a tabela está praticamente vazia hoje).

## 3. Aplicar

```bash
npx drizzle-kit migrate           # aplica via DATABASE_URL_UNPOOLED (owner)
```

## 4. Testes

```bash
npm run test                      # unit: validação zod + agregação do nº de expostos (mock)
npm run test:integration          # integração: RLS, FK, ON DELETE, UNIQUE, agregação (Postgres efêmero)
npm run lint && npm run typecheck
```

Integração (replica `companies-isolation.test.ts`, via `_helpers/db`):

- **Isolamento por tabela** (1 arquivo por tabela nova + reuso de `companies`): tenant A só
  vê A; B só vê B; query bare sem tenant → 0 linhas; tenant inexistente → 0 linhas; escrita
  cross-tenant (`org_id ≠ ativo`) rejeitada; escopo não vaza após a transação.
- **Integridade**: `UNIQUE(org_id, cpf)` bloqueia CPF duplicado na mesma org e permite em
  orgs distintas; mesmo CNPJ em orgs distintas coexiste; FK inválida na cadeia rejeitada;
  `worker_count <= 0` e `risk_grade` fora de 1..4 rejeitados; valor de enum inválido
  rejeitado; apagar `companies` cascateia `work_units`/`ges`/`ges_job_roles`/`employees`;
  apagar `ges`/`job_roles` faz `SET NULL` nos campos de `employees`.
- **Nº de expostos**: GES sem associação → 0; com associações → `SUM(worker_count)`; reflete
  add/update/delete; soma só do tenant ativo.

Exemplo (padrão `withOrgTx` do harness):

```ts
const rows = await withOrgTx(runtime, "org_a", (tx) =>
  tx`select org_id from public.work_units`);          // só linhas de org_a
expect(rows.every((r) => r.org_id === "org_a")).toBe(true);

await expect(
  withOrgTx(runtime, "org_a", (tx) =>
    tx`insert into public.employees (org_id, company_id, full_name, cpf)
       values ('org_b', '<company_b>', 'X', '000')`),
).rejects.toThrow();                                  // WITH CHECK cross-tenant
```

## 5. Definição de pronto

`npm run test`, `npm run test:integration`, `npm run lint` e `npm run typecheck` verdes —
incluindo o caminho crítico de isolamento e a integridade da cadeia em **Postgres efêmero**
(nunca SQLite). Casos críticos multi-tenant escritos/validados à mão.
