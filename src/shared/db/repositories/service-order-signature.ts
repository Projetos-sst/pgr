import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { SERVICE_ORDER_TARGET_TYPE } from "@/shared/domains/safety/service-order-signature";

import { withOrg, type TenantTransaction } from "../with-org";
import { companies } from "../schema/companies";
import { employees } from "../schema/employees";
import { serviceOrderItems, serviceOrders } from "../schema/service-orders";
import { signatureRequests } from "../schema/signatures";

/** Fonte mínima da OS para montar o payload público de assinatura (fase 06 / US3). */
export type ServiceOrderSignatureSource = {
  number: number;
  title: string;
  status: string;
  issuedAt: string; // date → 'AAAA-MM-DD'
  companyName: string | null;
  employeeName: string | null;
  items: { description: string }[];
};

/**
 * Lê APENAS o cabeçalho da OS + nome da empresa + nome do funcionário + textos dos itens. Nunca
 * carrega CPF, matrícula, dado médico, risco completo nem IDs de origem dos itens — o payload
 * público é a superfície inteira de exposição. `null` ⇒ OS inexistente/cross-tenant → `NotFoundError`
 * na camada de core/Action. Tenant vem do `withOrg` (RLS backstop), jamais do cliente.
 */
export async function getServiceOrderSignatureSource(
  orgId: string,
  serviceOrderId: string,
): Promise<ServiceOrderSignatureSource | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select({
        number: serviceOrders.number,
        title: serviceOrders.title,
        status: serviceOrders.status,
        issuedAt: serviceOrders.openedAt,
        employeeName: employees.fullName,
        companyName: companies.razaoSocial,
      })
      .from(serviceOrders)
      .leftJoin(
        employees,
        and(
          eq(employees.id, serviceOrders.assignedEmployeeId),
          eq(employees.orgId, orgId),
        ),
      )
      .leftJoin(
        companies,
        and(eq(companies.id, employees.companyId), eq(companies.orgId, orgId)),
      )
      .where(and(eq(serviceOrders.orgId, orgId), eq(serviceOrders.id, serviceOrderId)))
      .limit(1);
    if (!row) return null;

    const items = await tx
      .select({ description: serviceOrderItems.description })
      .from(serviceOrderItems)
      .where(
        and(
          eq(serviceOrderItems.orgId, orgId),
          eq(serviceOrderItems.serviceOrderId, serviceOrderId),
        ),
      )
      .orderBy(asc(serviceOrderItems.sortOrder), asc(serviceOrderItems.createdAt));

    return {
      number: row.number,
      title: row.title,
      status: row.status,
      issuedAt: row.issuedAt,
      companyName: row.companyName ?? null,
      employeeName: row.employeeName ?? null,
      items: items.map((i) => ({ description: i.description })),
    };
  });
}

/**
 * Existe captura concluída para esta OS? Consulta a infra genérica **dentro da transação chamadora**
 * e trava (`FOR UPDATE`) as solicitações do alvo: uma assinatura concorrente (que faz `UPDATE` da
 * mesma linha em `consumeAndCapture`) fica serializada com a edição/exclusão em curso, em vez de
 * escorregar entre a checagem e o commit. Leitura sob `withOrg` do chamador (RLS backstop).
 */
export async function isServiceOrderSignedTx(
  tx: TenantTransaction,
  orgId: string,
  serviceOrderId: string,
): Promise<boolean> {
  const rows = await tx
    .select({ status: signatureRequests.status })
    .from(signatureRequests)
    .where(
      and(
        eq(signatureRequests.orgId, orgId),
        eq(signatureRequests.targetType, SERVICE_ORDER_TARGET_TYPE),
        eq(signatureRequests.targetId, serviceOrderId),
      ),
    )
    .for("update");
  return rows.some((r) => r.status === "signed");
}
