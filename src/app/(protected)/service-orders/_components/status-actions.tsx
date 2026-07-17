"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  canTransitionServiceOrder,
  SERVICE_ORDER_STATUS_LABELS,
  type ServiceOrderStatus,
} from "@/shared/domains/safety/service-order";
import { setServiceOrderStatusAction } from "@/shared/server/actions/safety/service-orders";

const ALL_STATUSES = Object.keys(SERVICE_ORDER_STATUS_LABELS) as ServiceOrderStatus[];

export function StatusActions({
  id,
  current,
}: {
  id: string;
  current: ServiceOrderStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const targets = ALL_STATUSES.filter(
    (s) => s !== current && canTransitionServiceOrder(current, s),
  );
  if (targets.length === 0) return null;

  function change(status: ServiceOrderStatus) {
    startTransition(async () => {
      const result = await setServiceOrderStatusAction(id, status);
      if (result.ok) router.refresh();
      else setError(result.error.message);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {targets.map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending}
            onClick={() => change(s)}
            className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {SERVICE_ORDER_STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
