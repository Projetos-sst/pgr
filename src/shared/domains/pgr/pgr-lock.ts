import type { PgrSignatureState } from "./pgr-signature";

/**
 * Regra de trava do PGR. Mora em módulo próprio (e não em `pgr-signature.ts`) porque a UI a
 * consome: aquele módulo alcança `node:crypto` pela cadeia de import do token de assinatura,
 * e puxá-lo para um componente cliente quebraria o bundle.
 *
 * Um PGR assinado ou publicado é documento fechado — o que está assinado precisa continuar
 * correspondendo ao que o responsável técnico assinou; mudança posterior entra como nova
 * revisão, não como edição da versão assinada. Publicação é irreversível: uma solicitação de
 * assinatura posterior expirar ou ser cancelada não reabre um documento já publicado.
 *
 * Regra única das duas superfícies de escrita (Server Action e REST) e da UI — o cliente
 * apenas *reflete* este predicado; quem o **impõe** é o servidor (`assertPgrEditable`).
 */
export function isPgrEditLocked(input: {
  signatureState: PgrSignatureState;
  publishedAt: Date | string | null;
}): boolean {
  return input.signatureState === "signed" || input.publishedAt !== null;
}
