"use client";

import type { PlansOverview } from "@/shared/server/commercial/plans-overview-core";

import { Button } from "../../../_ui/button";
import { StatusBadge } from "../../../_ui/status-badge";
import {
  FICTITIOUS_BADGE,
  PERIOD_LABEL,
  SERVICE_LABEL,
  UNIT_LABEL,
  formatBrl,
  formatCivilDate,
  quotaLabel,
} from "./format";

export type OfferView = PlansOverview["offers"][number];
export type ActiveTrial = { companyName: string; endsOn: string };

function TrialNotice({ trials }: { trials: readonly ActiveTrial[] }) {
  if (trials.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {trials.map((trial) => (
        <StatusBadge
          key={trial.companyName}
          tone="amber"
          label={`Teste em andamento: ${trial.companyName} até ${formatCivilDate(trial.endsOn)}`}
        />
      ))}
    </div>
  );
}

function ItemList({ offer }: { offer: OfferView }) {
  return (
    <ul className="flex flex-col gap-2 border-t border-black/5 pt-4 text-xs font-medium">
      {offer.items.map((item) => (
        <li key={item.label} className="flex items-start justify-between gap-3">
          <span>
            <span className="text-primary font-bold">{SERVICE_LABEL[item.service]}</span>
            {" · "}
            {item.label}
          </span>
          <span className="text-text-muted shrink-0 text-right">
            {formatBrl(item.unitAmountCents)} {UNIT_LABEL[item.unit]}
          </span>
        </li>
      ))}
    </ul>
  );
}

function QuotaList({ offer }: { offer: OfferView }) {
  if (offer.quotas.length === 0) return null;
  return (
    <ul className="text-text-muted flex flex-col gap-1 text-xs">
      {offer.quotas.map((quota) => (
        <li key={quota.metric}>Cota — {quotaLabel(quota)}</li>
      ))}
    </ul>
  );
}

export function OfferCard({
  offer,
  isCurrent,
  trials,
  canChoose,
  isSelected,
  onChoose,
}: {
  offer: OfferView;
  isCurrent: boolean;
  trials: readonly ActiveTrial[];
  canChoose: boolean;
  isSelected: boolean;
  onChoose: () => void;
}) {
  return (
    <article
      aria-label={offer.name}
      className="glass-card flex flex-col gap-4 p-6 transition-all duration-200"
    >
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-text text-lg font-extrabold">{offer.name}</h3>
          {isCurrent ? <StatusBadge tone="green" label="Plano atual" /> : null}
        </div>
        {offer.fictitious ? <StatusBadge tone="red" label={FICTITIOUS_BADGE} /> : null}
        <p className="text-text-muted text-xs font-medium">{offer.description}</p>
        <p className="text-text text-xs font-semibold">
          Cobrança: {PERIOD_LABEL[offer.billingPeriod]}
        </p>
      </header>
      <TrialNotice trials={trials} />
      <ItemList offer={offer} />
      <QuotaList offer={offer} />
      {canChoose ? (
        <Button
          label={isSelected ? "Oferta escolhida" : `Contratar ${offer.name}`}
          variant={isSelected ? "secondary" : "primary"}
          disabled={isSelected}
          onClick={onChoose}
        />
      ) : null}
    </article>
  );
}
