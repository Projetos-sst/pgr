import Link from "next/link";

import { EmptyState } from "../../_ui/list";

/**
 * Vazio "nenhuma empresa com Medicina habilitada" — texto por papel: só o owner
 * habilita serviços (`changeCompanyModule`), então só ele recebe o atalho para
 * Empresas; o collaborator é orientado a pedir ao administrador.
 */
export function MedicineEmptyState({ role, isFlat }: { role: string; isFlat?: boolean }) {
  const isOwner = role === "owner";
  return (
    <EmptyState
      isFlat={isFlat}
      title="Nenhuma empresa com Medicina do Trabalho habilitada"
      message={
        isOwner
          ? "Habilite a Medicina em Empresas → Serviços para acompanhar os exames dos funcionários."
          : "Peça ao administrador do escritório para habilitar a Medicina do Trabalho em uma empresa."
      }
      action={
        isOwner ? (
          <Link
            href="/companies"
            className="btn-primary inline-flex h-11 items-center rounded-xl px-[18px] text-[13px] font-bold transition-colors"
          >
            Ir para Empresas
          </Link>
        ) : undefined
      }
    />
  );
}
