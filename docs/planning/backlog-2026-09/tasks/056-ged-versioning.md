# #56 — [Qualidade/GED] Controle de versões de documentos

https://github.com/Projetos-sst/pgr/issues/56

### Objetivo

Nova versão não apaga o histórico, só passa a ser a ativa; versões antigas continuam consultáveis a
partir do histórico.

### Estado atual no código

- **Critério 1 já atendido pelo modelo:** `UNIQUE(org_id, document_group_id, version)` (`schema/documents.ts:82-86`); `addDocumentVersion` faz MAX+1 e copia metadados, removendo o upload se o insert falhar (`repositories/documents.ts:269-323`); ação `addDocumentVersionAction` (`server/actions/documents/documents.ts:107-126`).
- Versão vigente: `currentVersionPredicate` (`repositories/documents.ts:72-86`, `NOT EXISTS` versão maior no grupo), usado na listagem (`:108`) e KPIs (`:160`).
- **Critério 2 não atendido:** nenhuma consulta lista versões de um grupo; REST `api/v1/documents/[id]/versions/route.ts` só tem **POST**; a UI mostra apenas `v{doc.version}` (`documents/page.tsx:221`) — sem tela de histórico. Versão antiga só é acessível por id direto.
- Exclusão atual apaga **todas** as versões do grupo (`repositories/documents.ts:381-389`) — fora do escopo, mas relevante para #57.

### O que já existe

Modelo de versões, criação de versão, predicado de vigente, download por id.

### O que falta

Listar versões do grupo (repo + action + REST GET), UI de histórico com badge "vigente" e download das anteriores.

### Premissa

Gate "só vira ativa após aprovação" é de #54/#62 — não entra aqui.

### Arquivos/domínios provavelmente afetados

`repositories/documents.ts`, `server/actions/documents/documents.ts`, `api/v1/documents/[id]/versions/route.ts` (GET), `documents/_components/` (histórico), `docs/api/api-design.md`, Postman.

### Backend

`listDocumentVersions(orgId, documentId)`: resolve o grupo pelo id e lista versões desc, dentro de `withOrg`; id de outro tenant → `NOT_FOUND`.

### Frontend

Ação "Histórico de versões" na linha do documento; lista com versão, data, tamanho, badge vigente e download.

### Migration

NÃO.

### Testes necessários

Integração: nova versão preserva anteriores; lista ordenada; vigente = maior; cross-tenant → NOT_FOUND; REST GET.

### Dependências

Nenhuma para o critério de aceite.

### Riscos

Baixo — leitura sobre modelo existente.

### Requisitos faltantes

Nenhum bloqueante.

### Dificuldade

2/5 — leitura nova em módulo existente, sem migration.

### Prontidão

READY

### Cobertura atual

50% — criação e vigência prontas; consulta ao histórico ausente.

### Lote recomendado

1

## Execução

| Branch | PR  | Migration | Testes | CI  | Decisão | Status  |
| ------ | --- | --------- | ------ | --- | ------- | ------- |
| —      | —   | —         | —      | —   | —       | Backlog |
