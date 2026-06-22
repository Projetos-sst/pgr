# Data Model — Cadastros base do PGR (Phase 1)

Primeira fatia de dados de domínio. Drizzle é dono code-first; migration `0005_*` gerada
por `drizzle-kit generate` (GRANTs e triggers `set_updated_at` como SQL custom). Nada é
alterado no banco fora de migration.

**Convenção comum a toda tabela nova** (não repetida nas tabelas abaixo):

| Coluna       | Tipo          | Constraints                                            |
| ------------ | ------------- | ------------------------------------------------------ |
| `id`         | `uuid`        | PK `DEFAULT gen_random_uuid()`                         |
| `org_id`     | `text`        | `NOT NULL`, FK→`orgs.id` `ON DELETE CASCADE`, indexado |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()`                               |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` + trigger `set_updated_at`    |

**RLS comum a toda tabela nova + `companies`** (réplica de `tenant_probe`/`companies`):

```sql
ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "<t>_isolation" ON <t> AS PERMISSIVE FOR ALL TO app_runtime
  USING      (org_id = current_setting('app.current_org', true))
  WITH CHECK (org_id = current_setting('app.current_org', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<t> TO app_runtime;
```

Legenda: **[novo]** desta fatia · `*` = `NOT NULL` · _(deferido)_ = fora desta fatia.

**Endereço estruturado** (value-object inline, repetido em `companies`/`work_units`/
`employees`): `zip_code text`, `street text`, `number text` (aceita `S/N`), `complement
text`, `district text`, `city text`, `state text`.

---

## Enums (`pgEnum`)

| Enum              | Valores                                                    | Usado em                   |
| ----------------- | ---------------------------------------------------------- | -------------------------- |
| `category_type`   | `epi`, `machine`                                           | `categories.type`          |
| `employee_sex`    | `male`, `female`, `not_informed`                           | `employees.sex`            |
| `marital_status`  | `single`, `married`, `divorced`, `widowed`, `stable_union` | `employees.marital_status` |
| `employee_status` | `active`, `on_leave`, `dismissed`                          | `employees.status`         |

Valor fora do conjunto → rejeitado pelo banco (FR-018, SC-008).

---

## `companies` — empresa-cliente (ALTER — estende a tabela da `005`)

Existentes [mantido]: `id`, `org_id` (FK cascade, indexado), `cnpj`, `razao_social`,
`created_at`; índice `idx_companies_org_id`, `uq_companies_org_id_cnpj`, policy
`companies_isolation`, GRANT.

| Coluna          | Tipo          | Constraints                                                                         | Origem     |
| --------------- | ------------- | ----------------------------------------------------------------------------------- | ---------- |
| `razao_social`  | `text`        | `*` — passa a **`NOT NULL`** (A3/R5)                                                | [alterado] |
| `nome_fantasia` | `text`        | nullable                                                                            | **[novo]** |
| `phone`         | `text`        | nullable                                                                            | **[novo]** |
| `email`         | `text`        | nullable                                                                            | **[novo]** |
| `cnae`          | `text`        | nullable                                                                            | **[novo]** |
| `main_activity` | `text`        | nullable                                                                            | **[novo]** |
| `risk_grade`    | `smallint`    | nullable, `CHECK (risk_grade between 1 and 4)` (NR-04)                              | **[novo]** |
| `logo_path`     | `text`        | nullable (chave de Storage; upload _(deferido)_)                                    | **[novo]** |
| _endereço_      | —             | `zip_code`/`street`/`number`/`complement`/`district`/`city`/`state` `text` nullable | **[novo]** |
| `updated_at`    | `timestamptz` | `*` `DEFAULT now()` + trigger `set_updated_at_companies`                            | **[novo]** |

- `cnpj` **não** é único global; `uq_companies_org_id_cnpj` (já existente) mantém a
  unicidade-por-tenant (FR-016). Mesmo CNPJ em tenants distintos = empresas distintas.
- Raiz da cadeia; `ON DELETE CASCADE` para seus filhos (`work_units`, `ges`, `employees`).

---

## `work_units` — Unidade de Obra **[novo]**

| Coluna            | Tipo   | Constraints                                                 |
| ----------------- | ------ | ----------------------------------------------------------- |
| `company_id`      | `uuid` | `*` FK→`companies.id` `ON DELETE CASCADE`, indexado         |
| `name`            | `text` | `*`                                                         |
| `contract_number` | `text` | nullable                                                    |
| `description`     | `text` | `*`                                                         |
| _endereço_        | —      | colunas de endereço `text` nullable (ViaCEP é _(deferido)_) |

- Contrato/local de obra de uma empresa. Filha de `companies`; pai de `ges`.

---

## `ges` — Grupo de Exposição Similar **[novo]** (substitui `sectors` do doc 02)

| Coluna                  | Tipo      | Constraints                                          |
| ----------------------- | --------- | ---------------------------------------------------- |
| `company_id`            | `uuid`    | `*` FK→`companies.id` `ON DELETE CASCADE`, indexado  |
| `work_unit_id`          | `uuid`    | `*` FK→`work_units.id` `ON DELETE CASCADE`, indexado |
| `name`                  | `text`    | `*`                                                  |
| `process_description`   | `text`    | nullable                                             |
| `construction_type`     | `text`    | nullable                                             |
| `ceiling_height`        | `numeric` | nullable (pé-direito/altura)                         |
| `floor`                 | `text`    | nullable (piso)                                      |
| `roof`                  | `text`    | nullable (cobertura)                                 |
| `lighting`              | `text`    | nullable (iluminação)                                |
| `ventilation`           | `text`    | nullable (ventilação)                                |
| `other_characteristics` | `text`    | nullable                                             |

- **Nº de trabalhadores expostos**: **NÃO** é coluna — derivado de `ges_job_roles` (R1).
- Filho de `companies`+`work_units`; agrupado por `ges_job_roles` (funções) e referenciado
  por `employees` (`SET NULL` ao apagar).

---

## `job_roles` — Função **[novo]**

| Coluna          | Tipo   | Constraints                                         |
| --------------- | ------ | --------------------------------------------------- |
| `company_id`    | `uuid` | `*` FK→`companies.id` `ON DELETE CASCADE`, indexado |
| `title`         | `text` | `*`                                                 |
| `cbo`           | `text` | nullable (campo texto; tabela de CBO _(deferida)_)  |
| `work_schedule` | `text` | nullable (jornada)                                  |
| `description`   | `text` | nullable                                            |

- **`UNIQUE(org_id, company_id, title)`** (A5) — função não duplica por nome na mesma
  empresa do tenant.
- Vínculo M2M com `training_catalog` _(deferido)_ — módulo Treinamentos não existe.

---

## `categories` — catálogo EPI / Máquinas **[novo]**

| Coluna | Tipo            | Constraints          |
| ------ | --------------- | -------------------- |
| `type` | `category_type` | `*` (`epi｜machine`) |
| `name` | `text`          | `*`                  |
| `note` | `text`          | nullable             |

- **`UNIQUE(org_id, type, name)`** (R6 — default informado, revisitável). Catálogo
  independente da cadeia da empresa (sem FK a `companies`).

---

## `employees` — Funcionário **[novo]**

| Coluna              | Tipo              | Constraints                                                |
| ------------------- | ----------------- | ---------------------------------------------------------- |
| `company_id`        | `uuid`            | `*` FK→`companies.id` `ON DELETE CASCADE`, indexado (Q1)   |
| `ges_id`            | `uuid`            | nullable, FK→`ges.id` `ON DELETE SET NULL`, indexado       |
| `job_role_id`       | `uuid`            | nullable, FK→`job_roles.id` `ON DELETE SET NULL`, indexado |
| `full_name`         | `text`            | `*`                                                        |
| `cpf`               | `text`            | `*`                                                        |
| `birth_date`        | `date`            | nullable                                                   |
| `sex`               | `employee_sex`    | nullable                                                   |
| `marital_status`    | `marital_status`  | nullable                                                   |
| `phone`             | `text`            | nullable                                                   |
| `email`             | `text`            | nullable                                                   |
| `rg`                | `text`            | nullable                                                   |
| `badge_number`      | `text`            | nullable (crachá)                                          |
| `badge_valid_until` | `date`            | nullable                                                   |
| `registration`      | `text`            | nullable (matrícula)                                       |
| `blood_type`        | `text`            | nullable                                                   |
| `admission_date`    | `date`            | nullable                                                   |
| `dismissal_date`    | `date`            | nullable                                                   |
| _endereço_          | —                 | colunas de endereço `text` nullable                        |
| `photo_path`        | `text`            | nullable (foto 3x4; upload _(deferido)_)                   |
| `status`            | `employee_status` | `*` `DEFAULT 'active'`                                     |

- **`UNIQUE(org_id, cpf)`** (FR-015) — CPF único por tenant; mesmo CPF em orgs distintas é
  permitido (CPF não é global).
- Vínculo **obrigatório** a `company_id`; **opcional** a `ges_id`/`job_role_id`.
- _(deferido)_: `cnh`, `passport`, contatos de emergência (tabela-filha); vínculo a `risks`
  (módulo PGR).

---

## `ges_job_roles` — junção GES↔Função **[novo]** (fonte do nº de expostos)

| Coluna          | Tipo      | Constraints                                          |
| --------------- | --------- | ---------------------------------------------------- |
| `ges_id`        | `uuid`    | `*` FK→`ges.id` `ON DELETE CASCADE`, indexado        |
| `job_role_id`   | `uuid`    | `*` FK→`job_roles.id` `ON DELETE CASCADE`, indexado  |
| `worker_count`  | `integer` | `*` `CHECK (worker_count > 0)` (nº de trabalhadores) |
| `work_schedule` | `text`    | nullable (jornada)                                   |

- **`UNIQUE(org_id, ges_id, job_role_id)`** (FR-017) — uma função não se associa duas vezes
  ao mesmo GES.
- **Nº de expostos por GES** = `SUM(worker_count)` agrupado por `ges_id`, no tenant ativo
  (R1). Sem associações → 0 (FR-020).

---

## Cadeia de FKs e `ON DELETE`

```
orgs(id)
  └─< companies (org_id*)                         apagar org → CASCADE
        ├─< work_units (company_id*)              apagar company → CASCADE
        │      └─< ges (company_id*, work_unit_id*)  apagar work_unit/company → CASCADE
        │            └─< ges_job_roles (ges_id*) >── job_roles
        │                   (ges_id→CASCADE, job_role_id→CASCADE)
        ├─< job_roles (company_id*)               apagar company → CASCADE
        └─< employees (company_id*)               apagar company → CASCADE
               ├ ges_id      → SET NULL (apagar GES desvincula, mantém funcionário)
               └ job_role_id → SET NULL
categories (org_id*)  — catálogo independente (sem FK a companies)
```

Toda FK inválida em qualquer elo é rejeitada (FR-013). Todas as tabelas têm `org_id` →
`orgs.id` e RLS por `org_id`.

---

## Nº de trabalhadores expostos (derivação)

```sql
-- dentro de withOrg(activeTenant, …): RLS já restringe ges_job_roles ao tenant ativo
SELECT g.id AS ges_id,
       COALESCE(SUM(gjr.worker_count), 0)::int AS exposed_workers
FROM ges g
LEFT JOIN ges_job_roles gjr ON gjr.ges_id = g.id
WHERE g.id = $1            -- ou sem filtro para listar todos os GES do tenant
GROUP BY g.id;
```

- `LEFT JOIN` + `COALESCE(…, 0)` garante **0** para GES sem associação (FR-020, SC-010).
- O escopo por `org_id` vem do `withOrg` (RLS) **e** do `WHERE`/join no repositório (1ª
  barreira). Adicionar/alterar/remover associação reflete na próxima leitura — fonte única,
  sem drift (SC-011).

---

## Regras de validação / integridade (resumo)

- Constraints no banco (fonte de verdade, Princípio V): FKs com `ON DELETE` acima; enums
  fechados; `CHECK (risk_grade between 1 and 4)`; `CHECK (worker_count > 0)`;
  `UNIQUE(org_id, cpf)`, `UNIQUE(org_id, ges_id, job_role_id)`,
  `UNIQUE(org_id, company_id, title)`, `UNIQUE(org_id, type, name)`,
  `uq_companies_org_id_cnpj` (mantido).
- Validação zod de domínio na entrada (antes da regra) complementa o banco (FR-024): membros
  de enum, `risk_grade ∈ 1..4`, `worker_count > 0`, formato de `cpf`/`cnpj` (validação de
  formato, não unicidade).
- Escrita só passa se `org_id == tenant ativo` (RLS `WITH CHECK`, FR-012); leitura sem
  filtro explícito ainda é filtrada por RLS; sem tenant ativo → vazio (FR-010/FR-011).
