/**
 * Runs a Supabase query that filters with `.in(column, ids)` in batches, so a
 * long id list (everyone you follow, every follower) can't make the request
 * address too long and fail. Up to IN_CHUNK_SIZE ids it is exactly one
 * request, as before; beyond that, one request per batch in parallel, with
 * the rows joined back together.
 *
 * A query that sorts (and possibly limits) must pass the same `sort` (and
 * `limit`) so the joined rows come out as one request would have returned
 * them: each batch sorts and limits on its own, so the merged top `limit`
 * after re-sorting is the overall top `limit`.
 */
export const IN_CHUNK_SIZE = 150;

type Rows<T> = { data: T[] | null; error: unknown };

export async function selectInChunks<T>(
  ids: readonly string[],
  query: (chunk: string[]) => PromiseLike<Rows<T>>,
  options: { sort?: (a: T, b: T) => number; limit?: number } = {}
): Promise<Rows<T>> {
  if (ids.length <= IN_CHUNK_SIZE) return query([...ids]);

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK_SIZE) chunks.push(ids.slice(i, i + IN_CHUNK_SIZE));
  const results = await Promise.all(chunks.map((chunk) => query(chunk)));

  const failed = results.find((r) => r.error);
  if (failed) return { data: null, error: failed.error };

  let rows = results.flatMap((r) => r.data ?? []);
  if (options.sort) rows = rows.sort(options.sort);
  if (options.limit != null) rows = rows.slice(0, options.limit);
  return { data: rows, error: null };
}

/** Newest first by an ISO timestamp column, for queries ordered that way. */
export const newestFirst =
  <T extends Record<string, any>>(column: keyof T & string) =>
  (a: T, b: T) =>
    String(b[column] ?? "").localeCompare(String(a[column] ?? ""));
