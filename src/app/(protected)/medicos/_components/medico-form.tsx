"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  MEDICO_STATUS_LABELS,
  MEDICO_STATUSES,
  type MedicoInput,
} from "@/shared/domains/pgr/medicos";
import {
  createMedicoAction,
  updateMedicoAction,
} from "@/shared/server/actions/pgr/medicos";

import {
  CancelLink,
  FormActions,
  FormError,
  FormSection,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";

const STATUS_OPTIONS = MEDICO_STATUSES.map((value) => ({
  value,
  label: MEDICO_STATUS_LABELS[value],
}));

export type MedicoFormInitial = {
  name: string;
  crm: string;
  specialty: string | null;
  clinic: string | null;
  phone: string | null;
  status: string;
};

export function MedicoForm({
  id,
  initial,
}: {
  id?: string;
  initial?: MedicoFormInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input: MedicoInput = {
      name: (fd.get("name") as string) ?? "",
      crm: (fd.get("crm") as string) ?? "",
      specialty: (fd.get("specialty") as string) ?? "",
      clinic: (fd.get("clinic") as string) ?? "",
      phone: (fd.get("phone") as string) ?? "",
      status: ((fd.get("status") as string) || "active") as MedicoInput["status"],
    };
    startTransition(async () => {
      const result = id
        ? await updateMedicoAction(id, input)
        : await createMedicoAction(input);
      if (result.ok) {
        setErrors({});
        setFormError(null);
        router.push("/medicos");
        router.refresh();
      } else {
        setErrors(result.error.fields ?? {});
        setFormError(result.error.fields ? null : result.error.message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <FormError message={formError} />

      <FormSection title="Dados do médico">
        <TextField
          label="Nome"
          name="name"
          required
          isFullWidth
          placeholder="Ex.: Dra. Helena Marques"
          defaultValue={initial?.name}
          error={errors.name}
        />
        <TextField
          label="CRM"
          name="crm"
          required
          isMono
          placeholder="Ex.: CRM 12.345/MA"
          defaultValue={initial?.crm}
          error={errors.crm}
        />
        <TextField
          label="Especialidade"
          name="specialty"
          placeholder="Ex.: Medicina do Trabalho"
          defaultValue={initial?.specialty}
          error={errors.specialty}
        />
        <TextField
          label="Empresa / Clínica"
          name="clinic"
          placeholder="Ex.: Clínica SanaVida"
          defaultValue={initial?.clinic}
          error={errors.clinic}
        />
        <TextField
          label="Telefone"
          name="phone"
          placeholder="Ex.: (98) 3232-1010"
          defaultValue={initial?.phone}
          error={errors.phone}
        />
        <SelectField
          label="Status"
          name="status"
          defaultValue={initial?.status ?? "active"}
          options={STATUS_OPTIONS}
          error={errors.status}
        />
      </FormSection>

      <FormActions>
        <CancelLink href="/medicos" />
        <SubmitButton pending={pending} label={id ? "Salvar médico" : "Criar médico"} />
      </FormActions>
    </form>
  );
}
