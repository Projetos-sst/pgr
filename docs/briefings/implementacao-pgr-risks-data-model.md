# Implementação — Modelo de dados de Riscos & PGR (paridade ePGR)

> Registro do que foi efetivamente implementado, com as decisões resolvidas. Companion do
> [briefing de análise](briefing-pgr-risks-data-model.md). Fatia de **modelagem de dados pura**
> (schema + migration + RLS + testes), análoga à 006/008 — **sem UI/Server Actions/CRUD**.
> **Data:** 2026-06-29.

---

## 1. O que foi entregue

6 tabelas novas + 6 enums novos, isoladas por tenant (RLS), com migration `0012` gerada offline e
testes (unit + integração). Build verde: `tsc`, `eslint`, `prettier` e **273 testes unitários**.

### Arquivos criados

- **Schema** — `src/shared/db/schema/risks.ts`: tabelas `risks`, `risk_assessments`,
  `control_measures` + enums `risk_agent_type`, `exposure_time`, `measurement_unit`,
  `assessment_criterion`, `control_level`.
- **Schema** — `src/shared/db/schema/pgr.ts`: tabelas `pgr`, `pgr_ges`, `pgr_revisions` + enum
  `pgr_registration_type`.
- **Domínio** — `src/shared/domains/pgr/risks.ts`: schemas Zod dos enums, `probabilitySchema`/
  `severitySchema`/`uncertaintyDegreeSchema`, `computeRiskLevel()` (matriz 5×5, pura) e rótulos pt-BR.
- **Migration** — `src/shared/db/migrations/0012_pgr_risk_data_model.sql` (+ `meta/0012_snapshot.json`,
  entrada no `meta/_journal.json`).
- **Testes unit** — `src/__tests__/unit/domains/pgr/risks.test.ts`.
- **Testes integração** — `src/__tests__/integration/pgr/pgr-risk-isolation.test.ts`,
  `pgr-risk-constraints.test.ts`, `pgr-risk-migration-shape.test.ts`.

### Arquivos alterados

- `src/shared/db/schema/index.ts` — exporta os novos schemas/enums/tipos.
- `src/__tests__/integration/_helpers/pgr-seed.ts` — semeia 1 linha por tenant para cada tabela nova
  (IDs novos em `PGR_IDS`); bloco `epi_risk` **inalterado**.
- `src/__tests__/integration/shared/db/epi-migration-shape.test.ts` — corrigido drift pré-existente da
  012 (enum `stock_movement_type` agora inclui `employee_return`). Ver §5.

---

## 2. Modelo final (resumo)

```
GES ──→ risks ──→ risk_assessments        (matriz 5×5)
          └────→ control_measures         (hierarquia NR-01, 4 níveis, 5W2H)
companies ──→ pgr ──→ pgr_ges (↔ ges, N:N)
                   └─→ pgr_revisions
```

- **`risks`**: `ges_id` (cascade), `agent_type`+`description` NOT NULL, campos descritivos texto livre,
  eSocial `noxious_agent_code`/`measurement_unit`, `concentration_intensity` numeric nullable.
- **`risk_assessments`**: `criterion`, `probability`/`severity` CHECK 1–5, `risk_level` persistido com
  CHECK de coerência (`= probability*severity`) e faixa (1–25), `uncertainty_degree` CHECK 0–2, histórico
  (1:N) via `assessed_at`.
- **`control_measures`**: `control_level` + `applicable` + justificativa/monitoramento + 5W2H;
  `unique(org_id, risk_id, control_level)`.
- **`pgr`**: `company_id` (cascade) + `work_unit_id` (SET NULL) + responsável + tipo/nº de registro +
  datas emissão/validade.
- **`pgr_ges`**: N:N PGR↔GES; `unique(org_id, pgr_id, ges_id)`.
- **`pgr_revisions`**: metadados de versão; `unique(org_id, pgr_id, revision_number)`.

Todas: `org_id` NOT NULL → `orgs` (cascade) indexado, RLS `*_isolation` para `app_runtime`
(`current_setting('app.current_org', true)`), GRANT + trigger `set_updated_at` (SQL custom na migration),
timestamps `timestamptz`.

---

## 3. Decisões resolvidas (D1–D9 do briefing)

| #   | Decisão                     | **Resolução aplicada**                                                                                                                                                                                                              |
| --- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Idioma dos nomes            | **Inglês** (`risks`, `risk_assessments`, `control_measures`, `pgr`, `pgr_ges`, `pgr_revisions`), coerente com `companies`/`ges`/`epi_*`. Rótulos pt-BR no domínio.                                                                  |
| D2  | Agente: 6 vs 7 grupos       | **7 grupos**: `physical, chemical, biological, ergonomic, mechanical, accident, psychosocial` (desmembrei "Mecânicos/Acidentes" para satisfazer o critério de aceite de **7**). ⚠️ Confirmar contra a fonte ePGR quando disponível. |
| D3  | `measurement_unit`          | **Enum fechado** (`qualitative_na, db_a, db_c, m_s2, ppm, mg_m3, f_cm3, celsius, percent, lux`). Extensível por migration futura (`ALTER TYPE … ADD VALUE` — fora de transação).                                                    |
| D4  | `risk_level`                | App calcula (`computeRiskLevel`) e persiste; banco protege com **CHECK de coerência** `risk_level = probability*severity` + faixa 1–25.                                                                                             |
| D5  | Avaliações 1:1 vs 1:N       | **1:N** (histórico) por `risk_id` + `assessed_at`.                                                                                                                                                                                  |
| D6  | `epi_risk` evoluir vs adiar | **ADIADO** (ver §4) — `epi_risk` mantido na forma 008 (EPI×GES).                                                                                                                                                                    |
| D7  | `pgr` referencia obra       | `company_id` (NOT NULL, cascade) **+** `work_unit_id` (nullable, SET NULL) representando a "obra".                                                                                                                                  |
| D8  | `responsible`               | **Texto livre** nesta fatia (modelo de dados); FK para usuário fica para fase de fluxo.                                                                                                                                             |
| D9  | `pgr_revisions`             | **Metadados** de versão (número, data, notas); snapshot completo fora de escopo.                                                                                                                                                    |

---

## 4. ⚠️ Decisão-chave: `epi_risk` mantido na forma 008 (D6)

O briefing recomendava **evoluir** `epi_risk` (`ges_id` → `risk_id`) agora que existe `risks`. Na
implementação isso foi **revertido e adiado**, pelo princípio "não dar problema no código":

- O swap de FK é uma **ALTER destrutiva** numa tabela **já mergeada na 008**, com efeito em seed e em 3
  testes de integração da 008.
- `drizzle-kit generate` precisa de **prompt interativo** (TTY) para distinguir "rename `ges_id`→`risk_id`"
  de "drop+add" — e o ambiente de execução **não tem TTY**, então o comando falha. Forçar isso exigiria
  editar SQL **e** snapshot à mão (frágil) ou um ambiente interativo.

Decisão: entregar as 6 tabelas novas (puramente aditivas → `generate` roda headless, **zero** blast radius)
e deixar a religação `epi_risk → risks` para uma **fatia dedicada**. A infra (`risks`) já está pronta,
então a evolução futura é direta.

**Receita do follow-up** (fatia própria, ambiente com TTY):

1. Em `schema/epis.ts`: `gesId` → `riskId` (`references(() => risks.id, { onDelete: "cascade" })`);
   índice `idx_epi_risk_ges_id` → `idx_epi_risk_risk_id`; unique `uq_epi_risk_org_catalog_ges` →
   `uq_epi_risk_org_catalog_risk`; importar `risks` (remover `ges`).
2. `npm run db:generate` (responder "não é rename" no prompt) → migration `0011_*`; adicionar GRANT/trigger
   se necessário (a tabela já existe; só ALTER).
3. Atualizar `pgr-seed.ts` (inserir `epi_risk` com `risk_id` referenciando `riskA`/`riskB`) e os testes
   `epi-risk-isolation.test.ts` / `epi-constraints.test.ts` (trocar `ges_id` por `risk_id`).

---

## 5. Correção de passagem (drift da 012)

`epi-migration-shape.test.ts` esperava `stock_movement_type = [purchase, employee_delivery, adjustment,
discard]`, mas a migration `0009` (fatia 012) adicionou `employee_return` **antes de** `adjustment`. O
array esperado foi corrigido para incluir `employee_return` na posição correta. Sem essa correção, o teste
de forma falharia contra o Postgres efêmero (não afeta o build local, que só roda unit).

---

## 6. Verificação executada

- `npx tsc --noEmit` → **0 erros**.
- `npx eslint` (arquivos novos/alterados) → **0 problemas**.
- `npx prettier --check` (arquivos novos) → **OK**.
- `npm run test` (unit) → **273/273 testes** passam (inclui `risks.test.ts`).
- `npm run db:generate` → migration `0012` gerada **offline** (sem conectar ao banco).

### Não executado (e por quê)

- **`npm run test:integration`**: requer **Postgres efêmero** (`INTEGRATION_*`), indisponível aqui. As
  suítes novas ficam `describe.skip` sem essas envs. **Nunca** apontar para o banco de dev (faz `TRUNCATE`).
- **`db:migrate`/`push`**: a migration **não** foi aplicada a nenhum banco — só o `.sql` foi gerado offline,
  conforme a regra do projeto.
- **Commit/push**: não realizados (faço só quando você pedir). As mudanças estão na árvore de trabalho da
  branch atual (`feature/ppe-return-record`).

---

## 7. Pendências / próximos passos sugeridos

- Rodar `npm run test:integration` contra Postgres efêmero para validar RLS/CHECK/FK/ON DELETE das 6
  tabelas (suítes já escritas).
- Confirmar **D2** (7º grupo de agente) e a lista de **D3** (`measurement_unit`) contra a fonte ePGR.
- Agendar a fatia de **religação `epi_risk → risks`** (§4).
- Decidir branch/commit: estas mudanças deveriam ir para uma branch própria de fatia
  (ex.: `feature/pgr-risk-data-model`) em vez da branch da 012.

---

## 8. Prompt para `/speckit-specify`

> Copie o bloco abaixo e cole após `/speckit-specify` para gerar a spec formal desta fatia. Reflete o
> que **já foi implementado** (§1–§5) — serve para formalizar/auditar a fatia no fluxo Spec Kit.

```text
/speckit-specify

GIT_BRANCH_NAME: feature/pgr-risk-data-model

Feature: Modelo de dados de Riscos & PGR (paridade ePGR) — inventário de riscos NR-01/GRO +
eSocial S-2240, avaliação de risco (matriz 5×5), medidas de controle (hierarquia NR-01 de 4
níveis) e o documento PGR (vínculo com GES + versionamento). Fatia de MODELAGEM DE DADOS PURA
(schema Drizzle + migration + RLS + testes), análoga às fatias 006 e 008. SEM UI, SEM Server
Actions, SEM CRUD.

CONTEXTO:

Plataforma SST multi-tenant (Next.js 16 App Router + Drizzle + Postgres/Supabase + Clerk). Este é
o módulo de dados mais complexo do sistema — quase toda coluna carrega obrigação legal. A cadeia
de dependência é: GES -> riscos -> avaliação -> controles; e o PGR consolida os GES (N:N) e agrega
os riscos já inventariados neles.

RECONCILIAÇÃO CARD x REPO (o card de origem usava um template antigo; usar o repo real):
- Schema vive em src/shared/db/schema/ (NÃO src/lib/db/schema/).
- Coluna de tenant é org_id text NOT NULL -> orgs.id (onDelete cascade), indexada (NÃO
  organization_id).
- Testes de integração rodam contra Postgres EFÊMERO (INTEGRATION_*); NÃO existe caminho SQLite;
  nunca apontar para o banco de dev (faz TRUNCATE).
- epi_risk JÁ EXISTE (fatia 008) ligando EPI x GES de forma interina. Esta fatia NÃO altera
  epi_risk (a religação epi_risk -> risks é follow-up dedicado, por exigir ALTER destrutiva +
  prompt interativo do drizzle-kit). Mantê-lo como está.
- Próxima migration é 0012 (a última é 0011_epi_delivery_return).

ARQUIVOS A LER ANTES: src/shared/db/schema/{companies,ges,work-units,categories,epis}.ts (templates
de RLS/FK/enum), src/shared/db/roles.ts, drizzle.config.ts,
src/shared/db/migrations/0007_epi_data_model.sql (padrão de GRANT + trigger set_updated_at como SQL
custom), .specify/memory/constitution.md (Princípio I isolamento; Princípio V testes),
src/__tests__/integration/_helpers/{db,pgr-seed,isolation-suite}.ts.

MODELO (6 tabelas novas + 6 enums; identificadores em INGLÊS, rótulos pt-BR no domínio):

Enums (pgEnum):
- risk_agent_type: physical, chemical, biological, ergonomic, mechanical, accident, psychosocial
  (7 grupos NR-01 — "Mecânicos/Acidentes" desmembrado para atender ao critério de 7).
- exposure_time: lt_1h, 1_2h, 2_4h, 4_7h, gt_7h, eventual, intermittent, habitual (8 faixas).
- measurement_unit (eSocial S-2240, lista fechada): qualitative_na, db_a, db_c, m_s2, ppm, mg_m3,
  f_cm3, celsius, percent, lux.
- assessment_criterion: qualitative, quantitative.
- control_level: elimination, collective_protection, administrative, ppe (níveis I-IV NR-01).
- pgr_registration_type: crm, crea, mte, not_applicable.

Tabelas (todas com id uuid PK default random, org_id text NOT NULL -> orgs(id) cascade indexado,
created_at/updated_at timestamptz NOT NULL default now(), RLS <t>_isolation para app_runtime com
org_id = current_setting('app.current_org', true), GRANT + trigger set_updated_at como SQL custom
na migration):

1. risks: ges_id uuid NOT NULL -> ges(id) cascade; agent_type NOT NULL; description NOT NULL;
   hazard, sources, propagation, possible_injuries text; exposure_time enum nullable;
   noxious_agent_code text (ex. "01.01.001"); measurement_unit enum nullable;
   concentration_intensity numeric nullable. Índices: idx_risks_org_id, idx_risks_ges_id.

2. risk_assessments (matriz 5x5, histórico 1:N por risco): risk_id uuid NOT NULL -> risks(id)
   cascade; criterion NOT NULL; probability integer NOT NULL CHECK between 1 and 5; severity
   integer NOT NULL CHECK between 1 and 5; risk_level integer NOT NULL (persistido = probabilidade
   x severidade) com CHECK risk_level = probability*severity E CHECK between 1 and 25;
   uncertainty_degree smallint NOT NULL default 0 CHECK between 0 and 2; tolerance_limit text;
   result text; assessed_at date NOT NULL default now(). Índices: org_id, risk_id.

3. control_measures (hierarquia NR-01, 1 linha por risco x nível): risk_id uuid NOT NULL ->
   risks(id) cascade; control_level enum NOT NULL; applicable boolean NOT NULL default false;
   justification, monitoring text; plano 5W2H: action_what, action_how, action_tracking,
   action_measurement, action_responsible text + action_deadline date.
   UNIQUE(org_id, risk_id, control_level). Índices: org_id, risk_id.

4. pgr (documento): company_id uuid NOT NULL -> companies(id) cascade; work_unit_id uuid nullable
   -> work_units(id) SET NULL (a "obra"); responsible text; registration_type enum NOT NULL default
   not_applicable; registration_number text; issued_at date; valid_until date. Índices: org_id,
   company_id.

5. pgr_ges (N:N PGR<->GES): pgr_id uuid NOT NULL -> pgr(id) cascade; ges_id uuid NOT NULL ->
   ges(id) cascade. UNIQUE(org_id, pgr_id, ges_id). Índices: org_id, pgr_id, ges_id.

6. pgr_revisions (versionamento, metadados): pgr_id uuid NOT NULL -> pgr(id) cascade;
   revision_number integer NOT NULL; revised_at date NOT NULL default now(); notes text.
   UNIQUE(org_id, pgr_id, revision_number). Índices: org_id, pgr_id.

DOMÍNIO (puro, src/shared/domains/pgr/risks.ts): schemas Zod espelhando os enums; probabilitySchema
/severitySchema (1-5), uncertaintyDegreeSchema (0-2); função pura computeRiskLevel(prob,sev) =
prob*sev (espelha o CHECK de coerência); mapas de rótulo pt-BR (agente, faixa de exposição, nível
de controle, critério, incerteza, tipo de registro).

MODELO B / ISOLAMENTO (não-negociável, Constituição Princípio I): tenant ativo SEMPRE da sessão
(requireTenantContext()), nunca de input do cliente; acesso via withOrg; RLS backstop em toda
tabela. Migration aplicada por conexão owner unpooled; runtime conecta como app_runtime.

DECISÕES TRAVADAS: nomes em inglês; 7 grupos de agente; measurement_unit enum fechado (extensível);
risk_level calculado na app e persistido + CHECK de coerência no banco; avaliações 1:N (histórico);
pgr com company_id + work_unit_id (SET NULL); responsible texto livre; pgr_revisions só metadados;
epi_risk NÃO alterado nesta fatia.

FORA DE ESCOPO: UI/formulários/Server Actions/CRUD; PGR consolidado/PDF; lookup eSocial externo;
vínculo employees<->risks; religação epi_risk -> risks (follow-up); snapshot completo de revisão.

TESTES (obrigatórios): unit (schemas Zod, computeRiskLevel e limites, rótulos); integração contra
Postgres EFÊMERO (INTEGRATION_*): isolamento RLS cross-tenant nas 6 tabelas, CHECK 1-5/coerência/
1-25/0-2, uniques (pgr_ges, pgr_revisions, control_measures), FKs encadeadas e ON DELETE
(CASCADE GES->riscos->avaliações/controles; CASCADE PGR->pgr_ges/pgr_revisions; SET NULL
pgr.work_unit_id), e forma/conformidade da migration (RLS/policy/GRANT/trigger/org_id indexado/
enums). Nunca SQLite nem banco de dev.

User stories:

P1 - Isolamento multi-tenant das tabelas de Riscos & PGR: como plataforma, garanto que riscos,
avaliações, controles e PGRs de uma organização nunca sejam visíveis ou graváveis por outra. Teste:
com org_a fixado, SELECT sem WHERE traz só linhas de org_a; INSERT marcado para org_b é recusado
pelo WITH CHECK; query bare (sem tenant) traz 0 linhas.

P1 - Inventário de riscos por GES com campos legais: como base do PGR, persisto riscos vinculados ao
GES com agente (7 grupos), tempo de exposição (8 faixas), campos descritivos e os campos eSocial
S-2240 (noxious_agent_code, measurement_unit, concentration_intensity). Teste: criar risco válido;
agente fora do enum é recusado; FK de GES inexistente é recusada.

P2 - Avaliação de risco (matriz 5x5) e medidas de controle: persisto avaliação com probabilidade/
severidade 1-5, risk_level coerente (=prob*sev, 1-25) e grau de incerteza 0-2; e medidas nos 4
níveis da hierarquia (um por nível por risco) com plano 5W2H. Teste: CHECK recusa prob/sev fora de
1-5, risk_level incoerente e incerteza fora de 0-2; UNIQUE recusa nível duplicado por risco.

P3 - Documento PGR consolidando GES + versionamento: persisto o PGR (empresa/obra, responsável,
registro, datas), vinculo GES (N:N) e registro revisões. Teste: UNIQUE recusa vínculo PGR-GES e nº
de revisão duplicados; excluir o PGR remove vínculos e revisões em cascata; excluir a obra preserva
o PGR e zera work_unit_id (SET NULL).

Success criteria:
- SC-001: as 6 tabelas e 6 enums são criados pela migration 0012 no Postgres efêmero.
- SC-002: RLS habilitada + policy de isolamento para app_runtime em todas as 6 tabelas.
- SC-003: org_id NOT NULL e indexado em todas; GRANT (SELECT/INSERT/UPDATE/DELETE) + trigger
  set_updated_at presentes em todas.
- SC-004: CHECK impede probabilidade/severidade fora de 1-5, risk_level incoerente ou fora de
  1-25, e incerteza fora de 0-2.
- SC-005: campos eSocial S-2240 (noxious_agent_code, measurement_unit) presentes e tipados; enum de
  agente cobre 7 grupos e o de exposição cobre 8 faixas.
- SC-006: FKs encadeadas válidas e ON DELETE corretos (CASCADE na cadeia GES e PGR; SET NULL em
  pgr.work_unit_id); uniques de pgr_ges, pgr_revisions e control_measures ativos.
- SC-007: suíte unit verde e suíte de integração verde contra Postgres efêmero; lint + typecheck
  verdes. Nenhuma migration aplicada a banco real/dev.

Edge cases:
- risk_level informado divergente de probabilidade x severidade -> recusado pelo CHECK de coerência.
- Segunda medida de controle no mesmo nível para o mesmo risco -> recusada (UNIQUE).
- Segundo vínculo PGR-GES idêntico ou nº de revisão repetido -> recusado (UNIQUE).
- Excluir GES -> remove em cascata riscos, avaliações e medidas daquele GES.
- Excluir a obra (work_unit) referenciada pelo PGR -> PGR preservado, work_unit_id vira NULL.
- Inserir risco/medida/avaliação sem tenant fixado (query bare) -> 0 linhas / recusado pela RLS.
- Valor fora dos enums (agente, unidade, nível, critério, tipo de registro) -> recusado.
- Extensão futura de measurement_unit exige nova migration (ALTER TYPE ADD VALUE roda fora de
  transação) — registrar como assunção.
```
