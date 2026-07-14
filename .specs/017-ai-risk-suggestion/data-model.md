# Phase 1 — Data Model: Sugestão de riscos assistida por IA

## Entidades

### `ai_usage_events` (NOVA — contador de cota)

Tabela append-only por organização; a cota é **derivada** por contagem no mês corrente.

| Campo        | Tipo                 | Regras                                                      |
| ------------ | -------------------- | ----------------------------------------------------------- |
| `id`         | uuid PK              | `defaultRandom()`                                           |
| `org_id`     | text NOT NULL        | FK → `orgs.id` `ON DELETE CASCADE`; fronteira de isolamento |
| `kind`       | text NOT NULL        | discriminador de tipo de uso (ex.: `risk_suggestion`)       |
| `created_at` | timestamptz NOT NULL | `defaultNow()`; base do recorte mensal                      |

- **Índices**: `idx_ai_usage_events_org_id (org_id)`; `idx_ai_usage_events_org_kind_created (org_id, kind, created_at)`.
- **RLS**: `enableRLS()` + policy `ai_usage_events_isolation` `FOR ALL TO app_runtime USING/WITH CHECK
(org_id = current_setting('app.current_org', true))`.
- **GRANT**: `SELECT, INSERT` para `app_runtime` (least-privilege — sem UPDATE/DELETE; append-only).
- **Migration**: `0015_ai_usage_events.sql` (CREATE TABLE + ENABLE RLS + FK + 2 índices + POLICY + GRANT).
  Renumerada de `0014` no merge com o develop (colidiu com `0014_epi_risk_link`): renomeado o `.sql`,
  reencadeados `tag` no `_journal.json` e `prevId` do snapshot; validado com `db:generate`.

### `risks` (EXISTENTE — reuso; sem alteração de schema)

Persistência das sugestões aceitas. A IA preenche um subconjunto das colunas:

| Coluna                        | Origem da sugestão                                 |
| ----------------------------- | -------------------------------------------------- |
| `agent_type` (enum, 7 grupos) | agente/tipo de risco                               |
| `hazard`                      | perigo (opcional)                                  |
| `description` (NOT NULL)      | descrição do risco                                 |
| `sources`                     | fontes geradoras (opcional)                        |
| `ges_id` (FK)                 | GES alvo (do path); valida pertencimento ao tenant |

- **"Rascunho" = estado derivado**: risco sem linha em `risk_assessments` e sem `control_measures`.
  Não há coluna/flag nova nem `source='ai'`.
- **Sem constraint de unicidade** em `risks` → duplicatas possíveis (decisão do gestor na revisão).

## Objetos de domínio (não persistidos)

### `SuggestedRisk` (transitório — saída da IA)

- `agentType`: `riskAgentTypeSchema` (enum dos 7 grupos) — item fora do enum é **descartado**.
- `hazard?`, `sources?`: texto opcional (normaliza `null`/`""` → `undefined`).
- `description`: texto **obrigatório**.
- Validação: `suggestedRiskSchema`; lote via `parseModelSuggestions` (valida item a item, descarta
  inválidos, aplica teto `MAX_SUGGESTIONS = 12`).
- Conversão para persistência: `toRiskValuesFromSuggestion` → `riskInputSchema.parse` (mesmo caminho do
  cadastro manual).

### `GesRiskContext` (transitório — entrada da IA)

- Campos descritivos do GES (processo, ambiente) + **títulos** das funções expostas (`job_roles.title`).
- **Nunca** contém dados de `employees` (nome/CPF/PII) — garantido pela query `fetchGesRiskContext`.

### Cota (derivada)

- `FREE_AI_SUGGESTION_MONTHLY_QUOTA = 20`; `isAiSuggestionAvailable(plan, currentMonthCount)`:
  `pro` → sempre `true`; `free` → `count < 20`.
- `countAiUsageInCurrentMonth(orgId, kind)` conta linhas de `ai_usage_events` no mês corrente.

## Transições de estado (risco criado por IA)

```text
[sugestão IA] --revisão/seleção--> [aceite] --createRisk--> risco RASCUNHO
   (transitório, não persiste)                              (sem avaliação nem controles)
                                                                   |
                                              (fluxo normal de risco, fora desta fatia)
                                                                   v
                                                      risco AVALIADO / com controles
```
