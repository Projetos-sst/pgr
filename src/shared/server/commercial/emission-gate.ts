import "server-only";

import { isCommercialCatalogEnabledFor } from "@/shared/domains/commercial/offer";
import { emissionAccess } from "@/shared/domains/commercial/trial";
import { EmissionBlockedError } from "@/shared/errors/emission-blocked-error";

import { commercialEnvironment } from "./environment";

export async function assertPgrEmissionAllowed(input: {
  orgId: string;
  pgrId: string;
  now?: Date;
}): Promise<void> {
  if (!isCommercialCatalogEnabledFor(commercialEnvironment())) return;
  const { readEmissionFacts } =
    await import("@/shared/db/repositories/commercial-trials");
  const facts = await readEmissionFacts(input.orgId, input.pgrId);
  if (!facts) return;
  const access = emissionAccess({ ...facts, now: input.now ?? new Date() });
  if (!access.allowed) throw new EmissionBlockedError(access.reason);
}
