export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

export function money(v: number | null | undefined, whole = false) {
  if (v === null || v === undefined || Number.isNaN(v)) return '$–';
  const w = whole || Math.abs(v) >= 1000;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: w ? 0 : 2, maximumFractionDigits: w ? 0 : 2 }).format(v);
}

export function compact(v: number) {
  const trim = (s: string) => s.replace(/\.?0+$/, '');
  if (Math.abs(v) >= 1e6) return '$' + trim((v / 1e6).toFixed(2)) + 'M';
  if (Math.abs(v) >= 1e3) return '$' + trim((v / 1e3).toFixed(2)) + 'K';
  return '$' + Math.round(v);
}

export const pct = (v: number) => (v > 0 ? '+' : '') + (v * 100).toFixed(1) + '%';
const pad = (n: number) => String(n).padStart(2, '0');
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => isoDay(new Date());
export const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return isoDay(d); };
export const parseDay = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
export const fmtDay = (s?: string | null) => s ? parseDay(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
export const fmtShortDay = (s: string) => parseDay(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function timeAgo(iso: string) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  if (s < 86400 * 7) return Math.floor(s / 86400) + 'd';
  return fmtDay(iso);
}

export const qty = (i: { quantity?: number | null }) => Math.max(1, Math.round(i.quantity || 1));

export function metaLine(i: { year?: string; brand?: string; set_name?: string; number?: string; variant?: string }) {
  return [i.year, i.brand, i.set_name !== i.brand ? i.set_name : '', i.number ? '#' + String(i.number).replace(/^#/, '') : '', i.variant]
    .filter(Boolean).join(' · ');
}

export function gainOf(i: { purchase_price: number | null; value: number | null; quantity: number }) {
  if (i.purchase_price === null || i.purchase_price === undefined || i.value === null || i.value === undefined) return null;
  return (Number(i.value) - Number(i.purchase_price)) * qty(i);
}

export function photoUrl(path?: string | null) {
  if (!path) return '';
  if (path.startsWith('data:') || path.startsWith('http')) return path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${path}`;
}
