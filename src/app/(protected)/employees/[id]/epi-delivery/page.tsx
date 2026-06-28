import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getEmployeeAction } from "@/shared/server/actions/pgr/employees";
import { listDeliverableStockAction } from "@/shared/server/actions/pgr/epi-deliveries";

import { EmptyState, PageHeader, SearchForm } from "../../../_ui/list";
import { DeliveryWizard } from "./_components/delivery-wizard";

export const dynamic = "force-dynamic";

export default async function EpiDeliveryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ search?: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const sp = await searchParams;
  const search = sp.search?.trim() || undefined;

  const employeeResult = await getEmployeeAction(id);
  if (!employeeResult.ok) notFound();
  const employee = employeeResult.data;

  // Só itens com saldo > 0 entram na seleção (SC-006). pageSize amplo: o wizard
  // seleciona em uma tela única; a busca por CA/nome refina a lista.
  const stockResult = await listDeliverableStockAction({ search, pageSize: 100 });
  const items = stockResult.ok ? stockResult.data.rows : [];

  const basePath = `/employees/${id}/epi-delivery`;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={`Entregar EPI — ${employee.fullName}`}
        description="Selecione os EPIs e as quantidades, revise e registre a assinatura."
        action={
          <Link
            href={`/employees/${id}`}
            className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15"
          >
            Voltar ao funcionário
          </Link>
        }
      />

      <SearchForm
        basePath={basePath}
        placeholder="Buscar por nome ou CA"
        defaultValue={search}
      />

      {items.length === 0 ? (
        <EmptyState
          message={
            search
              ? "Nenhum EPI com saldo encontrado para a busca."
              : "Nenhum EPI com saldo disponível para entregar. Registre entradas no estoque primeiro."
          }
        />
      ) : (
        <DeliveryWizard
          employeeId={employee.id}
          employeeName={employee.fullName}
          stockItems={items}
        />
      )}
    </div>
  );
}
