"use client";

import { AgentProgress } from "@/app/(protected)/_ui/agent-progress";
import { AiFilledBadge } from "@/app/(protected)/_ui/ai-review";
import { SelectField } from "@/app/(protected)/_ui/form";
import type { FilledEpiLink } from "@/shared/domains/pgr/ai-epi-risk-fill";
import {
  EPI_NEUTRALIZATION_ORDER,
  epiNeutralizationLabel,
} from "@/shared/domains/pgr/epi-risk";

const EPI_AGENT_STAGES = [
  "Pensando…",
  "Lendo o risco…",
  "Conferindo o catálogo de EPIs…",
  "Avaliando a neutralização…",
];

export const NEUTRALIZATION_OPTIONS = EPI_NEUTRALIZATION_ORDER.map((value) => ({
  value,
  label: epiNeutralizationLabel(value),
}));

export function EpiFillReview({
  links,
  generating,
  pending,
  error,
  onEdit,
  onRemove,
  onSave,
  onClose,
}: {
  links: FilledEpiLink[];
  generating: boolean;
  pending: boolean;
  error: string | null;
  onEdit: (catalogId: string, value: string) => void;
  onRemove: (catalogId: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Revisão dos EPIs preenchidos pela IA pgr-e"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="glass-card flex max-h-[85vh] w-full max-w-2xl flex-col gap-4 overflow-hidden bg-white/90 p-5">
        <header className="flex items-center justify-between">
          <h3 className="text-text text-lg font-semibold">
            {generating ? "Preenchendo EPIs…" : `EPIs preenchidos (${links.length})`}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="glass-panel text-text-muted rounded-card hover:text-text px-3 py-1 text-sm font-semibold transition-colors"
          >
            Fechar
          </button>
        </header>

        {generating ? <AgentProgress stages={EPI_AGENT_STAGES} /> : null}
        {!generating && links.length === 0 ? (
          <p className="text-text-subtle text-sm">
            A IA pgr-e não encontrou EPI do catálogo adequado a este risco.
          </p>
        ) : null}
        {!generating && links.length > 0 ? (
          <div className="flex flex-col gap-3 overflow-y-auto">
            {links.map((link, index) => (
              <EpiLinkCard
                key={link.catalogId}
                title={`EPI ${index + 1}`}
                link={link}
                onEdit={onEdit}
                onRemove={onRemove}
              />
            ))}
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <footer className="flex items-center justify-between border-t border-white/50 pt-3">
          <span className="text-text-subtle text-sm">
            {generating ? "Aguardando o agente…" : "Revise cada EPI antes de salvar."}
          </span>
          <button
            type="button"
            onClick={onSave}
            disabled={generating || pending || links.length === 0}
            className="btn-primary rounded-pill px-5 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {pending ? "Salvando…" : "Salvar EPIs"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function EpiLinkCard({
  title,
  link,
  onEdit,
  onRemove,
}: {
  title: string;
  link: FilledEpiLink;
  onEdit: (catalogId: string, value: string) => void;
  onRemove: (catalogId: string) => void;
}) {
  return (
    <fieldset className="glass-panel rounded-card flex flex-col gap-3 p-3">
      <legend className="sr-only">{title}</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-text text-sm font-semibold">{link.name}</span>
          <span className="text-text-muted text-sm">
            {link.ca ? `CA ${link.ca}` : "Sem CA"}
          </span>
          <AiFilledBadge />
        </div>
        <button
          type="button"
          onClick={() => onRemove(link.catalogId)}
          className="text-sm font-semibold text-red-600 hover:underline"
        >
          Remover
        </button>
      </div>
      <SelectField
        label="Neutraliza os Riscos?"
        name={`epi-${link.catalogId}-neutralization`}
        required
        value={link.neutralization}
        onChange={(v) => onEdit(link.catalogId, v)}
        options={NEUTRALIZATION_OPTIONS}
      />
      {link.rationale ? (
        <p className="text-text-subtle text-sm">{link.rationale}</p>
      ) : null}
    </fieldset>
  );
}
