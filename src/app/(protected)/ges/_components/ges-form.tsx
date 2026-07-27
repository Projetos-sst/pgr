"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";

import { createGesAction, updateGesAction } from "@/shared/server/actions/pgr/ges";
import { listWorkUnitsAction } from "@/shared/server/actions/pgr/work-units";
import type { GesInput, Ges } from "@/shared/domains/pgr/ges";
import type { CompanyOption } from "@/shared/domains/pgr/companies";

import { GES_FIELD_HINTS } from "@/shared/domains/pgr/field-hints";

import {
  FieldError,
  FormActions,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";
import { FieldHint } from "../../_ui/field-hint";

type WorkUnitOption = { id: string; name: string };

const ENV_FIELDS: { name: keyof Ges; label: string }[] = [
  { name: "processDescription", label: "Descrição do processo" },
  { name: "constructionType", label: "Tipo de construção" },
  { name: "ceilingHeight", label: "Pé-direito" },
  { name: "floor", label: "Piso" },
  { name: "roof", label: "Cobertura" },
  { name: "lighting", label: "Iluminação" },
  { name: "ventilation", label: "Ventilação" },
  { name: "otherCharacteristics", label: "Outras características" },
];

export function GesForm({
  companies,
  ges,
  exposedWorkers,
}: {
  companies: CompanyOption[];
  ges?: Ges;
  exposedWorkers?: number;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [companyId, setCompanyId] = useState(ges?.companyId ?? "");
  const [workUnitId, setWorkUnitId] = useState(ges?.workUnitId ?? "");
  const [workUnits, setWorkUnits] = useState<WorkUnitOption[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    (async () => {
      const result = await listWorkUnitsAction({ companyId, pageSize: 100 });
      if (!active) return;
      setWorkUnits(
        result.ok ? result.data.rows.map((w) => ({ id: w.id, name: w.name })) : [],
      );
      setLoadedFor(companyId);
    })();
    return () => {
      active = false;
    };
  }, [companyId]);

  function selectCompany(value: string) {
    setCompanyId(value);
    setWorkUnitId("");
    setWorkUnits([]);
    setLoadedFor(null);
  }

  const noWorkUnits =
    loadedFor === companyId && companyId !== "" && workUnits.length === 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const value = (key: string) => String(fd.get(key) ?? "");
    const input: GesInput = {
      companyId,
      workUnitId,
      name: value("name"),
      processDescription: value("processDescription"),
      constructionType: value("constructionType"),
      ceilingHeight: value("ceilingHeight"),
      floor: value("floor"),
      roof: value("roof"),
      lighting: value("lighting"),
      ventilation: value("ventilation"),
      otherCharacteristics: value("otherCharacteristics"),
    };

    startTransition(async () => {
      const result = ges
        ? await updateGesAction(ges.id, input)
        : await createGesAction(input);
      if (result.ok) {
        router.push("/ges");
        router.refresh();
        return;
      }
      setErrors(result.error.fields ?? {});
      setFormError(result.error.fields ? null : result.error.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-6">
      <FormError message={formError} />
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
        <SelectField
          label="Empresa"
          name="companyId"
          required
          value={companyId}
          onChange={selectCompany}
          options={companies.map((c) => ({ value: c.id, label: c.razaoSocial }))}
          error={errors.companyId}
        />
        <SelectField
          label="Unidade de obra"
          name="workUnitId"
          required
          value={workUnitId}
          onChange={setWorkUnitId}
          options={workUnits.map((w) => ({ value: w.id, label: w.name }))}
          error={errors.workUnitId}
        />
      </div>
      {noWorkUnits ? (
        <p className="rounded-card border border-amber-300/60 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-800 dark:text-amber-300">
          Esta empresa não possui unidades de obra. Cadastre uma unidade antes de criar um
          GES.
        </p>
      ) : null}

      <TextField
        label="Nome do GES"
        name="name"
        required
        defaultValue={ges?.name}
        error={errors.name}
      />

      {exposedWorkers !== undefined ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-text-subtle text-xs font-semibold">
            Nº de trabalhadores expostos (derivado)
          </span>
          <output className="glass-panel text-text rounded-card px-4 py-2.5 text-sm font-bold">
            {exposedWorkers}
          </output>
        </div>
      ) : null}

      <fieldset className="glass-panel flex flex-col gap-4 rounded-[16px] p-5 sm:p-6">
        <legend className="text-text px-2 text-sm font-bold">
          Caracterização do ambiente
        </legend>
        <FieldHint>{GES_FIELD_HINTS.processDescription}</FieldHint>
        <FieldHint>{GES_FIELD_HINTS.environment}</FieldHint>
        <div className="grid gap-4 sm:grid-cols-2">
          {ENV_FIELDS.map((field) => (
            <TextField
              key={field.name}
              label={field.label}
              name={field.name}
              defaultValue={(ges?.[field.name] as string | null | undefined) ?? ""}
            />
          ))}
        </div>
      </fieldset>

      <FieldError message={errors._} />
      <FormActions>
        <SubmitButton
          pending={pending || noWorkUnits}
          label={ges ? "Salvar alterações" : "Criar GES"}
        />
      </FormActions>
    </form>
  );
}
