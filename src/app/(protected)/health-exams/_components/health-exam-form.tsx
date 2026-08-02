"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  EXAM_APTITUDES,
  EXAM_APTITUDE_LABELS,
  EXAM_TYPES,
  EXAM_TYPE_LABELS,
  type HealthExamInput,
} from "@/shared/domains/pgr/health-exams";
import {
  createHealthExamAction,
  updateHealthExamAction,
} from "@/shared/server/actions/pgr/health-exams";

import {
  CancelLink,
  FormActions,
  FormError,
  FormSection,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";

const TYPE_OPTIONS = EXAM_TYPES.map((value) => ({
  value,
  label: EXAM_TYPE_LABELS[value],
}));
const APTITUDE_OPTIONS = EXAM_APTITUDES.map((value) => ({
  value,
  label: EXAM_APTITUDE_LABELS[value],
}));

export type EmployeeOption = { id: string; fullName: string };
export type DoctorOption = { id: string; name: string; crm: string };

export type HealthExamFormInitial = {
  employeeId: string;
  doctorId: string | null;
  examType: string;
  performedAt: string;
  validUntil: string | null;
  aptitude: string;
  notes: string | null;
  certificatePath: string | null;
};

export function HealthExamForm({
  id,
  initial,
  employees,
  doctors,
}: {
  id?: string;
  initial?: HealthExamFormInitial;
  employees: EmployeeOption[];
  doctors: DoctorOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input: HealthExamInput = {
      employeeId: (fd.get("employeeId") as string) ?? "",
      doctorId: (fd.get("doctorId") as string) || undefined,
      examType: ((fd.get("examType") as string) || "") as HealthExamInput["examType"],
      performedAt: (fd.get("performedAt") as string) ?? "",
      validUntil: (fd.get("validUntil") as string) || undefined,
      aptitude: ((fd.get("aptitude") as string) || "") as HealthExamInput["aptitude"],
      notes: (fd.get("notes") as string) ?? "",
      certificatePath: (fd.get("certificatePath") as string) ?? "",
    };
    startTransition(async () => {
      const result = id
        ? await updateHealthExamAction(id, input)
        : await createHealthExamAction(input);
      if (result.ok) {
        setErrors({});
        setFormError(null);
        router.push("/health-exams");
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

      <FormSection title="Exame ocupacional (ASO)">
        <SelectField
          label="Funcionário"
          name="employeeId"
          required
          isFullWidth
          defaultValue={initial?.employeeId ?? ""}
          options={employees.map((e) => ({ value: e.id, label: e.fullName }))}
          error={errors.employeeId}
          emptyLabel="— selecione o funcionário —"
        />
        <SelectField
          label="Tipo de exame"
          name="examType"
          required
          defaultValue={initial?.examType ?? ""}
          options={TYPE_OPTIONS}
          error={errors.examType}
        />
        <SelectField
          label="Médico responsável"
          name="doctorId"
          defaultValue={initial?.doctorId ?? ""}
          options={doctors.map((d) => ({ value: d.id, label: `${d.name} · ${d.crm}` }))}
          error={errors.doctorId}
          emptyLabel="— sem médico —"
        />
        <SelectField
          label="Aptidão"
          name="aptitude"
          required
          defaultValue={initial?.aptitude ?? ""}
          options={APTITUDE_OPTIONS}
          error={errors.aptitude}
        />
        <TextField
          label="Realizado em"
          name="performedAt"
          type="date"
          required
          defaultValue={initial?.performedAt}
          error={errors.performedAt}
        />
        <TextField
          label="Vencimento"
          name="validUntil"
          type="date"
          defaultValue={initial?.validUntil}
          error={errors.validUntil}
        />
        <TextField
          label="Caminho do ASO / certificado"
          name="certificatePath"
          isFullWidth
          placeholder="Ex.: /docs/aso/joao-2026.pdf"
          defaultValue={initial?.certificatePath}
          error={errors.certificatePath}
        />
        <TextField
          label="Observações"
          name="notes"
          isFullWidth
          placeholder="Restrições, recomendações…"
          defaultValue={initial?.notes}
          error={errors.notes}
        />
      </FormSection>

      <FormActions>
        <CancelLink href="/health-exams" />
        <SubmitButton pending={pending} label={id ? "Salvar exame" : "Criar exame"} />
      </FormActions>
    </form>
  );
}
