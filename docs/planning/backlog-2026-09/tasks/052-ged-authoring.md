# #52 — [Qualidade/GED] Fluxo de elaboração de documentos

https://github.com/Projetos-sst/pgr/issues/52

### Objetivo

Autor cria documento com metadados obrigatórios (título, código, versão, setor, data); elaboração por
tipo de documento conforme papel.

### Estado atual no código

- CRUD de documentos funcional (fatias 023/024/025): schema `schema/documents.ts`, repo `repositories/documents.ts`, actions `server/actions/documents/documents.ts` (`createDocumentAction`), REST `api/v1/documents/**`, UI `/documents` ("GED — Gestão Eletrônica de Documentos"), menu "Qualidade" com uma entrada (`nav-menu.tsx:103-114`).
- Colunas de `documents` (`:54-100`): id, org_id, folder_id, document_group_id, name, doc_type (texto), version, status, storage_path, size_bytes, valid_until, related_entity_type/id, timestamps.
- **Não existem:** `code`, setor, autor/`created_by`, responsável, status de workflow. `document_status` = `generating|ready` (`:23`), usado só pelo worker.
- Precedente próximo: `form_controls` com código FRM, revisão e `draft|published|archived` (migration 0048) — catálogo separado, não ligado a `documents`.
- Setor não existe como cadastro: só `job_roles.sector` texto (migration 0037), com a decisão R4 "setores não são GES".
- A issue diz que o CLAUDE.md descreve a 023 como só modelagem — já não é verdade.

### O que já existe

CRUD, pastas, versões, anexos polimórficos, validade.

### O que falta

Metadados obrigatórios, autor, código, categoria por tipo, setor, status de workflow, checagem de papel.

### Arquivos/domínios provavelmente afetados

`schema/documents.ts`, `domains/documents/documents.ts`, `repositories/documents.ts`, actions, REST, formulários do GED.

### Backend / Frontend

Após spec do GED: Zod exigindo metadados; status inicial `draft`; formulário de elaboração.

### Migration

SIM — colunas novas + backfill dos documentos existentes (autor desconhecido, fora do workflow).

### Testes necessários

Integração: submissão sem metadados bloqueada; papel sem permissão bloqueado; documentos legados continuam listados.

### Dependências

#58.

### Riscos

Esconder ou quebrar documentos existentes (anexos do PGR, PDFs do worker) ao introduzir status.

### Requisitos faltantes

Tipos vs. `doc_type`; formato do código; o que é setor; legados no workflow.

### Dificuldade

3/5 — migration com backfill e regra em várias camadas.

### Prontidão

NEEDS PRODUCT DECISION

### Cobertura atual

25% — CRUD e modelo base existem; elaboração com metadados/papel não.

### Lote recomendado

5

## Execução

| Branch | PR  | Migration | Testes | CI  | Decisão | Status  |
| ------ | --- | --------- | ------ | --- | ------- | ------- |
| —      | —   | —         | —      | —   | —       | Backlog |
