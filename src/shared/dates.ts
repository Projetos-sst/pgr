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
 *
 * Só para INSTANTES (`timestamp`/`timestamptz`, ISO com hora). Nunca passe uma data civil
 * (`YYYY-MM-DD`): `new Date("2026-03-10")` é meia-noite UTC, que em Brasília ainda é o dia 9.
 */
export function dateInSaoPaulo(instant: string | Date): string | null {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}

/** Exibido quando a data falta ou é inválida. */
export const MISSING_DATE_LABEL = "—";

const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Data civil (coluna `date`, `YYYY-MM-DD`) é um dia do calendário, sem fuso: exibe-se COMO ESTÁ,
 * sem passar por `Date`/UTC. `format: "br"` troca só a ordem (DD/MM/AAAA), para as telas que já
 * usam esse formato. Ausente, fora do padrão ou dia inexistente (ex.: 2026-02-30) → "—".
 */
export function formatCivilDate(
  civil: string | null | undefined,
  format: "iso" | "br" = "iso",
): string {
  const match = civil ? CIVIL_DATE_PATTERN.exec(civil) : null;
  if (!match) return MISSING_DATE_LABEL;
  const [, year, month, day] = match;
  // Conferência aritmética do dia (UTC só como calendário, sem fuso envolvido).
  const check = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    check.getUTCFullYear() !== Number(year) ||
    check.getUTCMonth() !== Number(month) - 1 ||
    check.getUTCDate() !== Number(day)
  )
    return MISSING_DATE_LABEL;
  return format === "br" ? `${day}/${month}/${year}` : `${year}-${month}-${day}`;
}

/**
 * Dia de um INSTANTE para exibição: o dia de Brasília (não o de UTC), no mesmo formato das datas
 * civis. `Intl` com fuso explícito dá o mesmo texto no servidor (UTC) e no navegador, sem
 * divergência de hidratação. Ausente ou inválido → "—".
 */
export function formatInstantDate(
  instant: string | Date | null | undefined,
  format: "iso" | "br" = "iso",
): string {
  if (instant === null || instant === undefined || instant === "")
    return MISSING_DATE_LABEL;
  return formatCivilDate(dateInSaoPaulo(instant), format);
}

const SAO_PAULO_DATE_TIME = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * Data e hora (YYYY-MM-DD HH:MM) de um INSTANTE no fuso de Brasília — para trilhas de eventos.
 * Ausente ou inválido → "—".
 */
export function formatInstantDateTime(instant: string | Date | null | undefined): string {
  if (instant === null || instant === undefined || instant === "")
    return MISSING_DATE_LABEL;
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return MISSING_DATE_LABEL;
  const parts = Object.fromEntries(
    SAO_PAULO_DATE_TIME.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

/** Janelas de vencimento aceitas pelos filtros de "a vencer" (treinamentos, documentos). */
export const DUE_WINDOW_DAYS_OPTIONS = [30, 60, 90] as const;

export type DueWindowDays = (typeof DUE_WINDOW_DAYS_OPTIONS)[number];
