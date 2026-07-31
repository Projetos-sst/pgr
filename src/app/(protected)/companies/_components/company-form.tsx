"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  createCompanyAction,
  updateCompanyAction,
} from "@/shared/server/actions/pgr/companies";
import type { CompanyInput, Company } from "@/shared/domains/pgr/companies";
import { useCnpjLookup } from "@/shared/integrations/client/use-cnpj-lookup";

import {
  CancelLink,
  FieldError,
  FormActions,
  FormError,
  FormSection,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";
import { AddressFields, type AddressValue } from "../../_ui/address-fields";

const RISK_GRADE_OPTIONS = [1, 2, 3, 4].map((n) => ({
  value: String(n),
  label: `Grau ${n}`,
}));

// Campos preenchidos pela consulta de CNPJ — controlados para permitir o autofill.
type CnpjFields = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnae: string;
  mainActivity: string;
};

function cnpjFieldsFrom(company?: Company): CnpjFields {
  return {
    cnpj: company?.cnpj ?? "",
    razaoSocial: company?.razaoSocial ?? "",
    nomeFantasia: company?.nomeFantasia ?? "",
    cnae: company?.cnae ?? "",
    mainActivity: company?.mainActivity ?? "",
  };
}

function addressFrom(company?: Company): AddressValue {
  return {
    zipCode: company?.zipCode ?? "",
    street: company?.street ?? "",
    number: company?.number ?? "",
    complement: company?.complement ?? "",
    district: company?.district ?? "",
    city: company?.city ?? "",
    state: company?.state ?? "",
  };
}

export function CompanyForm({ company }: { company?: Company }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [fields, setFields] = useState<CnpjFields>(cnpjFieldsFrom(company));
  const [address, setAddress] = useState<AddressValue>(addressFrom(company));

  const cnpjLookup = useCnpjLookup((found) => {
    setFields((prev) => ({
      ...prev,
      razaoSocial: found.razaoSocial || prev.razaoSocial,
      nomeFantasia: found.nomeFantasia || prev.nomeFantasia,
      cnae: found.cnae || prev.cnae,
      mainActivity: found.mainActivity || prev.mainActivity,
    }));
    setAddress((prev) => ({
      zipCode: found.address.zipCode || prev.zipCode,
      street: found.address.street || prev.street,
      number: found.address.number || prev.number,
      complement: found.address.complement || prev.complement,
      district: found.address.district || prev.district,
      city: found.address.city || prev.city,
      state: found.address.state || prev.state,
    }));
  });

  function setField(key: keyof CnpjFields) {
    return (value: string) => setFields((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const value = (key: string) => String(fd.get(key) ?? "");
    const input: CompanyInput = {
      cnpj: fields.cnpj,
      razaoSocial: fields.razaoSocial,
      nomeFantasia: fields.nomeFantasia,
      phone: value("phone"),
      email: value("email"),
      cnae: fields.cnae,
      mainActivity: fields.mainActivity,
      riskGrade: value("riskGrade"),
      logoPath: value("logoPath"),
      ...address,
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <FormError message={formError} />

      <FormSection title="Identificação">
        <TextField
          label="Razão social"
          name="razaoSocial"
          required
          isFullWidth
          value={fields.razaoSocial}
          onChange={setField("razaoSocial")}
          error={errors.razaoSocial}
        />
        <div>
          <TextField
            label="CNPJ"
            name="cnpj"
            isMono
            placeholder="00.000.000/0000-00"
            value={fields.cnpj}
            onChange={setField("cnpj")}
            onBlur={() => cnpjLookup.lookup(fields.cnpj)}
            error={errors.cnpj}
          />
          <CnpjStatus status={cnpjLookup.status} />
        </div>
        <TextField
          label="Nome fantasia"
          name="nomeFantasia"
          value={fields.nomeFantasia}
          onChange={setField("nomeFantasia")}
          error={errors.nomeFantasia}
        />
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
          value={fields.cnae}
          onChange={setField("cnae")}
          error={errors.cnae}
        />
        <TextField
          label="Atividade principal"
          name="mainActivity"
          isFullWidth
          value={fields.mainActivity}
          onChange={setField("mainActivity")}
          error={errors.mainActivity}
        />
      </FormSection>

      <FormSection title="Contato & marca">
        <TextField
          label="Telefone"
          name="phone"
          defaultValue={company?.phone}
          error={errors.phone}
        />
        <TextField
          label="E-mail"
          name="email"
          type="email"
          defaultValue={company?.email}
          error={errors.email}
        />
        <TextField
          label="Logo (caminho)"
          name="logoPath"
          isFullWidth
          defaultValue={company?.logoPath}
          error={errors.logoPath}
        />
      </FormSection>

      <AddressFields value={address} onChange={setAddress} errors={errors} />

      <FieldError message={errors._} />

      <FormActions>
        <CancelLink href="/companies" />
        <SubmitButton
          pending={pending}
          label={company ? "Salvar alterações" : "Criar empresa"}
        />
      </FormActions>
    </form>
  );
}

function CnpjStatus({
  status,
}: {
  status: "idle" | "loading" | "success" | "error" | "invalid";
}) {
  if (status === "loading") {
    return <span className="text-text-subtle mt-1 block text-xs">Buscando…</span>;
  }
  if (status === "error") {
    return (
      <span className="mt-1 block text-xs text-amber-600">
        CNPJ não encontrado. Preencha manualmente.
      </span>
    );
  }
  if (status === "invalid") {
    return (
      <span className="mt-1 block text-xs text-amber-600">
        CNPJ inválido — confira os dígitos.
      </span>
    );
  }
  return null;
}
