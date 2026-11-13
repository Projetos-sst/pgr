import "server-only";
import type { TenantContext } from "@/shared/auth/require-tenant-context";
import * as repo from "@/shared/db/repositories/pgr-docx-text-versions";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import {
  changedOverrides,
  pgrDocxTextVersionSchema,
} from "@/shared/domains/pgr/pgr-docx/text-overrides";
import type { PageParams } from "@/shared/pagination";
import { assertPgrEditable } from "./pgr-lock";
import { pgrDocxTextsSha256 } from "@/shared/domains/pgr/pgr-docx/texts-hash";

const pgrKey = (value: string) => requiredUuid("PGR inválido.").parse(value);

export async function listPgrDocxTextVersions(
  ctx: TenantContext,
  pgrId: string,
  page: PageParams = {},
) {
  const { rows, total, current } = await repo.listPgrDocxTextVersions(
    ctx,
    pgrKey(pgrId),
    page,
  );
  return {
    rows,
    total,
    currentOverrides: current?.overrides ?? {},
    currentTextsSha256: pgrDocxTextsSha256(current?.overrides ?? {}),
  };
}

export async function savePgrDocxTextVersion(
  ctx: TenantContext,
  pgrId: string,
  input: unknown,
) {
  const key = pgrKey(pgrId);
  const data = pgrDocxTextVersionSchema.parse(input);
  await assertPgrEditable(ctx.tenantId, key);
  const overrides = changedOverrides(data.overrides);
  return repo.insertPgrDocxTextVersion(ctx, key, {
    overrides,
    textsSha256: pgrDocxTextsSha256(overrides),
    reason: data.reason,
  });
}
