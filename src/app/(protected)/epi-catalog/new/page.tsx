import { requireOfficeStaffPage } from "@/shared/auth/page-guards";

import { PageHeader } from "../../_ui/list";
import { EpiCatalogForm } from "../_components/epi-catalog-form";

export default async function NewEpiCatalogPage() {
  await requireOfficeStaffPage();
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Novo item de catálogo"
        description="Cadastre um item de EPI ou de máquina/equipamento."
      />
      <EpiCatalogForm />
    </div>
  );
}
