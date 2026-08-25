/** Indian money formatting. ₹1.25 Cr reads better than ₹12,500,000 to every user we have. */
export function inr(value?: number | string | null): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_00_00_000) return `₹${trim(n / 1_00_00_000)} Cr`;
  if (n >= 1_00_000) return `₹${trim(n / 1_00_000)} L`;
  if (n >= 1_000) return `₹${trim(n / 1_000)} K`;
  return `₹${Math.round(n)}`;
}

export function inrFull(value?: number | string | null): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function trim(n: number) {
  return n.toFixed(2).replace(/\.?0+$/, '');
}

export const AREA_UNIT_LABEL: Record<string, string> = {
  SQFT: 'Sq.Ft',
  SQM: 'Sq.M',
  SQYD: 'Sq.Yd',
  ACRE: 'Acre',
  HECTARE: 'Hectare',
  BIGHA: 'Bigha',
};

export function area(value?: number | string | null, unit = 'SQFT'): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)} ${AREA_UNIT_LABEL[unit] ?? unit}`;
}

export function ratePerUnit(price?: number | string | null, size?: number | string | null, unit = 'SQFT') {
  const p = Number(price);
  const s = Number(size);
  if (!Number.isFinite(p) || !Number.isFinite(s) || s <= 0) return null;
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(p / s)} / ${AREA_UNIT_LABEL[unit] ?? unit}`;
}

export const shortDate = (d?: Date | string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const dateTime = (d?: Date | string | null) =>
  d
    ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

export const toDateInput = (d?: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export function toLocalInput(d?: Date | string | null) {
  if (!d) return '';
  const date = new Date(d);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** Cover photo first, then explicit sort order. */
/** What a photograph looks like wherever one is displayed. */
export type MediaItem = {
  id?: string;
  url?: string | null;
  thumbUrl?: string | null;
  alt?: string | null;
  isCover?: boolean | null;
  sortOrder?: number | null;
};

/**
 * Cover photograph first, then by sort order.
 *
 * Takes null and undefined itself rather than making callers write `?? []` — that
 * empty-array fallback was widening the type and losing the photograph's own
 * fields, so `photo.url` disappeared at the far end.
 */
export function coverFirst<T extends { isCover?: boolean | null; sortOrder?: number | null }>(
  media?: T[] | null,
): T[] {
  if (!media?.length) return [];
  return [...media].sort(
    (a, b) => Number(!!b.isCover) - Number(!!a.isCover) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
}

export function relativeDue(d?: Date | string | null) {
  if (!d) return '—';
  const diff = new Date(d).getTime() - Date.now();
  const days = Math.round(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return days < 0 ? `${Math.abs(days)} days overdue` : `in ${days} days`;
}

export const initials = (name: string) =>
  name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
