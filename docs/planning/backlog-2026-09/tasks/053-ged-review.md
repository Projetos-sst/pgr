# #53 — [Qualidade/GED] Fluxo de revisão de documentos

https://github.com/Projetos-sst/pgr/issues/53

### Objetivo

Revisor analisa, comenta e registra status; histórico de revisões consultável por versão.

### Estado atual no código

- Nenhuma tabela de revisão com revisor/comentário.
- Referência de estrutura: `pgr_revisions` (`schema/pgr.ts:112-146`): revision_number, revised_at, notes, archived_at — **sem autor/revisor**. A issue diz "append-only", mas existe `archived_at` (0031) e `archivePgrRevision` (`repositories/pgr-revisions.ts:107`).
- Nada registra usuário autor de escrita em `documents`.

### O que já existe

Versões por `document_group_id`; padrão de tabela de revisões.

### O que falta

Tabela `document_reviews`, transições `draft → in_review → (changes_requested | reviewed)`, UI de comentários, consulta por versão.

### Arquivos/domínios provavelmente afetados

Schema novo, domínio de workflow do GED, repositório, actions/REST, UI de revisão.

### Backend / Frontend

Registrar revisão ligada à linha da versão (`documents.id`), com revisor (`userId` Clerk).

### Migration

SIM — `document_reviews` + RLS + GRANT.

### Testes necessários

Integração: só Revisor revisa; histórico por versão; cross-tenant.

### Dependências

#52, #58.

### Riscos

Baixo, desde que a state machine esteja especificada.

### Requisitos faltantes

Revisão pode devolver ao autor ou só comentar?

### Dificuldade

3/5 — tabela e fluxo novos, padrão conhecido.

### Prontidão

BLOCKED (#52, #58)

### Cobertura atual

0%.

### Lote recomendado

6

## Execução

| Branch | PR  | Migration | Testes | CI  | Decisão | Status  |
| ------ | --- | --------- | ------ | --- | ------- | ------- |
| —      | —   | —         | —      | —   | —       | Backlog |
