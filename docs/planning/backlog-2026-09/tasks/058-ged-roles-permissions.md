# #58 — [Qualidade/GED] Perfis de usuário e permissões de acesso

https://github.com/Projetos-sst/pgr/issues/58

### Objetivo

Perfis Autor, Revisor, Aprovador, Leitor e Administrador vinculados a setor, distintos dos papéis de
tenant, com checagem no servidor e leitura restrita ao setor.

### Estado atual no código

- Papéis de tenant: `owner|collaborator|client` normalizados de Clerk (`src/shared/tenant/roles.ts:1-22`).
- Gate único para escrita: `requireOfficeStaff` (owner/collaborator, `shared/auth/require-office-staff.ts:6-13`); checagens owner-only em billing e equipe. **Nenhum papel por módulo.**
- RLS isola só por `org_id`.
- Não existe cadastro de setor; só `job_roles.sector` texto (migration 0037, decisão R4 "setores não são GES").
- Referência de tabela associativa citada na issue: `schema/ges-job-roles.ts` (existe).

### O que já existe

Resolução de tenant/papel e guards reaproveitáveis como padrão.

### O que falta

Modelo de setor, tabela usuário↔setor↔papel GED, guard `requireGedRole`, filtro de visibilidade, UI de atribuição.

### Arquivos/domínios provavelmente afetados

`schema/` (papéis GED, setor), `shared/auth/` (guard novo), repositórios do GED, tela de equipe/configuração.

### Migration

SIM.

### Testes necessários

Integração negativa por papel e por setor; owner/collaborator/client combinados com cada papel GED; cross-tenant.

### Dependências

Base de #52–#55, #57; #61 (e-mail de mudança de permissão).

### Riscos

Muito alto — primeira autorização intra-tenant do projeto; RLS não cobre setor, então toda leitura precisa do filtro na aplicação.

### Requisitos faltantes

Multi-papel/multi-setor; owner = Administrador; `client` como Leitor; escopo (todos os documentos ou só os do workflow).

### Dificuldade

5/5 — arquitetura de autorização nova, transversal e com requisitos em aberto.

### Prontidão

NEEDS PRODUCT DECISION

### Cobertura atual

0%.

### Lote recomendado

5 (depois da spec do GED)

## Execução

| Branch | PR  | Migration | Testes | CI  | Decisão | Status  |
| ------ | --- | --------- | ------ | --- | ------- | ------- |
| —      | —   | —         | —      | —   | —       | Backlog |
