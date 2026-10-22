/** Demonstration calendar only; a real provider is authoritative for billing dates. */
export function nextMockPeriod(
  start: Date,
  interval: "month" | "year" | "one_time",
): Date {
  const end = new Date(start),
    day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + (interval === "year" ? 12 : 1));
  const last = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0),
  ).getUTCDate();
  end.setUTCDate(Math.min(day, last));
  return end;
}
