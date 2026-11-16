'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useAuth, useUi } from '@/components/Providers';
import { GradeBadge, ItemCard } from '@/components/ItemBits';
import { IconCamera, IconPlus, IconSearch } from '@/components/Icons';
import { CONDITIONS } from '@/lib/constants';
import { gainOf, metaLine, money, qty } from '@/lib/format';
import { useMyItems } from '@/lib/useData';
import { supabaseBrowser } from '@/lib/supabase/client';
import { estimateWithKey, getClaudeKey } from '@/lib/claude';
import type { Item } from '@/lib/types';

const SORTS: [string, string][] = [['value-desc', 'Value, high to low'], ['value-asc', 'Value, low to high'], ['gain-desc', 'Biggest gain'], ['added-desc', 'Recently added'], ['name-asc', 'Name A to Z'], ['year-asc', 'Oldest first']];

export default function CollectionPage() {
  const { user } = useAuth();
  const { toast, confirm } = useUi();
  const router = useRouter();
  const { items, setItems, loading, reload } = useMyItems(user?.id);
  const [f, setF] = useState({ q: '', cat: 'all', folder: 'all', cond: 'all', graded: 'all', status: 'owned', sort: 'value-desc' });
  const [layout, setLayout] = useState<'grid' | 'table'>('grid');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState('');
  const [moveTo, setMoveTo] = useState<string | null>(null);

  const scoped = useMemo(() => items.filter(i => f.status === 'all' || i.status === f.status), [items, f.status]);
  const folders = useMemo(() => [...new Set(items.map(i => i.folder).filter(Boolean))].sort(), [items]);
  const counts = useMemo(() => { const c: Record<string, number> = {}; scoped.forEach(i => { c[i.category] = (c[i.category] || 0) + 1; }); return c; }, [scoped]);
  const list = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    let arr = scoped.slice();
    if (q) arr = arr.filter(i => [i.name, i.brand, i.set_name, i.number, i.subject, i.variant, i.year, i.folder, i.tags.join(' '), i.notes, i.grader, i.grade].join(' ').toLowerCase().includes(q));
    if (f.cat !== 'all') arr = arr.filter(i => i.category === f.cat);
    if (f.folder !== 'all') arr = arr.filter(i => i.folder === f.folder);
    if (f.cond !== 'all') arr = arr.filter(i => i.condition === f.cond);
    if (f.graded === 'graded') arr = arr.filter(i => !!i.grader); else if (f.graded === 'raw') arr = arr.filter(i => !i.grader);
    const v = (i: Item) => (Number(i.value) || 0) * qty(i);
    const sorts: Record<string, (a: Item, b: Item) => number> = {
      'value-desc': (a, b) => v(b) - v(a), 'value-asc': (a, b) => v(a) - v(b),
      'gain-desc': (a, b) => (gainOf(b) ?? -1e12) - (gainOf(a) ?? -1e12), 'added-desc': (a, b) => b.created_at.localeCompare(a.created_at),
      'name-asc': (a, b) => a.name.localeCompare(b.name), 'year-asc': (a, b) => (a.year || '9999').localeCompare(b.year || '9999')
    };
    return arr.sort(sorts[f.sort]);
  }, [scoped, f]);
  const total = list.reduce((s, i) => s + (Number(i.value) || 0) * qty(i), 0);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  const toggle = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const sel = () => items.filter(i => selected.has(i.id));
  const sb = supabaseBrowser();

  async function bulkUpdate(patch: Partial<Item>, label: string) {
    const ids = [...selected];
    const { error } = await sb.from('items').update(patch).in('id', ids);
    if (error) { toast(error.message); return; }
    setItems(prev => prev.map(i => selected.has(i.id) ? { ...i, ...patch } : i));
    toast(label);
  }
  async function bulkDelete() {
    const n = selected.size;
    if (!(await confirm(`Delete ${n} item${n > 1 ? 's' : ''}?`))) return;
    const { error } = await sb.from('items').delete().in('id', [...selected]);
    if (error) { toast(error.message); return; }
    setItems(prev => prev.filter(i => !selected.has(i.id))); setSelected(new Set()); toast(`Deleted ${n}`);
  }
  async function bulkComps() {
    const list = sel(); let ok = 0;
    for (const [k, it] of list.entries()) {
      setBusy(`Checking eBay ${k + 1} of ${list.length}`);
      const r = await fetch('/api/comps', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'item', id: it.id }) });
      if (r.ok) ok++; else if (r.status === 501) { toast('eBay keys are not set up on this site yet.'); break; }
    }
    setBusy(''); toast(`Checked eBay asking prices for ${ok} item${ok === 1 ? '' : 's'}`); reload();
  }
  async function bulkEstimate() {
    if (!getClaudeKey()) { toast('Add your Anthropic API key in Settings to re-estimate here. Otherwise values refresh nightly in Claude.'); return; }
    const list = sel(); setBusy(`Asking Claude about ${list.length} item${list.length > 1 ? 's' : ''}`);
    try {
      const m = await estimateWithKey(list); let n = 0;
      for (const it of list) {
        const r = m.get(it.id); if (!r) continue;
        await sb.from('items').update({ value: r.value_mid, value_low: r.value_low, value_high: r.value_high, value_note: r.note || '', value_source: 'Claude estimate', value_updated_at: new Date().toISOString() }).eq('id', it.id);
        n++;
      }
      toast(`Updated ${n} value${n === 1 ? '' : 's'}`); reload();
    } catch (e: any) { toast(e.message); }
    setBusy('');
  }

  return (
    <>
      <div className="page-head">
        <div><h1>Collection</h1><p>Search, filter and sort everything you own. Open an item to edit it or update its value.</p></div>
        <div className="actions"><Link className="btn" href="/items/new"><IconPlus />Add manually</Link><Link className="btn primary" href="/scan"><IconCamera />Scan</Link></div>
      </div>
      <div className="toolbar">
        <label className="search"><IconSearch /><input className="input" id="f-q" type="search" placeholder="Search name, player, set, number, box" value={f.q} onChange={e => set('q', e.target.value)} aria-label="Search collection" /></label>
        <select className="input" id="f-status" value={f.status} onChange={e => set('status', e.target.value)} aria-label="Status"><option value="owned">Owned</option><option value="sold">Sold</option><option value="all">Owned and sold</option></select>
        <select className="input" id="f-folder" value={f.folder} onChange={e => set('folder', e.target.value)} aria-label="Box or binder"><option value="all">All boxes</option>{folders.map(x => <option key={x}>{x}</option>)}</select>
        <select className="input" id="f-cond" value={f.cond} onChange={e => set('cond', e.target.value)} aria-label="Condition"><option value="all">Any condition</option>{CONDITIONS.map(c => <option key={c}>{c}</option>)}</select>
        <select className="input" id="f-graded" value={f.graded} onChange={e => set('graded', e.target.value)} aria-label="Graded"><option value="all">Graded and raw</option><option value="graded">Graded only</option><option value="raw">Raw only</option></select>
        <select className="input" id="f-sort" value={f.sort} onChange={e => set('sort', e.target.value)} aria-label="Sort">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <div className="seg" role="group" aria-label="Layout"><button type="button" aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}>Grid</button><button type="button" aria-pressed={layout === 'table'} onClick={() => setLayout('table')}>Table</button></div>
        <button className={`btn ${selectMode ? 'primary' : ''}`} type="button" onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }}>{selectMode ? 'Done' : 'Select'}</button>
      </div>
      <div className="chips" role="group" aria-label="Category">
        <button type="button" aria-pressed={f.cat === 'all'} onClick={() => set('cat', 'all')}>All<span className="c">{scoped.length}</span></button>
        {Object.keys(counts).sort((a, b) => counts[b] - counts[a]).map(c => <button key={c} type="button" aria-pressed={f.cat === c} onClick={() => set('cat', c)}>{c}<span className="c">{counts[c]}</span></button>)}
      </div>
      {selectMode && (
        <div className="selbar">
          <b>{selected.size} selected</b><span style={{ flex: 1 }} />{busy && <span className="small">{busy}</span>}
          <button className="btn sm" type="button" onClick={() => setSelected(new Set(list.map(i => i.id)))}>Select all {list.length}</button>
          <button className="btn sm" type="button" disabled={!selected.size || !!busy} onClick={bulkComps}>Check eBay</button>
          <button className="btn sm" type="button" disabled={!selected.size || !!busy} onClick={bulkEstimate}>Re-estimate</button>
          <button className="btn sm" type="button" disabled={!selected.size} onClick={() => setMoveTo('')}>Move to box</button>
          <button className="btn sm" type="button" disabled={!selected.size} onClick={() => bulkUpdate({ featured: true }, 'Featured on your profile')}>Feature</button>
          <button className="btn sm" type="button" disabled={!selected.size} onClick={bulkDelete}>Delete</button>
        </div>
      )}
      {loading ? <div className="working"><span className="spinner" />Loading</div> : !list.length ? (
        <div className="empty"><p>{items.length ? 'No items match these filters.' : 'No items yet. Scan or add your first piece.'}</p>
          {items.length > 0 && <button className="btn sm" type="button" onClick={() => setF({ ...f, q: '', cat: 'all', folder: 'all', cond: 'all', graded: 'all' })}>Clear filters</button>}</div>
      ) : (
        <div>
          <p className="small muted" style={{ margin: '0 0 10px' }}>{list.length} item{list.length === 1 ? '' : 's'} · <span className="num">{money(total, total >= 100)}</span> total</p>
          {layout === 'grid' ? (
            <div className="grid">{list.map(i => <ItemCard key={i.id} i={i} href={`/items/${i.id}`} selectMode={selectMode} selected={selected.has(i.id)} onClick={() => toggle(i.id)} />)}</div>
          ) : (
            <div className="table-wrap"><table><thead><tr>{selectMode && <th />}<th>Item</th><th>Category</th><th>Grade / condition</th><th>Box</th><th className="n">Qty</th><th className="n">Paid</th><th className="n">eBay ask</th><th className="n">Value</th><th className="n">Gain</th></tr></thead>
              <tbody>{list.map(i => { const g = gainOf(i); return (
                <tr key={i.id} onClick={() => selectMode ? toggle(i.id) : router.push(`/items/${i.id}`)}>
                  {selectMode && <td><input type="checkbox" readOnly checked={selected.has(i.id)} aria-label={`Select ${i.name}`} tabIndex={-1} /></td>}
                  <td><span className="name">{i.name}</span>{i.status === 'sold' && <> <span className="chip">Sold</span></>}<br /><span className="meta">{metaLine(i)}</span></td>
                  <td>{i.category}</td><td><GradeBadge i={i} /></td><td>{i.folder}</td><td className="n">{qty(i)}</td>
                  <td className="n">{i.purchase_price !== null ? money(Number(i.purchase_price) * qty(i)) : ''}</td>
                  <td className="n">{i.ask_median !== null ? money(Number(i.ask_median)) : ''}</td>
                  <td className="n">{money((Number(i.value) || 0) * qty(i))}</td>
                  <td className="n" style={{ color: `var(${g === null ? '--muted' : g >= 0 ? '--good' : '--bad'})` }}>{g === null ? '' : (g >= 0 ? '+' : '') + money(g)}</td>
                </tr>); })}</tbody></table></div>
          )}
        </div>
      )}
      {moveTo !== null && (
        <>
          <div className="scrim" style={{ zIndex: 59 }} onClick={() => setMoveTo(null)} />
          <div className="modal"><div className="modal-card" role="dialog" aria-modal="true">
            <h2>Move {selected.size} item{selected.size > 1 ? 's' : ''}</h2>
            <label className="field"><span>Box or binder name</span><input className="input" id="move-to" list="folders" value={moveTo} onChange={e => setMoveTo(e.target.value)} autoFocus /></label>
            <datalist id="folders">{folders.map(x => <option key={x} value={x} />)}</datalist>
            <div className="actions" style={{ justifyContent: 'flex-end' }}><button className="btn" type="button" onClick={() => setMoveTo(null)}>Cancel</button>
              <button className="btn primary" type="button" onClick={async () => { await bulkUpdate({ folder: moveTo.trim() }, 'Moved'); setMoveTo(null); }}>Move</button></div>
          </div></div>
        </>
      )}
    </>
  );
}
