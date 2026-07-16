import { z } from "zod";

import { optionalString } from "./form-fields";

/**
 * Domínio das revisões do PGR — issue #27 / fatia 022. Espelha `pgr_revisions`
 * (migration `0012`, UNIQUE `(org_id, pgr_id, revision_number)`). **Zero migration.**
 * **Append-only** (só list/create) e **sem autor** persistido (a tabela não tem coluna de
 * autor — o ator fica no log de auditoria).
 *
 * **Contrato server-side (fatia 022)**: o `revision_number` é calculado **exclusivamente no
 * servidor** (`MAX+1` sob lock). O input é **estrito** e **NÃO** aceita `revisionNumber` —
 * enviá-lo (cliente desatualizado) resulta em `VALIDATION`/422, e não em silêncio. A UNIQUE
 * permanece como backstop defensivo (colisão inesperada → `DUPLICATE`/409).
 */

export type { PgrRevision } from "@/shared/db/schema/pgr";

export const pgrRevisionInputSchema = z
  .object({
    revisedAt: z.iso.date("Data da revisão inválida (use AAAA-MM-DD)"),
    notes: optionalString,
  })
  .strict();

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
