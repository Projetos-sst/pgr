# Data Model — Editor do PGR e visão consolidada

**Zero migration.** Todas as tabelas já existem (migration `0012`, schema `db/schema/pgr.ts`). Este
documento descreve o modelo **como já está** + as projeções/estruturas de leitura da fatia. Nada
altera schema.

## Tabelas existentes (0012)

### `pgr` (documento — CRUD já entregue na 013)

`id`, `org_id` (FK orgs cascade), `company_id` (FK companies cascade), `work_unit_id` (FK work_units
**SET NULL**, nullable), `responsible` (text), `registration_type` (enum `pgr_registration_type`:
`crm`/`crea`/`mte`/`not_applicable`, default `not_applicable`), `registration_number` (text),
`issued_at` (date), `valid_until` (date), `created_at`/`updated_at`. RLS `pgr_isolation`. **Sem**
cor/sumário/aceite/status/versão.

### `pgr_ges` (vínculo PGR↔GES)

`id`, `org_id` (FK orgs cascade), `pgr_id` (FK pgr cascade), `ges_id` (FK ges cascade),
`created_at`/`updated_at`. **UNIQUE `uq_pgr_ges_org_pgr_ges (org_id, pgr_id, ges_id)`**. RLS
`pgr_ges_isolation`. Índices em org/pgr/ges.

### `pgr_revisions` (revisões)

`id`, `org_id` (FK orgs cascade), `pgr_id` (FK pgr cascade), `revision_number` (int NOT NULL),
`revised_at` (date NOT NULL default now), `notes` (text nullable), `created_at`/`updated_at`.
**UNIQUE `uq_pgr_revisions_org_pgr_number (org_id, pgr_id, revision_number)`**. **Sem coluna de
autor.** RLS `pgr_revisions_isolation`.

## Regras de integridade relevantes

- **Vínculo GES duplicado** no PGR → 23505 → `DUPLICATE`/**409**.
- **Revisão com número repetido** no PGR → 23505 → `DUPLICATE`/**409**.
- **ON DELETE cascade**: apagar o PGR remove seus vínculos e revisões; apagar o GES remove o
  vínculo `pgr_ges` (não o inverso). `pgr_ges`/`pgr_revisions` **não** têm FK de entrada → sem
  endpoint de dependentes.

## Input de domínio

### `PgrGesInput` (adicionar vínculo) — `pgr-ges.ts`

| Campo   | Regra                                      |
| ------- | ------------------------------------------ |
| `gesId` | UUID obrigatório (validado `requiredUuid`) |

`org_id`/`pgr_id` **não** entram no input (sessão/rota). Remover é por rota (`pgrId`+`gesId`), sem
corpo.

### `PgrRevisionInput` (criar revisão) — `pgr-revision.ts`

| Campo            | Regra                                                                |
| ---------------- | -------------------------------------------------------------------- |
| `revisionNumber` | inteiro **≥ 1** obrigatório (`z.coerce.number().int().min(1)`)       |
| `revisedAt`      | data `AAAA-MM-DD` obrigatória (`z.iso.date`; default "hoje" no form) |
| `notes`          | opcional (`optionalString`)                                          |

Sem `author` (coluna inexistente). Ator no audit log.

## Projeções de leitura

### `PgrGesLinkItem` (aba GES)

```ts
type PgrGesLinkItem = {
  id: string; // id do vínculo pgr_ges
  gesId: string;
  gesName: string; // ges.name
  createdAt: Date;
};
```

### `PgrRevisionListItem` (aba Revisões)

```ts
type PgrRevisionListItem = {
  id: string;
  revisionNumber: number;
  revisedAt: string; // coluna date → "AAAA-MM-DD"
  notes: string | null;
  createdAt: Date;
};
```

### Estrutura consolidada (derivada, não persistida) — `pgr-consolidated.ts`

```ts
type ConsolidatedMeasure = {
  id: string;
  controlLevel: ControlLevel;
  applicable: boolean;
  actionResponsible: string | null;
  actionDeadline: string | null;
  state: MeasureState; // deriveMeasureState (without_plan|planned|overdue)
};

type ConsolidatedRisk = {
  id: string;
  agentType: RiskAgentType;
  description: string;
  riskLevel: number | null; // avaliação vigente (null = sem avaliação)
  result: RiskClassification | null; // classificação vigente
  measures: ConsolidatedMeasure[]; // [] = "Sem medidas de controle"
};

type ConsolidatedGes = {
  id: string;
  name: string;
  risks: ConsolidatedRisk[]; // [] = "GES sem riscos"; ordenados por risk_level desc, sem avaliação por último
};

type PgrConsolidated = {
  pgr: {
    id: string;
    companyName: string;
    workUnitName: string | null;
    responsible: string | null;
    registrationType: PgrRegistrationType;
    registrationNumber: string | null;
    issuedAt: string | null;
    validUntil: string | null;
  };
  ges: ConsolidatedGes[]; // [] = "PGR sem GES"
};
```

## Funções puras do domínio (testáveis)

- `sortConsolidatedRisks(risks): ConsolidatedRisk[]` — com avaliação primeiro (por `riskLevel`
  desc, desempate estável); **sem avaliação por último**.
- Reuso: `deriveMeasureState(measure, today)` / `isOverdue` (Feature 018) para o `state` das
  medidas; `today` em `America/Sao_Paulo`.

## Fallbacks (apresentação)

- PGR sem GES → `ges: []` → "Nenhum GES vinculado".
- GES sem riscos → `risks: []` → "Sem riscos neste GES".
- Risco sem avaliação → `riskLevel/result = null` → "Sem avaliação vigente" (ordenado por último).
- Risco sem medidas → `measures: []` → "Sem medidas de controle".
