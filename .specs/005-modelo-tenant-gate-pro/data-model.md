# Data Model — Modelo de tenant multiempresa + fundação Gate PRO (Phase 1)

Estende o schema da `002`/`004`. Drizzle é o dono code-first; migration `0004_*` gerada por
`drizzle-kit generate` (GRANTs de `companies` como SQL custom, padrão do `0003`). Nada é
alterado no banco fora de migration.

Legenda: **[novo]** coluna/tabela desta fatia · **[mantido]** inalterado · _(futuro)_ campo
modelado agora, usado em fatia posterior.

---

## `orgs` — tenant (escritório/workspace)

| Coluna         | Tipo          | Constraints                                                 | Origem                                                             |
| -------------- | ------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| `id`           | `text`        | PK                                                          | **[mantido]** agora id **canônico nosso**, gerado no cadastro (R1) |
| `name`         | `text`        | nullable                                                    | [mantido]                                                          |
| `slug`         | `text`        | unique nullable                                             | [mantido]                                                          |
| `image_url`    | `text`        | nullable                                                    | [mantido]                                                          |
| `plan`         | `text`        | `NOT NULL DEFAULT 'free'`, `CHECK (plan IN ('free','pro'))` | **[novo]** FR-011                                                  |
| `clerk_org_id` | `text`        | unique, nullable                                            | **[novo]** mapeia → Clerk Org; só PRO _(futuro)_                   |
| `created_at`   | `timestamptz` | `NOT NULL DEFAULT now()`                                    | [mantido]                                                          |
| `updated_at`   | `timestamptz` | `NOT NULL DEFAULT now()`                                    | [mantido]                                                          |

**RLS** [mantido]: policy core `orgs_select_active_org` (`auth.jwt() ->> 'org_id'`,
`TO authenticated`) — caminho supabase-js das tabelas core. A leitura/escrita tenant-scoped
de negócio usa o caminho `app_runtime`/GUC (ver `companies`).

**Regra**: todo tenant tem exatamente um `plan` ∈ {free, pro}; nunca nulo (SC-006). O plano
é do tenant (Inv-1), nunca do usuário.

---

## `org_memberships` — vínculo identidade↔tenant (N:N, com papel)

| Coluna              | Tipo          | Constraints                                              | Origem                                                   |
| ------------------- | ------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| `org_id`            | `text`        | FK→`orgs.id` `ON DELETE CASCADE`, PK(org_id,user_id)     | [mantido]                                                |
| `user_id`           | `text`        | FK→`users.id` `ON DELETE CASCADE`, PK(org_id,user_id)    | [mantido]                                                |
| `role`              | `text`        | `NOT NULL` — domínio nosso `owner｜collaborator｜client` | [mantido] (nesta fatia só `owner` é escrito)             |
| `scoped_company_id` | `uuid`        | nullable, FK→`companies.id` `ON DELETE CASCADE`          | **[novo]** FR-016; preenchido só p/ `cliente` _(futuro)_ |
| `created_at`        | `timestamptz` | `NOT NULL DEFAULT now()`                                 | [mantido]                                                |
| `updated_at`        | `timestamptz` | `NOT NULL DEFAULT now()`                                 | [mantido]                                                |

**Índices**: `org_memberships_user_idx (user_id)` [mantido] — base da resolução do tenant
ativo (R2). **RLS** [mantido]: `org_memberships_select_active_org` (`auth.jwt()`).

**Regras**:

- Vínculo **aditivo** (FR-003): uma identidade acumula N memberships; nunca substitui.
- Papel/escopo resolvidos **por linha** do tenant ativo (FR-017, Inv-1) — nunca global.
- `scoped_company_id` ausente para `owner｜collaborator`; presente para `client` _(futuro)_.
- **Não** há coluna `status` nesta fatia (suspender/pending são futuros — R5).
- **Convenção de `role`**: domínio nosso em inglês `owner｜collaborator｜client` (mapeia os
  papéis conceituais `proprietário｜colaborador｜cliente`). O caminho Clerk-org do PRO
  (futuro) persiste o papel **nativo do Clerk** (`org:admin`, `org:member`) — domínio
  separado, sem CHECK nesta fatia; a reconciliação Clerk↔domínio é da fatia de convite.

---

## `companies` — empresa-cliente (dado de negócio dentro do tenant) **[novo]**

Primeira tabela de negócio a herdar o padrão de RLS de `tenant_probe`.

| Coluna         | Tipo          | Constraints                                            |
| -------------- | ------------- | ------------------------------------------------------ |
| `id`           | `uuid`        | PK `DEFAULT gen_random_uuid()`                         |
| `org_id`       | `text`        | `NOT NULL`, FK→`orgs.id` `ON DELETE CASCADE`, indexado |
| `cnpj`         | `text`        | nullable (validação de formato na app)                 |
| `razao_social` | `text`        | nullable                                               |
| `created_at`   | `timestamptz` | `NOT NULL DEFAULT now()`                               |

**Índices**: `idx_companies_org_id (org_id)`; **`uq_companies_org_id_cnpj (org_id, cnpj)`**
(dedup intra-tenant; **sem** unicidade global de `cnpj` — FR-018).

**RLS**: `ENABLE ROW LEVEL SECURITY`. Policy `companies_isolation`, `TO app_runtime`,
`FOR ALL`:

- `USING (org_id = current_setting('app.current_org', true))`
- `WITH CHECK (org_id = current_setting('app.current_org', true))`

**GRANTs**: `SELECT, INSERT, UPDATE, DELETE ON public.companies TO app_runtime` (SQL custom
na migration, como `0003`).

**Declaração**: `src/shared/db/schema/companies.ts` via `pgTable` + `pgPolicy`
(`to: appRuntimeRole`, `for: "all"`), `.enableRLS()`.

> Empresa-cliente é **dimensão**, não fronteira (FR-010): isolada por `org_id`. A policy de
> **escopo por `company_id` do papel `cliente`** (`AND company_id = scoped_company_id`)
> **não** entra nesta fatia (futuro) — a coluna `scoped_company_id` apenas a prepara.

---

## `tenant_probe` — tabela de referência permanente **[mantido]**

Inalterada (migration `0003`). Continua o exemplo canônico do padrão `app_runtime`/GUC e
alvo dos testes de isolamento. `companies` é a primeira tabela de negócio a replicá-lo.

---

## Identidade e tenant ativo (não persiste id de tenant no cliente)

| Item                         | Valor                                                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Identidade (User)**        | `users.id` = id Clerk (text); 1 por login. CPF/e-mail únicos são do provedor de auth _(reconciliação por CPF é futura — convite)_ |
| **Tenant ativo**             | resolvido de `org_memberships` pelo `userId` da sessão (R2) — **nunca** de input do cliente (FR-002)                              |
| **GUC `app.current_org`**    | recebe `orgs.id` (nosso id canônico) via `withOrg(tenantId, …)`; escopo de transação; ausente → 0 linhas                          |
| **Elegibilidade de seletor** | `count(memberships(userId)) ≥ 2` (FR-020) — renderização do seletor é _(futuro)_                                                  |

---

## Regras de validação / integridade

- `orgs.plan` `NOT NULL` + `CHECK (plan IN ('free','pro'))` — banco garante (SC-006).
- `companies.org_id` `NOT NULL` + FK; escrita só passa se `org_id == tenant ativo`
  (RLS `WITH CHECK`) — FR-008.
- Leitura de `companies` sem filtro explícito ainda é filtrada por RLS; sem tenant ativo,
  vazio (FR-006/FR-007); valor inválido → vazio (FR-009).
- `org_memberships.scoped_company_id` FK→`companies.id` — integridade do escopo `cliente`.
- `clerk_org_id` único (1:1 tenant↔Clerk Org quando existir).
- Toda Server Action/handler valida entrada por schema antes da regra (FR-025, Princípio V).

---

## Transições de estado (provisionamento e contexto)

```
[cadastro Clerk: user.created]
      │  (clerk-sync-service)
      ▼
provisionPersonalTenant(userId)  ── idempotente ──▶ [orgs(plan=free, clerk_org_id=null)]
      │                                                + [org_memberships(role=owner)]
      ▼
[1ª entrada autenticada] ── requireTenantContext() ──▶
      ├─ 0 memberships → provisionPersonalTenant() (self-heal) → re-resolve
      ├─ 1 membership  → tenant ativo = esse  ──▶ [área autenticada, withOrg(tenantId)]
      └─ 2+ memberships → último ativo persistido (cookie) ou bloqueio determinístico (futuro: seletor)

[perde acesso ao tenant ativo] ──▶ [sem tenant ativo] ──▶ bloqueio (caminho 004)  // FR-024
```
