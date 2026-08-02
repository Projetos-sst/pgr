import { requireOfficeStaffPage } from "@/shared/auth/page-guards";

import { PageHeader } from "../../_ui/list";
import { EpiCatalogForm } from "../_components/epi-catalog-form";
import { EpiIcon } from "../_components/epi-icon";

export default async function NewEpiCatalogPage() {
  await requireOfficeStaffPage();
  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <PageHeader
        backHref="/epi-catalog"
        icon={<EpiIcon />}
        title="Novo item de catálogo"
        description="Item de EPI ou de máquina/equipamento"
      />
      <EpiCatalogForm />
    </div>
  );
}
