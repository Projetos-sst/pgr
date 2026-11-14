const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatInstant(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return DATE_FORMAT.format(new Date(value));
}

export function pageOf(value: string | string[] | undefined): number {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}
