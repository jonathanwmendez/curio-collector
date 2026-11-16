import { CATEGORIES, CONDITIONS } from './constants';
import { num } from './format';

export const CSV_FIELDS: [string, string][] = [
  ['name', 'Name'], ['category', 'Category'], ['year', 'Year'], ['brand', 'Brand'], ['set_name', 'Set'], ['number', 'Number'],
  ['subject', 'Subject'], ['variant', 'Variant'], ['condition', 'Condition'], ['grader', 'Grader'], ['grade', 'Grade'],
  ['cert_number', 'Cert number'], ['sealed', 'Sealed'], ['quantity', 'Quantity'], ['purchase_price', 'Purchase price'],
  ['purchase_date', 'Purchase date'], ['value', 'Value'], ['ask_median', 'eBay asking median'], ['folder', 'Box'],
  ['tags', 'Tags'], ['notes', 'Notes'], ['status', 'Status'], ['sold_price', 'Sold price'], ['sold_date', 'Sold date']
];

export function toCSV(rows: any[]) {
  const cell = (v: any) => {
    const s = Array.isArray(v) ? v.join('; ') : v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [CSV_FIELDS.map(f => f[1]).join(','), ...rows.map(r => CSV_FIELDS.map(([k]) => cell(r[k])).join(','))].join('\n');
}

export function parseCSV(text: string) {
  const rows: string[][] = []; let row: string[] = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}

const ALIAS: Record<string, string> = {
  'market value': 'value', 'price': 'value', 'est. value': 'value', 'estimated value': 'value', 'box': 'folder', 'binder': 'folder',
  'player': 'subject', 'character': 'subject', 'manufacturer': 'brand', 'maker': 'brand', 'publisher': 'brand', 'set': 'set_name',
  'series': 'set_name', 'card number': 'number', 'paid': 'purchase_price', 'cost': 'purchase_price', 'qty': 'quantity', 'item': 'name', 'title': 'name'
};

export function csvToItems(text: string) {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('That file has no rows to import.');
  const head = rows[0].map(h => h.trim().toLowerCase());
  const map = head.map(h => {
    const f = CSV_FIELDS.find(([k, l]) => k === h || l.toLowerCase() === h);
    return f ? f[0] : ALIAS[h] || null;
  });
  if (!map.includes('name')) throw new Error('The CSV needs a Name column.');
  const items: any[] = [];
  for (const r of rows.slice(1)) {
    const it: any = { tags: [] };
    map.forEach((k, idx) => {
      if (!k || k === 'ask_median') return;
      const v = (r[idx] || '').trim();
      if (['purchase_price', 'value', 'sold_price'].includes(k)) it[k] = num(v);
      else if (k === 'quantity') it.quantity = Math.max(1, Math.round(num(v) || 1));
      else if (k === 'tags') it.tags = v.split(/[;,]/).map(s => s.trim()).filter(Boolean);
      else if (k === 'sealed') it.sealed = /^(y|yes|true|1)$/i.test(v);
      else if (['purchase_date', 'sold_date'].includes(k)) it[k] = /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
      else it[k] = v;
    });
    if (!it.name) continue;
    it.name = String(it.name).slice(0, 200);
    if (!CATEGORIES.includes(it.category)) it.category = CATEGORIES.find(c => c.toLowerCase() === String(it.category || '').toLowerCase()) || 'Other';
    if (!CONDITIONS.includes(it.condition)) it.condition = '';
    it.status = it.status === 'sold' ? 'sold' : 'owned';
    if (it.value !== null && it.value !== undefined) it.value_source = 'Imported';
    items.push(it);
  }
  return items;
}
