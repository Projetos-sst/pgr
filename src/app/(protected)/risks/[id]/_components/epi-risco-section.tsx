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

const selectClass = "glass-input text-text rounded-card px-3 py-2 text-sm outline-none";

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
    <section className="glass-card flex flex-col gap-4 p-4">
      <header>
        <h2 className="text-text text-lg font-semibold">EPIs vinculados ao risco</h2>
        <p className="text-text-muted text-sm">
          Indique, por EPI, se neutraliza o risco. Riscos sem EPI (controlados por medidas
          coletivas/administrativas) podem ficar sem nenhum vínculo.
        </p>
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {linked.length === 0 ? (
        <p className="text-text-subtle text-sm">Nenhum EPI vinculado a este risco.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-text-muted border-b border-white/50 text-xs">
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

      <div className="flex flex-wrap items-end gap-3 border-t border-white/50 pt-4">
        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-sm font-medium">Adicionar EPI</span>
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
          <span className="text-text-muted text-sm font-medium">
            Neutraliza os Riscos?
          </span>
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
          className="btn-primary rounded-pill px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
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
    <tr className="border-b border-white/50">
      <td className="py-2 pr-3 font-medium">{item.name}</td>
      <td className="text-text-muted py-2 pr-3">{item.ca ?? "—"}</td>
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
          className="rounded-card border border-red-300 px-3 py-1 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          Remover
        </button>
      </td>
    </tr>
  );
}
