"use client";

import { usePathname } from "next/navigation";

import { PortalFooter } from "./portal-footer";
import { PORTAL_ROUTES } from "./routes";

/**
 * Escolhe a variante do rodapé pela rota.
 *
 * A prancha "Solicitar orçamento" tem um rodapé reduzido; as demais, o
 * completo. O layout é Server Component e não conhece a rota, então a seleção
 * mora aqui — um client component mínimo, sem estado.
 */
export function PortalFooterSlot() {
  const pathname = usePathname();
  const compacto = pathname === PORTAL_ROUTES.orcamento;
  return <PortalFooter variante={compacto ? "compacto" : "completo"} />;
}
