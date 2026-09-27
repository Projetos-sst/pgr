# #48 — [PGR] Integração com NR-18 (item 18.4.3) — documentos complementares do canteiro

https://github.com/Projetos-sst/pgr/issues/48

### Objetivo

Anexar ao PGR, organizados por tipo, os documentos do 18.4.3 (área de vivência, projeto elétrico
temporário, proteção coletiva, SPIQ) e gerar a relação de EPIs a partir do cadastro.

### Estado atual no código

- Nenhuma referência a NR-18 18.4.3 ou SPIQ (NR-18 só em comentário de `schema/work-permits.ts:30`).
- **Obra já é distinguível:** `work_units.type` enum `site|branch|workfront`, `site` = "Obra / Canteiro" (`schema/work-units.ts:27-28,43`, migration 0035). A issue diz o contrário — desatualizada.
- **Anexar ao PGR já funciona:** vínculo polimórfico com `pgr` permitido (`domains/documents/validity.ts:32-37`), aba Documentos do PGR (`pgr/[id]/_components/pgr-documents-tab.tsx`), `DocumentAttachmentsSection` reutilizável. Upload é um arquivo por vez.
- `doc_type` texto livre; `SUGGESTED_DOC_TYPES` (`domains/documents/documents.ts:63-76`) sem tipos NR-18.
- EPI: `epi_catalog` com CA, validade do CA, fabricante, norma, material, tamanho (`schema/epis.ts:60-89`); `epi_risk` liga EPI a risco (`:266-299`); consolidado já traz EPIs por risco — nada renderiza a relação.

### O que já existe

Anexos por PGR, tipo "obra", dados de EPI por risco.

### O que falta

Tipos NR-18 + agrupamento/checklist por tipo; relação de EPIs com especificações.

### Arquivos/domínios provavelmente afetados

`domains/documents/documents.ts`, `pgr-documents-tab.tsx`, `pgr-consolidated.ts`, template PDF (se a relação for ao PDF).

### Backend

Lista fechada de tipos NR-18 no domínio; consulta derivada da relação de EPIs (GES do PGR → riscos → `epi_risk` → `epi_catalog`).

### Frontend

Checklist NR-18 na aba Documentos quando a unidade for `site`; seção "Relação de EPIs".

### Migration

**NÃO** — confirmado na auditoria do Lote 3: tipos viram lista fechada no domínio, o repositório já
filtra por `doc_type`/`relatedEntityType`, e a relação de EPIs é consulta derivada.

### Testes necessários

Unit (checklist por tipo), integração (relação de EPIs deduplicada e isolada por tenant).

### Dependências

#47 se a relação de EPIs entrar no PDF.

### Riscos

Baixo; conflito só no template do PDF (fazer no mesmo lote de #47).

### Requisitos faltantes

Checklist informativo vs. bloqueante; campos de especificação; relação no PDF ou só na tela.

### Dificuldade

3/5 — sem integração, reaproveita anexos e dados existentes, mas atravessa documentos, PGR e PDF.

### Prontidão

READY — Q4 decidida em 27/09/2026: a relação de EPIs vai para a tela **e** para o PDF; ver
[../lots/lot-03/AUDIT.md](../lots/lot-03/AUDIT.md)

### Cobertura atual

25% — anexos, tipo obra e dados de EPI existem; organização NR-18 e relação não.

### Lote recomendado

3

### Auditoria do Lote 3 (27/09/2026)

- **Sem tabela nova**: `construction_site_documents` foi descartada — o GED já cobre arquivo, versão,
  vínculo (`related_entity_type = 'pgr'`) e tipo, e criar tabela quebraria o versionamento da #56.
- "Organizados por tipo" = checklist/agrupamento por `doc_type` (filtro já existe no repositório),
  **informativo**, exibido quando a unidade do PGR é `site`.
- Relação de EPIs: **100% derivável** (PGR → GES → riscos → `epi_risk` → `epi_catalog`), com CA,
  validade, fabricante, norma, material/tamanho e vida útil já no cadastro.
- Autoria/ART por documento **fora de escopo** (a issue pede o documento, não a autoria estruturada).

## Execução

| Branch                         | PR  | Migration | Testes | CI  | Decisão   | Status  |
| ------------------------------ | --- | --------- | ------ | --- | --------- | ------- |
| `feature/lot-03-nr17-nr18-pgr` | —   | não       | —      | —   | Q4 aberta | Backlog |

### Entrega (27/09/2026)

Implementada no Lote 3, **sem migration**: lista fechada dos quatro projetos do 18.4.3 no domínio,
checklist informativo derivado dos anexos vigentes do GED (só em unidade `site`) e relação de EPIs
derivada e deduplicada — na tela e como seção do PDF. Duas leituras REST novas
(`/api/v1/pgr/{id}/nr18-checklist` e `/epi-relation`), nenhuma escrita nova. Detalhes em
[../lots/lot-03/](../lots/lot-03/).
