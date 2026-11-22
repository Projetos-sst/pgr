"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import {
  AiFillButton,
  AiSaveConfirm,
  useAiGenerateWarning,
} from "@/app/(protected)/_ui/ai-review";
import { SelectField } from "@/app/(protected)/_ui/form";
import {
  acceptRiskEpiFillAction,
  fillRiskEpisAction,
} from "@/shared/server/actions/pgr/ai-epi-risk-fill";
import {
  addRiskEpiAction,
  listAvailableEpisForRiskAction,
  listRiskEpisAction,
  removeRiskEpiAction,
  updateRiskEpiAction,
} from "@/shared/server/actions/pgr/epi-risk";
import type { FilledEpiLink } from "@/shared/domains/pgr/ai-epi-risk-fill";
import {
  epiNeutralizationSchema,
  type EpiNeutralization,
  type EpiOption,
  type EpiRiskLinkItem,
} from "@/shared/domains/pgr/epi-risk";
import { aiFillErrorMessage } from "@/shared/domains/platform/ai-review";

import { EpiFillReview, NEUTRALIZATION_OPTIONS } from "./epi-fill-review";

function toNeutralization(value: string): EpiNeutralization | null {
  const parsed = epiNeutralizationSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function emptyCatalogMessage(linkedCount: number): string {
  if (linkedCount === 0) {
    return "Cadastre EPIs no catálogo para usar a IA pgr-e neste risco.";
  }
  return "Todos os EPIs do catálogo já estão vinculados a este risco.";
}

function savedNotice(created: number, skipped: number): string {
  const base = `${created} EPI(s) vinculado(s) ao risco.`;
  return skipped > 0 ? `${base} ${skipped} já estava(m) vinculado(s).` : base;
}

export function EpiRiscoSection({ riskId }: { riskId: string }) {
  const [linked, setLinked] = useState<EpiRiskLinkItem[]>([]);
  const [available, setAvailable] = useState<EpiOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newCatalogId, setNewCatalogId] = useState("");
  const [newNeutralization, setNewNeutralization] =
    useState<EpiNeutralization>("neutralizes");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [filled, setFilled] = useState<FilledEpiLink[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [generating, startGenerate] = useTransition();
  const [accepting, startAccept] = useTransition();

  const reload = useCallback(() => {
    startTransition(async () => {
      const [linkedResult, availableResult] = await Promise.all([
        listRiskEpisAction(riskId),
        listAvailableEpisForRiskAction(riskId),
      ]);
      if (linkedResult.ok) setLinked(linkedResult.data);
      if (availableResult.ok) setAvailable(availableResult.data);
      setLoaded(true);
    });
  }, [riskId]);

  useEffect(() => {
    reload();
  }, [reload]);

  function generate() {
    setError(null);
    setNotice(null);
    setFilled([]);
    setTruncated(false);
    setReviewOpen(true);
    startGenerate(async () => {
      const result = await fillRiskEpisAction(riskId);
      if (!result.ok) {
        setReviewOpen(false);
        setError(aiFillErrorMessage(result.error));
        return;
      }
      setFilled(result.data.links);
      setTruncated(result.data.truncated);
    });
  }

  const warning = useAiGenerateWarning(generate);

  function editFilled(catalogId: string, value: string) {
    const neutralization = toNeutralization(value);
    if (!neutralization) return;
    setFilled((prev) =>
      prev.map((link) =>
        link.catalogId === catalogId ? { ...link, neutralization } : link,
      ),
    );
  }

  function removeFilled(catalogId: string) {
    setFilled((prev) => prev.filter((link) => link.catalogId !== catalogId));
  }

  function saveFilled() {
    startAccept(async () => {
      const result = await acceptRiskEpiFillAction(riskId, {
        links: filled.map((link) => ({
          catalogId: link.catalogId,
          neutralization: link.neutralization,
        })),
      });
      setConfirming(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setReviewOpen(false);
      setFilled([]);
      setNotice(savedNotice(result.data.created, result.data.skipped));
      reload();
    });
  }

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

  function saveNeutralization(id: string, value: string) {
    const neutralization = toNeutralization(value);
    if (!neutralization) return;
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

  const catalogEmpty = loaded && available.length === 0;

  return (
    <section className="glass-card flex flex-col gap-4 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-text text-lg font-semibold">EPIs vinculados ao risco</h2>
          <p className="text-text-muted text-sm">
            Indique, por EPI, se neutraliza o risco. Riscos sem EPI (controlados por
            medidas coletivas/administrativas) podem ficar sem nenhum vínculo.
          </p>
          {catalogEmpty ? (
            <p className="text-text-subtle text-sm">
              {emptyCatalogMessage(linked.length)}
            </p>
          ) : null}
        </div>
        <AiFillButton
          onClick={warning.request}
          pending={generating}
          disabled={!loaded || catalogEmpty || accepting}
        />
      </header>

      {error && !reviewOpen ? <p className="text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="text-sm text-green-700">{notice}</p> : null}

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

      <div className="grid items-end gap-3 border-t border-white/50 pt-4 sm:grid-cols-[2fr_1fr_auto]">
        <SelectField
          label="Adicionar EPI"
          name="new-epi-catalog"
          value={newCatalogId}
          onChange={setNewCatalogId}
          emptyLabel="— selecione (busca por nome/CA) —"
          options={available.map((opt) => ({
            value: opt.catalogId,
            label: opt.ca ? `${opt.name} — CA ${opt.ca}` : opt.name,
          }))}
        />
        <SelectField
          label="Neutraliza os Riscos?"
          name="new-epi-neutralization"
          value={newNeutralization}
          onChange={(v) => setNewNeutralization(toNeutralization(v) ?? "neutralizes")}
          options={NEUTRALIZATION_OPTIONS}
        />
        <button
          type="button"
          onClick={addLink}
          disabled={pending || !newCatalogId}
          className="btn-primary rounded-pill px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          Adicionar
        </button>
      </div>

      {reviewOpen ? (
        <EpiFillReview
          links={filled}
          truncated={truncated}
          generating={generating}
          pending={accepting}
          error={error}
          onEdit={editFilled}
          onRemove={removeFilled}
          onSave={() => setConfirming(true)}
          onClose={() => setReviewOpen(false)}
        />
      ) : null}

      {warning.modal}
      <AiSaveConfirm
        open={confirming}
        pending={accepting}
        onConfirm={saveFilled}
        onCancel={() => setConfirming(false)}
      />
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
  onSave: (id: string, value: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <tr className="border-b border-white/50">
      <td className="py-2 pr-3 font-medium">{item.name}</td>
      <td className="text-text-muted py-2 pr-3">{item.ca ?? "—"}</td>
      <td className="py-2 pr-3">
        <SelectField
          label={`Neutraliza: ${item.name}`}
          name={`epi-link-${item.id}`}
          value={item.neutralization}
          disabled={pending}
          onChange={(v) => onSave(item.id, v)}
          options={NEUTRALIZATION_OPTIONS}
        />
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
