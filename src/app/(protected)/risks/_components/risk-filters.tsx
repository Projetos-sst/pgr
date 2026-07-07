"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { listWorkUnitsAction } from "@/shared/server/actions/pgr/work-units";
import { listGesAction } from "@/shared/server/actions/pgr/ges";
import type { CompanyOption } from "@/shared/domains/pgr/companies";

import { SelectField } from "../../_ui/form";

type Option = { id: string; name: string };

/** Filtro dependente Empresa → Obra/Contrato → GES: navega por query params. */
export function RiskFilters({
  companies,
  companyId,
  workUnitId,
  gesId,
}: {
  companies: CompanyOption[];
  companyId?: string;
  workUnitId?: string;
  gesId?: string;
}) {
  const router = useRouter();
  const [company, setCompany] = useState(companyId ?? "");
  const [workUnit, setWorkUnit] = useState(workUnitId ?? "");
  const [ges, setGes] = useState(gesId ?? "");
  const [workUnitOptions, setWorkUnitOptions] = useState<Option[]>([]);
  const [gesOptions, setGesOptions] = useState<Option[]>([]);

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

  useEffect(() => {
    if (!workUnit) return;
    let active = true;
    (async () => {
      const result = await listGesAction({ workUnitId: workUnit, pageSize: 100 });
      if (!active) return;
      setGesOptions(
        result.ok ? result.data.rows.map((g) => ({ id: g.id, name: g.name })) : [],
      );
    })();
    return () => {
      active = false;
    };
  }, [workUnit]);

  function navigate(nextCompany: string, nextWorkUnit: string, nextGes: string) {
    const usp = new URLSearchParams();
    if (nextCompany) usp.set("companyId", nextCompany);
    if (nextWorkUnit) usp.set("workUnitId", nextWorkUnit);
    if (nextGes) usp.set("gesId", nextGes);
    const qs = usp.toString();
    router.push(qs ? `/risks?${qs}` : "/risks");
  }

  function onCompany(value: string) {
    setCompany(value);
    setWorkUnit("");
    setGes("");
    setWorkUnitOptions([]);
    setGesOptions([]);
    navigate(value, "", "");
  }

  function onWorkUnit(value: string) {
    setWorkUnit(value);
    setGes("");
    setGesOptions([]);
    navigate(company, value, "");
  }

  function onGes(value: string) {
    setGes(value);
    navigate(company, workUnit, value);
  }

  return (
    <div className="grid gap-4 sm:max-w-3xl sm:grid-cols-3">
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
      <SelectField
        label="GES"
        name="gesId"
        value={ges}
        onChange={onGes}
        options={gesOptions.map((g) => ({ value: g.id, label: g.name }))}
        emptyLabel={workUnit && gesOptions.length === 0 ? "Obra sem GES" : "Todos os GES"}
      />
    </div>
  );
}
