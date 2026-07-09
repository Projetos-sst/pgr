"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { listWorkUnitsAction } from "@/shared/server/actions/pgr/work-units";
import type { CompanyOption } from "@/shared/domains/pgr/companies";

import { SelectField } from "../../_ui/form";

type WorkUnitOption = { id: string; name: string };

/** Filtro dependente Empresa → Obra/Contrato: navega por query params. */
export function PgrFilters({
  companies,
  companyId,
  workUnitId,
}: {
  companies: CompanyOption[];
  companyId?: string;
  workUnitId?: string;
}) {
  const router = useRouter();
  const [company, setCompany] = useState(companyId ?? "");
  const [workUnit, setWorkUnit] = useState(workUnitId ?? "");
  const [workUnitOptions, setWorkUnitOptions] = useState<WorkUnitOption[]>([]);

  useEffect(() => {
    if (!company) return;
    let active = true;
    (async () => {
      const result = await listWorkUnitsAction({ companyId: company, pageSize: 100 });
      if (!active) return;
      setWorkUnitOptions(
        result.ok ? result.data.rows.map((w) => ({ id: w.id, name: w.name })) : [],
      );
    })();
    return () => {
      active = false;
    };
  }, [company]);

  function navigate(nextCompany: string, nextWorkUnit: string) {
    const usp = new URLSearchParams();
    if (nextCompany) usp.set("companyId", nextCompany);
    if (nextWorkUnit) usp.set("workUnitId", nextWorkUnit);
    const qs = usp.toString();
    router.push(qs ? `/pgr?${qs}` : "/pgr");
  }

  function onCompany(value: string) {
    setCompany(value);
    setWorkUnit("");
    setWorkUnitOptions([]);
    navigate(value, "");
  }

  function onWorkUnit(value: string) {
    setWorkUnit(value);
    navigate(company, value);
  }

  return (
    <div className="grid gap-4 sm:max-w-xl sm:grid-cols-2">
      <SelectField
        label="Empresa"
        name="companyId"
        value={company}
        onChange={onCompany}
        options={companies.map((c) => ({ value: c.id, label: c.razaoSocial }))}
        emptyLabel="Todas as empresas"
      />
      <SelectField
        label="Obra/Contrato"
        name="workUnitId"
        value={workUnit}
        onChange={onWorkUnit}
        options={workUnitOptions.map((w) => ({ value: w.id, label: w.name }))}
        emptyLabel={
          company && workUnitOptions.length === 0 ? "Empresa sem obras" : "Todas as obras"
        }
      />
    </div>
  );
}
