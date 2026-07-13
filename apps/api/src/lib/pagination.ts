export interface PageParams {
  page: number;
  pageSize: number;
}

export function toSkipTake({ page, pageSize }: PageParams): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export function toPaginatedResult<T>(
  items: T[],
  total: number,
  { page, pageSize }: PageParams,
): PaginatedResult<T> {
  return { items, page, pageSize, total };
}
