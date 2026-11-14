"use client";

import { useRef, useState, useTransition } from "react";

import { createCommercialPortalSessionAction } from "@/shared/server/actions/commercial/commercial";

import { Button } from "../../../_ui/button";
import { FormError } from "../../../_ui/form";
import { messageFor } from "./format";
import { redirectTo } from "./redirect";

export function PortalButton({ contractId }: { contractId: string }) {
  const busy = useRef(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const open = () => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    startTransition(async () => {
      const result = await createCommercialPortalSessionAction(contractId);
      if (result.ok) {
        redirectTo(result.data.url);
        return;
      }
      busy.current = false;
      setError(messageFor("contract", result.error));
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <FormError message={error} />
      <Button
        label="Gerenciar pagamento"
        pendingLabel="Abrindo o portal…"
        pending={pending}
        onClick={open}
      />
    </div>
  );
}
