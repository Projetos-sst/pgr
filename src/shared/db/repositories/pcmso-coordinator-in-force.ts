import "server-only";

import { and, eq } from "drizzle-orm";

import { todayInSaoPaulo } from "@/shared/dates";
import {
  coordinatorInForceOn,
  type CoordinatorInForce,
} from "@/shared/domains/medicine/pcmso-coordinators";

import type { TenantTransaction } from "../with-org";
import { pcmsoCoordinatorAssignments as assignments } from "../schema/medicos";

export type InForceAssignment = {
  id: string;
  medicoId: string;
  startsOn: string;
  endsOn: string | null;
};

/**
 * Designação do coordenador do PCMSO **em vigor hoje** (America/Sao_Paulo) na empresa, para
 * decidir quem pode agir agora (NOB-109/NOB-144/NOB-149). Mesma regra de
 * `coordinatorAssignmentInForceToday` nas policies: "aberta" (`ends_on` nulo) não é "em vigor";
 * sobreposição devolve `overlap` e quem usa nega (falha fechada). A RLS de módulo de
 * `pcmso_coordinator_assignments` já oculta empresas sem Medicina e de outro tenant.
 */
export async function coordinatorInForceTodayTx(
  tx: TenantTransaction,
  orgId: string,
  companyId: string,
  today: string = todayInSaoPaulo(),
): Promise<CoordinatorInForce<InForceAssignment>> {
  const history = await tx
    .select({
      id: assignments.id,
      medicoId: assignments.medicoId,
      startsOn: assignments.startsOn,
      endsOn: assignments.endsOn,
    })
    .from(assignments)
    .where(and(eq(assignments.orgId, orgId), eq(assignments.companyId, companyId)));
  return coordinatorInForceOn(history, today);
}

/** Atalho: a designação em vigor hoje, ou `null` sem designação vigente ou com sobreposição. */
export async function assignmentInForceTodayTx(
  tx: TenantTransaction,
  orgId: string,
  companyId: string,
): Promise<InForceAssignment | null> {
  const inForce = await coordinatorInForceTodayTx(tx, orgId, companyId);
  return inForce.kind === "in_force" ? inForce.assignment : null;
}
