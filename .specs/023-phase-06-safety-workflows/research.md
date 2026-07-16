# Research — Fase 06 (023)

Decisões técnicas que fecham o plano. Nenhum `[NEEDS CLARIFICATION]` remanescente: cada ponto abaixo tem **Decision / Rationale / Alternatives** e critério objetivo.

---

## 1. Reconciliação do histórico de migrations (BLOQUEANTE, pré-requisito da US1)

**Estado factual confirmado** (Gate 0 + leitura de código):

- Journal (`meta/_journal.json`) vai até **idx 23** (`0023_schedule_events`). Próxima migration = **idx 24 / prefixo `0024`**.
- **2 arquivos órfãos** no disco, fora do journal: `0018_org_billing.sql` (colunas Stripe em `orgs`) e `0018_user_is_master.sql` (`users.is_master boolean NOT NULL DEFAULT false`).
- **Tag `0018_schedule_events` (idx 18) sem `.sql`**; o SQL foi recriado em `0023_schedule_events.sql` → `schedule_events` **duplicado** no journal (idx 18 e 23).
- Snapshots 0..23 íntegros; `0023_snapshot.json` já reflete `is_master` + colunas Stripe + `schedule_events`.
- **Helper de integração `src/__tests__/integration/_helpers/db.ts`**: `applyMigrations` **glob-a todos os `.sql` ordenados por nome** (não usa o journal), com marker table `_test_applied_migrations` + advisory lock. Aplica statement-by-statement dividido em `--> statement-breakpoint`.

**Decision**:

1. **Testes NÃO estão bloqueados hoje**: como o helper glob-a arquivos, o PG efêmero aplica os dois órfãos `0018_*` + `0023_schedule_events.sql` em ordem alfabética e funciona. O ponto frágil é **`drizzle-kit migrate`** (deploy/banco novo), que segue o **journal** — e a tag `0018_schedule_events` não tem arquivo, enquanto os órfãos não estão no journal.
2. **`db:generate` da `0024` é seguro**: `drizzle-kit` faz o diff contra o **último snapshot** (`0023_snapshot.json`, já correto) → a `0024` conterá **apenas** o delta da Fase 06, sem re-emitir billing/is_master/schedule_events.
3. **Procedimento de reconciliação (Bloco A, antes de gerar a 0024), na ordem**:
   - (a) **Conferir a realidade aplicada**: `SELECT * FROM drizzle.__drizzle_migrations ORDER BY id` no ambiente **autorizado** (owner, com backup/validação) → determina a sequência de hashes realmente aplicada em produção.
   - (b) **Comparar** journal × arquivos `.sql` × snapshots × tabela de migrations aplicada.
   - (c) **Correção mínima compatível com banco existente e novo**: alinhar journal e arquivos à realidade aplicada, de modo que (i) `drizzle-kit migrate` num banco **novo** produza o mesmo schema do `0023_snapshot`, e (ii) num banco **existente** nada seja re-aplicado. A forma concreta (ex.: materializar o `.sql` faltante da tag `0018_schedule_events` a partir do snapshot; registrar/realocar os órfãos billing/is_master como entradas coerentes do journal com o hash já aplicado) **sai da evidência de (a)** — não se escolhe às cegas.
   - (d) **Validar** em Postgres efêmero limpo (`db:migrate` do zero sem erro) e confirmar que o glob dos testes continua verde.
   - (e) **Só então** `db:generate` → `0024_phase_06_safety_workflows`.

**Proibições** (reafirmadas): não apagar migration aplicada; não renumerar às cegas; não editar journal sem evidência da tabela de migrations; não alterar Supabase compartilhado sem backup/validação.

**Rationale**: a correção depende de um fato que só o banco real tem (quais hashes foram aplicados). O procedimento torna a decisão **determinística por evidência**, sem inventar. Classificado como **bloqueante** para qualquer alteração de schema.

**Alternatives**:

- _Ignorar e só gerar a 0024_ → rejeitado: deixa `drizzle-kit migrate` quebrado para bancos novos/deploy.
- _Reescrever o journal manualmente agora_ → rejeitado: sem evidência da tabela aplicada, corrompe bancos existentes.

---

## 2. Numeração da OS sob concorrência

**Decision**: replicar o padrão real de `createPgrRevision` (`repositories/pgr-revisions.ts`): dentro de `withOrg` + transação, `SELECT id FROM orgs WHERE id = :orgId FOR UPDATE` (trava a **linha do tenant**, serializando criações concorrentes do **mesmo** tenant), depois `coalesce(max(number),0)::int + 1` escopado por `org_id`, `INSERT`, com `UNIQUE(org_id, number)` como **backstop** (colisão inesperada → `DUPLICATE`/409). Sem sequence, sem retry, sem advisory lock global.

**Rationale**: idioma já existente na casa; garante consecutivo por tenant (SC-001) sem bloquear tenants distintos (SC-002 — cada um trava sua própria linha em `orgs`).

**Alternatives**: sequence Postgres (gaps, não reinicia por tenant) → rejeitado; advisory lock global (serializa todos os tenants) → rejeitado.

---

## 3. `origin_type` de `action_plans`/`risk_audits`

**Decision**: coluna **TEXT** validada na aplicação (espelha `signature_requests.target_type`), com allowlist V1 `{risk, incident}` num módulo de domínio. `origin_id` é uuid **sem** FK física. A validação (repository) confere, dentro de `withOrg`: tipo suportado + origem existente + mesmo tenant → senão `FK_NOT_FOUND` (422). `inspection`/`non_conformity` entram depois **sem migration** (só +1 na allowlist + +1 no mapa de resolução).

**Rationale**: origem é polimórfica e o conjunto cresce (Inspeções já existe). TEXT + validação evita pgEnum rígido e migrations futuras. Consistente com o padrão de `target_type`.

**Alternatives**: pgEnum `origin_type` → rejeitado (adicionar valor exige migration); FK física por coluna dedicada por tipo → rejeitado (não-polimórfico, explode colunas).

---

## 4. CAT / eSocial

**Decision**: acidentes gravam `cat_number`/`cat_issued_at` como **texto opcional** (registro interno). **Nenhuma** criação automática de `esocial_events` e **nenhuma** emissão S-2210 nesta fatia. O encanamento `esocial_events` (enum já tem `S-2210`) fica como **ponto de integração documentado** para fase futura.

**Rationale**: decisão P1 do Gate 0 ratificada pelo usuário (registro interno na V1). Mantém a fatia enxuta e desacoplada do módulo eSocial.

**Alternatives**: emitir S-2210 ao concluir acidente → adiado (fora da V1).

---

## 5. Atualização de status do incidente (evitar lógica duplicada)

**Decision**: **fonte única** de regras = módulo de domínio puro `incident-lifecycle.ts` (transições válidas, "primeiro plano ativo → `awaiting_completion`", "conclusão bloqueada com plano ativo", "conclusão exige justificativa", "terminal não volta"). A **persistência** ocorre no `repositories/accidents.ts`. A criação de plano com origem `incident` chama, **na mesma transação** de `action_plans`, um helper do repositório de incidentes (`advanceIncidentOnFirstPlan`) que aplica a regra do domínio. Nenhuma regra de transição vive em Action ou em dois lugares.

**Rationale**: FR-027..FR-030 exigem transições manuais + efeito colateral controlado do primeiro plano. Centralizar as regras num módulo puro (testável em unit) e a escrita num repositório evita divergência entre o caminho "Action de status do incidente" e o caminho "criar plano".

**Alternatives**: lógica dentro do repositório de planos (acopla planos↔incidente) → rejeitado; efeito só por Action separada do incidente (perde a semântica "primeiro plano move o incidente") → rejeitado.

---

## 6. Limite do payload público da OS (itens)

**Decision**: não há constante de limite existente no repo (o payload do PGR usa `max(200)` por string, sem array de itens). Adotar como **default de projeto** (documentado, ajustável): array de itens com **no máximo 100** entradas, cada `description` com **máx. 500 caracteres**, no `serviceOrderItemPublicSchema` (`.strict()`). O payload público inclui **apenas** `documentTitle`, `serviceOrderNumber`, `companyName`, `employeeName`, `issuedAt`, `items[]` (cada item = `{description, done}` textual) — sem CPF/`org_id`/IDs internos/dados médicos/riscos completos/token.

**Rationale**: o prompt pede "não inventar valor" → registro o default como decisão técnica explícita (não como regra oculta), fácil de calibrar. `.strict()` garante que nenhum campo extra vaze (SC-006).

**Alternatives**: sem limite → rejeitado (payload público pode inchar); limite muito baixo → rejeitado (OS reais têm dezenas de itens).

---

## 7. Sanitização do prompt de IA (allowlist não-PII)

**Decision**: o input da sugestão IA é montado **no servidor** por `domains/safety/action-plan-suggestion.ts` a partir da origem (`risk` ou `incident`) e passa por um schema de **allowlist**:

- **origem `risk`**: tipo do risco, descrição do risco, e contexto do GES (processo/ambiente/**títulos** de função) — mesmo padrão não-PII da fatia 017.
- **origem `incident`**: `type`, `category`, `severity`, `location` (genérico), `description` das circunstâncias, `causes`, `environmental_impact`, `activity_procedure` — **sem** identificação de pessoa.
- **Nunca**: nome do empregado, CPF, dados médicos, `hospital`, `witnesses`, fotografias, `injury_*`/`body_part_*`/`causative_agent_*` quando identificáveis, ou qualquer descrição pessoal desnecessária.
  Output = schema Zod 5W2H (`what/why/who/where/when/how/how_much`) validado item-a-item por tool use. `kind` de uso = `action_plan_suggestion` (coluna `ai_usage_events.kind` é TEXT → **zero migration**). Cota: `free`=20/mês (constante existente), `pro` ilimitado. Falha do LLM → `AiUnavailableError`/`AI_UNAVAILABLE` (502) com degradação graciosa; cota → `QuotaExceededError`/`QUOTA_EXCEEDED` (402). CRUD 100% funcional sem IA.

**Rationale**: reusa `ai_usage_events`/`isAiSuggestionAvailable`/`recordAiUsage`/`AiUnavailableError`; garante P0 de privacidade por allowlist explícita.

**Alternatives**: mandar o registro cru → rejeitado (vaza saúde/PII); novo `kind` via enum → desnecessário (coluna é TEXT).

---

## 8. Estado de assinatura da OS (derivado)

**Decision**: nenhuma coluna de assinatura na OS. Estado protegido derivado da última `signature_request` de `target_type = 'service_order'` + `target_id = serviceOrderId` e da existência de `signature_capture`: `none | pending | signed | expired | cancelled` (espelha `derivePgrSignatureState`). O `publicUrl`/token cru só existe **na resposta da criação** (nunca persistido/logado). Itens da OS ficam imutáveis quando o estado ≠ `none` (assinada/pendente conforme regra de emissão) — regra concreta de imutabilidade fixada no domínio da OS (assinada → imutável).

**Rationale**: reuso direto da infra 010/022; evita duplicação de estado (FR-015).

**Alternatives**: coluna `signed_at` na OS → rejeitado (duplica verdade da infra genérica).

---

## 9. Nomes de arquivos/rotas e labels

**Decision**: schema files `service-orders.ts`, `accidents.ts`, `action-plans.ts`, `risk-audits.ts` (kebab, padrão real). Recurso REST de incidentes exposto como `/api/v1/incidents` (rótulo de UI "Incidentes/Acidentes"); tabela canônica `accidents`. Enums com **identificadores em inglês** (`open`, `in_progress`…, `registered`, `awaiting_planning`…), rótulos PT na UI. Rota pública reusa `/signature-requests/[token]` (a de `/sign/[token]` da fatia 012 é da infra antiga de EPI e não é usada aqui).

**Rationale**: consistência com o código e com o padrão de identificadores em inglês.

---

## Resumo das decisões

| #   | Tema             | Decisão                                                                                                                                  |
| --- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Journal          | Reconciliar por evidência (`__drizzle_migrations`) antes da `0024`; testes glob-am arquivos (verdes hoje); risco é `drizzle-kit migrate` |
| 2   | Numeração OS     | `FOR UPDATE` na linha do tenant em `orgs` + `max+1` + UNIQUE backstop                                                                    |
| 3   | origin_type      | TEXT validado na app; V1 `risk\|incident`; extensível sem migration                                                                      |
| 4   | CAT              | Interno (texto); sem S-2210; sem `esocial_events` automático                                                                             |
| 5   | Status incidente | `incident-lifecycle.ts` puro (fonte única) + persistência no repo, mesma transação                                                       |
| 6   | Payload OS       | `.strict()`; default: ≤100 itens, description ≤500                                                                                       |
| 7   | IA               | allowlist não-PII; `kind=action_plan_suggestion` (TEXT, zero migration); free 20/pro ∞                                                   |
| 8   | Assinatura OS    | estado derivado; sem coluna na OS                                                                                                        |
| 9   | Nomes/labels     | kebab; enums em inglês; `/signature-requests/[token]`                                                                                    |
