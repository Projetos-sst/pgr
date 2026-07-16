import { riskAgentTypeLabel, exposureTimeLabel } from "@/shared/domains/pgr/risks";
import {
  riskClassificationLabel,
  type RiskClassification,
} from "@/shared/domains/pgr/risk-assessment";
import type { Risk, RiskAssessment } from "@/shared/domains/pgr/control-measure";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col">
      <span className="text-text-subtle text-xs tracking-wide uppercase">{label}</span>
      <span className="text-text text-sm">{value && value !== "" ? value : "—"}</span>
    </div>
  );
}

/**
 * Contexto read-only do risco + avaliação vigente (nível/classificação). A avaliação é
 * **derivada** (última avaliação); `null` → "Sem avaliação vigente". Nada é persistido aqui.
 */
export function RiskContext({
  risk,
  assessment,
}: {
  risk: Risk;
  assessment: RiskAssessment | null;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="glass-card grid gap-4 p-4 sm:grid-cols-3">
        <Field label="Grupo do agente" value={riskAgentTypeLabel(risk.agentType)} />
        <Field label="Perigo" value={risk.hazard} />
        <Field label="Descrição" value={risk.description} />
        <Field label="Fontes geradoras" value={risk.sources} />
        <Field label="Possíveis lesões" value={risk.possibleInjuries} />
        <Field label="Código do agente (S-2240)" value={risk.noxiousAgentCode} />
        <Field
          label="Tempo de exposição"
          value={risk.exposureTime ? exposureTimeLabel(risk.exposureTime) : null}
        />
      </div>

      <div className="glass-card grid gap-4 p-4 sm:grid-cols-2">
        {assessment ? (
          <>
            <Field
              label="Nível de risco (avaliação vigente)"
              value={String(assessment.riskLevel)}
            />
            <Field
              label="Classificação vigente"
              value={
                assessment.result
                  ? riskClassificationLabel(assessment.result as RiskClassification)
                  : "—"
              }
            />
          </>
        ) : (
          <Field label="Avaliação de risco" value="Sem avaliação vigente" />
        )}
      </div>
    </section>
  );
}
