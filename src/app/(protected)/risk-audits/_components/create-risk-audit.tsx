"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ORIGIN_TYPE_LABELS } from "@/shared/domains/safety/action-plan-origin";
import { createRiskAuditAction } from "@/shared/server/actions/safety/risk-audits";

type Option = { value: string; label: string };

const inputClass = "glass-input text-text rounded-card px-3 py-2 text-sm outline-none";

/**
 * Criação de auditoria a partir de um risco ou incidente do escritório. A origem é validada
 * no servidor; uma auditoria ativa por origem (`IN_USE`) e origem inválida (`FK_NOT_FOUND`)
 * retornam mensagem clara.
 */
export function CreateRiskAudit({
  riskOptions,
  incidentOptions,
}: {
  riskOptions: Option[];
  incidentOptions: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [originType, setOriginType] = useState<"risk" | "incident">("risk");
  const [originId, setOriginId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const options = originType === "risk" ? riskOptions : incidentOptions;

  function onSubmit() {
    if (!originId) {
      setError("Selecione a origem da auditoria.");
      return;
    }
    startTransition(async () => {
      const result = await createRiskAuditAction({ originType, originId });
      if (result.ok) {
        setError(null);
        setOriginId("");
        router.refresh();
      } else {
        setError(result.error.message);
      }
    });
  }

  return (
    <div className="glass-card flex flex-col gap-3 p-4">
      <span className="text-text text-sm font-semibold">Nova auditoria</span>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-xs font-semibold">Tipo de origem</span>
          <select
            value={originType}
            onChange={(e) => {
              setOriginType(e.target.value as "risk" | "incident");
              setOriginId("");
            }}
            className={inputClass}
          >
            <option value="risk">{ORIGIN_TYPE_LABELS.risk}</option>
            <option value="incident">{ORIGIN_TYPE_LABELS.incident}</option>
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-text-muted text-xs font-semibold">Origem</span>
          <select
            value={originId}
            onChange={(e) => setOriginId(e.target.value)}
            className={inputClass}
          >
            <option value="">— selecione —</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={onSubmit}
          className="btn-primary rounded-pill px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Criar auditoria
        </button>
      </div>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
