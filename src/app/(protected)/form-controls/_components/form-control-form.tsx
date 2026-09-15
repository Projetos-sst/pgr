"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  buildFormControlPreview,
  FORM_CONTROL_POSITION_LABELS,
  FORM_CONTROL_STATUSES,
  FORM_CONTROL_TYPES,
  formControlStatusLabel,
  formControlTypeLabel,
  type FormControlPosition,
  type FormControlStatus,
  type FormControlType,
} from "@/shared/domains/documents/form-controls";
import {
  createFormControlAction,
  updateFormControlAction,
} from "@/shared/server/actions/documents/form-controls";

import {
  FormActions,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from "../../_ui/form";

type Option = { value: string; label: string };

const POSITION_OPTIONS = Object.entries(FORM_CONTROL_POSITION_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const TYPE_OPTIONS = FORM_CONTROL_TYPES.map((value) => ({
  value,
  label: formControlTypeLabel(value),
}));

const STATUS_OPTIONS = FORM_CONTROL_STATUSES.map((value) => ({
  value,
  label: formControlStatusLabel(value),
}));

export type FormControlFormInitial = {
  formType: string;
  companyId: string | null;
  frmCode: string;
  revision: string;
  issueDate: string;
  nonConformityNumber: string | null;
  gesId: string | null;
  position: string;
  type: string;
  status: string;
  notes: string | null;
};

export function FormControlForm({
  id,
  companies,
  gesOptions,
  initial,
}: {
  id?: string;
  companies: Option[];
  gesOptions: Option[];
  initial?: FormControlFormInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const [formType, setFormType] = useState(initial?.formType ?? "");
  const [companyId, setCompanyId] = useState(initial?.companyId ?? "");
  const [frmCode, setFrmCode] = useState(initial?.frmCode ?? "");
  const [revision, setRevision] = useState(initial?.revision ?? "");
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? "");
  const [nonConformityNumber, setNonConformityNumber] = useState(
    initial?.nonConformityNumber ?? "",
  );
  const [gesId, setGesId] = useState(initial?.gesId ?? "");
  const [position, setPosition] = useState(initial?.position ?? "top");
  const [type, setType] = useState(initial?.type ?? "documento");
  const [status, setStatus] = useState(initial?.status ?? "published");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const preview = useMemo(
    () =>
      buildFormControlPreview({
        formType,
        companyName: companies.find((c) => c.value === companyId)?.label ?? null,
        frmCode,
        revision,
        issueDate,
        nonConformityNumber,
        gesName: gesOptions.find((g) => g.value === gesId)?.label ?? null,
        position,
        notes,
      }),
    [
      formType,
      companyId,
      companies,
      frmCode,
      revision,
      issueDate,
      nonConformityNumber,
      gesId,
      gesOptions,
      position,
      notes,
    ],
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = {
      formType,
      companyId: companyId ? companyId : null,
      frmCode,
      revision,
      issueDate,
      nonConformityNumber: nonConformityNumber ? nonConformityNumber : "",
      gesId: gesId ? gesId : null,
      position: position as FormControlPosition,
      type: type as FormControlType,
      status: status as FormControlStatus,
      notes: notes ? notes : "",
    };
    startTransition(async () => {
      const result = id
        ? await updateFormControlAction(id, input)
        : await createFormControlAction(input);
      if (result.ok) {
        setFormError(null);
        router.push("/form-controls");
        router.refresh();
      } else {
        setFormError(result.error.message);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormError message={formError} />
        <TextField
          label="Nome do formulário"
          name="formType"
          required
          value={formType}
          onChange={setFormType}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Tipo"
            name="type"
            required
            options={TYPE_OPTIONS}
            value={type}
            onChange={setType}
          />
          <SelectField
            label="Situação"
            name="status"
            required
            options={STATUS_OPTIONS}
            value={status}
            onChange={setStatus}
          />
        </div>
        <SelectField
          label="Empresa (opcional)"
          name="companyId"
          options={companies}
          value={companyId}
          onChange={setCompanyId}
          emptyLabel="— sem empresa —"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Código FRM"
            name="frmCode"
            required
            value={frmCode}
            onChange={setFrmCode}
          />
          <TextField
            label="REV"
            name="revision"
            required
            value={revision}
            onChange={setRevision}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Data"
            name="issueDate"
            type="date"
            required
            value={issueDate}
            onChange={setIssueDate}
          />
          <TextField
            label="N.C. (não-conformidade)"
            name="nonConformityNumber"
            value={nonConformityNumber}
            onChange={setNonConformityNumber}
          />
        </div>
        <SelectField
          label="GES/Setor responsável (opcional)"
          name="gesId"
          options={gesOptions}
          value={gesId}
          onChange={setGesId}
          emptyLabel="— sem GES —"
        />
        <SelectField
          label="Posicionamento"
          name="position"
          required
          options={POSITION_OPTIONS}
          value={position}
          onChange={setPosition}
        />
        <TextField label="Observação" name="notes" value={notes} onChange={setNotes} />

        <FormActions>
          <SubmitButton pending={pending} label={id ? "Salvar" : "Criar controle"} />
        </FormActions>
      </form>

      <div className="glass-card flex flex-col gap-3 p-6">
        <h2 className="text-text-muted text-sm font-semibold tracking-wide uppercase">
          Preview do cabeçalho
        </h2>
        <div className="rounded-card border border-white/50 bg-white/70 p-4 text-sm">
          <table className="w-full border-collapse text-xs">
            <tbody>
              <tr>
                <td className="border border-black/20 px-2 py-1 font-semibold">
                  {preview.formType}
                </td>
                <td className="border border-black/20 px-2 py-1">
                  {preview.companyName ?? "—"}
                </td>
              </tr>
              <tr>
                <td className="border border-black/20 px-2 py-1">
                  FRM: {preview.frmCode}
                </td>
                <td className="border border-black/20 px-2 py-1">
                  REV: {preview.revision}
                </td>
              </tr>
              <tr>
                <td className="border border-black/20 px-2 py-1">
                  Data: {preview.issueDateDisplay}
                </td>
                <td className="border border-black/20 px-2 py-1">
                  N.C.: {preview.nonConformityNumber ?? "—"}
                </td>
              </tr>
              <tr>
                <td className="border border-black/20 px-2 py-1" colSpan={2}>
                  GES/Setor: {preview.gesName ?? "—"}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="text-text-muted mt-3 text-xs">
            Posicionamento: {preview.positionLabel}
          </p>
          {preview.notes ? (
            <p className="text-text-muted mt-1 text-xs">Obs.: {preview.notes}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
