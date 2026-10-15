import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getCategoryAction } from "@/shared/server/actions/pgr/categories";

import { PageHeader } from "../../../_ui/list";
import { CategoryForm } from "../../_components/category-form";
import { CategoryIcon } from "../../_components/category-icon";
import { DeleteCategory } from "../../_components/delete-category";

export const dynamic = "force-dynamic";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOfficeStaffPage();
  const { id } = await params;
  const result = await getCategoryAction(id);
  if (!result.ok) notFound();

  return (
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-[22px] px-[30px] pt-7 pb-10">
      <PageHeader
        backHref="/categories"
        icon={<CategoryIcon />}
        title="Editar categoria"
        description={result.data.name}
        action={
          <DeleteCategory id={result.data.id} redirectTo="/categories" variant="text" />
        }
      />
      <CategoryForm category={result.data} />
    </div>
  );
}
