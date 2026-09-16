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

// ── Categoria do formulário (Ficha/Checklist/Documento) ─────────────────────
export const FORM_CONTROL_TYPES = ["ficha", "checklist", "documento"] as const;
export const formControlTypeSchema = z.enum(FORM_CONTROL_TYPES, {
  error: "Tipo inválido",
});
export type FormControlType = (typeof FORM_CONTROL_TYPES)[number];

const TYPE_LABELS: Record<FormControlType, string> = {
  ficha: "Ficha",
  checklist: "Checklist",
  documento: "Documento",
};

export function formControlTypeLabel(value: string): string {
  return TYPE_LABELS[value as FormControlType] ?? value;
}

// ── Situação (Rascunho/Publicado/Arquivado) ─────────────────────────────────
export const FORM_CONTROL_STATUSES = ["draft", "published", "archived"] as const;
export const formControlStatusSchema = z.enum(FORM_CONTROL_STATUSES, {
  error: "Situação inválida",
});
export type FormControlStatus = (typeof FORM_CONTROL_STATUSES)[number];

const STATUS_LABELS: Record<FormControlStatus, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};

export function formControlStatusLabel(value: string): string {
  return STATUS_LABELS[value as FormControlStatus] ?? value;
}

/** Tom da pílula de situação do kit de listagem. */
export type FormControlTone = "green" | "amber" | "neutral";
export function formControlStatusTone(value: string): FormControlTone {
  if (value === "published") return "green";
  if (value === "draft") return "amber";
  return "neutral";
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
  type: formControlTypeSchema.default("documento"),
  status: formControlStatusSchema.default("published"),
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
  type: string;
  typeLabel: string;
  status: string;
  statusLabel: string;
};

export function toFormControlListItem(row: {
  id: string;
  formType: string;
  companyName: string | null;
  frmCode: string;
  revision: string;
  issueDate: string;
  position: string;
  type: string;
  status: string;
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
    type: row.type,
    typeLabel: formControlTypeLabel(row.type),
    status: row.status,
    statusLabel: formControlStatusLabel(row.status),
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
