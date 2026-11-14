export const READ_ONLY_MESSAGE =
  "Apenas o administrador contrata. Você consulta as ofertas, mas a contratação é feita pelo administrador do escritório.";

export type PaymentState = "released" | "processing" | "pending";

type BillingFacts = {
  checkout: { status: string } | null;
  entitlements: readonly { status: string }[];
};

export function paymentState(billing: BillingFacts): PaymentState {
  if (billing.entitlements.some((right) => right.status === "active")) return "released";
  if (billing.checkout?.status === "completed") return "processing";
  return "pending";
}
