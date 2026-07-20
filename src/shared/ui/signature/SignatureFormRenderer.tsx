"use client";

import type { SignatureTargetType } from "@/shared/domains/signatures/contract";

import { signatureFormRegistry } from "./form-registry";

/**
 * Fronteira Client dedicada para renderizar o formulário público (fatia 022). O
 * `signatureFormRegistry` vive num módulo `"use client"`; indexá-lo direto dentro do Server
 * Component da página `/signature-requests/[token]` fazia o componente resolver para `undefined` no boundary
 * RSC (Next 16 / React 19) → "Element type is invalid". Fazer o lookup + render **aqui**, no lado
 * Client, corrige isso para todos os `target_type` (`demo`, `pgr`, …).
 *
 * A página Server continua dona de resolver token/estado/payload; este componente **não** resolve
 * token nem toca no hash — só recebe o `payload` mínimo já validado e escolhe o formulário.
 */
export function SignatureFormRenderer({
  targetType,
  token,
  payload,
}: {
  targetType: SignatureTargetType;
  token: string;
  payload: unknown;
}) {
  const Form = signatureFormRegistry[targetType];
  return <Form token={token} payload={payload} />;
}
