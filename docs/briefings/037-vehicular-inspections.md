# Briefing — Fatia 037: Inspeções veiculares (issue #104)

## Contexto

Fase 08 (Módulo de Inspeções). Depende do modelo de dados (034) e do CRUD de planos (036 — o
checklist reutilizável). Esta fatia entrega a **execução** de uma inspeção veicular: um fluxo em
**2 passos** (cabeçalho + preenchimento do checklist).

Base: `feature/036-inspection-plans-crud` (stacked). **Zero migration** — tabelas/enums/RLS são da 034.

## Fluxo em 2 passos

1. **Cabeçalho** (`inspections` `type=vehicular`): escolhe o **veículo** + o **plano veicular** e os
   dados de rota (`responsible`, `driverName`, `driverLicense`, `currentKm`, `route`, `notes`,
   `inspectedAt`). Cria a inspeção em `in_progress`.
2. **Checklist** (`inspection_item_responses`): uma resposta por item do plano — `value` **tri-state**
   (`true` conforme / `false` não conforme / `null` N/A) + `observation`. Salvar **substitui** as
   respostas e conclui (`status=completed`).

## Decisões

- **Integridade referencial na app**: `createVehicularInspection`/`update` validam que veículo e plano
  são do tenant **e** que o plano é `vehicular` antes de gravar. Cross-tenant/plano errado → repo
  retorna `null`/`false` → Action/REST mapeiam `422 FK_NOT_FOUND` (`ReferenceNotFoundError`).
- **`planItemId` forjado é ignorado** no `saveChecklist`: só entram respostas de itens que pertencem
  ao plano da inspeção (defesa em profundidade; o schema Zod já valida uuid antes).
- **Detalhe = merge**: `getVehicularInspection` faz `LEFT JOIN` dos itens do plano com a resposta
  desta inspeção, então a UI mostra os itens mesmo sem resposta (default do item vira sugestão).
- **Pickers** (veículo/plano) carregados no Server Component via repo base (`listVehicles`/
  `listInspectionPlans`, filtrando `type=vehicular`), limitados a `PAGE_SIZE_MAX` — autocomplete
  server-side fica para fatia futura (limitação registrada no código).
- **Status derivado do fluxo**: `pending` (default do schema) nunca é usado aqui — o cabeçalho já nasce
  `in_progress` e o checklist conclui em `completed`.

## Superfície (mandato de 4 partes)

1. **Server Action** — `actions/inspections/vehicular-inspections.ts`
   (`list/get/create/updateHeader/saveChecklist/delete`).
2. **REST** — `/api/v1/vehicular-inspections` (GET `?status=`, POST 201) + `/[id]` (GET/PUT/DELETE 204)
   - `/[id]/checklist` (PUT conclui).
3. **Docs** — `docs/api/api-design.md` (linha + bullet).
4. **Postman** — pasta "Inspecoes veiculares" + vars `vehicleId`/`planId`/`planItemId`/
   `vehicularInspectionId`.

- **UI** — `/inspecoes-veiculares` (lista), `/new` (passo 1), `/[id]` (passo 2 checklist),
  `/[id]/edit` (editar cabeçalho), delete inline, nav.

## Camadas

- Domínio: `domains/inspections/vehicular-inspections.ts` (Zod header + checklist tri-state, labels,
  projeções). Novo type `InspectionStatus` exportado do schema.
- Repositório: `repositories/vehicular-inspections.ts` (`withOrg` + `auditedTenantWrite`;
  `TenantTransaction` no helper `assertVehicleAndPlan`).

## Erros

Reusa `VALIDATION` (422), `FK_NOT_FOUND` (422), `NOT_FOUND` (404), `FORBIDDEN` (403). Sem novos
códigos.

## Testes

- **Unit** — schemas (header coerção/uuid/data, checklist tri-state), labels, projeção.
- **Integração** (Postgres efêmero) — create 2 passos, `FK_NOT_FOUND` cross-tenant, saveChecklist →
  completed + `planItemId` forjado ignorado, listagem só de veiculares, isolamento cross-tenant.
