import { listCommercialInvoicesAction } from "@/shared/server/actions/commercial/commercial";

import { FormError } from "../../../_ui/form";
import { messageFor } from "./format";
import { InvoicesTable } from "./invoices-table";

export async function InvoicesLoader({ page }: { page: number }) {
  const result = await listCommercialInvoicesAction({ page });
  if (!result.ok) return <FormError message={messageFor("contract", result.error)} />;
  return <InvoicesTable rows={result.data.rows} total={result.data.total} page={page} />;
}
