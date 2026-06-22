export type ExposedWorkersRow = { gesId: string; total: number | null };

export function resolveExposedTotal(row: { total: number | null } | undefined): number {
  return row?.total ?? 0;
}

export function buildExposedWorkersMap(
  rows: ExposedWorkersRow[],
): Record<string, number> {
  return Object.fromEntries(rows.map((r) => [r.gesId, r.total ?? 0]));
}
