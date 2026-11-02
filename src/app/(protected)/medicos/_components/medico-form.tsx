"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  BRAZILIAN_UFS,
  MEDICAL_AFFILIATION_LABELS,
  MEDICAL_AFFILIATIONS,
  MEDICAL_PROFESSION_LABELS,
  MEDICAL_PROFESSIONS,
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

const PROFESSION_OPTIONS = MEDICAL_PROFESSIONS.map((value) => ({
  value,
  label: MEDICAL_PROFESSION_LABELS[value],
}));

const AFFILIATION_OPTIONS = MEDICAL_AFFILIATIONS.map((value) => ({
  value,
  label: MEDICAL_AFFILIATION_LABELS[value],
}));

const UF_OPTIONS = [
  { value: "", label: "Selecione" },
  ...BRAZILIAN_UFS.map((value) => ({ value, label: value })),
];

export type MedicoFormInitial = {
  name: string;
  crm: string;
  profession: string;
  registrationUf: string | null;
  rqe: string | null;
  affiliation: string;
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
      profession: ((fd.get("profession") as string) ||
        "physician") as MedicoInput["profession"],
      registrationUf: (fd.get("registrationUf") as string) ?? "",
      rqe: (fd.get("rqe") as string) ?? "",
      affiliation: ((fd.get("affiliation") as string) ||
        "internal") as MedicoInput["affiliation"],
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

      <FormSection title="Dados do profissional">
        <TextField
          label="Nome"
          name="name"
          required
          isFullWidth
          placeholder="Ex.: Dra. Helena Marques"
          defaultValue={initial?.name}
          error={errors.name}
        />
        <SelectField
          label="Categoria"
          name="profession"
          defaultValue={initial?.profession ?? "physician"}
          options={PROFESSION_OPTIONS}
          error={errors.profession}
        />
        <SelectField
          label="Vínculo"
          name="affiliation"
          defaultValue={initial?.affiliation ?? "internal"}
          options={AFFILIATION_OPTIONS}
          error={errors.affiliation}
        />
        <TextField
          label="Número do registro (CRM ou CRP)"
          name="crm"
          required
          isMono
          placeholder="Ex.: 12345"
          defaultValue={initial?.crm}
          error={errors.crm}
        />
        <SelectField
          label="UF do conselho"
          name="registrationUf"
          required
          defaultValue={initial?.registrationUf ?? ""}
          options={UF_OPTIONS}
          error={errors.registrationUf}
        />
        <TextField
          label="RQE em Medicina do Trabalho (só médico)"
          name="rqe"
          isMono
          placeholder="Ex.: 6789"
          defaultValue={initial?.rqe}
          error={errors.rqe}
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
        <SubmitButton
          pending={pending}
          label={id ? "Salvar profissional" : "Cadastrar profissional"}
        />
      </FormActions>
    </form>
  );
}
