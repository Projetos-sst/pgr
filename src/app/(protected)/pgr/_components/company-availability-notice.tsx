import Link from "next/link";

import type { PgrCompanyAvailability } from "@/shared/domains/pgr/company-availability";

/**
 * Explica por que empresas cadastradas não aparecem no seletor do Novo PGR. O PGR exige o serviço
 * PGR habilitado na empresa, e só o administrador habilita (NOB-97); nada é liberado aqui.
 */
export function CompanyAvailabilityNotice({
  availability,
  canManageServices,
}: {
  availability: PgrCompanyAvailability;
  canManageServices: boolean;
}) {
  if (availability.state === "error")
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
      >
        Não foi possível carregar as empresas. Recarregue a página; se o problema
        continuar, avise o suporte.
      </div>
    );
  if (availability.state === "no_companies")
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Nenhuma empresa cadastrada. Cadastre a empresa antes de criar o PGR.{" "}
        <Link href="/companies/new" className="font-semibold underline">
          Cadastrar empresa
        </Link>
      </div>
    );
  const missing = availability.withoutPgr;
  if (missing.length === 0) return null;
  const count =
    missing.length === 1
      ? "1 empresa cadastrada não aparece"
      : `${missing.length} empresas cadastradas não aparecem`;
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
    >
      <p>
        {count} no seletor porque o serviço PGR não está habilitado para{" "}
        {missing.length === 1 ? "ela" : "elas"}.{" "}
        {canManageServices
          ? "Habilite o serviço PGR em Serviços da empresa para criar o PGR."
          : "Peça ao administrador do escritório para habilitar o serviço PGR em Cadastro → Empresas → Serviços."}
      </p>
      <ul className="flex flex-col gap-1">
        {missing.map((company) => (
          <li key={company.id} className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{company.razaoSocial}</span>
            {canManageServices ? (
              <Link
                href={`/companies/${company.id}/services`}
                className="text-xs font-semibold underline"
                aria-label={`Habilitar PGR para ${company.razaoSocial}`}
              >
                Habilitar PGR
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
