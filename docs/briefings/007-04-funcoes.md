# Briefing — CRUD de Funções (Cargos)

> **Issue**: #13 · [Fase 01] 04 · CRUD de Funções (Cargos) · módulo: funcionários, tela · Milestone "Fase 01 — Funcionários"
> **Tabela**: `job_roles` · **Spec do modelo**: 006 (migration `0005`) · **Spec do CRUD**: 007
> **Branch da fatia**: `feature/pgr-base-cruds`
> Consolida listagem (#13) e cadastro/edição (#54).

## 1. Contexto na cadeia do PGR

`job_roles` é o **cargo ocupacional** (com CBO) vinculado à empresa-cliente. É usado em dois
pontos da cadeia: na associação **Função ↔ GES** (`ges_job_roles`, que dimensiona a exposição) e
na lotação do **Funcionário** (`employees.job_role_id`).

## 2. Modelo de dados já existente (006)

| Coluna          | Tipo   | Constraint                                         | Obrigatório |
| --------------- | ------ | -------------------------------------------------- | ----------- |
| `id`            | `uuid` | PK                                                 | —           |
| `org_id`        | `text` | `NOT NULL` FK→`orgs.id` cascade                    | tenant      |
| `company_id`    | `uuid` | **`NOT NULL`** FK→`companies.id` cascade, indexado | **sim**     |
| `title`         | `text` | **`NOT NULL`** (título/nome)                       | **sim**     |
| `cbo`           | `text` | nullable (texto livre; tabela de CBO deferida)     | não         |
| `work_schedule` | `text` | nullable (jornada)                                 | não         |
| `description`   | `text` | nullable                                           | não         |

**`UNIQUE(org_id, company_id, title)`** — função não duplica por nome na mesma empresa do tenant.

## 3. Escopo do CRUD completo

- **Criar / Editar**: título/nome **(obrigatório)**, CBO (texto livre), horário de trabalho,
  descrição, **Empresa (obrigatório)**.
- **Listar**: busca por **título/CBO**, filtro por **Empresa**, estado vazio.
- **Detalhar**: `getById` org-scopado (a edição cobre os campos).
- **Excluir**: confirmação; **aviso/bloqueio** quando vinculada a GES (`ges_job_roles`) ou a
  funcionários (`employees.job_role_id`).

## 4. Métodos de repositório — existentes × a criar na 007

> `job-roles.ts` só tem `listJobRoles` e `createJobRole`. Faltam `getById`, `update`, `delete`,
> busca/filtro e a checagem de vínculos antes de excluir — **lacuna da task** que a 007 corrige.

| Método                                               | Estado          | Ação na 007                                  |
| ---------------------------------------------------- | --------------- | -------------------------------------------- |
| `listJobRoles(orgId, { companyId?, search? })`       | parcial         | **estender**                                 |
| `getJobRoleById(orgId, id)`                          | **inexistente** | **criar**                                    |
| `createJobRole(orgId, input)`                        | existe          | manter                                       |
| `updateJobRole(orgId, id, input)`                    | **inexistente** | **criar**                                    |
| `deleteJobRole(orgId, id)`                           | **inexistente** | **criar** (checar vínculos GES/funcionários) |
| contagem de vínculos (`ges_job_roles` / `employees`) | **inexistente** | **criar** p/ aviso de exclusão               |

## 5. Regras de negócio & validação

- Zod: `title` obrigatório não-vazio; `company_id` obrigatório e do tenant ativo.
- Unicidade `(org_id, company_id, title)`: duplicado na mesma empresa → bloqueado, com mensagem.
- CBO é **texto livre** (sem validação contra tabela oficial nesta fatia).
- Server Actions retornam `Result`; `logTenantEvent` sem PII; tudo em `withOrg`.

## 6. Edge cases

- Título duplicado na mesma empresa → bloqueado (UNIQUE); mesmo título em empresas diferentes do
  tenant → permitido.
- Excluir função **vinculada a GES** (`ges_job_roles` é cascade → o vínculo some e o nº de
  expostos do GES cai) **ou a funcionários** (`employees.job_role_id` é `SET NULL` → funcionário
  fica sem função) → **avisar do impacto** antes de confirmar (decidir na spec entre bloquear ou
  cascatear com aviso).
- Selecionar empresa de outro escritório → impossível (lista filtrada).
- Editar/excluir função de outro escritório → 404 (RLS).

## 7. Multi-tenant / isolamento

`requireTenantContext()` + `withOrg()`; RLS `job_roles_isolation` backstop. Empresa/função sempre
do tenant ativo.

## 8. Testes obrigatórios

- **Unit**: validação (título obrigatório; unicidade `(org, company, title)`).
- **Integração**: Server Actions + listagem/detalhe; checagem de vínculos na exclusão.
- **Isolamento em Postgres efêmero** (`INTEGRATION_*`, nunca SQLite).
- `npm run test` e `npm run test:integration` verdes.

## 9. Fora de escopo

Tabela de referência de CBO (CBO é texto livre); vínculo `job_roles ↔ training_catalog`
(módulo Treinamentos, Fase 4).

## 10. Referência ePGR (tela)

Cadastro de cargos/funções por empresa, com CBO e jornada; lista filtrável por empresa e busca
por título/CBO. Base para a associação Função↔GES e para a lotação do funcionário.

## 11. Critérios de aceite

- [ ] CRUD completo numa única fatia.
- [ ] Título único por `(escritório, empresa)`; duplicado bloqueado.
- [ ] Exclusão com confirmação; aviso quando vinculada a GES/funcionários.
- [ ] Funções de outro escritório nunca aparecem (backstop RLS).
