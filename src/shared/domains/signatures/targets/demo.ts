import { z } from "zod";

/**
 * Payload do consumidor de demonstração (`target_type: 'demo'`). É o que o
 * formulário público exibe ao signatário. Server-safe (sem React): pode ser
 * importado pela Server Action para validação.
 */
export const demoPayloadSchema = z.object({
  title: z.string().trim().min(1, "Título é obrigatório").max(200),
  description: z.string().trim().max(2000).optional(),
});

export type DemoPayload = z.infer<typeof demoPayloadSchema>;
