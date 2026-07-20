# Data Model — Document (GED) CRUD

**Feature**: `.specs/024-document-crud/` · **Date**: 2026-07-19

**Sem migration nova.** O schema (`documents`, `folders`, enum `document_status`) é da fatia **023** (`0025_documents_data_model`, `src/shared/db/schema/documents.ts`). Este documento descreve a **camada de aplicação** (zod + derivações + tipos) sobre esse schema — nenhuma coluna, índice ou constraint é adicionado.

## Entidades (schema existente — referência)

### `documents` (023)

Colunas usadas nesta fatia: `id`, `org_id`, `folder_id` (NULL=raiz, FK RESTRICT), `document_group_id` (agrupa versões), `name`, `doc_type` (texto livre), `version` (≥1), `status` (default `ready`), `storage_path`, `size_bytes` (≥0), `valid_until` (date NULL), `related_entity_type`/`related_entity_id` (polimórfico, completo-ou-vazio), `created_at`/`updated_at`.

Constraints relevantes (backstop): `uq_documents_org_group_version (org_id, document_group_id, version)`; `documents_related_entity_check`; RLS `documents_isolation`; índices `idx_documents_org_group`, `idx_documents_folder_id`, `idx_documents_related_entity`.

### `folders` (023)

`id`, `org_id`, `parent_id` (NULL=raiz, FK RESTRICT self), `name`, timestamps.
Constraints: `uq_folders_org_parent_name (org_id, parent_id, name) NULLS NOT DISTINCT`; RLS `folders_isolation`.

## Schemas de entrada (zod — `domains/documents/`)

### `documents.ts`

- `documentMetadataSchema` (edição/criação de metadados):
  - `name`: string 1..255
  - `docType`: string 1..120 (texto livre)
  - `validUntil`: `string` date `YYYY-MM-DD` **nullable/optional** (null = sem validade)
  - `folderId`: `uuid` **nullable/optional** (null = raiz)
  - `relatedEntityType`: `documentRelatedEntityTypeSchema` (`"pgr"`) **optional**
  - `relatedEntityId`: `uuid` **optional**
  - `.refine`: `(relatedEntityType == null) === (relatedEntityId == null)` (completo-ou-vazio) → `VALIDATION`
- `createDocumentSchema` = `documentMetadataSchema` + campo de arquivo (validado por `files.ts`). `version` e `document_group_id` **não** vêm do cliente (servidor gera: version=1, novo group).
- `updateDocumentSchema` = `documentMetadataSchema.partial()` (atualização parcial de metadados; **não** troca arquivo — troca de arquivo é nova versão).
- `addVersionSchema` = arquivo (validado) — servidor deriva version=MAX+1, mesmo group; metadados herdados do registro corrente (opcionalmente sobrescrevíveis — decisão: herdar; ajustar no gate se necessário).
- `moveDocumentSchema` = `{ folderId: uuid | null }`.
- Tipos derivados: `DocumentListItem` (id, groupId, name, docType, version, sizeBytes, createdAt, validUntil, **validityStatus** derivado, folderId), `DocumentDetail` (metadados + vínculo + storagePath).
- `toDocumentListItem(row, today)`: aplica `classifyDocumentValidity`.

### `folders.ts`

- `createFolderSchema` = `{ name: string 1..255, parentId: uuid | null }`.
- `renameFolderSchema` = `{ name: string 1..255 }`.
- `FolderNode` (id, name, parentId) e `BreadcrumbItem` (id, name).
- `buildBreadcrumb(chain)`: puro — recebe a cadeia de pais (raiz→atual) e produz os itens ("Início" + nomes).

### `files.ts`

- `ALLOWED_MIME` / `ALLOWED_EXT`: PDF, PNG, JPG, DOC/DOCX, XLS/XLSX.
- `MAX_FILE_BYTES = 25 * 1024 * 1024`.
- `validateFile({ name, size, type })`: puro → ok | erro de validação (tipo não permitido / tamanho excedido / vazio / sem nome). Reutilizado por Server Action e REST.

### `kpis.ts`

- `computeDocumentKpis(input)`: puro — recebe agregados do repositório (grupos distintos, total de pastas, e as validades das versões correntes com `today`) e retorna `{ documents, folders, dueSoon, expired }`. Testável sem DB.

## Derivações (leitura, nunca coluna)

- **Versão corrente do grupo** = `MAX(version)` por `(org_id, document_group_id)` — a lista mostra 1 linha por grupo (versão corrente).
- **Status de validade** = `classifyDocumentValidity(valid_until, { today: todayInSaoPaulo(), dueWindowDays: 30 })` → `ok | due_soon | expired | no_expiry`.
- **KPIs**: `documents = COUNT(DISTINCT document_group_id)` (acervo); `folders = COUNT(folders)`; `dueSoon`/`expired` = contagem das versões correntes por faixa de `valid_until`.
- **Breadcrumb**: cadeia de `parent_id` da pasta atual até a raiz.

## Contagem de estados

- **Documento**: sem máquina de estado nesta fatia (`status` fica `ready`; `generating` é da #38). "Versão" evolui por novos registros no mesmo grupo (histórico imutável).
- **Pasta**: sem estado; árvore por auto-referência.

## Invariantes de aplicação (o banco reforça)

1. `version = MAX(version por grupo) + 1` na nova versão; unicidade garantida por `uq_documents_org_group_version` (23505 → 409).
2. Vínculo polimórfico completo-ou-vazio (zod + CHECK 023).
3. `folder_id`/`parent_id` informados devem ser do tenant (checagem explícita → `FK_NOT_FOUND`/422; RLS impede cruzar tenant).
4. Nome único entre pastas irmãs incl. raiz (`uq_folders_org_parent_name` NULLS NOT DISTINCT → 409).
5. Consistência Storage↔registro: objeto órfão removido se o INSERT falhar (research §4).
6. `org_id` do path e da linha **sempre** da sessão.
7. Exclusão = **grupo inteiro** (todas as versões do `document_group_id`) numa transação `withOrg`; objetos do Storage removidos best-effort **pós-commit** (falha logada, não reverte — research §11).
