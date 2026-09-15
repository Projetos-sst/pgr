import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getEpiStockAction } from "@/shared/server/actions/pgr/epi-stock";

import { PageHeader } from "../../../_ui/list";
import { EpiStockForm } from "../../_components/epi-stock-form";
import { DeleteEpiStock } from "../../_components/delete-epi-stock";
import { RegisterEntry } from "../../_components/register-entry";
import { RegisterExit } from "../../_components/register-exit";

export const dynamic = "force-dynamic";

export default async function EditEpiStockPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const result = await getEpiStockAction(id);
  if (!result.ok) notFound();
  const stock = result.data;

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        backHref="/epi-stock"
        title={stock.name}
        description="Gerenciar dados do registro de estoque (quantidade mínima)."
        action={
          <DeleteEpiStock
            id={stock.id}
            itemName={stock.name}
            redirectTo="/epi-stock"
            hasLabel
          />
        }
      />

      <div className="glass-card flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="text-text text-sm font-medium">Movimentações:</span>
        <RegisterEntry stockId={stock.id} />
        <RegisterExit stockId={stock.id} />
        <Link
          href={`/epi-stock/${stock.id}/history`}
          className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors"
        >
          Ver histórico
        </Link>
      </div>

      <EpiStockForm stock={stock} />
    </div>
  );
}
