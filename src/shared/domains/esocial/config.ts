import { z } from "zod";

import type { EsocialConfig, EsocialEnvironment } from "@/shared/db/schema";

import { EVENT_TYPES } from "./events";

export type { EsocialConfig, EsocialEnvironment };

// ── Ambiente de transmissão ─────────────────────────────────────────────────
export const ESOCIAL_ENVIRONMENTS = ["production", "homologation"] as const;

export const esocialEnvironmentSchema = z.enum(ESOCIAL_ENVIRONMENTS, {
  error: "Ambiente inválido",
});

const ENVIRONMENT_LABELS: Record<EsocialEnvironment, string> = {
  production: "Produção",
  homologation: "Homologação",
};

export function esocialEnvironmentLabel(value: string): string {
  return ENVIRONMENT_LABELS[value as EsocialEnvironment] ?? value;
}

// ── Eventos SST configuráveis (toggles do mockup) ───────────────────────────
// Subconjunto SST do catálogo de eventos que a tela de configuração habilita.
export const SST_CONFIG_EVENTS = ["S-2210", "S-2220", "S-2240"] as const;

const EVENT_SET = new Set<string>(EVENT_TYPES);

// ── Frequência de verificação (preferência; não aciona worker nesta fatia) ──
export const CHECK_FREQUENCY_OPTIONS = [1, 6, 12, 24, 48] as const;

export function checkFrequencyLabel(hours: number): string {
  if (hours === 1) return "A cada 1 hora";
  if (hours >= 24 && hours % 24 === 0) {
    const d = hours / 24;
    return d === 1 ? "A cada 24 horas (diário)" : `A cada ${d} dias`;
  }
  return `A cada ${hours} horas`;
}

// ── Schema de entrada ───────────────────────────────────────────────────────
const cnpjSchema = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

export const esocialConfigInputSchema = z.object({
  environment: esocialEnvironmentSchema,
  employerCnpj: cnpjSchema,
  taxClassification: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
  certificateName: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
  certificateExpiresAt: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.iso.date("Data inválida (use AAAA-MM-DD)").optional(),
  ),
  enabledEvents: z
    .array(z.string())
    .default([])
    .transform((arr) => arr.filter((e) => EVENT_SET.has(e)))
    .refine((arr) => new Set(arr).size === arr.length, {
      message: "Eventos duplicados",
    }),
  autoSend: z.coerce.boolean().default(false),
  checkFrequencyHours: z.coerce
    .number({ error: "Frequência inválida" })
    .int("Frequência deve ser um número inteiro")
    .positive("Frequência deve ser maior que zero")
    .max(720, "Frequência máxima de 720 horas (30 dias)")
    .default(24),
});

export type EsocialConfigInput = z.input<typeof esocialConfigInputSchema>;
export type EsocialConfigValues = z.output<typeof esocialConfigInputSchema>;

/** Valores padrão para o primeiro acesso (nenhuma config salva ainda). */
export const DEFAULT_ESOCIAL_CONFIG: EsocialConfigValues = {
  environment: "homologation",
  employerCnpj: undefined,
  taxClassification: undefined,
  certificateName: undefined,
  certificateExpiresAt: undefined,
  enabledEvents: [...SST_CONFIG_EVENTS],
  autoSend: false,
  checkFrequencyHours: 24,
};

/** Contagens reais de eventos (para o resumo lateral — dado derivado, não fake). */
export type EsocialEventCounts = { pending: number; sent: number; total: number };
