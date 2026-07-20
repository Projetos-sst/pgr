"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";

import {
  ACCIDENT_CATEGORY_LABELS,
  ACCIDENT_SEVERITY_LABELS,
  ACCIDENT_TYPE_LABELS,
  type AccidentCreateInput,
  type AccidentUpdateInput,
} from "@/shared/domains/safety/accident";
import {
  createAccidentAction,
  updateAccidentAction,
} from "@/shared/server/actions/safety/accidents";

import { FormActions, FormError, SubmitButton } from "../../_ui/form";

type Option = { value: string; label: string };

export type IncidentFormInitial = {
  companyId: string | null;
  employeeId: string | null;
  occurredAt: string; // datetime-local (YYYY-MM-DDThh:mm)
  type: string;
  category: string;
  severity: string;
  location: string | null;
  description: string | null;
  awayFromWork: boolean | null;
  workedHours: string | null;
  hospital: string | null;
  injuryNatureCode: string | null;
  injuryNatureDescription: string | null;
  bodyPartCode: string | null;
  bodyPartDescription: string | null;
  causativeAgentCode: string | null;
  causativeAgentDescription: string | null;
  causes: string | null;
  environmentalImpact: string | null;
  materialLoss: string | null;
  thirdParties: string | null;
  fatalityPotential: boolean | null;
  responsibleArea: string | null;
  activityProcedure: string | null;
  witnesses: string | null;
  investigationNotes: string | null;
  catNumber: string | null;
  catIssuedAt: string | null;
};

const inputClass = "glass-input text-text rounded-card px-3 py-2 text-sm outline-none";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="glass-card flex flex-col gap-4 p-5">
      <h2 className="text-text text-sm font-semibold">{title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Text({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  full,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  type?: string;
  required?: boolean;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-text-muted text-sm font-semibold">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        className={inputClass}
      />
    </label>
  );
}

function Area({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
}) {
  return (
    <label className="flex flex-col gap-1 sm:col-span-2">
      <span className="text-text-muted text-sm font-semibold">{label}</span>
      <textarea
        name={name}
        rows={3}
        defaultValue={defaultValue ?? ""}
        className={inputClass}
      />
    </label>
  );
}

function Select({
  label,
  name,
  defaultValue,
  options,
  required,
  emptyLabel,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  options: Option[];
  required?: boolean;
  emptyLabel?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-text-muted text-sm font-semibold">
        {label}
        {required ? " *" : ""}
      </span>
      <select name={name} defaultValue={defaultValue ?? ""} className={inputClass}>
        {emptyLabel ? <option value="">{emptyLabel}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Check({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean | null;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked ?? false}
        className="h-4 w-4"
      />
      <span className="text-text-muted font-semibold">{label}</span>
    </label>
  );
}

const toOptions = (labels: Record<string, string>): Option[] =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

export function IncidentForm({
  id,
  companies,
  employees,
  initial,
}: {
  id?: string;
  companies: Option[];
  employees: Option[];
  initial: IncidentFormInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const str = (name: string) => {
      const v = (fd.get(name) as string | null)?.trim();
      return v ? v : undefined;
    };
    const workedHoursRaw = str("workedHours");

    const payload: AccidentCreateInput = {
      companyId: (fd.get("companyId") as string) ?? "",
      employeeId: str("employeeId"),
      occurredAt: (fd.get("occurredAt") as string) ?? "",
      type: fd.get("type") as AccidentCreateInput["type"],
      category: fd.get("category") as AccidentCreateInput["category"],
      severity: fd.get("severity") as AccidentCreateInput["severity"],
      location: str("location"),
      description: str("description"),
      awayFromWork: fd.get("awayFromWork") === "on",
      workedHours: workedHoursRaw != null ? Number(workedHoursRaw) : undefined,
      hospital: str("hospital"),
      injuryNatureCode: str("injuryNatureCode"),
      injuryNatureDescription: str("injuryNatureDescription"),
      bodyPartCode: str("bodyPartCode"),
      bodyPartDescription: str("bodyPartDescription"),
      causativeAgentCode: str("causativeAgentCode"),
      causativeAgentDescription: str("causativeAgentDescription"),
      causes: str("causes"),
      environmentalImpact: str("environmentalImpact"),
      materialLoss: str("materialLoss"),
      thirdParties: str("thirdParties"),
      fatalityPotential: fd.get("fatalityPotential") === "on",
      responsibleArea: str("responsibleArea"),
      activityProcedure: str("activityProcedure"),
      witnesses: str("witnesses"),
      investigationNotes: str("investigationNotes"),
      catNumber: str("catNumber"),
      catIssuedAt: str("catIssuedAt"),
    };

    startTransition(async () => {
      const result = id
        ? await updateAccidentAction(id, payload as AccidentUpdateInput)
        : await createAccidentAction(payload);
      if (result.ok) {
        setFormError(null);
        router.push(id ? `/incidents/${id}` : `/incidents/${result.data.id}`);
        router.refresh();
      } else {
        setFormError(result.error.message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-3xl flex-col gap-5">
      <FormError message={formError} />

      <Section title="Identificação">
        <Select
          label="Empresa"
          name="companyId"
          required
          defaultValue={initial.companyId}
          options={companies}
          emptyLabel="— selecione —"
        />
        <Select
          label="Funcionário (opcional)"
          name="employeeId"
          defaultValue={initial.employeeId}
          options={employees}
          emptyLabel="— sem funcionário —"
        />
      </Section>

      <Section title="Ocorrência">
        <Text
          label="Data/hora da ocorrência"
          name="occurredAt"
          type="datetime-local"
          required
          defaultValue={initial.occurredAt}
        />
        <Text label="Local" name="location" defaultValue={initial.location} />
        <Area label="Descrição" name="description" defaultValue={initial.description} />
        <Area
          label="Atividade/procedimento"
          name="activityProcedure"
          defaultValue={initial.activityProcedure}
        />
      </Section>

      <Section title="Classificação">
        <Select
          label="Tipo"
          name="type"
          required
          defaultValue={initial.type}
          options={toOptions(ACCIDENT_TYPE_LABELS)}
        />
        <Select
          label="Categoria"
          name="category"
          required
          defaultValue={initial.category}
          options={toOptions(ACCIDENT_CATEGORY_LABELS)}
        />
        <Select
          label="Severidade"
          name="severity"
          required
          defaultValue={initial.severity}
          options={toOptions(ACCIDENT_SEVERITY_LABELS)}
        />
      </Section>

      <Section title="Afastamento e atendimento">
        <Check
          label="Houve afastamento"
          name="awayFromWork"
          defaultChecked={initial.awayFromWork}
        />
        <Text
          label="Horas trabalhadas no dia"
          name="workedHours"
          type="number"
          defaultValue={initial.workedHours}
        />
        <Text
          label="Hospital/atendimento"
          name="hospital"
          defaultValue={initial.hospital}
        />
      </Section>

      <Section title="Causas e investigação">
        <Area label="Causas" name="causes" defaultValue={initial.causes} />
        <Text
          label="Natureza da lesão — código"
          name="injuryNatureCode"
          defaultValue={initial.injuryNatureCode}
        />
        <Text
          label="Natureza da lesão — descrição"
          name="injuryNatureDescription"
          defaultValue={initial.injuryNatureDescription}
        />
        <Text
          label="Parte do corpo — código"
          name="bodyPartCode"
          defaultValue={initial.bodyPartCode}
        />
        <Text
          label="Parte do corpo — descrição"
          name="bodyPartDescription"
          defaultValue={initial.bodyPartDescription}
        />
        <Text
          label="Agente causador — código"
          name="causativeAgentCode"
          defaultValue={initial.causativeAgentCode}
        />
        <Text
          label="Agente causador — descrição"
          name="causativeAgentDescription"
          defaultValue={initial.causativeAgentDescription}
        />
        <Area label="Testemunhas" name="witnesses" defaultValue={initial.witnesses} />
        <Area
          label="Notas de investigação"
          name="investigationNotes"
          defaultValue={initial.investigationNotes}
        />
      </Section>

      <Section title="Impactos">
        <Text
          label="Área responsável"
          name="responsibleArea"
          defaultValue={initial.responsibleArea}
        />
        <Check
          label="Potencial de fatalidade"
          name="fatalityPotential"
          defaultChecked={initial.fatalityPotential}
        />
        <Area
          label="Impacto ambiental"
          name="environmentalImpact"
          defaultValue={initial.environmentalImpact}
        />
        <Area
          label="Perdas materiais"
          name="materialLoss"
          defaultValue={initial.materialLoss}
        />
        <Area label="Terceiros" name="thirdParties" defaultValue={initial.thirdParties} />
      </Section>

      <Section title="CAT interno">
        <div className="sm:col-span-2">
          <p className="text-text-subtle text-xs">
            Registro interno de CAT — preenchimento manual, sem validação em sistema
            externo e sem emissão oficial (S-2210) pelo sistema.
          </p>
        </div>
        <Text label="Número da CAT" name="catNumber" defaultValue={initial.catNumber} />
        <Text
          label="Data de emissão da CAT"
          name="catIssuedAt"
          type="date"
          defaultValue={initial.catIssuedAt}
        />
      </Section>

      <FormActions>
        <SubmitButton pending={pending} label={id ? "Salvar" : "Registrar incidente"} />
      </FormActions>
    </form>
  );
}
