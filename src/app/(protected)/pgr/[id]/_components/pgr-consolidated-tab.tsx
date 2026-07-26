"use client";

import { useState } from "react";

import {
  controlLevelLabel,
  measureStateLabel,
  riskAgentTypeLabel,
  exposureTimeLabel,
  measurementUnitLabel,
  epiNeutralizationLabel,
  type ConsolidatedGes,
  type ConsolidatedRisk,
  type MeasureState,
  type PgrConsolidated,
} from "@/shared/domains/pgr/pgr-consolidated";

const STATE_CLASS: Record<MeasureState, string> = {
  without_plan: "bg-black/5 text-text-muted",
  planned: "bg-emerald-500/15 text-emerald-700",
  overdue: "bg-red-500/15 text-red-700",
};

const AGENT_TYPE_COLOR: Record<string, string> = {
  physical: "text-[#7c3aed]",
  chemical: "text-[#0891b2]",
  biological: "text-[#059669]",
  ergonomic: "text-[#c026d3]",
  accident: "text-[#dc2626]",
  mechanical: "text-[#dc2626]",
  psychosocial: "text-[#7c3aed]",
};

function formatSeverity(sev: number | null | undefined): string {
  if (!sev) return "—";
  if (sev >= 4) return "Alta";
  if (sev === 3) return "Média";
  return "Baixa";
}

function formatProbability(prob: number | null | undefined): string {
  if (!prob) return "—";
  if (prob >= 5) return "Frequente";
  if (prob === 4) return "Provável";
  if (prob === 3) return "Ocasional";
  if (prob === 2) return "Pouco provável";
  return "Rara";
}

function getRiskBadge(riskLevel: number | null, result: string | null) {
  if (
    result === "intolerable" ||
    result === "substantial" ||
    (riskLevel != null && riskLevel >= 15)
  ) {
    return (
      <span className="inline-flex items-center rounded-full bg-[#e5484d]/15 px-3 py-0.5 text-xs font-bold text-[#d33a3f]">
        Crítico
      </span>
    );
  }
  if (result === "moderate" || (riskLevel != null && riskLevel >= 10)) {
    return (
      <span className="inline-flex items-center rounded-full bg-[#f5a524]/16 px-3 py-0.5 text-xs font-bold text-[#c9820a]">
        Alto
      </span>
    );
  }
  if (result === "tolerable" || (riskLevel != null && riskLevel >= 5)) {
    return (
      <span className="inline-flex items-center rounded-full bg-[#5b63f5]/12 px-3 py-0.5 text-xs font-bold text-[#5b63f5]">
        Moderado
      </span>
    );
  }
  if (result === "trivial" || (riskLevel != null && riskLevel < 5)) {
    return (
      <span className="inline-flex items-center rounded-full bg-[#0e9f6e]/16 px-3 py-0.5 text-xs font-bold text-[#0e9f6e]">
        Baixo
      </span>
    );
  }
  return <span className="text-text-subtle text-xs">—</span>;
}

/** Detalhe expandido do risco */
function RiskDetailPanel({ risk }: { risk: ConsolidatedRisk }) {
  const items: [string, string | null][] = [
    ["Perigo", risk.hazard],
    ["Fontes geradoras", risk.sources],
    ["Propagação", risk.propagation],
    [
      "Tempo de exposição",
      risk.exposureTime ? exposureTimeLabel(risk.exposureTime) : null,
    ],
    ["Possíveis lesões", risk.possibleInjuries],
    ["Cód. agente nocivo (eSocial)", risk.noxiousAgentCode],
    [
      "Unidade de medida",
      risk.measurementUnit ? measurementUnitLabel(risk.measurementUnit) : null,
    ],
    ["Concentração/intensidade", risk.concentrationIntensity],
  ];
  const shown = items.filter(([, v]) => v && v !== "");

  return (
    <div className="glass-panel my-2 flex flex-col gap-3 rounded-[14px] border border-black/5 bg-white/40 p-4">
      {shown.length > 0 ? (
        <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(([label, value]) => (
            <div key={label} className="flex flex-col">
              <dt className="text-text-subtle font-mono text-[10px] font-bold uppercase">
                {label}
              </dt>
              <dd className="text-text font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {/* Medidas de Controle 5W2H */}
      <div className="border-t border-black/5 pt-2">
        <p className="text-text-muted text-xs font-bold">Medidas de controle (5W2H)</p>
        {risk.measures.length === 0 ? (
          <p className="text-text-subtle mt-1 text-xs">
            Sem medidas de controle cadastradas
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {risk.measures.map((m) => {
              const plan: [string, string | null][] = [
                ["O quê", m.actionWhat],
                ["Como", m.actionHow],
                ["Acompanhamento", m.actionTracking],
                ["Medição", m.actionMeasurement],
                ["Responsável", m.actionResponsible],
                ["Prazo", m.actionDeadline],
              ];
              const plan5w2h = plan.filter(([, v]) => v && v !== "");
              return (
                <div
                  key={m.id}
                  className="rounded-card border border-black/5 bg-white/60 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-text font-bold">
                      {controlLevelLabel(m.controlLevel)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATE_CLASS[m.state]}`}
                    >
                      {measureStateLabel(m.state)}
                    </span>
                  </div>
                  {plan5w2h.length > 0 ? (
                    <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                      {plan5w2h.map(([label, value]) => (
                        <div key={label} className="flex gap-1.5">
                          <dt className="text-text-subtle font-medium">{label}:</dt>
                          <dd className="text-text font-semibold">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* EPIs Indicados */}
      {risk.epis.length > 0 ? (
        <div className="border-t border-black/5 pt-2">
          <p className="text-text-muted text-xs font-bold">EPIs indicados</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {risk.epis.map((e) => (
              <span
                key={e.id}
                className="rounded-card text-text inline-flex items-center gap-1.5 border border-black/5 bg-white/80 px-2.5 py-1 text-xs font-medium"
              >
                <span>{e.name}</span>
                {e.ca ? <span className="text-text-subtle">· CA {e.ca}</span> : null}
                <span className="text-text-subtle">
                  · {epiNeutralizationLabel(e.neutralization)}
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RiskRow({
  risk,
  isEven,
  expanded,
  onToggle,
}: {
  risk: ConsolidatedRisk;
  isEven: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const agentColor = AGENT_TYPE_COLOR[risk.agentType] ?? "text-primary";
  const sevText = risk.assessment ? formatSeverity(risk.assessment.severity) : "—";
  const probText = risk.assessment ? formatProbability(risk.assessment.probability) : "—";

  return (
    <div className="border-t border-black/5 transition-colors">
      {/* Linha principal compacta e limpa (estilo do mockup) */}
      <div
        onClick={onToggle}
        className={`grid cursor-pointer grid-cols-2 items-center gap-3 px-6 py-3.5 hover:bg-white/40 sm:grid-cols-[1.1fr_1.6fr_1fr_1fr_0.9fr_1fr_auto] ${
          isEven ? "bg-white/20" : ""
        }`}
      >
        <div>
          <span className={`text-xs font-bold ${agentColor}`}>
            {riskAgentTypeLabel(risk.agentType)}
          </span>
        </div>
        <div>
          <span className="text-text text-xs font-bold">{risk.description}</span>
        </div>
        <div className="hidden sm:block">
          <span className="text-text-subtle block truncate text-xs font-medium">
            {risk.sources ?? "—"}
          </span>
        </div>
        <div className="hidden sm:block">
          <span className="text-text text-xs font-medium">{sevText}</span>
        </div>
        <div className="hidden sm:block">
          <span className="text-text text-xs font-medium">{probText}</span>
        </div>
        <div>{getRiskBadge(risk.riskLevel, risk.result)}</div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="text-text-subtle hover:text-text flex items-center gap-1 text-xs font-bold transition-colors"
          >
            <span>{expanded ? "Ocultar" : "Detalhes"}</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className={`transition-transform duration-200 ${
                expanded ? "rotate-180" : ""
              }`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Painel expansível de detalhes */}
      {expanded ? (
        <div className="px-6 pb-4">
          <RiskDetailPanel risk={risk} />
        </div>
      ) : null}
    </div>
  );
}

function GesBlock({
  ges,
  expandedMap,
  toggleExpand,
}: {
  ges: ConsolidatedGes;
  expandedMap: Record<string, boolean>;
  toggleExpand: (id: string) => void;
}) {
  return (
    <section className="glass-card flex flex-col overflow-hidden rounded-[20px]">
      <div className="flex items-center gap-3 border-b border-black/5 bg-white/20 px-6 py-4">
        <span className="text-primary bg-primary/10 rounded-[8px] px-2.5 py-1 font-mono text-xs font-bold">
          GES
        </span>
        <h3 className="text-text text-sm font-bold">{ges.name}</h3>
        <span className="text-text-subtle text-xs">
          · {ges.risks.length}{" "}
          {ges.risks.length === 1 ? "risco mapeado" : "riscos mapeados"}
        </span>
      </div>

      {ges.risks.length === 0 ? (
        <div className="text-text-subtle p-6 text-center text-xs">
          Nenhum risco cadastrado neste GES.
        </div>
      ) : (
        <div>
          {/* Header da Tabela em telas médias/grandes (Espelhado do mockup) */}
          <div className="text-text-subtle hidden grid-cols-[1.1fr_1.6fr_1fr_1fr_0.9fr_1fr_auto] gap-3 bg-black/5 px-6 py-2.5 font-mono text-[10px] font-bold tracking-wider uppercase sm:grid">
            <span>Tipo</span>
            <span>Agente / Fator</span>
            <span>Fonte</span>
            <span>Severidade</span>
            <span>Probab.</span>
            <span>Nível</span>
            <span className="text-right">Ação</span>
          </div>
          <div>
            {ges.risks.map((r, idx) => (
              <RiskRow
                key={r.id}
                risk={r}
                isEven={idx % 2 === 1}
                expanded={Boolean(expandedMap[r.id])}
                onToggle={() => toggleExpand(r.id)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Aba Consolidada (read-only): O melhor dos 2 mundos.
 * Tabela limpa e scannável por padrão + detalhes 5W2H expansíveis por linha.
 */
export function PgrConsolidatedTab({
  consolidated,
}: {
  consolidated: PgrConsolidated | null;
}) {
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState(false);

  if (!consolidated) {
    return (
      <div className="glass-card text-text-subtle p-6 text-center text-sm">
        Não foi possível carregar a visão consolidada do documento.
      </div>
    );
  }
  const { ges } = consolidated;

  let totalRisksCount = 0;
  for (const g of ges) {
    totalRisksCount += g.risks.length;
  }

  function toggleExpand(id: string) {
    setExpandedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleAll() {
    const next = !allExpanded;
    setAllExpanded(next);
    const newMap: Record<string, boolean> = {};
    for (const g of ges) {
      for (const r of g.risks) {
        newMap[r.id] = next;
      }
    }
    setExpandedMap(newMap);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Card de título e controle */}
      <div className="glass-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-text text-base font-bold sm:text-lg">
            Inventário de Riscos
          </h2>
          <p className="text-text-subtle mt-0.5 text-xs">
            Identificação e avaliação por Grupo de Exposição Similar (GES)
          </p>
        </div>
        {totalRisksCount > 0 ? (
          <button
            type="button"
            onClick={toggleAll}
            className="glass-panel text-text-muted hover:text-text rounded-card flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold transition-all sm:text-sm"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M8 3v3a2 2 0 0 1-2 2H3" />
              <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
              <path d="M3 16h3a2 2 0 0 1 2 2v3" />
              <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
            {allExpanded ? "Recolher todos os detalhes" : "Expandir todos os detalhes"}
          </button>
        ) : null}
      </div>

      {ges.length === 0 ? (
        <div className="glass-card rounded-[20px] border border-amber-300/50 bg-amber-500/10 p-6 text-center text-sm text-amber-800">
          Nenhum GES vinculado a este PGR. Vincule um GES na aba{" "}
          <strong>Vínculos de GES</strong> para compor o inventário.
        </div>
      ) : (
        ges.map((g) => (
          <GesBlock
            key={g.id}
            ges={g}
            expandedMap={expandedMap}
            toggleExpand={toggleExpand}
          />
        ))
      )}

      {/* Card footer espelhado do mockup */}
      {totalRisksCount > 0 ? (
        <div className="glass-card flex items-center justify-between px-6 py-4 text-xs">
          <span className="text-text-subtle">
            <strong className="text-text font-bold">{totalRisksCount}</strong>{" "}
            {totalRisksCount === 1 ? "risco mapeado" : "riscos mapeados"} em{" "}
            <strong className="text-text font-bold">{ges.length} GES</strong>
          </span>
          <span className="text-primary font-bold">
            Visão Consolidada de Riscos &rarr;
          </span>
        </div>
      ) : null}
    </div>
  );
}
