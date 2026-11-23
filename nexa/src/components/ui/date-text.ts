const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-11-20" → "20/11/2569" (day/month/Buddhist year, as staff read dates). Anything else → "". */
export function isoToThaiText(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${Number(m[1]) + 543}` : "";
}

/**
 * "20/11/2569" or "20/11/2026" → "2026-11-20". A year of 2400 or more is read as Buddhist era. Returns null when the text is
 * not a real calendar date, so a half-typed value never reaches the form.
 */
export function thaiTextToIso(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year >= 2400) year -= 543;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day)
    return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Keeps digits only and puts the slashes in while typing: 20112569 → 20/11/2569. */
export function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
