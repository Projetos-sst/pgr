import { getCommercialSubscriptionSheetAction } from "@/shared/server/actions/commercial/commercial";

import { FormError } from "../../../_ui/form";
import { messageFor } from "./format";
import { SubscriptionSheetView } from "./subscription-sheet";

export async function SubscriptionLoader() {
  const result = await getCommercialSubscriptionSheetAction();
  if (!result.ok) return <FormError message={messageFor("contract", result.error)} />;
  return <SubscriptionSheetView sheet={result.data} />;
}
