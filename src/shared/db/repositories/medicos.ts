import "server-only";

import {
  and,
  asc,
  eq,
  ilike,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  countRegistrationDuplicateGroups,
  findRegistrationDuplicate,
  MEDICO_CRM_TAKEN_MESSAGE,
  MEDICO_EXAMINER_IN_USE_MESSAGE,
  registrationDuplicateMessage,
  registrationIdentityChanged,
  registrationLockKey,
  registrationScope,
  type MedicoStatus,
  type MedicoValues,
  type MedicoOption,
} from "@/shared/domains/pgr/medicos";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { DuplicateError } from "@/shared/errors/duplicate-error";
import { EntityInUseError } from "@/shared/errors/entity-in-use-error";

import { withOrg, type TenantTransaction } from "../with-org";
import { asoExaminerConclusions } from "../schema/aso-documents";
import { healthExams } from "../schema/health-exams";
import { medicos, type Medico } from "../schema/medicos";
import { auditedTenantWrite } from "./audited-write";

export type ListMedicosParams = PageParams & {
  search?: string;
  status?: MedicoStatus;
  /** Filtro por empresa/clínica (coluna `clinic`, texto livre). */
  clinic?: string;
};

export async function listMedicos(
  orgId: string,
  params: ListMedicosParams = {},
): Promise<Paginated<Medico>> {
  const { limit, offset } = resolvePageParams(params);
  const search = params.search?.trim();
  const filters: SQL[] = [eq(medicos.orgId, orgId)];
  if (search) {
    filters.push(
      or(ilike(medicos.name, `%${search}%`), ilike(medicos.crm, `%${search}%`)) as SQL,
    );
  }
  if (params.status) filters.push(eq(medicos.status, params.status));
  const clinic = params.clinic?.trim();
  if (clinic) filters.push(eq(medicos.clinic, clinic));
  const where = and(...filters);

  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(medicos)
      .where(where)
      .orderBy(asc(medicos.name))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(medicos)
      .where(where);
    return { rows, total };
  });
}

/** Opções (id + nome + crm) — para selects de médico responsável (exames/ASO). */
export async function listMedicoOptions(orgId: string): Promise<MedicoOption[]> {
  return withOrg(orgId, async (tx) =>
    tx
      .select({ id: medicos.id, name: medicos.name, crm: medicos.crm })
      .from(medicos)
      .where(and(eq(medicos.orgId, orgId), eq(medicos.status, "active")))
      .orderBy(asc(medicos.name)),
  );
}

/** Clínicas/empresas distintas (não nulas) do tenant — popula o filtro da lista. */
export async function listMedicoClinics(orgId: string): Promise<string[]> {
  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .selectDistinct({ clinic: medicos.clinic })
      .from(medicos)
      .where(and(eq(medicos.orgId, orgId), isNotNull(medicos.clinic)))
      .orderBy(asc(medicos.clinic));
    return rows.map((r) => r.clinic).filter((c): c is string => c !== null);
  });
}

export async function getMedicoById(orgId: string, id: string): Promise<Medico | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(medicos)
      .where(and(eq(medicos.orgId, orgId), eq(medicos.id, id)))
      .limit(1);
    return row ?? null;
  });
}

/** Constraint levantada pelo trigger `medicos_registration_guard` (registro equivalente). */
const EQUIVALENT_REGISTRATION_CONSTRAINT = "medicos_registration_equivalent";

type PgUniqueViolation = { constraint: string; detail: unknown };

/**
 * Violação de unicidade (23505) na cadeia `cause` do erro do postgres-js embrulhado pelo
 * Drizzle: devolve a constraint e o DETAIL, ou `null`.
 */
function findUniqueViolation(error: unknown): PgUniqueViolation | null {
  let current: unknown = error;
  for (let depth = 0; depth <= 5 && current; depth += 1) {
    if (typeof current !== "object") return null;
    const pg = current as {
      code?: unknown;
      constraint_name?: unknown;
      detail?: unknown;
      cause?: unknown;
    };
    if (pg.code === "23505" && typeof pg.constraint_name === "string")
      return { constraint: pg.constraint_name, detail: pg.detail };
    current = pg.cause;
  }
  return null;
}

/**
 * Traduz as duas recusas de registro do banco para `DUPLICATE` no campo `crm`: o índice único
 * bruto `uq_medicos_org_crm` (mesmo texto) e o trigger de registro equivalente (mesmo número
 * canônico; o DETAIL diz se a outra linha tem a mesma UF ou está sem UF). O trigger é o backstop
 * do lock + conferência da aplicação para gravações novas por qualquer caminho.
 */
async function withCrmFieldOnRawDuplicate<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    const violation = findUniqueViolation(error);
    if (violation?.constraint === "uq_medicos_org_crm")
      throw new DuplicateError(MEDICO_CRM_TAKEN_MESSAGE, { field: "crm" });
    if (violation?.constraint === EQUIVALENT_REGISTRATION_CONSTRAINT)
      throw new DuplicateError(
        registrationDuplicateMessage(
          violation.detail === "missing_uf" ? "missing_uf" : "same_uf",
        ),
        { field: "crm" },
      );
    throw error;
  }
}

/**
 * NOB-110/NOB-112: impede gravar um registro equivalente a outro do escritório quando a diferença
 * é só de formatação ("12.345" × "12345"). O índice único bruto continua; não há índice canônico
 * porque duplicatas antigas da homologação fariam a migration falhar — a regra vive aqui, na
 * mesma transação da gravação, e no trigger `medicos_registration_guard` (backstop do banco para
 * gravações novas, mesma chave de lock — reentrante na mesma transação, sem deadlock). O lock transacional por (escritório, categoria, UF, número
 * canônico) serializa gravações concorrentes do mesmo registro: a segunda só consulta depois do
 * commit da primeira e enxerga a linha. O filtro SQL só pelos dígitos é um superconjunto; a
 * decisão final usa a MESMA forma canônica do TS (`canonicalRegistrationNumber`).
 */
async function assertNoEquivalentRegistration(
  tx: TenantTransaction,
  orgId: string,
  input: MedicoValues,
  excludeId?: string,
): Promise<void> {
  const scope = registrationScope(input);
  if (!scope) return;
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${registrationLockKey(orgId, scope)}, 0))`,
  );
  const filters: SQL[] = [
    eq(medicos.orgId, orgId),
    eq(medicos.profession, scope.profession),
    or(
      isNull(medicos.registrationUf),
      sql`upper(${medicos.registrationUf}) = ${scope.uf}`,
    ) as SQL,
    sql`regexp_replace(${medicos.crm}, '[^0-9]', '', 'g') = ${scope.number}`,
  ];
  if (excludeId) filters.push(ne(medicos.id, excludeId));
  const others = await tx
    .select({
      crm: medicos.crm,
      profession: medicos.profession,
      registrationUf: medicos.registrationUf,
    })
    .from(medicos)
    .where(and(...filters));
  const duplicate = findRegistrationDuplicate(others, scope);
  if (duplicate)
    throw new DuplicateError(registrationDuplicateMessage(duplicate), { field: "crm" });
}

export async function createMedico(orgId: string, input: MedicoValues): Promise<Medico> {
  return auditedTenantWrite(orgId, "pgr.medicos.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      await assertNoEquivalentRegistration(tx, orgId, input);
      const [row] = await withCrmFieldOnRawDuplicate(() =>
        tx
          .insert(medicos)
          .values({
            orgId,
            name: input.name,
            crm: input.crm,
            profession: input.profession,
            registrationUf: input.registrationUf,
            rqe: input.rqe ?? null,
            affiliation: input.affiliation,
            specialty: input.specialty ?? null,
            clinic: input.clinic ?? null,
            phone: input.phone ?? null,
            status: input.status,
          })
          .returning(),
      );
      return row;
    }),
  );
}

export async function updateMedico(
  orgId: string,
  id: string,
  input: MedicoValues,
): Promise<Medico | null> {
  return auditedTenantWrite(orgId, "pgr.medicos.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const [stored] = await tx
        .select({
          crm: medicos.crm,
          profession: medicos.profession,
          registrationUf: medicos.registrationUf,
        })
        .from(medicos)
        .where(and(eq(medicos.orgId, orgId), eq(medicos.id, id)))
        .for("update")
        .limit(1);
      if (!stored) return null;
      // Duplicata antiga continua editável enquanto o registro não muda (sem prender o cadastro).
      if (registrationIdentityChanged(stored, input))
        await assertNoEquivalentRegistration(tx, orgId, input, id);
      const [row] = await withCrmFieldOnRawDuplicate(() =>
        tx
          .update(medicos)
          .set({
            name: input.name,
            crm: input.crm,
            profession: input.profession,
            registrationUf: input.registrationUf,
            rqe: input.rqe ?? null,
            affiliation: input.affiliation,
            specialty: input.specialty ?? null,
            clinic: input.clinic ?? null,
            phone: input.phone ?? null,
            status: input.status,
            updatedAt: new Date(),
          })
          .where(and(eq(medicos.orgId, orgId), eq(medicos.id, id)))
          .returning(),
      );
      return row ?? null;
    }),
  );
}

/**
 * Quantos grupos de possíveis duplicatas de registro já existem no escritório (mesma categoria e
 * número canônico com UF repetida ou sem UF). Só leitura e só o número: nenhum nome, registro ou
 * id sai daqui — serve para o operador saber se há legado a revisar manualmente.
 */
export async function countMedicoRegistrationDuplicateGroups(
  orgId: string,
): Promise<number> {
  return withOrg(orgId, async (tx) => {
    const rows = await tx
      .select({
        crm: medicos.crm,
        profession: medicos.profession,
        registrationUf: medicos.registrationUf,
      })
      .from(medicos)
      .where(eq(medicos.orgId, orgId));
    return countRegistrationDuplicateGroups(rows);
  });
}

/**
 * Walks the `cause` chain (postgres-js errors surfaced via Drizzle wrap the real
 * SQLSTATE on `error.cause.code`) looking for a foreign-key violation (23503);
 * returns the constraint name ("" when absent) or `null`.
 */
function foreignKeyViolation(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth <= 5 && current; depth += 1) {
    if (typeof current === "object" && current !== null && "code" in current) {
      const pg = current as { code: unknown; constraint_name?: unknown };
      if (pg.code === "23503")
        return typeof pg.constraint_name === "string" ? pg.constraint_name : "";
    }
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

/** FK `health_exams.doctor_id → medicos.id` (NO ACTION desde a 0081). */
const HEALTH_EXAM_DOCTOR_FK = "health_exams_doctor_id_medicos_id_fk";

const MEDICO_COORDINATION_IN_USE_MESSAGE =
  "Este médico tem histórico de coordenação do PCMSO e não pode ser excluído. Inative o cadastro.";

/**
 * Excluir não pode apagar em silêncio quem examinou: exame (e ASO/assinado, que dependem do
 * exame) ou confirmação de conclusão do ASO que apontem para o profissional → IN_USE, para ele
 * ser inativado. A conferência roda antes (mensagem exata nas linhas que o tenant enxerga) e a FK
 * `health_exams.doctor_id` (NO ACTION) é o backstop para exame que a RLS esconde (empresa sem o
 * módulo de Medicina) ou gravado em paralelo. A designação de coordenador do PCMSO (histórico)
 * usa RESTRICT: 23503 → IN_USE.
 */
export async function deleteMedico(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, "pgr.medicos.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const [exam] = await tx
        .select({ id: healthExams.id })
        .from(healthExams)
        .where(and(eq(healthExams.orgId, orgId), eq(healthExams.doctorId, id)))
        .limit(1);
      const [conclusion] = exam
        ? []
        : await tx
            .select({ id: asoExaminerConclusions.id })
            .from(asoExaminerConclusions)
            .where(
              and(
                eq(asoExaminerConclusions.orgId, orgId),
                eq(asoExaminerConclusions.examinerMedicoId, id),
              ),
            )
            .limit(1);
      if (exam || conclusion) throw new EntityInUseError(MEDICO_EXAMINER_IN_USE_MESSAGE);
      try {
        const rows = await tx
          .delete(medicos)
          .where(and(eq(medicos.orgId, orgId), eq(medicos.id, id)))
          .returning({ id: medicos.id });
        return rows.length > 0;
      } catch (error) {
        const constraint = foreignKeyViolation(error);
        if (constraint !== null)
          throw new EntityInUseError(
            constraint === HEALTH_EXAM_DOCTOR_FK
              ? MEDICO_EXAMINER_IN_USE_MESSAGE
              : MEDICO_COORDINATION_IN_USE_MESSAGE,
          );
        throw error;
      }
    }),
  );
}
