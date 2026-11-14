import type {
  EntitlementService,
  EntitlementStatus,
  EntitlementTarget,
} from "./billing-model";
import type { CommercialService } from "./offer";

const TARGETS_BY_SERVICE: Record<
  CommercialService,
  (companyIds: readonly string[]) => EntitlementTarget[]
> = {
  pro: () => [{ companyId: null, service: "pro" }],
  pgr: (companyIds) => companyIds.map((companyId) => ({ companyId, service: "pgr" })),
  medicine: (companyIds) =>
    companyIds.map((companyId) => ({ companyId, service: "medicine" })),
  one_off: () => [],
};

export function contractTargets(contract: {
  items: readonly { service: CommercialService }[];
  companyIds: readonly string[];
}): EntitlementTarget[] {
  const services = [...new Set(contract.items.map((item) => item.service))].sort();
  const companyIds = [...contract.companyIds].sort();
  return services.flatMap((service) => TARGETS_BY_SERVICE[service](companyIds));
}

export type EntitlementState = { status: EntitlementStatus; reason: string };
export type StoredEntitlement = EntitlementState & { id: string };
export type EntitlementChange = StoredEntitlement & { statusChanged: boolean };

export function entitlementChanges(
  current: readonly StoredEntitlement[],
  access: { granted: boolean; reason: string },
): EntitlementChange[] {
  const status: EntitlementStatus = access.granted ? "active" : "inactive";
  return current
    .filter((row) => row.status !== status || row.reason !== access.reason)
    .map((row) => ({
      id: row.id,
      status,
      reason: access.reason,
      statusChanged: row.status !== status,
    }));
}

export type { EntitlementService, EntitlementTarget };
