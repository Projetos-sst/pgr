"use client";
import { useId, useState } from "react";
import {
  medicalSourceInputSchema,
  medicalRiskListSchema,
  type MedicalRiskContent,
} from "@/shared/domains/medicine/risk-sources";
import {
  EMPTY_FORM_FEEDBACK,
  fieldsFromIssues,
  formFeedback,
  pathDescriber,
} from "@/shared/domains/medicine/form-feedback";
import { riskAgentTypeSchema, riskAgentTypeLabel } from "@/shared/domains/pgr/risks";
import { registerMedicalRiskSourceAction } from "@/shared/server/actions/medicine/risk-sources";
import {
  FieldError,
  FormSection,
  FormError,
  TextField,
  SelectField,
  SubmitButton,
  fieldClass,
} from "../../../_ui/form";
import { useActionFeedback } from "../../../_ui/use-action-feedback";

type DraftRisk = Omit<MedicalRiskContent, "agentType"> & {
  agentType: MedicalRiskContent["agentType"] | "";
};
const emptyRisk = (): DraftRisk => ({
  agentType: "",
  description: "",
  exposureGroup: "",
});

const RISK_FIELDS = [
  "agentType",
  "description",
  "exposureGroup",
  "jobRole",
  "possibleInjuries",
  "exposureDescription",
  "noxiousAgentCode",
] as const;

const describeSourcePath = pathDescriber({
  fields: {
    kind: "Origem",
    pgrId: "PGR de origem",
    title: "Título da fonte",
    reference: "Referência do documento",
    version: "Versão do documento",
    documentDate: "Data do documento",
    preparedBy: "Responsável pela elaboração",
    reviewDueOn: "Data de revisão",
    risks: "Riscos",
    supersedesSourceId: "Fonte anterior substituída",
  },
  lists: {
    risks: {
      item: "Risco",
      fields: {
        agentType: "categoria",
        description: "descrição",
        exposureGroup: "grupo / contexto de exposição",
        jobRole: "função",
        possibleInjuries: "possíveis lesões",
        exposureDescription: "informações de exposição",
        noxiousAgentCode: "código do agente nocivo",
      },
    },
  },
});

/** Chaves de erro que a tela mostra junto ao campo, conforme a origem e as linhas de risco. */
function sourceSlots(kind: string, riskCount: number): string[] {
  if (kind === "internal") return ["pgrId", "supersedesSourceId"];
  return [
    "title",
    "reference",
    "version",
    "documentDate",
    "preparedBy",
    "reviewDueOn",
    "risks",
    "supersedesSourceId",
    ...Array.from({ length: riskCount }, (_, i) =>
      RISK_FIELDS.map((field) => `risks.${i}.${field}`),
    ).flat(),
  ];
}

export function SourceForm({
  companyId,
  pgrs,
  sources,
}: {
  companyId: string;
  pgrs: { id: string; label: string }[];
  sources: { id: string; label: string }[];
}) {
  const [kind, setKind] = useState("external");
  const [risks, setRisks] = useState<DraftRisk[]>([emptyRisk()]);
  const { pending, feedback, run, fail, setFeedback } = useActionFeedback({
    describe: describeSourcePath,
    unexpectedMessage: "Não foi possível registrar a fonte. Tente novamente.",
  });
  const fields = feedback.fields;
  const risksErrorId = useId();
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
        const optional = (name: string) =>
          String(data.get(name) ?? "").trim() || undefined;
        const slots = sourceSlots(kind, risks.length);
        const input = medicalSourceInputSchema.safeParse(
          kind === "internal"
            ? { kind, pgrId: data.get("pgrId"), supersedesSourceId: previous }
            : {
                kind,
                title: data.get("title"),
                reference: data.get("reference"),
                version: data.get("version"),
                documentDate: optional("documentDate"),
                preparedBy: optional("preparedBy"),
                reviewDueOn: optional("reviewDueOn"),
                // Campo vazio não vira código: fica ausente e o coordenador define os exames.
                risks: risks.map(({ noxiousAgentCode, ...risk }) => ({
                  ...risk,
                  ...(noxiousAgentCode?.trim()
                    ? { noxiousAgentCode: noxiousAgentCode.trim() }
                    : {}),
                })),
                supersedesSourceId: previous,
              },
        );
        if (!input.success) {
          // Mesmo retorno do servidor: cada erro no campo (e na linha do risco) certo.
          setFeedback(
            formFeedback(
              { code: "VALIDATION", fields: fieldsFromIssues(input.error.issues) },
              { slots, describe: describeSourcePath },
            ),
          );
          return;
        }
        run(() => registerMedicalRiskSourceAction(companyId, input.data), {
          slots,
          onOk: () => {
            form.reset();
            setRisks([emptyRisk()]);
          },
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
            error={fields.pgrId}
          />
        ) : (
          <>
            <TextField
              name="title"
              label="Título da fonte"
              required
              error={fields.title}
            />
            <TextField
              name="reference"
              label="Referência do documento (ex.: identificação no GED)"
              required
              error={fields.reference}
            />
            <TextField
              name="version"
              label="Versão do documento"
              required
              error={fields.version}
            />
            <TextField
              name="documentDate"
              label="Data do documento"
              type="date"
              error={fields.documentDate}
            />
            <TextField
              name="preparedBy"
              label="Responsável pela elaboração (como consta no documento)"
              error={fields.preparedBy}
            />
            <TextField
              name="reviewDueOn"
              label="Data de revisão informada no documento (se houver)"
              type="date"
              error={fields.reviewDueOn}
            />
            <p className="text-text-muted text-sm">
              O documento externo não é autenticado nem considerado conforme à NR-1 por
              ser registrado: os riscos só entram no PCMSO depois da validação técnica por
              profissional autorizado pela empresa.
            </p>
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
                    fail("O arquivo deve ter até 2 MB.");
                    return;
                  }
                  try {
                    const parsed = medicalRiskListSchema.safeParse(
                      JSON.parse(await file.text()),
                    );
                    if (!parsed.success) {
                      fail(
                        "Lista inválida. Use categoria, descrição e grupo de exposição; não inclua status ou aprovador.",
                      );
                      return;
                    }
                    setRisks(parsed.data);
                    setFeedback(EMPTY_FORM_FEEDBACK);
                  } catch {
                    fail("Arquivo JSON inválido.");
                  }
                }}
              />
            </label>
            <p className="text-text-muted text-sm">
              Você também pode cadastrar os riscos abaixo. Nenhuma informação importada
              será aprovada automaticamente.
            </p>
            {risks.map((risk, index) => {
              const at = (field: (typeof RISK_FIELDS)[number]) =>
                fields[`risks.${index}.${field}`];
              const agentTypeError = at("agentType");
              const agentTypeErrorId = `${risksErrorId}-${index}-agentType`;
              return (
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
                      aria-invalid={agentTypeError ? true : undefined}
                      aria-describedby={agentTypeError ? agentTypeErrorId : undefined}
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
                    <FieldError id={agentTypeErrorId} message={agentTypeError} />
                  </label>
                  <TextField
                    name={`description-${index}`}
                    label="Descrição do risco"
                    required
                    value={risk.description}
                    onChange={(value) => updateRisk(index, { description: value })}
                    error={at("description")}
                  />
                  <TextField
                    name={`group-${index}`}
                    label="Grupo / contexto de exposição"
                    required
                    value={risk.exposureGroup}
                    onChange={(value) => updateRisk(index, { exposureGroup: value })}
                    error={at("exposureGroup")}
                  />
                  <TextField
                    name={`role-${index}`}
                    label="Função (se informada na origem)"
                    value={risk.jobRole ?? ""}
                    onChange={(value) => updateRisk(index, { jobRole: value })}
                    error={at("jobRole")}
                  />
                  <TextField
                    name={`injuries-${index}`}
                    label="Possíveis lesões informadas na origem"
                    value={risk.possibleInjuries ?? ""}
                    onChange={(value) => updateRisk(index, { possibleInjuries: value })}
                    error={at("possibleInjuries")}
                  />
                  <TextField
                    name={`exposure-${index}`}
                    label="Informações de exposição da origem"
                    value={risk.exposureDescription ?? ""}
                    onChange={(value) =>
                      updateRisk(index, { exposureDescription: value })
                    }
                    error={at("exposureDescription")}
                  />
                  <TextField
                    name={`agent-${index}`}
                    label="Código do agente nocivo — Tabela 24 do eSocial (se informado na origem)"
                    value={risk.noxiousAgentCode ?? ""}
                    onChange={(value) => updateRisk(index, { noxiousAgentCode: value })}
                    error={at("noxiousAgentCode")}
                  />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setRisks((current) =>
                        current.filter((_, position) => position !== index),
                      );
                      // As linhas mudam de posição: o erro de uma linha não pode cair em outra.
                      setFeedback(EMPTY_FORM_FEEDBACK);
                    }}
                  >
                    Remover este risco
                  </button>
                </fieldset>
              );
            })}
            <FieldError id={risksErrorId} message={fields.risks} />
            <button
              type="button"
              disabled={pending || risks.length >= 500}
              onClick={() => setRisks((current) => [...current, emptyRisk()])}
              aria-describedby={fields.risks ? risksErrorId : undefined}
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
          error={fields.supersedesSourceId}
        />
        <FormError message={feedback.formError} details={feedback.details} />
        <SubmitButton pending={pending} label="Registrar para revisão" />
      </FormSection>
    </form>
  );
}
