"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  addRequiredTrainingAction,
  removeRequiredTrainingAction,
} from "@/shared/server/actions/pgr/job-role-required-trainings";
import {
  trainingPeriodicityLabel,
  type RequiredTrainingRow,
  type TrainingCatalogOption,
} from "@/shared/domains/pgr/trainings";

/**
 * Gestão função → treinamentos obrigatórios (US4). O add é idempotente no
 * servidor (UNIQUE por par); o select só oferece itens ainda não vinculados.
 */
export function RequiredTrainings({
  jobRoleId,
  links,
  options,
}: {
  jobRoleId: string;
  links: RequiredTrainingRow[];
  options: TrainingCatalogOption[];
}) {
  const router = useRouter();
  const [trainingId, setTrainingId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const availableOptions = useMemo(() => {
    const linked = new Set(links.map((link) => link.trainingId));
    return options.filter((option) => !linked.has(option.id));
  }, [links, options]);

  function handleAdd() {
    if (!trainingId) return;
    startTransition(async () => {
      const result = await addRequiredTrainingAction({ jobRoleId, trainingId });
      if (result.ok) {
        setTrainingId("");
        setError(null);
        router.refresh();
        return;
      }
      setError(result.error.message);
    });
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      const result = await removeRequiredTrainingAction(id);
      if (result.ok) {
        setError(null);
        router.refresh();
        return;
      }
      setError(result.error.message);
    });
  }

  return (
    <section className="glass-card flex flex-col gap-4 p-4">
      <h2 className="text-text text-lg font-semibold">Treinamentos obrigatórios</h2>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex items-end gap-2">
        <label className="flex w-full max-w-xs flex-col gap-1 text-sm">
          <span className="text-text-muted font-semibold">Adicionar obrigatório</span>
          <select
            value={trainingId}
            onChange={(event) => setTrainingId(event.target.value)}
            className="glass-input text-text rounded-card px-3 py-2 text-sm outline-none"
          >
            <option value="">
              {availableOptions.length === 0
                ? "— nenhum treinamento disponível —"
                : "— selecione —"}
            </option>
            {availableOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} ({trainingPeriodicityLabel(option.periodicity)})
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={handleAdd}
          disabled={pending || !trainingId}
          className="glass-panel text-text-muted rounded-card hover:text-text px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          Adicionar
        </button>
      </div>

      {links.length === 0 ? (
        <p className="glass-card text-text-subtle px-4 py-6 text-center text-sm">
          Nenhum treinamento obrigatório para esta função.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-white/50">
          {links.map((link) => (
            <li key={link.id} className="flex items-center justify-between gap-4 py-2">
              <span className="text-sm">
                {link.trainingName}{" "}
                <span className="text-text-subtle">
                  ({trainingPeriodicityLabel(link.periodicity)})
                </span>
              </span>
              <button
                type="button"
                onClick={() => handleRemove(link.id)}
                disabled={pending}
                className="rounded-card border border-red-300 px-3 py-1 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
