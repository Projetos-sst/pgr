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

/**
 * Violação do índice único bruto `uq_medicos_org_crm` (mesmo texto de registro no escritório),
 * percorrendo a cadeia `cause` do erro do postgres-js embrulhado pelo Drizzle.
 */
function isRawCrmUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth <= 5 && current; depth += 1) {
    if (typeof current !== "object") return false;
    const pg = current as { code?: unknown; constraint_name?: unknown; cause?: unknown };
    if (pg.code === "23505" && pg.constraint_name === "uq_medicos_org_crm") return true;
    current = pg.cause;
  }
  return false;
}

async function withCrmFieldOnRawDuplicate<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isRawCrmUniqueViolation(error))
      throw new DuplicateError(MEDICO_CRM_TAKEN_MESSAGE, { field: "crm" });
    throw error;
  }
}

/**
 * NOB-110/NOB-112: impede gravar um registro equivalente a outro do escritório quando a diferença
 * é só de formatação ("12.345" × "12345"). O índice único bruto continua; não há índice canônico
 * porque duplicatas antigas da homologação fariam a migration falhar — a regra vive aqui, na
 * mesma transação da gravação. O lock transacional por (escritório, categoria, UF, número
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
 * SQLSTATE on `error.cause.code`) looking for a foreign-key violation (23503).
 */
function isForeignKeyViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth <= 5 && current; depth += 1) {
    if (typeof current === "object" && current !== null && "code" in current) {
      if ((current as { code: unknown }).code === "23503") return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Exames apontam para o médico com SET NULL e não bloqueiam. A designação de
 * coordenador do PCMSO (histórico) usa RESTRICT: 23503 → IN_USE, para o
 * profissional ser inativado em vez de apagado.
 */
export async function deleteMedico(orgId: string, id: string): Promise<boolean> {
  return auditedTenantWrite(orgId, "pgr.medicos.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      try {
        const rows = await tx
          .delete(medicos)
          .where(and(eq(medicos.orgId, orgId), eq(medicos.id, id)))
          .returning({ id: medicos.id });
        return rows.length > 0;
      } catch (error) {
        if (isForeignKeyViolation(error))
          throw new EntityInUseError(
            "Este médico tem histórico de coordenação do PCMSO e não pode ser excluído. Inative o cadastro.",
          );
        throw error;
      }
    }),
  );
}
