# Briefing — Fatia 035: CRUD de Veículos (Fase 08 · 02)

**Issue**: #99 · `[Fase 08] 02 · CRUD de Veículos`
**Branch**: `feature/035-vehicles-crud` (base: **`feature/034`** — empilhado; usa a tabela `vehicles` da fatia 034)
**Data**: 2026-07-15

## 1. A task

CRUD completo de `vehicles` — a frota do escritório, pré-requisito das inspeções veiculares. Mirror do
padrão `companies`.

## 2. Implementação (as-built)

- **Domínio** `domains/inspections/vehicles.ts`: `vehicleInputSchema` — **placa BR legado `AAA-0000`
  OU Mercosul `AAA0A00`** (normaliza maiúsculas/sem separador), `type` enum opcional, `initial_km ≥ 0`
  (coerce), demais opcionais; `VEHICLE_TYPE_LABELS`, `toVehicleListItem`.
- **Repositório** `repositories/vehicles.ts`: CRUD completo (`withOrg` + `auditedTenantWrite` +
  paginação + busca por placa/modelo/marca). Placa duplicada na org → `DUPLICATE` (unique
  `(org_id, plate)`); mesma placa em outra org é permitida.
- **Superfícies (4 partes)**: Server Actions (`officeAction`) + REST `/api/v1/vehicles(/[id])`
  (`201`/`204`) + api-design + Postman.
- **UI**: `/veiculos` (lista + busca), `/veiculos/new`, `/veiculos/[id]/edit`, remoção inline + nav.
- **Testes**: unit (schema de placa legado/Mercosul/inválida + KM) + **integração em Postgres efêmero**
  (validada em Postgres real): CRUD + **isolamento cross-tenant** + **unique de placa por org**.
  `typecheck`/`lint`/`build` verdes; `db:generate` "No schema changes" (sem migration — modelo é da 034).

## 3. Nota de empilhamento

Depende do schema da fatia **034** (tabela `vehicles`). PR com base `feature/034` (stacked) — quando a
034 mergear, o GitHub re-targeta a base para `develop` automaticamente.

## 4. Prompt para `/speckit-specify`

```
/speckit-specify

GIT_BRANCH_NAME: feature/035-vehicles-crud

Feature: CRUD de Veículos

CONTEXTO:
SST Manager — CRUD de vehicles (frota), pré-requisito das inspeções veiculares. Modelo na fatia 034.
Seguir CLAUDE.md (withOrg + RLS; Postgres efêmero nos testes).

User stories:
- (P1) Como gestor, quero cadastrar/listar/editar/excluir veículos.

Success criteria:
- Placa validada (BR legado/Mercosul); dados escopados ao tenant; placa única por org.

Edge cases:
- Placa duplicada na org (DUPLICATE); mesma placa em outra org é permitida.

Restrições (constituição):
- Escopado ao tenant ativo. Zod em toda Server Action.

NÃO inventar solução técnica aqui — só o "o quê" e o "porquê".
Conteúdo da spec em pt-BR; branch e commits em inglês.
```
