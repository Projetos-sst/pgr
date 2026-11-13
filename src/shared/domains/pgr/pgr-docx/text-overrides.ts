import { z } from "zod";

import {
  DEFAULT_CAMPAIGNS,
  DEFAULT_LABELS,
  DEFAULT_METHODOLOGY,
  DEFAULT_TEXTS,
  DEFAULT_TITLES,
  type PgrDocxLabelKey,
  type PgrDocxTextKey,
  type PgrDocxTitleKey,
  type RichBlock,
} from "./defaults";
import { mapRecord } from "./build-data";
import { pgrDocxOverridesSchema } from "./request";

export type PgrDocxStoredOverrides = z.output<typeof pgrDocxOverridesSchema>;

export type PgrDocxEditableTexts = {
  labels: Record<PgrDocxLabelKey, string>;
  titles: Record<PgrDocxTitleKey, string>;
  texts: Record<PgrDocxTextKey, string>;
};

export const pgrDocxTextVersionSchema = z
  .object({
    reason: z.string().trim().min(1, "Informe o motivo da alteração.").max(1000),
    overrides: pgrDocxOverridesSchema,
  })
  .strict();

export type PgrDocxTextVersionInput = z.output<typeof pgrDocxTextVersionSchema>;

export function blocksToPlainText(blocks: readonly RichBlock[]): string {
  return blocks
    .map((block) => (block.kind === "subtitle" ? `## ${block.text}` : block.text))
    .join("\n");
}

export const PGR_DOCX_EDITABLE_DEFAULTS: PgrDocxEditableTexts = {
  labels: { ...DEFAULT_LABELS },
  titles: { ...DEFAULT_TITLES },
  texts: mapRecord<PgrDocxTextKey, readonly RichBlock[], string>(
    DEFAULT_TEXTS,
    blocksToPlainText,
  ),
};

function changed<K extends string>(
  values: Partial<Record<K, string>> | undefined,
  defaults: Record<K, string>,
): Partial<Record<K, string>> | undefined {
  const result: Partial<Record<K, string>> = {};
  for (const key in defaults) {
    const value = values?.[key]?.trim();
    if (value !== undefined && value !== defaults[key].trim()) result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export function changedOverrides(
  values: Partial<PgrDocxStoredOverrides>,
): PgrDocxStoredOverrides {
  const labels = changed(values.labels, PGR_DOCX_EDITABLE_DEFAULTS.labels);
  const titles = changed(values.titles, PGR_DOCX_EDITABLE_DEFAULTS.titles);
  const texts = changed(values.texts, PGR_DOCX_EDITABLE_DEFAULTS.texts);
  return {
    ...(labels ? { labels } : {}),
    ...(titles ? { titles } : {}),
    ...(texts ? { texts } : {}),
    ...(values.campaigns ? { campaigns: values.campaigns } : {}),
  };
}

export function mergeOverrides(
  saved: PgrDocxStoredOverrides | null | undefined,
  adHoc: PgrDocxStoredOverrides | null | undefined,
): PgrDocxStoredOverrides {
  const merged: PgrDocxStoredOverrides = {
    labels: { ...saved?.labels, ...adHoc?.labels },
    titles: { ...saved?.titles, ...adHoc?.titles },
    texts: { ...saved?.texts, ...adHoc?.texts },
    campaigns: adHoc?.campaigns ?? saved?.campaigns,
  };
  return changedOverrides(merged);
}

export function effectivePgrDocxTexts(overrides: PgrDocxStoredOverrides) {
  const { labels, titles, texts } = PGR_DOCX_EDITABLE_DEFAULTS;
  const applied = changedOverrides(overrides);
  return {
    labels: { ...labels, ...applied.labels },
    titles: { ...titles, ...applied.titles },
    texts: { ...texts, ...applied.texts },
    campaigns: applied.campaigns ?? DEFAULT_CAMPAIGNS,
    methodology: DEFAULT_METHODOLOGY,
  };
}

export function canonicalPgrDocxTexts(overrides: PgrDocxStoredOverrides): string {
  return JSON.stringify(effectivePgrDocxTexts(overrides));
}

export type PgrDocxTextField = {
  name: string;
  label: string;
  standard: string;
  value: string;
  changed: boolean;
};

export type PgrDocxTextFieldGroup = {
  section: "titles" | "texts" | "labels";
  title: string;
  description: string;
  fields: PgrDocxTextField[];
};

function fieldsOf(
  section: PgrDocxTextFieldGroup["section"],
  standard: Record<string, string>,
  current: Record<string, string>,
  labels: Record<string, string | undefined>,
): PgrDocxTextField[] {
  return Object.keys(standard).map((key) => ({
    name: `${section}.${key}`,
    label: labels[key] ?? key,
    standard: standard[key],
    value: current[key],
    changed: current[key] !== standard[key],
  }));
}

const textLabels: Record<string, string | undefined> = mapRecord(
  DEFAULT_TITLES,
  (title) => `Texto de ${title}`,
);

export function editableTextGroups(
  overrides: PgrDocxStoredOverrides,
): PgrDocxTextFieldGroup[] {
  const standard = PGR_DOCX_EDITABLE_DEFAULTS;
  const current = effectivePgrDocxTexts(overrides);
  return [
    {
      section: "titles",
      title: "Títulos das seções",
      description: "O sumário usa os mesmos títulos.",
      fields: fieldsOf("titles", standard.titles, current.titles, standard.titles),
    },
    {
      section: "texts",
      title: "Textos das seções",
      description:
        "Uma linha por parágrafo. Linha iniciada por '## ' vira subtítulo; por 'a) ', 'I. ' ou '- ' vira item. Marcadores como {empresa} são trocados pelo dado do PGR.",
      fields: fieldsOf("texts", standard.texts, current.texts, textLabels),
    },
    {
      section: "labels",
      title: "Rótulos de campos e tabelas",
      description: "Rótulo vazio some do documento.",
      fields: fieldsOf("labels", standard.labels, current.labels, standard.labels),
    },
  ];
}
