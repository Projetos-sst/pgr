# Briefing — Sugestão de riscos assistida por IA (`feature/ai-risk-suggestion`)

> Documento de **análise/reflexão** (não é spec). Objetivo: entender a task, mapear requisitos e
> lógica sobre a arquitetura **real** do repo, e sinalizar onde o enunciado da issue diverge das
> convenções vigentes — antes de rodar `/speckit-specify`. Idioma: PT-BR (docs); código/identificadores
> em inglês.

---

## 1. O que a task é (em uma frase)

Dar ao gestor de SST um botão **"Sugerir Riscos com IA"** no inventário de riscos de um **GES**, que
envia o **contexto do GES** (processo, ambiente, funções expostas) a um LLM (Claude) e recebe uma lista
**estruturada** de riscos candidatos (agente, perigo, descrição, fontes geradoras) para o gestor
**revisar, selecionar e inserir como rascunho** — mais **dicas de preenchimento** contextuais nos campos
críticos dos formulários de GES e de risco.

Duas entregas independentes:

- **US1 (P1)** — Sugestão de riscos por IA (fluxo LLM → revisão → inserção como rascunho).
- **US2 (P2)** — Dicas de preenchimento (helpers/tooltips) nos campos críticos.

É a **primeira feature do projeto que chama um LLM externo** e a primeira que envia dados do tenant para
fora. Isso muda o peso das seções de privacidade e de estratégia de testes (ver §6 e §7).

---

## 2. Encaixe na arquitetura real (o enunciado usa nomes que **não existem** neste repo)

O texto da issue foi escrito com convenções genéricas (`features/pgr/`, `organization_id`, "SQLite em
memória"). Este repo não usa nenhuma delas. Tradução obrigatória antes de qualquer código:

| Issue diz                     | Neste repo é                                                                    | Referência                                                            |
| ----------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `features/pgr/actions`        | `src/shared/server/actions/pgr/*` (wrapper `officeAction`)                      | [risks.ts](../../src/shared/server/actions/pgr/risks.ts)              |
| `features/pgr/schema` (Zod)   | `src/shared/domains/pgr/*`                                                      | [risks.ts](../../src/shared/domains/pgr/risks.ts)                     |
| `features/pgr/queries`        | `src/shared/db/repositories/*` (cada um embrulha `withOrg`)                     | [risks.ts](../../src/shared/db/repositories/risks.ts)                 |
| `features/pgr/components`     | `src/app/(protected)/risks/[id]/_components/*`                                  | [ges/\_components](<../../src/app/(protected)/ges/[id]/_components/>) |
| `features/pgr/field-hints.ts` | `src/shared/domains/pgr/field-hints.ts` (constantes puras)                      | — (novo)                                                              |
| `organization_id` (Clerk)     | `org_id` (`orgs.id`, tenant = escritório) via `withOrg` + RLS                   | [CLAUDE.md]                                                           |
| "SQLite em memória" p/ testes | ❌ **proibido** — integração roda contra **Postgres efêmero** (`INTEGRATION_*`) | [CLAUDE.md] Testing policy                                            |

**Referências da issue que estão quebradas/inexistentes** (não confiar nelas na spec):

- `.specs/004-epgr-feature-parity/02-riscos-e-pgr.md` — **não existe**. O `.specs/004` real é
  `004-multi-tenant-isolation`. A paridade ePGR de riscos foi materializada nas fatias `0012`
  (modelo de dados de riscos) e `#136` (metodologia 5×5), não num doc `004`.
- `docs/architecture/` — **diretório vazio**. Os "padrões do projeto" vivem em `CLAUDE.md` e nos
  `docs/briefings/*`.

Fluxo em camadas a respeitar (idêntico às fatias anteriores):
`page → Server Action (officeAction → ActionResult<T>) → domínio (Zod) → repositório (withOrg,
auditedTenantWrite) → Drizzle`.

---

## 3. A lógica central: o output do LLM já **cabe** na tabela `risks`

Este é o insight que simplifica a fatia. A tabela `risks` (migration `0012`) tem **exatamente** os
campos que a issue pede como saída da IA — a sugestão não precisa de tabela nova:

| Saída pedida pela IA      | Coluna em [risks.ts](../../src/shared/db/schema/risks.ts) | Observação                                                                                                        |
| ------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| agente (Físico/Químico/…) | `agent_type` (`pgEnum riskAgentType`)                     | conjunto **fechado** de 7 grupos: `physical, chemical, biological, ergonomic, mechanical, accident, psychosocial` |
| perigo                    | `hazard` (text, nullable)                                 | —                                                                                                                 |
| risco/descrição           | `description` (text, **NOT NULL**)                        | único obrigatório                                                                                                 |
| fontes geradoras          | `sources` (text)                                          | —                                                                                                                 |
| (dicas) trajetória        | `propagation`                                             | alvo de dica US2                                                                                                  |
| (dicas) possíveis lesões  | `possible_injuries`                                       | alvo de dica US2                                                                                                  |

Cada risco pertence a um **GES** (`ges_id`). Portanto:

- **"Rascunho"** = uma linha em `risks` criada a partir da sugestão, com apenas `agent_type` +
  `description` (obrigatórios) preenchidos pela IA; os campos de aprofundamento (eSocial S-2240:
  `noxious_agent_code`, `measurement_unit`, `concentration_intensity`; avaliação `risk_assessments`;
  hierarquia de controle `control_measures`) ficam **vazios** para o usuário completar. Não há coluna
  `status`/`is_draft` hoje — "rascunho" é **estado derivado** (risco sem avaliação/controles), não uma
  flag nova. Decidir na spec se isso basta ou se cria-se uma flag (prefiro derivado, zero migration).
- O botão vive na tela de **inventário de riscos do GES** (a lista de `risks` filtrada por `ges_id`),
  análoga ao padrão `EpiRiscoSection`/`ManageFunctions` já usado.
- **Aceitar sugestões = INSERT em `risks`** — que já tem CRUD/Server Action/REST próprios. A IA não
  inventa persistência nova; ela **alimenta** o CRUD existente de riscos.

**Zero migration prevista** para a US1 (reusa `risks`). Confirmar na spec.

---

## 4. O contexto do GES enviado ao LLM (e por que é seguro)

O contexto vem de [ges.ts](../../src/shared/db/schema/ges.ts) + funções expostas. **Todos os campos são
descritivos e não-PII**:

- Processo: `ges.process_description`.
- Ambiente: `construction_type`, `ceiling_height`, `floor`, `roof`, `lighting`, `ventilation`,
  `other_characteristics`.
- Funções/cargos: **títulos** de `job_roles` via `ges_job_roles` (ex.: "Soldador", "Auxiliar de
  produção") + `worker_count`. **Não** os funcionários (`employees`) — nada de nome/CPF/dados pessoais.

→ O critério de aceite "nenhum dado sensível além do contexto do GES" é **estruturalmente satisfeito**:
o contexto do GES é, por natureza, descrição de processo/ambiente/título de cargo. A spec deve declarar
explicitamente que o prompt é montado **só** desses campos e que `employees` nunca entram.

---

## 5. Integração com o LLM (Anthropic/Claude) — decisões técnicas

Estado atual do repo: **sem** dependência `@anthropic-ai/sdk` e **sem** `ANTHROPIC_API_KEY` no
`.env.example`. Ambos são novos. Chave **somente no servidor** (Server Action / Route Handler), nunca no
cliente.

Recomendações (a validar no `/speckit-plan`; consultar a skill `claude-api` na fase de plano):

- **SDK**: `@anthropic-ai/sdk`, cliente instanciado só no servidor. Chave via `process.env.ANTHROPIC_API_KEY`.
- **Modelo**: `claude-opus-4-8` (id exato) — mais capaz; para uma lista curta de riscos o custo é baixo
  (ordem de US$5/US$25 por 1M tokens in/out; um prompt de contexto de GES + resposta JSON pequena fica
  em centavos por chamada). `claude-haiku-4-5` é opção de custo se volume crescer — decisão de custo é
  do usuário, default no mais capaz.
- **Saída estruturada, não texto livre**: usar **structured outputs / tool use** para forçar JSON
  validável por Zod (`output_config.format` com `json_schema`, ou um tool com `input_schema`). Isso
  torna o "parsing e validação da resposta" (tarefa de backend da issue) determinístico: o schema Zod
  de cada risco sugerido espelha o subconjunto de `risks` (`agent_type` como enum, `hazard`,
  `description`, `sources`). Resposta que não casar → erro tratado, não risco inválido inserido.
- **Streaming**: a issue sugere "streaming opcional". Para uma **lista** revisada em modal, o valor de
  streaming é baixo e complica o parse estruturado. Recomendo **resposta única estruturada** na v1
  (mais simples, Zod-parseável); streaming fica como melhoria futura. Se streaming for exigido, ele
  força um **Route Handler** (Server Actions não fazem streaming bem no App Router) — mas aí perde-se o
  JSON schema. Registrar como trade-off, não implementar streaming na v1.
- **Timeout/erro**: chamada externa pode falhar/expirar. Tratar como código de erro de domínio
  (ex.: novo `AI_UNAVAILABLE`/`AI_TIMEOUT` → 502/504) e **nunca** bloquear o resto do fluxo do GES
  (paralelo à filosofia do `CaField`, que "nunca bloqueia o cadastro").

### Rate limiting / cota por organização

Já existe o padrão de cota por plano em [plan.ts](../../src/shared/tenant/plan.ts)
(`FREE_SIGNATURE_MONTHLY_QUOTA = 10`, `isSignatureAvailable(plan, count)`). A tarefa "rate limiting por
organização" deve **espelhar** esse padrão: `FREE_AI_SUGGESTION_MONTHLY_QUOTA`,
`isAiSuggestionAvailable(plan, currentMonthCount)`, gate na **Server Action** (nunca no cliente), erro
`QUOTA_EXCEEDED` (já existe, → 402) por mês corrente derivado (sem contador/cron). Edge case da issue
("organização sem cota") cai exatamente aqui.

---

## 6. Superfície de API (regra das 4 partes) — o que se aplica

O CLAUDE.md exige, para toda feature **CRUD/HTTP-exposta**: Server Action + REST mirror + docs
(`api-design.md`) + Postman. Análise por peça desta fatia:

- **Sugerir riscos** é uma **ação de computação** (não CRUD). Ainda assim é uma operação de servidor
  testável — recomendo **Server Action** `suggestRisksForGes(gesId)` via `officeAction` **+** um REST
  mirror `POST /api/v1/ges/[id]/risk-suggestions` (a única superfície testável por cURL/Postman) para
  manter o padrão e permitir teste de integração real. Decidir na spec se o REST mirror é obrigatório
  aqui (recomendo **sim**, por consistência e testabilidade).
- **Aceitar sugestões** = INSERT em `risks` → **reusa** o CRUD de riscos existente (não reimplementar).
- **Dicas (US2)**: se **estáticas** (constantes em `field-hints.ts`), não têm superfície de API — são
  dados de UI. Se **dinâmicas** (chamada ao LLM sob demanda), viram outra Server Action + gate de cota.
  Recomendo **estáticas na v1** (determinístico, testável, sem custo/latência); dinâmicas como opção
  futura. Isso também simplifica os testes.
- **Docs + Postman**: registrar a rota de sugestão em `docs/api/api-design.md` e na coleção
  `docs/api/sst-manager.postman_collection.json` (uma pasta nova).

---

## 7. Isolamento multi-tenant e testes (o ponto mais sensível)

- **Tenant sempre da sessão** (`requireOfficeStaff()` / `withOrg`), nunca de input do cliente. O `gesId`
  recebido é validado por **pertencimento ao tenant** antes de montar o contexto (padrão
  `assertRiskInTenant`/`assertCatalogInTenant` da fatia `epi-risk-link`): GES de outra org →
  `FK_NOT_FOUND`/`NOT_FOUND`, nunca vaza contexto cross-tenant para o LLM.
- **Papel**: só `owner`/`collaborator` sugerem/inserem; `client` → `FORBIDDEN`.
- **Testes (obrigatórios — a fatia não fecha sem eles)**:
  - **Unit**: schema Zod da sugestão (enum de agente, obrigatoriedade de `description`), montagem do
    prompt (só campos do GES, sem PII), mapeamento sugestão→rascunho, gate de cota
    (`isAiSuggestionAvailable`), rótulos das dicas.
  - **Como testar algo não-determinístico?** O cliente Anthropic é **mockado** nos testes — nunca se
    bate na API real em CI. Testa-se: (a) montagem do prompt/entrada; (b) parse+validação Zod de uma
    resposta canônica do LLM (fixture); (c) tratamento de resposta malformada/timeout; (d) o INSERT
    resultante e seu **isolamento por tenant**.
  - **Integração** (Server Action/REST) contra **Postgres efêmero** (`INTEGRATION_*`), **nunca SQLite**
    (o enunciado erra aqui): inserção de rascunhos, `FK_NOT_FOUND` cross-tenant, `FORBIDDEN` client,
    `QUOTA_EXCEEDED` no plano free. A chamada ao LLM permanece mockada; o que se exercita no Postgres é
    a persistência + RLS + autorização.

---

## 8. Critérios de aceite → como serão verificados

| Critério de aceite (issue)                   | Como se verifica                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| Botão na tela de inventário do GES           | UI na tela de riscos do GES (`risks?ges_id=`), padrão `ManageFunctions`            |
| Lista com agente/perigo/descrição/fontes     | schema Zod da sugestão + fixture; casa com colunas de `risks`                      |
| Modal de revisão com seleção                 | componente client com checkbox; só selecionados persistem                          |
| Adicionados ficam como rascunho              | INSERT em `risks` sem avaliação/controles (estado derivado)                        |
| Nenhum dado sensível além do contexto do GES | prompt montado só de campos do GES; teste unit garante ausência de `employees`/PII |
| Dicas nos campos críticos                    | `field-hints.ts` + tooltips nos forms de GES e de risco                            |
| LLM não bloqueia a UI (loading)              | estado de loading na Server Action; erro do LLM não trava o cadastro               |

---

## 9. Edge cases (da issue + derivados)

- **GES com contexto vago** → o prompt deve instruir o LLM a devolver lista vazia ou poucos itens em vez
  de alucinar; a UI mostra "nenhuma sugestão — descreva melhor o processo/ambiente".
- **Falha/timeout do LLM** → erro tratado (`AI_UNAVAILABLE`), mensagem amigável, cadastro do GES intacto.
- **Sem cota** → `QUOTA_EXCEEDED` (402), botão desabilitado/explicado no plano free.
- **Duplicidade** → sugestão pode repetir um risco já inventariado; decidir se a UI marca/filtra
  duplicados por (`agent_type`,`description`) ou deixa o usuário decidir (não há unique em `risks`).
- **Sugestão parcialmente inválida** (enum de agente fora do conjunto) → Zod rejeita o item, não o lote.

---

## 10. Fronteiras e questões abertas para o `/speckit-clarify`

**Dentro do escopo (v1 recomendada):** sugestão via resposta estruturada única (sem streaming); dicas
**estáticas**; reuso de `risks` (zero migration); gate de cota espelhando `plan.ts`; Server Action +
REST mirror + docs + Postman.

**Fora / adiar:** streaming; dicas dinâmicas por LLM; flag persistida de "rascunho"; auto-avaliação
5×5 sugerida por IA; qualquer envio de dados de `employees`.

**Perguntas a resolver na spec/clarify:**

1. REST mirror para a ação de sugestão é obrigatório (recomendo sim) ou só Server Action?
2. "Rascunho" = estado derivado (recomendo) ou flag nova em `risks` (migration)?
3. Dicas estáticas (recomendo) vs dinâmicas na v1?
4. Cota de IA por plano: valor do free (espelhar `FREE_SIGNATURE_MONTHLY_QUOTA=10`)?
5. Modelo/efforte de custo: fixar `claude-opus-4-8`?
6. Deduplicação de sugestões vs riscos já existentes: filtrar na UI ou deixar ao usuário?

---

## 11. Prompt DETALHADO para `/speckit-specify`

> Prompt remontado no **esqueleto do exemplo** (`/speckit-specify` + `GIT_BRANCH_NAME` + `Feature` +
> `CONTEXTO` + `User stories` P1/P2 + `Success criteria` + `Edge cases`), com todo o detalhamento desta
> análise + do as-built embutido no bloco `CONTEXTO` e as correções card × repo já aplicadas. Conteúdo da
> spec em **pt-BR**; branch e commits em **inglês**. Copie do `/speckit-specify` até o fim.

```text
/speckit-specify

GIT_BRANCH_NAME: feature/ai-risk-suggestion

Feature: AI risk suggestion (sugestão de riscos assistida por IA no GES + dicas de preenchimento)

CONTEXTO:
Projeto SST Manager — SaaS B2B multiempresa de Segurança do Trabalho (ePGR). Fatia própria
(1 issue = 1 branch = 1 spec). Feature FUNCIONAL (não modelagem pura): no inventário de riscos de um GES,
um botão "Sugerir Riscos com IA" coleta o contexto do GES (processo, ambiente, funções expostas), consulta
um LLM (Anthropic/Claude) e devolve uma lista ESTRUTURADA de riscos (agente, perigo, descrição, fontes
geradoras) para o gestor de SST REVISAR, SELECIONAR e adicionar ao inventário como RASCUNHO. Além disso,
exibe "Dicas de Preenchimento da IA" (helpers estáticos) nos campos críticos dos formulários de GES e de
risco. É a PRIMEIRA feature que chama um LLM externo e a primeira que envia dados do tenant para fora.
ESCOPO: (US1) sugestão por IA + revisão/aceite; (US2) dicas de preenchimento; + rate limiting por org.
FORA DE ESCOPO: streaming da resposta; dicas dinâmicas por LLM; auto-avaliação 5×5 sugerida por IA;
qualquer envio de dados de funcionários (employees/PII); geração de PGR.

RECONCILIAÇÃO CARD × REPO (termos genéricos do card que NÃO batem — resolver na spec):
- "features/pgr/" NÃO existe -> domínio em src/shared/domains/pgr/; Server Actions em
  src/shared/server/actions/pgr/; repositórios em src/shared/db/repositories/; UI em src/app/(protected)/.
- "organization_id (Clerk)" como escopo -> tenant = orgs.id; acesso via withOrg() + RLS app_runtime
  backstop (current_setting('app.current_org', true)). NUNCA Clerk org / input do cliente.
- "SQLite em memória" para testes -> integração contra Postgres EFÊMERO (INTEGRATION_*); NÃO há SQLite.
- Referências quebradas do card: ".specs/004-epgr-feature-parity/02-riscos-e-pgr.md" NÃO existe (o 004 real
  é 004-multi-tenant-isolation); "docs/architecture/" está VAZIO. Fontes reais: a modelagem de riscos é a
  migration 0012 (tabela `risks`) e a metodologia 5×5 é o PR #136; padrões vivem em CLAUDE.md e docs/briefings.
- Persistência da sugestão REUSA a tabela `risks` (0012): agente=agent_type (enum 7 grupos), perigo=hazard,
  risco=description (NOT NULL), fontes=sources. "Rascunho" = risco SEM avaliação (risk_assessments) e SEM
  controles (control_measures) — ESTADO DERIVADO; NÃO cria flag nem tabela de risco nova.

ANTES DE ESCREVER A SPEC, leia e liste (dizendo o que extraiu de cada):
- src/shared/db/schema/risks.ts (colunas que a IA preenche: agent_type/hazard/description/sources; enum
  risk_agent_type de 7 grupos) e ges.ts/ges-job-roles.ts/job-roles.ts (contexto do GES + títulos de função).
- src/shared/domains/pgr/risk.ts + risks.ts (riskInputSchema, riskAgentTypeSchema, rótulos pt-BR).
- src/shared/db/repositories/risks.ts (createRisk + assertGesInTenant -> FK_NOT_FOUND) — a persistência reusa isso.
- src/shared/server/office-action.ts + src/shared/api/rest.ts (officeAction/restHandler, ActionResult,
  toActionError, códigos de erro; QUOTA_EXCEEDED já existe -> 402).
- src/shared/tenant/plan.ts + src/shared/server/actions/signatures.ts (PADRÃO de cota por plano a ESPELHAR:
  count no mês corrente + isSignatureAvailable(plan, count) -> QuotaExceededError).
- .specify/memory/constitution.md (Princípio I: isolamento multi-tenant não-negociável) e CLAUDE.md
  (regra das 4 partes da superfície de API; política de testes).

MODELO / MUDANÇAS DE DADOS:
- A saída da IA NÃO cria tabela de risco (reusa `risks`) -> zero migration de risco.
- Rate limiting por organização exige um contador PERSISTIDO (serverless: não dá pra contar em memória).
  Proposta: tabela nova append-only `ai_usage_events` (org_id -> orgs cascade, kind text, created_at) + RLS
  <t>_isolation + GRANT SELECT,INSERT, análoga a como a assinatura conta linhas de signature_requests no mês
  corrente (cota DERIVADA da leitura, sem contador materializado nem cron). Migration nova esperada
  (ex.: 0014_ai_usage_events; renumerar no rebase se colidir com fatia paralela). [DECISÃO A CLARIFICAR:
  contador persistido vs gate só por plano.]

INTEGRAÇÃO LLM:
- Anthropic SDK (@anthropic-ai/sdk); chave ANTHROPIC_API_KEY SOMENTE no servidor (nunca no cliente).
- Saída ESTRUTURADA via tool use / JSON schema, validável por Zod (subconjunto de `risks`). SEM streaming na v1.
- Contexto enviado ao LLM = SÓ campos do GES (processo, ambiente, TÍTULOS de função). NUNCA employees/CPF/PII.
- Falha/timeout/chave ausente -> AI_UNAVAILABLE (código novo, 502); nunca vaza detalhe do provedor.

CONTRATO DE ERROS (códigos do domínio, não HTTP cru):
- FK_NOT_FOUND (422): GES de outra org na sugestão/aceite (validado ANTES da chamada externa).
- QUOTA_EXCEEDED (402): cota mensal do plano free estourada.
- AI_UNAVAILABLE (502): falha do LLM (código NOVO).
- VALIDATION (422): aceite com lista vazia/inválida.
- FORBIDDEN (403): papel client.

REGRAS NÃO-NEGOCIÁVEIS (constituição):
- Tenant = orgs.id, sempre da sessão; isolamento (pertencimento do GES ao tenant) validado ANTES do LLM.
- Chave da IA só no servidor; nenhum dado sensível (employees/CPF) enviado além do contexto do GES.
- A IA NUNCA adiciona automaticamente — o usuário sempre revisa e aprova; aceitos entram como rascunho.
- Falha de IA NÃO bloqueia o cadastro (a sugestão é auxiliar).
- Superfície de API: Server Action (officeAction) + REST mirror (restHandler) + docs (api-design.md) +
  Postman — a regra vive UMA vez (núcleo compartilhado), não reimplementada nas duas superfícies.

User stories (P1 = mais crítica):
- (P1) Como gestor de SST, quero receber sugestões de riscos da IA baseadas nas funções e no ambiente do
  GES, revisá-las e escolher quais adicionar como rascunho ao inventário — para agilizar o inventário sem
  perder o controle (nada é adicionado automaticamente; completo os campos obrigatórios depois).
- (P2) Como gestor de SST, quero ver dicas de preenchimento nos campos críticos dos formulários de GES e
  de risco — para garantir qualidade e conformidade com a NR-01.

Success criteria (mensuráveis, tecnologia-agnósticos):
- A IA sugere ao menos 3 riscos relevantes para um GES com contexto bem preenchido.
- Nenhum risco sugerido é adicionado automaticamente — o usuário sempre revisa e aprova.
- Nenhum dado sensível da organização (funcionários/CPF) é enviado ao LLM além do contexto do GES.
- A cota mensal de sugestões do plano free é respeitada (chamadas além do limite são bloqueadas); pro é ilimitado.
- Uma falha do LLM não bloqueia o cadastro (estado de loading visível; erro tratado, GES intacto).
- Dicas de preenchimento exibidas nos campos críticos dos formulários de GES e de risco.
- Suítes (unit + integração de persistência/isolamento/cota em Postgres efêmero, com o LLM MOCKADO), lint,
  tipos e build passam.

Edge cases:
- GES com contexto muito vago -> o prompt instrui o LLM a devolver poucos/nenhum risco; a UI mostra
  "nenhuma sugestão — descreva melhor o processo/ambiente".
- Falha/timeout/erro de API do LLM -> AI_UNAVAILABLE (502); cadastro do GES permanece intacto.
- Organização sem cota disponível -> QUOTA_EXCEEDED (402); botão desabilitado/explicado no plano free.
- Sugestão parcialmente inválida (agente fora do enum) -> descarta o ITEM, não o lote.
- GES de outra organização -> FK_NOT_FOUND, ANTES de qualquer chamada ao LLM (isolamento).
- Duplicidade: uma sugestão pode repetir um risco já inventariado (não há unique em `risks`) -> decidir se
  a UI marca/filtra duplicados por (agent_type, description) ou deixa a decisão ao usuário.

DECISÕES A CLARIFICAR (marcar para /speckit-clarify):
- Rate limiting: contador persistido (ai_usage_events + migration) vs gate só por plano? valor da cota free?
- "Rascunho": estado derivado (recomendado) vs flag nova em `risks`?
- Dicas estáticas (recomendado) vs dinâmicas por LLM na v1?
- REST mirror para a ação de sugestão é obrigatório (recomendado) ou só Server Action?
- Modelo fixo (claude-opus-4-8) ou configurável?
- Deduplicação de sugestões vs riscos já existentes: filtrar na UI ou deixar ao usuário?

Conteúdo da spec em pt-BR; branch e commits em inglês. NÃO invente solução técnica não descrita aqui —
descreva o "o quê" e o "porquê". Marque claramente as DECISÕES A CLARIFICAR para o /speckit-clarify.
```

---

### Resumo executivo

A feature é, no fundo, um **produtor de rascunhos para o CRUD de `risks` já existente**, alimentado por
um LLM que recebe **só o contexto descritivo do GES**. A tabela `risks` já modela a saída da IA
(zero migration), o isolamento por tenant e o gate de cota têm padrões prontos para espelhar
(`assertRiskInTenant`, `plan.ts`), e o maior trabalho novo/específico é: (1) integração `@anthropic-ai/sdk`
server-only com **saída estruturada validada por Zod**, (2) UI de revisão-e-aceite, (3) dicas estáticas,
e (4) uma estratégia de testes que **mocka o LLM** e exercita persistência/isolamento contra Postgres
efêmero. Os principais riscos de execução não são técnicos e sim de **fidelidade ao repo**: o enunciado
da issue aponta para caminhos, nomes e um banco de testes que **não existem aqui**.
