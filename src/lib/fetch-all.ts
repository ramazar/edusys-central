/**
 * The backend returns at most 1000 rows per request. Use this when every row
 * matters (e.g. summing money) — it keeps requesting pages until all rows are read.
 * `page` must build a fresh, stably-ordered query and apply `.range(from, to)`.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) return all;
  }
}
