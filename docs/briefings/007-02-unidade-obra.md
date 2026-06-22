# Briefing — CRUD de Unidade de Obra

> **Issue**: #71 · [Fase 01] 02 · CRUD de Unidade de Obra · módulo: empresas · Milestone "Fase 01 — Funcionários"
> **Tabela**: `work_units` · **Spec do modelo**: 006 (migration `0005`) · **Spec do CRUD**: 007
> **Branch da fatia**: `feature/pgr-base-cruds`

## 1. Contexto na cadeia do PGR

`work_units` é o **2º nível** da cadeia: `companies → work_units → ges`. Representa o
canteiro/filial/local de prestação de serviço, com endereço próprio, sob uma empresa-cliente.
É o local físico onde os GES (e a caracterização ambiental) existem.

## 2. Modelo de dados já existente (006)

| Coluna                    | Tipo          | Constraint                                         | Obrigatório no CRUD |
| ------------------------- | ------------- | -------------------------------------------------- | ------------------- |
| `id`                      | `uuid`        | PK                                                 | —                   |
| `org_id`                  | `text`        | `NOT NULL` FK→`orgs.id` cascade, indexado          | derivado do tenant  |
| `company_id`              | `uuid`        | **`NOT NULL`** FK→`companies.id` cascade, indexado | **sim**             |
| `name`                    | `text`        | **`NOT NULL`** (nome/local)                        | **sim**             |
| `contract_number`         | `text`        | nullable (nº do contrato)                          | não                 |
| `description`             | `text`        | **`NOT NULL`** (objeto/descrição)                  | **sim**             |
| endereço                  | `text` × 7    | `zip_code`…`state` nullable                        | não                 |
| `created_at`/`updated_at` | `timestamptz` | `DEFAULT now()` + trigger                          | —                   |

Filha de `companies` (cascade); pai de `ges`. RLS `work_units_isolation` (`app_runtime`/GUC).

## 3. Escopo do CRUD completo

- **Criar / Editar**: nome/local **(obrigatório)**, número do contrato, objeto/descrição
  **(obrigatório)**, endereço completo, **Empresa (FK, obrigatório)**; botão **"preencher com
  endereço da Empresa"** (copia o endereço do perfil da empresa selecionada).
- **Listar**: busca por **nome/contrato/empresa**; colunas **Nome · Nº Contrato · Empresa ·
  Cidade/UF**; estado vazio.
- **Detalhar**: `getById` org-scopado (a edição cobre os campos).
- **Excluir**: com confirmação; **bloquear/avisar se houver GES vinculados** (FK).

## 4. Métodos de repositório — existentes × a criar na 007

> O repositório (`src/shared/db/repositories/work-units.ts`) só tem `listWorkUnits` e
> `createWorkUnit`. Faltam `getById`, `update`, `delete` e busca — **lacuna da task** que a 007
> corrige (CRUD completo).

| Método                                          | Estado                     | Ação na 007                          |
| ----------------------------------------------- | -------------------------- | ------------------------------------ |
| `listWorkUnits(orgId, { search?, companyId? })` | parcial (sem busca/filtro) | **estender**                         |
| `getWorkUnitById(orgId, id)`                    | **inexistente**            | **criar**                            |
| `createWorkUnit(orgId, input)`                  | existe                     | manter                               |
| `updateWorkUnit(orgId, id, input)`              | **inexistente**            | **criar**                            |
| `deleteWorkUnit(orgId, id)`                     | **inexistente**            | **criar** (bloqueio/aviso se há GES) |

## 5. Regras de negócio & validação

- Zod antes da regra: `name`, `description` e `company_id` obrigatórios e não-vazios.
- `company_id` deve existir **dentro do tenant ativo** (FK + RLS); FK inválida → rejeitada.
- "Preencher com endereço da Empresa": só habilitado se a empresa selecionada tiver endereço.
- Escrita só passa se `org_id == tenant ativo`; Server Actions retornam `Result`; `logTenantEvent`
  sem PII.

## 6. Edge cases

- Empresa sem endereço → botão "copiar endereço" desabilitado (não copia vazio).
- Excluir unidade **com GES vinculados** → aviso/bloqueio (decidir na spec: bloquear ou
  confirmar cascata; a cadeia tem `ges.work_unit_id` cascade, então excluir a obra apagaria os
  GES — exibir aviso explícito).
- Selecionar empresa de outro escritório → impossível (lista filtrada pelo tenant).
- Editar/excluir unidade de outro escritório → 404 (RLS).

## 7. Multi-tenant / isolamento

`requireTenantContext()` + `withOrg()`; RLS `work_units_isolation` backstop. Empresa/obra sempre
do tenant ativo.

## 8. Testes obrigatórios

- **Unit**: validação dos obrigatórios.
- **Integração**: Server Actions + listagem/detalhe; FK de empresa restrita ao tenant.
- **Isolamento em Postgres efêmero** (`INTEGRATION_*`, nunca SQLite): unidade de outro escritório
  nunca aparece nem é editável.
- `npm run test` e `npm run test:integration` verdes.

## 9. Fora de escopo

ViaCEP (depende de #68).

## 10. Referência ePGR (tela)

Cadastro de obra/contrato vinculado à empresa, com endereço e objeto do contrato; lista com
filtro por empresa e busca por nome/contrato.

## 11. Critérios de aceite

- [ ] CRUD completo numa única fatia.
- [ ] Obrigatórios (nome, objeto/descrição, empresa) validados inline.
- [ ] "Preencher com endereço da Empresa" funciona e respeita empresa sem endereço.
- [ ] Exclusão com confirmação; aviso quando há GES vinculados.
- [ ] Unidades de outro escritório nunca aparecem (backstop RLS).
