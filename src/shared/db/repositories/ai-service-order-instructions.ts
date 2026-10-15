import "server-only";

import { and, asc, eq } from "drizzle-orm";

import type { ServiceOrderInstructionContext } from "@/shared/domains/safety/ai-service-order-instructions";
import { serviceOrderTypeLabel } from "@/shared/domains/safety/service-order";

import { withOrg } from "../with-org";
import { employees } from "../schema/employees";
import { epiCatalog, epiRisk } from "../schema/epis";
import { ges } from "../schema/ges";
import { jobRoles } from "../schema/job-roles";
import { risks } from "../schema/risks";
import { serviceOrderItems, serviceOrders } from "../schema/service-orders";
import { workUnits } from "../schema/work-units";

/**
 * Contexto **não-PII** de uma OS para alimentar o prompt de instruções de segurança.
 *
 * O trabalhador designado é lido apenas para chegar ao **GES e ao título da função** —
 * nome, CPF e matrícula nunca saem daqui. A OS é assinada por uma pessoa concreta, mas o
 * prompt não precisa saber quem ela é (P0 de privacidade, mesmo critério do 5W2H).
 *
 * Escopado por `withOrg`; OS de outra org é invisível pela RLS → `null`.
 */
export async function fetchServiceOrderInstructionContext(
  orgId: string,
  serviceOrderId: string,
): Promise<ServiceOrderInstructionContext | null> {
  return withOrg(orgId, async (tx) => {
    const [order] = await tx
      .select({
        title: serviceOrders.title,
        osType: serviceOrders.osType,
        assignedEmployeeId: serviceOrders.assignedEmployeeId,
        workUnitId: serviceOrders.workUnitId,
      })
      .from(serviceOrders)
      .where(and(eq(serviceOrders.orgId, orgId), eq(serviceOrders.id, serviceOrderId)))
      .limit(1);
    if (!order) return null;

    let jobRoleTitle: string | null = null;
    let gesId: string | null = null;
    let gesName: string | null = null;
    if (order.assignedEmployeeId) {
      // Só `gesId`/`jobRoleId` — nenhuma coluna pessoal é selecionada.
      const [employee] = await tx
        .select({ gesId: employees.gesId, jobRoleId: employees.jobRoleId })
        .from(employees)
        .where(
          and(eq(employees.orgId, orgId), eq(employees.id, order.assignedEmployeeId)),
        )
        .limit(1);
      gesId = employee?.gesId ?? null;

      if (employee?.jobRoleId) {
        const [role] = await tx
          .select({ title: jobRoles.title })
          .from(jobRoles)
          .where(and(eq(jobRoles.orgId, orgId), eq(jobRoles.id, employee.jobRoleId)))
          .limit(1);
        jobRoleTitle = role?.title ?? null;
      }
      if (gesId) {
        const [g] = await tx
          .select({ name: ges.name })
          .from(ges)
          .where(and(eq(ges.orgId, orgId), eq(ges.id, gesId)))
          .limit(1);
        gesName = g?.name ?? null;
      }
    }

    let workUnitName: string | null = null;
    if (order.workUnitId) {
      const [unit] = await tx
        .select({ name: workUnits.name })
        .from(workUnits)
        .where(and(eq(workUnits.orgId, orgId), eq(workUnits.id, order.workUnitId)))
        .limit(1);
      workUnitName = unit?.name ?? null;
    }

    const riskRows = gesId
      ? await tx
          .select({ description: risks.description })
          .from(risks)
          .where(and(eq(risks.orgId, orgId), eq(risks.gesId, gesId)))
          .orderBy(asc(risks.description))
      : [];

    const epiRows = gesId
      ? await tx
          .selectDistinct({ name: epiCatalog.name })
          .from(epiRisk)
          .innerJoin(epiCatalog, eq(epiCatalog.id, epiRisk.catalogId))
          .innerJoin(risks, eq(risks.id, epiRisk.riskId))
          .where(and(eq(epiRisk.orgId, orgId), eq(risks.gesId, gesId)))
          .orderBy(asc(epiCatalog.name))
      : [];

    const itemRows = await tx
      .select({ description: serviceOrderItems.description })
      .from(serviceOrderItems)
      .where(
        and(
          eq(serviceOrderItems.orgId, orgId),
          eq(serviceOrderItems.serviceOrderId, serviceOrderId),
        ),
      );

    return {
      title: order.title,
      osType: serviceOrderTypeLabel(order.osType),
      workUnitName,
      jobRoleTitle,
      gesName,
      risks: riskRows,
      epis: epiRows,
      existingItems: itemRows.map((i) => i.description),
    };
  });
}
