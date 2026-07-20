import { requireOfficeStaffPage } from "@/shared/auth/page-guards";

import { PageHeader } from "../../_ui/list";
import { TrainingCatalogForm } from "../_components/training-catalog-form";

export default async function NewTrainingCatalogPage() {
  await requireOfficeStaffPage();
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Novo treinamento"
        description="Cadastre um treinamento no catálogo do escritório."
      />
      <TrainingCatalogForm />
    </div>
  );
}
