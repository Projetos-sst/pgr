# Briefing — Modelo de dados de Riscos & PGR (paridade ePGR)

> **Tipo:** modelagem de dados pura (schema + migration + RLS + testes), análoga às fatias **006**
> (cadastros base) e **008** (modelo de EPIs). **Sem UI / sem Server Actions / sem CRUD** nesta fatia.
> **Status:** análise / pré-spec. Este documento reflete e disseca a task antes de gerar
> `spec → plan → tasks`.

---

## 1. Resumo da task (o que é, em uma frase)

Modelar e migrar o núcleo de dados do **PGR** (Programa de Gerenciamento de Riscos, NR-01/GRO) com
paridade ePGR: o **inventário de riscos** (`riscos`), a **avaliação de risco** (matriz 5×5), as
**medidas de controle** (hierarquia de 4 níveis NR-01), o **vínculo EPI × risco**, e o **PGR** em si
(documento + vínculo com GES + versionamento). É o módulo de dados **mais complexo** do sistema porque
quase toda coluna carrega obrigação legal (NR-01, GRO e eSocial **S-2240**).

**Cadeia de dependência (a lógica central):**

```
GES  →  riscos  →  avaliacoes_risco  →  medidas_controle
 │         │
 │         └──→  epi_risk (EPI neutraliza risco?)
 │
 └──(via pgrsetor / pgr_ges)──→  PGR consolida os GES e seus riscos
```

O **PGR** não inventaria riscos diretamente: ele **vincula GES** (N:N) e **agrega** os riscos já
inventariados nos GES da obra. Riscos pertencem ao **GES**; o PGR é a camada de consolidação/documento.

---

## 2. ⚠️ Reconciliação card × repositório (LER PRIMEIRO)

O card foi colado de um template antigo e **diverge do estado real do código**. Antes de qualquer
implementação, alinhar os pontos abaixo — vários invalidariam a fatia se seguidos ao pé da letra.

| #   | Card diz                                                                                                | Realidade do repo                                                                                                                                                                            | Ação                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| R1  | `src/lib/db/schema/pgr.ts`, `src/lib/db/schema/riscos.ts`                                               | Schema vive em **`src/shared/db/schema/`** (ex.: `companies.ts`, `ges.ts`, `epis.ts`). `src/lib/` **não existe**.                                                                            | Usar `src/shared/db/schema/`.                                                                                             |
| R2  | Coluna de tenant `organization_id`                                                                      | Convenção real é **`org_id text NOT NULL → orgs.id` (`onDelete: cascade`)**, indexada.                                                                                                       | Usar `org_id`.                                                                                                            |
| R3  | Testes de integração com **"SQLite em memória"**                                                        | **Não há caminho SQLite.** Integração roda contra **Postgres efêmero** (`INTEGRATION_*`), aplicando migrations por `--> statement-breakpoint`. Apontar para o banco de dev **TRUNCA** dados. | Usar Postgres efêmero. **Nunca** SQLite/dev.                                                                              |
| R4  | "Criar tabela `epi_risco`"                                                                              | **`epi_risk` já existe** (fatia 008, em `epis.ts`) — mas liga EPI ↔ **GES** (interino), com flag `neutralizes`.                                                                              | **Evoluir**, não recriar: trocar `ges_id` → `risk_id` (FK p/ a nova `riscos`). Ver §6.                                    |
| R5  | Tabelas em PT (`riscos`, `avaliacoes_risco`, `medidas_controle`, `pgrsetor`, `pgr_revisoes`)            | Convenção: **identificadores em inglês** (`companies`, `employees`, `ges`, `epi_catalog`…), com termos legais PT só em colunas (`razao_social`).                                             | **Decisão a travar** (§8 D1). Recomendo nomes em inglês.                                                                  |
| R6  | Refs `.specs/004-epgr-feature-parity/02-riscos-e-pgr.md` e `docs/architecture/02-modelagem-de-dados.md` | **Nenhum dos dois existe** no repo atual.                                                                                                                                                    | Localizar a fonte real da paridade ePGR (doc 02) antes de fechar os enums legais; senão tratar o próprio card como fonte. |
| R7  | "gerar **e aplicar** migrations"                                                                        | Padrão do projeto: `drizzle-kit` gera o `.sql` **offline** (conexão owner unpooled); a aplicação ocorre em ambiente controlado/efêmero. **Nunca** aplicar no Supabase/dev real.              | Só **gerar** o `.sql`; aplicar apenas no efêmero de teste.                                                                |

**Numeração:** a última migration é **`0009_ppe_return_record`**. Esta fatia gera **`0010_*`**.

---

## 3. Princípios não-negociáveis herdados

- **Isolamento multi-tenant (Constituição, Princípio I).** Toda tabela nova:
  - `org_id text NOT NULL → orgs.id` (`onDelete: cascade`), **indexada** (`idx_<t>_org_id`);
  - **RLS** via `pgPolicy(<t>_isolation, { for: "all", to: appRuntimeRole, using: tenantScope, withCheck: tenantScope }).enableRLS()`, onde
    `tenantScope = sql\`org_id = current_setting('app.current_org', true)\``;
  - acesso sempre via `withOrg(orgId, …)`; tenant **da sessão**, nunca de input do cliente.
  - Template canônico: `src/shared/db/schema/companies.ts` / `epis.ts`.
- **Testes obrigatórios (Princípio V).** Unit (regras puras/validação) + integração (constraints,
  RLS, cadeia de FK, isolamento cross-tenant) contra **Postgres efêmero**.
- **Drizzle é dono code-first.** GRANTs e triggers `set_updated_at` entram como **SQL custom dentro da
  migration** (não auto-emitidos pelo drizzle-kit) — padrão das migrations `0005`/`0007`.
- **Timestamps** `created_at`/`updated_at` `timestamptz NOT NULL DEFAULT now()` em todas.

---

## 4. As 7 entidades (modelo proposto)

> Nomes em **inglês** (recomendação R5/D1); o equivalente PT do card aparece entre parênteses.
> Todas têm `id uuid PK default random`, `org_id`, timestamps e RLS — omitidos abaixo por brevidade.

### 4.1 `risks` (`riscos`) — inventário NR-01 + eSocial S-2240

Pertence ao **GES**. É o coração da fatia.

| Coluna                                                 | Tipo                                | Notas                                         |
| ------------------------------------------------------ | ----------------------------------- | --------------------------------------------- |
| `ges_id`                                               | uuid NOT NULL → `ges.id` (cascade)  | risco pertence ao GES                         |
| `agent_type`                                           | enum `risk_agent_type`              | grupo NR-01 — **ver §7 e D2 (6 vs 7 grupos)** |
| `hazard` (perigo)                                      | text                                |                                               |
| `description` (risco/descrição)                        | text                                |                                               |
| `sources` (fontes geradoras)                           | text                                |                                               |
| `propagation` (trajetória/meios)                       | text                                |                                               |
| `exposure_time`                                        | enum `exposure_time`                | 8 faixas (§7)                                 |
| `possible_injuries` (possíveis lesões)                 | text                                |                                               |
| `noxious_agent_code` (`codigo_agente_nocivo`)          | text                                | eSocial S-2240, ex. `"01.01.001"`             |
| `measurement_unit` (`unidade_medida`)                  | enum `measurement_unit` **ou** text | eSocial — **D3 (lista fechada vs texto)**     |
| `concentration_intensity` (`concentracao_intensidade`) | numeric **nullable**                | quantitativo                                  |

Índices: `idx_risks_org_id`, `idx_risks_ges_id`.

### 4.2 `risk_assessments` (`avaliacoes_risco`) — matriz 5×5

| Coluna                                  | Tipo                                 | Notas                                     |
| --------------------------------------- | ------------------------------------ | ----------------------------------------- |
| `risk_id`                               | uuid NOT NULL → `risks.id` (cascade) |                                           |
| `criterion` (critério)                  | enum `assessment_criterion`          | `qualitative` / `quantitative`            |
| `probability` (probabilidade)           | integer **CHECK 1–5**                | 1 Rara … 5 Muito Provável                 |
| `severity` (severidade)                 | integer **CHECK 1–5**                | 1 Leve … 5 Mortes múltiplas               |
| `risk_level` (`nivel_risco`)            | integer **persistido**               | = `probability × severity` (1–25); **D4** |
| `uncertainty_degree` (`grau_incerteza`) | smallint **CHECK 0–2** ou enum       | 0 Certa / 1 Incerta / 2 Alt. Incerta      |
| `tolerance_limit` (`limite_tolerancia`) | text/numeric                         |                                           |
| `result` (`resultado`)                  | text                                 |                                           |
| `assessed_at` (data da avaliação)       | date                                 |                                           |

Backstop sugerido no banco: `CHECK (risk_level = probability * severity)` **e** `CHECK (risk_level between 1 and 25)`.
Índice: `idx_risk_assessments_risk_id`. **D5:** 1:1 (última avaliação) vs 1:N (histórico) — recomendo **1:N**.

### 4.3 `control_measures` (`medidas_controle`) — hierarquia NR-01 (4 níveis) + 5W2H

**Modelagem recomendada: 1 linha por (risco × nível)** — `unique(org_id, risk_id, control_level)`.

| Coluna                                       | Tipo                                 | Notas                                                    |
| -------------------------------------------- | ------------------------------------ | -------------------------------------------------------- |
| `risk_id`                                    | uuid NOT NULL → `risks.id` (cascade) |                                                          |
| `control_level` (nível)                      | enum `control_level`                 | I Eliminação · II Coletiva · III Administrativa · IV EPI |
| `applicable` (`aplicavel`)                   | boolean NOT NULL default false       |                                                          |
| `justification` (`justificativa`)            | text                                 |                                                          |
| `monitoring` (`monitoramento`)               | text                                 |                                                          |
| **5W2H (plano de ação)**                     |                                      | preenchido quando `applicable`                           |
| `action_what` (o quê)                        | text                                 |                                                          |
| `action_how` (como)                          | text                                 |                                                          |
| `action_tracking` (formas de acompanhamento) | text                                 |                                                          |
| `action_measurement` (aferição)              | text                                 |                                                          |
| `action_responsible` (responsável)           | text                                 |                                                          |
| `action_deadline` (prazo)                    | date                                 |                                                          |

Índice: `idx_control_measures_risk_id`.

### 4.4 `epi_risk` (`epi_risco`) — vínculo EPI × risco _(EVOLUÇÃO da tabela 008)_

Hoje (008): `(catalog_id → epi_catalog, ges_id → ges, neutralizes bool)`. A 008 já documenta que era
**interino** ("quando um modelo de risco dedicado existir, migra-se a FK"). **Esta fatia é esse
momento.** Proposta:

- **trocar** `ges_id → ges.id` por `risk_id → risks.id` (cascade);
- manter `catalog_id → epi_catalog.id` e a flag `neutralizes` (o card chama `neutraliza_risco`);
- ajustar o `unique` para `(org_id, catalog_id, risk_id)`.

> ⚠️ Altera tabela existente da 008 (drop FK/coluna `ges_id`, add `risk_id`). Cobrir por migration +
> teste. Ver **D6** (evoluir vs criar nova tabela e aposentar a antiga).

### 4.5 `pgr` — documento PGR (informações básicas)

| Coluna                                  | Tipo                                     | Notas                                               |
| --------------------------------------- | ---------------------------------------- | --------------------------------------------------- |
| `company_id`                            | uuid NOT NULL → `companies.id` (cascade) | empresa/obra — **D7 (obra = company vs work_unit)** |
| `responsible` (responsável/coordenador) | text                                     | **D8:** texto livre vs FK p/ usuário                |
| `registration_type` (tipo de registro)  | enum `pgr_registration_type`             | CRM / CREA / MTE / não aplicável                    |
| `registration_number` (nº do registro)  | text nullable                            |                                                     |
| `issued_at` (emissão)                   | date                                     |                                                     |
| `valid_until` (validade)                | date                                     |                                                     |

### 4.6 `pgr_ges` (`pgrsetor`) — vínculo PGR ↔ GES (N:N)

`pgr_id → pgr.id` (cascade) + `ges_id → ges.id` (cascade); `unique(org_id, pgr_id, ges_id)`;
índices em ambos os FKs.

### 4.7 `pgr_revisions` (`pgr_revisoes`) — versionamento do PGR

`pgr_id → pgr.id` (cascade); `revision_number` integer; `revised_at` date; `notes`/`summary` text;
**D9:** quem/o quê versiona (snapshot vs metadados). `unique(org_id, pgr_id, revision_number)`.

---

## 5. Enums a criar (`pgEnum`)

| Enum                    | Valores                                                                          | Obs.                                     |
| ----------------------- | -------------------------------------------------------------------------------- | ---------------------------------------- |
| `risk_agent_type`       | physical, chemical, biological, ergonomic, mechanical_accident, psychosocial     | **6 listados no card; AC exige 7 → D2**  |
| `exposure_time`         | `lt_1h`, `1_2h`, `2_4h`, `4_7h`, `gt_7h`, `eventual`, `intermittent`, `habitual` | 8 faixas (rótulos pt-BR na app)          |
| `measurement_unit`      | qualitative_na, db_a, db_c, m_s2, ppm, mg_m3, f_cm3, celsius, percent, lux, …    | **"etc." do card → D3 (fechar a lista)** |
| `assessment_criterion`  | qualitative, quantitative                                                        |                                          |
| `control_level`         | level_1_elimination, level_2_collective, level_3_administrative, level_4_ppe     |                                          |
| `pgr_registration_type` | crm, crea, mte, not_applicable                                                   |                                          |
| `uncertainty_degree`    | (alternativa a smallint) certain, uncertain, highly_uncertain                    | D4 decide enum vs smallint+CHECK         |

> Centralizar os enums (sobretudo **agente** e **unidade de medida eSocial**) em constantes
> compartilhadas para reuso em Zod e formulários (sugestão do card). **Atenção:** adicionar valor a
> enum existente depois (`ALTER TYPE … ADD VALUE`) **não roda dentro de transação** no Postgres —
> fechar as listas agora evita dor futura (lição da migration 0009).

---

## 6. Migration `0010_pgr_risk_data_model` (esboço)

Uma migration nova, análoga à `0005`/`0007`. Ordem importa:

1. `CREATE TYPE` dos enums (§5).
2. `CREATE TABLE` na ordem da cadeia de FK: `risks` → `risk_assessments` → `control_measures` →
   `pgr` → `pgr_ges` → `pgr_revisions`.
3. **ALTER `epi_risk`**: dropar FK/coluna `ges_id`; adicionar `risk_id` + FK + índice; ajustar unique
   (R4/D6). _(Se houver dados, decidir backfill — provavelmente vazia.)_
4. **SQL custom** (não auto-emitido): `GRANT` para `app_runtime` em cada tabela nova; triggers
   `set_updated_at` em cada tabela nova.
5. Índices em `org_id`, `ges_id`, `risk_id`, `pgr_id`.

Constraints de banco a garantir: CHECK 1–5 em `probability`/`severity`; CHECK do `risk_level`
(produto + faixa 1–25); CHECK 0–2 em `uncertainty_degree` (se smallint); todas as FKs encadeadas;
uniques de `pgr_ges`, `pgr_revisions`, `epi_risk`.

> Gerar com `npm run db:generate` (offline, owner unpooled). Validar o split por
> `--> statement-breakpoint`. **Não** rodar `db:migrate` contra dev/prod.

---

## 7. Faixas/gradações legais (referência rápida)

- **Probabilidade (1–5):** 1 Rara · 2 Pouco Provável · 3 Possível · 4 Provável · 5 Muito Provável.
- **Severidade (1–5):** 1 Leve s/ atenção médica · 2 Séria reversível · 3 Crítica irreversível ·
  4 Incapacitante/mortal · 5 Mortes/incapacitantes múltiplas (>10).
- **Nível de risco:** `prob × sev` ∈ [1, 25] (matriz 5×5), persistido.
- **Tempo de exposição (8):** <1h/turno · 1–2h · 2–4h · 4–7h · >7h · Eventual · Intermitente · Habitual.
- **Grau de incerteza (3):** 0 Certa · 1 Incerta · 2 Altamente Incerta.
- **Hierarquia de controle (4, NR-01):** I Eliminação · II Proteção Coletiva · III
  Administrativas/Organização · IV EPI.

---

## 8. Decisões a travar (clarify) — com recomendação

| #      | Decisão                                                              | Recomendação                                                                                                                                                              |
| ------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | Nomes de tabela em **inglês vs PT** (R5)                             | **Inglês** (`risks`, `risk_assessments`, `control_measures`, `pgr`, `pgr_ges`, `pgr_revisions`), termos legais PT só em colunas — coerente com `companies`/`ges`/`epi_*`. |
| **D2** | Enum de agente: **6 (card §escopo) vs 7 (card §aceite)**             | Resolver a contradição **interna do card**. Provável 7º = separar **Mecânicos** de **Acidentes**. Confirmar na fonte ePGR (R6).                                           |
| **D3** | `measurement_unit`: enum fechado vs `text` ("etc." do card)          | **Enum fechado** com a tabela eSocial (evita `ALTER TYPE` futuro); se a lista não puder ser fechada agora, usar `text` + validação Zod.                                   |
| **D4** | `risk_level`: app-computed+persistido (card) vs **generated column** | Seguir card (computa na app, persiste) **+ CHECK** `risk_level = probability*severity`. Alternativa limpa: coluna `GENERATED ALWAYS`.                                     |
| **D5** | `risk_assessments`: 1:1 vs 1:N (histórico)                           | **1:N** (histórico), com `assessed_at`.                                                                                                                                   |
| **D6** | `epi_risk`: **evoluir** (alterar FK) vs criar nova e aposentar       | **Evoluir** a 008 (`ges_id`→`risk_id`); tabela deve estar vazia.                                                                                                          |
| **D7** | `pgr` referencia **company** e/ou **work_unit** ("obra")             | Mínimo `company_id`; avaliar `work_unit_id` se "obra" = unidade.                                                                                                          |
| **D8** | `responsible` texto livre vs FK usuário                              | Texto livre nesta fatia (modelo de dados); FK fica para fase de fluxo.                                                                                                    |
| **D9** | Conteúdo de `pgr_revisions` (snapshot vs metadados)                  | Metadados de versão nesta fatia (número, data, notas); snapshot é fora de escopo.                                                                                         |

---

## 9. Fora de escopo (desta fatia)

- UI / formulários / Server Actions / Route Handlers / CRUD (fica para fatias de fluxo, à la 007/009).
- Cálculo automático de PGR consolidado, geração de PDF, lookup de tabela eSocial externa.
- Vínculo `employees ↔ risks`, treinamentos, exames (PCMSO).
- Snapshot versionado completo do PGR (só metadados de revisão aqui — D9).

---

## 10. Estratégia de testes (Princípio V)

- **Unit** (jsdom): schemas Zod centralizados (agente, unidade, critério, nível de controle); regra
  pura `risk_level = prob × sev` e seus limites; validação 1–5 e 0–2; rótulos pt-BR dos enums.
- **Integração** (Postgres **efêmero** `INTEGRATION_*`):
  - criação de todas as tabelas pela migration 0010 (split `--> statement-breakpoint`);
  - **RLS/isolamento** cross-tenant em cada tabela (dado de `org_a` não vaza para `org_b`);
  - **CHECK** rejeita `probability`/`severity` fora de 1–5 e `risk_level` incoerente;
  - **cadeia de FK**: `control_measures → risks → ges`; `pgr_ges → pgr + ges`; `epi_risk → risks`;
    `ON DELETE` propaga como esperado;
  - uniques (`pgr_ges`, `pgr_revisions`, `epi_risk`).
- **Nunca** SQLite nem o banco de dev (suítes fazem `TRUNCATE`).

---

## 11. Critérios de aceite (reescritos, testáveis)

- [ ] `risks`, `risk_assessments`, `control_measures`, `epi_risk` (evoluída), `pgr`, `pgr_ges`,
      `pgr_revisions` existem após a migration `0010` no Postgres efêmero.
- [ ] **RLS habilitada** + policy de isolamento (`app_runtime`) em todas as tabelas novas.
- [ ] FKs encadeadas válidas (`control_measures → risks → ges`; `pgr_ges → pgr + ges`;
      `epi_risk → risks`).
- [ ] `CHECK` impede `probability`/`severity` fora de 1–5 (e `risk_level` fora de 1–25 / incoerente).
- [ ] Campos eSocial S-2240 (`noxious_agent_code`, `measurement_unit`) presentes e tipados.
- [ ] Enum de agente cobre os grupos NR-01 (**número confirmado em D2**).
- [ ] Enum de tempo de exposição cobre as **8** faixas ePGR.
- [ ] `org_id` NOT NULL + índice em todas; `lint` + `tsc --noEmit` + `test` + `test:integration`
      (efêmero) verdes.

---

## 12. Sugestão de sequência (plan/tasks)

1. **Enums + constantes compartilhadas** (Zod + rótulos) — base reusável.
2. **Schema Drizzle** na ordem da cadeia: `risks` → `risk_assessments` → `control_measures` →
   `pgr` → `pgr_ges` → `pgr_revisions`; depois **evoluir `epi_risk`**.
3. **Migration `0010`** (`db:generate` offline) + SQL custom (GRANT + triggers) + revisão da ordem.
4. **Testes** unit + integração (efêmero) cobrindo §10.
5. **Quality gate**: `npm run check` + `test:integration`.

---

## 13. Referências

- Template de schema/RLS: `src/shared/db/schema/companies.ts`, `src/shared/db/schema/epis.ts`.
- Cadeia base: `src/shared/db/schema/{ges,companies,work-units,employees,categories}.ts`.
- Padrão de migration com SQL custom: `0005_cadastros_base_pgr.sql`, `0007_epi_data_model.sql`.
- Constituição: `.specify/memory/constitution.md` (Princípio I — isolamento; Princípio V — testes).
- Fatias análogas: **006** (`.specs/006-cadastros-base-pgr/`), **008** (`.specs/008-epi-data-model/`).
- ⚠️ Refs do card **ausentes** no repo (R6): `.specs/004-epgr-feature-parity/02-riscos-e-pgr.md`,
  `docs/architecture/02-modelagem-de-dados.md` — localizar a fonte ePGR antes de fechar enums legais.
