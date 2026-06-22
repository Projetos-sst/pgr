# Briefing — Cadastros base do PGR (cadeia de dados Empresa → Funcionário)

> **Fonte da verdade desta fatia.** Anexo obrigatório do `/speckit-specify`. Leia
> inteiro antes de escrever a spec. Captura as decisões travadas no brainstorming,
> as divergências entre a issue original e o estado real do repo, e o modelo de
> dados proposto (MVP). Identificadores de código em inglês; termos fiscais/SST
> intraduzíveis (CNPJ, CNAE, GES, CBO, NR) mantidos em PT.

## 1. Objetivo da fatia

Modelar e migrar as **tabelas base** que sustentam todo o domínio PGR — a cadeia
**Empresa → Unidade de Obra → GES → Função/Funcionário** — com isolamento
multi-tenant (RLS), constraints de integridade e o nº de trabalhadores expostos por
GES derivado da associação Função↔GES.

Esta é a **primeira fatia de dados de domínio** do projeto. Hoje só existem 5 tabelas
reais (`orgs`, `users`, `org_memberships`, `companies`, `tenant_probe`); tudo de
negócio no doc 02 ainda é plano. Portanto, **esta fatia fixa o precedente de nomes e
padrões para todo o PGR**.

## 2. Decisões travadas no brainstorming

1. **Seguir o repo, não a issue ao pé da letra.** A issue foi escrita sobre a premissa
   da 004 (tenant = org do Clerk, tabelas em PT, criar `empresas`), que a **005 já
   corrigiu**. O design segue o repo real.
2. **Modelo de tenant = Modelo B (005).** Toda tabela usa `org_id text NOT NULL →
orgs.id` e RLS via `current_setting('app.current_org', true)` no papel
   `app_runtime` — **não** `organization_id` do Clerk. Padrão canônico:
   `src/shared/db/schema/tenant-probe.ts` / `companies.ts`.
3. **Identificadores em inglês** (regra do `CODE_STANDARDS.md`); termos
   fiscais/SST intraduzíveis preservados em PT (`cnpj`, `razao_social`,
   `nome_fantasia`, `cnae`, `ges`, `cbo`).
4. **`empresas` é `ALTER` em `companies`** (que já existe), não uma tabela nova.
5. **Este design supera o esboço de `sectors` do doc 02** (ver §4).
6. **Escopo = fundação de dados apenas** (ver §7). UI, lookup de CNPJ, ViaCEP e
   uploads são fatias seguintes.
7. **`n_trabalhadores_expostos` é derivado, sem trigger** (ver §6.3).

## 3. Divergências issue × repo (e como resolver)

| #   | Issue diz                                                        | Realidade do repo                                                                                          | Resolução                                                                                 |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | tenant = `organization_id` (Clerk)                               | Modelo B: tenant = `org_id` (`orgs.id`); RLS por `current_setting('app.current_org')`, papel `app_runtime` | toda tabela usa `org_id` + padrão `tenant_probe`                                          |
| 2   | tabelas/colunas em PT                                            | repo + `CODE_STANDARDS.md` + doc 02 usam inglês                                                            | nomes em inglês; só termos fiscais/SST ficam em PT                                        |
| 3   | criar `empresas`                                                 | `companies` já existe (`cnpj`, `razao_social`, RLS, `uq_companies_org_id_cnpj`)                            | `ALTER TABLE companies`, não `CREATE`                                                     |
| 4   | migrations em `lib/db/migrations/`                               | real: `src/shared/db/migrations/` (próxima `0005_*`)                                                       | gerar `0005_*` no caminho real                                                            |
| 5   | "verificar base de CBO"                                          | —                                                                                                          | CBO é **campo texto** em `job_roles`; tabela de referência CBO completa fica fora (YAGNI) |
| —   | referencia `.specs/004-epgr-feature-parity/01-cadastros-base.md` | arquivo **não existe** no repo                                                                             | tratar este briefing como a fonte                                                         |

## 4. Modelo de entidades — mapa de nomes e reconciliação

| Issue (PT)         | Tabela          | Ação     | Nota                                                                                            |
| ------------------ | --------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `empresas`         | `companies`     | `ALTER`  | já existe; adiciona colunas                                                                     |
| `unidades_de_obra` | `work_units`    | `CREATE` | contrato/local de obra; FK→`companies`                                                          |
| `ges`              | `ges`           | `CREATE` | Grupo de Exposição Similar (jargão SST)                                                         |
| `funcoes`          | `job_roles`     | `CREATE` | já previsto no doc 02                                                                           |
| `categorias`       | `categories`    | `CREATE` | catálogo EPI / Máquinas                                                                         |
| `funcionarios`     | `employees`     | `CREATE` | já previsto no doc 02                                                                           |
| `funcao_setor`     | `ges_job_roles` | `CREATE` | junção GES↔Função + nº trabalhadores (o nome PT "funcao_setor" engana: é função↔GES, não setor) |

**Reconciliação com o doc 02 (decisão consciente):**

- O doc 02 esboçava `sectors` como agrupador. No modelo ePGR real, **`ges` substitui
  `sectors`** — é o agrupamento de exposição correto. `sectors` sai do plano.
- `employees` vincula **`ges_id` + `job_role_id`** (issue: "funcionário vincula GES +
  Função"), no lugar do `sector_id` + `job_role_id` do doc 02.
- **Ripple registrado, fora desta fatia:** quando o módulo PGR vier, `risks.sector_id`
  do doc 02 vira `risks.ges_id`.

**Cadeia de FKs:**

```
companies ──< work_units ──< ges ──< ges_job_roles >── job_roles
                              │
employees >──┤ ges_id, job_role_id (FK, nullable)
categories  (catálogo independente: epi | machine)
```

Todas com `org_id text NOT NULL → orgs.id`, índice em `org_id`, RLS `app_runtime`.

## 5. Colunas propostas por tabela (MVP)

> Proposta MVP, refinável na `data-model.md` da spec. Convenção comum a todas:
> `id uuid PK default gen_random_uuid()`, `org_id text NOT NULL → orgs.id` (indexado),
> `created_at timestamptz NOT NULL default now()`, `updated_at timestamptz NOT NULL`
> (trigger `set_updated_at`, padrão migration `0001`). `*` = NOT NULL.

### 5.1 `companies` (ALTER — adiciona colunas)

Existentes: `id`, `org_id`, `cnpj`, `razao_social`, `created_at`.
Adicionar: `nome_fantasia`, `phone`, `email`, `cnae`, `main_activity`,
`risk_grade smallint CHECK (between 1 and 4)` (Grau de Risco NR-04), `logo_path`
(chave do Storage; upload em fatia futura), endereço estruturado
(`zip_code`, `street`, `number`, `complement`, `district`, `city`, `state`),
`updated_at` (+ trigger).

> A spec decide se `razao_social` passa a `NOT NULL` (tabela praticamente vazia hoje).

### 5.2 `work_units`

`company_id` FK→`companies` _ · `name` _ · `contract_number` · `description` \* ·
endereço estruturado (CEP via ViaCEP na fatia de UI).

### 5.3 `ges`

`company_id` FK→`companies` _ · `work_unit_id` FK→`work_units` _ · `name` \* ·
`process_description` · ambiente: `construction_type`, `ceiling_height numeric`
(pé direito/altura), `floor`, `roof` (cobertura), `lighting`, `ventilation`,
`other_characteristics`.

> `n_trabalhadores_expostos` **não** é coluna — é derivado (§6.3).

### 5.4 `job_roles`

`company_id` FK→`companies` _ · `title` _ · `cbo` (texto) · `work_schedule` ·
`description` · `U(org_id, company_id, title)` (opcional — confirmar na spec).

> "Treinamentos obrigatórios vinculados" (M2M com `training_catalog`) fica **fora**:
> `training_catalog` ainda não existe → módulo Treinamentos.

### 5.5 `categories`

`type` enum `category_type` (`epi` | `machine`) _ · `name` _ · `note`.

### 5.6 `employees`

`full_name` _ · `cpf` _ `U(org_id, cpf)` · `birth_date` · `sex` enum `employee_sex` ·
`marital_status` enum `marital_status` · `phone` · `email` · `rg` ·
`company_id` FK→`companies` · `ges_id` FK→`ges` · `job_role_id` FK→`job_roles` ·
`badge_number` (crachá) · `badge_valid_until` · `registration` (matrícula) ·
`blood_type` · `admission_date` · `dismissal_date` · endereço estruturado ·
`photo_path` (foto 3x4; upload futuro) · `status` enum `employee_status`.

> **Deferidos (YAGNI, confirmar na spec):** `cnh`, `passport`, e **contatos de
> emergência** (tabela-filha) — não são necessários à cadeia nem ao núcleo de
> identidade do MVP.

### 5.7 `ges_job_roles` (junção)

`ges_id` FK→`ges` _ · `job_role_id` FK→`job_roles` _ ·
`worker_count integer * CHECK (> 0)` (nº de trabalhadores) · `work_schedule`
(jornada) · `U(org_id, ges_id, job_role_id)`.

## 6. Regras e invariantes

### 6.1 Isolamento multi-tenant (RLS) — em TODA tabela

Replicar o padrão canônico (`tenant_probe`/`companies`) como SQL custom na migration:

```sql
ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "<t>_isolation" ON <t> AS PERMISSIVE FOR ALL TO app_runtime
  USING (org_id = current_setting('app.current_org', true))
  WITH CHECK (org_id = current_setting('app.current_org', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<t> TO app_runtime;
```

RLS é **backstop** (defesa em profundidade), não a única barreira — o escopo por
`org_id` na aplicação é a primeira linha.

### 6.2 Integridade

- `UNIQUE(org_id, cpf)` em `employees` (CPF nunca global — empresas diferentes podem
  repetir).
- FKs válidas em toda a cadeia; `ON DELETE` coerente (provável `cascade` company→filhos;
  confirmar por entidade na spec).
- Enums no banco via `pgEnum`: `category_type`, `employee_sex`, `marital_status`,
  `employee_status`. `risk_grade` é `smallint CHECK (1..4)` (grau numérico, não enum).

### 6.3 `n_trabalhadores_expostos` por GES — DERIVADO, sem trigger

**Recomendação (KISS/DRY):** **não** denormalizar. Calcular por agregação na leitura —
`SUM(worker_count)` de `ges_job_roles` agrupado por `ges_id` — numa query de
repositório. Fonte única de verdade (`ges_job_roles`), zero drift, zero trigger.

**Alternativa** (só se a UI/exportação exigir coluna persistida): coluna em `ges`
recalculada **na Server Action** que escreve `ges_job_roles` (mesmo padrão do
`risk_level` no doc 02). Trigger no Postgres fica **descartado** — lógica escondida e
difícil de testar.

> Decisão a confirmar na spec; recomendação é a leitura por agregação.

## 7. Escopo

**Dentro:**

- Schemas Drizzle das 7 entidades (1 arquivo por tabela em `src/shared/db/schema/`).
- `ALTER` em `companies` + `CREATE` das 6 novas.
- Migration `0005_*` com enums, RLS, policies, grants e triggers `set_updated_at`.
- Repositórios de acesso (escopados por `org_id`), incluindo a query de agregação do
  nº de expostos.
- Testes unitários + integração de RLS (Postgres efêmero).

**Fora (fatias seguintes / YAGNI):**

- Formulários/telas das 7 entidades; lookup de CNPJ; ViaCEP; upload de logo/foto 3x4
  (só os campos `*_path` entram agora).
- Tabela de referência de CBO.
- Vínculo `job_roles` ↔ `training_catalog` (módulo Treinamentos).
- Contatos de emergência, CNH, passaporte (deferidos).
- Enforcement de plano/gate; vínculo `employees` ↔ `risks` (módulo PGR).

## 8. Testes (obrigatório — fatia não conclui sem eles)

- **Unitários** (mock/SQLite): validações Zod, domínios de enum, `worker_count > 0`,
  `risk_grade ∈ 1..4`, cálculo do nº de expostos (agregação).
- **Integração — RLS contra Postgres efêmero** (`INTEGRATION_*`, **nunca SQLite**):
  - dados da org A não vazam para a org B (uma asserção por tabela);
  - `UNIQUE(org_id, cpf)` bloqueia CPF duplicado na mesma org e permite o mesmo CPF em
    orgs distintas;
  - integridade de FK ao longo da cadeia;
  - nº de expostos reflete a soma de `ges_job_roles`.
- `npm run test` e `npm run test:integration` verdes; lint + types verdes.

## 9. Critérios de aceite (corrigidos)

- [ ] 6 tabelas novas criadas + `companies` alterada via migration `0005_*` sem erro.
- [ ] RLS habilitado e policy de isolamento `app_runtime` em todas (padrão `tenant_probe`).
- [ ] `UNIQUE(org_id, cpf)` impede CPF duplicado na mesma org.
- [ ] `n_trabalhadores_expostos` (derivado) reflete a soma de `ges_job_roles` por GES.
- [ ] FKs válidas em toda a cadeia `companies → work_units → ges → ges_job_roles ←
job_roles`, e `employees → (company, ges, job_role)`.
- [ ] Enums `category_type`, `employee_sex`, `marital_status`, `employee_status` e
      `risk_grade` (CHECK 1..4) definidos.
- [ ] Escopo por `org_id` em toda leitura/escrita; testes de isolamento verdes.

## 10. Decisões ainda abertas (resolver na spec/clarify)

1. Nomes `work_units` e `ges_job_roles` (confirmar).
2. `n_trabalhadores_expostos`: agregação na leitura (recomendado) vs coluna recalculada
   na action.
3. `razao_social` passa a `NOT NULL`?
4. `ON DELETE` por FK (cascade vs restrict) por entidade.
5. `U(org_id, company_id, title)` em `job_roles` (manter?).

## 11. Referências

- `docs/architecture/02-modelagem-de-dados.md` — convenções e modelo planejado.
- `.specs/004-multi-tenant-isolation/` — padrão `withOrg` + RLS + `tenant_probe`.
- `.specs/005-modelo-tenant-gate-pro/` — Modelo B (tenant = `orgs.id`).
- `src/shared/db/schema/companies.ts`, `tenant-probe.ts` — padrão canônico de RLS.
- `src/shared/db/migrations/0004_modelo_tenant_gate_pro.sql` — referência de migration
  com GRANT/policy custom.
- Constituição — Princípios I (multi-tenant) e V (Postgres como fonte de verdade).
