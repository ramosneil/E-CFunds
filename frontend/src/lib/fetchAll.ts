// The database sends at most 1,000 rows per request (Supabase default). Lists that can grow past that — Members
// (SSG = every student), receipts, ledger, messages, exports — fetch page by page so nothing is silently cut off
// (audit 2026-11-17, lapse #3).
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  size = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < size) return out;
  }
}
