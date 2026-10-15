"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  createJobRoleAction,
  updateJobRoleAction,
} from "@/shared/server/actions/pgr/job-roles";
import type { JobRoleInput, JobRole } from "@/shared/domains/pgr/job-roles";
import type { CompanyOption } from "@/shared/domains/pgr/companies";

/** Opção de GES para o select (id + nome) — evita importar o repositório no client. */
type GesOption = { id: string; name: string };

import {
  CancelLink,
  FieldError,
  FormActions,
  FormError,
  FormSection,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "../../_ui/form";

const STATUS_OPTIONS = [
  { value: "true", label: "Ativa" },
  { value: "false", label: "Inativa" },
];

export function JobRoleForm({
  companies,
  gesOptions,
  jobRole,
}: {
  companies: CompanyOption[];
  gesOptions: GesOption[];
  jobRole?: JobRole;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const value = (key: string) => String(fd.get(key) ?? "");
    const input: JobRoleInput = {
      companyId: value("companyId"),
      title: value("title"),
      cbo: value("cbo"),
      sector: value("sector"),
      workSchedule: value("workSchedule"),
      description: value("description"),
      isActive: value("isActive"),
      gesId: value("gesId") || undefined,
    };

    startTransition(async () => {
      const result = jobRole
        ? await updateJobRoleAction(jobRole.id, input)
        : await createJobRoleAction(input);
      if (result.ok) {
        router.push("/job-roles");
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

      <FormSection title="Função">
        <SelectField
          label="Empresa"
          name="companyId"
          required
          defaultValue={jobRole?.companyId}
          options={companies.map((c) => ({ value: c.id, label: c.razaoSocial }))}
          error={errors.companyId}
        />
        <TextField
          label="Função"
          name="title"
          required
          defaultValue={jobRole?.title}
          error={errors.title}
        />
        <TextField
          label="CBO"
          name="cbo"
          isMono
          placeholder="0000-00"
          defaultValue={jobRole?.cbo}
          error={errors.cbo}
        />
        <TextField
          label="Setor"
          name="sector"
          placeholder="Ex.: Obra Civil, SESMT, Logística"
          defaultValue={jobRole?.sector}
          error={errors.sector}
        />
        <SelectField
          label="GES (vincular)"
          name="gesId"
          options={gesOptions.map((g) => ({ value: g.id, label: g.name }))}
          emptyLabel="— nenhum —"
          error={errors.gesId}
        />
        <SelectField
          label="Situação"
          name="isActive"
          defaultValue={jobRole ? String(jobRole.isActive) : "true"}
          options={STATUS_OPTIONS}
          error={errors.isActive}
        />
        <TextField
          label="Jornada"
          name="workSchedule"
          placeholder="Ex.: 44h semanais"
          defaultValue={jobRole?.workSchedule}
          error={errors.workSchedule}
        />
        <TextAreaField
          label="Descrição das atividades"
          name="description"
          placeholder="Atribuições e responsabilidades do cargo"
          defaultValue={jobRole?.description}
          error={errors.description}
        />
      </FormSection>

      <FieldError message={errors._} />
      <FormActions>
        <CancelLink href="/job-roles" />
        <SubmitButton
          pending={pending}
          label={jobRole ? "Salvar alterações" : "Criar função"}
        />
      </FormActions>
    </form>
  );
}
