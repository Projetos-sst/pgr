"use client";

import type { SignatureTargetType } from "@/shared/domains/signatures/contract";

import { DemoSignatureForm } from "./DemoSignatureForm";

export type PublicFormProps = { token: string; payload: unknown };

/**
 * Registry de renderizadores de formulário público por `target_type`. Plugar um
 * novo consumidor = +1 entrada aqui (+ payloadSchema no contract), zero mudança de
 * schema. Mantém componentes client fora da Server Action.
 */
export const signatureFormRegistry: Record<
  SignatureTargetType,
  (props: PublicFormProps) => React.ReactNode
> = {
  demo: DemoSignatureForm,
};
