import { z } from "zod";

import { workPermitTypeLabel, workPermitTypeSchema } from "./work-permits";

export const AI_WORK_PERMIT_PRECAUTIONS_KIND = "work_permit_precautions_fill";

export const MAX_PRECAUTIONS = 12;

export const MAX_PRECAUTION_LENGTH = 240;

const MAX_CONTEXT_TEXT = 2000;

const contextText = z.string().trim().max(MAX_CONTEXT_TEXT);

export const workPermitPrecautionsFillInputSchema = z.object({
  type: workPermitTypeSchema,
  area: contextText.optional().default(""),
  description: contextText.min(1, "Descreva o trabalho antes de preencher com a IA."),
  precautions: z.string().max(5000).optional().default(""),
});

export type WorkPermitPrecautionsFillInput = z.input<
  typeof workPermitPrecautionsFillInputSchema
>;

export type WorkPermitPrecautionsContext = {
  typeLabel: string;
  area: string | null;
  description: string;
  existingPrecautions: string[];
};

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s*/;

function precautionKey(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function splitPrecautions(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(BULLET, "").trim())
    .filter((line) => line !== "");
}

export function buildPrecautionsContext(
  input: z.output<typeof workPermitPrecautionsFillInputSchema>,
): WorkPermitPrecautionsContext {
  return {
    typeLabel: workPermitTypeLabel(input.type),
    area: input.area === "" ? null : input.area,
    description: input.description,
    existingPrecautions: splitPrecautions(input.precautions),
  };
}

const precautionSchema = z.string().trim().min(1).max(MAX_PRECAUTION_LENGTH);

function precautionTexts(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw === null || typeof raw !== "object" || !("precautions" in raw)) return [];
  return Array.isArray(raw.precautions) ? raw.precautions : [];
}

function textOf(item: unknown): unknown {
  if (item === null || typeof item !== "object" || !("description" in item)) return item;
  return item.description;
}

export function parseModelPrecautions(
  raw: unknown,
  existing: readonly string[] = [],
): string[] {
  const seen = new Set(existing.map(precautionKey));
  const out: string[] = [];
  for (const item of precautionTexts(raw)) {
    const parsed = precautionSchema.safeParse(textOf(item));
    if (!parsed.success) continue;
    const key = precautionKey(parsed.data);
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    out.push(parsed.data);
    if (out.length >= MAX_PRECAUTIONS) break;
  }
  return out;
}

export function mergePrecautions(current: string, filled: readonly string[]): string {
  const lines = [...splitPrecautions(current), ...filled];
  return lines.map((line) => `- ${line}`).join("\n");
}
