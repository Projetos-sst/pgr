import { z } from "zod";

/**
 * Payload do consumidor de inspeção de segurança (`target_type: 'inspection'`,
 * fatia 039). É o que o formulário público mostra ao signatário (responsável /
 * fiscal). Server-safe (sem React) — importável pela Server Action.
 */
export const inspectionPayloadSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().max(60).optional(),
  area: z.string().trim().max(200).optional(),
  responsible: z.string().trim().max(200).optional(),
  inspectedAt: z.string().trim().max(20).optional(),
  occurrenceCount: z.number().int().min(0).optional(),
});

export type InspectionPayload = z.infer<typeof inspectionPayloadSchema>;
