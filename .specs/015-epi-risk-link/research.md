# Phase 0 — Research: Vínculo EPI × risco com neutralização

> Fatia de **fluxo completo** (migration + domínio + repo + actions + REST + UI + testes + docs)
> sobre a tabela `epi_risk` que já existia (fatia 008). Fonte da verdade: o card da issue +
> [briefing-epi-risk-link.md](../../docs/briefings/briefing-epi-risk-link.md) +
> [implementacao-epi-risk-link.md](../../docs/briefings/implementacao-epi-risk-link.md).

## Decisões (Decision / Rationale / Alternatives)

### D1 — Alvo do vínculo: `risk_id` (não `ges_id`)

- **Decisão**: repontar a FK `ges_id → ges` para **`risk_id → risks.id ON DELETE CASCADE`**; unique
  passa de `(org_id, catalog_id, ges_id)` para `(org_id, catalog_id, risk_id)`.
- **Rationale**: a 008 modelou `epi_risk` ligada ao `ges` de forma **interina** (não havia tabela
  `risks`); o card é explicitamente EPI × **risco**, e a decisão D6 do modelo de riscos/PGR já previa
  este repoint. A tabela `risks` já existe.
- **Alternativas**: manter `ges_id` interino (rejeitada — perpetua a dívida técnica e não atende o
  card); vínculo a `ges` **e** `risk` (rejeitada — YAGNI, dupla verdade).

### D2 — Neutralização: enum de 3 estados (não boolean)

- **Decisão**: `pgEnum epi_neutralization` = `neutralizes` | `does_not_neutralize` | `not_applicable`
  (rótulos pt-BR Sim / Não / Não Aplicável), NOT NULL, sem default.
- **Rationale**: o card pede "Sim / Não / Não Aplicável"; um booleano não expressa "Não Aplicável".
  A tabela está vazia → a troca de tipo é limpa (sem migração de dados).
- **Alternativas**: manter boolean + coluna separada "aplicável" (rejeitada — dois campos para um
  conceito); texto livre (rejeitada — o banco deve fechar o conjunto).

### D3 — Exclusão do vínculo: física

- **Decisão**: `DELETE` físico, espelhando `ges_job_roles`.
- **Rationale**: não há Ordem de Serviço (que motivaria histórico de vínculo) no repo; soft delete
  seria complexidade especulativa (YAGNI, Princípio II).
- **Alternativas**: soft delete com `deleted_at` (rejeitada por ora; revisitar se a OS surgir).

### D4 — Origem do EPI selecionável: catálogo (não estoque)

- **Decisão**: os EPIs vinculáveis vêm de `epi_catalog` (itens `type = 'epi'`), reusando a busca por
  nome/CA de `listEpiCatalog`.
- **Rationale**: o vínculo é **normativo** (indica EPI recomendado para o risco) e independe de haver
  saldo; restringir a itens com estoque impediria recomendar EPI ainda não comprado.
- **Alternativas**: `epi_stock` (só itens com saldo) — rejeitada (acopla recomendação a operação).

### D5 — Onde a seção aparece: componente irmão na tela de edição

- **Decisão**: `EpiRiscoSection` montado **após** o `<RiskForm>` na página de **edição** do risco;
  a página de **criação** não a exibe (fluxo cria-depois-vincula).
- **Rationale**: espelha `ManageFunctions` (GES ↔ funções); a seção precisa de `risk_id` persistido,
  que só existe após salvar. Componente autocontido que não participa do submit do form pai.
- **Alternativas**: dentro do submit do form de risco (rejeitada — exigiria orquestrar o vínculo no
  mesmo POST, sem id na criação).

### D6 — Numeração da migration

- **Decisão as-built**: nasceu como `0013_epi_risk_link`, **renumerada para `0014_epi_risk_link`** ao
  integrar `develop` (ver abaixo).
- **Rationale**: próxima livre a partir de `develop`.
- **Resolvido no merge**: o PR de metodologia de risco (#136) mesclou primeiro em `develop`, ocupando a
  `0013` (`0013_risk_methodology`). Esta migration foi **renumerada `0013 → 0014`** ao integrar `develop`
  (renomeado `.sql`, `tag` no `_journal.json` idx 14 e `prevId` do snapshot apontando para o `id` da `0013`).
  Validado com `npm run db:generate` → "No schema changes". O código não quebrou — só a ordem/lineage.

## Padrão de referência (a replicar integralmente)

A junção **`ges_job_roles`** (GES ↔ job_roles com atributo por vínculo) é o gabarito camada a camada:

| Camada         | Referência (`ges_job_roles`)                                    | Novo (`epi_risk`)                                   |
| -------------- | --------------------------------------------------------------- | --------------------------------------------------- |
| Schema         | `src/shared/db/schema/ges-job-roles.ts`                         | evoluir `src/shared/db/schema/epis.ts` (D1/D2)      |
| Repositório    | `src/shared/db/repositories/ges-job-roles.ts`                   | novo `src/shared/db/repositories/epi-risk.ts`       |
| Server Actions | `src/shared/server/actions/pgr/ges.ts`                          | novo `src/shared/server/actions/pgr/epi-risk.ts`    |
| REST           | `src/app/api/v1/ges/[id]/job-roles/**`                          | `src/app/api/v1/risks/[id]/epis/**`                 |
| Zod            | `src/shared/domains/pgr/ges.ts`                                 | novo `src/shared/domains/pgr/epi-risk.ts`           |
| UI seção       | `src/app/(protected)/ges/[id]/_components/manage-functions.tsx` | novo `risks/[id]/_components/epi-risco-section.tsx` |

Wrappers compartilhados (reuso obrigatório, **não** reimplementar regra): `officeAction`,
`restHandler`, `withOrg`, `auditedTenantWrite`, `ActionResult`, `requireOfficeStaff` /
`requireOfficeStaffPage`, primitivos `_ui/form` e `_ui/list`, e a busca `listEpiCatalog`
(`ilike` sobre `name` OU `ca` OU `categories.name`, paginação offset).

## As-built (estado após implementação — commit `ce884a9`)

- **Schema**: `epis.ts` ganhou `pgEnum epiNeutralization`; `epiRisk` reescrita (`gesId → riskId` FK
  `risks` cascade; `neutralizes boolean → neutralization epiNeutralization` NOT NULL; índice
  `idx_epi_risk_risk_id`; unique `uq_epi_risk_org_catalog_risk`). `index.ts` exporta o enum.
- **Migration**: `0014_epi_risk_link.sql` + snapshot/journal. O `drizzle-kit generate` interativo pede
  resolução de rename (`ges_id`↔`risk_id`) e **não roda sem TTY**; por isso o par SQL + snapshot foi
  escrito à mão de forma determinística e **validado por `db:generate` → "No schema changes"**.
- **Domínio**: `domains/pgr/epi-risk.ts` (`epiNeutralizationSchema`, rótulos pt-BR,
  `epiRiskLinkInputSchema` / `epiRiskLinkUpdateSchema`, view types).
- **Repo/Actions/REST/UI/Docs/Testes**: todos criados (ver [data-model.md](./data-model.md),
  [contracts/](./contracts/) e [tasks.md](./tasks.md)).
- **Dependentes atualizados pela mudança de schema**: seed `pgr-seed.ts` (insert de `epi_risk`
  migrado para `risk_id`/`neutralization` e reordenado para depois de `risks`); testes de shape/
  constraint/isolamento da 008 ajustados para a nova forma.

## Reconciliação card × repo (correções aplicadas)

- `epi_risco` → **`epi_risk`** (já existe; evoluir, não recriar).
- `organization_id` → **`org_id`** (text → `orgs.id`).
- `features/pgr/` → **`src/shared/...`** + UI em `src/app/(protected)/`.
- "Testes: SQLite em memória" → **proibido**; integração roda contra **Postgres efêmero**
  (`INTEGRATION_*`), nunca SQLite (CLAUDE.md sobrepõe a constituição desatualizada).
- Ref `.specs/004-epgr-feature-parity/02-riscos-e-pgr.md` → **não existe**; fonte = spec 008 + este
  diretório + briefings.
- "OS usa o vínculo" → **Ordem de Serviço não existe** no repo; downstream futuro, não gateia a fatia.
