/** Caminho da rota pública de assinatura. */
export function publicSignaturePath(token: string): string {
  return `/assinar/${token}`;
}

/**
 * URL pública absoluta (embutida no link/QR). Usa `NEXT_PUBLIC_APP_URL` quando
 * disponível; caso contrário cai no caminho relativo (suficiente em dev/demo).
 */
export function buildPublicSignatureUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  return `${base}${publicSignaturePath(token)}`;
}
