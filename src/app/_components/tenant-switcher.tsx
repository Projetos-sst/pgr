import { getTenantSwitcher } from "@/shared/tenant/switcher";

import { TenantSwitcherMenu } from "./tenant-switcher-menu";

/**
 * Seletor de organização ativa (Modelo B / 005): lista TODAS as memberships —
 * a org pessoal DB-only e as do Clerk como colaborador. Renderiza nada quando
 * não há sessão/tenant (ex.: visitante), então é seguro no header global.
 */
export async function TenantSwitcher() {
  const data = await getTenantSwitcher();
  if (!data) return null;

  return <TenantSwitcherMenu options={data.options} canSwitch={data.canSwitch} />;
}
