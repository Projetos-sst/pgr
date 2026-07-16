# Briefing US2 — Registro de treinamento realizado por funcionário

> Issue **#30**. Depende de US1 (#29) e da Fundação (#28). **Zero migration.** Decisões-mãe: **D1**
> (`computeValidUntil` no servidor), **D4** (certificado = `certificate_path`), **D6** do
> [brainstorming](./fase04-treinamentos-brainstorming.md).

## Escopo

Registrar que um funcionário realizou um treinamento do catálogo, com data de realização; a validade
(`valid_until`) é **calculada automaticamente** pela periodicidade do catálogo. Alimenta o controle de
vencimento (US3) e a conformidade (US4).

## Fluxo

Form (funcionário + treinamento do catálogo + `completed_at` + certificado opcional) → Server Action
valida zod → **recalcula `valid_until` no servidor** com `computeValidUntil` (D1) → `INSERT` 1 linha em
`training_records` via `auditedTenantWrite` dentro de `withOrg`.

- **Escrita simples**, não transacional multi-tabela: não há saldo materializado como no EPI → **sem
  `FOR UPDATE`, sem transação composta** (KISS — não inventar concorrência).
- Selects de funcionário e treinamento vêm de queries `withOrg` (reusa `getById`/list de #29 e o repo
  de employees). IDs de outro tenant → RLS barra; zod dá `FK_NOT_FOUND`/422 com mensagem limpa.

## `valid_until` — servidor manda

O client pode **exibir** a validade ao escolher o treinamento (fetch leve da periodicidade) como
feedback, mas o valor gravado é **sempre recalculado no servidor** (nunca confiar no input do cliente —
mesma disciplina do tenant). `single → valid_until = null` (não expira).

## Certificado (D4 — sem GED)

`certificate_path text` nullable. Vínculo **opcional**. **Não** construir upload/storage/tabela
`documents` nesta fatia — quando o módulo de documentos existir, vira FK numa migration própria.

## Regras verificáveis

- Registro vincula funcionário ↔ treinamento do **tenant ativo** corretamente.
- `valid_until = computeValidUntil(completed_at, periodicity)` no servidor; `single → null`.
- `completed_at > hoje` → `VALIDATION`/422 ("realizado" é passado).
- Funcionário e treinamento de outro escritório → erro (RLS + `FK_NOT_FOUND`), nunca grava.
- Gravação sempre no `org_id` da sessão.

## Superfície de API (os 4 juntos)

- Server Action `create` (+ `list` do histórico por funcionário, + `delete` de um registro).
- REST `GET/POST /api/v1/training-records`; `GET/DELETE /api/v1/training-records/[id]`. `201`/`204`.
- Docs `api-design.md` + Postman (pasta `training-records`).

## Testes

- **Unit**: cálculo de validade (via D1) + rejeição de `completed_at` futuro + `single→null`.
- **Integração (Postgres efêmero)**: create grava `valid_until` correto; `single` grava `null`;
  funcionário/treinamento cross-tenant → erro sem gravar; isolamento; `FORBIDDEN` para `client`.

## Referência

`domains/pgr/trainings.ts` (D1) · repositórios de `epis`/`companies` (padrão de create auditado) ·
`src/app/(protected)/employees/[id]/` (ponto de entrada natural do registro).
