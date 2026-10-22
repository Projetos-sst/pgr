import { resolvePageParams } from "@/shared/pagination";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getCompanyAction } from "@/shared/server/actions/pgr/companies";
import { getCompanyModuleOverviewAction } from "@/shared/server/actions/platform/company-modules";
import {
  COMPANY_MODULE_LABELS,
  type CompanyModule,
} from "@/shared/domains/platform/company-modules";
import { ModuleControls } from "./module-controls";
import { PageHeader } from "../../../_ui/list";

export const dynamic = "force-dynamic";

export default async function CompanyServicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const ctx = await requireOfficeStaffPage();
  const { id } = await params;
  const sp = await searchParams;
  const { page } = resolvePageParams({ page: Number(sp.page) });
  const [company, overview] = await Promise.all([
    getCompanyAction(id),
    getCompanyModuleOverviewAction(id, { page }),
  ]);
  if (!company.ok || !overview.ok) notFound();
  const { modules, history } = overview.data;
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <PageHeader
        title={`Serviços — ${company.data.razaoSocial}`}
        backHref="/companies"
        description="PGR e Medicina são habilitados separadamente. O plano Pro e as cobranças permanecem independentes."
      />
      <ModuleControls companyId={id} modules={modules} canManage={ctx.role === "owner"} />
      <section className="glass-card rounded-[20px] p-6">
        <h2 className="mb-4 font-semibold">Histórico de serviços</h2>
        <ul className="space-y-3">
          {history.rows.map((event) => (
            <li key={event.id} className="border-b border-white/50 pb-3 text-sm">
              <p>
                {COMPANY_MODULE_LABELS[event.module as CompanyModule]}:{" "}
                {event.enabled ? "habilitado" : "desabilitado"} ·{" "}
                {new Date(event.changedAt).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })}
              </p>
              <p>
                {event.reason} · Responsável: {event.changedBy}
              </p>
            </li>
          ))}
        </ul>
        {history.total === 0 && <p>Nenhuma alteração registrada.</p>}
        <nav aria-label="Páginas do histórico" className="mt-4 flex gap-4">
          {page > 1 && <Link href={`?page=${page - 1}`}>Anterior</Link>}
          {page * 20 < history.total && <Link href={`?page=${page + 1}`}>Próxima</Link>}
        </nav>
      </section>
    </div>
  );
}
