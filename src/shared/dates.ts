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

/**
 * Data de calendário (YYYY-MM-DD) de um instante no fuso America/Sao_Paulo. Um carimbo gravado
 * às 22h de Brasília já está no dia seguinte em UTC; cortar o ISO (`slice(0, 10)`) mostraria a
 * data errada. Instante inválido → `null`.
 */
export function dateInSaoPaulo(instant: string | Date): string | null {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}

/** Janelas de vencimento aceitas pelos filtros de "a vencer" (treinamentos, documentos). */
export const DUE_WINDOW_DAYS_OPTIONS = [30, 60, 90] as const;

export type DueWindowDays = (typeof DUE_WINDOW_DAYS_OPTIONS)[number];
