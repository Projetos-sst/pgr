import type { ZodType } from "zod";

import { demoPayloadSchema } from "./targets/demo";
import { inspectionPayloadSchema } from "./targets/inspection";
import { pgrSignaturePayloadSchema } from "./targets/pgr";

/**
 * Tipos de alvo suportados. Cresce ao registrar novos consumidores — adicionar
 * um novo módulo é +1 entrada no registry, **zero mudança de schema** (o banco
 * armazena `target_type`/`target_id`/`payload` genéricos).
 */
export const SIGNATURE_TARGET_TYPES = ["demo", "inspection", "pgr"] as const;
export type SignatureTargetType = (typeof SIGNATURE_TARGET_TYPES)[number];

export type TargetRegistryEntry = {
  /** Valida o `payload` na criação (Server Action) e na exibição pública. */
  payloadSchema: ZodType;
};

/**
 * Registry server-safe (apenas schemas de payload, sem React). O renderizador de
 * formulário de cada tipo vive na camada de UI (`ui/signature/form-registry`),
 * que importa este contrato — mantém a Server Action livre de componentes client.
 */
export const signatureTargetRegistry: Record<SignatureTargetType, TargetRegistryEntry> = {
  demo: { payloadSchema: demoPayloadSchema },
  inspection: { payloadSchema: inspectionPayloadSchema },
  pgr: { payloadSchema: pgrSignaturePayloadSchema },
};

export function isSignatureTargetType(value: string): value is SignatureTargetType {
  return (SIGNATURE_TARGET_TYPES as readonly string[]).includes(value);
}

export function getPayloadSchema(targetType: SignatureTargetType): ZodType {
  return signatureTargetRegistry[targetType].payloadSchema;
}
