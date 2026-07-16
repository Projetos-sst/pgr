# Briefing — Fatia 034: Modelo de dados de inspeções (Fase 08 · 01)

**Issue**: #95 · `[Fase 08] 01 · Modelo de dados — Inspeções, Planos, Itens e Veículos`
**Branch**: `feature/034-inspections-data-model` (base: `develop`)
**Data**: 2026-07-15

## 1. A task

Fundação de dados do módulo de inspeções (paridade ePGR): planos/checklists, itens, veículos, inspeções
(veicular/equipamento/segurança), respostas de itens e ocorrências. Schema + migration + RLS + tipos +
consultas base + isolamento. **Sem UI/CRUD** (fatias 035+). Análoga às fatias 006/008.

## 2. Implementação (as-built)

- **Schema** `db/schema/inspections.ts` — **6 tabelas** tenant-isoladas + **5 enums**:
  - `inspection_plans` (type, subtype, title, description) + `inspection_plan_items` (plan_id cascade,
    description, default_value, order).
  - `vehicles` (plate, brand, model, type, color, owner, initial_km ≥ 0 [CHECK], photo_path, notes;
    `UNIQUE(org_id, plate)`).
  - `inspections` (cabeçalho **polimórfico** por `type`: plan_id/vehicle_id/equipment_catalog_id/
    company_id nulláveis `SET NULL`; campos veiculares + de segurança; status).
  - `inspection_item_responses` (inspection_id/plan_item_id cascade, value, observation;
    `UNIQUE(inspection_id, plan_item_id)`).
  - `inspection_occurrences` (inspection_id cascade, description, severity).
  - Enums: `inspection_type` (vehicular|equipment|safety), `inspection_status`
    (pending|in_progress|completed|cancelled), `vehicle_type` (8), `inspection_category` (5),
    `occurrence_severity` (low|medium|high).
- **RLS/GRANT/triggers**: toda tabela `enableRLS()` + policy `app_runtime` (`current_setting`) + GRANT +
  `set_updated_at` (SQL custom na migration `0018_inspections_data_model`). Índices em `org_id` + FKs +
  compostos (`(org_id,type)`, `(inspection_id,plan_item_id)`).
- **Tipos** inferidos (`Inspection`, `Vehicle`, ... + `New*`) exportados.
- **Consultas base** `repositories/inspections.ts`: `list*`/`get*ById` de veículos/planos/inspeções
  (`withOrg` + paginação + filtro por tipo). As fatias de CRUD estendem com escrita.
- **⚠️ Migration `0018`** colide com as fatias 07 paralelas (`schedule_events`/`org_billing`/
  `user_is_master`) — **renumerar no rebase**.
- **Testes**: **integração em Postgres efêmero** (validada localmente contra Postgres real): semeia
  veículo/plano/inspeção em org_a e org_b → isolamento (listagens/getById cross-tenant não vazam) +
  filtro por tipo. `typecheck`/`lint`/`build` verdes.

## 3. Prompt para `/speckit-specify`

```
/speckit-specify

GIT_BRANCH_NAME: feature/034-inspections-data-model

Feature: Modelo de dados de inspeções

CONTEXTO:
SST Manager — fundação de dados do módulo de inspeções (paridade ePGR). Schema Drizzle como fonte da
verdade; toda tabela tenant-isolada (org_id + RLS app_runtime + withOrg). Seguir CLAUDE.md (Postgres
efêmero nos testes; NUNCA SQLite).

User stories:
- (P1) Como sistema, preciso do schema de planos/itens/veículos/inspeções/respostas/ocorrências para as
  fatias de CRUD da Fase 8 com tipagem segura.
- (P2) Como sistema, toda consulta retorna só a organização ativa (sem vazamento).

Success criteria:
- Todas as tabelas existem após a migration; tipos inferidos disponíveis; consultas base isoladas.

Edge cases:
- Plano sem itens; inspeção sem veículo (só veicular exige); ocorrência sem plano de ação (opcional).

Restrições (constituição):
- Todo acesso escopado ao tenant ativo (orgs.id da sessão).

NÃO inventar solução técnica aqui — só o "o quê" e o "porquê".
Conteúdo da spec em pt-BR; branch e commits em inglês.
```
