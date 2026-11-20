"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";

import { createRiskAction, updateRiskAction } from "@/shared/server/actions/pgr/risks";
import { fillRisk } from "@/shared/server/actions/pgr/ai-risk-suggestion";
import { listWorkUnitsAction } from "@/shared/server/actions/pgr/work-units";
import { listGesAction } from "@/shared/server/actions/pgr/ges";
import {
  riskAgentTypeSchema,
  exposureTimeSchema,
  riskAgentTypeLabel,
  exposureTimeLabel,
} from "@/shared/domains/pgr/risks";
import {
  catalogAgentNames,
  unitOptionsFor,
} from "@/shared/domains/pgr/risk-agent-catalog";
import type { RiskInput } from "@/shared/domains/pgr/risk";
import type { CompanyOption } from "@/shared/domains/pgr/companies";
import type { ActionError } from "@/shared/server/result";
import {
  applyRiskFill,
  type RiskDraft,
  type RiskDraftField,
} from "@/shared/domains/pgr/ai-risk-suggestion";
import { aiFillErrorMessage } from "@/shared/domains/platform/ai-review";

import {
  FieldError,
  FormActions,
  FormError,
  FormSection,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";
import {
  AiFillButton,
  AiFilledBadge,
  AiSaveConfirm,
  useAiGenerateWarning,
} from "../../_ui/ai-review";

const AGENT_TYPE_OPTIONS = riskAgentTypeSchema.options.map((v) => ({
  value: v,
  label: riskAgentTypeLabel(v),
}));
const EXPOSURE_TIME_OPTIONS = exposureTimeSchema.options.map((v) => ({
  value: v,
  label: exposureTimeLabel(v),
}));

type Option = { id: string; name: string };

export type RiskFormInitial = {
  companyId?: string;
  workUnitId?: string;
  gesId?: string;
  agentType?: string;
  hazard?: string | null;
  description?: string | null;
  sources?: string | null;
  propagation?: string | null;
  exposureTime?: string | null;
  possibleInjuries?: string | null;
  noxiousAgentCode?: string | null;
  measurementUnit?: string | null;
  concentrationIntensity?: string | null;
};

export function RiskForm({
  companies,
  riskId,
  initial,
}: {
  companies: CompanyOption[];
  riskId?: string;
  initial?: RiskFormInitial;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [companyId, setCompanyId] = useState(initial?.companyId ?? "");
  const [workUnitId, setWorkUnitId] = useState(initial?.workUnitId ?? "");
  const [gesId, setGesId] = useState(initial?.gesId ?? "");
  const [{ draft, aiFilled }, setFields] = useState<{
    draft: RiskDraft;
    aiFilled: ReadonlySet<RiskDraftField>;
  }>({
    draft: {
      agentType: initial?.agentType ?? "",
      exposureTime: initial?.exposureTime ?? "",
      hazard: initial?.hazard ?? "",
      description: initial?.description ?? "",
      sources: initial?.sources ?? "",
      propagation: initial?.propagation ?? "",
      possibleInjuries: initial?.possibleInjuries ?? "",
    },
    aiFilled: new Set(),
  });
  const [pendingInput, setPendingInput] = useState<RiskInput | null>(null);
  const [filling, startFill] = useTransition();
  const agentType = draft.agentType;
  const [workUnitOptions, setWorkUnitOptions] = useState<Option[]>([]);
  const [gesOptions, setGesOptions] = useState<Option[]>([]);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    (async () => {
      const result = await listWorkUnitsAction({ companyId, pageSize: 100 });
      if (!active) return;
      setWorkUnitOptions(
        result.ok ? result.data.rows.map((w) => ({ id: w.id, name: w.name })) : [],
      );
    })();
    return () => {
      active = false;
    };
  }, [companyId]);

  useEffect(() => {
    if (!workUnitId) return;
    let active = true;
    (async () => {
      const result = await listGesAction({ workUnitId, pageSize: 100 });
      if (!active) return;
      setGesOptions(
        result.ok ? result.data.rows.map((g) => ({ id: g.id, name: g.name })) : [],
      );
    })();
    return () => {
      active = false;
    };
  }, [workUnitId]);

  function selectCompany(value: string) {
    setCompanyId(value);
    setWorkUnitId("");
    setGesId("");
    setWorkUnitOptions([]);
    setGesOptions([]);
  }

  function selectWorkUnit(value: string) {
    setWorkUnitId(value);
    setGesId("");
    setGesOptions([]);
  }

  function editField(field: RiskDraftField, value: string) {
    setFields((prev) => ({
      draft: { ...prev.draft, [field]: value },
      aiFilled: new Set([...prev.aiFilled].filter((f) => f !== field)),
    }));
  }

  function fill() {
    setFormError(null);
    startFill(async () => {
      const result = await fillRisk(gesId, {
        agentType: draft.agentType,
        hazard: draft.hazard,
        description: draft.description,
      });
      if (!result.ok) {
        setFormError(aiFillErrorMessage(result.error));
        return;
      }
      const risk = result.data.risk;
      if (!risk) {
        setFormError(
          "A IA pgr-e não conseguiu preencher este risco. Descreva melhor o GES ou preencha manualmente.",
        );
        return;
      }
      setFields((prev) => {
        const applied = applyRiskFill(prev.draft, risk);
        return {
          draft: applied.draft,
          aiFilled: new Set([...prev.aiFilled, ...applied.filled]),
        };
      });
    });
  }

  const warning = useAiGenerateWarning(fill);

  function aiBadge(field: RiskDraftField) {
    return aiFilled.has(field) ? <AiFilledBadge className="mt-1.5" /> : null;
  }

  function buildInput(formEl: HTMLFormElement): RiskInput {
    const fd = new FormData(formEl);
    const value = (key: string) => String(fd.get(key) ?? "");
    return {
      companyId,
      workUnitId,
      gesId,
      agentType: value("agentType") as RiskInput["agentType"],
      hazard: value("hazard"),
      description: value("description"),
      sources: value("sources"),
      propagation: value("propagation"),
      exposureTime: value("exposureTime") as RiskInput["exposureTime"],
      possibleInjuries: value("possibleInjuries"),
      noxiousAgentCode: value("noxiousAgentCode"),
      measurementUnit: value("measurementUnit") as RiskInput["measurementUnit"],
      concentrationIntensity: value("concentrationIntensity"),
    };
  }

  function applyError(error: ActionError) {
    setErrors(error.fields ?? {});
    setFormError(error.fields ? null : error.message);
  }

  function save(input: RiskInput) {
    startTransition(async () => {
      const result = riskId
        ? await updateRiskAction(riskId, input)
        : await createRiskAction(input);
      if (result.ok) {
        router.push("/risks");
        router.refresh();
        return;
      }
      setPendingInput(null);
      applyError(result.error);
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = buildInput(event.currentTarget);
    if (aiFilled.size > 0) {
      setPendingInput(input);
      return;
    }
    save(input);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-[22px]">
      <FormError message={formError} />

      <FormSection title="Localização do risco" columns={3}>
        <SelectField
          label="Empresa"
          name="companyId"
          required
          value={companyId}
          onChange={selectCompany}
          options={companies.map((c) => ({ value: c.id, label: c.razaoSocial }))}
        />
        <SelectField
          label="Obra/Contrato"
          name="workUnitId"
          value={workUnitId}
          onChange={selectWorkUnit}
          options={workUnitOptions.map((w) => ({ value: w.id, label: w.name }))}
          emptyLabel={
            companyId && workUnitOptions.length === 0
              ? "Empresa sem obras"
              : "— selecione —"
          }
        />
        <SelectField
          label="GES"
          name="gesId"
          required
          value={gesId}
          onChange={setGesId}
          options={gesOptions.map((g) => ({ value: g.id, label: g.name }))}
          emptyLabel={
            workUnitId && gesOptions.length === 0 ? "Obra sem GES" : "— selecione —"
          }
          error={errors.gesId}
        />
      </FormSection>

      {gesId ? (
        <div className="glass-panel rounded-card flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-text-muted text-sm">
            A IA pgr-e preenche este risco a partir do GES e do que você já digitou.
            Revise antes de salvar.
          </p>
          <AiFillButton onClick={warning.request} pending={filling} disabled={pending} />
        </div>
      ) : null}

      <FormSection title="Caracterização do agente">
        <div>
          <SelectField
            label="Grupo do agente"
            name="agentType"
            required
            value={draft.agentType}
            onChange={(v) => editField("agentType", v)}
            options={AGENT_TYPE_OPTIONS}
            error={errors.agentType}
          />
          {aiBadge("agentType")}
        </div>
        <div>
          <SelectField
            label="Tempo de exposição"
            name="exposureTime"
            value={draft.exposureTime}
            onChange={(v) => editField("exposureTime", v)}
            options={EXPOSURE_TIME_OPTIONS}
            emptyLabel="— não informado —"
            error={errors.exposureTime}
          />
          {aiBadge("exposureTime")}
        </div>
        <div>
          <TextField
            label="Perigo"
            name="hazard"
            value={draft.hazard}
            onChange={(v) => editField("hazard", v)}
            suggestions={catalogAgentNames(agentType)}
            error={errors.hazard}
          />
          {aiBadge("hazard")}
        </div>
        <div>
          <TextField
            label="Descrição"
            name="description"
            required
            value={draft.description}
            onChange={(v) => editField("description", v)}
            error={errors.description}
          />
          {aiBadge("description")}
        </div>
      </FormSection>

      <FormSection title="Fontes, propagação e lesões">
        <div>
          <TextField
            label="Fontes geradoras"
            name="sources"
            value={draft.sources}
            onChange={(v) => editField("sources", v)}
            error={errors.sources}
          />
          {aiBadge("sources")}
        </div>
        <div>
          <TextField
            label="Meios de propagação"
            name="propagation"
            value={draft.propagation}
            onChange={(v) => editField("propagation", v)}
            error={errors.propagation}
          />
          {aiBadge("propagation")}
        </div>
        <div>
          <TextField
            label="Possíveis lesões"
            name="possibleInjuries"
            value={draft.possibleInjuries}
            onChange={(v) => editField("possibleInjuries", v)}
            error={errors.possibleInjuries}
          />
          {aiBadge("possibleInjuries")}
        </div>
      </FormSection>

      <FormSection title="eSocial e medição de referência" columns={3}>
        <TextField
          label="Código do agente (S-2240)"
          name="noxiousAgentCode"
          defaultValue={initial?.noxiousAgentCode ?? ""}
          error={errors.noxiousAgentCode}
        />
        <SelectField
          label="Unidade de medida"
          name="measurementUnit"
          defaultValue={initial?.measurementUnit ?? ""}
          options={unitOptionsFor(agentType)}
          emptyLabel="— não informado —"
          error={errors.measurementUnit}
        />
        <TextField
          label="Concentração/intensidade"
          name="concentrationIntensity"
          defaultValue={initial?.concentrationIntensity ?? ""}
          error={errors.concentrationIntensity}
        />
      </FormSection>

      <FieldError message={errors._} />
      <FormActions>
        <SubmitButton
          pending={pending}
          label={riskId ? "Salvar alterações" : "Criar risco"}
        />
      </FormActions>

      {warning.modal}
      <AiSaveConfirm
        open={pendingInput !== null}
        pending={pending}
        onConfirm={() => pendingInput && save(pendingInput)}
        onCancel={() => setPendingInput(null)}
      />
    </form>
  );
}
