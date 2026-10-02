import { z } from "zod";

import {
  DEFAULT_LABELS,
  DEFAULT_TEXTS,
  DEFAULT_TITLES,
  type PgrDocxLabelKey,
  type PgrDocxTextKey,
  type PgrDocxTitleKey,
} from "./defaults";

/**
 * Pedido de geração do PGR em DOCX/PDF. Os SEMI-FIXOS (laranja no PGR 2026.1) chegam
 * como `overrides`: só as chaves conhecidas do template, cada uma trocando o default de
 * `defaults.ts`. Chave desconhecida → 422 (`strict`), nunca ignorada em silêncio. Textos
 * longos vêm como texto livre (uma linha por parágrafo, `## ` = subtítulo, `a) ` /
 * `I. ` / `- ` = item), convertidos por `plainTextToBlocks`.
 */

const keysOf = <K extends string>(record: Record<K, unknown>) =>
  Object.keys(record) as [K, ...K[]];

export const PGR_DOCX_FORMATS = ["docx", "pdf"] as const;
export type PgrDocxFormat = (typeof PGR_DOCX_FORMATS)[number];

export const pgrDocxFormatSchema = z.enum(PGR_DOCX_FORMATS, {
  error: "Formato inválido (use docx ou pdf)",
});

export const pgrDocxOverridesSchema = z
  .object({
    labels: z
      .partialRecord(
        z.enum(keysOf<PgrDocxLabelKey>(DEFAULT_LABELS)),
        z.string().trim().max(500),
      )
      .optional(),
    titles: z
      .partialRecord(
        z.enum(keysOf<PgrDocxTitleKey>(DEFAULT_TITLES)),
        z.string().trim().min(1, "Título não pode ficar vazio").max(300),
      )
      .optional(),
    texts: z
      .partialRecord(
        z.enum(keysOf<PgrDocxTextKey>(DEFAULT_TEXTS)),
        z.string().trim().min(1, "Texto não pode ficar vazio").max(20_000),
      )
      .optional(),
    campaigns: z
      .array(
        z.object({
          month: z.string().trim().min(1).max(60),
          theme: z.string().trim().min(1).max(120),
          actions: z.string().trim().max(2_000),
        }),
      )
      .max(24)
      .optional(),
  })
  .strict();

export type PgrDocxOverridesInput = z.input<typeof pgrDocxOverridesSchema>;

export const pgrDocxRequestSchema = z
  .object({
    format: pgrDocxFormatSchema.default("docx"),
    overrides: pgrDocxOverridesSchema.optional(),
  })
  .strict();

export type PgrDocxRequest = z.output<typeof pgrDocxRequestSchema>;
