# Briefing US4 — Treinamentos obrigatórios por função + conformidade

> Issue **#80**. Depende de US3 (#31 — **consome D2**) e da Fundação (#28). **Zero migration.**
> Decisões **D2, D5** do [brainstorming](./fase04-treinamentos-brainstorming.md).

## Escopo

Duas capacidades distintas (não confundir):

1. **Gerir vínculos** função ↔ treinamento obrigatório (CRUD magro sobre `job_role_required_trainings`).
2. **Ler conformidade** por funcionário (query de junção), exibida na aba "Treinamentos Obrigatórios"
   do perfil + relatório de não-conformes.

## (1) Vínculos obrigatórios (`job_role_required_trainings`)

- **Add / Remove / List** por função, org-scopado. Add é **idempotente** (`UNIQUE(org_id, job_role_id,
training_id)` do #28 protege). **Sem** "editar vínculo", sem peso/prioridade (YAGNI).
- Superfície de API (os 4 juntos): Server Action + REST
  `GET/POST /api/v1/job-role-required-trainings` · `DELETE /api/v1/job-role-required-trainings/[id]`
  (ou por par `job_role_id+training_id`) + docs + Postman.

## (2) Conformidade (leitura — reusa D2 + D5)

- Para cada treinamento obrigatório da **função do funcionário** (`employees.job_role_id`), pega o
  **último** `training_records` daquele funcionário+treinamento (**helper D5**, o mesmo de US3) e
  classifica com **`classifyTrainingStatus` (D2)**: `missing | expired | due_soon | ok`.
- **Sem registro → `missing` (Ausente)**. `single` com registro → `ok`. **Não reimplementar status.**
- Não-conforme = `missing` **ou** `expired`.

## UI

- Aba "Treinamentos Obrigatórios" no perfil do funcionário: lista os exigidos pela função + status de
  cada (Realizado/Em dia · A vencer · Vencido · Ausente).
- Tela de gestão: função → treinamentos obrigatórios da função → adicionar/remover.
- Relatório de não-conformes = **a mesma query de conformidade sem filtro de funcionário** (não é tela
  nova; é filtro/listagem — YAGNI).

## Edge cases (regra verificável)

- **Funcionário sem função** (`job_role_id` null): sem obrigatórios → conforme por vacuidade.
- **Função sem obrigatórios**: aba vazia, não erro.
- **Mesmo treinamento obrigatório em várias funções**: vínculo por (função, treinamento); ok.
- **`single`**: realizado uma vez → sempre `ok`, nunca "a vencer".
- Vínculos e conformidade escopados pelo tenant ativo; cross-tenant → `NOT_FOUND`.

## Testes

- **Unit**: matriz de status via D2 (ausente/vencido/a vencer/em dia/single) — reaproveita os casos de
  US3; add idempotente de vínculo.
- **Integração (Postgres efêmero)**: add/remove vínculo; conformidade correta (inclui `missing` e
  último-registro D5); funcionário sem função; isolamento cross-tenant; `FORBIDDEN` para `client`.

## Referência

`domains/pgr/trainings.ts` (D2) · helper D5 de US3 (#31) · `ges-job-roles.ts`/`job-roles.ts`/
`employees.ts` (cadeia da fatia 006) · `src/app/(protected)/employees/[id]/` (aba do perfil).
