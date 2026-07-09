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
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      <FormError message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
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
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
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
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            Nº de trabalhadores expostos (derivado)
          </span>
          <output className="rounded-md border border-black/10 bg-black/3 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5">
            {exposedWorkers}
          </output>
        </div>
      ) : null}

      <fieldset className="grid gap-4 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <legend className="px-1 text-sm font-medium">Caracterização do ambiente</legend>
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
