# Briefing — Vínculo EPI × risco com neutralização (`epi-risk-link`)

> **Issue:** "Vínculo de EPIs ao risco do GES / neutralização" · **Branch alvo:** `feature/epi-risk-link`
> **Tipo:** fatia de **fluxo completo** (migration + domínio + repo + actions + REST + UI + testes + docs)
> sobre um modelo de dados que **já existe parcialmente** (tabela `epi_risk` shipada na fatia `008`).
> **Status:** análise / planejamento — nada implementado ainda.
> **Fonte da verdade:** o card da issue **+** este briefing (o spec citado no card não existe — ver §2).

---

## 1. Resumo executivo

Permitir que o gestor de SST **vincule EPIs a cada risco** do inventário do GES e registre, por EPI, **se
ele neutraliza o risco**. Esse vínculo é a base para (a) o **PGR** recomendar/exigir EPIs por exposição e
(b) futuramente a **Ordem de Serviço (OS)** listar os EPIs obrigatórios por função/risco.

O ponto central: a tabela `epi_risk` **já foi modelada e migrada** na fatia `008`, mas hoje ela é um
**vínculo interino EPI × GES** (não EPI × risco) e a neutralização é um **boolean** (Sim/Não). Esta fatia
é a **realização da evolução já planejada** (decisão **D6** de `briefing-pgr-risks-data-model.md`): repontar
o vínculo para a tabela `risks` e construir toda a camada de fluxo + UI + testes que ainda não existe.

**Portanto esta fatia = 1 migration de evolução + a stack de fluxo inteira (que hoje é zero para `epi_risk`).**

---

## 2. Reconciliação com a realidade do repositório (correções à issue)

O card foi escrito com nomenclatura genérica/desatualizada. Antes de qualquer implementação, alinhar:

| No card                                                 | Na realidade do repo                                                                                        | Impacto                                              |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Tabela `epi_risco`                                      | **`epi_risk`** ([src/shared/db/schema/epis.ts:242-275](../../src/shared/db/schema/epis.ts)) — **já existe** | Não criar tabela nova; **evoluir** a existente       |
| `organization_id`                                       | **`org_id`** (text → `orgs.id`) em toda tabela                                                              | Convenção do repo                                    |
| `features/pgr/`                                         | **`src/shared/...`** (schema/repositories/domains/server/actions) + UI em `src/app/(protected)/`            | Arquitetura em camadas do repo                       |
| Campo `neutraliza_risco` enum Sim/Não/N.A.              | Hoje é **`neutralizes boolean`** (só Sim/Não, default false)                                                | **Decisão D2**: migrar boolean → enum 3-estados      |
| FK para `riscos`                                        | Hoje FK para **`ges`** (interino); tabela `risks` já existe (fatia `012`)                                   | **Decisão D1**: repontar `ges_id` → `risk_id`        |
| "Testes: SQLite em memória"                             | **Proibido.** Integração roda contra **Postgres efêmero** (`INTEGRATION_*`)                                 | Ver §11 — o card ecoa a constituição desatualizada   |
| Ref `.specs/004-epgr-feature-parity/02-riscos-e-pgr.md` | **Não existe** no repo (spec `004` = multi-tenant-isolation)                                                | Usar spec `008` + este briefing como fonte           |
| "OS usa o vínculo"                                      | **Nenhuma menção a Ordem de Serviço** em specs/briefings                                                    | Downstream **não especificado** — tratar como futuro |

> ⚠️ **CA (Certificado de Aprovação)** mora em **`epi_catalog.ca`** (text, nullable —
> [epis.ts:60](../../src/shared/db/schema/epis.ts)), com `ca_valid_until`. Há também a tabela **global**
> `caepi_certificates` (`ca` como PK) — espelho do MTE, **sem FK** para o catálogo (correlação só por string).
> A busca de EPI já filtra por `name` **ou** `ca` (ver §7).

---

## 3. Estado atual do modelo (`epi_risk`, shipado na `008`)

[src/shared/db/schema/epis.ts:242-275](../../src/shared/db/schema/epis.ts):

```
epi_risk
  id           uuid PK
  org_id       text   NOT NULL → orgs.id (cascade)
  catalog_id   uuid   NOT NULL → epi_catalog.id (cascade)
  ges_id       uuid   NOT NULL → ges.id (cascade)        ← INTERINO (deveria ser risk_id)
  neutralizes  boolean NOT NULL DEFAULT false            ← só Sim/Não
  created_at / updated_at  timestamptz
  UNIQUE (org_id, catalog_id, ges_id)  = uq_epi_risk_org_catalog_ges
  índices: org_id, catalog_id, ges_id
  RLS: policy "epi_risk_isolation" (app_runtime, org_id = current_setting('app.current_org', true))
```

Fatos decisivos:

- A tabela **está vazia e sem consumidores** — **não há** repository, server action, REST nem UI para
  `epi_risk` (`src/shared/db/repositories/` só tem epi-catalog, epi-stock, epi-deliveries, epi-returns).
  → A migration de evolução é **baixo risco** (sem dados a migrar, sem código a quebrar).
- O comentário de schema ([epis.ts:238-241](../../src/shared/db/schema/epis.ts)) e a **decisão D6**
  ([briefing-pgr-risks-data-model.md:131-142](briefing-pgr-risks-data-model.md)) já preveem exatamente
  este repoint: `ges_id → risks.id`, mantendo `catalog_id` + `neutralizes`, unique `(org_id, catalog_id, risk_id)`.

Requisito canônico já escrito — **spec `008`** ([.specs/008-epi-data-model/spec.md](../../.specs/008-epi-data-model/spec.md)):
US4 (P3) "Vínculo EPI × risco do GES" e **FR-010** ("vincular item de catálogo indicando se **neutraliza**;
sem par duplicado no tenant"). O card desta issue **promove** esse vínculo interino ao vínculo definitivo
com o risco.

---

## 4. Requisitos (reinterpretados)

**Funcionais**

- Para um **risco** (linha do inventário do GES), listar/adicionar/remover EPIs vinculados.
- Cada vínculo registra a **neutralização** (ver D2 — enum Sim/Não/Não Aplicável).
- Adicionar EPI via **busca por nome ou CA** (reusa a query paginada do catálogo).
- Tabela do vínculo exibe: **Nome do EPI · CA · Neutraliza os Riscos? · Opções (remover)**.

**Regras de negócio**

- Um risco pode ter **zero ou mais** EPIs vinculados (risco sem EPI é **válido** = conjunto vazio, sem linha).
- A **indicação de neutralização é obrigatória** ao vincular um EPI.
- **Sem par duplicado** `(org, catalog_id, risk_id)` no tenant → erro `DUPLICATE` (SQLSTATE 23505).
- A seção EPI × risco integra o **cadastro/edição do risco** (ver §8 — na prática, tela de **edição**).
- Isolamento total por tenant: gravação/leitura sempre na org ativa da sessão, nunca do input do cliente.

**Distinção importante que o card confunde:** "risco **sem EPI**" (zero linhas) **≠** EPI vinculado com
neutralização **"Não Aplicável"** (uma linha existe, com valor N.A.). São coisas diferentes — a UI deve
deixar claro: não vincular nenhum EPI é o caso "sem EPI"; "Não Aplicável" é um valor de um vínculo existente.

---

## 5. Decisões a travar (D1–D6)

| #      | Decisão                    | Opções                                                                | Recomendação                                                                                                                                                           |
| ------ | -------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | Alvo do vínculo            | (a) manter `ges_id` interino · (b) repontar para `risk_id`            | **(b)** — realiza a D6 já planejada; o card é explicitamente EPI × **risco**. Migration troca FK + unique.                                                             |
| **D2** | Campo neutralização        | (a) manter `boolean` · (b) `pgEnum` 3-estados                         | **(b)** `epi_neutralization` = `neutralizes` \| `does_not_neutralize` \| `not_applicable` (rótulos pt-BR Sim/Não/Não Aplicável). Tabela vazia → troca de tipo é limpa. |
| **D3** | Exclusão do vínculo        | (a) física · (b) soft delete                                          | **(a) física** — espelha `ges_job_roles`; OS (que motivaria soft delete) **não existe** ainda. Revisitar se/quando OS surgir.                                          |
| **D4** | Origem do EPI selecionável | (a) `epi_catalog` (todos os itens) · (b) `epi_stock` (só com saldo)   | **(a) catálogo** — vínculo é normativo (indica EPI recomendado), independe de haver estoque. Reusa `listEpiCatalog`.                                                   |
| **D5** | Onde a seção aparece       | (a) dentro do submit do form de risco · (b) componente irmão pós-form | **(b)** — igual a `ManageFunctions`; precisa de `risk_id` persistido ⇒ vale na tela de **edição** (a de **criação** não tem id ainda).                                 |
| **D6** | Migration nº               | próxima livre                                                         | **`0014_epi_risk_link`** (develop está em `0012`; a `0013_risk_methodology` é desta stack — confirmar numeração livre no rebase).                                      |

> **Ponto de atenção D2 + card:** o card pede "Não Aplicável para riscos sem EPI". Isso é uma **affordance de
> UI** (não vincular nada), não o valor do enum. O valor `not_applicable` do enum é para um EPI **que está
> vinculado** mas cuja neutralização não se aplica (ex.: risco ergonômico com EPI de conforto). Modelar os dois.

---

## 6. Arquitetura / camadas a implementar

Padrão de referência a **replicar integralmente**: a junção **`ges_job_roles`** (GES ↔ job_roles com atributo
por vínculo). Mapeamento camada a camada:

| Camada         | Referência (`ges_job_roles`)                                                                                                           | Novo (`epi_risk`)                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Schema         | [ges-job-roles.ts:21-56](../../src/shared/db/schema/ges-job-roles.ts)                                                                  | evoluir [epis.ts:242-275](../../src/shared/db/schema/epis.ts) (D1/D2) |
| Repositório    | [repositories/ges-job-roles.ts](../../src/shared/db/repositories/ges-job-roles.ts) (`list`/`listAvailable`/`create`/`update`/`delete`) | novo `repositories/epi-risk.ts`                                       |
| Server Actions | [actions/pgr/ges.ts:95-144](../../src/shared/server/actions/pgr/ges.ts) (`officeAction`)                                               | novo `actions/pgr/epi-risk.ts`                                        |
| REST           | [api/v1/ges/[id]/job-roles/\*\*](../../src/app/api/v1/ges) (GET/POST + PUT/DELETE)                                                     | `api/v1/risks/[id]/epis/**`                                           |
| Zod            | [domains/pgr/ges.ts:26-63](../../src/shared/domains/pgr/ges.ts)                                                                        | novo em `domains/pgr/epi-risk.ts` (ou dentro de `risks.ts`)           |
| UI seção       | [ges/[id]/\_components/manage-functions.tsx](<../../src/app/(protected)/ges>)                                                          | novo `risks/[id]/_components/epi-risco-section.tsx`                   |

Wrappers compartilhados (reuso obrigatório, **não** reimplementar regra):
`officeAction` ([office-action.ts:18](../../src/shared/server/office-action.ts)) ·
`restHandler` ([api/rest.ts:83](../../src/shared/api/rest.ts)) ·
`withOrg` ([with-org.ts:13](../../src/shared/db/with-org.ts)) ·
`auditedTenantWrite` ([repositories/audited-write.ts:5](../../src/shared/db/repositories/audited-write.ts)) ·
`ActionResult` ([server/result.ts](../../src/shared/server/result.ts)) ·
`requireOfficeStaff` / `requireOfficeStaffPage` · primitivos `_ui/form` e `_ui/list`.

Contrato de repositório sugerido (`repositories/epi-risk.ts`), espelhando `ges-job-roles`:

- `listRiskEpis(orgId, { riskId }): Promise<RiskEpiItem[]>` — `innerJoin epi_catalog` para trazer
  `name` + `ca` + `neutralization`.
- `listAvailableEpisForRisk(orgId, riskId, { search? }): Promise<EpiOption[]>` — catálogo do tenant **menos**
  os já vinculados (`notInArray` por subquery), com busca por nome/CA (reusa filtro do catálogo).
- `createRiskEpi(orgId, input): Promise<RiskEpi>` — valida FK (risco e catálogo pertencem ao tenant), insere;
  duplicado → `DUPLICATE`.
- `updateRiskEpiNeutralization(orgId, id, { neutralization }): Promise<RiskEpi | null>` — `null` ⇒ `NOT_FOUND`.
- `deleteRiskEpi(orgId, id): Promise<boolean>`.

Todas via `withOrg`; escritas via `auditedTenantWrite`.

---

## 7. Reuso da busca de EPI

[repositories/epi-catalog.ts:114](../../src/shared/db/repositories/epi-catalog.ts) —
`listEpiCatalog(orgId, { search?, type?, page?, pageSize? }): Promise<Paginated<EpiCatalogListItem>>`:
`ilike '%term%'` sobre **`name` OU `ca` OU `categories.name`**, retorno `{ rows, total }` (paginação offset).
Action pronta: `listEpiCatalogAction` ([actions/pgr/epi-catalog.ts:19](../../src/shared/server/actions/pgr/epi-catalog.ts)).
→ A busca "adicionar EPI ao vínculo" reusa isso (ou a variante `listAvailableEpisForRisk` que exclui os já ligados).

---

## 8. UI — `EpiRiscoSection`

Padrão a copiar: **`ManageFunctions`**
([ges/[id]/\_components/manage-functions.tsx](<../../src/app/(protected)/ges>)) — client component
**autocontido** que **não** participa do submit do form pai; ele chama as actions de vínculo direto e dá
`reload()`:

- `reload()` busca vinculados + disponíveis em paralelo (`Promise.all`) no mount.
- `add` / `updateNeutralization` / `remove` rodam em `startTransition` e recarregam.
- Renderiza tabela **Nome · CA · Neutraliza os Riscos? (select por linha) · Remover** + linha de "adicionar"
  com busca de EPI (select/autocomplete de disponíveis) + select de neutralização.
- Montado como **irmão após `<RiskForm>`**, recebendo `riskId` — portanto na página de **edição**
  ([risks/[id]/edit/page.tsx](<../../src/app/(protected)/risks>)), que já tem o id persistido. A página de
  **criação** ([risks/new/page.tsx](<../../src/app/(protected)/risks>)) **não** exibe a seção (sem id ainda) —
  fluxo: cria o risco → redireciona para edição → vincula EPIs. Documentar esse fluxo na spec.

---

## 9. Migration (`0014_epi_risk_link`)

Sobre a `epi_risk` existente (tabela vazia → seguro):

1. **Dropar** FK `ges_id → ges` e o unique `uq_epi_risk_org_catalog_ges`.
2. **Renomear/repontar**: `ges_id` → `risk_id` com FK `→ risks.id ON DELETE CASCADE`.
3. **Recriar** unique `uq_epi_risk_org_catalog_risk (org_id, catalog_id, risk_id)` + índice em `risk_id`.
4. **Neutralização**: criar `pgEnum epi_neutralization` e converter a coluna `neutralizes` boolean →
   `neutralization epi_neutralization NOT NULL` (mapear default `false → does_not_neutralize`).
5. **SQL custom** (drizzle-kit não gera): `GRANT` para `app_runtime` já existe da `008`; **manter** a policy RLS
   `epi_risk_isolation` e o trigger `set_updated_at_epi_risk`. Conferir se o rename preserva ambos (recriar se preciso).

Gerar com `drizzle-kit generate` a partir do schema editado, **conferir o diff** (só deve tocar `epi_risk` +
o novo enum) e reinjetar o SQL custom. Validar `db:generate` idempotente ("No schema changes") após ajustar snapshot.

> ⚠️ **Constituição/YAGNI:** como a tabela nunca teve consumidores, evitar migração de dados. Se em algum
> ambiente `epi_risk` tiver linhas (não deveria), decidir estratégia antes de dropar `ges_id`.

---

## 10. Superfície de API (obrigatória — regra das 4 partes do CLAUDE.md)

A CRUD só está "pronta" com **as quatro** no mesmo PR:

1. **Server Actions** (`officeAction` → `ActionResult<T>`): list linked, list available, add, update-neutralization, remove.
2. **REST mirror** sob `src/app/api/v1/risks/[id]/epis/**` (`restHandler`): `GET` (lista) + `POST` (add) em
   `/risks/{id}/epis`; `PUT` (neutralização) + `DELETE` em `/risks/{id}/epis/{linkId}`. `201` no create, `204` no delete.
3. **Docs** — registrar recurso/verbos/filtros em [docs/api/api-design.md](../api/api-design.md) (tabelas "Recursos" e "Sumário").
4. **Postman** — pasta nova espelhando as outras em [docs/api/sst-manager.postman_collection.json](../api/sst-manager.postman_collection.json).

Códigos de erro do contrato (não HTTP cru): `VALIDATION` (422), `DUPLICATE` (409, par repetido),
`FK_NOT_FOUND`/`NOT_FOUND` (risco/EPI inexistente ou cross-tenant), `FORBIDDEN` (papel `client`).

---

## 11. Testes (obrigatório — **Postgres efêmero, nunca SQLite**)

O card diz "SQLite em memória" — **está errado** e ecoa a constituição desatualizada
([constitution.md:172-181](../../.specify/memory/constitution.md)), **sobreposta** pelo
[CLAUDE.md:12](../../CLAUDE.md) ("There is no SQLite path"). Integração usa o helper
[src/**tests**/integration/\_helpers/db.ts](../../src/__tests__/integration/_helpers/db.ts):
`INTEGRATION_DATABASE_URL` → Postgres efêmero, aplica migrations dividindo cada `.sql` em
`--> statement-breakpoint`. Self-skip (`describe.skip`) quando as envs não estão setadas.

- **Unit** (`jest --selectProjects unit`): schema Zod do vínculo (neutralização obrigatória; enum válido),
  regras puras (rótulos pt-BR, mapeamento).
- **Integração** (`jest --selectProjects integration`), padrão de
  [pgr/ges.test.ts](../../src/__tests__/integration/pgr) e
  [pgr/epi-catalog-isolation.test.ts](../../src/__tests__/integration/pgr): add/update/remove; `DUPLICATE`
  no par repetido; `NOT_FOUND` em risco/EPI de outra org; **isolamento cross-tenant** (vínculo de `org_b`
  nunca acessível por `org_a`); `FORBIDDEN` com papel `client`; risco com zero EPIs retorna lista vazia.
- `npm run test` **e** `npm run test:integration` verdes; `npm run check` (format+lint+typecheck+unit) verde.

---

## 12. Edge cases

- Risco **sem nenhum EPI** vinculado → válido (lista vazia, nenhuma linha).
- EPI vinculado com neutralização **"Não Aplicável"** (linha existe, valor N.A.).
- **Par duplicado** (mesmo EPI no mesmo risco) → `DUPLICATE`, não segundo insert.
- EPI **sem CA** (`ca` nullable) → tabela exibe CA vazio/"—".
- Remoção de EPI de **catálogo** (`epi_catalog`) já vinculado → `ON DELETE CASCADE` remove o vínculo
  (é o comportamento atual da FK `catalog_id`).
- Exclusão do **risco** → `CASCADE` remove os vínculos.
- **Remoção de EPI já referenciado em OS** (card) → **N/A hoje**: OS não existe; registrar como follow-up.
- Concorrência: dois gestores adicionando o mesmo par → unique constraint resolve (segundo vira `DUPLICATE`).

---

## 13. Critérios de aceite (reinterpretados)

- [ ] EPIs vinculáveis a um risco com **busca por nome ou CA**.
- [ ] **Neutralização obrigatória** ao vincular (Sim / Não / Não Aplicável — enum).
- [ ] Tabela exibe **Nome · CA · Neutraliza os Riscos? · remover**.
- [ ] Risco pode ter **zero** EPIs vinculados (válido).
- [ ] **Par duplicado** rejeitado (`DUPLICATE`).
- [ ] Vínculo de **outra organização nunca acessível** (isolamento comprovado em teste).
- [ ] Downstream: PGR consegue consultar EPIs por risco (query pronta e testada). _(OS: fora de escopo — §14.)_
- [ ] `npm run check` + `npm run test:integration` verdes.

---

## 14. Fora de escopo / riscos / follow-ups

- **Ordem de Serviço (OS)**: não existe no repo; o consumo pelo "OS lista EPIs obrigatórios" é **futuro** e
  não deve gatear esta fatia. Deixar a query de leitura pronta para reuso.
- **Tela de criação de risco** não exibe a seção (precisa de id persistido) — fluxo cria-depois-vincula.
- Se optar por **soft delete** (D3), reconsiderar quando a OS entrar (histórico de vínculo).
- **Consistência EPI×risco vs `control_measures`** (nível `ppe` da hierarquia NR-01, em
  [risks.ts](../../src/shared/db/schema/risks.ts)) — são conceitos distintos (medida de controle vs EPI
  concreto); não confundir nem tentar unificar aqui.
- Vínculo `epi_catalog.ca` ↔ `caepi_certificates` é **por string**, sem FK — validação de CA vigente é da
  fatia CAEPI, não desta.

---

## 15. Checklist de tarefas (mapeado ao card, corrigido)

- [ ] **Dados**: evoluir schema `epi_risk` — FK `ges_id → risk_id`, enum `epi_neutralization`, unique
      `(org_id, catalog_id, risk_id)` (D1/D2); migration `0014_epi_risk_link` + SQL custom (GRANT/trigger/RLS).
- [ ] **Dados**: schema Zod do vínculo (`domains/pgr/epi-risk.ts`) com neutralização obrigatória.
- [ ] **Backend**: `repositories/epi-risk.ts` (list linked / list available+busca / create / update / delete) via `withOrg`.
- [ ] **Backend**: Server Actions (`actions/pgr/epi-risk.ts`) por `officeAction` + `revalidatePath`.
- [ ] **Backend**: REST `api/v1/risks/[id]/epis/**` (GET/POST + PUT/DELETE) por `restHandler`.
- [ ] **Frontend**: `EpiRiscoSection` (client, padrão `ManageFunctions`) na página de **edição** do risco.
- [ ] **Frontend**: busca de EPI por nome/CA (reusa `listEpiCatalog`) + select de neutralização por linha.
- [ ] **Docs + Postman**: registrar o recurso (regra das 4 partes).
- [ ] **Multi-tenant**: tudo na org ativa da sessão; RLS backstop.
- [ ] **Testes**: unit (Zod/regras) + integração (add/update/remove, DUPLICATE, NOT_FOUND, **cross-tenant**,
      FORBIDDEN, zero-EPI) contra **Postgres efêmero**.
- [ ] **Qualidade**: `npm run check` + `npm run test:integration` verdes.

---

## 16. Referências (com correções)

- **Existe e é fonte:** [.specs/008-epi-data-model/spec.md](../../.specs/008-epi-data-model/spec.md) (US4 / FR-010),
  [.specs/008-epi-data-model/data-model.md](../../.specs/008-epi-data-model/data-model.md) (`epi_risk`).
- **Existe e é fonte:** [docs/briefings/briefing-pgr-risks-data-model.md](briefing-pgr-risks-data-model.md)
  (decisão **D6** = este repoint) e [epi-fluxos-panorama.md](epi-fluxos-panorama.md) (propósito PGR).
- **Referência de padrão:** `ges_job_roles` (schema/repo/actions/REST) e `ManageFunctions` (UI).
- **NÃO existe** (citado no card): `.specs/004-epgr-feature-parity/02-riscos-e-pgr.md` e `docs/architecture/`.
- **Regras transversais:** [CLAUDE.md](../../CLAUDE.md) (isolamento, regra das 4 partes da API, testes sem SQLite).

---

## 17. Template `/speckit-specify` (ajustado à realidade)

```
/speckit-specify

GIT_BRANCH_NAME: feature/epi-risk-link

Feature: EPI-risk neutralization link (evolui o vínculo interino epi_risk EPI×GES para EPI×risco)

CONTEXTO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho (Next.js 16 + React 19 +
Drizzle + Clerk + Zod). 1 issue = 1 branch = 1 spec. A tabela `epi_risk` JÁ EXISTE (fatia 008),
hoje ligada a `ges` (interino) com `neutralizes` boolean; esta fatia realiza a decisão D6:
repontar para `risks.id` e trocar a neutralização por enum Sim/Não/Não Aplicável, construindo a
camada de fluxo (repo/actions/REST/UI/testes) que ainda não existe. Leia antes: o schema em
src/shared/db/schema/epis.ts (epi_risk) e risks.ts, a junção de referência ges_job_roles
(schema/repo/actions/REST) e a UI ManageFunctions. Liste os arquivos que vai ler.

User stories (P1 = mais crítica):
- (P1) Como gestor de SST, quero vincular EPIs a cada risco e indicar se o EPI neutraliza o risco
  (Sim/Não/Não Aplicável), buscando o EPI por nome ou CA, para alimentar o PGR.

Success criteria mensuráveis:
- Cada risco pode ter zero ou mais EPIs vinculados, com indicação de neutralização obrigatória.
- Par (EPI, risco) é único por organização; vínculos de outra organização nunca são acessíveis.
- O PGR consegue consultar os EPIs por risco.

Edge cases:
- Risco sem nenhum EPI (só medidas coletivas/administrativas).
- EPI vinculado com neutralização "Não Aplicável".
- Par EPI×risco duplicado → rejeitado.

Restrições obrigatórias (constituição + CLAUDE.md):
- Todo acesso escopado pela organização ativa da sessão (nunca input do cliente); RLS backstop.
- Validação Zod em toda Server Action; REST espelho + docs + Postman (regra das 4 partes).
- Testes de integração contra POSTGRES EFÊMERO (INTEGRATION_*), NUNCA SQLite.

Só o "o quê" e o "porquê". Spec em pt-BR; branch e commits em inglês.
```
