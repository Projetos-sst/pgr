import { z } from "zod";

import { requiredUuid } from "./form-fields";

/**
 * Domínio do vínculo PGR ↔ GES — issue #27. Espelha `pgr_ges` (migration `0012`,
 * UNIQUE `(org_id, pgr_id, ges_id)`). **Zero migration.** O input só carrega `gesId`
 * (o `pgrId` vem da rota; o `orgId` da sessão). Duplicidade de vínculo → `DUPLICATE`/409.
 */

export const pgrGesInputSchema = z.object({
  gesId: requiredUuid("GES é obrigatório"),
});

export type PgrGesInput = z.input<typeof pgrGesInputSchema>;
export type PgrGesValues = z.output<typeof pgrGesInputSchema>;

/** Projeção da aba GES (vínculo + nome do GES resolvido por join). */
export type PgrGesLinkItem = {
  id: string;
  gesId: string;
  gesName: string;
  createdAt: Date;
};
