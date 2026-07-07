# Data Model — CRUD do Documento PGR

**Zero-migration.** A tabela `pgr` já existe (`src/shared/db/schema/pgr.ts`, migration
`0012_pgr_risk_data_model.sql`). Este documento descreve apenas o **modelo de aplicação** (schema
Zod, tipos, projeções) que a fatia adiciona — nenhuma coluna/constraint nova.

## Entidade `pgr` (colunas existentes usadas)

| Coluna (DB)                                                | Campo (app)             | Tipo                             | Regra na fatia                                                      |
| ---------------------------------------------------------- | ----------------------- | -------------------------------- | ------------------------------------------------------------------- |
| `id` uuid PK                                               | `id`                    | string                           | gerado pelo banco                                                   |
| `org_id` text NOT NULL → orgs (cascade)                    | —                       | —                                | preenchido pelo repo a partir do tenant da sessão; nunca do cliente |
| `company_id` uuid NOT NULL → companies (cascade)           | `companyId`             | uuid                             | **obrigatório**; guard `assertCompanyInTenant`                      |
| `work_unit_id` uuid → work_units (**SET NULL**)            | `workUnitId`            | uuid?                            | **opcional**; se presente, guard `assertWorkUnitInCompany`          |
| `responsible` text                                         | `responsible`           | string?                          | opcional (texto livre)                                              |
| `registration_type` enum NOT NULL default `not_applicable` | `registrationType`      | `crm\|crea\|mte\|not_applicable` | reusa `pgrRegistrationTypeSchema`                                   |
| `registration_number` text                                 | `registrationNumber`    | string?                          | **condicionado** ao `registrationType` (D4)                         |
| `issued_at` date                                           | `issuedAt`              | ISO `AAAA-MM-DD`                 | **obrigatório na app** (backstop nullable no DB)                    |
| `valid_until` date                                         | `validUntil`            | ISO `AAAA-MM-DD`                 | **obrigatório na app**; `>= issuedAt`                               |
| `created_at` / `updated_at` timestamptz                    | `createdAt`/`updatedAt` | Date                             | geridos por default/trigger `set_updated_at_pgr`                    |

**Fora da fatia** (não editados/lidos): não há coluna de aceite da declaração, nem `created_by`
(autor), nem status. `pgr_ges`/`pgr_revisions` cascateiam na exclusão (comportamento do `0012`) mas
não são tocados.

## Schemas Zod — `src/shared/domains/pgr/pgr.ts` (NOVO)

Imports: `pgrRegistrationTypeSchema`, `pgrRegistrationTypeLabel` de `./risks`; `requiredUuid`,
`optionalUuid`, `optionalString` de `./form-fields`; `z` de `zod`.

```ts
// Data ISO obrigatória (AAAA-MM-DD), validada no calendário (rejeita 2026-13-45).
const requiredIsoDate = (message: string) => z.iso.date(message);

// Campos persistidos (sem o aceite).
const pgrBaseObject = z.object({
  companyId: requiredUuid("Empresa é obrigatória"),
  workUnitId: optionalUuid, // "" -> undefined; valida UUID se presente
  responsible: optionalString, // "" -> undefined
  registrationType: pgrRegistrationTypeSchema, // enum reusado
  registrationNumber: optionalString,
  issuedAt: requiredIsoDate("Data de emissão é obrigatória"),
  validUntil: requiredIsoDate("Data de validade é obrigatória"),
});

// Regra cross-field compartilhada entre create e update.
function refinePgr(data: z.infer<typeof pgrBaseObject>, ctx: z.RefinementCtx) {
  const needsNumber = data.registrationType !== "not_applicable";
  if (needsNumber && !data.registrationNumber) {
    ctx.addIssue({
      path: ["registrationNumber"],
      code: "custom",
      message: "Número de registro é obrigatório para CRM/CREA/MTE",
    });
  }
  if (!needsNumber && data.registrationNumber) {
    ctx.addIssue({
      path: ["registrationNumber"],
      code: "custom",
      message: "Número de registro não se aplica ao tipo selecionado",
    });
  }
  if (data.issuedAt && data.validUntil && data.validUntil < data.issuedAt) {
    ctx.addIssue({
      path: ["validUntil"],
      code: "custom",
      message: "Validade não pode ser anterior à emissão",
    });
  }
}

// Usado por update e pela persistência (valores já validados).
export const pgrInputSchema = pgrBaseObject.superRefine(refinePgr);

// Usado por create — adiciona o GATE não-persistido da declaração.
export const pgrCreateSchema = pgrBaseObject
  .extend({
    declarationAccepted: z.literal(true, {
      error:
        "É necessário aceitar a Declaração de Ciência de Riscos (NR-01) para criar o PGR.",
    }),
  })
  .superRefine(refinePgr);

export type PgrInput = z.input<typeof pgrInputSchema>; // tipo de formulário/wire (update)
export type PgrValues = z.output<typeof pgrInputSchema>; // tipo passado ao repo (persistido)
export type PgrCreateInput = z.input<typeof pgrCreateSchema>; // wire de create (com declarationAccepted)
```

**Descartar o aceite no create** (na action e no handler REST):

```ts
const parsed = pgrCreateSchema.parse(input);
const { declarationAccepted: _accepted, ...values } = parsed; // não persistido
await repo.createPgr(tenantId, values); // values: PgrValues
```

## Projeção de listagem — `PgrListItem`

```ts
export type PgrListItem = {
  id: string;
  companyId: string;
  companyName: string; // companies.razaoSocial (innerJoin)
  workUnitId: string | null;
  workUnitName: string | null; // work_units.name (leftJoin) — null se sem obra
  responsible: string | null;
  registrationType: PgrRegistrationType;
  registrationNumber: string | null;
  issuedAt: string | null; // date -> string
  validUntil: string | null;
};
```

Colunas da tabela de UI (FR-002), na ordem: **Emissão · Validade · Obra/Contrato · Empresa ·
Responsável · Opções**. `registrationType` usa `pgrRegistrationTypeLabel(...)` para exibição no
detalhe. "Usuário autor" **não** existe (fora de escopo).

## Regras de validação (resumo → requisitos)

| Regra                                                       | Origem        | Erro                                       |
| ----------------------------------------------------------- | ------------- | ------------------------------------------ |
| `companyId` UUID obrigatório                                | FR-001        | `VALIDATION` (campo `companyId`)           |
| `workUnitId` UUID se presente                               | FR-001        | `VALIDATION` (campo `workUnitId`)          |
| `registrationType` ∈ enum                                   | FR-001        | `VALIDATION` (campo `registrationType`)    |
| número obrigatório p/ crm/crea/mte; vazio p/ not_applicable | FR-009        | `VALIDATION` (campo `registrationNumber`)  |
| `issuedAt`/`validUntil` obrigatórias e formato ISO          | FR-001/FR-010 | `VALIDATION`                               |
| `validUntil >= issuedAt`                                    | FR-010        | `VALIDATION` (campo `validUntil`)          |
| aceite obrigatório (create)                                 | FR-007        | `VALIDATION` (campo `declarationAccepted`) |
| empresa/obra inexistente ou de outra empresa/tenant         | FR-014        | `FK_NOT_FOUND` (422)                       |
| pgr inexistente ou de outro tenant (get/update/delete)      | FR-013        | `NOT_FOUND` (404)                          |
| (sem unique)                                                | FR-019        | — (nunca `DUPLICATE`)                      |

## State transitions

Não há máquina de estados nesta fatia (sem coluna de status/ciclo de vida — #79). CRUD puro.
