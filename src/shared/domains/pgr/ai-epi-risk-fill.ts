import { z } from "zod";

import { optionalText } from "./ai-risk-suggestion";
import { aliasPreprocessor } from "./enum-aliases";
import {
  epiNeutralizationSchema,
  type EpiNeutralization,
  type EpiOption,
} from "./epi-risk";
import { requiredUuid } from "./form-fields";

export const AI_EPI_RISK_FILL_KIND = "epi_risk_fill";

export const MAX_EPI_CATALOG_OPTIONS = 80;

export const MAX_EPI_FILL_LINKS = 8;

const NEUTRALIZATION_ALIASES: Record<string, EpiNeutralization> = {
  sim: "neutralizes",
  neutraliza: "neutralizes",
  yes: "neutralizes",
  nao: "does_not_neutralize",
  "nao neutraliza": "does_not_neutralize",
  no: "does_not_neutralize",
  "nao aplicavel": "not_applicable",
  "n/a": "not_applicable",
  na: "not_applicable",
};

export const normalizeEpiNeutralization = aliasPreprocessor(
  NEUTRALIZATION_ALIASES,
  /^neutralizacao\s*:?\s*/,
);

export const suggestedEpiLinkSchema = z.object({
  catalogId: z.string().trim().min(1),
  neutralization: z.preprocess(normalizeEpiNeutralization, epiNeutralizationSchema),
  rationale: optionalText,
});

export type SuggestedEpiLink = z.infer<typeof suggestedEpiLinkSchema>;

export type FilledEpiLink = SuggestedEpiLink & { name: string; ca: string | null };

export type EpiRiskFillContext = {
  agentType: string;
  hazard: string | null;
  description: string;
  sources: string | null;
  propagation: string | null;
  exposureTime: string | null;
  catalog: EpiOption[];
  truncated: boolean;
  linkedCatalogIds: string[];
};

const modelEnvelopeSchema = z.union([
  z.array(z.unknown()),
  z.object({ links: z.array(z.unknown()) }).transform((o) => o.links),
]);

export function parseModelEpiLinks(raw: unknown): SuggestedEpiLink[] {
  const envelope = modelEnvelopeSchema.safeParse(raw);
  if (!envelope.success) return [];
  const seen = new Set<string>();
  const out: SuggestedEpiLink[] = [];
  for (const item of envelope.data) {
    const parsed = suggestedEpiLinkSchema.safeParse(item);
    if (!parsed.success || seen.has(parsed.data.catalogId)) continue;
    seen.add(parsed.data.catalogId);
    out.push(parsed.data);
  }
  return out;
}

export function keepCatalogLinks(
  links: readonly SuggestedEpiLink[],
  catalog: readonly EpiOption[],
): FilledEpiLink[] {
  const byId = new Map(catalog.map((c) => [c.catalogId, c]));
  return links
    .flatMap((link) => {
      const item = byId.get(link.catalogId);
      return item ? [{ ...link, name: item.name, ca: item.ca }] : [];
    })
    .slice(0, MAX_EPI_FILL_LINKS);
}

export const acceptEpiRiskFillInputSchema = z.object({
  links: z
    .array(
      z.object({
        catalogId: requiredUuid("EPI é obrigatório"),
        neutralization: epiNeutralizationSchema,
      }),
    )
    .min(1, "Selecione ao menos um EPI.")
    .max(MAX_EPI_CATALOG_OPTIONS)
    .refine((links) => new Set(links.map((l) => l.catalogId)).size === links.length, {
      message: "Cada EPI pode aparecer uma única vez.",
    }),
});

export type AcceptEpiRiskFillInput = z.input<typeof acceptEpiRiskFillInputSchema>;
