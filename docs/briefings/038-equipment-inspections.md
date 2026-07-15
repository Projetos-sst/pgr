# Briefing — Fatia 038: Inspeções de equipamentos (issue #106)

## Contexto

Fase 08 (Módulo de Inspeções). Contrapartida da inspeção veicular (037), agora para
**máquinas/equipamentos**. Mesmo fluxo em **2 passos** (cabeçalho + checklist tri-state).

Base: `feature/037-vehicular-inspections` (stacked). **Zero migration** — tabelas/enums/RLS são da 034.

## Diferenças em relação à veicular (037)

- Cabeçalho referencia um **equipamento do catálogo** (`epi_catalog` tipo `machine`) via
  `equipmentCatalogId`, e um **plano do tipo `equipment`** — não há campos veiculares
  (motorista/CNH/quilometragem/rota).
- O **checklist tri-state** é **reutilizado** do módulo veicular (`checklistSchema`/`ChecklistRow`
  importados de `vehicular-inspections`), evitando duplicar o contrato.
- Integridade: `assertEquipmentAndPlan` exige equipamento **`machine`** do tenant **e** plano
  **`equipment`** do tenant; senão → `422 FK_NOT_FOUND`.

## Superfície (mandato de 4 partes)

1. **Server Action** — `actions/inspections/equipment-inspections.ts`
   (`list/get/create/updateHeader/saveChecklist/delete` + options: catálogo `machine` + planos
   `equipment`).
2. **REST** — `/api/v1/equipment-inspections` (GET `?status=`, POST 201) + `/[id]` (GET/PUT/DELETE 204)
   - `/[id]/checklist` (PUT conclui).
3. **Docs** — `docs/api/api-design.md` (linha + bullet).
4. **Postman** — pasta "Inspecoes de equipamentos" + vars `equipmentCatalogId`/`equipmentInspectionId`.

- **UI** — `/inspecoes-equipamentos` (lista, novo=passo 1, `[id]`=checklist, edit, delete) + nav.

## Camadas

- Domínio: `domains/inspections/equipment-inspections.ts` (Zod header + reexporta checklist).
- Repositório: `repositories/equipment-inspections.ts` (`withOrg` + `auditedTenantWrite`; reusa
  `listEpiCatalog` para o picker).

## Erros

Reusa `VALIDATION`/`FK_NOT_FOUND`/`NOT_FOUND`/`FORBIDDEN`. Sem novos códigos.

## Testes

- **Unit** — header schema (uuid/data), checklist reutilizado, projeção.
- **Integração** (Postgres efêmero) — create (machine+equipment), `FK_NOT_FOUND` p/ equipamento `epi`
  e p/ plano veicular, checklist → completed, listagem só de equipamentos, isolamento cross-tenant.
