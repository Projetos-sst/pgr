import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getEpiCatalogAction } from "@/shared/server/actions/pgr/epi-catalog";

import { PageHeader } from "../../../_ui/list";
import { EpiCatalogForm } from "../../_components/epi-catalog-form";
import { DeleteEpiCatalog } from "../../_components/delete-epi-catalog";

export const dynamic = "force-dynamic";

export default async function EditEpiCatalogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const result = await getEpiCatalogAction(id);
  if (!result.ok) notFound();

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Editar item de catálogo"
        description="Altere os dados do item ou exclua-o do catálogo."
        action={
          <DeleteEpiCatalog id={result.data.id} redirectTo="/epi-catalog" withLabel />
        }
      />
      <EpiCatalogForm item={result.data} />
    </div>
  );
}
