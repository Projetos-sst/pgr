import "server-only";

import { eq, sql } from "drizzle-orm";

import type {
  EsocialConfigValues,
  EsocialEventCounts,
} from "@/shared/domains/esocial/config";

import { withOrg } from "../with-org";
import { esocialConfig, esocialEvents, type EsocialConfig } from "../schema";
import { auditedTenantWrite } from "./audited-write";

const AUDIT_OP = "esocial.config.write_rejected";

function toColumns(input: EsocialConfigValues) {
  return {
    environment: input.environment,
    employerCnpj: input.employerCnpj ?? null,
    taxClassification: input.taxClassification ?? null,
    certificateName: input.certificateName ?? null,
    certificateExpiresAt: input.certificateExpiresAt ?? null,
    enabledEvents: input.enabledEvents,
    autoSend: input.autoSend,
    checkFrequencyHours: input.checkFrequencyHours,
  };
}

/** Config do tenant (singleton). `null` quando ainda não houve primeiro salvamento. */
export async function getEsocialConfig(orgId: string): Promise<EsocialConfig | null> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select()
      .from(esocialConfig)
      .where(eq(esocialConfig.orgId, orgId))
      .limit(1);
    return row ?? null;
  });
}

/** Upsert do singleton por tenant (cria no 1º salvamento, atualiza depois). */
export async function upsertEsocialConfig(
  orgId: string,
  input: EsocialConfigValues,
): Promise<EsocialConfig> {
  return auditedTenantWrite(orgId, AUDIT_OP, () =>
    withOrg(orgId, async (tx) => {
      const cols = toColumns(input);
      const [row] = await tx
        .insert(esocialConfig)
        .values({ orgId, ...cols })
        .onConflictDoUpdate({
          target: esocialConfig.orgId,
          set: { ...cols, updatedAt: new Date() },
        })
        .returning();
      return row;
    }),
  );
}

/** Contagens reais de eventos para o resumo lateral (derivado, não fabricado). */
export async function getEsocialEventCounts(orgId: string): Promise<EsocialEventCounts> {
  return withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select({
        pending: sql<number>`count(*) filter (where ${esocialEvents.status} in ('draft','pending'))::int`,
        sent: sql<number>`count(*) filter (where ${esocialEvents.status} in ('sent','accepted'))::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(esocialEvents)
      .where(eq(esocialEvents.orgId, orgId));
    return row ?? { pending: 0, sent: 0, total: 0 };
  });
}
