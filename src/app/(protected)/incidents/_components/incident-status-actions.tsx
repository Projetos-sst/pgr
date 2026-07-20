"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  INCIDENT_STATUS_LABELS,
  nextIncidentStatuses,
  requiresJustification,
  type IncidentStatus,
} from "@/shared/domains/safety/incident-lifecycle";
import { setAccidentStatusAction } from "@/shared/server/actions/safety/accidents";

export function IncidentStatusActions({
  id,
  current,
}: {
  id: string;
  current: IncidentStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const targets = nextIncidentStatuses(current);
  if (targets.length === 0) return null;

  function change(status: IncidentStatus) {
    let justification: string | undefined;
    if (requiresJustification(status)) {
      const answer = window.prompt(
        "Informe a justificativa (obrigatória para concluir/cancelar):",
      );
      if (answer == null) return; // cancelou o prompt
      justification = answer;
    }
    startTransition(async () => {
      const result = await setAccidentStatusAction(id, { status, justification });
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
            {INCIDENT_STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
