"use client";

import { Button } from "../../../_ui/button";
import { FormError } from "../../../_ui/form";
import { useContractAttempt } from "./use-contract-attempt";

export function ResumeCheckoutButton({ contractId }: { contractId: string }) {
  const attempt = useContractAttempt(contractId);
  return (
    <div className="flex flex-col gap-2">
      <FormError message={attempt.error} />
      <Button
        label="Retomar pagamento"
        pendingLabel="Abrindo pagamento…"
        pending={attempt.pending}
        onClick={() => attempt.submit(null)}
      />
    </div>
  );
}
