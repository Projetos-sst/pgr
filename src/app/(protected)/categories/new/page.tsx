import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { categoryTypeSchema } from "@/shared/domains/pgr/validation";

import { PageHeader } from "../../_ui/list";
import { CategoryForm } from "../_components/category-form";
import { CategoryIcon } from "../_components/category-icon";

export default async function NewCategoryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  await requireOfficeStaffPage();
  const sp = await searchParams;
  // Pré-seleciona o tipo quando vindo do CTA de "categoria vazia" (#21).
  const parsedType = categoryTypeSchema.safeParse(sp.type);
  const initialType = parsedType.success ? parsedType.data : undefined;
  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <PageHeader
        backHref="/categories"
        icon={<CategoryIcon />}
        title="Nova categoria"
        description="Item de EPI ou de máquina no catálogo"
      />
      <CategoryForm initialType={initialType} />
    </div>
  );
}
