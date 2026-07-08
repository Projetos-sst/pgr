# Implementação — Vínculo EPI × risco com neutralização (`epi-risk-link`)

> **Branch:** `feature/epi-risk-link` (baseada em `origin/develop`).
> **Tipo:** fatia de **fluxo completo** (migration + domínio + repo + actions + REST + UI + testes + docs)
> sobre a tabela `epi_risk` que já existia (fatia `008`).
> **Status:** implementada; `npm run check` + `npm run build` verdes. Segue a análise em
> [briefing-epi-risk-link.md](briefing-epi-risk-link.md) — decisões D1–D6 travadas conforme a recomendação.

---

## 1. O que foi entregue

Tela + API para o gestor **vincular EPIs a cada risco do inventário** e registrar, por EPI, **se neutraliza
o risco** (Sim / Não / Não Aplicável). O vínculo alimenta o PGR (adequação de EPI por exposição). Um risco
pode ter **zero ou mais** EPIs; o par (organização, EPI, risco) é **único**; tudo isolado por tenant.

A tabela `epi_risk` (fatia `008`) era um vínculo **interino EPI × GES** com um `boolean neutralizes`. Esta
fatia realiza a **decisão D6** de [briefing-pgr-risks-data-model.md](briefing-pgr-risks-data-model.md):
repontar o vínculo para `risks` e trocar a neutralização por um enum de 3 estados.

---

## 2. Decisões travadas (D1–D6 do briefing)

| #  | Decisão                | Como ficou                                                                                     |
| -- | ---------------------- | --------------------------------------------------------------------------------------------- |
| D1 | Alvo do vínculo        | **`risk_id → risks.id`** (era `ges_id`). Unique `(org_id, catalog_id, risk_id)`.               |
| D2 | Campo neutralização    | **`pgEnum epi_neutralization`** = `neutralizes` / `does_not_neutralize` / `not_applicable`.    |
| D3 | Exclusão do vínculo    | **Física** (espelha `ges_job_roles`; sem soft delete — OS ainda não existe).                  |
| D4 | Origem do EPI          | **`epi_catalog`** (itens `type = 'epi'`); reusa a busca por nome/CA.                           |
| D5 | Onde aparece           | Seção **`EpiRiscoSection`** na tela de **edição** do risco (precisa de `risk_id` persistido).  |
| D6 | Nº da migration        | **`0014_epi_risk_link`** (ver §6 sobre colisão de numeração).                                  |

**Distinção modelada:** "risco sem EPI" = **nenhum vínculo** (zero linhas). "Não Aplicável" = valor do enum
para um EPI que **está** vinculado mas não neutraliza (ex.: ergonômico controlado por medida administrativa).

---

## 3. Arquivos (por camada)

**Dados**

- `src/shared/db/schema/epis.ts` — novo `pgEnum epiNeutralization`; `epiRisk` reescrita: `gesId → riskId`
  (FK `risks`, cascade), `neutralizes: boolean → neutralization: epiNeutralization` (NOT NULL, sem default),
  índice `idx_epi_risk_risk_id`, unique `uq_epi_risk_org_catalog_risk`. RLS/GRANT/trigger da `008` preservados.
- `src/shared/db/schema/index.ts` — export do enum `epiNeutralization`.
- `src/shared/db/migrations/0014_epi_risk_link.sql` + `meta/0014_snapshot.json` + entrada no `_journal.json`.

**Domínio (puro)**

- `src/shared/domains/pgr/epi-risk.ts` — `epiNeutralizationSchema` (z.enum 3 estados, obrigatório),
  rótulos pt-BR (`epiNeutralizationLabel`), `epiRiskLinkInputSchema` / `epiRiskLinkUpdateSchema`, e os view
  types `EpiRiskLinkItem` / `EpiOption`.

**Servidor**

- `src/shared/db/repositories/epi-risk.ts` — `listRiskEpis`, `listAvailableEpisForRisk` (exclui vinculados +
  busca nome/CA + só `type='epi'`), `createRiskEpi`, `updateRiskEpiNeutralization`, `deleteRiskEpi`. Asserts
  `assertRiskInTenant` / `assertCatalogInTenant` são a **barreira real de isolamento** (FK bypassa RLS).
- `src/shared/server/actions/pgr/epi-risk.ts` — 5 actions via `officeAction` (`{ audit: true }` nas escritas).
- `src/app/api/v1/risks/[id]/epis/route.ts` — `GET` (list; `?available=true&search=`) + `POST` (201).
- `src/app/api/v1/risks/[id]/epis/[linkId]/route.ts` — `PUT` (neutralização) + `DELETE` (204).

**UI**

- `src/app/(protected)/risks/[id]/_components/epi-risco-section.tsx` — client (padrão `ManageFunctions`):
  tabela **Nome · CA · Neutraliza os Riscos? (select) · Remover** + linha de adicionar (select de EPI
  disponível + select de neutralização). Polling não; recarrega após cada mutação.
- `src/app/(protected)/risks/[id]/edit/page.tsx` — monta `<EpiRiscoSection riskId={risk.id} />` após o form.

**Docs & testes**

- `docs/api/api-design.md` — recurso `/risks/{id}/epis` nas tabelas "Recursos" e "Sumário".
- `docs/api/sst-manager.postman_collection.json` — pasta "EPI x risco (vinculo)" (GET/GET available/POST/PUT/DELETE)
  + variável `epiCatalogId`.
- `src/__tests__/unit/domains/pgr/epi-risk.test.ts` — schemas/rótulos/obrigatoriedade.
- `src/__tests__/integration/pgr/epi-risk.test.ts` — list, available+busca, add, DUPLICATE, FK_NOT_FOUND
  (risco/EPI cross-tenant), update, remove+disponível, **isolamento cross-tenant**, NOT_FOUND, FORBIDDEN.

**Dependentes atualizados pela mudança de schema**

- `src/__tests__/integration/_helpers/pgr-seed.ts` — insert de `epi_risk` migrado para `risk_id`/`neutralization`
  e **reordenado para depois de `risks`** (a FK agora exige o risco antes).
- `src/__tests__/integration/shared/db/epi-constraints.test.ts`, `epi-risk-isolation.test.ts`,
  `epi-migration-shape.test.ts` — ajustados para a nova forma (unique por `risk_id`, enum novo no shape).

---

## 4. Migration `0014_epi_risk_link` (tabela vazia → seguro)

`CREATE TYPE epi_neutralization` → dropar FK `epi_risk_ges_id_ges_id_fk` + índices `idx_epi_risk_ges_id`/
`uq_epi_risk_org_catalog_ges` → `ADD COLUMN risk_id`/`neutralization` (NOT NULL) → FK `risk_id → risks` +
índice `idx_epi_risk_risk_id` + unique `uq_epi_risk_org_catalog_risk` → `DROP COLUMN ges_id`/`neutralizes`.

- **Sem SQL custom**: como é um `ALTER` (não recria a tabela), o `GRANT app_runtime`, o trigger
  `set_updated_at_epi_risk` e a policy `epi_risk_isolation` da `008` **persistem**.
- A tabela nunca teve consumidores (nenhum repo/action antes desta fatia) → sem migração de dados; `ADD
  COLUMN … NOT NULL` numa tabela vazia é seguro.
- **Snapshot** foi derivado do `0012` de forma determinística e conferido: `db:generate` → **"No schema
  changes"** (schema ⇄ snapshot consistentes; `prevId` encadeia no `0012`).
  Nota: a `drizzle-kit generate` interativa pede resolução de rename (`ges_id`↔`risk_id`) e não roda sem TTY;
  por isso o par SQL+snapshot foi escrito à mão e validado pelo `db:generate`.

---

## 5. Isolamento e erros

- Toda query/escrita via `withOrg` + RLS backstop; tenant da sessão, nunca do input.
- `createRiskEpi` valida que **risco e EPI pertencem ao tenant** antes do insert (asserts) → cross-tenant →
  `FK_NOT_FOUND` (422). Par duplicado → `DUPLICATE` (409, unique 23505, mapeado por `toActionError`).
- Vínculo inexistente/cross-tenant em update/remove → `NOT_FOUND`. Papel `client` → `FORBIDDEN`.

---

## 6. Numeração da migration (atenção no merge)

O PR de metodologia de risco (#136) mesclou **primeiro** em `develop`, ocupando a **`0013`**
(`0013_risk_methodology`). Ao integrar `develop` nesta branch, a migration foi **renumerada de `0013` para
`0014`** (`0014_epi_risk_link.sql`): renomeado o `.sql`, `tag` no `_journal.json` no idx 14 e `prevId` do
snapshot apontando para o `id` da `0013` já mesclada. Validado com `npm run db:generate` → "No schema
changes". É o procedimento padrão do repo para migrations paralelas; o código em si não quebra — é só a
ordem/lineage.

---

## 7. Como validar

- `npm run check` — format + lint + typecheck + **418 testes unit** (novos de `epi-risk`). ✅
- `npm run build` — compila `/api/v1/risks/[id]/epis` e `/api/v1/risks/[id]/epis/[linkId]`. ✅
- `npm run db:generate` — "No schema changes". ✅
- `npm run test:integration` (requer `INTEGRATION_*` → Postgres efêmero) — cobre CRUD do vínculo + isolamento
  (self-skip sem as envs; **nunca** SQLite nem o banco de dev).
- Manual: `POST /api/v1/risks/{riskId}/epis` (bypass DEV) com a pasta Postman; depois `GET`/`PUT`/`DELETE`.

---

## 8. Fora de escopo / follow-ups

- **Ordem de Serviço (OS)**: não existe no repo; a leitura de EPIs por risco já está pronta para reuso quando
  a OS for construída.
- Tela de **criação** de risco não exibe a seção (sem `risk_id` ainda) — fluxo cria-depois-vincula.
- Exclusão **física** do vínculo (D3) — revisitar para soft delete se a OS passar a referenciar vínculos.
