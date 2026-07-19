import { z } from "zod";

export type DocumentValidityStatus = "ok" | "due_soon" | "expired" | "no_expiry";

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Status de validade de um documento — derivado na leitura, nunca coluna
 * (espelho de `classifyTrainingStatus`, fatia 017). Date-only (`YYYY-MM-DD`,
 * comparação lexicográfica), fronteiras INCLUSIVAS: vence hoje → ainda não
 * vencido (`due_soon`); vence exatamente em hoje+janela → `due_soon`.
 */
export function classifyDocumentValidity(
  validUntil: string | null,
  { today, dueWindowDays }: { today: string; dueWindowDays: number },
): DocumentValidityStatus {
  if (validUntil === null) return "no_expiry";
  if (validUntil < today) return "expired";
  if (validUntil <= addDays(today, dueWindowDays)) return "due_soon";
  return "ok";
}

/**
 * Conjunto fechado dos tipos de entidade vinculável a um documento (FR-005).
 * Ampliar = adicionar o literal aqui — sem migration (o banco guarda texto).
 */
export const documentRelatedEntityTypeSchema = z.enum(["pgr"]);

export type DocumentRelatedEntityType = z.infer<typeof documentRelatedEntityTypeSchema>;
