import { resolvePageParams } from "@/shared/pagination";
import Link from "next/link";
import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { listCompaniesAction } from "@/shared/server/actions/pgr/companies";
import { PageHeader } from "../_ui/list";

export const dynamic = "force-dynamic";
export default async function MedicalRiskCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireOfficeStaffPage();
  const { page } = resolvePageParams({ page: Number((await searchParams).page) });
  const result = await listCompaniesAction({ module: "medicine", page });
  if (!result.ok)
    return (
      <p role="alert" className="p-6">
        {result.error.message}
      </p>
    );
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Riscos para Medicina"
        description="Fontes de riscos por empresa com Medicina habilitada."
        backHref="/companies"
      />
      <ul className="space-y-3">
        {result.data.rows.map((company) => (
          <li key={company.id} className="glass-card rounded-xl p-4">
            <Link href={`/companies/${company.id}/medical-risks`}>
              {company.razaoSocial}
            </Link>
          </li>
        ))}
      </ul>
      {result.data.total === 0 && <p>Nenhuma empresa com Medicina habilitada.</p>}
      <nav aria-label="Páginas de empresas" className="flex gap-4">
        {page > 1 && <Link href={`?page=${page - 1}`}>Anterior</Link>}
        {page * 20 < result.data.total && <Link href={`?page=${page + 1}`}>Próxima</Link>}
      </nav>
    </div>
  );
}
