# Briefing — CRUD de Empresa (cliente)

> **Issue**: #69 · [Fase 01] 01 · CRUD de Empresa (cliente) · módulo: empresas · Milestone "Fase 01 — Funcionários"
> **Tabela**: `companies` · **Spec do modelo**: 006 (migration `0005`) · **Spec do CRUD**: 007
> **Branch da fatia**: `feature/pgr-base-cruds`

## 1. Contexto na cadeia do PGR

`companies` é a **entidade-raiz** da cadeia de dados do PGR:

```
companies → work_units → ges → ges_job_roles ⋈ job_roles
companies → job_roles
companies → employees (→ ges, → job_role)
```

A Empresa-cliente é o contratante do escritório de SST. É de onde saem os **dados legais do
cabeçalho do PGR** (razão social, CNPJ, CNAE, Grau de Risco NR-04, endereço, logo). No Modelo B
ela é uma **dimensão de dados dentro do tenant** (o escritório = `orgs.id`), **nunca** uma
fronteira de isolamento.

## 2. Modelo de dados já existente (006)

`companies` foi criada na 005 e estendida na 006 (migration `0005`). Colunas reais:

| Coluna                    | Tipo          | Constraint                                                          | Obrigatório no CRUD                 |
| ------------------------- | ------------- | ------------------------------------------------------------------- | ----------------------------------- |
| `id`                      | `uuid`        | PK `gen_random_uuid()`                                              | —                                   |
| `org_id`                  | `text`        | `NOT NULL` FK→`orgs.id` cascade, indexado                           | derivado do tenant ativo            |
| `cnpj`                    | `text`        | nullable                                                            | não (validar formato se preenchido) |
| `razao_social`            | `text`        | **`NOT NULL`**                                                      | **sim**                             |
| `nome_fantasia`           | `text`        | nullable                                                            | não                                 |
| `phone`                   | `text`        | nullable                                                            | não                                 |
| `email`                   | `text`        | nullable                                                            | não                                 |
| `cnae`                    | `text`        | nullable                                                            | não                                 |
| `main_activity`           | `text`        | nullable                                                            | não                                 |
| `risk_grade`              | `smallint`    | `CHECK (between 1 and 4)` (NR-04)                                   | **sim** (regra de negócio)          |
| `logo_path`               | `text`        | nullable (chave de Storage; upload deferido)                        | não                                 |
| endereço                  | `text` × 7    | `zip_code`/`street`/`number`/`complement`/`district`/`city`/`state` | não                                 |
| `created_at`/`updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` + trigger `set_updated_at`                 | —                                   |

**Constraints relevantes**: `idx_companies_org_id`; `uq_companies_org_id_cnpj` (dedup
**por tenant** — mesmo CNPJ pode existir em escritórios distintos; **não** há único global);
`companies_risk_grade_check`; policy `companies_isolation` (RLS `app_runtime`/GUC).

## 3. Escopo do CRUD completo

- **Criar / Editar** (mesmo formulário): CNPJ, **razão social (obrigatório)**, nome fantasia,
  telefone, e-mail, endereço completo, CNAE + atividade principal, **Grau de Risco 1–4
  (obrigatório)**, logo (campo `logo_path`, sem upload nesta fatia).
- **Listar**: tabela das empresas do escritório com **busca por razão social/CNPJ**; estado
  vazio orientando o primeiro cadastro.
- **Detalhar**: `getById` org-scopado (a tela de edição já exibe todos os campos; o detalhe pode
  ser a própria edição).
- **Excluir**: com confirmação e **aviso de cascata** — `ON DELETE CASCADE` apaga
  `work_units`/`ges`/`ges_job_roles`/`job_roles`/`employees` da empresa.

## 4. Métodos de repositório — existentes × a criar na 007

> CRUD **completo**. O repositório atual (`src/shared/db/repositories/companies.ts`) só tem
> `listCompanies` e `createCompany`, e o `createCompany` **ignora** os campos novos da 006
> (só grava `cnpj`/`razaoSocial`). Isso é uma **lacuna da task** — a 007 deve corrigir.

| Método                              | Estado              | Ação na 007                                          |
| ----------------------------------- | ------------------- | ---------------------------------------------------- |
| `listCompanies(orgId, { search? })` | parcial (sem busca) | **estender** com busca por razão social/CNPJ         |
| `getCompanyById(orgId, id)`         | **inexistente**     | **criar** (detalhe; retorna `null`/404 cross-tenant) |
| `createCompany(orgId, input)`       | parcial             | **estender** input para todos os campos da 006       |
| `updateCompany(orgId, id, input)`   | **inexistente**     | **criar**                                            |
| `deleteCompany(orgId, id)`          | **inexistente**     | **criar** (com semântica de cascata)                 |

## 5. Regras de negócio & validação

- Validação **zod antes da regra**: `razao_social` não-vazio; `risk_grade ∈ {1,2,3,4}`
  (`riskGradeSchema` já existe); `cnpj` → 14 dígitos quando preenchido (`cnpjSchema` já existe).
- Unicidade `(org_id, cnpj)`: duplicado no mesmo escritório é **bloqueado**; mesmo CNPJ em
  escritórios distintos é **permitido**.
- Escrita só passa se `org_id == tenant ativo` (RLS `WITH CHECK`).
- Server Actions retornam o contrato `Result` (ver §"Contrato Result" no prompt — **não existe
  ainda no projeto**, a 007 o estabelece). `logTenantEvent` na fronteira de tenant, sem PII.

## 6. Edge cases

- Mesmo CNPJ em escritórios distintos → permitido; duplicado no mesmo escritório → bloqueado
  com mensagem clara.
- Grau de Risco fora de 1..4 → rejeitado (zod **e** CHECK do banco).
- CNPJ informado em formato inválido (≠ 14 dígitos) → rejeitado; CNPJ vazio → aceito (nullable).
- Excluir empresa com obras/GES/funcionários vinculados → confirmação + aviso explícito do
  impacto em cascata.
- Editar/detalhar/excluir empresa de **outro escritório** → 404 / nunca encontrada (RLS).

## 7. Multi-tenant / isolamento

Tenant ativo via `requireTenantContext()`; toda leitura/escrita dentro de `withOrg(orgId, …)`.
RLS `companies_isolation` é **backstop**. O id do tenant **nunca** vem de query string, body ou
header.

## 8. Testes obrigatórios

- **Unit**: validação (razão social obrigatória, `risk_grade` 1..4, formato de CNPJ).
- **Integração**: Server Actions create/update/delete + query de listagem/detalhe.
- **Isolamento em Postgres efêmero** (`INTEGRATION_*`, **nunca SQLite**): empresa de outro
  escritório não aparece, não é editável e não é excluível; mesmo CNPJ aceito em orgs distintas.
- `npm run test` e `npm run test:integration` verdes.

## 9. Fora de escopo

Lookup automático de CNPJ (Receita) e ViaCEP (dependem de #68 — integrações externas); **upload**
da logo (só o campo `logo_path` existe). Sem essas integrações, os campos são preenchidos
manualmente.

## 10. Referência ePGR (tela)

Cadastro de empresa-cliente com dados legais para o cabeçalho do laudo: razão social, CNPJ, CNAE,
Grau de Risco (NR-04), endereço e logo. Lista pesquisável com estado vazio orientando o 1º
cadastro.

## 11. Critérios de aceite

- [ ] CRUD completo (criar/listar/editar/detalhar/excluir) numa única fatia.
- [ ] Grau de Risco (1–4) obrigatório e validado; fora de 1..4 rejeitado.
- [ ] Mesmo CNPJ aceito em escritórios distintos; duplicado no mesmo escritório bloqueado.
- [ ] Exclusão pede confirmação e avisa do impacto em cascata.
- [ ] Empresa de outro escritório nunca aparece, nem é editável/excluível (backstop RLS).
