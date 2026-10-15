"use server";

import { revalidatePath } from "next/cache";

import { officeAction } from "@/shared/server/office-action";
import type { ActionResult } from "@/shared/server/result";
import {
  esocialConfigInputSchema,
  type EsocialConfigInput,
  type EsocialEventCounts,
} from "@/shared/domains/esocial/config";
import * as repo from "@/shared/db/repositories/esocial-config";
import type { EsocialConfig } from "@/shared/db/schema";

const BASE_PATH = "/esocial/config";

export async function getEsocialConfigAction(): Promise<
  ActionResult<EsocialConfig | null>
> {
  return officeAction("esocial.config.get", ({ tenantId }) =>
    repo.getEsocialConfig(tenantId),
  );
}

export async function getEsocialEventCountsAction(): Promise<
  ActionResult<EsocialEventCounts>
> {
  return officeAction("esocial.config.event_counts", ({ tenantId }) =>
    repo.getEsocialEventCounts(tenantId),
  );
}

export async function saveEsocialConfigAction(
  input: EsocialConfigInput,
): Promise<ActionResult<EsocialConfig>> {
  return officeAction(
    "esocial.config.save",
    async ({ tenantId }) => {
      const data = esocialConfigInputSchema.parse(input);
      const config = await repo.upsertEsocialConfig(tenantId, data);
      revalidatePath(BASE_PATH);
      return config;
    },
    { audit: true },
  );
}
