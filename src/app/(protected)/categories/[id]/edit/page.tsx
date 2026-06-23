import { notFound } from "next/navigation";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getCategoryAction } from "@/shared/server/actions/pgr/categories";

import { PageHeader } from "../../../_ui/list";
import { CategoryForm } from "../../_components/category-form";
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
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Editar categoria"
        description="Altere os dados da categoria ou exclua-a do catálogo."
        action={<DeleteCategory id={result.data.id} redirectTo="/categories" />}
      />
      <CategoryForm category={result.data} />
    </div>
  );
}
