import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import type { ServiceOrderStatus } from "@/shared/domains/safety/service-order";
import { isServiceOrderSigned } from "@/shared/domains/safety/service-order-signature";
import { getServiceOrderAction } from "@/shared/server/actions/safety/service-orders";
import { getServiceOrderSignatureViewAction } from "@/shared/server/actions/safety/service-order-signature";

import { PageHeader } from "../../_ui/list";
import { DeleteServiceOrder } from "../_components/delete-service-order";
import { StatusActions } from "../_components/status-actions";
import { ServiceOrderSignaturePanel } from "./_components/signature-panel";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  risk: "Risco",
  epi: "EPI",
};

export default async function ServiceOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const result = await getServiceOrderAction(id);
  if (!result.ok) notFound();
  const { order, statusLabel, daysOpen, employee, items } = result.data;

  // Estado derivado da infra genérica de assinatura (a OS não tem coluna própria). A UI só
  // **antecipa** o bloqueio de OS assinada — o backstop real é o repositório, na transação.
  const signatureResult = await getServiceOrderSignatureViewAction({
    serviceOrderId: id,
  });
  const signature = signatureResult.ok ? signatureResult.data : undefined;
  const signed = signature ? isServiceOrderSigned(signature.state) : false;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={`OS #${order.number} — ${order.title}`}
        description={`Status: ${statusLabel} · ${daysOpen} dia(s) em aberto`}
        action={
          signed ? null : (
            <div className="flex gap-2">
              <Link
                href={`/service-orders/${id}/edit`}
                className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors"
              >
                Editar
              </Link>
              <DeleteServiceOrder id={id} redirectTo="/service-orders" />
            </div>
          )
        }
      />

      <div className="glass-card grid grid-cols-1 gap-4 p-5 text-sm sm:grid-cols-2">
        <Field label="Funcionário" value={employee?.fullName ?? "—"} />
        <Field label="Aberta em" value={order.openedAt} />
        <Field label="Prazo" value={order.dueDate ?? "—"} />
        <Field label="Fechada em" value={order.closedAt ?? "—"} />
      </div>

      <ServiceOrderSignaturePanel serviceOrderId={id} signature={signature} />

      <section className="flex flex-col gap-2">
        <h2 className="text-text text-sm font-semibold">Alterar status</h2>
        <StatusActions id={id} current={order.status as ServiceOrderStatus} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-text text-sm font-semibold">
          Checklist ({items.length} item(ns))
        </h2>
        {items.length === 0 ? (
          <p className="text-text-subtle text-sm">Nenhum item registrado.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="glass-panel rounded-card flex items-center gap-3 px-4 py-2 text-sm"
              >
                <span className="text-text-subtle font-mono text-[10px] tracking-wide uppercase">
                  {SOURCE_LABELS[item.sourceType] ?? item.sourceType}
                </span>
                <span className={item.done ? "text-text-subtle line-through" : ""}>
                  {item.description}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-text-subtle text-xs font-semibold tracking-wide uppercase">
        {label}
      </span>
      <span className="text-text">{value}</span>
    </div>
  );
}
