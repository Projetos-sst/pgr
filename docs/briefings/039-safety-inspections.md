# Briefing — Fatia 039: Inspeções de segurança + ocorrências + assinatura (issue #105)

## Contexto

Fase 08 (Módulo de Inspeções). Terceiro tipo de inspeção, agora **livre** (sem plano/checklist):
inspeção de segurança com **registro de ocorrências** e **assinatura digital** (reusando a infra da
fatia 010).

Base: `feature/038-equipment-inspections` (stacked). **Zero migration** — `inspections`,
`inspection_occurrences`, enums e RLS são da 034; a infra de assinatura é da 010.

## Modelo

- **Cabeçalho** (`inspections` `type=safety`): `category` (safety/environment/quality/health/other),
  `planned` (bool), `area`, `companyId?` (opcional; SET NULL), `responsible`, `inspectedAt`, `notes`.
  Nasce `in_progress`.
- **Ocorrências** (`inspection_occurrences`): `description` + `severity` (low/medium/high ou null).
  Salvar **substitui** todas as ocorrências e conclui (`completed`).
- **Assinatura digital**: reusa `signature_requests`/`signature_captures` via **novo `target_type`
  `inspection`** — +1 entrada no registry (`contract.ts`) + renderizador público
  (`InspectionSignatureForm`), **zero mudança de schema** (design da 010).

## Decisões

- **Empresa opcional**: `assertCompany` só valida quando `companyId` é informado; cross-tenant →
  `422 FK_NOT_FOUND`.
- **Assinatura Server-Action-only** (`requestInspectionSignatureAction`): monta o payload não-editável
  no servidor a partir do estado da inspeção e delega para `createSignatureRequest` (gate de plano +
  token + QR já existentes). **Sem espelho REST de criação** — mesma decisão da 010 (a rota pública
  `/sign/{token}` é a superfície testável). O gate de cota/plano da 010 vale aqui.
- **Ocorrências como replace-all** (espelha o checklist das fatias 037/038).

## Superfície (mandato de 4 partes)

1. **Server Action** — `actions/inspections/safety-inspections.ts`
   (`list/get/create/updateHeader/saveOccurrences/delete` + options de empresa +
   `requestInspectionSignatureAction`).
2. **REST** — `/api/v1/safety-inspections` (GET `?status=`/`?category=`, POST 201) + `/[id]`
   (GET/PUT/DELETE 204) + `/[id]/occurrences` (PUT conclui).
3. **Docs** — `docs/api/api-design.md` (linha + bullet).
4. **Postman** — pasta "Inspecoes de seguranca" + var `safetyInspectionId`.

- **UI** — `/inspecoes-seguranca` (lista, novo=passo 1, `[id]`=ocorrências + painel de assinatura,
  edit) + nav. Painel de assinatura reusa polling ~3s + QR da 010.

## Camadas

- Domínio: `domains/inspections/safety-inspections.ts` (Zod header + ocorrências + labels).
- Repositório: `repositories/safety-inspections.ts` (`withOrg` + `auditedTenantWrite`).
- Assinatura: `domains/signatures/targets/inspection.ts` (payload) + registro em `contract.ts` +
  `ui/signature/InspectionSignatureForm.tsx` + `form-registry.tsx`.

## Erros

Reusa `VALIDATION`/`FK_NOT_FOUND`/`NOT_FOUND`/`FORBIDDEN`; a assinatura pode retornar
`QUOTA_EXCEEDED` (402) do gate de plano da 010. Sem novos códigos.

## Testes

- **Unit** — header schema (planned/company/categoria), ocorrências (severidade/descrição),
  labels/projeção, **registro do target `inspection`** no contrato de assinaturas.
- **Integração** (Postgres efêmero) — create com/sem empresa, `FK_NOT_FOUND` empresa cross-tenant,
  saveOccurrences replace + `completed`, filtro por categoria, isolamento cross-tenant.
