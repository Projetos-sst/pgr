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

### Fonte externa (reverificada em 2026-09-27 — Lote 4)

Sem API. O portal oficial do MTE (`http://www.mtecbo.gov.br/cbosite/pages/downloads.jsf`) responde 200
e lista **“Estrutura CBO (CSV) — Arquivo ZIP (106 kb)”**, mas o download é **postback JSF** com
`javax.faces.ViewState` + redirecionamento temporizado (10 s). Duas tentativas automatizadas falharam:
POST com ViewState devolveu HTML (sem `Content-Disposition`) e o clique real no Playwright não
disparou download em 60 s nem em 90 s. Não há URL estática (404) e a API do dados.gov.br exige
credencial (401). → **import a partir de arquivo local (`--file`) como caminho primário**.

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

Só **quem fornece o arquivo oficial**. O resto foi decidido: arquivo = “Estrutura CBO (CSV)”
do portal do MTE; nível = **ocupação de 6 dígitos** (família é prefixo, sem tabela própria);
**sem** validação de formato (os dados atuais estão mistos: `2521-05`, `715210`, `7152-10`);
descrição **derivada** do catálogo, sem coluna nova em `job_roles`.

### Dificuldade

3/5 — mesmo tamanho de #3, com a incerteza extra de não ter API.

### Prontidão

**READY COM PREMISSAS** — tudo decidido tecnicamente na auditoria do Lote 4; falta só o
**arquivo oficial** (quem baixa). Ver a pergunta bloqueante em
[../lots/lot-04/AUDIT.md](../lots/lot-04/AUDIT.md).

### Cobertura atual

0% — só o campo livre.

### Lote recomendado

4

## Execução

### Auditoria do Lote 4 (27/09/2026)

- Arquitetura: tabela **global** `cbo_occupations` + `scripts/cbo-import.ts --file`, molde CAEPI.
- Coletor por browser (molde `caepi/collect.ts`) fica **opcional**, fora do caminho crítico.
- Reaproveita o `CatalogCombobox` criado pela #3.
- Migration: **SIM** (1 tabela global). Nenhuma criada ainda.
- Se o arquivo não chegar: entrega tudo com o catálogo vazio e a issue **fica aberta**
  (`Partially addresses #10`) — nada de fechamento artificial.

## Execução

| Branch                    | PR  | Migration | Testes | CI  | Decisão           | Status  |
| ------------------------- | --- | --------- | ------ | --- | ----------------- | ------- |
| `feature/lot-04-cnae-cbo` | —   | prevista  | —      | —   | arquivo em aberto | Backlog |
