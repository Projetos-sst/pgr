# #10 — [Funções] Avaliar integração com CBO

https://github.com/Projetos-sst/pgr/issues/10

### Objetivo

Busca de CBO por código ou descrição no cadastro de Função; preenchimento manual continua funcionando.

### Estado atual no código

- `job_roles.cbo` texto livre nullable (`src/shared/db/schema/job-roles.ts:30`); sem coluna de descrição do CBO.
- Formulário: `TextField` livre, placeholder `0000-00` (`src/app/(protected)/job-roles/_components/job-role-form.tsx:96-103`).
- Usado só na lista/busca de funções (`repositories/job-roles.ts:121`). eSocial **não** usa CBO (`s2200Schema` em `domains/esocial/builders.ts:30-36`). Nenhum agente de IA preenche CBO.
- Teste unitário garante texto livre (`__tests__/unit/domains/pgr/job-roles.test.ts:22-23`).

### O que já existe

Campo e busca textual simples. Nada de base oficial.

### O que falta

Base CBO, busca, autocomplete.

### Fonte externa (verificada em 2026-09-16)

Sem API: endpoint de CBO no IBGE não responde; portal do MTE (`mtecbo.gov.br`) oferece **arquivos para download**.

### Arquivos/domínios provavelmente afetados

Tabela global `cbo_occupations`, script de importação, repositório/rota de busca, `job-role-form.tsx`, combobox de #3.

### Backend

Importação do arquivo oficial para tabela global; busca local.

### Frontend

Mesmo combobox de #3.

### Migration

PROVÁVEL — tabela global.

### Testes necessários

Parser do arquivo (fixture), busca, fallback manual, teste unitário existente ajustado se o campo passar a validar formato.

### Dependências

#3 (componente).

### Riscos

Arquivo oficial com formato/encoding instável; licença de uso a confirmar.

### Requisitos faltantes

Qual arquivo oficial; nível (ocupação/família); validação de formato.

### Dificuldade

3/5 — mesmo tamanho de #3, com a incerteza extra de não ter API.

### Prontidão

NEEDS EXTERNAL INFO

### Cobertura atual

0% — só o campo livre.

### Lote recomendado

4

## Execução

| Branch | PR  | Migration | Testes | CI  | Decisão | Status  |
| ------ | --- | --------- | ------ | --- | ------- | ------- |
| —      | —   | —         | —      | —   | —       | Backlog |
