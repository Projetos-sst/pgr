# Research — Editor do PGR (abas) e visão consolidada

Decisões técnicas da fatia 019. Nenhum `NEEDS CLARIFICATION` pendente. Tudo validado contra o
código real do `develop`.

## D1 — Tabelas já existem (zero migration)

- **Decisão**: usar `pgr`, `pgr_ges`, `pgr_revisions` e o enum `pgr_registration_type` — **todos da
  migration `0012`** (schema `db/schema/pgr.ts`). Nenhuma migration nova; nada em `schema/**` /
  `migrations/**`.
- **Rationale**: `pgr_ges` (UNIQUE `(org_id,pgr_id,ges_id)`) e `pgr_revisions` (UNIQUE
  `(org_id,pgr_id,revision_number)`) já existem mas **nunca tiveram repo/actions** — só faltam as
  camadas de aplicação.

## D2 — Vínculo PGR↔GES espelha `epi-risk` (associação)

- **Decisão**: `repositories/pgr-ges.ts` segue `repositories/epi-risk.ts`: `assertPgrInTenant` +
  `assertGesInTenant` (ambos `SELECT ... WHERE org_id=? AND id=?`, senão `ReferenceNotFoundError`)
  antes do `INSERT`; a **UNIQUE** sobe como 23505 → `toActionError` mapeia **`DUPLICATE`/409**
  (sem catch no repo). `remove` deleta o vínculo por `(org_id, pgr_id, ges_id)` → boolean; `false`
  → `NotFoundError`/404 na action. **Remove só o vínculo**, nunca o GES/riscos.
- **Rationale**: padrão vigente e testado; DUPLICATE automático (categories/epi-risk/018).
- **Erros**: PGR inválido/cross-tenant → **NOT_FOUND/404** (assertPgr lança
  `ReferenceNotFoundError("pgr")`? — ver D8); GES inválido/cross-tenant → **FK_NOT_FOUND/422**.

## D3 — `assertPgrInTenant`: NOT_FOUND vs FK_NOT_FOUND

- **Decisão**: o **PGR** é o recurso-âncora da rota (`/pgr/[id]/...`). PGR inexistente/cross-tenant
  → **`NOT_FOUND`/404** (usar `getPgrById` + `NotFoundError` na **action**, como `getRiskAssessment`
  faz para a linha-alvo). O **GES** é referência de entrada no vínculo → **`FK_NOT_FOUND`/422** via
  `ReferenceNotFoundError("ges")` no **repo**.
- **Rationale**: FR-016 do spec; coerente com o resto (recurso-alvo → 404; FK de input → 422).

## D4 — Revisões append-only, sem autor

- **Decisão**: `repositories/pgr-revisions.ts` só `listPgrRevisions` (order by `revision_number`
  desc) e `createPgrRevision` (assertPgr + insert; UNIQUE `revision_number` → 23505 → DUPLICATE).
  **Sem update/delete**. **Sem autor** (coluna não existe) — o ator fica no **audit log**
  (`auditedTenantWrite`). `revised_at` e `notes` reais; `revision_number` inteiro.
- **Rationale**: schema real não tem autor; revisão é histórico imutável.

## D5 — Consolidada: repository read-only, composição em lote (sem N+1)

- **Decisão**: `repositories/pgr-consolidated.ts` (read-only, `withOrg`) monta em **≈5 queries**:
  1. **PGR + empresa + obra** (join `companies`/`work_units`) — valida PGR no tenant (`null` → 404).
  2. **GES vinculados**: `pgr_ges` ⨝ `ges` where `pgr_id` (ordenado por nome do GES).
  3. **Riscos**: `risks` where `ges_id IN (gesIds)` (um único `inArray`).
  4. **Avaliação vigente por risco** em uma query: `DISTINCT ON (risk_id) ...
     WHERE risk_id IN (riskIds) ORDER BY risk_id, assessed_at DESC, created_at DESC` (espelha a
     ordenação de `getCurrentRiskAssessment`).
  5. **Medidas**: `control_measures` where `risk_id IN (riskIds)` (um `inArray`).
  Depois **compõe em memória**: agrupa riscos por GES; anexa avaliação vigente + medidas; deriva o
  estado das medidas com `deriveMeasureState` (Feature 018); ordena riscos por `risk_level` desc.
- **Rationale**: evita N+1 (nada de 1 query por risco); estrutura reutilizável pela Fase 05 (PDF).
- **Alternativas rejeitadas**: 1 `getCurrentRiskAssessment`/`listControlMeasures` por risco (N+1);
  um mega-join (cardinalidade explode risco×medida×avaliação).

## D6 — Ordenação por `risk_level` desc, sem avaliação por último (função pura)

- **Decisão**: função **pura** `sortConsolidatedRisks(items)` no domínio: riscos **com** avaliação
  primeiro, por `risk_level` **desc** (desempate estável por descrição); riscos **sem** avaliação
  por último. Testável isoladamente (unit).
- **Rationale**: FR-010; separar ordenação pura da query facilita teste determinístico.

## D7 — Estado derivado das medidas (reuso da 018)

- **Decisão**: a consolidada usa `deriveMeasureState(measure, today)` /`isOverdue` de
  `domains/pgr/control-measure.ts`; `today` calculado na camada de leitura em `America/Sao_Paulo`
  (`Intl.DateTimeFormat("en-CA", { timeZone })`), passado às funções puras. **Sem** status
  persistido, sem snapshot.
- **Rationale**: reaproveita a regra da 018; determinístico nos testes.

## D8 — Actions: `officeAction` para tudo (read e write)

- **Decisão**: reads (`listPgrGes`, `listPgrRevisions`, `getPgrConsolidated`) via
  `officeAction("op", ({tenantId}) => repo...)` **sem** `{audit}`; writes (`add/remove` GES,
  `create` revision) com `{audit:true}`. Retorno `ActionResult<T>`; Zod antes do repo; sem Drizzle
  runtime; `revalidatePath("/pgr/[id]")`. Padrão idêntico a `actions/pgr/epi-risk.ts`.
- **Rationale**: `officeAction` já gateia papel (`requireOfficeStaff`) e mapeia erro — reads também
  exigem office staff (dados do tenant).

## D9 — REST: verbos reduzidos, justificados

- **Decisão**: `pgr_ges` → `GET`+`POST` em `/pgr/[id]/ges`, `DELETE` em `/pgr/[id]/ges/[gesId]`
  (**sem PUT** — vínculo não tem campos mutáveis). `pgr_revisions` → `GET`+`POST` em
  `/pgr/[id]/revisions` (**sem PUT/DELETE** — append-only). Consolidada → **`GET`** em
  `/pgr/[id]/consolidated` (read-only). Todos via `restHandler`.
- **Rationale**: o subset de verbos reflete a natureza (associação / append-only / agregado
  read-only). O checklist de CRUD da constituição é atendido pela combinação
  Action+REST+docs+Postman para cada recurso.

## D10 — Aba Informações básicas reaproveita o CRUD de `pgr`

- **Decisão**: a aba "Informações básicas" reusa o form/edição existente (`/pgr/[id]/edit` +
  `pgr-form.tsx`) — sem duplicar CRUD. O editor com abas engloba as abas GES/Revisões/Consolidada e
  linka/embute a edição básica. Modal de **Declaração** permanece no fluxo de **criação** (gate,
  aceite **não** persistido) — sem mudança de persistência.
- **Rationale**: DRY; a 013 já entrega o CRUD do documento.

## D11 — GED e Cor/Sumário: placeholder desabilitado (Fase 05)

- **Decisão**: as abas "Documentos GED" e "Cor/Sumário" aparecem **desabilitadas** com aviso
  ("Disponível na Fase 05"); **não** há schema/storage e **não** são critério de aceite.
- **Rationale**: roadmap coloca GED/PDF na Fase 05; zero-migration nesta fatia.

## D12 — Harness REST-via-Jest (limitação conhecida)

- **Decisão**: prever `rest-pgr-editor.test.ts`, mas se der **500** por limitação pré-existente
  (provado em 014/016/018), **documentar** e validar o REST por **cURL** contra o dev server no
  Postgres efêmero. Actions + isolamento provam a lógica.
- **Rationale**: mesma mitigação das fatias anteriores.
