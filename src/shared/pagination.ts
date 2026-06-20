export type Paginated<T> = { rows: T[]; total: number };

export const PAGE_SIZE_DEFAULT = 20;
export const PAGE_SIZE_MAX = 100;

export type PageParams = { page?: number; pageSize?: number };

export type ResolvedPageParams = {
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
};

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

export function resolvePageParams(input?: PageParams): ResolvedPageParams {
  const page = isPositiveInteger(input?.page) ? input!.page! : 1;
  const requestedSize = isPositiveInteger(input?.pageSize)
    ? input!.pageSize!
    : PAGE_SIZE_DEFAULT;
  const pageSize = Math.min(requestedSize, PAGE_SIZE_MAX);
  return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
}
