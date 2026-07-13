# Fase 04 (módulo de Treinamentos) — brainstorming de conclusão

> **Objetivo**: fechar **toda a Fase 04** (módulo de treinamentos) numa única leva, a partir do
> `develop` atual, para implementar via `/speckit-specify`. Este é o **brainstorming âncora**: escopo
> real, decisões travadas (KISS/DRY/YAGNI), mapa de reuso, fatiamento em User Stories e riscos.
> Cada issue tem seu briefing próprio (028/029/080/030/031) que **detalha** o que aqui está resumido;
> onde houver divergência, **este documento prevalece**.

Data: 2026-07-08 · Branch base: `develop` · Constituição: `.specify/memory/constitution.md` ·
Última migration em `develop`: `0014_epi_risk_link` → a desta leva é **`0015`**.

---

## 1. O que a Fase 04 é

Fase 04 = módulo de treinamentos ponta a ponta (paridade ePGR). Issues (label `Fase 04 — Treinamentos`):

| #   | Fatia                                                              | Estado                                |
| --- | ------------------------------------------------------------------ | ------------------------------------- |
| #28 | Modelo de dados — catálogo + realizações + obrigatórios por função | ⏳ implementar (**migration `0015`**) |
| #29 | CRUD de Catálogo de Treinamentos                                   | ⏳ implementar (zero migration)       |
| #80 | Treinamentos obrigatórios por função + conformidade                | ⏳ implementar (zero migration)       |
| #30 | Registro de treinamento realizado por funcionário                  | ⏳ implementar (zero migration)       |
| #31 | Controle de vencimento/reciclagem                                  | ⏳ implementar (zero migration)       |

**A leva inteira = 1 migration nova (`0015`).** Só o modelo (#28) mexe no banco; as outras 4 fatias
são UI + Server Actions + queries sobre esse modelo.

> ⚠️ **As issues #28, #30, #31, #80 estão desatualizadas** (foram escritas antes do Modelo B). Elas
> citam `organization_id` (Clerk), pasta `features/treinamentos/`, "SQLite em memória" e FK para uma
> tabela `documents`. **Nada disso vale.** O padrão vigente é `org_id → orgs.id` + `withOrg` + RLS
> `pgPolicy`, camadas `actions → domains → repositories`, testes em **Postgres efêmero**, e **não
> existe tabela `documents`**. A issue #29 já está no padrão novo e é a referência de linguagem.

---

## 2. Decisões travadas (KISS / DRY / YAGNI — não reabrir)

### D1 — Uma função pura de validade: `computeValidUntil`

`valid_until = completed_at + N anos` conforme periodicidade; `single → null`. Vive em
`src/shared/domains/pgr/trainings.ts`, é **unit-testada isoladamente** e é a **única** fonte desse
cálculo em todo o módulo. Consumida pela escrita de `training_records` (US2). **KISS**: calcula na
aplicação no momento da escrita — sem trigger no banco, sem cron (mesmo padrão do EPI e da CAEPI).

`annual=+1 · biennial=+2 · triennial=+3 · quinquennial=+5 · single=null`.

### D2 — Uma função pura de status: `classifyTrainingStatus`

`missing | expired | due_soon | ok`, a partir do **último** registro do funcionário para o treinamento
(ou ausência dele) + janela de alerta + data de hoje. **É a peça DRY central da fase**: a issue #80
literalmente pede "reutilizar a lógica de status de #31". Então **US3 e US4 consomem a MESMA função** —
ninguém reimplementa "vencido". Regra:

```
sem registro                         → 'missing'   (só ocorre no contexto de obrigatórios / US4)
valid_until IS NULL (periodicidade single) → 'ok'   (nunca expira)
valid_until < hoje                   → 'expired'
valid_until <= hoje + janela         → 'due_soon'
caso contrário                       → 'ok'
```

Comparação **date-only** no fuso `America/Sao_Paulo`, inclusiva (mesmo critério de `validate-ca` da
fatia 011). Vive junto de D1 em `domains/pgr/trainings.ts`.

### D3 — Periodicidade em inglês, no enum do modelo

`pgEnum('training_periodicity', ['annual','biennial','triennial','quinquennial','single'])`. Um só
enum, definido em #28, referenciado por todos. Rótulos PT (Anual/Bianual/Trienal/Quinquenal/Única)
ficam **só na UI**. Ignorar os rótulos PT das issues antigas como nome técnico.

### D4 — Certificado é `certificate_path` (texto), **sem GED**

Não existe tabela `documents`/módulo de documentos na Fase 04. Criar GED agora seria over-engineering.
`training_records.certificate_path` = `text` nullable (espelha a decisão dos campos `*_path` da fatia
006 — "upload é futuro"). Quando o módulo de documentos existir, troca-se por FK numa migration
própria. **Não** construir upload/storage nesta leva.

### D5 — "Último registro por (funcionário, treinamento)" é um helper de query único

Um funcionário pode ter feito o mesmo treinamento N vezes (reciclagem). Conformidade (US4) e vencimento
(US3) olham sempre o de **maior `completed_at`** (`ROW_NUMBER() OVER (PARTITION BY employee_id,
training_id ORDER BY completed_at DESC)`). Essa window function é **um helper de repositório
compartilhado** entre US3 e US4 — DRY também na camada de query, não só no domínio.

### D6 — `valid_until` é coluna persistida (não derivada)

Diferente do "worker_count derivado" da 006: a validade depende do estado do catálogo **no momento da
realização**. Se a periodicidade do catálogo mudar depois, realizações passadas **não** devem se mover.
Persistir `valid_until` na linha de `training_records` é o correto — recalcular na leitura seria bug.

### D7 — Sem notificação/cron real nesta fase

#31 diz que "alimenta o dashboard e a central de notificações" (Fase 7). Nesta leva: expor uma **query
de resumo** (`{ expired, dueSoon }`) reusável e parar aí. Construir agendador/notificação agora é fora
de escopo (YAGNI).

---

## 3. Fatiamento em User Stories (para o `/speckit-specify`)

Uma spec, uma branch limpa a partir de `develop`, implementada de uma vez — mas internamente em
Fundação + histórias priorizadas e independentemente testáveis.

| Fase/US      | Título                                                                   | Issue | Prioridade | Migration | Depende  |
| ------------ | ------------------------------------------------------------------------ | ----- | ---------- | --------- | -------- |
| **Fundação** | Modelo `0015` + `computeValidUntil` (D1) + `classifyTrainingStatus` (D2) | #28   | —          | **0015**  | —        |
| **US1**      | CRUD do Catálogo de Treinamentos                                         | #29   | P1         | —         | Fundação |
| **US2**      | Registro de treinamento realizado (usa D1)                               | #30   | P1         | —         | US1      |
| **US3**      | Controle de vencimento/reciclagem (define o consumo de D2)               | #31   | P1         | —         | US2      |
| **US4**      | Obrigatórios por função + conformidade (consome D2 + D5)                 | #80   | P2         | —         | US3      |

Ordem de implementação = ordem da tabela. A Fundação entrega **as duas funções puras** já testadas,
para US2/US3/US4 só consumirem.

---

## 4. Mapa de reuso (não reinventar)

- **Tenant / isolamento**: `withOrg` + `requireTenantContext()` + RLS `pgPolicy` — template
  `src/shared/db/schema/companies.ts`. Modelo de dados análogo à fatia 008 (`epis.ts`).
- **CRUD (US1)**: cópia estrutural de `companies` — `actions/pgr/*` (`officeAction` → `ActionResult`),
  `domains/pgr/*` (zod), `repositories/*` (queries em `withOrg`, `{rows,total}` via `pagination.ts`),
  REST mirror em `app/api/v1/*` (`restHandler`), `_ui/{list,form}.tsx`.
- **Erros**: `AppError`/`toActionError` — `VALIDATION`/422, `DUPLICATE`/409, `NOT_FOUND`/404,
  `FK_NOT_FOUND`/422, `FORBIDDEN`/403. Sem código novo nesta fase.
- **Auditoria**: `auditedTenantWrite` / `logTenantEvent` em toda escrita (sem PII).
- **FKs base**: `employees` (`employee_id`), `job_roles` (`job_role_id`) — já existem (fatia 006).

---

## 5. Superfície de API — obrigatória (checklist do CLAUDE.md)

Todo recurso HTTP-exposto entrega **os 4 juntos** no mesmo PR: Server Action (`officeAction`) + REST
mirror (`restHandler`) + `docs/api/api-design.md` + Postman. Recursos desta leva:

- `training-catalog` (US1) — CRUD completo + `[id]/dependents`.
- `training-records` (US2) — create/list/delete (histórico por funcionário).
- `job-role-required-trainings` (US4) — add/remove/list vínculo.
- Leituras de conformidade (US4) e de vencimento (US3) podem ser queries de Server Component
  consumidas pela UI (não exigem POST) — mas registrar as de listagem que tiverem valor de API.

---

## 6. Riscos / edge cases que a spec MUST cobrir

- **Periodicidade `single`** atravessa tudo: `valid_until = null`, **nunca** "expired"/"due_soon",
  não aparece no controle de vencimento, conta como `ok` na conformidade.
- **Funcionário sem função** (`job_role_id` null): sem obrigatórios → conforme por vacuidade (US4).
- **Função sem treinamentos obrigatórios**: aba vazia, não erro (US4).
- **Mesmo treinamento obrigatório em várias funções**: vínculo é por (função, treinamento); ok.
- **Realização com `completed_at` no futuro**: bloquear (`VALIDATION`) — "realizado" é passado (US2).
- **Reciclagem**: novo registro do mesmo treinamento não deixa o antigo "vencido" contaminar o status
  (D5 — sempre o último registro).
- **Excluir item do catálogo em uso**: bloquear/avisar (`RESTRICT` + `dependents`) se houver
  `training_records` ou vínculos obrigatórios (US1).
- **Isolamento**: nada cruza tenant em nenhuma US; query sem `withOrg` → 0 linhas (RLS backstop);
  papel `client` → `FORBIDDEN` em escrita.

---

## 7. Fora de escopo (YAGNI / dependências)

- Upload/GED de certificado (só `certificate_path` texto — D4).
- Central de notificações e agendador de vencimento (Fase 7 — só a query de resumo é exposta — D7).
- Assinatura digital de treinamento (infra `signatures.ts` da 010 existe, mas não há requisito de
  assinatura em treinamento nesta fase).
- Trilha de CBO, vínculo com eSocial, relatório em PDF por lib (usar CSS print se precisar imprimir).
- Qualquer alteração de schema fora da migration `0015`.
