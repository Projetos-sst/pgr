import { getCommercialPlansOverviewAction } from "@/shared/server/actions/commercial/commercial";

import { FormError } from "../../../_ui/form";
import { CommercialPlansSection } from "./commercial-plans-section";
import { messageFor, type CheckoutReturn } from "./format";

export async function CommercialPlansLoader({
  tenantId,
  checkoutReturn,
}: {
  tenantId: string;
  checkoutReturn: CheckoutReturn | null;
}) {
  const result = await getCommercialPlansOverviewAction();
  if (!result.ok) return <FormError message={messageFor("contract", result.error)} />;
  return (
    <CommercialPlansSection
      key={tenantId}
      overview={result.data}
      checkoutReturn={checkoutReturn}
    />
  );
}
