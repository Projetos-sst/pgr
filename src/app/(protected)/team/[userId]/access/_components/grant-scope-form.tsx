"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";

import {
  ACCESS_AREAS,
  ACCESS_AREA_LABELS,
} from "@/shared/domains/platform/access-scopes";
import { PAGE_SIZE_MAX } from "@/shared/pagination";
import { listWorkUnitsAction } from "@/shared/server/actions/pgr/work-units";
import { grantAccessScopeAction } from "@/shared/server/actions/platform/access-scopes";

import { FormError, SelectField, SubmitButton } from "../../../../_ui/form";

type Option = { value: string; label: string };

const AREA_OPTIONS: Option[] = ACCESS_AREAS.map((area) => ({
  value: area,
  label: ACCESS_AREA_LABELS[area],
}));

export function GrantScopeForm({
  userId,
  companies,
}: {
  userId: string;
  companies: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [workUnitId, setWorkUnitId] = useState("");
  const [area, setArea] = useState("");
  const [workUnits, setWorkUnits] = useState<Option[]>([]);
  const requestedCompany = useRef("");

  async function loadWorkUnits(company: string) {
    const result = await listWorkUnitsAction({
      companyId: company,
      pageSize: PAGE_SIZE_MAX,
    });
    if (requestedCompany.current !== company || !result.ok) return;
    setWorkUnits(result.data.rows.map((row) => ({ value: row.id, label: row.name })));
  }

  function selectCompany(company: string) {
    requestedCompany.current = company;
    setCompanyId(company);
    setWorkUnitId("");
    setWorkUnits([]);
    if (company) void loadWorkUnits(company);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await grantAccessScopeAction(userId, {
        companyId,
        workUnitId,
        area,
      });
      if (!result.ok) {
        setErrors(result.error.fields ?? {});
        setFormError(result.error.message);
        return;
      }
      setErrors({});
      setFormError(null);
      setWorkUnitId("");
      setArea("");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="glass-card flex flex-col gap-3 p-4 lg:flex-row lg:items-end"
    >
      <div className="flex-1">
        <SelectField
          label="Empresa"
          name="companyId"
          required
          value={companyId}
          onChange={selectCompany}
          options={companies}
          error={errors.companyId}
        />
      </div>
      <div className="flex-1">
        <SelectField
          label="Obra"
          name="workUnitId"
          value={workUnitId}
          onChange={setWorkUnitId}
          options={workUnits}
          emptyLabel="Todas as obras da empresa"
          disabled={!companyId}
          error={errors.workUnitId}
        />
      </div>
      <div className="w-full lg:w-60">
        <SelectField
          label="Área"
          name="area"
          required
          value={area}
          onChange={setArea}
          options={AREA_OPTIONS}
          error={errors.area}
        />
      </div>
      <SubmitButton pending={pending} label="Conceder acesso" />
      {formError ? (
        <div className="w-full">
          <FormError message={formError} />
        </div>
      ) : null}
    </form>
  );
}
