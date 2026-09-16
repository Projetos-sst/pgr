# #55 — [Qualidade/GED] Publicação e guarda de documentos

https://github.com/Projetos-sst/pgr/issues/55

### Objetivo

Administrador publica documento aprovado; Leitor vê só publicados do seu setor; cada acesso gera registro
de auditoria consultável.

### Estado atual no código

- Padrão de publicação no PGR: `pgr.published_at` (migration `0028_pgr_published_at.sql`, `schema/pgr.ts:58`), `publishPgrAction` (`server/actions/pgr/pgr.ts:85-99`) com guard `assertPgrPublishable` (exige assinatura, `server/pgr/pgr-lock.ts:55-61`) e update idempotente `WHERE published_at IS NULL` (`repositories/pgr.ts:199-210`). **Qualquer owner/collaborator publica** — sem restrição de papel.
- `documents` não tem `published_at`.
- RLS isola só por `org_id`; gate REST exige owner/collaborator (`shared/api/rest.ts:70-73`). Leitura por setor/papel não existe.
- Download existe (`api/v1/documents/[id]/download`, `server/actions/documents/download.ts`) sem log persistido.

### O que já existe

Padrão de publicação idempotente e download.

### O que falta

`published_at/by`, gate "só aprovado", visibilidade para Leitor por setor, log de acesso.

### Arquivos/domínios provavelmente afetados

`schema/documents.ts`, repositório (filtro de visibilidade), actions/REST, download, UI.

### Migration

SIM.

### Testes necessários

Integração: Leitor não vê não-publicado; Leitor de outro setor não vê; acesso gera log; publicação sem aprovação bloqueada.

### Dependências

#54, #58, #59 (tabela de log).

### Riscos

Alto — filtro de visibilidade por setor é autorização; erro vaza documento dentro do tenant. RLS atual não protege isso.

### Requisitos faltantes

Leitor vê só versão vigente? Log de visualização ou só download? `client` pode ser Leitor?

### Dificuldade

4/5 — autorização intra-tenant inédita no projeto.

### Prontidão

BLOCKED (#54, #58)

### Cobertura atual

25% — padrão de publicação existe no PGR.

### Lote recomendado

6

## Execução

| Branch | PR  | Migration | Testes | CI  | Decisão | Status  |
| ------ | --- | --------- | ------ | --- | ------- | ------- |
| —      | —   | —         | —      | —   | —       | Backlog |
