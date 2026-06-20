"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";

import {
  createWorkUnitAction,
  updateWorkUnitAction,
} from "@/shared/server/actions/pgr/work-units";
import type { WorkUnitInput, WorkUnit } from "@/shared/domains/pgr/work-units";
import type { CompanyOption } from "@/shared/domains/pgr/companies";

import {
  FieldError,
  FormActions,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";

type AddressState = {
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};

function emptyAddress(source?: WorkUnit | null): AddressState {
  return {
    zipCode: source?.zipCode ?? "",
    street: source?.street ?? "",
    number: source?.number ?? "",
    complement: source?.complement ?? "",
    district: source?.district ?? "",
    city: source?.city ?? "",
    state: source?.state ?? "",
  };
}

function companyHasAddress(company?: CompanyOption): boolean {
  if (!company) return false;
  return Boolean(
    company.zipCode ||
      company.street ||
      company.number ||
      company.district ||
      company.city ||
      company.state,
  );
}

export function WorkUnitForm({
  companies,
  workUnit,
}: {
  companies: CompanyOption[];
  workUnit?: WorkUnit;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [companyId, setCompanyId] = useState(workUnit?.companyId ?? "");
  const [address, setAddress] = useState<AddressState>(emptyAddress(workUnit));

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === companyId),
    [companies, companyId],
  );
  const canCopyAddress = companyHasAddress(selectedCompany);

  function copyCompanyAddress() {
    if (!selectedCompany) return;
    setAddress({
      zipCode: selectedCompany.zipCode ?? "",
      street: selectedCompany.street ?? "",
      number: selectedCompany.number ?? "",
      complement: selectedCompany.complement ?? "",
      district: selectedCompany.district ?? "",
      city: selectedCompany.city ?? "",
      state: selectedCompany.state ?? "",
    });
  }

  function setAddressField(key: keyof AddressState) {
    return (value: string) => setAddress((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const value = (key: string) => String(fd.get(key) ?? "");
    const input: WorkUnitInput = {
      companyId,
      name: value("name"),
      description: value("description"),
      contractNumber: value("contractNumber"),
      ...address,
    };

    startTransition(async () => {
      const result = workUnit
        ? await updateWorkUnitAction(workUnit.id, input)
        : await createWorkUnitAction(input);
      if (result.ok) {
        router.push("/work-units");
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
      <SelectField
        label="Empresa"
        name="companyId"
        required
        value={companyId}
        onChange={setCompanyId}
        options={companies.map((c) => ({ value: c.id, label: c.razaoSocial }))}
        error={errors.companyId}
      />
      <TextField label="Nome" name="name" required defaultValue={workUnit?.name} error={errors.name} />
      <TextField
        label="Objeto/descrição"
        name="description"
        required
        defaultValue={workUnit?.description}
        error={errors.description}
      />
      <TextField
        label="Nº do contrato"
        name="contractNumber"
        defaultValue={workUnit?.contractNumber}
        error={errors.contractNumber}
      />

      <fieldset className="grid gap-4 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <legend className="px-1 text-sm font-medium">Endereço</legend>
        <button
          type="button"
          onClick={copyCompanyAddress}
          disabled={!canCopyAddress}
          className="self-start rounded-md border border-black/15 px-3 py-1 text-sm transition-colors hover:bg-black/5 disabled:opacity-40 dark:border-white/15"
        >
          Preencher com endereço da empresa
        </button>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="CEP" name="zipCode" value={address.zipCode} onChange={setAddressField("zipCode")} />
          <TextField label="Logradouro" name="street" value={address.street} onChange={setAddressField("street")} />
          <TextField label="Número" name="number" value={address.number} onChange={setAddressField("number")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Complemento" name="complement" value={address.complement} onChange={setAddressField("complement")} />
          <TextField label="Bairro" name="district" value={address.district} onChange={setAddressField("district")} />
          <TextField label="Cidade" name="city" value={address.city} onChange={setAddressField("city")} />
        </div>
        <TextField label="UF" name="state" value={address.state} onChange={setAddressField("state")} />
      </fieldset>

      <FieldError message={errors._} />
      <FormActions>
        <SubmitButton pending={pending} label={workUnit ? "Salvar alterações" : "Criar unidade"} />
      </FormActions>
    </form>
  );
}
