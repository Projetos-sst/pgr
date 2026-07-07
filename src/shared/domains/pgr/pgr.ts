import { z } from "zod";

import { optionalString, optionalUuid, requiredUuid } from "./form-fields";
import {
  pgrRegistrationTypeSchema,
  pgrRegistrationTypeLabel,
  type PgrRegistrationType,
} from "./risks";

export type { Pgr } from "@/shared/db/schema/pgr";
export { pgrRegistrationTypeLabel, pgrRegistrationTypeSchema };
export type { PgrRegistrationType };

/** Data ISO (AAAA-MM-DD) obrigatória, validada no calendário (rejeita 2026-13-45). */
const requiredIsoDate = (message: string) => z.iso.date(message);

/** Campos persistidos do documento PGR (sem o aceite da declaração). */
const pgrBaseObject = z.object({
  companyId: requiredUuid("Empresa é obrigatória"),
  workUnitId: optionalUuid,
  responsible: optionalString,
  registrationType: pgrRegistrationTypeSchema,
  registrationNumber: optionalString,
  issuedAt: requiredIsoDate("Data de emissão é obrigatória"),
  validUntil: requiredIsoDate("Data de validade é obrigatória"),
});

/**
 * Regras cross-field compartilhadas entre criação e edição:
 * - número de registro obrigatório para CRM/CREA/MTE e proibido para "não aplicável";
 * - validade não pode ser anterior à emissão (comparação lexicográfica de AAAA-MM-DD).
 */
function refinePgr(data: z.infer<typeof pgrBaseObject>, ctx: z.RefinementCtx): void {
  const needsNumber = data.registrationType !== "not_applicable";
  if (needsNumber && !data.registrationNumber) {
    ctx.addIssue({
      path: ["registrationNumber"],
      code: "custom",
      message: "Número de registro é obrigatório para CRM/CREA/MTE",
    });
  }
  if (!needsNumber && data.registrationNumber) {
    ctx.addIssue({
      path: ["registrationNumber"],
      code: "custom",
      message: "Número de registro não se aplica ao tipo selecionado",
    });
  }
  if (data.issuedAt && data.validUntil && data.validUntil < data.issuedAt) {
    ctx.addIssue({
      path: ["validUntil"],
      code: "custom",
      message: "Validade não pode ser anterior à emissão",
    });
  }
}

/** Schema de entrada da edição/persistência (corpo completo, sem aceite). */
export const pgrInputSchema = pgrBaseObject.superRefine(refinePgr);

/**
 * Schema de criação: exige o aceite da Declaração de Ciência de Riscos (NR-01) como
 * gate de servidor. `declarationAccepted` NÃO é persistido — a action/handler o remove
 * antes de chamar o repositório (a tabela `pgr` não tem coluna de aceite).
 */
export const pgrCreateSchema = pgrBaseObject
  .extend({
    declarationAccepted: z.literal(true, {
      error:
        "É necessário aceitar a Declaração de Ciência de Riscos (NR-01) para criar o PGR.",
    }),
  })
  .superRefine(refinePgr);

export type PgrInput = z.input<typeof pgrInputSchema>;
export type PgrValues = z.output<typeof pgrInputSchema>;
export type PgrCreateInput = z.input<typeof pgrCreateSchema>;

/** Projeção da listagem com nomes de empresa/obra resolvidos por join. */
export type PgrListItem = {
  id: string;
  companyId: string;
  companyName: string;
  workUnitId: string | null;
  workUnitName: string | null;
  responsible: string | null;
  registrationType: PgrRegistrationType;
  registrationNumber: string | null;
  issuedAt: string | null;
  validUntil: string | null;
};
