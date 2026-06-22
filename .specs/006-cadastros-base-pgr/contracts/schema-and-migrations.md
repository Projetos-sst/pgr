# Contrato — Schema Drizzle + Migration `0005_*` (cadastros base do PGR)

Define as mudanças de schema e a migration desta fatia. Drizzle é dono code-first; a
migration `0005_*` é **gerada** por `drizzle-kit generate` e os **GRANTs** + **triggers
`set_updated_at`** adicionados como SQL custom (padrão `0003`/`0001`). Nada é alterado fora
de migration (Princípio I/V).

## 1. Enums (`pgEnum`) — `src/shared/db/schema/`

```ts
export const categoryType = pgEnum("category_type", ["epi", "machine"]);
export const employeeSex = pgEnum("employee_sex", ["male", "female", "not_informed"]);
export const maritalStatus = pgEnum("marital_status", [
  "single",
  "married",
  "divorced",
  "widowed",
  "stable_union",
]);
export const employeeStatus = pgEnum("employee_status", [
  "active",
  "on_leave",
  "dismissed",
]);
```

## 2. Padrão replicado por tabela nova

Toda tabela nova declara, via `pgTable` + `pgPolicy`, o mesmo padrão de `companies`:

```ts
const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

export const <entity> = pgTable(
  "<table>",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    // … colunas de domínio (ver data-model.md) …
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_<table>_org_id").on(table.orgId),
    // … índices de FK + UNIQUE + CHECK específicos …
    pgPolicy("<table>_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();

export type <Entity> = InferSelectModel<typeof <entity>>;
export type New<Entity> = InferInsertModel<typeof <entity>>;
```

Constraints específicas por tabela (Drizzle):

- **`companies`** (ALTER): `razaoSocial` passa a `.notNull()`; `+nomeFantasia/phone/email/
cnae/mainActivity`; `riskGrade smallint` + `check("companies_risk_grade_check", sql\`risk_grade between 1 and 4\`)`;
`+logoPath`; colunas de endereço; `updatedAt`. Mantém `uq_companies_org_id_cnpj` e a
  policy/GRANT existentes.
- **`work_units`**: `companyId uuid notNull references(companies, onDelete:"cascade")` +
  `index("idx_work_units_company_id")`; `name*`, `description*`, `contract_number`, endereço.
- **`ges`**: `companyId*` (cascade) + `workUnitId*` (cascade) + índices; `name*`; campos de
  ambiente; `ceilingHeight numeric`.
- **`job_roles`**: `companyId*` (cascade) + índice; `title*`, `cbo`, `workSchedule`,
  `description`; `uniqueIndex("uq_job_roles_org_company_title").on(orgId, companyId, title)`.
- **`categories`**: `type: categoryType("type").notNull()`; `name*`, `note`;
  `uniqueIndex("uq_categories_org_type_name").on(orgId, type, name)`.
- **`employees`**: `companyId*` (cascade) + índice; `gesId` (`references(ges, onDelete:"set null")`) +
  índice; `jobRoleId` (`set null`) + índice; `fullName*`, `cpf*`; `sex/maritalStatus/status`
  (enums; `status` default `'active'`); demais campos + endereço + `photoPath`;
  `uniqueIndex("uq_employees_org_cpf").on(orgId, cpf)`.
- **`ges_job_roles`**: `gesId*` (cascade) + `jobRoleId*` (cascade) + índices;
  `workerCount integer notNull` + `check("ges_job_roles_worker_count_check", sql\`worker_count > 0\`)`;
`workSchedule`; `uniqueIndex("uq_ges_job_roles_org_ges_role").on(orgId, gesId, jobRoleId)`.

`src/shared/db/schema/index.ts` re-exporta as 6 tabelas novas (+ tipos) e os enums.

## 3. SQL custom adicionado à migration gerada

`drizzle-kit` **não** gera GRANT nem trigger. Após o `drizzle-kit generate`, anexar ao
`0005_*.sql` (cada bloco separado por `--> statement-breakpoint`):

```sql
-- GRANTs (um por tabela nova)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_units    TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ges           TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_roles     TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories    TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees     TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ges_job_roles TO app_runtime;

-- Triggers set_updated_at (função já criada em 0001) — um por tabela nova + companies
DROP TRIGGER IF EXISTS set_updated_at_companies ON public.companies;
CREATE TRIGGER set_updated_at_companies BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- … idem para work_units, ges, job_roles, categories, employees, ges_job_roles
```

> `companies` ganha `updated_at` no ALTER gerado pelo Drizzle; o trigger é custom (o
> `companies` da `004`/`005` não tinha `updated_at`).

## 4. Ordem dos statements na migration

1. `CREATE TYPE` dos 4 enums.
2. `ALTER TABLE companies` (add colunas, `SET NOT NULL razao_social`, add `updated_at`,
   `CHECK risk_grade`).
3. `CREATE TABLE` em ordem de dependência de FK: `work_units` → `ges` → `job_roles` →
   `categories` → `employees` → `ges_job_roles`.
4. Índices, `UNIQUE`, `CHECK`.
5. `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY <t>_isolation` (gerados pelo Drizzle).
6. GRANTs custom.
7. Triggers `set_updated_at` custom.

Aplicação via conexão **direta/unpooled** como **owner** (`DATABASE_URL_UNPOOLED`).

## 5. Critérios de aceite

- [ ] `drizzle-kit generate` produz `0005_*` cobrindo enums, ALTER `companies` e as 6
      tabelas; GRANTs e triggers adicionados como SQL custom.
- [ ] Migration aplica em ambiente limpo (com `0000`–`0004`) **sem erro** nem passo manual
      além do GRANT/trigger custom documentado.
- [ ] Cada tabela nova tem: `org_id text NOT NULL → orgs.id`, `idx_<t>_org_id`, RLS
      habilitado, policy `<t>_isolation` `TO app_runtime`, GRANT, `updated_at` + trigger.
- [ ] Enums `category_type`/`employee_sex`/`marital_status`/`employee_status` criados;
      insert com valor fora do conjunto → rejeitado.
- [ ] `CHECK risk_grade between 1 and 4` e `CHECK worker_count > 0` rejeitam valores fora.
- [ ] `UNIQUE(org_id, cpf)`, `UNIQUE(org_id, ges_id, job_role_id)`,
      `UNIQUE(org_id, company_id, title)`, `UNIQUE(org_id, type, name)` ativos.
- [ ] FKs com `ON DELETE` conforme data-model (`CASCADE` na cadeia da empresa; `SET NULL`
      em `employees → ges/job_roles`).
- [ ] `companies.razao_social` é `NOT NULL`.
