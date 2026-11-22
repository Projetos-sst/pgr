"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  WORK_PERMIT_STATUS_LABELS,
  WORK_PERMIT_TYPE_LABELS,
  toWorkPermitType,
  type WorkPermitInput,
  type WorkPermitStatusKey,
  type WorkPermitTypeKey,
} from "@/shared/domains/work-permits/work-permits";
import {
  createWorkPermitAction,
  updateWorkPermitAction,
} from "@/shared/server/actions/work-permits/work-permits";
import { fillWorkPermitPrecautionsAction } from "@/shared/server/actions/work-permits/ai-precautions";
import { mergePrecautions } from "@/shared/domains/work-permits/ai-precautions-fill";
import { aiFillErrorMessage } from "@/shared/domains/platform/ai-review";

import {
  FormActions,
  FormError,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "../../_ui/form";
import {
  AiFillButton,
  AiFilledBadge,
  AiSaveConfirm,
  useAiGenerateWarning,
} from "../../_ui/ai-review";

type Option = { value: string; label: string };

const TYPE_OPTIONS = Object.entries(WORK_PERMIT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const STATUS_OPTIONS = Object.entries(WORK_PERMIT_STATUS_LABELS).map(
  ([value, label]) => ({
    value,
    label,
  }),
);

export type PermitFormInitial = {
  number: string;
  type: string;
  status: string;
  companyId: string | null;
  area: string | null;
  description: string;
  validFrom: string;
  validUntil: string;
  requestedBy: string | null;
  approvedBy: string | null;
  precautions: string | null;
  notes: string | null;
};

export function PermitForm({
  id,
  companies,
  initial,
}: {
  id?: string;
  companies: Option[];
  initial?: PermitFormInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filling, startFill] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [type, setType] = useState(toWorkPermitType(initial?.type ?? ""));
  const [area, setArea] = useState(initial?.area ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [precautions, setPrecautions] = useState(initial?.precautions ?? "");
  const [aiFilled, setAiFilled] = useState(false);
  const [pendingInput, setPendingInput] = useState<WorkPermitInput | null>(null);

  function fill() {
    setFormError(null);
    startFill(async () => {
      const result = await fillWorkPermitPrecautionsAction({
        type,
        area,
        description,
        precautions,
      });
      if (!result.ok) {
        setFormError(aiFillErrorMessage(result.error));
        return;
      }
      if (result.data.precautions.length === 0) {
        setFormError(
          "A IA pgr-e não encontrou precauções novas para este trabalho. Descreva melhor a atividade ou preencha manualmente.",
        );
        return;
      }
      setPrecautions((current) => mergePrecautions(current, result.data.precautions));
      setAiFilled(true);
    });
  }

  const warning = useAiGenerateWarning(fill);

  function save(input: WorkPermitInput) {
    startTransition(async () => {
      const result = id
        ? await updateWorkPermitAction(id, input)
        : await createWorkPermitAction(input);
      if (result.ok) {
        setFormError(null);
        router.push("/work-permits");
        router.refresh();
        return;
      }
      setPendingInput(null);
      setFormError(result.error.message);
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const companyId = (fd.get("companyId") as string)?.trim();
    const input: WorkPermitInput = {
      number: (fd.get("number") as string) ?? "",
      type: (fd.get("type") as WorkPermitTypeKey) ?? "hot_work",
      status: (fd.get("status") as WorkPermitStatusKey) ?? "draft",
      companyId: companyId ? companyId : null,
      area: (fd.get("area") as string) ?? "",
      description: (fd.get("description") as string) ?? "",
      validFrom: (fd.get("validFrom") as string) ?? "",
      validUntil: (fd.get("validUntil") as string) ?? "",
      requestedBy: (fd.get("requestedBy") as string) ?? "",
      approvedBy: (fd.get("approvedBy") as string) ?? "",
      precautions: (fd.get("precautions") as string) ?? "",
      notes: (fd.get("notes") as string) ?? "",
    };
    if (aiFilled) {
      setPendingInput(input);
      return;
    }
    save(input);
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-4">
      <FormError message={formError} />
      <TextField
        label="Número da PT"
        name="number"
        required
        defaultValue={initial?.number}
      />
      <SelectField
        label="Tipo de trabalho"
        name="type"
        required
        value={type}
        onChange={(value) => setType(toWorkPermitType(value))}
        options={TYPE_OPTIONS}
      />
      <SelectField
        label="Status"
        name="status"
        required
        defaultValue={initial?.status ?? "draft"}
        options={STATUS_OPTIONS}
      />
      <SelectField
        label="Empresa (opcional)"
        name="companyId"
        options={companies}
        defaultValue={initial?.companyId}
        emptyLabel="— sem empresa —"
      />
      <TextField label="Área / local" name="area" value={area} onChange={setArea} />
      <TextField
        label="Descrição do trabalho"
        name="description"
        required
        value={description}
        onChange={setDescription}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Válida de"
          name="validFrom"
          type="date"
          required
          defaultValue={initial?.validFrom}
        />
        <TextField
          label="Válida até"
          name="validUntil"
          type="date"
          required
          defaultValue={initial?.validUntil}
        />
      </div>
      <TextField
        label="Solicitante"
        name="requestedBy"
        defaultValue={initial?.requestedBy}
      />
      <TextField label="Aprovador" name="approvedBy" defaultValue={initial?.approvedBy} />
      <div className="glass-panel rounded-card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-text-muted text-sm">
          A IA pgr-e preenche precauções e medidas de controle com base no tipo, na área e
          na descrição do trabalho. Revise antes de salvar.
        </p>
        <AiFillButton
          onClick={warning.request}
          pending={filling}
          disabled={pending || description.trim() === ""}
        />
      </div>
      <div>
        <TextAreaField
          label="Precauções / medidas de controle"
          name="precautions"
          rows={6}
          value={precautions}
          onChange={(value) => {
            setPrecautions(value);
            setAiFilled(false);
          }}
        />
        {aiFilled ? <AiFilledBadge className="mt-1.5" /> : null}
      </div>
      <TextField label="Observações" name="notes" defaultValue={initial?.notes} />

      <FormActions>
        <SubmitButton pending={pending} label={id ? "Salvar" : "Criar PT"} />
      </FormActions>

      {warning.modal}
      <AiSaveConfirm
        open={pendingInput !== null}
        pending={pending}
        onConfirm={() => pendingInput && save(pendingInput)}
        onCancel={() => setPendingInput(null)}
      />
    </form>
  );
}
