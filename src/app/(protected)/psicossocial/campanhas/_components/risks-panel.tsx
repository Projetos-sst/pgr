"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { PsychosocialRisk } from "@/shared/domains/psychosocial/campaigns";
import {
  deriveRisksAction,
  registerRiskInPgrAction,
} from "@/shared/server/actions/psychosocial/campaigns";

type Option = { value: string; label: string };

export function RisksPanel({
  campaignId,
  risks,
  gesOptions,
}: {
  campaignId: string;
  risks: PsychosocialRisk[];
  gesOptions: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [gesByRisk, setGesByRisk] = useState<Record<string, string>>({});

  function onDerive() {
    startTransition(async () => {
      const r = await deriveRisksAction(campaignId);
      if (r.ok) {
        setError(null);
        router.refresh();
      } else {
        setError(r.error.message);
      }
    });
  }

  function onRegister(riskId: string) {
    const gesId = gesByRisk[riskId];
    if (!gesId) {
      setError("Selecione o GES para registrar o risco no PGR.");
      return;
    }
    startTransition(async () => {
      const r = await registerRiskInPgrAction(campaignId, riskId, gesId);
      if (r.ok) {
        setError(null);
        router.refresh();
      } else {
        setError(r.error.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        disabled={pending}
        onClick={onDerive}
        className="w-fit rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Processando…" : "Derivar riscos das respostas"}
      </button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {risks.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Nenhum risco derivado ainda. Rode a derivação após coletar respostas.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {risks.map((risk) => (
            <li
              key={risk.id}
              className="flex flex-col gap-2 rounded-md border border-black/10 p-3 sm:flex-row sm:items-center dark:border-white/10"
            >
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {risk.factor} · nível {risk.level}
                </p>
                {risk.description ? (
                  <p className="text-xs text-zinc-500">{risk.description}</p>
                ) : null}
              </div>
              {risk.riskId ? (
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs text-green-800 dark:bg-green-950 dark:text-green-200">
                  Registrado no PGR
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={gesByRisk[risk.id] ?? ""}
                    onChange={(e) =>
                      setGesByRisk((p) => ({ ...p, [risk.id]: e.target.value }))
                    }
                    className="rounded-md border border-black/15 bg-white px-2 py-1 text-sm dark:border-white/15 dark:bg-zinc-900"
                  >
                    <option value="">— GES —</option>
                    {gesOptions.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onRegister(risk.id)}
                    className="rounded-md border border-black/15 px-3 py-1 text-sm disabled:opacity-50 dark:border-white/15"
                  >
                    Registrar no PGR
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
