"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  medicalSourceInputSchema,
  medicalRiskListSchema,
  type MedicalRiskContent,
} from "@/shared/domains/medicine/risk-sources";
import { riskAgentTypeSchema, riskAgentTypeLabel } from "@/shared/domains/pgr/risks";
import { registerMedicalRiskSourceAction } from "@/shared/server/actions/medicine/risk-sources";
import {
  FormSection,
  FormError,
  TextField,
  SelectField,
  SubmitButton,
  fieldClass,
} from "../../../_ui/form";

type DraftRisk = Omit<MedicalRiskContent, "agentType"> & {
  agentType: MedicalRiskContent["agentType"] | "";
};
const emptyRisk = (): DraftRisk => ({
  agentType: "",
  description: "",
  exposureGroup: "",
});

export function SourceForm({
  companyId,
  pgrs,
  sources,
}: {
  companyId: string;
  pgrs: { id: string; label: string }[];
  sources: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState("external");
  const [risks, setRisks] = useState<DraftRisk[]>([emptyRisk()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function updateRisk(index: number, patch: Partial<DraftRisk>) {
    setRisks((current) =>
      current.map((risk, position) =>
        position === index ? { ...risk, ...patch } : risk,
      ),
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const previous = String(data.get("supersedesSourceId") ?? "") || undefined;
        const input = medicalSourceInputSchema.safeParse(
          kind === "internal"
            ? { kind, pgrId: data.get("pgrId"), supersedesSourceId: previous }
            : {
                kind,
                title: data.get("title"),
                reference: data.get("reference"),
                version: data.get("version"),
                risks,
                supersedesSourceId: previous,
              },
        );
        if (!input.success) {
          setError(input.error.issues[0]?.message ?? "Confira os dados.");
          return;
        }
        setError(null);
        startTransition(async () => {
          try {
            const result = await registerMedicalRiskSourceAction(companyId, input.data);
            if (!result.ok) {
              setError(result.error.message);
              return;
            }
            form.reset();
            setRisks([emptyRisk()]);
            router.refresh();
          } catch {
            setError("Não foi possível registrar a fonte. Tente novamente.");
          }
        });
      }}
    >
      <FormSection
        title="Registrar fonte de riscos"
        description="O registro preserva a origem e a versão. Os riscos entram pendentes de revisão técnica."
        columns={1}
      >
        <SelectField
          name="kind"
          label="Origem"
          value={kind}
          onChange={setKind}
          options={[
            { value: "external", label: "PGR externo" },
            { value: "internal", label: "PGR da plataforma" },
          ]}
        />
        {kind === "internal" ? (
          <SelectField
            name="pgrId"
            label="PGR de origem"
            required
            options={pgrs.map((pgr) => ({ value: pgr.id, label: pgr.label }))}
          />
        ) : (
          <>
            <TextField name="title" label="Título da fonte" required />
            <TextField
              name="reference"
              label="Referência do documento (ex.: identificação no GED)"
              required
            />
            <TextField name="version" label="Versão do documento" required />
            <label className="text-text-muted text-sm">
              Importar lista de riscos (.json)
              <input
                type="file"
                accept=".json,application/json"
                disabled={pending}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) {
                    setError("O arquivo deve ter até 2 MB.");
                    return;
                  }
                  try {
                    const parsed = medicalRiskListSchema.safeParse(
                      JSON.parse(await file.text()),
                    );
                    if (!parsed.success) {
                      setError(
                        "Lista inválida. Use categoria, descrição e grupo de exposição; não inclua status ou aprovador.",
                      );
                      return;
                    }
                    setRisks(parsed.data);
                    setError(null);
                  } catch {
                    setError("Arquivo JSON inválido.");
                  }
                }}
              />
            </label>
            <p className="text-text-muted text-sm">
              Você também pode cadastrar os riscos abaixo. Nenhuma informação importada
              será aprovada automaticamente.
            </p>
            {risks.map((risk, index) => (
              <fieldset
                key={index}
                className="grid gap-3 rounded-xl border border-white/70 p-4"
              >
                <legend>Risco {index + 1}</legend>
                <label>
                  Categoria
                  <select
                    className={fieldClass}
                    value={risk.agentType}
                    required
                    onChange={(event) =>
                      updateRisk(index, {
                        agentType: event.target.value as DraftRisk["agentType"],
                      })
                    }
                  >
                    <option value="">Selecione</option>
                    {riskAgentTypeSchema.options.map((type) => (
                      <option key={type} value={type}>
                        {riskAgentTypeLabel(type)}
                      </option>
                    ))}
                  </select>
                </label>
                <TextField
                  name={`description-${index}`}
                  label="Descrição do risco"
                  required
                  value={risk.description}
                  onChange={(value) => updateRisk(index, { description: value })}
                />
                <TextField
                  name={`group-${index}`}
                  label="Grupo / contexto de exposição"
                  required
                  value={risk.exposureGroup}
                  onChange={(value) => updateRisk(index, { exposureGroup: value })}
                />
                <TextField
                  name={`role-${index}`}
                  label="Função (se informada na origem)"
                  value={risk.jobRole ?? ""}
                  onChange={(value) => updateRisk(index, { jobRole: value })}
                />
                <TextField
                  name={`injuries-${index}`}
                  label="Possíveis lesões informadas na origem"
                  value={risk.possibleInjuries ?? ""}
                  onChange={(value) => updateRisk(index, { possibleInjuries: value })}
                />
                <TextField
                  name={`exposure-${index}`}
                  label="Informações de exposição da origem"
                  value={risk.exposureDescription ?? ""}
                  onChange={(value) => updateRisk(index, { exposureDescription: value })}
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    setRisks((current) =>
                      current.filter((_, position) => position !== index),
                    )
                  }
                >
                  Remover este risco
                </button>
              </fieldset>
            ))}
            <button
              type="button"
              disabled={pending || risks.length >= 500}
              onClick={() => setRisks((current) => [...current, emptyRisk()])}
            >
              Adicionar risco
            </button>
            {risks.length === 0 && (
              <p role="status">
                A fonte será registrada sem riscos e exibirá um aviso de levantamento
                incompleto.
              </p>
            )}
          </>
        )}
        <SelectField
          name="supersedesSourceId"
          label="Substitui uma fonte anterior (opcional)"
          options={sources.map((source) => ({ value: source.id, label: source.label }))}
        />
        <FormError message={error} />
        <SubmitButton pending={pending} label="Registrar para revisão" />
      </FormSection>
    </form>
  );
}
