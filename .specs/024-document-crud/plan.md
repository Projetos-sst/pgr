# Implementation Plan: Document (GED) CRUD

**Branch**: `feature/document-crud` (artefatos gerados em `release/0.2.0`, sem troca de branch) | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `.specs/024-document-crud/spec.md` · Issue #34 · Modelo mergeado na fatia 023 (migration `0025_documents_data_model`).

## Summary

Camada de aplicação do GED sobre `documents` + `folders` (schema já existente). Entrega as 5 operações de documento (list, getById, create/upload, update/nova-versão/move, delete) e gestão de pastas (createFolder, renameFolder, navegação), com upload de binário ao Supabase Storage (bucket privado `documents`, path particionado por tenant) e registro em `documents`. **Zero migration.** Isolamento por `withOrg` + RLS backstop; escrita de binário via cliente admin do Storage com partição por `org_id` da sessão. Superfície completa: Server Actions (`officeAction`/`ActionResult`) + espelho REST (`restHandler`) + docs api-design + Postman + testes unit e integração (Postgres efêmero).

## Technical Context

**Language/Version**: TypeScript strict · Next.js 16.2.6 (App Router) · React 19.2.4

**Primary Dependencies**: Drizzle ORM + `postgres` (postgres-js), Zod v4, Clerk, `@supabase/supabase-js` (Storage — já instalado). Sem dependência nova.

**Storage**: Supabase Postgres (`documents`/`folders` — tabelas 023) + Supabase Storage (bucket privado `documents`, já provisionado e verificado).

**Testing**: Jest unit (jsdom) + integração em **Postgres efêmero** (`INTEGRATION_*`) — obrigatório por depender de RLS. Storage mockado nos testes de integração (o objetivo é a lógica DB/isolamento, não o serviço externo).

**Target Platform**: Vercel serverless (Server Actions + Route Handlers).

**Project Type**: Web application (Next.js fullstack unificado).

**Performance Goals**: CRUD síncrono (operação rápida). Upload até 25 MB dentro do limite de execução serverless; nenhuma operação pesada/em lote nesta fatia (geração de PDF/lote = #38/#39).

**Constraints**: Upload via Server Action exige elevar `serverActions.bodySizeLimit` do Next (default 1 MB) para ≥25 MB (research §2). Isolamento não-negociável: tenant sempre da sessão.

**Scale/Scope**: 2 repositórios, ~3 módulos de domínio (schemas/kpis/breadcrumb) + `validity.ts` existente, 1 wrapper de Storage, Server Actions + REST para 2 recursos, 1 tela GED + formulários, docs + Postman.

## Constitution Check

_GATE: verificado antes da Fase 0 e re-verificado após a Fase 1._

| Princípio                                       | Status  | Observação                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Isolamento multi-tenant (não-negociável)** | ✅ PASS | Toda query DB via `withOrg` (app_runtime, RLS enforced). Storage particionado por `org_id` da sessão (`<org_id>/documentos/...`) e o registro em `documents` é RLS-protegido — objeto sem registro é inalcançável. O cliente admin do Storage (service key) toca **apenas o binário**, nunca dados de negócio no DB; nenhum bypass de RLS em dados de negócio. Tenant sempre de `requireOfficeStaff()`, nunca do cliente. |
| **II. Stack fixa / YAGNI**                      | ✅ PASS | Supabase Storage já é da stack (Princípio I cita "Storage por tenant"); **sem infra nova, sem emenda**. Escopo restrito ao requisito da fatia (pastas: só criar/renomear/navegar).                                                                                                                                                                                                                                        |
| **III. Fatia vertical**                         | ✅ PASS | Fatia demonstrável isolada; ciclo Spec Kit; P1 (listar+upload) forma o MVP.                                                                                                                                                                                                                                                                                                                                               |
| **IV. Operações pesadas assíncronas**           | ✅ PASS | Só CRUD síncrono rápido. Geração/lote (assíncrona, `jobs`) é #38/#39, fora de escopo.                                                                                                                                                                                                                                                                                                                                     |
| **V. Segurança e integridade**                  | ✅ PASS | `strict`, sem `any`; zod antes do DB; constraints do banco (unique de versão/pasta, CHECKs, FKs RESTRICT) da 023 são o backstop; segredo `SUPABASE_SECRET_KEY` server-only.                                                                                                                                                                                                                                               |
| **Testes (quality gate)**                       | ✅ PASS | Unit + integração em Postgres efêmero (exceção RLS da constituição).                                                                                                                                                                                                                                                                                                                                                      |

**Resultado**: sem violações. **Complexity Tracking vazio.**

## Project Structure

### Documentation (this feature)

```text
.specs/024-document-crud/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — decisões técnicas
├── data-model.md        # Fase 1 — derivações/zod sobre o schema 023 (sem migration)
├── quickstart.md        # Fase 1 — como rodar/testar a fatia
├── contracts/
│   ├── server-actions.md
│   ├── rest-api.md
│   └── storage.md
├── checklists/
│   └── requirements.md  # (da fase specify)
└── tasks.md             # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/shared/domains/documents/
├── validity.ts                 # EXISTE (023) — classifyDocumentValidity + relatedEntityType
├── documents.ts                # NOVO — zod (create/update/version/move) + tipos de lista/detalhe + toListItem
├── folders.ts                  # NOVO — zod (create/rename) + breadcrumb + tipo de nó de árvore
├── kpis.ts                     # NOVO — cálculo puro dos KPIs do acervo
└── files.ts                    # NOVO — tipos/tamanho permitidos + validação pura de arquivo

src/shared/integrations/storage/
└── documents-storage.ts        # NOVO — upload/remoção no bucket `documents` (cliente admin), path por tenant

src/shared/db/repositories/
├── documents.ts                # NOVO — list/getById/create/update/addVersion/move/delete (withOrg + auditedTenantWrite)
└── folders.ts                  # NOVO — createFolder/renameFolder/listFolderTree/breadcrumb (withOrg)

src/shared/server/actions/documents/
├── documents.ts                # NOVO — Server Actions (officeAction/ActionResult) das 5 ops
└── folders.ts                  # NOVO — Server Actions de pasta
   (form-controls.ts já existe — outra fatia, namespace documents.form_controls.*)

src/app/api/v1/documents/
├── route.ts                    # NOVO — GET (list) + POST (create/upload)
├── [id]/route.ts               # NOVO — GET/PUT/DELETE
├── [id]/versions/route.ts      # NOVO — POST (nova versão)
└── [id]/move/route.ts          # NOVO — POST (mover)
src/app/api/v1/folders/
├── route.ts                    # NOVO — GET (árvore) + POST (criar)
└── [id]/route.ts               # NOVO — PUT (renomear)

src/app/(protected)/documents/  # NOVO — tela GED (lista+KPIs+breadcrumb+filtros), form de upload, modais
└── ...

docs/api/api-design.md          # EDITAR — registrar recursos documents/folders (tabelas Recursos + Sumário)
docs/api/sst-manager.postman_collection.json  # EDITAR — pastas Documents/Folders

src/**/__tests__ (unit) + src/__tests__/integration/  # NOVO — unit + integração Postgres efêmero
```

**Structure Decision**: Web application Next.js. Segue a estratificação canônica do repo (page/handler orquestra → Server Action → domínio zod/puro → repositório `withOrg` → Drizzle). Referência de cópia: módulo `companies`. Storage isolado em `integrations/storage` (vizinho de `pdf`/`cnpj`/`stripe`).

## Complexity Tracking

> Sem violações — seção vazia.
