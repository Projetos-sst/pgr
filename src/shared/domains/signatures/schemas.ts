import { z } from "zod";

import { DEFAULT_SIGNATURE_TTL_SECONDS } from "./token";
import { SIGNATURE_TARGET_TYPES } from "./contract";

const SIGNER_NAME_MAX = 120;

// Limite fixo de tamanho do data-URL contra abuso/DoS. ~256 KB de PNG ≈ 350k
// chars em base64 (≈4/3). Assinaturas reais ficam em 5–50 KB (briefing).
const IMAGE_DATA_URL_MAX = 350_000;
const PNG_DATA_URL_PREFIX = "data:image/png;base64,";

export const createSignatureRequestSchema = z.object({
  targetType: z.enum(SIGNATURE_TARGET_TYPES),
  targetId: z.string().uuid().optional(),
  // O payload é validado pelo payloadSchema do target_type (registry) na action.
  payload: z.unknown(),
  ttlSeconds: z.number().int().positive().default(DEFAULT_SIGNATURE_TTL_SECONDS),
});

export type CreateSignatureRequestInput = z.input<typeof createSignatureRequestSchema>;
export type CreateSignatureRequestValues = z.output<typeof createSignatureRequestSchema>;

export const publicSignatureSchema = z.object({
  signerName: z.string().trim().min(1, "Nome é obrigatório").max(SIGNER_NAME_MAX),
  imageDataUrl: z
    .string()
    .max(IMAGE_DATA_URL_MAX, "Imagem excede o tamanho máximo.")
    .refine((v) => v.startsWith(PNG_DATA_URL_PREFIX), "Imagem inválida."),
});

export type PublicSignatureInput = z.input<typeof publicSignatureSchema>;
export type PublicSignatureValues = z.output<typeof publicSignatureSchema>;

export const signManuallySchema = z.object({
  signerName: z.string().trim().min(1, "Nome é obrigatório").max(SIGNER_NAME_MAX),
});

export type SignManuallyInput = z.input<typeof signManuallySchema>;
export type SignManuallyValues = z.output<typeof signManuallySchema>;
