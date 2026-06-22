# Briefing — CRUD de Funcionários

> **Issue**: #14 · [Fase 01] 05 · CRUD de Funcionários · módulo: funcionários, tela · Milestone "Fase 01 — Funcionários"
> **Tabela**: `employees` · **Spec do modelo**: 006 (migration `0005`) · **Spec do CRUD**: 007
> **Branch da fatia**: `feature/pgr-base-cruds`
> Consolida listagem (#14), cadastro/edição (#15) e detalhe (#16).

## 1. Contexto na cadeia do PGR

`employees` é a **pessoa** vinculada a uma Empresa (obrigatório), a um GES e a uma Função
(ambos opcionais). É a folha da cadeia de cadastros e a entidade base referenciada por EPIs,
treinamentos, acidentes e medidas de controle nas fases seguintes.

## 2. Modelo de dados já existente (006)

| Coluna                               | Tipo              | Constraint                                                      | Obrigatório   |
| ------------------------------------ | ----------------- | --------------------------------------------------------------- | ------------- |
| `id`                                 | `uuid`            | PK                                                              | —             |
| `org_id`                             | `text`            | `NOT NULL` FK→`orgs.id` cascade                                 | tenant        |
| `company_id`                         | `uuid`            | **`NOT NULL`** FK→`companies.id` cascade, indexado              | **sim**       |
| `ges_id`                             | `uuid`            | nullable FK→`ges.id` **`SET NULL`**, indexado                   | não           |
| `job_role_id`                        | `uuid`            | nullable FK→`job_roles.id` **`SET NULL`**, indexado             | não           |
| `full_name`                          | `text`            | **`NOT NULL`**                                                  | **sim**       |
| `cpf`                                | `text`            | **`NOT NULL`**                                                  | **sim**       |
| `birth_date`                         | `date`            | nullable                                                        | não           |
| `sex`                                | `employee_sex`    | nullable (`male｜female｜not_informed`)                         | não           |
| `marital_status`                     | `marital_status`  | nullable (`single｜married｜divorced｜widowed｜stable_union`)   | não           |
| `phone` / `email` / `rg`             | `text`            | nullable                                                        | não           |
| `badge_number` / `badge_valid_until` | `text` / `date`   | nullable (crachá/validade)                                      | não           |
| `registration`                       | `text`            | nullable (matrícula)                                            | não           |
| `blood_type`                         | `text`            | nullable                                                        | não           |
| `admission_date` / `dismissal_date`  | `date`            | nullable                                                        | não           |
| endereço                             | `text` × 7        | `zip_code`…`state` nullable                                     | não           |
| `photo_path`                         | `text`            | nullable (foto 3x4; upload deferido)                            | não           |
| `status`                             | `employee_status` | **`NOT NULL DEFAULT 'active'`** (`active｜on_leave｜dismissed`) | sim (default) |

**`UNIQUE(org_id, cpf)`** — CPF único por tenant; mesmo CPF em escritórios distintos é permitido.

## 3. Escopo do CRUD completo

- **Criar / Editar** (mesmo formulário, **abas Geral / Endereço e Contato**): nome completo
  **(obrigatório)**, nascimento, sexo, estado civil, contatos (telefone/e-mail), RG, **CPF
  (obrigatório)**, **Empresa**, **GES**, **Função do GES** (picker filtrado pelas funções
  vinculadas ao GES selecionado), crachá/validade, matrícula, tipo sanguíneo, admissão/demissão,
  endereço, **status**, foto 3x4 (campo `photo_path`, sem upload nesta fatia).
- **Listar**: filtro por **Empresa** e **status** (Todos/Ativos/Afastados/Desligados), busca por
  **nome/GES/função**, colunas **Nome · GES/Obra · Empresa · Status · Opções**, estado vazio.
- **Detalhar**: ficha completa; funcionário inexistente ou de outro escritório → **404**; cards
  placeholder de Entrega de EPI / Histórico / OS (preenchidos nas Fases 2–6).
- **Excluir**: confirmação.

## 4. Métodos de repositório — existentes × a criar na 007

> `employees.ts` tem `listEmployees` e `createEmployee` (este já valida CPF e enums). Faltam
> `getById` (detalhe/404 cross-tenant), `update`, `delete`, busca/filtros e o picker de funções
> do GES — **lacuna da task** que a 007 corrige.

| Método                                                   | Estado                    | Ação na 007                                                  |
| -------------------------------------------------------- | ------------------------- | ------------------------------------------------------------ |
| `listEmployees(orgId, { companyId?, status?, search? })` | parcial                   | **estender** filtros/busca + join p/ exibir GES/Obra/Empresa |
| `getEmployeeById(orgId, id)`                             | **inexistente**           | **criar** (retorna `null` → 404 cross-tenant)                |
| `createEmployee(orgId, input)`                           | existe (valida CPF/enums) | manter                                                       |
| `updateEmployee(orgId, id, input)`                       | **inexistente**           | **criar** (revalidar CPF/enums)                              |
| `deleteEmployee(orgId, id)`                              | **inexistente**           | **criar**                                                    |
| funções do GES selecionado (via `ges_job_roles`)         | **inexistente**           | **criar** query p/ o picker                                  |

## 5. Regras de negócio & validação

- Zod antes da regra: `full_name` obrigatório; `cpf` → 11 dígitos (`cpfSchema` já existe); enums
  fechados (`employeeSexSchema`, `maritalStatusSchema`, `employeeStatusSchema` já existem);
  `company_id` obrigatório e do tenant.
- `UNIQUE(org_id, cpf)`: duplicado no mesmo escritório → rejeitado; mesmo CPF em escritórios
  distintos → aceito.
- **Picker de Função do GES**: exibe **apenas** as funções vinculadas ao GES selecionado
  (`ges_job_roles`), não todas as funções da empresa.
- Server Actions retornam `Result`; `logTenantEvent` sem PII; tudo em `withOrg`.

## 6. Edge cases

- CPF inválido (≠ 11 dígitos) → rejeitado; CPF duplicado no mesmo tenant → rejeitado; mesmo CPF
  em outro escritório → aceito.
- **GES sem funções vinculadas** → picker de Função vazio (permitir salvar sem função, já que
  `job_role_id` é nullable).
- Funcionário sem GES/sem função → permitido (FKs nullable).
- GES do funcionário é apagado → `ges_id` vira `NULL` (funcionário preservado); idem função.
- Detalhar/editar/excluir funcionário de **outro escritório** → **404** (nunca vaza).
- Valor de enum fora do conjunto → rejeitado (zod **e** banco).

## 7. Multi-tenant / isolamento

`requireTenantContext()` + `withOrg()`; RLS `employees_isolation` backstop. Detalhe cross-tenant
retorna 404 — nunca os dados do outro escritório.

## 8. Testes obrigatórios

- **Unit**: validação (CPF, enums fechados, obrigatórios).
- **Integração**: Server Actions/queries; **404 cross-tenant**; `UNIQUE(org_id, cpf)` permite
  mesmo CPF em orgs distintas e bloqueia duplicado no mesmo.
- **Isolamento em Postgres efêmero** (`INTEGRATION_*`, nunca SQLite).
- `npm run test` e `npm run test:integration` verdes.

## 9. Fora de escopo

ViaCEP e **upload de foto** (dependem de #68 / storage); contatos de emergência, CNH e passaporte
(deferidos no 006); aba/vínculo de Treinamentos (Fase 4).

## 10. Referência ePGR (tela)

Ficha de funcionário com dados pessoais, lotação (Empresa/GES/Função), crachá e status; lista com
filtros por empresa e status e busca; ficha de detalhe com cards de EPI/histórico/OS (placeholders
nesta fatia).

## 11. Critérios de aceite

- [ ] CRUD completo (criar/listar/detalhar/editar/excluir) numa única fatia.
- [ ] CPF inválido bloqueado; duplicado no mesmo escritório rejeitado; mesmo CPF aceito em
      escritórios distintos.
- [ ] Picker de Função exibe apenas funções do GES selecionado.
- [ ] Detalhe de funcionário de outro escritório → 404.
- [ ] Funcionários de outro escritório nunca aparecem (backstop RLS).
