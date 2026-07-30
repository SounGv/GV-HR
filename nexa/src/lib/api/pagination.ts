import { z } from "zod";
import type { PageMeta } from "./response";

/**
 * Shared query params for list endpoints: pagination, search, sort.
 * Parse `request.nextUrl.searchParams` through `listQuerySchema`.
 */
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  sortBy: z.string().max(60).optional(),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

/** Parse URLSearchParams into a validated ListQuery. */
export function parseListQuery(searchParams: URLSearchParams): ListQuery {
  return listQuerySchema.parse(Object.fromEntries(searchParams.entries()));
}

/** Convert a ListQuery into Prisma skip/take. */
export function toSkipTake(q: ListQuery) {
  return { skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}

export function buildPageMeta(q: ListQuery, total: number): PageMeta {
  return {
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

/**
 * Build a safe Prisma orderBy from client input, restricted to an allowlist of
 * sortable columns to prevent arbitrary-field ordering.
 */
export function buildOrderBy<T extends string>(
  q: ListQuery,
  allowed: readonly T[],
  fallback: T,
): Record<string, "asc" | "desc"> {
  const field = allowed.includes(q.sortBy as T) ? (q.sortBy as T) : fallback;
  return { [field]: q.sortDir };
}
