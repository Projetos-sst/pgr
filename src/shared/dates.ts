/**
 * "Hoje" (YYYY-MM-DD) no fuso de referência do negócio (America/Sao_Paulo): o
 * servidor roda em UTC e, à noite, UTC já virou o dia seguinte — um prazo que
 * vence hoje no Brasil seria marcado vencido cedo demais. `en-CA` formata como
 * YYYY-MM-DD.
 */
export function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

/** Janelas de vencimento aceitas pelos filtros de "a vencer" (treinamentos, documentos). */
export const DUE_WINDOW_DAYS_OPTIONS = [30, 60, 90] as const;

export type DueWindowDays = (typeof DUE_WINDOW_DAYS_OPTIONS)[number];
