import { z } from "zod";

import {
  optionalString,
  optionalUuid,
  requiredString,
} from "@/shared/domains/pgr/form-fields";
import type { FormControl } from "@/shared/db/schema/form-controls";

export const formControlPositionSchema = z.enum(["top", "bottom", "both"]);
export type FormControlPosition = z.infer<typeof formControlPositionSchema>;

export const FORM_CONTROL_POSITION_LABELS: Record<FormControlPosition, string> = {
  top: "Topo",
  bottom: "Rodapé",
  both: "Topo e rodapé",
};

export function formControlPositionLabel(value: string): string {
  return FORM_CONTROL_POSITION_LABELS[value as FormControlPosition] ?? value;
}

export const formControlInputSchema = z.object({
  formType: requiredString("Tipo de formulário é obrigatório"),
  // .nullable() além de optionalUuid: o form envia `null` (não só "") quando o
  // <select> de empresa/GES é limpo — mesmo padrão de safety/service-order.ts.
  companyId: optionalUuid.nullable().optional(),
  frmCode: requiredString("Código FRM é obrigatório"),
  revision: requiredString("REV é obrigatório"),
  issueDate: z.iso.date("Data inválida (use AAAA-MM-DD)"),
  nonConformityNumber: optionalString,
  gesId: optionalUuid.nullable().optional(),
  position: formControlPositionSchema,
  notes: optionalString,
});

export type FormControlInput = z.input<typeof formControlInputSchema>;
export type FormControlValues = z.output<typeof formControlInputSchema>;

export type FormControlListItem = {
  id: string;
  formType: string;
  companyName: string | null;
  frmCode: string;
  revision: string;
  issueDate: string;
  position: string;
  positionLabel: string;
};

export function toFormControlListItem(row: {
  id: string;
  formType: string;
  companyName: string | null;
  frmCode: string;
  revision: string;
  issueDate: string;
  position: string;
}): FormControlListItem {
  return {
    id: row.id,
    formType: row.formType,
    companyName: row.companyName,
    frmCode: row.frmCode,
    revision: row.revision,
    issueDate: row.issueDate,
    position: row.position,
    positionLabel: formControlPositionLabel(row.position),
  };
}

export type FormControlDetail = {
  control: FormControl;
  company: { id: string; razaoSocial: string } | null;
  ges: { id: string; name: string } | null;
};

/** AAAA-MM-DD → DD/MM/AAAA para exibição; string vazia/inválida passa através. */
export function formatIsoDateBr(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

export type FormControlPreview = {
  formType: string;
  companyName: string | null;
  frmCode: string;
  revision: string;
  issueDateDisplay: string;
  nonConformityNumber: string | null;
  gesName: string | null;
  positionLabel: string;
  notes: string | null;
};

/**
 * Monta o cabeçalho ISO a partir dos valores do formulário — usado tanto no preview
 * em tempo real da UI quanto testável isoladamente (unit).
 */
export function buildFormControlPreview(input: {
  formType?: string;
  companyName?: string | null;
  frmCode?: string;
  revision?: string;
  issueDate?: string;
  nonConformityNumber?: string | null;
  gesName?: string | null;
  position?: string;
  notes?: string | null;
}): FormControlPreview {
  return {
    formType: input.formType?.trim() || "—",
    companyName: input.companyName?.trim() || null,
    frmCode: input.frmCode?.trim() || "—",
    revision: input.revision?.trim() || "—",
    issueDateDisplay: input.issueDate ? formatIsoDateBr(input.issueDate) : "—",
    nonConformityNumber: input.nonConformityNumber?.trim() || null,
    gesName: input.gesName?.trim() || null,
    positionLabel: formControlPositionLabel(input.position ?? "top"),
    notes: input.notes?.trim() || null,
  };
}
