import { requireOfficeStaffPage } from "@/shared/auth/page-guards";

import { PageHeader } from "../../_ui/list";
import { CategoryForm } from "../_components/category-form";
import { CategoryIcon } from "../_components/category-icon";

export default async function NewCategoryPage() {
  await requireOfficeStaffPage();
  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <PageHeader
        backHref="/categories"
        icon={<CategoryIcon />}
        title="Nova categoria"
        description="Item de EPI ou de máquina no catálogo"
      />
      <CategoryForm />
    </div>
  );
}
