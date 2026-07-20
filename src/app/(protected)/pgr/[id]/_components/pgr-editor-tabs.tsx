"use client";

import { useState } from "react";

import type { Pgr } from "@/shared/domains/pgr/pgr";
import type { PgrGesLinkItem } from "@/shared/domains/pgr/pgr-ges";
import type { PgrRevisionListItem } from "@/shared/domains/pgr/pgr-revision";
import type { PgrConsolidated } from "@/shared/domains/pgr/pgr-consolidated";
import type { PgrSignatureView } from "@/shared/domains/pgr/pgr-signature";

import { PgrBasicInfoTab } from "./pgr-basic-info-tab";
import { PgrGesTab } from "./pgr-ges-tab";
import { PgrRevisionsTab } from "./pgr-revisions-tab";
import { PgrConsolidatedTab } from "./pgr-consolidated-tab";
import { PgrDisabledPlaceholderTab } from "./pgr-disabled-placeholder-tab";

type TabKey = "basic" | "ges" | "revisions" | "consolidated" | "cover" | "ged";

const TABS: { key: TabKey; label: string; phase05?: boolean }[] = [
  { key: "basic", label: "Informações básicas" },
  { key: "ges", label: "GES" },
  { key: "revisions", label: "Revisões" },
  { key: "consolidated", label: "Consolidada" },
  { key: "cover", label: "Cor e Sumário", phase05: true },
  { key: "ged", label: "Documentos GED", phase05: true },
];

export function PgrEditorTabs({
  pgrId,
  pgr,
  companyName,
  workUnitName,
  availableGes,
  gesLinks,
  revisions,
  consolidated,
  signature,
}: {
  pgrId: string;
  pgr: Pgr;
  companyName: string;
  workUnitName: string | null;
  availableGes: { id: string; name: string }[];
  gesLinks: PgrGesLinkItem[];
  revisions: PgrRevisionListItem[];
  consolidated: PgrConsolidated | null;
  signature?: PgrSignatureView;
}) {
  const [active, setActive] = useState<TabKey>("basic");

  const tabClass = (isActive: boolean, phase05?: boolean) =>
    `rounded-card px-4 py-2 text-sm font-semibold transition-colors ${
      isActive
        ? "btn-primary"
        : phase05
          ? "glass-panel text-text-subtle hover:text-text-muted border-dashed"
          : "glass-panel text-text-muted hover:text-text"
    }`;

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-wrap gap-2" aria-label="Abas do PGR">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            title={t.phase05 ? "Disponível na Fase 05" : undefined}
            className={tabClass(active === t.key, t.phase05)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {active === "basic" ? (
        <PgrBasicInfoTab
          pgrId={pgrId}
          pgr={pgr}
          companyName={companyName}
          workUnitName={workUnitName}
          signature={signature}
        />
      ) : null}
      {active === "ges" ? (
        <PgrGesTab pgrId={pgrId} links={gesLinks} availableGes={availableGes} />
      ) : null}
      {active === "revisions" ? (
        <PgrRevisionsTab pgrId={pgrId} revisions={revisions} />
      ) : null}
      {active === "consolidated" ? (
        <PgrConsolidatedTab consolidated={consolidated} />
      ) : null}
      {active === "cover" ? <PgrDisabledPlaceholderTab title="Cor e Sumário" /> : null}
      {active === "ged" ? <PgrDisabledPlaceholderTab title="Documentos GED" /> : null}
    </div>
  );
}
