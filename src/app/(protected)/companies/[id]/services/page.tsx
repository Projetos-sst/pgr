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

/** Eventos de migration (ex.: backfill da 0053) são do sistema, nunca de uma pessoa. */
function responsibleLabel(changedBy: string): string {
  const migration = /^migration:(\w+)$/.exec(changedBy);
  return migration ? `Sistema (migration ${migration[1]})` : changedBy;
}

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
  const missing = [company, overview].some(
    (r) => !r.ok && (r.error.code === "NOT_FOUND" || r.error.code === "VALIDATION"),
  );
  if (missing) notFound();
  if (!company.ok || !overview.ok)
    // Falha de leitura não vira "Desabilitado" (NOB-170/171).
    return (
      <div className="flex flex-col gap-6 px-6 py-8">
        <PageHeader title="Serviços da empresa" backHref="/companies" />
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          Não foi possível carregar os serviços desta empresa. Nenhum estado foi alterado.{" "}
          <Link href={`/companies/${id}/services`} className="font-semibold underline">
            Tentar novamente
          </Link>
        </div>
      </div>
    );
  const { modules, history } = overview.data;
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <p className="text-primary font-mono text-[11px] font-semibold tracking-[0.18em] uppercase">
          Serviços da empresa
        </p>
        <PageHeader
          title={company.data.razaoSocial}
          backHref="/companies"
          description="Gerencie os serviços disponíveis para esta empresa. PGR e Medicina do Trabalho podem ser habilitados separadamente; o plano Pro e as cobranças são independentes."
        />
      </div>
      <ModuleControls
        companyId={id}
        companyName={company.data.razaoSocial}
        modules={modules}
        canManage={ctx.role === "owner"}
      />
      <Link href={`/companies/${id}/machines`} className="text-primary w-fit underline">
        Máquinas e equipamentos por obra e ambiente
      </Link>
      <details
        className="glass-card group rounded-[20px] p-6"
        open={sp.page !== undefined}
      >
        <summary className="text-text cursor-pointer font-semibold">
          Histórico de alterações ({history.total})
        </summary>
        {history.total === 0 ? (
          <p className="text-text-muted mt-4 text-sm">Nenhuma alteração registrada.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {history.rows.map((event) => (
              <li
                key={event.id}
                className="border-b border-white/50 pb-3 text-sm last:border-b-0"
              >
                <p className="text-text font-semibold">
                  {COMPANY_MODULE_LABELS[event.module as CompanyModule]} ·{" "}
                  {event.enabled ? "habilitado" : "desabilitado"}
                </p>
                <p className="text-text-muted">
                  {new Date(event.changedAt).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}{" "}
                  · Responsável: {responsibleLabel(event.changedBy)}
                </p>
                <p className="text-text-muted">Motivo: {event.reason}</p>
              </li>
            ))}
          </ul>
        )}
        <nav aria-label="Páginas do histórico" className="mt-4 flex gap-4 text-sm">
          {page > 1 && <Link href={`?page=${page - 1}`}>Anterior</Link>}
          {page * 20 < history.total && <Link href={`?page=${page + 1}`}>Próxima</Link>}
        </nav>
      </details>
    </div>
  );
}
