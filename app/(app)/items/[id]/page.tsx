'use client';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useUi } from '@/components/Providers';
import { AreaChart } from '@/components/AreaChart';
import { Thumb } from '@/components/ItemBits';
import { IconSpark } from '@/components/Icons';
import { supabaseBrowser } from '@/lib/supabase/client';
import { CATEGORIES, CONDITIONS, GRADERS } from '@/lib/constants';
import { fmtDay, gainOf, money, num, qty, today } from '@/lib/format';
import { prepareImage, uploadPhoto } from '@/lib/images';
import { estimateWithKey, getClaudeKey } from '@/lib/claude';
import type { Item } from '@/lib/types';

const BLANK: Partial<Item> = {
  name: '', category: 'Sports Cards', year: '', brand: '', set_name: '', number: '', subject: '', variant: '', condition: '',
  grader: '', grade: '', cert_number: '', sealed: false, quantity: 1, purchase_price: null, purchase_date: null, value: null,
  folder: '', tags: [], notes: '', featured: false, status: 'owned', sold_price: null, sold_date: null
};

export default function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === 'new';
  const { user } = useAuth();
  const { toast, confirm } = useUi();
  const router = useRouter();
  const search = useSearchParams();
  const sb = supabaseBrowser();
  const [d, setD] = useState<Partial<Item> | null>(isNew ? { ...BLANK } : null);
  const [orig, setOrig] = useState<Partial<Item> | null>(null);
  const [hist, setHist] = useState<{ t: string; v: number }[]>([]);
  const [face, setFace] = useState(0);
  const [busy, setBusy] = useState('');
  const [comps, setComps] = useState<any[] | null>(null);
  const [post, setPost] = useState<string | null>(null);
  const fromWish = search.get('fromWish');

  useEffect(() => {
    if (isNew) {
      if (fromWish) sb.from('wishes').select('*').eq('id', fromWish).maybeSingle().then(({ data: w }) => {
        if (w) setD({ ...BLANK, name: w.name, category: w.category, year: w.year, set_name: w.set_name, number: w.number, subject: w.subject, condition: w.condition, value: w.value, purchase_date: today(), photo_front: w.photo });
      });
      return;
    }
    sb.from('items').select('*').eq('id', id).maybeSingle().then(({ data }) => { if (!data) { toast('Item not found'); router.replace('/collection'); return; } setD(data); setOrig(data); });
    sb.from('value_history').select('t,value').eq('item_id', id).order('t').then(({ data }) => setHist((data || []).map((r: any) => ({ t: r.t, v: Number(r.value) }))));
  }, [id, isNew, fromWish, sb, router, toast]);

  if (!d) return <div className="working"><span className="spinner" />Loading</div>;
  const set = (k: keyof Item, v: any) => setD(p => ({ ...p!, [k]: v }));
  const photos = [d.photo_front, d.photo_back].filter(Boolean) as string[];
  const g = gainOf(d as Item);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>, which: 'photo_front' | 'photo_back') {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || !user) return;
    setBusy('Uploading photo');
    try { const p = await prepareImage(file); const path = await uploadPhoto(user.id, p.store); set(which, path); setFace(which === 'photo_front' ? 0 : 1); }
    catch { toast('Could not read that photo. Try a JPG or PNG.'); }
    setBusy('');
  }

  async function save() {
    if (!d.name?.trim()) { toast('Add a name before saving.'); return; }
    setBusy('Saving');
    const row: any = { ...d, name: d.name.trim(), quantity: Math.max(1, Math.round(num(d.quantity) || 1)), purchase_price: num(d.purchase_price), value: num(d.value), sold_price: num(d.sold_price) };
    delete row.id; delete row.user_id; delete row.created_at; delete row.updated_at;
    if (row.value !== null && row.value !== (orig?.value !== undefined && orig?.value !== null ? Number(orig.value) : null)) {
      row.value_source = 'Manual'; row.value_updated_at = new Date().toISOString(); row.value_low = null; row.value_high = null;
    }
    const q = isNew ? sb.from('items').insert({ ...row, user_id: user!.id }).select().single() : sb.from('items').update(row).eq('id', id).select().single();
    const { data, error } = await q;
    setBusy('');
    if (error) { toast(error.message); return; }
    if (isNew && fromWish) await sb.from('wishes').delete().eq('id', fromWish);
    toast(isNew ? 'Added to your collection' : 'Saved');
    if (isNew) router.replace(`/items/${data.id}`); else { setD(data); setOrig(data); reloadHist(); }
  }
  async function reloadHist() {
    const { data } = await sb.from('value_history').select('t,value').eq('item_id', id).order('t');
    setHist((data || []).map((r: any) => ({ t: r.t, v: Number(r.value) })));
  }
  async function del() {
    if (!(await confirm(`Delete ${d.name || 'this item'}?`))) return;
    const { error } = await sb.from('items').delete().eq('id', id);
    if (error) { toast(error.message); return; }
    toast('Deleted'); router.replace('/collection');
  }
  async function checkEbay() {
    if (isNew) { toast('Save the item first.'); return; }
    setBusy('Checking eBay');
    const r = await fetch('/api/comps', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'item', id }) });
    const j = await r.json().catch(() => ({}));
    setBusy('');
    if (!r.ok) { toast(j.error || 'eBay check failed.'); return; }
    setComps(j.sample || []);
    setD(p => ({ ...p!, ask_median: j.median, ask_low: j.low, ask_high: j.high, ask_count: j.count, ask_query: j.query, ask_checked_at: new Date().toISOString() }));
  }
  async function estimate() {
    if (!getClaudeKey()) { toast('Add your Anthropic API key in Settings to re-estimate here. Otherwise this item reprices nightly in Claude.'); return; }
    setBusy('Asking Claude');
    try {
      const m = await estimateWithKey([{ ...d, id: isNew ? 'new' : id }]);
      const r = m.get(isNew ? 'new' : id);
      if (!r) throw new Error('Claude could not price this item. Add more detail and try again.');
      const patch = { value: r.value_mid, value_low: r.value_low, value_high: r.value_high, value_note: r.note || '', value_source: 'Claude estimate', value_updated_at: new Date().toISOString() };
      if (!isNew) { await sb.from('items').update(patch).eq('id', id); setOrig(o => ({ ...o!, ...patch })); reloadHist(); toast('Value updated'); }
      setD(p => ({ ...p!, ...patch }));
    } catch (e: any) { toast(e.message); }
    setBusy('');
  }
  async function share() {
    const { error } = await sb.from('posts').insert({ user_id: user!.id, item_id: id, body: (post || '').slice(0, 1000), photo: d.photo_front });
    if (error) { toast(error.message); return; }
    setPost(null); toast('Shared to the feed');
  }

  const F = (k: keyof Item, label: string, cls = '', type = 'text', ph = '') => (
    <label className={`field ${cls}`}><span>{label}</span>
      <input className="input" id={`d-${k}`} type={type} placeholder={ph} value={(d[k] as any) ?? ''} onChange={e => set(k, e.target.value)} /></label>
  );
  const S = (k: keyof Item, label: string, opts: string[], none?: string, cls = '') => (
    <label className={`field ${cls}`}><span>{label}</span>
      <select className="input" id={`d-${k}`} value={(d[k] as any) ?? ''} onChange={e => set(k, e.target.value)}>
        {none !== undefined && <option value="">{none}</option>}{opts.map(o => <option key={o}>{o}</option>)}</select></label>
  );

  return (
    <>
      <div className="page-head">
        <div><p style={{ margin: 0 }}><Link className="link small" href="/collection">Collection</Link></p><h1>{d.name || 'New item'}</h1></div>
        <div className="actions">
          {busy && <span className="working small"><span className="spinner" />{busy}</span>}
          {!isNew && <button className="btn" type="button" onClick={() => setPost('')}>Share to feed</button>}
          <button className="btn primary" type="button" onClick={save} disabled={!!busy}>{isNew ? 'Add to collection' : 'Save'}</button>
        </div>
      </div>
      <div className="item-top" style={{ gridTemplateColumns: 'minmax(200px,280px) minmax(0,1fr)' }}>
        <div className="photo">
          {photos.length ? <Thumb path={photos[Math.min(face, photos.length - 1)]} alt={face ? 'Back photo' : 'Front photo'} /> : <span className="thumb-ph" style={{ width: '100%', height: 'auto', aspectRatio: '5/7', borderRadius: 10 }} />}
          <div className="row">
            {photos.length > 1 && <button className="btn sm" type="button" onClick={() => setFace(face ? 0 : 1)}>Show {face ? 'front' : 'back'}</button>}
            <label className="btn sm" htmlFor="ph-front">{d.photo_front ? 'Replace front' : 'Add photo'}</label>
            <input type="file" id="ph-front" accept="image/*" className="hidden" onChange={e => onPhoto(e, 'photo_front')} />
            <label className="btn sm" htmlFor="ph-back">{d.photo_back ? 'Replace back' : 'Add back'}</label>
            <input type="file" id="ph-back" accept="image/*" className="hidden" onChange={e => onPhoto(e, 'photo_back')} />
          </div>
        </div>
        <div className="valuebox panel">
          <span className="small muted">Value{qty(d) > 1 ? ` (×${qty(d)})` : ''}</span>
          <span className="big">{money((num(d.value) || 0) * qty(d))}</span>
          <span className="small muted">
            {d.value_low !== null && d.value_low !== undefined ? `Range ${money(Number(d.value_low))} to ${money(Number(d.value_high))} each. ` : ''}
            {d.value_source}{d.value_updated_at ? `, updated ${fmtDay(d.value_updated_at)}` : ''}
          </span>
          {g !== null && <span className={`chip ${g >= 0 ? 'good' : 'bad'}`} style={{ alignSelf: 'flex-start' }}>{g >= 0 ? '+' : ''}{money(g)} vs {money(Number(d.purchase_price) * qty(d))} paid</span>}
          {hist.length > 1 ? <AreaChart points={hist} h={170} w={460} /> : <p className="small muted" style={{ margin: 0 }}>History builds each time the value is updated.</p>}
          {d.value_note && <p className="ai-note">{d.value_note}</p>}
          <div className="comps">
            <b>eBay asking prices</b>
            {d.ask_checked_at ? (
              <span>{d.ask_count ? <>Median <span className="num">{money(Number(d.ask_median))}</span> across {d.ask_count} listings (middle half {money(Number(d.ask_low))} to {money(Number(d.ask_high))}). </> : 'No matching listings found. '}
                <span className="muted">Checked {fmtDay(d.ask_checked_at)} for &quot;{d.ask_query}&quot;. Asking prices usually run above what items sell for.</span></span>
            ) : <span className="muted">Not checked yet. These refresh weekly.</span>}
            {comps && comps.length > 0 && <ul style={{ margin: 0, paddingLeft: 18 }}>{comps.map((c, k) => <li key={k}><a href={c.url} target="_blank" rel="noreferrer">{money(c.price)}</a> <span className="muted">{c.title}</span></li>)}</ul>}
          </div>
          <div className="actions">
            <button className="btn" type="button" onClick={checkEbay} disabled={!!busy}>Check eBay now</button>
            <button className="btn" type="button" onClick={estimate} disabled={!!busy}><IconSpark />Re-estimate with Claude</button>
          </div>
        </div>
      </div>
      {d.ai_notes && <p className="ai-note"><b>ID notes:</b> {d.ai_notes}</p>}
      <form className="form-grid panel" onSubmit={e => { e.preventDefault(); save(); }}>
        {F('name', 'Name', 'w4', 'text', 'e.g. 1989 Upper Deck Ken Griffey Jr. #1')}
        {S('category', 'Category', CATEGORIES, undefined, 'w2')}{F('year', 'Year')}{F('number', 'Number')}
        {F('brand', 'Brand / maker', 'w2')}{F('set_name', 'Set / series', 'w2')}
        {F('subject', 'Player / character', 'w2')}{F('variant', 'Variant / edition', 'w2')}
        {S('condition', 'Condition', CONDITIONS, 'Not set')}{S('grader', 'Grader', GRADERS, 'Raw')}{F('grade', 'Grade')}{F('cert_number', 'Cert number')}
        {F('quantity', 'Quantity', '', 'number')}{F('purchase_price', 'Price paid each ($)')}{F('purchase_date', 'Date bought', '', 'date')}{F('value', 'Value each ($)')}
        {F('folder', 'Box or binder', 'w2', 'text', 'e.g. Box 3')}
        <label className="field w2"><span>Tags</span><input className="input" id="d-tags" value={(d.tags || []).join(', ')} onChange={e => set('tags', e.target.value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 12))} placeholder="rookie, holo, auto" /></label>
        <label className="field w4"><span>Notes</span><textarea className="input" id="d-notes" value={d.notes || ''} onChange={e => set('notes', e.target.value)} /></label>
        <label className="check w2"><input type="checkbox" id="d-sealed" checked={!!d.sealed} onChange={e => set('sealed', e.target.checked)} /> Sealed / unopened</label>
        <label className="check w2"><input type="checkbox" id="d-featured" checked={!!d.featured} onChange={e => set('featured', e.target.checked)} /> Feature on my public profile</label>
        <label className="check w2"><input type="checkbox" id="d-sold" checked={d.status === 'sold'} onChange={e => setD(p => ({ ...p!, status: e.target.checked ? 'sold' : 'owned', sold_date: e.target.checked ? (p!.sold_date || today()) : p!.sold_date }))} /> Mark as sold</label>
        {d.status === 'sold' && <>{F('sold_price', 'Sold for each ($)')}{F('sold_date', 'Date sold', '', 'date')}</>}
      </form>
      {!isNew && <div><button className="btn danger" type="button" onClick={del}>Delete item</button></div>}
      {post !== null && (
        <>
          <div className="scrim" style={{ zIndex: 59 }} onClick={() => setPost(null)} />
          <div className="modal"><div className="modal-card" role="dialog" aria-modal="true">
            <h2>Share to the feed</h2>
            <label className="field"><span>Say something about it (optional)</span><textarea className="input" id="post-body" maxLength={1000} value={post} onChange={e => setPost(e.target.value)} autoFocus /></label>
            <p className="small muted" style={{ margin: 0 }}>Your post shows this item&apos;s photo and name. Values show only if you allow it in Settings.</p>
            <div className="actions" style={{ justifyContent: 'flex-end' }}><button className="btn" type="button" onClick={() => setPost(null)}>Cancel</button><button className="btn primary" type="button" onClick={share}>Post</button></div>
          </div></div>
        </>
      )}
    </>
  );
}
