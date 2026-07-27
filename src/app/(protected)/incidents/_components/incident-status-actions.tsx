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

import { rowActionClass, rowActionDangerClass } from "../../_ui/row-actions";

/**
 * `labels` (padrão) para a tela de detalhe, onde alterar status é a ação central;
 * `icons` para a coluna "Opções" das listagens, que é só-ícone por convenção
 * (ver `_ui/row-actions.tsx`) e não comporta botões com texto.
 */
type Variant = "labels" | "icons";

export function IncidentStatusActions({
  id,
  current,
  variant = "labels",
}: {
  id: string;
  current: IncidentStatus;
  variant?: Variant;
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

  const errorMessage = error ? (
    <span role="alert" className="text-danger text-xs font-semibold">
      {error}
    </span>
  ) : null;

  if (variant === "icons") {
    return (
      <>
        {targets.map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending}
            onClick={() => change(s)}
            aria-label={INCIDENT_STATUS_LABELS[s]}
            title={INCIDENT_STATUS_LABELS[s]}
            className={`${s === "cancelled" ? rowActionDangerClass : rowActionClass} disabled:opacity-50`}
          >
            <StatusIcon target={s} />
          </button>
        ))}
        {errorMessage}
      </>
    );
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
            className="glass-panel text-text-muted rounded-card hover:text-text flex items-center gap-2 px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <StatusIcon target={s} />
            {INCIDENT_STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      {errorMessage}
    </div>
  );
}

/**
 * Ícone por transição — a coluna "Opções" das listagens é só-ícone (o rótulo vive
 * em `aria-label`/`title`), então o desenho precisa distinguir avançar de
 * concluir e de cancelar.
 */
function StatusIcon({ target }: { target: IncidentStatus }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {target === "cancelled" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 9l6 6M15 9l-6 6" />
        </>
      ) : target === "completed" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 12.5l2.5 2.5 4.5-5" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M10 8l4 4-4 4" />
        </>
      )}
    </svg>
  );
}
