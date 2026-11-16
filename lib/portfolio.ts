import { daysAgo, qty, today } from './format';
import type { HistoryPoint, Item } from './types';

export function groupHistory(rows: HistoryPoint[]) {
  const m = new Map<string, { t: string; v: number }[]>();
  rows.slice().sort((a, b) => a.t.localeCompare(b.t)).forEach(r => {
    if (!m.has(r.item_id)) m.set(r.item_id, []);
    m.get(r.item_id)!.push({ t: r.t, v: Number(r.value) });
  });
  return m;
}

export function valueAsOf(h: { t: string; v: number }[] | undefined, d: string) {
  let v: number | null = null;
  for (const p of h || []) { if (p.t <= d) v = p.v; else break; }
  return v;
}

export function portfolioSeries(items: Item[], hist: Map<string, { t: string; v: number }[]>, rangeDays: number) {
  const dates = new Set([today()]);
  items.forEach(i => (hist.get(i.id) || []).forEach(p => dates.add(p.t)));
  let ds = [...dates].sort();
  if (rangeDays) {
    const cut = daysAgo(rangeDays);
    ds = ds.filter(d => d >= cut);
    if (!ds.length || ds[0] > cut) ds.unshift(cut);
  }
  return ds.map(d => ({ t: d, v: items.reduce((s, i) => { const v = valueAsOf(hist.get(i.id), d); return s + (v == null ? 0 : v * qty(i)); }, 0) }));
}
