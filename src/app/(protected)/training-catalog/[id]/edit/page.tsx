import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getTrainingCatalogAction } from "@/shared/server/actions/pgr/training-catalog";

import { PageHeader } from "../../../_ui/list";
import { TrainingCatalogForm } from "../../_components/training-catalog-form";
import { DeleteTrainingCatalog } from "../../_components/delete-training-catalog";

export const dynamic = "force-dynamic";

export default async function EditTrainingCatalogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const result = await getTrainingCatalogAction(id);
  if (!result.ok) notFound();

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Editar treinamento"
        description="Altere os dados do treinamento ou exclua-o do catálogo."
        action={
          <DeleteTrainingCatalog
            id={result.data.id}
            redirectTo="/training-catalog"
            withLabel
          />
        }
      />
      <TrainingCatalogForm training={result.data} />
    </div>
  );
}
