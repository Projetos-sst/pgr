# #57 — [Qualidade/GED] Fluxo de descarte de documentos com flag

https://github.com/Projetos-sst/pgr/issues/57

### Objetivo

Gestor da Qualidade solicita descarte conforme retenção; Administrador aprova e executa; auditoria do
descarte consultável mesmo após a remoção.

### Estado atual no código

- `deleteDocument` é **hard delete** de todas as versões do grupo numa transação, com remoção do Storage best-effort depois do commit (`repositories/documents.ts:366-407`); ação `deleteDocumentAction` (`server/actions/documents/documents.ts:145-158`). Falha de Storage só vai para log de console.
- Não há flag de descarte, solicitação, aprovação nem trilha persistida.

### O que já existe

Exclusão física.

### O que falta

Soft delete com solicitação/aprovação, política de retenção, auditoria que sobreviva à remoção.

### Arquivos/domínios provavelmente afetados

`schema/documents.ts`, repositório (filtrar descartados), actions/REST novas, UI, trilha de #59.

### Migration

SIM — colunas de solicitação/aprovação/descarte.

### Testes necessários

Integração: descarte sem aprovação bloqueado; descartado some das listagens; auditoria permanece; papel errado bloqueado.

### Dependências

#58 (papéis), #59 (trilha).

### Riscos

Exclusão irreversível de documento legal; título ("flag") e critério ("exclusão efetiva") divergem.

### Requisitos faltantes

Apagar arquivo ou só marcar; retenção fixa ou por tipo; destino do DELETE atual.

### Dificuldade

3/5 — fluxo de duas etapas com migration, padrão conhecido.

### Prontidão

NEEDS PRODUCT DECISION

### Cobertura atual

0%.

### Lote recomendado

7

## Execução

| Branch | PR  | Migration | Testes | CI  | Decisão | Status  |
| ------ | --- | --------- | ------ | --- | ------- | ------- |
| —      | —   | —         | —      | —   | —       | Backlog |
