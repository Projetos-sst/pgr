/** Estados persistidos do pedido (espelha o enum `signature_request_status`). */
export type SignatureStatusValue = "pending" | "signed" | "cancelled";

/** Métodos de captura (espelha o enum `signature_method`). */
export type SignatureMethodValue = "qr" | "link" | "manual";

/** Status exposto na leitura: inclui `expired` (derivado, não persistido). */
export type SignatureStatusView = "pending" | "signed" | "expired" | "cancelled";

/** Estado da rota pública ao resolver um token. */
export type PublicSignatureState =
  | { kind: "signable"; requestId: string; targetType: string; payload: unknown }
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "used" };
