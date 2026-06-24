import { requireOfficeStaffPage } from "@/shared/auth/page-guards";

import { PageHeader } from "../../_ui/list";
import { CategoryForm } from "../_components/category-form";

export default async function NewCategoryPage() {
  await requireOfficeStaffPage();
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Nova categoria"
        description="Cadastre um item de EPI ou de máquina no catálogo."
      />
      <CategoryForm />
    </div>
  );
}
