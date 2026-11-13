import { formatCivilDate } from "@/shared/dates";

import type { CategoryType } from "./validation";

export type CaEntrySubject = {
  type: CategoryType;
  ca: string | null;
  caValidUntil: string | null;
};

export type CaEntryBlockReason = "ca_missing" | "ca_expired";

export type CaEntryDecision =
  | { allowed: true }
  | { allowed: false; reason: CaEntryBlockReason; message: string };

const ALLOWED: CaEntryDecision = { allowed: true };

const CA_MISSING: CaEntryDecision = {
  allowed: false,
  reason: "ca_missing",
  message:
    "Informe o CA e a validade do CA no cadastro do EPI antes de registrar a entrada no estoque.",
};

export function evaluateCaForStockEntry(
  subject: CaEntrySubject,
  today: string,
): CaEntryDecision {
  if (subject.type !== "epi") return ALLOWED;
  if (!subject.ca || !subject.caValidUntil) return CA_MISSING;
  if (subject.caValidUntil >= today) return ALLOWED;
  return {
    allowed: false,
    reason: "ca_expired",
    message: `CA ${subject.ca} vencido em ${formatCivilDate(subject.caValidUntil, "br")}. EPI com CA vencido não pode entrar no estoque.`,
  };
}
