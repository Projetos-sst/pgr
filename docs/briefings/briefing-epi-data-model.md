# Briefing — Modelo de dados do módulo de EPIs

> **Tipo de fatia**: modelagem + migration (análoga à `006` para a cadeia do PGR).
> **Arquivos**: `src/shared/db/schema/epis.ts` (Drizzle code-first) + migration `drizzle-kit`.
> **Tabelas**: `epi_catalog`, `epi_stock`, `stock_movements`, `epi_deliveries`,
> `epi_delivery_items`, `epi_risk` (+ reuso de `categories` no lugar de `epi_categories` —
> ver §7.1/§11).
> **Contexto**: Modelo B (escritório = `orgs.id`); herda padrão de `005`/`006`.
> **Cards de CRUD/fluxo que dependem deste modelo**: catálogo #18, categorias #112,
> estoque #70, movimentações #72, entrega #19, devolução #20, histórico #21.

## 1. Objetivo e posição na arquitetura

Esta fatia entrega **apenas o modelo de dados** (schema + migration + RLS + testes de
isolamento) das tabelas de EPIs — **sem UI, sem Server Actions, sem repositórios de CRUD**.
É a **fundação** da paridade com o ePGR na Fase 2: cada tabela aqui é pré-requisito de um card
de CRUD/fluxo posterior.

O paralelo direto é a `006` (`.specs/006-cadastros-base-pgr/`), que modelou a cadeia do PGR
(`companies → work_units → ges → ges_job_roles ⋈ job_roles`, `employees`, `categories`). Esta
fatia faz o mesmo para o domínio de EPIs e conecta-se à cadeia existente em dois pontos:
`employees` (entregas) e o **risco do GES** (`epi_risk`).

```
epi_categories ──< epi_catalog ──< epi_stock ──< stock_movements >── epi_deliveries >── employees
                       │                                                    │
                       ├──< epi_delivery_items >─────────────────────────────┘
                       └──< epi_risk >── (risco do GES)   ← ver §7, dependência aberta
```

## 2. Padrões herdados (obrigatórios em TODA tabela)

Replicar exatamente o padrão das tabelas de `006` (`src/shared/db/schema/*.ts`):

- **Tenant (Modelo B)**: `orgId: text("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" })`, **sempre indexado** (`idx_<tabela>_org_id`). Tenant = `orgs.id`; **nunca** Clerk org, `organization_id`, nem input do cliente.
- **PK**: `uuid("id").primaryKey().defaultRandom()`.
- **Timestamps**: `created_at`/`updated_at` `timestamptz NOT NULL DEFAULT now()` + trigger `set_updated_at_<tabela>` (SQL custom na migration, padrão `0001`/`0005`).
- **RLS como backstop**: `.enableRLS()` + `pgPolicy("<tabela>_isolation", { for: "all", to: appRuntimeRole, using: tenantScope, withCheck: tenantScope })`, onde `tenantScope = sql\`org_id = current_setting('app.current_org', true)\``.
- **GRANT** `SELECT, INSERT, UPDATE, DELETE ... TO app_runtime` por tabela (SQL custom na migration).
- **Acesso em runtime**: sempre via `withOrg(orgId, …)`; tenant ativo de `requireTenantContext()`.
- **Nomenclatura**: tabelas/colunas em inglês `snake_case`; termos SST intraduzíveis mantidos em PT.
- Conexão: `app_runtime` (pooler 6543) em runtime; `drizzle-kit` aplica migration via conexão direta unpooled (owner).

## 3. Modelo proposto, tabela por tabela

> Tipos/constraints abaixo seguem o estilo Drizzle já usado no repo. CA = Certificado de
> Aprovação (MTE). Onde houver decisão em aberto, ver §7.

### 3.1 `epi_categories` — taxonomia que filtra o catálogo

> ⚠️ **Sobreposição crítica com `categories` (006)** — ver §7.1 antes de criar.

| Coluna     | Tipo                                   | Constraint                       |
| ---------- | -------------------------------------- | -------------------------------- |
| `id`       | `uuid`                                 | PK                               |
| `org_id`   | `text`                                 | NOT NULL → `orgs.id`, indexado   |
| `type`     | enum `category_type` (`epi`/`machine`) | NOT NULL                         |
| `name`     | `text`                                 | NOT NULL                         |
| `note`     | `text`                                 | nullable (Observação)            |
| timestamps | `timestamptz`                          | NOT NULL DEFAULT now() + trigger |

- Unicidade sugerida: `UNIQUE(org_id, type, name)` (idêntica à de `categories`).

### 3.2 `epi_catalog` — catálogo de itens (EPI / Máquinas e Equipamentos)

| Coluna            | Tipo                                   | Constraint                                                                    |
| ----------------- | -------------------------------------- | ----------------------------------------------------------------------------- |
| `id`              | `uuid`                                 | PK                                                                            |
| `org_id`          | `text`                                 | NOT NULL → `orgs.id`, indexado                                                |
| `type`            | enum `category_type` (`epi`/`machine`) | NOT NULL — Tipo                                                               |
| `category_id`     | `uuid`                                 | NOT NULL → `epi_categories.id` (FK), indexado                                 |
| `name`            | `text`                                 | NOT NULL — Nome                                                               |
| `ca`              | `text`                                 | nullable — nº do Certificado de Aprovação                                     |
| `ca_valid_until`  | `date`                                 | nullable — Validade do CA                                                     |
| `manufacturer`    | `text`                                 | nullable — Fabricante                                                         |
| `norm`            | `text`                                 | nullable — Norma                                                              |
| `size`            | `text`                                 | nullable — Tamanho                                                            |
| `unit_of_measure` | `text`                                 | nullable — Unidade de Medida                                                  |
| `description`     | `text`                                 | nullable                                                                      |
| `photo_path`      | `text`                                 | nullable (chave de Storage; upload deferido como em `logo_path`/`photo_path`) |
| timestamps        | `timestamptz`                          | NOT NULL DEFAULT now() + trigger                                              |

- Decisões em aberto: `unit_of_measure` como `text` livre vs enum; `ca`/`size`/`norm`
  obrigatórios para `type = epi` mas não para `machine` (ver §7.4).

### 3.3 `epi_stock` — estoque por item

| Coluna         | Tipo          | Constraint                                 |
| -------------- | ------------- | ------------------------------------------ |
| `id`           | `uuid`        | PK                                         |
| `org_id`       | `text`        | NOT NULL → `orgs.id`, indexado             |
| `catalog_id`   | `uuid`        | NOT NULL → `epi_catalog.id` (FK), indexado |
| `balance`      | `integer`     | NOT NULL DEFAULT 0 — saldo atual           |
| `min_quantity` | `integer`     | NOT NULL DEFAULT 0 — quantidade mínima     |
| timestamps     | `timestamptz` | NOT NULL DEFAULT now() + trigger           |

- Sugerir `UNIQUE(org_id, catalog_id)` (um registro de estoque por item).
- **Saldo derivado vs materializado**: ver §7.3. Recomendação: coluna `balance` materializada
  (ePGR mostra saldo direto), mantida pelos `stock_movements` na camada de fluxo (Fase 2),
  **não** por trigger nesta fatia. `CHECK (balance >= 0)` opcional.

### 3.4 `stock_movements` — movimentos tipados

| Coluna           | Tipo                       | Constraint                                          |
| ---------------- | -------------------------- | --------------------------------------------------- |
| `id`             | `uuid`                     | PK                                                  |
| `org_id`         | `text`                     | NOT NULL → `orgs.id`, indexado                      |
| `stock_id`       | `uuid`                     | NOT NULL → `epi_stock.id` (FK), indexado            |
| `delivery_id`    | `uuid`                     | **nullable** → `epi_deliveries.id` (FK, `SET NULL`) |
| `type`           | enum `stock_movement_type` | NOT NULL                                            |
| `quantity`       | `integer`                  | NOT NULL, **`CHECK (quantity > 0)`**                |
| `movement_date`  | `date`                     | NOT NULL DEFAULT now()                              |
| `invoice_number` | `text`                     | nullable — nº da nota fiscal                        |
| timestamps       | `timestamptz`              | NOT NULL DEFAULT now() + trigger                    |

- **Enum `stock_movement_type`** (`pgEnum`): `purchase`, `employee_delivery`, `adjustment`,
  `discard` (mapeia compra / entrega_funcionario / ajuste / descarte). Sentido (entrada/saída)
  é derivado do tipo na camada de fluxo, não armazenado.
- `quantity` sempre positivo; o tipo define o efeito no saldo. `CHECK (quantity > 0)` é
  critério de aceite.

### 3.5 `epi_deliveries` — entregas com assinatura

| Coluna             | Tipo                        | Constraint                                 |
| ------------------ | --------------------------- | ------------------------------------------ |
| `id`               | `uuid`                      | PK                                         |
| `org_id`           | `text`                      | NOT NULL → `orgs.id`, indexado             |
| `employee_id`      | `uuid`                      | NOT NULL → `employees.id` (FK), indexado   |
| `delivery_date`    | `date`                      | NOT NULL DEFAULT now()                     |
| `signature_status` | enum `epi_signature_status` | NOT NULL DEFAULT `pending`                 |
| `auth_token`       | `text`                      | nullable — token p/ assinatura via QR/link |
| timestamps         | `timestamptz`               | NOT NULL DEFAULT now() + trigger           |

- **Enum `epi_signature_status`** (`pgEnum`): `pending`, `signed_qr`, `signed_link`,
  `signed_manual` (critério de aceite).
- `auth_token` deve ser único quando presente (`UNIQUE`/partial index) por ser usado em link
  público de assinatura — confirmar em §7.5.

### 3.6 `epi_delivery_items` — itens de cada entrega

| Coluna        | Tipo          | Constraint                                               |
| ------------- | ------------- | -------------------------------------------------------- |
| `id`          | `uuid`        | PK                                                       |
| `org_id`      | `text`        | NOT NULL → `orgs.id`, indexado                           |
| `delivery_id` | `uuid`        | NOT NULL → `epi_deliveries.id` (FK, `CASCADE`), indexado |
| `catalog_id`  | `uuid`        | NOT NULL → `epi_catalog.id` (FK), indexado               |
| `quantity`    | `integer`     | NOT NULL, **`CHECK (quantity > 0)`**                     |
| timestamps    | `timestamptz` | NOT NULL DEFAULT now() + trigger                         |

- `ON DELETE CASCADE` de `epi_deliveries` (item não existe sem a entrega).

### 3.7 `epi_risk` — vínculo EPI × risco do GES

> ⚠️ **Dependência aberta**: não existe tabela `risks` nem vínculo GES↔risco no schema atual.
> Ver §7.2 — pode bloquear ou exigir co-modelagem.

| Coluna        | Tipo          | Constraint                                            |
| ------------- | ------------- | ----------------------------------------------------- |
| `id`          | `uuid`        | PK                                                    |
| `org_id`      | `text`        | NOT NULL → `orgs.id`, indexado                        |
| `catalog_id`  | `uuid`        | NOT NULL → `epi_catalog.id` (FK), indexado            |
| `risk_id` (?) | `uuid`        | NOT NULL → **`risks.id`** (FK) — **alvo inexistente** |
| `neutralizes` | `boolean`     | NOT NULL DEFAULT false — "neutraliza os riscos?"      |
| timestamps    | `timestamptz` | NOT NULL DEFAULT now() + trigger                      |

- Junção pura: sugerir `UNIQUE(org_id, catalog_id, risk_id)`.

## 4. Constraints, enums e ON DELETE — resumo

- **Novos `pgEnum`**: `stock_movement_type` (purchase/employee_delivery/adjustment/discard),
  `epi_signature_status` (pending/signed_qr/signed_link/signed_manual). **Reusar** `category_type`
  (epi/machine) já existente em `006` para `type`.
- **CHECK `quantity > 0`** em `stock_movements` e `epi_delivery_items`.
- **FKs**: `epi_catalog → epi_categories`; `epi_stock → epi_catalog`;
  `stock_movements → epi_stock` (+ `epi_deliveries` nullable); `epi_deliveries → employees`;
  `epi_delivery_items → epi_deliveries (CASCADE) + epi_catalog`; `epi_risk → epi_catalog (+ risks)`.
- **ON DELETE** sugerido: `CASCADE` descendo a cadeia de EPI
  (`epi_categories → epi_catalog → epi_stock → stock_movements`;
  `epi_deliveries → epi_delivery_items`); `SET NULL` em `stock_movements.delivery_id`.
  Confirmar política para `employees → epi_deliveries` (provável `CASCADE` ou `RESTRICT`).

## 5. Migration (drizzle-kit)

- Schema code-first em `src/shared/db/schema/epis.ts`; exportar tabelas/enums/tipos em
  `src/shared/db/schema/index.ts`.
- `drizzle-kit generate` → migration `0007_*` (próximo número após `0006`).
- Adicionar **manualmente** ao SQL gerado (como em `0005`): `GRANT ... TO app_runtime` por
  tabela e os `CREATE TRIGGER set_updated_at_<tabela>` (a função `set_updated_at` já existe
  desde `0001`). As `CREATE POLICY` saem do `pgPolicy`/`.enableRLS()`.
- Aplicar via conexão direta unpooled (owner). **Migration nova**, ao contrário da `007`.

## 6. Testes (obrigatórios — quality gate)

- **Unit**: validações/regras puras das definições (mapeamento de enums, formato de schema).
- **Integração — criação via migration**: tabelas criadas, FKs/CHECK/enums aplicados; `CHECK
(quantity > 0)` rejeita 0/negativo em `stock_movements` e `epi_delivery_items`.
- **Isolamento multi-tenant em Postgres efêmero** (`INTEGRATION_*`/`runIsolationSuite`,
  **nunca SQLite**): para cada tabela, RLS `app_runtime`/GUC não deixa dados cruzarem tenants
  (leitura e escrita de outro `org_id` bloqueadas).
- `npm run test` e `npm run test:integration` verdes; `npm run lint` + tipos verdes.

## 7. Decisões em aberto / riscos (resolver antes de codar)

### 7.1 `epi_categories` vs `categories` (006) — provável duplicação

A tabela `categories` da `006` **já é** "taxonomia que filtra catálogo por tipo": colunas
`type` (`category_type` = `epi`/`machine`), `name`, `note`, `UNIQUE(org_id, type, name)` —
idêntica ao `epi_categories` pedido. **Decidir**: (a) **reusar `categories`** e apontar
`epi_catalog.category_id → categories.id` (sem `epi_categories` nova), ou (b) criar
`epi_categories` dedicada e aceitar a redundância. Recomendação: reusar `categories`, salvo se
houver requisito de separar taxonomias de EPI das de outros módulos.

### 7.2 `epi_risk` depende de um modelo de risco do GES inexistente

Não há tabela `risks` nem associação GES↔risco no schema (`006` modelou a cadeia até
`ges_job_roles`, sem riscos). `epi_risk` não tem alvo de FK. **Opções**: (a) modelar `risks`/
vínculo GES nesta fatia (aumenta escopo), (b) postergar `epi_risk` para quando o modelo de
risco existir, ou (c) FK para `ges` diretamente como aproximação temporária. **Bloqueador a
confirmar com o dono do produto.**

### 7.3 Saldo de estoque: materializado vs derivado

`006` derivou nº de expostos por agregação (sem coluna/trigger). Aqui o ePGR exibe saldo e
mínimo direto; o briefing propõe `balance` **materializado** mantido pela camada de fluxo
(Fase 2), não por trigger nesta fatia de modelagem. Confirmar a abordagem para não repetir o
debate da agregação.

### 7.4 Campos condicionais por tipo

`ca`, `ca_valid_until`, `norm`, `size` fazem sentido para `type = epi`, menos para `machine`.
Manter todos nullable no banco e validar condicionalmente na camada de aplicação (zod), como
o repo já faz com campos opcionais.

### 7.5 `auth_token` de entrega

Usado em assinatura via QR/link público — definir unicidade (índice único parcial onde
`auth_token IS NOT NULL`) e que a **geração** do token fica na camada de fluxo (#19), não aqui.

### 7.6 Numeração da fatia/spec

Esta é uma fatia de modelagem nova (paralela à `006`). Se for formalizada em `.specs/`, sugerir
diretório próprio (ex.: `008-epi-data-model/`) e migration `0007_*`.

## 8. Fora de escopo (explícito)

UI/formulários, Server Actions e repositórios de CRUD; geração de QR/link e fluxo de
assinatura; lógica de baixa/entrada de saldo; upload de foto (só o campo `photo_path`);
relatórios/histórico (#21). Tudo isso são cards da Fase 2 que **consomem** este modelo.

## 9. Critérios de aceite (do card)

- [ ] `epi_catalog`, `epi_categories`_, `epi_stock`, `stock_movements`, `epi_deliveries`, `epi_delivery_items`, `epi_risk`_ criadas via migration. (\*sujeito a §7.1/§7.2)
- [ ] Todos os campos do ePGR no catálogo: tipo, categoria, CA, fabricante, norma, validade, tamanho, und. medida, descrição, foto.
- [ ] Enum de tipo de movimento: compra, entrega_funcionario, ajuste, descarte.
- [ ] Enum de status de assinatura: pending, signed_qr, signed_link, signed_manual.
- [ ] RLS habilitado + policy `app_runtime`/GUC em todas as tabelas.
- [ ] FKs para `employees`, `epi_catalog`, `epi_stock`, `epi_categories` válidas.
- [ ] `CHECK (quantity > 0)` em movimentos e itens de entrega.
- [ ] `npm run test` e `npm run test:integration` (incl. isolamento em Postgres efêmero) verdes.

## 10. Referências

- `.specs/006-cadastros-base-pgr/` (modelo análogo; migration `0005`).
- `.specs/005-modelo-tenant-gate-pro/`; `.specs/004-multi-tenant-isolation/contracts/withorg-and-rls.md`.
- Schemas-modelo: `src/shared/db/schema/{categories,employees,ges,ges-job-roles,companies}.ts`.
- Migration-modelo: `src/shared/db/migrations/0005_cadastros_base_pgr.sql`.
- Constituição v1.2.1 — Princípio I (Modelo B) e validação de schema.

---

## 11. Registro de implementação (2026-06-22)

Implementado **da forma recomendada** descrita neste briefing. As duas decisões em aberto
(§7) foram resolvidas assim:

- **§7.1 — `epi_categories`**: **não criada**. Reuso da tabela `categories` (006), que já é a
  taxonomia `epi`/`machine` (`type`, `name`, `note`, `UNIQUE(org_id, type, name)`) e já tem
  repositório, validação, seed e testes de isolamento. `epi_catalog.category_id → categories.id`.
- **§7.2 — `epi_risk`**: criada com FK **interina** para `ges` (`epi_catalog × ges` + flag
  `neutralizes`), por não existir tabela `risks`/vínculo GES↔risco. Quando o modelo de risco
  dedicado existir, migra-se a FK. Documentado no JSDoc da tabela.
- **FR-002a (fatia `008`, clarify 2026-06-22) — consistência de tipo item↔categoria**: o banco
  passa a garantir `epi_catalog.type == categories.type` via **FK composta** `(category_id,
type) → categories(id, type)`, exigindo um `UNIQUE(id, type)` (constraint, não índice) em
  `categories`. Migration **`0008_epi_catalog_type_fk`** (UNIQUE primeiro, depois troca da FK
  simples pela composta — a ordem importa). Substitui a FK simples original sobre `category_id`.

### Decisões de `ON DELETE` (recomendadas)

- `CASCADE` na cadeia de posse: `epi_catalog → epi_stock → stock_movements`,
  `epi_deliveries → epi_delivery_items`, `epi_risk` (junção).
- `SET NULL` em `stock_movements.delivery_id` (preserva o movimento ao excluir a entrega).
- `RESTRICT` nas FKs que apontam para o catálogo a partir de tabelas com histórico/uso:
  `epi_catalog.category_id → categories` e `epi_delivery_items.catalog_id → epi_catalog`
  (evita perda silenciosa de histórico/catálogo em uso). **Desvio consciente** do "CASCADE em
  tudo" sugerido no card original.
- `auth_token` único via **índice parcial** (`WHERE auth_token IS NOT NULL`): vários `NULL`
  coexistem, token preenchido é único.
- `CHECK`: `quantity > 0` (movimentos e itens), `balance >= 0`, `min_quantity >= 0`.
- Saldo (`balance`) **materializado** (não derivado/trigger); manutenção fica para a Fase 2.

### Arquivos criados/alterados

- **Schema**: `src/shared/db/schema/epis.ts` (6 tabelas + enums `stock_movement_type`,
  `epi_signature_status`; reuso de `category_type`); export em `src/shared/db/schema/index.ts`.
- **Migration**: `src/shared/db/migrations/0007_epi_data_model.sql` (gerada via `drizzle-kit
generate` + GRANT a `app_runtime` e triggers `set_updated_at_*` adicionados à mão, padrão
  `0005`); snapshot/journal em `migrations/meta/`.
- **Validação**: `stockMovementTypeSchema`, `epiSignatureStatusSchema`, `epiQuantitySchema` em
  `src/shared/domains/pgr/validation.ts`.
- **Testes**:
  - Unit: `src/__tests__/unit/domains/pgr/epi-validation.test.ts`.
  - Seed estendido: `src/__tests__/integration/_helpers/pgr-seed.ts` (cadeia EPI por tenant).
  - Isolamento (Postgres efêmero, `runIsolationSuite`): `epi-catalog`, `epi-stock`,
    `stock-movements`, `epi-deliveries`, `epi-delivery-items`, `epi-risk` (`*-isolation.test.ts`).
  - Constraints: `epi-constraints.test.ts` (CHECK, UNIQUE, enums, `ON DELETE`).
  - Forma da migration: `epi-migration-shape.test.ts` (RLS, policy, GRANT, trigger, enums, FK→categories).

### Estado da verificação

- `npm run typecheck` ✅ · `npm run lint` ✅ · `npm run test` ✅ (178 testes unitários).
- `npm run test:integration`: as suítes de EPI **pulam** sem `INTEGRATION_DATABASE_URL`/
  `INTEGRATION_APP_RUNTIME_URL` (precisam do Postgres efêmero). **Pendente**: rodar a integração
  contra Postgres para validar RLS/constraints na prática.
- Observação: a suíte pré-existente `webhooks/clerk-membership.test.ts` falha por falta de
  `NEXT_PUBLIC_SUPABASE_URL` no ambiente — **não relacionada** a esta fatia.

### Ainda fora desta fatia (Fase 2)

Repositórios/Server Actions/UI; manutenção de saldo a partir dos movimentos; geração de
QR/link e fluxo de assinatura; eventual modelo `risks` dedicado (e migração da FK de `epi_risk`).

---

## 12. Prompt para `/speckit-specify`

> Copie o bloco abaixo **inteiro** (começa em `/speckit-specify`) e cole no Claude para rodar.
> Ele cria a branch automaticamente e formaliza esta fatia em `.specs/008-epi-data-model/`.
> O prompt segue o template padrão do projeto (GIT_BRANCH_NAME / Feature / CONTEXTO / User
> stories / Success criteria / Edge cases) e já embute o briefing e as decisões tomadas na §11
> (reuso de `categories`; `epi_risk → ges` interino) para que a spec reflita o que foi construído.

```text
/speckit-specify

GIT_BRANCH_NAME: feature/epi-data-model

Feature: Modelo de dados do módulo de EPIs — fundação da Fase 2 (paridade com o ePGR)

CONTEXTO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho (Modelo B: o tenant é o
escritório de SST = orgs.id). Esta é uma fatia de MODELAGEM DE DADOS pura (schema Drizzle
code-first + migration drizzle-kit + RLS + testes de isolamento), análoga à fatia 006
(cadastros-base do PGR, migration 0005). NÃO inclui UI, Server Actions, repositórios de CRUD,
fluxo de assinatura nem manutenção de saldo — isso é Fase 2 (cards #18 catálogo, #112
categorias, #70 estoque, #72 movimentações, #19 entrega, #20 devolução, #21 histórico) que
CONSOMEM este modelo. O objetivo é entregar as tabelas-base do módulo de EPIs e de
Máquinas/Equipamentos, refletindo fielmente os campos do ePGR, isoladas por tenant, corretas
e testadas.

Antes de escrever a spec, leia os padrões e convenções já vigentes no repo (estrutura de
src/shared/db/schema/, padrão de Modelo B/RLS/withOrg, migration 0005 como modelo, validações
zod em src/shared/domains/pgr/, padrão de testes de integração com Postgres efêmero). Liste os
arquivos que vai ler antes de começar.

REGRAS DE ISOLAMENTO (NÃO NEGOCIÁVEL — Princípio I da constituição v1.2.1):
- Tenant = escritório de SST = orgs.id. Toda tabela nova tem org_id (text, NOT NULL, FK →
  orgs.id ON DELETE CASCADE, indexado em idx_<tabela>_org_id).
- Isolamento via withOrg(orgId, …) na aplicação + RLS como backstop no papel app_runtime, com
  policy <tabela>_isolation usando org_id = current_setting('app.current_org', true) em USING
  e WITH CHECK; tabela com .enableRLS().
- O tenant ativo vem SEMPRE de requireTenantContext()/sessão — NUNCA de Clerk org,
  organization_id ou input do cliente. A empresa-cliente (companies) é dimensão DENTRO do
  tenant, não fronteira de isolamento.
- Padrões herdados da 006 em toda tabela: PK uuid defaultRandom; created_at/updated_at
  timestamptz NOT NULL DEFAULT now() + trigger set_updated_at_<tabela>; GRANT
  SELECT/INSERT/UPDATE/DELETE ao app_runtime. Tabelas/colunas em inglês snake_case; termos SST
  intraduzíveis em PT.

DECISÕES JÁ TOMADAS (devem constar na spec):
1. Reuso da tabela `categories` (da 006) como a taxonomia EPI/Máquina — NÃO criar
   `epi_categories`. `categories` já tem type (enum category_type: epi|machine), name, note e
   UNIQUE(org_id, type, name). O catálogo aponta para ela via category_id.
2. `epi_risk` representa o "risco do GES" de forma INTERINA via FK para `ges` (ainda não
   existe tabela `risks`/vínculo GES↔risco). Quando um modelo de risco dedicado existir, a FK
   migra. Registrar como dívida técnica explícita.

ENTIDADES E CAMPOS:
- epi_catalog (catálogo de itens — EPI e Máquinas/Equipamentos): org_id; type (enum
  category_type: epi|machine); category_id (FK → categories, ON DELETE RESTRICT); name; ca (nº
  do Certificado de Aprovação); ca_valid_until (validade do CA, date); manufacturer; norm
  (norma); size (tamanho); unit_of_measure (unidade de medida); description; photo_path (chave
  de Storage; upload é futuro); timestamps.
- epi_stock (estoque por item): org_id; catalog_id (FK → epi_catalog, ON DELETE CASCADE);
  balance (saldo atual, inteiro, materializado); min_quantity (quantidade mínima, inteiro);
  timestamps. UNIQUE(org_id, catalog_id). CHECK balance >= 0 e min_quantity >= 0. Manutenção
  do saldo a partir dos movimentos é da Fase 2 (sem trigger nesta fatia).
- stock_movements (movimentos tipados): org_id; stock_id (FK → epi_stock, ON DELETE CASCADE);
  delivery_id (FK → epi_deliveries, NULLABLE, ON DELETE SET NULL); type (enum
  stock_movement_type: purchase|employee_delivery|adjustment|discard); quantity (inteiro, CHECK
  > 0); movement_date (date, default hoje); invoice_number (nº nota fiscal, opcional);
  timestamps. quantity é sempre positivo; o tipo define o efeito (entrada/saída) no saldo.
- epi_deliveries (entregas com assinatura): org_id; employee_id (FK → employees, ON DELETE
  CASCADE); delivery_date (date, default hoje); signature_status (enum epi_signature_status:
  pending|signed_qr|signed_link|signed_manual, default pending); auth_token (token de
  assinatura via QR/link, opcional, ÚNICO quando preenchido via índice parcial WHERE NOT NULL);
  timestamps. A geração do token é da Fase 2.
- epi_delivery_items (itens de cada entrega): org_id; delivery_id (FK → epi_deliveries, ON
  DELETE CASCADE); catalog_id (FK → epi_catalog, ON DELETE RESTRICT); quantity (inteiro, CHECK
  > 0); timestamps.
- epi_risk (vínculo EPI × risco do GES): org_id; catalog_id (FK → epi_catalog, ON DELETE
  CASCADE); ges_id (FK → ges, ON DELETE CASCADE — interino, ver decisão 2); neutralizes
  (boolean, default false, "neutraliza os riscos?"); timestamps. UNIQUE(org_id, catalog_id,
  ges_id).

ON DELETE (justificar na spec):
- CASCADE na cadeia de posse: epi_catalog→epi_stock→stock_movements;
  epi_deliveries→epi_delivery_items; epi_risk (junção).
- SET NULL em stock_movements.delivery_id (preserva o movimento ao excluir a entrega).
- RESTRICT nas FKs que apontam para catálogo/taxonomia a partir de tabelas de uso/histórico
  (epi_catalog.category_id → categories; epi_delivery_items.catalog_id → epi_catalog) para
  evitar perda silenciosa de catálogo em uso e de histórico de entregas.

ENUMS NOVOS:
- stock_movement_type: purchase, employee_delivery, adjustment, discard.
- epi_signature_status: pending, signed_qr, signed_link, signed_manual.
- Reusar o enum existente category_type (epi, machine) para epi_catalog.type.

ENTREGÁVEL TÉCNICO:
- src/shared/db/schema/epis.ts (Drizzle code-first) exportado em src/shared/db/schema/index.ts;
  validações zod dos enums/quantidade em src/shared/domains/pgr/validation.ts; migration 0007_*
  gerada por drizzle-kit com GRANT e triggers set_updated_at adicionados como SQL custom
  (padrão da 0005), aplicada via conexão direta unpooled (owner). Sem alterar tabelas
  existentes além do reuso de categories.

User stories (P1 = mais crítica; P2, P3 conforme necessário):
- P1 — Como escritório de SST (tenant), quero que os itens de EPI/Máquina, estoque,
  movimentos, entregas e vínculos de risco de uma org NUNCA sejam visíveis ou modificáveis por
  outra org, para garantir o isolamento multi-tenant exigido pela LGPD e pela constituição.
- P1 — Como consultor de SST, quero cadastrar no catálogo um EPI com todos os campos do ePGR
  (tipo, categoria, CA, validade do CA, fabricante, norma, tamanho, unidade de medida,
  descrição, foto), para que a Fase 2 (CRUD #18) tenha onde persistir os dados.
- P2 — Como consultor de SST, quero registrar movimentos de estoque tipados (compra, entrega,
  ajuste, descarte) e entregas de EPI a funcionários com status de assinatura
  (pendente/QR/link/manual), para suportar os fluxos de movimentação (#72) e entrega (#19).
- P3 — Como consultor de SST, quero vincular um EPI ao risco do GES indicando se ele neutraliza
  o risco, para preparar o relatório de adequação na Fase 2.

Success criteria mensuráveis (tecnologia-agnósticos):
- As 6 tabelas (epi_catalog, epi_stock, stock_movements, epi_deliveries, epi_delivery_items,
  epi_risk) existem após a migration; a taxonomia reusa categories (nenhuma epi_categories é
  criada).
- 100% das tabelas têm isolamento por tenant ativo: nenhum dado de uma org aparece em leitura
  para outra org, e toda escrita cross-tenant é rejeitada.
- O catálogo armazena todos os campos do ePGR listados acima.
- Quantidade inválida (≤ 0) é sempre rejeitada em movimentos e itens de entrega; saldo e mínimo
  nunca ficam negativos.
- Um token de assinatura preenchido nunca se repete; múltiplas entregas sem token coexistem.
- npm run test e npm run test:integration (incl. isolamento em Postgres efêmero —
  INTEGRATION_*/runIsolationSuite, NUNCA SQLite) passam; lint e tipos verdes.

Edge cases a considerar:
- Excluir uma categoria em uso por um item do catálogo (deve ser bloqueado — RESTRICT).
- Excluir um item do catálogo que já tem entregas registradas (item de entrega é histórico —
  RESTRICT impede a perda).
- Excluir uma entrega que originou um movimento de estoque (o movimento é preservado — SET
  NULL no delivery_id).
- Excluir um item do catálogo sem entregas (estoque e movimentos descem em CASCADE).
- Duas entregas com auth_token NULL ao mesmo tempo (devem coexistir — índice único parcial).
- Item do tipo "machine" sem CA/validade/norma (campos condicionais ficam nullable no banco;
  obrigatoriedade por tipo é validada na aplicação, na Fase 2).
- Tentativa de inserir valor fora do conjunto dos enums (deve ser rejeitada pelo banco).

FORA DE ESCOPO:
- UI/formulários, Server Actions, repositórios de CRUD; geração de QR/link e fluxo de
  assinatura; manutenção de saldo a partir dos movimentos; upload de foto (só o campo
  photo_path); relatórios/histórico; tabela de risco dedicada (risks) e migração da FK de
  epi_risk; lookup de CA/integrações externas.

REFERÊNCIAS:
- .specs/006-cadastros-base-pgr/ (modelo análogo; migration 0005);
  .specs/005-modelo-tenant-gate-pro/;
  .specs/004-multi-tenant-isolation/contracts/withorg-and-rls.md.
- Schemas-modelo: src/shared/db/schema/{categories,employees,ges,ges-job-roles,companies}.ts.
- Constituição v1.2.1 — Princípio I (Modelo B) e validação de schema.
- Cards dependentes: #18 (catálogo), #112 (categorias), #70 (estoque), #72 (movimentações),
  #19 (entrega), #20 (devolução), #21 (histórico).
```
