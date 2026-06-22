"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  createCompanyAction,
  updateCompanyAction,
} from "@/shared/server/actions/pgr/companies";
import type { CompanyInput, Company } from "@/shared/domains/pgr/companies";

import {
  FieldError,
  FormActions,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";

const RISK_GRADE_OPTIONS = [1, 2, 3, 4].map((n) => ({
  value: String(n),
  label: `Grau ${n}`,
}));

export function CompanyForm({ company }: { company?: Company }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const value = (key: string) => String(fd.get(key) ?? "");
    const input: CompanyInput = {
      cnpj: value("cnpj"),
      razaoSocial: value("razaoSocial"),
      nomeFantasia: value("nomeFantasia"),
      phone: value("phone"),
      email: value("email"),
      cnae: value("cnae"),
      mainActivity: value("mainActivity"),
      riskGrade: value("riskGrade"),
      logoPath: value("logoPath"),
      zipCode: value("zipCode"),
      street: value("street"),
      number: value("number"),
      complement: value("complement"),
      district: value("district"),
      city: value("city"),
      state: value("state"),
    };

    startTransition(async () => {
      const result = company
        ? await updateCompanyAction(company.id, input)
        : await createCompanyAction(input);
      if (result.ok) {
        router.push("/companies");
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
      <TextField
        label="Razão social"
        name="razaoSocial"
        required
        defaultValue={company?.razaoSocial}
        error={errors.razaoSocial}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="CNPJ"
          name="cnpj"
          defaultValue={company?.cnpj}
          error={errors.cnpj}
        />
        <TextField
          label="Nome fantasia"
          name="nomeFantasia"
          defaultValue={company?.nomeFantasia}
          error={errors.nomeFantasia}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Grau de Risco (NR-04)"
          name="riskGrade"
          required
          defaultValue={company?.riskGrade != null ? String(company.riskGrade) : ""}
          options={RISK_GRADE_OPTIONS}
          error={errors.riskGrade}
        />
        <TextField
          label="CNAE"
          name="cnae"
          defaultValue={company?.cnae}
          error={errors.cnae}
        />
      </div>
      <TextField
        label="Atividade principal"
        name="mainActivity"
        defaultValue={company?.mainActivity}
        error={errors.mainActivity}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Telefone"
          name="phone"
          defaultValue={company?.phone}
          error={errors.phone}
        />
        <TextField
          label="E-mail"
          name="email"
          defaultValue={company?.email}
          error={errors.email}
        />
      </div>

      <fieldset className="grid gap-4 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <legend className="px-1 text-sm font-medium">Endereço</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="CEP"
            name="zipCode"
            defaultValue={company?.zipCode}
            error={errors.zipCode}
          />
          <TextField
            label="Logradouro"
            name="street"
            defaultValue={company?.street}
            error={errors.street}
          />
          <TextField
            label="Número"
            name="number"
            defaultValue={company?.number}
            error={errors.number}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Complemento"
            name="complement"
            defaultValue={company?.complement}
            error={errors.complement}
          />
          <TextField
            label="Bairro"
            name="district"
            defaultValue={company?.district}
            error={errors.district}
          />
          <TextField
            label="Cidade"
            name="city"
            defaultValue={company?.city}
            error={errors.city}
          />
        </div>
        <TextField
          label="UF"
          name="state"
          defaultValue={company?.state}
          error={errors.state}
        />
      </fieldset>

      <TextField
        label="Logo (caminho)"
        name="logoPath"
        defaultValue={company?.logoPath}
        error={errors.logoPath}
      />
      <FieldError message={errors._} />

      <FormActions>
        <SubmitButton
          pending={pending}
          label={company ? "Salvar alterações" : "Criar empresa"}
        />
      </FormActions>
    </form>
  );
}
