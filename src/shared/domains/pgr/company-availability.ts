/**
 * Disponibilidade de empresas para criar um PGR. O PGR só opera em empresa com o serviço PGR
 * habilitado (NOB-97: empresas novas começam sem módulos; só o administrador habilita). A tela
 * precisa distinguir erro de carga, ausência de empresas e empresas sem o serviço, em vez de
 * mostrar só um seletor vazio.
 */
type CompanyRef = { id: string; razaoSocial: string };

export type PgrCompanyAvailability =
  | { state: "error" }
  | { state: "no_companies" }
  | { state: "none_enabled"; withoutPgr: CompanyRef[] }
  | { state: "ready"; withoutPgr: CompanyRef[] };

/** `null` = falha ao carregar a lista. As duas listas vêm do mesmo tenant e da mesma sessão. */
export function pgrCompanyAvailability(
  allCompanies: CompanyRef[] | null,
  eligible: CompanyRef[] | null,
): PgrCompanyAvailability {
  if (!allCompanies || !eligible) return { state: "error" };
  if (allCompanies.length === 0) return { state: "no_companies" };
  const enabled = new Set(eligible.map((c) => c.id));
  const withoutPgr = allCompanies
    .filter((c) => !enabled.has(c.id))
    .map(({ id, razaoSocial }) => ({ id, razaoSocial }));
  return eligible.length === 0
    ? { state: "none_enabled", withoutPgr }
    : { state: "ready", withoutPgr };
}
