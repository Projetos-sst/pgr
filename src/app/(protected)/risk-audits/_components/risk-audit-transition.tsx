"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  RISK_AUDIT_STATUS_LABELS,
  nextRiskAuditStatuses,
  requiresRiskAuditJustification,
  type RiskAuditStatus,
} from "@/shared/domains/safety/risk-audit";
import { setRiskAuditStatusAction } from "@/shared/server/actions/safety/risk-audits";

/**
 * Transição **explícita** do estado da auditoria (kanban). Nunca há persistência por
 * drag-and-drop: mover exige clicar num botão e, na conclusão, confirmar a justificativa.
 */
export function RiskAuditTransition({
  id,
  current,
}: {
  id: string;
  current: RiskAuditStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const targets = nextRiskAuditStatuses(current);
  if (targets.length === 0) return null;

  function change(status: RiskAuditStatus) {
    let justification: string | undefined;
    if (requiresRiskAuditJustification(status)) {
      const answer = window.prompt(
        "Informe a justificativa (obrigatória para concluir a auditoria):",
      );
      if (answer == null) return; // cancelou
      justification = answer;
    }
    startTransition(async () => {
      const result = await setRiskAuditStatusAction(id, { status, justification });
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
            className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            → {RISK_AUDIT_STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
