import { createHash } from "node:crypto";

import { canonicalPgrDocxTexts, type PgrDocxStoredOverrides } from "./text-overrides";

export function pgrDocxTextsSha256(overrides: PgrDocxStoredOverrides): string {
  return createHash("sha256").update(canonicalPgrDocxTexts(overrides)).digest("hex");
}
