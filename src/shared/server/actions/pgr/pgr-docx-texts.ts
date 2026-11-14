"use server";
import { revalidatePath } from "next/cache";
import { officeAction } from "@/shared/server/office-action";
import * as core from "@/shared/server/pgr/pgr-docx-texts-core";
import type { PageParams } from "@/shared/pagination";

export async function listPgrDocxTextVersionsAction(
  pgrId: string,
  page: PageParams = {},
) {
  return officeAction("pgr.docx_texts.list", (ctx) =>
    core.listPgrDocxTextVersions(ctx, pgrId, page),
  );
}

export async function savePgrDocxTextVersionAction(pgrId: string, input: unknown) {
  return officeAction(
    "pgr.docx_texts.save",
    async (ctx) => {
      const row = await core.savePgrDocxTextVersion(ctx, pgrId, input);
      revalidatePath(`/pgr/${pgrId}/texts`);
      revalidatePath(`/pgr/${pgrId}/reviews`);
      return { id: row.id, version: row.version, textsSha256: row.textsSha256 };
    },
    { audit: true },
  );
}
