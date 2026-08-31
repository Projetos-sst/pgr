"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";

import {
  createWorkUnitAction,
  updateWorkUnitAction,
} from "@/shared/server/actions/pgr/work-units";
import type { WorkUnitInput, WorkUnit } from "@/shared/domains/pgr/work-units";
import {
  WORK_UNIT_TYPES,
  WORK_UNIT_TYPE_LABELS,
  WORK_UNIT_STATUSES,
  WORK_UNIT_STATUS_LABELS,
} from "@/shared/domains/pgr/work-units";
import type { CompanyOption } from "@/shared/domains/pgr/companies";

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

const TYPE_OPTIONS = WORK_UNIT_TYPES.map((t) => ({
  value: t,
  label: WORK_UNIT_TYPE_LABELS[t],
}));
const STATUS_OPTIONS = WORK_UNIT_STATUSES.map((s) => ({
  value: s,
  label: WORK_UNIT_STATUS_LABELS[s],
}));

function addressFrom(source?: WorkUnit | null): AddressValue {
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
  const [address, setAddress] = useState<AddressValue>(addressFrom(workUnit));

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const value = (key: string) => String(fd.get(key) ?? "");
    const input: WorkUnitInput = {
      companyId,
      name: value("name"),
      description: value("description"),
      contractNumber: value("contractNumber"),
      type: (value("type") || undefined) as WorkUnitInput["type"],
      status: value("status") as WorkUnitInput["status"],
      startDate: value("startDate"),
      expectedEndDate: value("expectedEndDate"),
      managerName: value("managerName"),
      managerRole: value("managerRole"),
      professionalTitle: value("professionalTitle"),
      professionalRegistration: value("professionalRegistration"),
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <FormError message={formError} />

      <FormSection title="Identificação">
        <SelectField
          label="Empresa"
          name="companyId"
          required
          value={companyId}
          onChange={setCompanyId}
          options={companies.map((c) => ({ value: c.id, label: c.razaoSocial }))}
          error={errors.companyId}
        />
        <TextField
          label="Nome"
          name="name"
          required
          defaultValue={workUnit?.name}
          error={errors.name}
        />
        <TextField
          label="Nº do contrato"
          name="contractNumber"
          isMono
          defaultValue={workUnit?.contractNumber}
          error={errors.contractNumber}
        />
        <SelectField
          label="Tipo"
          name="type"
          defaultValue={workUnit?.type ?? ""}
          options={TYPE_OPTIONS}
          emptyLabel="— selecione —"
          error={errors.type}
        />
        <SelectField
          label="Situação"
          name="status"
          defaultValue={workUnit?.status ?? "active"}
          options={STATUS_OPTIONS}
          error={errors.status}
        />
        <TextField
          label="Escopo do Contrato"
          name="description"
          required
          isFullWidth
          defaultValue={workUnit?.description}
          error={errors.description}
        />
      </FormSection>

      <FormSection title="Vigência da obra">
        <TextField
          label="Início da obra"
          name="startDate"
          type="date"
          defaultValue={workUnit?.startDate ?? ""}
          error={errors.startDate}
        />
        <TextField
          label="Previsão de término"
          name="expectedEndDate"
          type="date"
          defaultValue={workUnit?.expectedEndDate ?? ""}
          error={errors.expectedEndDate}
        />
      </FormSection>

      <FormSection title="Responsável Técnico">
        <TextField
          label="Gestor/Preposto"
          name="managerName"
          defaultValue={workUnit?.managerName}
          error={errors.managerName}
        />
        <TextField
          label="Cargo do gestor/preposto"
          name="managerRole"
          defaultValue={workUnit?.managerRole}
          error={errors.managerRole}
        />
        <TextField
          label="Título profissional"
          name="professionalTitle"
          placeholder="Ex.: Engenheiro Civil, Técnico de Segurança do Trabalho"
          defaultValue={workUnit?.professionalTitle}
          error={errors.professionalTitle}
        />
        <TextField
          label="Registro no conselho de classe"
          name="professionalRegistration"
          placeholder="Ex.: CREA/CAU"
          isMono
          defaultValue={workUnit?.professionalRegistration}
          error={errors.professionalRegistration}
        />
      </FormSection>

      <AddressFields
        value={address}
        onChange={setAddress}
        errors={errors}
        headerSlot={
          <button
            type="button"
            onClick={copyCompanyAddress}
            disabled={!canCopyAddress}
            className="text-text-muted hover:text-text mb-4 self-start rounded-[11px] border border-white/70 bg-white/50 px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-40"
          >
            Preencher com endereço da empresa
          </button>
        }
      />

      <FieldError message={errors._} />
      <FormActions>
        <CancelLink href="/work-units" />
        <SubmitButton
          pending={pending}
          label={workUnit ? "Salvar alterações" : "Criar unidade"}
        />
      </FormActions>
    </form>
  );
}
