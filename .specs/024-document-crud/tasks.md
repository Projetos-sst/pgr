---
description: "Task list — Document (GED) CRUD"
---

# Tasks: Document (GED) CRUD

**Input**: Design documents from `.specs/024-document-crud/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Branch**: `release/0.2.0` (sem troca de branch/push) · **Sem migration** (schema é da fatia 023)

**Tests**: obrigatórios (Constituição — unit + integração em **Postgres efêmero**, nunca SQLite).

## Format: `[ID] [P?] [Story] Description`

- **[P]** = arquivo disjunto, sem dependência de tarefa incompleta → **roteável ao Pleno**.
- Núcleo single-file (repositório `documents.ts` com concorrência de versão + compensação de storage) é do **Dev Sênior** e **não** é `[P]`.
- Caminhos são relativos à raiz do repo.

## Roteamento sugerido

- **Dev Sênior (núcleo, não-`[P]`)**: T012, T013, T014, T021, T027, T028, T029, T041 (todas em `src/shared/db/repositories/documents.ts`) + Server Actions correspondentes.
- **Pleno (`[P]`, arquivos disjuntos)**: T002–T006 (domínio/storage), T008–T011 (unit de domínio), rotas REST em arquivos próprios, testes de integração por história, docs/Postman, componentes de UI isolados. Ver marcação `[P]` em cada tarefa.

---

## Phase 1: Setup

- [x] T001 Elevar o limite de corpo de Server Actions em `next.config.ts` (`experimental.serverActions.bodySizeLimit = "25mb"`) para permitir upload até 25 MB (research §2).

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ Bloqueia todas as histórias.** Domínio puro + storage + repositório de pastas + unit do domínio.

- [x] T002 [P] Criar `src/shared/domains/documents/files.ts`: `ALLOWED_MIME`/`ALLOWED_EXT` (PDF/PNG/JPG/DOC/DOCX/XLS/XLSX), `MAX_FILE_BYTES = 25*1024*1024`, `validateFile({name,size,type})` puro.
- [x] T003 [P] Criar `src/shared/domains/documents/documents.ts`: zod `documentMetadataSchema`/`createDocumentSchema`/`updateDocumentSchema`/`addVersionSchema`/`moveDocumentSchema` (refine completo-ou-vazio do vínculo, reusa `documentRelatedEntityTypeSchema` de `validity.ts`), tipos `DocumentListItem`/`DocumentDetail`, `toDocumentListItem(row, today)`.
- [x] T004 [P] Criar `src/shared/domains/documents/folders.ts`: zod `createFolderSchema`/`renameFolderSchema`, tipos `FolderNode`/`BreadcrumbItem`, `buildBreadcrumb(chain)` puro.
- [x] T005 [P] Criar `src/shared/domains/documents/kpis.ts`: `computeDocumentKpis(input)` puro (`{documents,folders,dueSoon,expired}`) sobre agregados.
- [x] T006 [P] Criar `src/shared/integrations/storage/documents-storage.ts`: `putDocumentObject(orgId,groupId,version,file)` e `removeDocumentObject(path)` via cliente admin, bucket `documents`, path `<org_id>/documentos/<group_id>/v<version>-<slug>` (contract storage.md). `import "server-only"`.
- [x] T007 Criar `src/shared/db/repositories/folders.ts`: `createFolder`/`renameFolder`/`listFolderTree`/`getBreadcrumbChain` (withOrg + auditedTenantWrite; valida pai do tenant → `FK_NOT_FOUND`; 23505 → propaga p/ `DUPLICATE`). Arquivo único usado por US1 e US4.
- [x] T008 [P] Unit `src/shared/domains/documents/__tests__/files.test.ts`: tipos permitidos, tamanho máximo, vazio, sem nome.
- [x] T009 [P] Unit `src/shared/domains/documents/__tests__/kpis.test.ts`: contagem por grupos/pastas/dueSoon/expired.
- [x] T010 [P] Unit `src/shared/domains/documents/__tests__/folders.test.ts`: `buildBreadcrumb` + zod de criação/renome.
- [x] T011 [P] Unit `src/shared/domains/documents/__tests__/documents.test.ts`: zod (metadados, refine do vínculo, move) + integração com `classifyDocumentValidity`.

**Checkpoint**: fundação pronta — histórias podem começar.

---

## Phase 3: User Story 1 — Listar e navegar o acervo (Priority: P1) 🎯 MVP

**Goal**: lista (1 linha/grupo, versão corrente) + KPIs do acervo + breadcrumb + busca + filtros + pastas filhas + estado vazio.
**Independent Test**: com seed, abrir GED na raiz e em subpasta; KPIs, filtros, breadcrumb corretos; nada de outro escritório.

- [x] T012 [US1] `documents.ts` (repo): `listDocuments(orgId, {folderId,search,docType,validity,page,pageSize})` — `DISTINCT ON (org_id, document_group_id)` versão corrente, escopo por `folder_id` (raiz = IS NULL), filtros (validade → predicados de data), paginação `{rows,total}`. **(Sênior — núcleo)**
- [x] T013 [US1] `documents.ts` (repo): `getAcervoKpis(orgId)` — `COUNT(DISTINCT document_group_id)`, pastas, dueSoon/expired das versões correntes. **(Sênior — mesmo arquivo, após T012)**
- [x] T014 [US1] `documents.ts` (repo): `getDocumentById(orgId, id)` → `DocumentDetail` ou null. **(Sênior — mesmo arquivo)**
- [x] T015 [US1] Server Actions `listDocumentsAction` + `getDocumentAction` em `src/shared/server/actions/documents/documents.ts` (compõe repo docs + folders tree/breadcrumb + KPIs).
- [x] T016 [P] [US1] REST `src/app/api/v1/documents/route.ts` — `GET` (list+KPIs+breadcrumb+folders). _(POST/US2 adiciona verbo no mesmo arquivo em T022b.)_
- [x] T017 [P] [US1] REST `src/app/api/v1/documents/[id]/route.ts` — `GET` (detalhar). _(PUT/DELETE de US3/US5 no mesmo arquivo depois.)_
- [x] T018 [P] [US1] REST `src/app/api/v1/folders/route.ts` — `GET` (árvore + breadcrumb). _(POST/US4 no mesmo arquivo depois.)_
- [x] T019 [US1] UI `src/app/(protected)/documents/page.tsx` + componentes (`_components/`): KPIs, tabela (ícone·Nome·Tipo·Versão·Tamanho·Criado·Vencimento·Status·Opções), breadcrumb, busca, filtros, estado vazio.
- [x] T020 [P] [US1] Integração `src/__tests__/integration/documents/documents-list.test.ts` (Postgres efêmero): agrupamento por versão corrente, KPIs, filtros, escopo de pasta, **cross-tenant vazio**.

**Checkpoint**: US1 funcional e testável isolada (MVP de leitura).

---

## Phase 4: User Story 2 — Upload/criar documento (Priority: P1)

**Goal**: upload validado (tipo/tamanho) → Storage particionado + registro (v1, novo grupo), com compensação de órfão e vínculo polimórfico opcional.
**Independent Test**: upload válido grava objeto+registro; inválido não grava; falha de INSERT não deixa órfão.

- [x] T021 [US2] `documents.ts` (repo): `createDocument(orgId, {metadata,file})` — `putDocumentObject` → `INSERT` (v1, novo `document_group_id`) em `withOrg`; `catch` chama `removeDocumentObject` (compensação); valida pasta do tenant → `FK_NOT_FOUND`. **(Sênior — núcleo)**
- [x] T022 [US2] Server Action `createDocumentAction(formData)` em `actions/documents/documents.ts` (parse `FormData`, `validateFile`, zod, repo).
- [x] T022b [P] [US2] REST `POST` em `src/app/api/v1/documents/route.ts` (`await req.formData()`, `201`). _(Mesmo arquivo de T016 — sequencial após T016.)_
- [x] T023 [US2] UI: formulário de upload (arquivo + título + tipo + validade + pasta destino + vínculo PGR opcional) em `app/(protected)/documents/_components/`.
- [x] T024 [P] [US2] Unit `src/shared/integrations/storage/__tests__/documents-storage.test.ts`: ordem upload→insert→compensação com client mockado.
- [x] T025 [P] [US2] Integração `src/__tests__/integration/documents/documents-create.test.ts`: partição por tenant, tipo/tamanho inválido (nada gravado), pasta inválida (422), compensação de órfão, vínculo polimórfico (completo/vazio). Storage mockado.

**Checkpoint**: US1 + US2 (ver + cadastrar) = MVP demonstrável.

---

## Phase 5: User Story 3 — Editar, nova versão e mover (Priority: P1)

**Goal**: editar metadados; nova versão (MAX+1, histórico preservado); mover entre pastas; 404 cross-tenant.
**Independent Test**: editar persiste; versão incrementa e preserva anteriores; corrida → 409; mover valida destino; id alheio → 404.

- [x] T026 [US3] `documents.ts` (repo): `updateDocument(orgId, id, patch)` (metadados; 404 se ausente/alheio). **(Sênior)**
- [x] T027 [US3] `documents.ts` (repo): `addDocumentVersion(orgId, id, file)` — `MAX(version)+1` no mesmo grupo, `putDocumentObject`, INSERT; 23505 → `DUPLICATE` (corrida); compensação de órfão. **(Sênior — núcleo)**
- [x] T028 [US3] `documents.ts` (repo): `moveDocument(orgId, id, folderId)` (valida destino do tenant → `FK_NOT_FOUND`; 404 cross-tenant). **(Sênior)**
- [x] T029 [US3] Server Actions `updateDocumentAction`/`addDocumentVersionAction`/`moveDocumentAction` em `actions/documents/documents.ts`.
- [x] T030 [P] [US3] REST `PUT` em `src/app/api/v1/documents/[id]/route.ts` (editar metadados). _(Mesmo arquivo de T017 — sequencial.)_
- [x] T031 [P] [US3] REST `src/app/api/v1/documents/[id]/versions/route.ts` — `POST` (nova versão, `201`).
- [x] T032 [P] [US3] REST `src/app/api/v1/documents/[id]/move/route.ts` — `POST` (mover).
- [x] T033 [US3] UI: modal de edição + ação "nova versão" (upload) + ação "mover" em `app/(protected)/documents/_components/`.
- [x] T034 [P] [US3] Integração `src/__tests__/integration/documents/documents-update.test.ts`: update, incremento+histórico, **corrida → 409**, move válido/ inválido, **404 cross-tenant** em update/version/move.

**Checkpoint**: ciclo de vida do documento completo.

---

## Phase 6: User Story 5 — Excluir documento (Priority: P1)

**Goal**: excluir com confirmação; 404 cross-tenant.
**Independent Test**: excluir do escritório remove; id alheio → 404.

- [x] T035 [US5] `documents.ts` (repo): `deleteDocument(orgId, id)` — resolve `document_group_id`, `DELETE` de **todas as versões do grupo** numa transação `withOrg` coletando os `storage_path`; **pós-commit** remove objetos best-effort (falha → `logTenantEvent`, não reverte); 404 cross-tenant; retorna `{groupId, deletedVersions}` (research §11). **(Sênior — núcleo)**
- [x] T036 [US5] Server Action `deleteDocumentAction` em `actions/documents/documents.ts` **(Sênior)** + REST `DELETE` em `src/app/api/v1/documents/[id]/route.ts` (`204`) **(Pleno)**.
- [x] T037 [US5] UI: ação de exclusão com confirmação (avisa que remove todas as versões) em `app/(protected)/documents/_components/`.
- [x] T038 [P] [US5] Integração `src/__tests__/integration/documents/documents-delete.test.ts`: exclusão de grupo com **múltiplas versões** (todas somem numa transação), remoção de objetos chamada pós-commit (Storage mockado — assert nas chamadas), **falha de Storage não reverte** (registro some, erro logado), **404 cross-tenant**.

**Checkpoint**: 4 histórias P1 (list/create/edit-version-move/delete) completas — CRUD de documento inteiro.

---

## Phase 7: User Story 4 — Gerir pastas (Priority: P2)

**Goal**: criar/renomear pastas (hierarquia), navegar; unicidade de irmã (incl. raiz); pai inválido → 422; 404 cross-tenant.
**Independent Test**: criar/renomear; nome duplicado irmã → 409; pai alheio → 422; renome id alheio → 404.

- [x] T039 [US4] Server Actions `createFolderAction`/`renameFolderAction`/`listFolderTreeAction` em `src/shared/server/actions/documents/folders.ts` (usa repo T007).
- [x] T040 [P] [US4] REST `POST` em `src/app/api/v1/folders/route.ts` (criar, `201`). _(Mesmo arquivo de T018 — sequencial.)_
- [x] T041 [P] [US4] REST `src/app/api/v1/folders/[id]/route.ts` — `PUT` (renomear).
- [x] T042 [US4] UI: modais criar/renomear pasta + navegação por breadcrumb em `app/(protected)/documents/_components/`.
- [x] T043 [P] [US4] Integração `src/__tests__/integration/documents/folders.test.ts`: criar/renomear, **duplicidade de irmã (incl. raiz) → 409**, pai inválido → 422, **404 cross-tenant** no renome.

**Checkpoint**: todas as histórias funcionais.

---

## Phase 8: Polish & Cross-Cutting

- [x] T044 [P] Docs: registrar recursos `documents` e `folders` (verbos + filtros) em `docs/api/api-design.md` (tabelas "Recursos" e "Sumário").
- [x] T045 [P] Postman: adicionar pastas "Documentos (GED)" e "Pastas (GED)" em `docs/api/sst-manager.postman_collection.json` (reusam Variables `baseUrl`/`devTenant`/`devRole`; novas `documentId`/`folderId`).
- [x] T046 Rodar `npm run check` (format+lint+typecheck+unit) e `npm run test:integration`; corrigir lint/tipos até verde.
- [x] T047 [P] Validar `quickstart.md` (fluxo manual de upload/lista/versão via UI e REST).

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T011)** bloqueia todas as histórias.
- **US1 (T012–T020)**: após fundação. Repo docs (T012→T013→T014, mesmo arquivo, sequencial).
- **US2 (T021–T025)**: após fundação; T022b edita o mesmo `documents/route.ts` de T016.
- **US3 (T026–T034)**: após fundação; T030 edita o mesmo `[id]/route.ts` de T017.
- **US5 (T035–T038)**: após fundação; T036 edita o mesmo `[id]/route.ts` de T017/T030.
- **US4 (T039–T043)**: após fundação (repo T007); T040 edita o mesmo `folders/route.ts` de T018.
- **Polish (T044–T047)**: após as histórias desejadas.

### Regra de arquivo compartilhado (não-`[P]` entre si)

- `src/shared/db/repositories/documents.ts` — T012, T013, T014, T021, T026, T027, T028, T035 (Sênior, sequencial).
- `src/shared/server/actions/documents/documents.ts` — T015, T022, T029, T036.
- `src/app/api/v1/documents/route.ts` — T016, T022b. · `.../documents/[id]/route.ts` — T017, T030, T036.
- `src/app/api/v1/folders/route.ts` — T018, T040.
- `app/(protected)/documents/**` (UI) — T019, T023, T033, T037, T042 (coordenar por subcomponentes).

### Paralelismo (roteável ao Pleno, `[P]`)

- Fundação: **T002, T003, T004, T005, T006** (arquivos distintos) + unit **T008, T009, T010, T011**.
- REST em arquivos próprios: **T031, T032, T041**.
- Integração por história: **T020, T024, T025, T034, T038, T043** (arquivos de teste distintos).
- Docs/Postman/quickstart: **T044, T045, T047**.

---

## Implementation Strategy

- **MVP**: Setup + Foundational + US1 + US2 (ver + cadastrar) → validar isolado.
- **Incremental**: + US3 (versão/mover) → + US5 (excluir) → + US4 (pastas) → Polish.
- **Paralelo (Sênior + Pleno)**: Sênior toca o núcleo de `documents.ts` e as Server Actions; Pleno pega os `[P]` (domínio, storage, unit, rotas REST em arquivos próprios, integração por história, docs/Postman, UI isolada). O gate de arquitetura do Tech Lead ocorre **antes** desta fase de implementação.

## Notes

- `[P]` = arquivos disjuntos, sem dependência incompleta. Núcleo single-file do Sênior nunca é `[P]`.
- Testes de integração sempre em **Postgres efêmero** (`INTEGRATION_*`); Storage **mockado**.
- Sem migration; schema/constraints/RLS são da fatia 023.
- Quality gate antes de 'done': `npm run check` + `npm run test:integration` verdes.
