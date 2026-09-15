import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listAvailableCatalogOptionsAction } from "@/shared/server/actions/pgr/epi-stock";

import { EmptyState, PageHeader } from "../../_ui/list";
import { EpiStockForm } from "../_components/epi-stock-form";

export const dynamic = "force-dynamic";

export default async function NewEpiStockPage() {
  await requireOfficeStaffPage();
  const result = await listAvailableCatalogOptionsAction();
  const options = result.ok ? result.data : [];

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        backHref="/epi-stock"
        title="Adicionar ao estoque"
        description="Associe um item do catálogo ao estoque e defina a quantidade mínima."
      />
      {options.length === 0 ? (
        <EmptyState message="Todos os itens do catálogo já têm estoque (ou o catálogo está vazio)." />
      ) : (
        <EpiStockForm catalogOptions={options} />
      )}
    </div>
  );
}
