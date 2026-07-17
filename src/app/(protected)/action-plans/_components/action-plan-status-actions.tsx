"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  ACTION_PLAN_STATUS_LABELS,
  canTransitionActionPlan,
  type ActionPlanStatus,
} from "@/shared/domains/safety/action-plan";
import { setActionPlanStatusAction } from "@/shared/server/actions/safety/action-plans";

const ALL = Object.keys(ACTION_PLAN_STATUS_LABELS) as ActionPlanStatus[];

export function ActionPlanStatusActions({
  id,
  current,
}: {
  id: string;
  current: ActionPlanStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const targets = ALL.filter((s) => s !== current && canTransitionActionPlan(current, s));
  if (targets.length === 0) return null;

  function change(status: ActionPlanStatus) {
    startTransition(async () => {
      const result = await setActionPlanStatusAction(id, { status });
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
            {ACTION_PLAN_STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
