"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import {
  addRiskEpiAction,
  listAvailableEpisForRiskAction,
  listRiskEpisAction,
  removeRiskEpiAction,
  updateRiskEpiAction,
} from "@/shared/server/actions/pgr/epi-risk";
import {
  EPI_NEUTRALIZATION_ORDER,
  epiNeutralizationLabel,
  type EpiNeutralization,
  type EpiOption,
  type EpiRiskLinkItem,
} from "@/shared/domains/pgr/epi-risk";

const selectClass =
  "rounded-md border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-zinc-900";

export function EpiRiscoSection({ riskId }: { riskId: string }) {
  const [linked, setLinked] = useState<EpiRiskLinkItem[]>([]);
  const [available, setAvailable] = useState<EpiOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newCatalogId, setNewCatalogId] = useState("");
  const [newNeutralization, setNewNeutralization] =
    useState<EpiNeutralization>("neutralizes");
  const [pending, startTransition] = useTransition();

  const reload = useCallback(() => {
    startTransition(async () => {
      const [linkedResult, availableResult] = await Promise.all([
        listRiskEpisAction(riskId),
        listAvailableEpisForRiskAction(riskId),
      ]);
      if (linkedResult.ok) setLinked(linkedResult.data);
      if (availableResult.ok) setAvailable(availableResult.data);
    });
  }, [riskId]);

  useEffect(() => {
    reload();
  }, [reload]);

  function addLink() {
    if (!newCatalogId) return;
    setError(null);
    startTransition(async () => {
      const result = await addRiskEpiAction({
        riskId,
        catalogId: newCatalogId,
        neutralization: newNeutralization,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setNewCatalogId("");
      setNewNeutralization("neutralizes");
      reload();
    });
  }

  function saveNeutralization(id: string, neutralization: EpiNeutralization) {
    setError(null);
    startTransition(async () => {
      const result = await updateRiskEpiAction(id, riskId, { neutralization });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      reload();
    });
  }

  function removeLink(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeRiskEpiAction(id, riskId);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      reload();
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/10">
      <header>
        <h2 className="text-lg font-semibold">EPIs vinculados ao risco</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Indique, por EPI, se neutraliza o risco. Riscos sem EPI (controlados por medidas
          coletivas/administrativas) podem ficar sem nenhum vínculo.
        </p>
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {linked.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhum EPI vinculado a este risco.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-xs text-zinc-500 dark:border-white/10">
                <th className="py-2 pr-3 font-medium">Nome do EPI</th>
                <th className="py-2 pr-3 font-medium">CA</th>
                <th className="py-2 pr-3 font-medium">Neutraliza os Riscos?</th>
                <th className="py-2 font-medium">Opções</th>
              </tr>
            </thead>
            <tbody>
              {linked.map((item) => (
                <LinkedRow
                  key={item.id}
                  item={item}
                  pending={pending}
                  onSave={saveNeutralization}
                  onRemove={removeLink}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 border-t border-black/5 pt-4 dark:border-white/5">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Adicionar EPI</span>
          <select
            value={newCatalogId}
            onChange={(e) => setNewCatalogId(e.target.value)}
            className={selectClass}
          >
            <option value="">— selecione (busca por nome/CA) —</option>
            {available.map((opt) => (
              <option key={opt.catalogId} value={opt.catalogId}>
                {opt.name}
                {opt.ca ? ` — CA ${opt.ca}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Neutraliza os Riscos?</span>
          <select
            value={newNeutralization}
            onChange={(e) => setNewNeutralization(e.target.value as EpiNeutralization)}
            className={selectClass}
          >
            {EPI_NEUTRALIZATION_ORDER.map((value) => (
              <option key={value} value={value}>
                {epiNeutralizationLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={addLink}
          disabled={pending || !newCatalogId}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black/85 disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Adicionar
        </button>
      </div>
    </section>
  );
}

function LinkedRow({
  item,
  pending,
  onSave,
  onRemove,
}: {
  item: EpiRiskLinkItem;
  pending: boolean;
  onSave: (id: string, neutralization: EpiNeutralization) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <tr className="border-b border-black/5 dark:border-white/5">
      <td className="py-2 pr-3 font-medium">{item.name}</td>
      <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-400">{item.ca ?? "—"}</td>
      <td className="py-2 pr-3">
        <select
          value={item.neutralization}
          disabled={pending}
          onChange={(e) => onSave(item.id, e.target.value as EpiNeutralization)}
          className={`${selectClass} disabled:opacity-60`}
        >
          {EPI_NEUTRALIZATION_ORDER.map((value) => (
            <option key={value} value={value}>
              {epiNeutralizationLabel(value)}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2">
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          disabled={pending}
          className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
        >
          Remover
        </button>
      </td>
    </tr>
  );
}
