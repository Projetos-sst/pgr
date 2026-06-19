import type { Plan } from "./active-tenant";

export function isTeamManagementAvailable(plan: Plan): boolean {
  return plan === "pro";
}
