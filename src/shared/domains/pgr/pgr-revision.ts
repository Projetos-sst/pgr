import { z } from "zod";

import { optionalString } from "./form-fields";

/**
 * Domínio das revisões do PGR — issue #27. Espelha `pgr_revisions` (migration `0012`,
 * UNIQUE `(org_id, pgr_id, revision_number)`). **Zero migration.** **Append-only**
 * (só list/create) e **sem autor** persistido (a tabela não tem coluna de autor — o ator
 * fica no log de auditoria). Número de revisão duplicado → `DUPLICATE`/409.
 */

export type { PgrRevision } from "@/shared/db/schema/pgr";

/** Número da revisão: inteiro ≥ 1 (coerção string→número para form e REST-JSON). */
const revisionNumberField = z.coerce
  .number({ error: "Número da revisão é obrigatório" })
  .int("Número da revisão deve ser um inteiro")
  .min(1, "Número da revisão deve ser maior ou igual a 1");

export const pgrRevisionInputSchema = z.object({
  revisionNumber: revisionNumberField,
  revisedAt: z.iso.date("Data da revisão inválida (use AAAA-MM-DD)"),
  notes: optionalString,
});

export type PgrRevisionInput = z.input<typeof pgrRevisionInputSchema>;
export type PgrRevisionValues = z.output<typeof pgrRevisionInputSchema>;

/** Projeção da aba Revisões. `revisedAt` string ("AAAA-MM-DD"); `createdAt` Date. */
export type PgrRevisionListItem = {
  id: string;
  revisionNumber: number;
  revisedAt: string;
  notes: string | null;
  createdAt: Date;
};
