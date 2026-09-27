"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";

import { createRiskAction, updateRiskAction } from "@/shared/server/actions/pgr/risks";
import { listWorkUnitsAction } from "@/shared/server/actions/pgr/work-units";
import { listGesAction } from "@/shared/server/actions/pgr/ges";
import {
  riskAgentTypeSchema,
  exposureTimeSchema,
  measurementUnitSchema,
  riskAgentTypeLabel,
  exposureTimeLabel,
  measurementUnitLabel,
} from "@/shared/domains/pgr/risks";
import type { RiskInput } from "@/shared/domains/pgr/risk";
import type { CompanyOption } from "@/shared/domains/pgr/companies";
import type { ActionError } from "@/shared/server/result";

import { RISK_FIELD_HINTS } from "@/shared/domains/pgr/field-hints";

import {
  FieldError,
  FormActions,
  FormError,
  FormSection,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";
import { FieldHint } from "../../_ui/field-hint";

const AGENT_TYPE_OPTIONS = riskAgentTypeSchema.options.map((v) => ({
  value: v,
  label: riskAgentTypeLabel(v),
}));
const EXPOSURE_TIME_OPTIONS = exposureTimeSchema.options.map((v) => ({
  value: v,
  label: exposureTimeLabel(v),
}));
const MEASUREMENT_UNIT_OPTIONS = measurementUnitSchema.options.map((v) => ({
  value: v,
  label: measurementUnitLabel(v),
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

  function buildInput(formEl: HTMLFormElement): RiskInput {
    const fd = new FormData(formEl);
    const value = (key: string) => String(fd.get(key) ?? "");
    return {
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = buildInput(event.currentTarget);
    startTransition(async () => {
      const result = riskId
        ? await updateRiskAction(riskId, input)
        : await createRiskAction(input);
      if (result.ok) {
        router.push("/risks");
        router.refresh();
        return;
      }
      applyError(result.error);
    });
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

      <FormSection title="Caracterização do agente">
        <SelectField
          label="Grupo do agente"
          name="agentType"
          required
          defaultValue={initial?.agentType ?? ""}
          options={AGENT_TYPE_OPTIONS}
          error={errors.agentType}
        />
        <SelectField
          label="Tempo de exposição"
          name="exposureTime"
          defaultValue={initial?.exposureTime ?? ""}
          options={EXPOSURE_TIME_OPTIONS}
          emptyLabel="— não informado —"
          error={errors.exposureTime}
        />
        <TextField
          label="Perigo"
          name="hazard"
          defaultValue={initial?.hazard ?? ""}
          error={errors.hazard}
        />
        <TextField
          label="Descrição"
          name="description"
          required
          defaultValue={initial?.description ?? ""}
          error={errors.description}
        />
      </FormSection>

      <FormSection title="Fontes, propagação e lesões">
        <div>
          <TextField
            label="Fontes geradoras"
            name="sources"
            defaultValue={initial?.sources ?? ""}
            error={errors.sources}
          />
          <FieldHint>{RISK_FIELD_HINTS.sources}</FieldHint>
        </div>
        <div>
          <TextField
            label="Meios de propagação"
            name="propagation"
            defaultValue={initial?.propagation ?? ""}
            error={errors.propagation}
          />
          <FieldHint>{RISK_FIELD_HINTS.propagation}</FieldHint>
        </div>
        <div>
          <TextField
            label="Possíveis lesões"
            name="possibleInjuries"
            defaultValue={initial?.possibleInjuries ?? ""}
            error={errors.possibleInjuries}
          />
          <FieldHint>{RISK_FIELD_HINTS.possibleInjuries}</FieldHint>
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
          options={MEASUREMENT_UNIT_OPTIONS}
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
    </form>
  );
}
