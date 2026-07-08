# Briefing — Metodologia de avaliação de riscos (matriz 5×5 configurável) · issue #76

> **Issue:** `[Fase 03] 02 · Metodologia de avaliação de riscos (matriz 5×5 configurável)` (#76)
> **Branch sugerida:** `feature/risk-methodology`
> **Tipo:** fatia de **fluxo completo** (schema + migration + Zod + Server Action + REST + query + **UI**
>
> - testes) — diferente da fatia de riscos (#129), que foi **modelo de dados puro**.
>   **Status:** análise / pré-spec. Este documento disseca a task **antes** de gerar `spec → plan → tasks`.

---

## 1. Resumo da task (o que é, em uma frase)

Permitir que **cada organização configure a metodologia** com que avalia riscos: os **rótulos e descrições
dos 5 níveis de probabilidade** e dos **5 de severidade**, as **faixas de classificação** do nível de risco
(`prob × sev` ∈ [1,25]) em **Trivial / Tolerável / Moderado / Substancial / Intolerável**, e a **base** que
origina esses padrões (**AIHA / AS/NZS 4360 / Fundacentro / Personalizada**). A tela também **reexibe**
(read-only) a hierarquia de controle da **NR-01 (4 níveis)**. É **uma configuração por organização** (upsert),
acessível por um **modal global** a partir da listagem de PGRs e das telas de GES/Riscos.

**A lógica central (a "sacada" da fatia):** a matriz 5×5 **não é armazenada célula a célula**. Guarda-se
apenas (a) os rótulos das gradações e (b) as **faixas** de classificação; a classe de **cada uma das 25
células é derivada** por uma função pura `classify(prob × sev, faixas)`. Mudar a metodologia **reclassifica**
todas as avaliações da organização automaticamente (classificação **derivada na leitura**, não congelada).

```
Metodologia (1 por org)
 ├─ gradações de probabilidade [1..5]  → rótulo + descrição
 ├─ gradações de severidade    [1..5]  → rótulo + descrição
 ├─ faixas de classificação             → mapeiam nivel_risco (1..25) → {trivial…intolerable}
 └─ base (aiha | as_nzs_4360 | fundacentro | custom)

risk_assessments.risk_level (já existe, #129)  ──classify()──►  classificação exibida
```

---

## 2. ⚠️ Reconciliação card × repositório (LER PRIMEIRO)

A issue reaproveita um template genérico e **diverge do estado real do código** em vários pontos. Seguir ao
pé da letra invalidaria a fatia.

| #      | Card diz                                                         | Realidade do repo                                                                                                                                            | Ação                                                                                                                         |
| ------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **R1** | `features/pgr/` (actions, schema, queries, components)           | Não existe `features/`. O código vive em `src/shared/{db/schema,domains/pgr,db/repositories,server/actions/pgr}` + UI em `src/app/(protected)/<recurso>/`.   | Usar a estrutura `src/shared/**` e `src/app/(protected)/**`.                                                                 |
| **R2** | Tenant `organization_id`                                         | Convenção real: **`org_id text NOT NULL → orgs.id`** (`onDelete: cascade`), indexada.                                                                        | Usar `org_id`.                                                                                                               |
| **R3** | Testes de integração com **"SQLite em memória"**                 | **Não há SQLite.** Integração roda contra **Postgres efêmero** (`INTEGRATION_*`), aplicando migrations por `--> statement-breakpoint`. Dev/prod **TRUNCAM**. | Postgres efêmero. **Nunca** SQLite/dev.                                                                                      |
| **R4** | Tabela `metodologia_avaliacao` **ou** `organizations_config`     | Identificadores em **inglês**. Sugiro tabela dedicada **`risk_methodology`** (não misturar num blob `organizations_config` genérico).                        | `risk_methodology`, uma linha por org.                                                                                       |
| **R5** | `presets` em `features/pgr/methodology-presets.ts`               | Constantes de domínio vivem em `src/shared/domains/pgr/`.                                                                                                    | `src/shared/domains/pgr/methodology-presets.ts`.                                                                             |
| **R6** | Refs `.specs/004-epgr-feature-parity/…` e `docs/architecture/`   | **Nenhum dos dois existe** no repo. (a #129 já registrou essa ausência.)                                                                                     | Tratar o próprio card como fonte da paridade ePGR; não bloquear por eles.                                                    |
| **R7** | "modal global na listagem de PGRs" / "tela de cadastro de risco" | **Não existe UI de PGR nem de riscos** (só `src/app/(protected)/ges`). Ver §9 — os **pontos de acesso ainda não existem**.                                   | Construir a tela/modal como rota própria; ligar entradas ao que **já existe** (GES) e deixar ganchos para PGR/risco futuros. |

**Numeração de migration:** após o merge da #129, a última é **`0012_pgr_risk_data_model`**. Esta fatia gera
**`0013_risk_methodology`**.

---

## 3. Como se encaixa no que a #129 já entregou

A #129 (modelo de dados de riscos) **já entregou** o que esta fatia consome:

- `risk_assessments` com `probability` (CHECK 1–5), `severity` (CHECK 1–5) e **`risk_level`** persistido
  (CHECK `= probability * severity`, CHECK 1–25).
- `control_measures.control_level` enum `elimination | collective_protection | administrative | ppe`
  (a hierarquia NR-01 de 4 níveis — a seção "Controle de Riscos" **read-only** desta tela).
- Em `src/shared/domains/pgr/risks.ts`: `computeRiskLevel(prob, sev)`, `probabilitySchema`/`severitySchema`
  (1–5), `controlLevelSchema` e `controlLevelLabel(...)`.

**O que FALTA (e é o núcleo da #76):** a **classificação** de `risk_level` em
Trivial/Tolerável/Moderado/Substancial/Intolerável **não existe** — nem enum, nem faixas, nem função. Hoje o
sistema calcula o **número** (1–25) mas não o **rótulo qualitativo**. Esta fatia adiciona exatamente essa
camada, e a torna **configurável por organização**.

> Dependência: tecnicamente `risk_methodology` **não tem FK** para as tabelas de risco (só `org_id`), então
> pode ser desenvolvida em paralelo. Mas o **ponto de integração** ("a metodologia é usada nas avaliações")
> toca a leitura de `risk_assessments` — que a #129 **não** implementou (foi só modelo). Ver §9/§11.

---

## 4. Princípios não-negociáveis herdados (Constituição + CLAUDE.md)

- **Isolamento multi-tenant (Princípio I).** `risk_methodology`: `org_id text NOT NULL → orgs.id`
  (`onDelete: cascade`), **indexado**; **RLS** `pgPolicy(risk_methodology_isolation, { for:"all",
to: appRuntimeRole, using: tenantScope, withCheck: tenantScope }).enableRLS()` com
  `tenantScope = sql\`org_id = current_setting('app.current_org', true)\``. Acesso **sempre** via
`withOrg(orgId, …)`; tenant **da sessão**, nunca de input. Template: `companies.ts`/`epis.ts`.
- **Duas superfícies, um gate (CLAUDE.md "API surface").** Server Action via `officeAction(...)` →
  `ActionResult<T>` **e** espelho REST via `restHandler(...)`. Ver **D6** para a forma correta num recurso
  **singleton** (config, não coleção). Escrita audita via `auditedTenantWrite`.
- **Drizzle é dono code-first.** `GRANT` para `app_runtime` e trigger `set_updated_at` entram como **SQL
  custom dentro da migration** (não auto-emitidos) — padrão `0005`/`0007`/`0012`.
- **Validação Zod em toda Server Action.** Regras puras (classificação, cobertura de faixas) em `domains/`.
- **Testes obrigatórios (Princípio V):** unit (regras puras) + integração (Server Action/REST/query, RLS,
  isolamento cross-tenant) contra **Postgres efêmero**.
- `created_at`/`updated_at` `timestamptz NOT NULL DEFAULT now()`.

---

## 5. Modelo de dados proposto — `risk_methodology`

**Uma linha por organização** (`unique(org_id)` → upsert). Padrões (`id uuid PK`, `org_id`, timestamps, RLS)
omitidos por brevidade.

| Coluna                 | Tipo                             | Notas                                                                                         |
| ---------------------- | -------------------------------- | --------------------------------------------------------------------------------------------- |
| `base`                 | enum `methodology_base` NOT NULL | `aiha` · `as_nzs_4360` · `fundacentro` · `custom` — origem dos padrões                        |
| `probability_grades`   | `jsonb` NOT NULL                 | `[{ level:1..5, label, description }]` — **exatamente 5**, um por nível (validação Zod)       |
| `severity_grades`      | `jsonb` NOT NULL                 | idem, 5 itens                                                                                 |
| `classification_bands` | `jsonb` NOT NULL                 | faixas ordenadas que particionam **[1,25]** → `{trivial…intolerable}` (ver §6 para o formato) |

**Por que JSONB e não colunas/tabelas-filhas?** A cardinalidade é **fixa e pequena** (5 gradações, 5 faixas)
e o conteúdo é **texto de configuração** validado por Zod — não entidade consultável. Colunas achatadas
(`prob_1_label`, …) dariam ~35 colunas rígidas; tabelas-filhas (`methodology_*_grades`) seriam over-normalized
(mais tabelas, mais RLS, mais superfície de teste) para 5 linhas fixas. JSONB + Zod é o equilíbrio.
**Trade-off:** integridade do conteúdo fica na app (Zod), não no banco — mitigado com testes de integração.
Ver **D1**.

**Enums novos (`pgEnum`):**

| Enum                  | Valores                                                          |
| --------------------- | ---------------------------------------------------------------- |
| `methodology_base`    | `aiha`, `as_nzs_4360`, `fundacentro`, `custom`                   |
| `risk_classification` | `trivial`, `tolerable`, `moderate`, `substantial`, `intolerable` |

> `risk_classification` como `pgEnum` (e não só Zod) deixa reuso pronto caso, no futuro, se queira **persistir**
> a classificação numa coluna derivada de `risk_assessments`. Nesta fatia ela vive dentro do `jsonb` das faixas
> e como valor derivado na leitura. **Fechar os valores agora** evita `ALTER TYPE … ADD VALUE` futuro (que não
> roda em transação — lição da migration 0009/#129).

---

## 6. Lógica de negócio central (o que precisa de unit test)

Tudo puro, em `src/shared/domains/pgr/methodology.ts`:

1. **Formato das faixas — recomendação: limites superiores ordenados.** Em vez de `{min,max}` por faixa (que
   permite lacuna/sobreposição), armazenar **4 fronteiras internas ascendentes** (ou 5 limites superiores, o
   último = 25). Ex.: `[2, 6, 12, 20]` ⇒ Trivial 1–2 · Tolerável 3–6 · Moderado 7–12 · Substancial 13–20 ·
   Intolerável 21–25. Isso **garante por construção** cobertura total de [1,25] sem gap/overlap → mata o
   edge case do card ("faixas que não cobrem 1–25"). Ver **D2**.
2. **`classify(riskLevel, bands): RiskClassification`** — função pura: dado o produto `prob × sev`, retorna a
   classe. É o coração testável. Casos: limites de faixa, `riskLevel` mínimo (1) e máximo (25).
3. **`buildMatrix(methodology): Cell[5][5]`** — deriva as 25 células (`{prob, sev, level, classification}`)
   aplicando `computeRiskLevel` (já existe) + `classify`. A UI só renderiza o que essa função retorna.
   _Insight:_ nem todo inteiro 1–25 é produto de dois fatores ≤5 (ex.: 7, 11, 13…), mas as faixas cobrem o
   intervalo contínuo por segurança.
4. **`validateMethodology(input)`** (Zod + refinamentos): exatamente 5 gradações por eixo (níveis 1–5 únicos,
   `label` não vazio); fronteiras de faixa **estritamente crescentes** e dentro de [1,25]; `base` válida.
5. **`classification → cor`**: paleta **fixa por classe** (verde→vermelho), constante de UI — **não**
   armazenada (o card não pede cor customizável). Ver **D3**.

---

## 7. Presets das bases (`domains/pgr/methodology-presets.ts`)

Constantes com os valores padrão de **AIHA**, **AS/NZS 4360**, **Fundacentro** e o esqueleto **Personalizada**.
Ao escolher uma base no formulário, o front **preenche** (editável) gradações e faixas com o preset. Um preset é
um objeto no mesmo formato do input Zod (grades + bands). Padrões sugeridos pelo card:

- **Probabilidade (1–5):** Rara · Pouco Provável · Possível · Provável · Muito Provável.
- **Severidade (1–5):** Leve (sem atenção médica) · Séria reversível · Crítica irreversível · Incapacitante ou
  mortal · Mortes/incapacitantes múltiplas (>10).
- **Faixas:** um particionamento padrão de [1,25] em 5 classes (ex. AIHA vs Fundacentro podem diferir nas
  fronteiras — **confirmar os números de cada base**; se não houver fonte confiável, usar um default único e
  marcar como "personalizável"). Ver **D4**.

Há também um **default de fallback** (§ read query): quando a org **não** configurou metodologia, a leitura
retorna um preset canônico (ex. Fundacentro/AIHA) **sem persistir**, para que as avaliações sempre tenham uma
classificação.

---

## 8. Camadas a construir (checklist real, mapeado ao CLAUDE.md)

**Dados**

- `schema/risk-methodology.ts` (tabela + 2 enums + RLS) e export no `schema/index.ts`.
- `domains/pgr/methodology.ts` (Zod input + tipos + `classify`/`buildMatrix`/`validate`).
- `domains/pgr/methodology-presets.ts` (AIHA/AS-NZS/Fundacentro/custom + default fallback).
- Migration **`0013_risk_methodology`** (`db:generate` offline) + SQL custom (GRANT + trigger).

**Backend**

- `repositories/risk-methodology.ts`: `getForOrg(orgId)` (retorna default se ausente) + `upsert(orgId, values)`
  (via `auditedTenantWrite` + `withOrg`).
- Server Action `saveRiskMethodology` (`officeAction`, audit) e leitura `getRiskMethodology`.
- **Espelho REST** — ver **D6** (recomendado: `GET`/`PUT` em `/api/v1/risk-methodology`, singleton).
- Registrar em `docs/api/api-design.md` + Postman (mandato CLAUDE.md).

**Frontend**

- Rota/modal `src/app/(protected)/risk-methodology/` (ou modal reusável em `_ui`): seções Probabilidade,
  Severidade, **grid CSS 5×5 colorido**, Controle de Riscos (read-only NR-01), **select de base** com autofill.
- Ponto de entrada "Metodologia de Avaliação" — ver §9/**D5** (onde colocar já que PGR/risco não têm tela).

**Qualidade:** `npm run check` (format + lint + typecheck + unit) + `npm run test:integration` verdes.

---

## 9. Pontos de integração & dependências (atenção)

1. **Os pontos de acesso do card em grande parte NÃO existem.** Há UI só de `ges` (e cadastros base). **Não há
   tela de listagem de PGR nem de cadastro de risco.** Logo:
   - O **modal/tela da metodologia** pode e deve ser construído (é autocontido).
   - O **botão "Metodologia de Avaliação"** pode ser colocado onde há tela hoje (ex.: dashboard e/ou tela de
     GES) e ficar como gancho documentado para a futura listagem de PGR. Não bloquear a fatia por isso.
2. **"A metodologia é usada nas avaliações de risco".** A leitura de `risk_assessments` (com classificação
   derivada) **ainda não existe** (a #129 foi só modelo). Esta fatia entrega a **função** `classify` + a
   **query da metodologia ativa**; a _aplicação_ nas telas de avaliação acontece quando a fatia de fluxo de
   riscos/avaliação for construída. Deixar `buildMatrix`/`classify` e `getForOrg` prontos e testados **é** o
   critério de aceite verificável agora (não depender de tela inexistente).
3. **Ordem vs #129:** sem FK, mas semanticamente posterior. Basear a branch em `develop` **após** o merge da
   #129 (PR #129), para herdar `computeRiskLevel`, `control_level` e a migration `0012`.

---

## 10. Decisões a travar (clarify) — com recomendação

| #      | Decisão                                                                         | Recomendação                                                                                                                                 |
| ------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | Grades/faixas em **JSONB** vs colunas achatadas vs tabelas-filhas               | **JSONB** (cardinalidade fixa, config validada por Zod). Integridade do conteúdo por Zod + testes de integração.                             |
| **D2** | Faixas como `{min,max}` vs **fronteiras superiores ordenadas**                  | **Fronteiras ordenadas** (4 thresholds internos). Elimina gap/overlap por construção → resolve o edge case.                                  |
| **D3** | Cor das células **fixa por classe** vs configurável                             | **Fixa** (paleta constante de UI). Card não pede cor editável.                                                                               |
| **D4** | Presets AIHA/AS-NZS/Fundacentro com **fronteiras distintas** vs default único   | Buscar as fronteiras reais de cada base; **se não houver fonte**, um particionamento default comum + rótulos por base, marcados "editáveis". |
| **D5** | Onde ancorar o botão, já que **não há tela de PGR**                             | Colocar em GES e/ou dashboard **agora**; documentar gancho para a listagem de PGR futura. Não criar tela de PGR nesta fatia.                 |
| **D6** | Forma do espelho REST para um **singleton** (config, não coleção)               | `GET /api/v1/risk-methodology` + `PUT /api/v1/risk-methodology` (sem `[id]`, sem `list`). Honra o mandato sem inventar coleção falsa.        |
| **D7** | Org sem metodologia: **persistir default no 1º acesso** vs **default derivado** | **Default derivado na leitura** (não escreve). Mantém leitura pura e evita linha "fantasma"; grava só quando o usuário salva de fato.        |
| **D8** | Classificação em avaliações: **derivada na leitura** vs snapshot congelado      | **Derivada** (reclassifica ao mudar metodologia). Coerente com o padrão "derivado" do projeto (nº de expostos, saldo corrente).              |
| **D9** | `risk_classification` como **pgEnum** vs só Zod                                 | **pgEnum** (reuso futuro + fecha a lista agora, evitando `ALTER TYPE` fora de transação).                                                    |

---

## 11. Critérios de aceite (reescritos, testáveis)

- [ ] Tabela `risk_methodology` (+ enums `methodology_base`, `risk_classification`) existe após a migration
      `0013` no Postgres efêmero, com **RLS + policy de isolamento** (`app_runtime`) e `unique(org_id)`.
- [ ] `saveRiskMethodology` faz **upsert** escopado por `org_id` e valida via Zod (5 gradações por eixo;
      fronteiras crescentes em [1,25]; base válida) — entradas inválidas → `VALIDATION` (422).
- [ ] `getRiskMethodology` retorna a metodologia da org **ou** o **default** quando não há configuração.
- [ ] `classify(risk_level, faixas)` classifica corretamente 1–25 nas 5 classes (unit); `buildMatrix` deriva as
      25 células com classe e cor coerentes.
- [ ] Selecionar uma base **preenche** os valores padrão (editáveis) no formulário.
- [ ] Grid 5×5 exibe a classe por célula com cor por classificação.
- [ ] **Isolamento:** metodologia de `org_b` nunca é lida/alterada por `org_a` (teste de integração dedicado).
- [ ] Espelho REST (`GET`/`PUT`) reusa repo/Zod/`toActionError`; documentado em `api-design.md` + Postman.
- [ ] `npm run check` + `npm run test:integration` (efêmero) verdes.

---

## 12. Fora de escopo (desta fatia)

- Construir a **listagem de PGR** e a **tela de cadastro/avaliação de risco** (fatias próprias). Aqui só o
  modal/tela da metodologia + ganchos.
- **Persistir** classificação em `risk_assessments` (fica derivada na leitura — D8).
- Customização de **cores** ou de dimensão da matriz (é fixa 5×5).
- Editar as descrições da **hierarquia NR-01** (seção é **read-only**, texto constante).
- Versionamento/histórico da metodologia (uma linha corrente por org; auditoria via `auditedTenantWrite`).

---

## 13. Estratégia de testes (Princípio V)

- **Unit** (jsdom): `classify` (limites de faixa, 1 e 25), `buildMatrix` (25 células), `validateMethodology`
  (rejeita <5/>5 gradações, fronteiras não crescentes, fora de [1,25]), presets bem-formados, resolução do
  **default** quando ausente.
- **Integração** (Postgres **efêmero** `INTEGRATION_*`):
  - migration `0013` cria tabela/enums (split `--> statement-breakpoint`);
  - `saveRiskMethodology` faz upsert (cria e depois **atualiza a mesma linha**, respeitando `unique(org_id)`);
  - `getRiskMethodology` retorna default sem persistir;
  - **RLS/isolamento** cross-tenant (dado de `org_a` não vaza p/ `org_b`);
  - REST `GET`/`PUT` mapeiam os mesmos códigos (`VALIDATION` 422, `FORBIDDEN` 403);
  - papel `client` → `FORBIDDEN`.
- **Nunca** SQLite nem o banco de dev (suítes fazem `TRUNCATE`).

---

## 14. Sequência sugerida (plan/tasks)

1. **Domínio puro primeiro:** `methodology.ts` (Zod + `classify`/`buildMatrix`/`validate`) +
   `methodology-presets.ts` + unit tests. É a espinha reusável e testável sem banco.
2. **Schema + migration `0013`:** tabela + 2 enums + RLS; `db:generate` offline; SQL custom (GRANT + trigger).
3. **Repositório + Server Actions** (`getForOrg`/`upsert`, `getRiskMethodology`/`saveRiskMethodology`).
4. **Espelho REST** (`GET`/`PUT`) + `api-design.md` + Postman.
5. **UI:** seções + grid 5×5 colorido + select de base com autofill + entrada (D5).
6. **Testes de integração** (§13) + **quality gate** (`npm run check` + `test:integration`).

---

## 15. Referências

- Template de schema/RLS: `src/shared/db/schema/companies.ts`, `epis.ts`.
- Domínio de riscos já existente (reusar `computeRiskLevel`, `controlLevel*`): `src/shared/domains/pgr/risks.ts`.
- Padrão de migration com SQL custom: `0005_cadastros_base_pgr.sql`, `0007_epi_data_model.sql`,
  `0012_pgr_risk_data_model.sql`.
- Superfície API (Server Action + REST + docs + Postman): **companies** (`actions/pgr/companies.ts` +
  `app/api/v1/companies/**`) — modelo canônico do mandato.
- Fatia irmã (modelo de dados de riscos): `docs/briefings/briefing-pgr-risks-data-model.md` (#129).
- Constituição: `.specify/memory/constitution.md` (Princípio I — isolamento; Princípio V — testes).
- ⚠️ Refs do card **ausentes** no repo: `.specs/004-epgr-feature-parity/02-riscos-e-pgr.md`,
  `docs/architecture/` — usar o próprio card como fonte da paridade ePGR.
