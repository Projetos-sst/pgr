import "server-only";
import { createHash } from "node:crypto";
import { getPgrGenerationSnapshot } from "@/shared/db/repositories/pgr-generation-snapshot";
import { requiredUuid } from "@/shared/domains/pgr/form-fields";
import { checkPgrReadiness } from "@/shared/domains/pgr/pgr-readiness";
import { pgrDocxTextsSha256 } from "@/shared/domains/pgr/pgr-docx/texts-hash";
import { NotFoundError } from "@/shared/errors/not-found-error";
export function pgrSnapshotHash(
  snapshot: NonNullable<Awaited<ReturnType<typeof getPgrGenerationSnapshot>>>,
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        consolidated: snapshot.consolidated,
        extras: snapshot.extras,
        classificationBands: snapshot.methodology.classificationBands,
        textsSha256: pgrDocxTextsSha256(snapshot.textVersion?.overrides ?? {}),
      }),
    )
    .digest("hex");
}
export async function getPgrReadiness(orgId: string, pgrId: string) {
  const id = requiredUuid("PGR inválido.").parse(pgrId);
  const snapshot = await getPgrGenerationSnapshot(orgId, id);
  if (!snapshot) throw new NotFoundError();
  return {
    ...checkPgrReadiness(
      snapshot.consolidated,
      snapshot.extras,
      snapshot.methodology.classificationBands,
    ),
    sourceSha256: pgrSnapshotHash(snapshot),
  };
}
