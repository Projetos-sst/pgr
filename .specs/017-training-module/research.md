# Phase 0 — Research: Módulo de Treinamentos (Fase 04)

Todas as decisões técnicas da fatia já estavam travadas nos briefings (D1–D7) e a stack é fixa pela
constituição. Não há `NEEDS CLARIFICATION` no Technical Context. Este documento apenas consolida as
decisões, a justificativa e as alternativas descartadas — nenhuma investigação aberta permaneceu.

## D1 — Cálculo de validade centralizado (`computeValidUntil`)

- **Decision**: função pura `computeValidUntil(completedAt, periodicity)` em
  `src/shared/domains/pgr/trainings.ts`, única fonte do cálculo: `annual +1`, `biennial +2`,
  `triennial +3`, `quinquennial +5` anos; `single → null`. Calculada na aplicação, no momento da escrita
  (US2), e o resultado é persistido.
- **Rationale**: KISS/DRY — mesma disciplina do EPI e da CAEPI (calcular na app, sem trigger/cron).
  Uma função unit-testada isoladamente evita divergência de regra entre camadas.
- **Alternatives rejected**: trigger no banco (acopla regra ao SQL, difícil de testar unitariamente);
  cálculo na leitura (contradiz D6 — validade depende do estado do catálogo no momento da realização).

## D2 — Classificação de status centralizada (`classifyTrainingStatus`)

- **Decision**: função pura `classifyTrainingStatus(latest, { today, dueWindowDays })` no mesmo módulo,
  única fonte de `missing | expired | due_soon | ok`. Regra: sem registro → `missing`; `valid_until`
  nulo (single) com registro → `ok`; `valid_until < hoje` → `expired`; `valid_until <= hoje + janela`
  → `due_soon`; senão `ok`. Comparação date-only, fuso `America/Sao_Paulo`, inclusiva.
- **Rationale**: é a peça DRY central — US3 (vencimento) e US4 (conformidade) consomem a MESMA função;
  a issue #80 pede explicitamente reutilizar a lógica de #31. Mesma convenção de fuso/inclusão de
  `validate-ca` (fatia 011).
- **Alternatives rejected**: duas implementações separadas (risco de divergência entre "vencido" em
  telas diferentes); status derivado por SQL (menos testável; regra de negócio no banco).

## D3 — Enum `training_periodicity`

- **Decision**: `pgEnum("training_periodicity", ["annual","biennial","triennial","quinquennial",
"single"])`. Rótulos PT (Anual/Bianual/Trienal/Quinquenal/Única) só na UI.
- **Rationale**: identificadores em inglês (padrão do projeto); enum garante o domínio no banco (Princ.
  V). Enum Postgres é forward-only — sem remoção de valores.
- **Alternatives rejected**: coluna `text` livre (perde a garantia de domínio); rótulos PT como valor
  técnico (contradiz convenção de código em inglês).

## D4 — Certificado como `certificate_path text` (sem GED)

- **Decision**: `training_records.certificate_path text` nullable; sem tabela `documents`, sem upload,
  sem storage nesta fatia.
- **Rationale**: YAGNI — 1 único consumidor; espelha os campos `*_path` da fatia 006 ("upload é
  futuro"). Vira FK numa migration própria quando o módulo de documentos existir.
- **Alternatives rejected**: construir GED/storage agora (over-engineering para o requisito atual).

## D5 — Helper "último registro por (funcionário, treinamento)"

- **Decision**: window function `ROW_NUMBER() OVER (PARTITION BY employee_id, training_id ORDER BY
completed_at DESC)` filtrando `rn = 1`, encapsulada num helper de repositório compartilhado
  (`training-compliance.ts`) entre US3 e US4.
- **Rationale**: reciclagem — só o registro de maior `completed_at` conta; um registro antigo vencido
  não pode contaminar o status. DRY também na camada de query (não só no domínio). Padrão análogo ao
  `computeRunningBalance`/window function de `stock-movements`.
- **Alternatives rejected**: `MAX(completed_at)` + join (mais verboso, sujeito a empate); calcular o
  "último" na aplicação carregando todo o histórico (ineficiente).

## D6 — `valid_until` persistido (não derivado)

- **Decision**: `valid_until date` é coluna gravada na realização (via D1), não recalculada na leitura.
- **Rationale**: a validade depende da periodicidade **no momento da realização**; mudar a periodicidade
  do catálogo depois não deve mover realizações passadas. Derivar na leitura seria bug.
- **Alternatives rejected**: derivar `valid_until` a partir do catálogo na leitura (altera o passado ao
  editar o catálogo).

## D7 — Sem notificação/cron nesta fase

- **Decision**: US3 expõe apenas uma query de resumo `{ expired, dueSoon }` (contagens escopadas ao
  tenant) para o dashboard futuro (Fase 7). Nada de agendador/central de notificações.
- **Rationale**: YAGNI + Princípio IV — a notificação em massa é operação de outra fase. A query de
  resumo é síncrona e barata.
- **Alternatives rejected**: cron/notificação agora (fora de escopo, infra adicional).

## Isolamento & escrita (padrões herdados)

- **Decision**: `withOrg(orgId, tx => …)` em toda leitura/escrita; RLS `pgPolicy` como backstop; escrita
  via `auditedTenantWrite` (`logTenantEvent`, sem PII). Tenant sempre de `requireTenantContext()` /
  gate `officeAction`/`restHandler`; papel `client` → `FORBIDDEN`.
- **Rationale**: Princípio I não-negociável; reuso 1:1 de companies/EPI.
- **Alternatives rejected**: acessar Drizzle direto nas actions (quebra a camada repository); confiar em
  `org_id` de input do cliente (proibido).

## Erros (sem código novo)

- **Decision**: reusar `VALIDATION`/422, `DUPLICATE`/409, `NOT_FOUND`/404, `FK_NOT_FOUND`/422,
  `FORBIDDEN`/403 (mapa já existente em `src/shared/api/rest.ts` e `toActionError`).
- **Rationale**: os edge cases da spec mapeiam integralmente nesses códigos; nenhum caso novo requer um
  código inédito.
- **Alternatives rejected**: introduzir códigos específicos de treinamento (desnecessário; escopo veda).

## Testes de integração — Postgres efêmero

- **Decision**: integração contra Postgres efêmero (`INTEGRATION_*`), nunca SQLite.
- **Rationale**: a fatia depende de RLS/policies (Princípio I); SQLite não prova o backstop (exceção da
  constituição v1.2.0). Helper aplica migrations dividindo em `--> statement-breakpoint`.
- **Alternatives rejected**: SQLite em memória (não suporta RLS/`current_setting`).
