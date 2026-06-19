# Contrato — Modelo de tenant e migrations (schema + RLS)

Define as mudanças de schema e a migration desta fatia. Drizzle é dono code-first; a
migration `0004_*` é **gerada** por `drizzle-kit generate` e os GRANTs de `companies`
adicionados como SQL custom (padrão do `0003`). Nada é alterado no banco fora de migration
(Princípio I/V).

## 1. `orgs` — colunas novas

Em `src/shared/db/schema/orgs.ts`:

```ts
plan: text("plan").notNull().default("free"),          // CHECK (plan in ('free','pro'))
clerkOrgId: text("clerk_org_id"),                       // unique, nullable
// + uniqueIndex("orgs_clerk_org_id_unique").on(table.clerkOrgId)
// + check("orgs_plan_check", sql`${table.plan} in ('free','pro')`)
```

- `plan`: `NOT NULL DEFAULT 'free'` + `CHECK (plan IN ('free','pro'))`. **Invariante**:
  nenhum tenant sem plano ou com valor fora do conjunto (SC-006).
- `clerk_org_id`: `text` único nullable. Free → `null`. Preenchido só no upgrade PRO
  _(futuro)_.

## 2. `org_memberships` — coluna nova

Em `src/shared/db/schema/org-memberships.ts`:

```ts
scopedCompanyId: uuid("scoped_company_id").references(() => companies.id, {
  onDelete: "cascade",
}), // nullable
```

- `scoped_company_id`: `uuid` nullable, FK→`companies.id`. Preenchido só para `role='cliente'`
  _(futuro)_. Demais papéis: `null`.
- `role` permanece `text` (domínio nosso em inglês `owner｜collaborator｜client`, mapeando
  `proprietário｜colaborador｜cliente`); nesta fatia só `owner` é escrito. **Sem** `CHECK` de
  role nesta fatia — o caminho Clerk-org do PRO persiste o papel nativo do Clerk
  (`org:admin｜org:member`); o mapeamento Clerk↔domínio é da fatia de convite (R5).

## 3. `companies` — tabela nova (herda o padrão `tenant_probe`)

Novo `src/shared/db/schema/companies.ts`:

```ts
const tenantScope = sql`org_id = current_setting('app.current_org', true)`;

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    cnpj: text("cnpj"),
    razaoSocial: text("razao_social"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_companies_org_id").on(table.orgId),
    uniqueIndex("uq_companies_org_id_cnpj").on(table.orgId, table.cnpj),
    pgPolicy("companies_isolation", {
      for: "all",
      to: appRuntimeRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ],
).enableRLS();
```

GRANTs (SQL custom na migration `0004`, após o `CREATE POLICY` gerado):

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO app_runtime;
```

- Isolamento por `org_id` (FR-010) — empresa-cliente é dimensão, não fronteira.
- `uq (org_id, cnpj)` + ausência de único global em `cnpj` → "mesmo CNPJ em dois
  escritórios = duas empresas" (FR-018).
- Policy de escopo por `company_id` do `cliente` **NÃO** entra aqui (futuro).

## 4. Migration `0004_*`

1. `drizzle-kit generate` produz o SQL de: `ALTER TABLE orgs ADD plan/clerk_org_id`
   (+ unique + check), `ALTER TABLE org_memberships ADD scoped_company_id` (+ FK),
   `CREATE TABLE companies` (+ índices + `ENABLE RLS` + `CREATE POLICY`).
2. Adicionar manualmente, na migration, o `GRANT … ON public.companies TO app_runtime`
   (drizzle-kit não gera GRANT — padrão já usado no `0003`).
3. Aplicar via conexão **direta/unpooled** como owner (`DATABASE_URL_UNPOOLED`).

**Ordem**: `companies` deve existir **antes** do FK `scoped_company_id` — garantir a ordem
dos statements na migration (criar `companies`, depois `ALTER org_memberships ADD FK`).

## Critérios de aceite

- [ ] `orgs.plan` existe, `NOT NULL DEFAULT 'free'`, `CHECK in ('free','pro')`; insert sem
      `plan` → `free`; insert com `plan='x'` → rejeitado pelo banco.
- [ ] `orgs.clerk_org_id` único e nullable; dois tenants com `null` coexistem.
- [ ] `companies` com RLS habilitado e policy `companies_isolation` ativa; GRANTs a
      `app_runtime` presentes.
- [ ] `org_memberships.scoped_company_id` FK→`companies.id`, nullable.
- [ ] Migration aplica em ambiente limpo sem passo manual além do GRANT custom documentado.
