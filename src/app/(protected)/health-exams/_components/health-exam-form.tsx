"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  EXAM_APTITUDES,
  EXAM_APTITUDE_LABELS,
  EXAM_TYPES,
  EXAM_TYPE_LABELS,
  HEALTH_EXAM_CERTIFICATE_PATH_MAX,
  VALID_UNTIL_BEFORE_PERFORMED_MESSAGE,
  isValidUntilBeforePerformedAt,
  type HealthExamInput,
} from "@/shared/domains/pgr/health-exams";
import { healthExamFormFeedback } from "@/shared/domains/medicine/error-messages";
import {
  UNEXPECTED_FORM_ERROR,
  formFeedback,
  pathDescriber,
} from "@/shared/domains/medicine/form-feedback";
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

/** Campos com lugar na tela; erro de outra chave vira linha legível no resumo (NOB-112). */
const HEALTH_EXAM_SLOTS = [
  "employeeId",
  "examType",
  "doctorId",
  "aptitude",
  "performedAt",
  "validUntil",
  "certificatePath",
] as const;
const describeHealthExamPath = pathDescriber({
  fields: {
    employeeId: "Funcionário",
    examType: "Tipo de exame",
    doctorId: "Médico responsável",
    aptitude: "Aptidão",
    performedAt: "Data de realização",
    validUntil: "Validade",
    certificatePath: "Caminho do ASO",
    clinicalNotes: "Observações clínicas",
  },
});

export type EmployeeOption = { id: string; fullName: string };
export type DoctorOption = { id: string; name: string; crm: string };

export type HealthExamFormInitial = {
  employeeId: string;
  doctorId: string | null;
  examType: string;
  performedAt: string;
  validUntil: string | null;
  aptitude: string;
  certificatePath: string | null;
};

/**
 * Checagens imediatas no navegador, só para o aviso aparecer antes do envio. O
 * servidor revalida tudo com o mesmo schema (nenhuma superfície pula a regra).
 */
function clientFieldErrors(input: HealthExamInput): Record<string, string> {
  const errors: Record<string, string> = {};
  const validUntil = typeof input.validUntil === "string" ? input.validUntil : undefined;
  if (isValidUntilBeforePerformedAt(input.performedAt, validUntil)) {
    errors.validUntil = VALID_UNTIL_BEFORE_PERFORMED_MESSAGE;
  }
  if ((input.certificatePath ?? "").trim().length > HEALTH_EXAM_CERTIFICATE_PATH_MAX) {
    errors.certificatePath = `Caminho do ASO: máximo de ${HEALTH_EXAM_CERTIFICATE_PATH_MAX} caracteres.`;
  }
  return errors;
}

export function HealthExamForm({
  id,
  initial,
  employees,
  doctors,
  defaultEmployeeId,
  lockedEmployee,
  returnTo,
}: {
  id?: string;
  initial?: HealthExamFormInitial;
  employees: EmployeeOption[];
  doctors: DoctorOption[];
  /** Funcionário pré-selecionado (ex.: vindo da ficha). */
  defaultEmployeeId?: string;
  /**
   * Edição: o funcionário do exame é fixo (identidade do exame) e aparece só
   * para leitura. O servidor recusa qualquer troca de `employeeId`.
   */
  lockedEmployee?: EmployeeOption;
  /** Destino após salvar/cancelar — montado pela página no servidor, nunca lido da URL. */
  returnTo?: string;
}) {
  const backHref = returnTo ?? "/health-exams";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input: HealthExamInput = {
      employeeId: lockedEmployee?.id ?? (fd.get("employeeId") as string) ?? "",
      doctorId: (fd.get("doctorId") as string) || undefined,
      examType: ((fd.get("examType") as string) || "") as HealthExamInput["examType"],
      performedAt: (fd.get("performedAt") as string) ?? "",
      validUntil: (fd.get("validUntil") as string) || undefined,
      aptitude: ((fd.get("aptitude") as string) || "") as HealthExamInput["aptitude"],
      certificatePath: (fd.get("certificatePath") as string) ?? "",
    };
    // Os campos não são controlados nem resetados: em erro, o que foi digitado fica.
    const localErrors = clientFieldErrors(input);
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      setDetails([]);
      setFormError("Revise os campos destacados.");
      return;
    }
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof createHealthExamAction>>;
      try {
        result = id
          ? await updateHealthExamAction(id, input)
          : await createHealthExamAction(input);
      } catch {
        // Falha sem resposta tratável (rede, erro não mapeado): mensagem segura, valores mantidos.
        setErrors({});
        setDetails([]);
        setFormError(UNEXPECTED_FORM_ERROR);
        return;
      }
      if (result.ok) {
        setErrors({});
        setDetails([]);
        setFormError(null);
        setSaved(true);
        router.push(backHref);
        router.refresh();
      } else if (Object.keys(result.error.fields ?? {}).length > 0) {
        const feedback = formFeedback(result.error, {
          slots: HEALTH_EXAM_SLOTS,
          describe: describeHealthExamPath,
        });
        setErrors(feedback.fields);
        setDetails(feedback.details);
        setFormError(feedback.formError);
      } else {
        const feedback = healthExamFormFeedback(result.error);
        setErrors(feedback.fields);
        setDetails([]);
        setFormError(feedback.formError);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <FormError message={formError} details={details} />
      {saved ? (
        <p
          role="status"
          className="rounded-field border border-emerald-300 bg-emerald-50/80 px-3.5 py-2.5 text-[13px] text-emerald-800"
        >
          Exame salvo. Voltando…
        </p>
      ) : null}

      <FormSection
        title="Exame ocupacional (ASO)"
        description="Campos com * são obrigatórios."
      >
        {lockedEmployee ? (
          <TextField
            label="Funcionário"
            name="employeeName"
            required
            readOnly
            isFullWidth
            defaultValue={lockedEmployee.fullName}
            error={errors.employeeId}
          />
        ) : (
          <SelectField
            label="Funcionário"
            name="employeeId"
            required
            isFullWidth
            defaultValue={initial?.employeeId ?? defaultEmployeeId ?? ""}
            options={employees.map((e) => ({ value: e.id, label: e.fullName }))}
            error={errors.employeeId}
            emptyLabel="— selecione o funcionário —"
          />
        )}
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
        <p className="text-text-subtle text-xs sm:col-span-full">
          Observações clínicas não ficam no cadastro do exame: o médico examinador ou o
          coordenador do PCMSO as registra no prontuário, acessível só a eles.
        </p>
      </FormSection>

      <FormActions>
        <CancelLink href={backHref} />
        <SubmitButton pending={pending} label={id ? "Salvar exame" : "Criar exame"} />
      </FormActions>
    </form>
  );
}
