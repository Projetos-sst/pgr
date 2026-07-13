import {
  controlLevelLabel,
  measureStateLabel,
  riskAgentTypeLabel,
  riskClassificationLabel,
  type ConsolidatedGes,
  type ConsolidatedRisk,
  type MeasureState,
  type PgrConsolidated,
} from "@/shared/domains/pgr/pgr-consolidated";

const STATE_CLASS: Record<MeasureState, string> = {
  without_plan: "bg-black/5 text-zinc-600 dark:bg-white/10 dark:text-zinc-300",
  planned: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  overdue: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

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
      {risk.measures.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">Sem medidas de controle</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {risk.measures.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium">{controlLevelLabel(m.controlLevel)}</span>
              <span
                className={`rounded-full px-2 py-0.5 font-medium ${STATE_CLASS[m.state]}`}
              >
                {measureStateLabel(m.state)}
              </span>
              {m.actionResponsible ? (
                <span className="text-zinc-500">· {m.actionResponsible}</span>
              ) : null}
              {m.actionDeadline ? (
                <span className="text-zinc-500">· prazo {m.actionDeadline}</span>
              ) : null}
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
