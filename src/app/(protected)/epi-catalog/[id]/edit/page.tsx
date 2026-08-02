import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getEpiCatalogAction } from "@/shared/server/actions/pgr/epi-catalog";

import { PageHeader } from "../../../_ui/list";
import { EpiCatalogForm } from "../../_components/epi-catalog-form";
import { EpiIcon } from "../../_components/epi-icon";
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
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <PageHeader
        backHref="/epi-catalog"
        icon={<EpiIcon />}
        title="Editar item de catálogo"
        description={result.data.name}
        action={
          <DeleteEpiCatalog
            id={result.data.id}
            redirectTo="/epi-catalog"
            variant="text"
          />
        }
      />
      <EpiCatalogForm item={result.data} />
    </div>
  );
}
