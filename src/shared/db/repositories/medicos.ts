import "server-only";

import { and, asc, eq, ilike, isNotNull, or, sql, type SQL } from "drizzle-orm";

import type {
  MedicoStatus,
  MedicoValues,
  MedicoOption,
} from "@/shared/domains/pgr/medicos";
import { resolvePageParams, type PageParams, type Paginated } from "@/shared/pagination";

import { EntityInUseError } from "@/shared/errors/entity-in-use-error";

import { withOrg } from "../with-org";
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

export async function createMedico(orgId: string, input: MedicoValues): Promise<Medico> {
  return auditedTenantWrite(orgId, "pgr.medicos.write_rejected", () =>
    withOrg(orgId, async (tx) => {
      const [row] = await tx
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
        .returning();
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
      const [row] = await tx
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
        .returning();
      return row ?? null;
    }),
  );
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
