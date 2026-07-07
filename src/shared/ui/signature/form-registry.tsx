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

/**
 * Ponto de entrada para Server Components: o lookup no registry PRECISA rodar
 * dentro de um módulo client — importado num Server Component, o objeto acima
 * vira client reference proxy e a indexação devolve `undefined`.
 */
export function PublicSignatureForm({
  targetType,
  token,
  payload,
}: PublicFormProps & { targetType: SignatureTargetType }) {
  const Form = signatureFormRegistry[targetType];
  return <Form token={token} payload={payload} />;
}
