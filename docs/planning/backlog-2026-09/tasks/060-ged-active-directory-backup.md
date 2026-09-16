# #60 — [Qualidade/GED] Integração com Active Directory e backup automático

https://github.com/Projetos-sst/pgr/issues/60

### Objetivo

Decidir sobre autenticação via Active Directory (fazer, adaptar para Clerk ou não fazer) e implementar
backup automático com retenção auditável. A própria issue pede decisão antes de código.

### Estado atual no código

- Auth 100% Clerk (`src/shared/tenant/active-tenant.ts`); nenhum código SAML/LDAP/AD/SSO.
- Nenhum backup ou cron: sem `vercel.json`, `CRON_SECRET` ou pg_cron; `.github/workflows` tem só `ci.yml` e `changelog.yml`.
- Único processo agendável é o worker de longa duração (`worker/index.ts`, só `pdf_batch`); fila `jobs` com enum `job_type = pdf_batch` (novo tipo exige migration).
- Banco em Supabase gerenciado; documentos no Storage (bucket `documents`, migration 0045).

### O que já existe

Nada específico.

### O que falta

Decisão; eventualmente SSO via Clerk e/ou rotina de backup do Storage.

### Arquivos/domínios afetados

Depende da decisão (infra, não código de domínio).

### Migration

INCERTO (provavelmente nenhuma).

### Testes necessários

Depende da decisão.

### Dependências

#61 (e-mails de backup/AD).

### Riscos

Custo (SSO enterprise no Clerk é recurso pago); conflito com Princípio II/YAGNI da constituição.

### Requisitos faltantes

Uso real de AD pelo cliente; SSO via Clerk aceitável; backups gerenciados do Supabase suficientes; Storage incluso.

### Dificuldade

5/5 se implementada; decisão em si é S.

### Prontidão

NEEDS PRODUCT DECISION

### Cobertura atual

0%.

### Lote recomendado

8

## Execução

| Branch | PR  | Migration | Testes | CI  | Decisão | Status  |
| ------ | --- | --------- | ------ | --- | ------- | ------- |
| —      | —   | —         | —      | —   | —       | Backlog |
