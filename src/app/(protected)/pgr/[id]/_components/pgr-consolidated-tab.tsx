import {
  controlLevelLabel,
  measureStateLabel,
  riskAgentTypeLabel,
  riskClassificationLabel,
  exposureTimeLabel,
  measurementUnitLabel,
  epiNeutralizationLabel,
  type ConsolidatedGes,
  type ConsolidatedRisk,
  type ConsolidatedMeasure,
  type MeasureState,
  type PgrConsolidated,
} from "@/shared/domains/pgr/pgr-consolidated";

const STATE_CLASS: Record<MeasureState, string> = {
  without_plan: "bg-black/5 text-zinc-600 dark:bg-white/10 dark:text-zinc-300",
  planned: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  overdue: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

/** Detalhe do risco: mostra só os campos preenchidos (fonte reutilizável pela Fase 05). */
function RiskDetail({ risk }: { risk: ConsolidatedRisk }) {
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
  if (shown.length === 0) return null;
  return (
    <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
      {shown.map(([label, value]) => (
        <div key={label} className="flex flex-col">
          <dt className="text-zinc-500">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Medida com o plano 5W2H completo. */
function MeasureItem({ measure: m }: { measure: ConsolidatedMeasure }) {
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
    <li className="rounded border border-black/5 p-2 dark:border-white/5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium">{controlLevelLabel(m.controlLevel)}</span>
        <span className={`rounded-full px-2 py-0.5 font-medium ${STATE_CLASS[m.state]}`}>
          {measureStateLabel(m.state)}
        </span>
      </div>
      {plan5w2h.length > 0 ? (
        <dl className="mt-1 grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
          {plan5w2h.map(([label, value]) => (
            <div key={label} className="flex gap-1">
              <dt className="text-zinc-500">{label}:</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </li>
  );
}

function RiskRow({ risk }: { risk: ConsolidatedRisk }) {
  return (
    <div className="rounded-md border border-black/10 p-3 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {riskAgentTypeLabel(risk.agentType)} · {risk.description}
        </span>
        <span className="text-sm">
          {risk.riskLevel != null ? (
            <>
              Nível <strong>{risk.riskLevel}</strong>
              {risk.result ? ` · ${riskClassificationLabel(risk.result)}` : ""}
            </>
          ) : (
            <span className="text-zinc-500">Sem avaliação vigente</span>
          )}
        </span>
      </div>

      <RiskDetail risk={risk} />

      <p className="mt-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
        Medidas de controle
      </p>
      {risk.measures.length === 0 ? (
        <p className="mt-1 text-xs text-zinc-500">Sem medidas de controle</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1">
          {risk.measures.map((m) => (
            <MeasureItem key={m.id} measure={m} />
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
        EPIs indicados
      </p>
      {risk.epis.length === 0 ? (
        <p className="mt-1 text-xs text-zinc-500">Sem EPIs indicados</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1">
          {risk.epis.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium">{e.name}</span>
              {e.ca ? <span className="text-zinc-500">· CA {e.ca}</span> : null}
              <span className="text-zinc-500">
                · {epiNeutralizationLabel(e.neutralization)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GesBlock({ ges }: { ges: ConsolidatedGes }) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/10">
      <h3 className="text-sm font-semibold">GES: {ges.name}</h3>
      {ges.risks.length === 0 ? (
        <p className="text-xs text-zinc-500">Sem riscos neste GES.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {ges.risks.map((r) => (
            <RiskRow key={r.id} risk={r} />
          ))}
        </div>
      )}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs tracking-wide text-zinc-500 uppercase">{label}</span>
      <span className="text-sm">{value && value !== "" ? value : "—"}</span>
    </div>
  );
}

/**
 * Aba Consolidada (read-only): PGR + GES vinculados → riscos ordenados por nível → medidas
 * com estado derivado. Fallbacks para PGR sem GES / GES sem riscos / risco sem avaliação /
 * risco sem medidas. Estrutura reutilizável pela Fase 05 (PDF).
 */
export function PgrConsolidatedTab({
  consolidated,
}: {
  consolidated: PgrConsolidated | null;
}) {
  if (!consolidated) {
    return (
      <p className="text-sm text-zinc-500">
        Não foi possível carregar a visão consolidada.
      </p>
    );
  }
  const { pgr, ges } = consolidated;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 rounded-lg border border-black/10 p-4 sm:grid-cols-3 dark:border-white/10">
        <Field label="Empresa" value={pgr.companyName} />
        <Field label="Obra/Contrato" value={pgr.workUnitName} />
        <Field label="Responsável" value={pgr.responsible} />
      </div>

      {ges.length === 0 ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          Nenhum GES vinculado a este PGR. Vá à aba <strong>GES</strong> para vincular.
        </p>
      ) : (
        ges.map((g) => <GesBlock key={g.id} ges={g} />)
      )}
    </div>
  );
}
