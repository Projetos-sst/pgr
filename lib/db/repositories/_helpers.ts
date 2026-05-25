export function stripNullish<T extends Record<string, unknown>>(row: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(row).filter(([, v]) => v !== null && v !== undefined),
  ) as Partial<T>;
}
