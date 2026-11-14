import Link from "next/link";
import { requireTenantContext } from "@/shared/auth/require-tenant-context";
import { listRiskAuthorizationCompaniesAction } from "@/shared/server/actions/medicine/risk-authorizations";
import { resolvePageParams } from "@/shared/pagination";
import { PageHeader } from "../_ui/list";
export const dynamic = "force-dynamic";
export default async function RiskAuthorizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireTenantContext();
  const { page } = resolvePageParams({ page: Number((await searchParams).page) });
  const result = await listRiskAuthorizationCompaniesAction({ page });
  return (
    <div className="flex flex-col gap-5 px-6 py-8">
      <PageHeader
        title="Autorizações e revisão de riscos"
        description="A empresa-cliente indica quem autoriza os profissionais: o representante da empresa faz a indicação aqui, ou o escritório registra a indicação recebida. Cada acesso vale somente para a empresa indicada."
      />
      {!result.ok ? (
        <p role="alert">{result.error.message}</p>
      ) : (
        <>
          {result.data.rows.length === 0 && (
            <p>
              Nenhuma empresa disponível para sua conta. A indicação ou autorização
              precisa ser registrada pelo fluxo da empresa-cliente.
            </p>
          )}
          {result.data.rows.map((company) => (
            <Link
              key={company.id}
              href={`/risk-authorizations/${company.id}`}
              className="glass-card rounded-xl p-5 font-semibold"
            >
              {company.name}
            </Link>
          ))}
          <nav className="flex gap-4" aria-label="Páginas de empresas">
            {page > 1 && <Link href={`?page=${page - 1}`}>Anterior</Link>}
            {page * 20 < result.data.total && (
              <Link href={`?page=${page + 1}`}>Próxima</Link>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
