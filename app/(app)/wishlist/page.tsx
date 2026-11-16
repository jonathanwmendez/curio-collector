'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth, useUi } from '@/components/Providers';
import { Thumb } from '@/components/ItemBits';
import { IconPlus } from '@/components/Icons';
import { supabaseBrowser } from '@/lib/supabase/client';
import { CATEGORIES, CONDITIONS } from '@/lib/constants';
import { fmtDay, money, num } from '@/lib/format';
import { estimateWithKey, getClaudeKey } from '@/lib/claude';
import { useMyWishes } from '@/lib/useData';
import type { Wish } from '@/lib/types';

export default function WishlistPage() {
  const { user } = useAuth();
  const { toast, confirm } = useUi();
  const router = useRouter();
  const sb = supabaseBrowser();
  const { wishes, setWishes, loading, reload } = useMyWishes(user?.id);
  const [edit, setEdit] = useState<Partial<Wish> | null>(null);
  const [busy, setBusy] = useState('');

  async function saveWish() {
    if (!edit?.name?.trim()) { toast('Add a name first.'); return; }
    const row: any = { name: edit.name.trim(), category: edit.category || 'Other', year: edit.year || '', set_name: edit.set_name || '', number: edit.number || '', subject: edit.subject || '', condition: edit.condition || '', target_price: num(edit.target_price), notes: edit.notes || '' };
    const { error } = edit.id ? await sb.from('wishes').update(row).eq('id', edit.id) : await sb.from('wishes').insert({ ...row, user_id: user!.id });
    if (error) { toast(error.message); return; }
    setEdit(null); reload(); toast('Saved');
  }
  async function check(w: Wish) {
    setBusy(w.id);
    const r = await fetch('/api/comps', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'wish', id: w.id }) });
    let patch: any = {};
    if (r.ok) { const j = await r.json(); patch = { ask_median: j.median, ask_count: j.count, ask_checked_at: new Date().toISOString() }; }
    if (getClaudeKey()) {
      try { const m = await estimateWithKey([{ ...w, ...patch }]); const e = m.get(w.id); if (e) { patch = { ...patch, value: e.value_mid, value_note: e.note || '', value_updated_at: new Date().toISOString() }; await sb.from('wishes').update({ value: e.value_mid, value_note: e.note || '', value_updated_at: patch.value_updated_at }).eq('id', w.id); } }
      catch (err: any) { toast(err.message); }
    }
    setWishes(ws => ws.map(x => x.id === w.id ? { ...x, ...patch } : x));
    setBusy('');
    if (!r.ok && !getClaudeKey()) toast('Price checks run nightly in Claude. Add an API key or eBay keys to check on demand.');
  }

  return (
    <>
      <div className="page-head"><div><h1>Wishlist</h1><p>Pieces you&apos;re hunting, with the price you&apos;d pay. Items at or under your target are flagged.</p></div>
        <div className="actions"><button className="btn primary" type="button" onClick={() => setEdit({ category: 'Sports Cards' })}><IconPlus />Add to wishlist</button></div></div>
      {loading ? <div className="working"><span className="spinner" />Loading</div> : !wishes.length ? <div className="empty"><p>Nothing on your wishlist yet. Add a want, or send a scan here with Add to wishlist.</p></div> : (
        <div className="table-wrap"><table><thead><tr><th>Item</th><th>Category</th><th>Wanted condition</th><th className="n">Target</th><th className="n">Est. value</th><th className="n">eBay ask</th><th>Status</th><th /></tr></thead>
          <tbody>{wishes.map(w => {
            const t = w.target_price !== null ? Number(w.target_price) : null;
            const v = w.value !== null ? Number(w.value) : w.ask_median !== null ? Number(w.ask_median) : null;
            const hit = t !== null && v !== null && v <= t;
            return (
              <tr key={w.id} onClick={() => setEdit(w)}>
                <td><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Thumb path={w.photo} className="" /><span><span className="name">{w.name}</span><br /><span className="meta">{[w.year, w.set_name, w.number ? '#' + w.number : ''].filter(Boolean).join(' · ')}</span></span></div></td>
                <td>{w.category}</td><td>{w.condition || 'Any'}</td>
                <td className="n">{t !== null ? money(t) : ''}</td><td className="n">{w.value !== null ? money(Number(w.value)) : ''}</td>
                <td className="n">{w.ask_median !== null ? money(Number(w.ask_median)) : ''}</td>
                <td>{t === null || v === null ? <span className="chip">No target</span> : hit ? <span className="chip good">At or under target</span> : <span className="chip">{money(v - t)} over</span>}</td>
                <td className="right" style={{ whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                  <button className="btn sm" type="button" disabled={busy === w.id} onClick={() => check(w)}>{busy === w.id ? 'Checking' : 'Check price'}</button>{' '}
                  <button className="btn sm" type="button" onClick={() => router.push(`/items/new?fromWish=${w.id}`)}>Got it</button>
                </td>
              </tr>);
          })}</tbody></table></div>
      )}
      {edit && (
        <>
          <div className="scrim" style={{ zIndex: 59 }} onClick={() => setEdit(null)} />
          <div className="modal"><div className="modal-card wide" role="dialog" aria-modal="true">
            <h2>{edit.id ? 'Edit want' : 'Add to wishlist'}</h2>
            <div className="form-grid">
              {([['name', 'Name', 'w4'], ['year', 'Year', ''], ['number', 'Number', ''], ['set_name', 'Set / series', 'w2'], ['subject', 'Player / character', 'w2'], ['target_price', 'Target price ($)', '']] as [keyof Wish, string, string][]).map(([k, l, c]) => (
                <label key={k} className={`field ${c}`}><span>{l}</span><input className="input" id={`w-${k}`} value={(edit[k] as any) ?? ''} onChange={e => setEdit({ ...edit, [k]: e.target.value })} /></label>
              ))}
              <label className="field"><span>Category</span><select className="input" id="w-category" value={edit.category} onChange={e => setEdit({ ...edit, category: e.target.value })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
              <label className="field w2"><span>Wanted condition</span><select className="input" id="w-condition" value={edit.condition || ''} onChange={e => setEdit({ ...edit, condition: e.target.value })}><option value="">Any</option>{CONDITIONS.map(c => <option key={c}>{c}</option>)}</select></label>
              <label className="field w4"><span>Notes</span><textarea className="input" id="w-notes" value={edit.notes || ''} onChange={e => setEdit({ ...edit, notes: e.target.value })} /></label>
            </div>
            {edit.value_note && <p className="ai-note">{edit.value_note} {edit.value_updated_at ? `(checked ${fmtDay(edit.value_updated_at)})` : ''}</p>}
            <div className="actions" style={{ justifyContent: 'space-between' }}>
              {edit.id ? <button className="btn danger" type="button" onClick={async () => { if (await confirm(`Remove ${edit.name}?`, 'Remove')) { await sb.from('wishes').delete().eq('id', edit.id); setEdit(null); reload(); } }}>Remove</button> : <span />}
              <span className="actions"><button className="btn" type="button" onClick={() => setEdit(null)}>Cancel</button><button className="btn primary" type="button" onClick={saveWish}>Save</button></span>
            </div>
          </div></div>
        </>
      )}
    </>
  );
}
