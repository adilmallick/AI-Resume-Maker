/**
 * Formats an ISO date string (YYYY-MM-DD or YYYY-MM) into a human-readable
 * "Mon YYYY" label (e.g. "Aug 2023").
 * Returns an empty string if the input is falsy.
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';

  // Already human-readable (e.g. "Aug 2023") — pass through
  if (/^[A-Za-z]/.test(dateStr)) return dateStr;

  // Parse ISO date — use UTC noon to avoid timezone-shift issues
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, (month || 1) - 1, day || 1, 12));

  if (isNaN(d.getTime())) return dateStr; // fallback: return raw string

  return d.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Formats a date range as "Mon YYYY – Mon YYYY" or "Mon YYYY – Present".
 */
export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
  separator = '–'
): string {
  const s = formatDate(start);
  const e = formatDate(end);
  if (!s && !e) return '';
  return `${s} ${separator} ${e || 'Present'}`.trim();
}
