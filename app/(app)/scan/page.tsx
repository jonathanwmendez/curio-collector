'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth, useUi } from '@/components/Providers';
import { processInbox } from '@/components/AppShell';
import { IconPlus, IconSpark } from '@/components/Icons';
import { supabaseBrowser } from '@/lib/supabase/client';
import { CATEGORIES, CONDITIONS, GRADERS } from '@/lib/constants';
import { money, num } from '@/lib/format';
import { prepareImage, uploadPhoto } from '@/lib/images';
import { getClaudeKey, identifyWithKey } from '@/lib/claude';

const ARTIFACT_URL = process.env.NEXT_PUBLIC_CLAUDE_SCANNER_URL || 'https://claude.ai/artifact/FxAYG54hRbYAbNfQ4Gqkzi';

type Pic = { store: Blob; aiBase64: string; preview: string };
type Job = { id: string; front: Pic; back?: Pic; status: 'new' | 'working' | 'done' | 'error'; hint: string; d: any; error?: string };

export default function ScanPage() {
  const { user } = useAuth();
  const { toast } = useUi();
  const sb = supabaseBrowser();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [hasKey, setHasKey] = useState(false);
  const [pending, setPending] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { setHasKey(!!getClaudeKey()); }, []);
  useEffect(() => {
    if (!user) return;
    sb.from('scan_inbox').select('id', { count: 'exact', head: true }).is('processed_at', null).then(({ count }) => setPending(count || 0));
  }, [user, sb]);

  const upd = (id: string, patch: Partial<Job>) => setJobs(js => js.map(j => j.id === id ? { ...j, ...patch } : j));
  const updD = (id: string, k: string, v: any) => setJobs(js => js.map(j => j.id === id ? { ...j, d: { ...j.d, [k]: v } } : j));

  async function addFiles(files: File[]) {
    const imgs = files.filter(f => f.type.startsWith('image/'));
    if (!imgs.length) { toast('Those files are not images. Use JPG, PNG or WebP.'); return; }
    for (const f of imgs) {
      try { const p = await prepareImage(f); setJobs(js => [{ id: crypto.randomUUID(), front: p, status: 'new', hint: '', d: { quantity: 1, category: 'Sports Cards' } }, ...js]); }
      catch { toast(`Could not read ${f.name}. HEIC photos may need converting to JPG first.`); }
    }
  }
  async function identify(j: Job) {
    upd(j.id, { status: 'working' });
    try {
      const r = await identifyWithKey([j.front.aiBase64, j.back?.aiBase64].filter(Boolean) as string[], j.hint);
      upd(j.id, { status: 'done', d: {
        name: r.name || '', category: CATEGORIES.includes(r.category) ? r.category : 'Other', year: String(r.year || ''), brand: r.brand || '',
        set_name: r.set_name || '', number: String(r.number || ''), subject: r.subject || '', variant: r.variant || '',
        condition: CONDITIONS.includes(r.condition) ? r.condition : '', grader: r.grader || '', grade: String(r.grade || ''), cert_number: r.cert_number || '',
        sealed: !!r.sealed, value: num(r.value_mid) ?? '', value_low: num(r.value_low), value_high: num(r.value_high), confidence: num(r.confidence),
        ai_notes: r.notes || '', alternates: Array.isArray(r.alternates) ? r.alternates.filter((a: any) => a?.name).slice(0, 3) : [],
        tags: Array.isArray(r.tags) ? r.tags.slice(0, 5).map(String) : [], quantity: j.d.quantity || 1, folder: j.d.folder || '', purchase_price: j.d.purchase_price || '', ai: true
      } });
    } catch (e: any) { upd(j.id, { status: 'error', error: e.message }); }
  }
  async function save(j: Job, wish: boolean) {
    const d = j.d;
    if (!d.name?.trim()) { toast('Add a name first.'); return; }
    upd(j.id, { status: 'working' });
    try {
      const front = await uploadPhoto(user!.id, j.front.store);
      const back = j.back ? await uploadPhoto(user!.id, j.back.store) : null;
      if (wish) {
        const { error } = await sb.from('wishes').insert({ user_id: user!.id, name: d.name.trim(), category: d.category, year: d.year || '', set_name: d.set_name || '', number: d.number || '', subject: d.subject || '', condition: d.condition || '', target_price: num(d.value_low) ?? num(d.value), value: num(d.value), value_updated_at: num(d.value) !== null ? new Date().toISOString() : null, photo: front });
        if (error) throw error;
      } else {
        const v = num(d.value);
        const row: any = {
          user_id: user!.id, name: d.name.trim().slice(0, 200), category: d.category || 'Other', year: d.year || '', brand: d.brand || '', set_name: d.set_name || '', number: d.number || '',
          subject: d.subject || '', variant: d.variant || '', condition: d.condition || '', grader: d.grader || '', grade: d.grade || '', cert_number: d.cert_number || '', sealed: !!d.sealed,
          quantity: Math.max(1, Math.round(num(d.quantity) || 1)), purchase_price: num(d.purchase_price), folder: (d.folder || '').trim(), tags: d.tags || [], ai_notes: d.ai_notes || '',
          confidence: d.confidence ?? null, photo_front: front, photo_back: back, value: v, value_low: d.ai ? d.value_low : null, value_high: d.ai ? d.value_high : null,
          value_source: v === null ? '' : d.ai ? 'Claude estimate' : 'Manual', value_updated_at: v === null ? null : new Date().toISOString()
        };
        const { error } = await sb.from('items').insert(row);
        if (error) throw error;
      }
      setJobs(js => js.filter(x => x.id !== j.id));
      toast(wish ? 'Added to wishlist' : `Added ${d.name}`);
    } catch (e: any) { upd(j.id, { status: 'done' }); toast(e.message || 'Could not save.'); }
  }

  const F = (j: Job, k: string, label: string, cls = '', type = 'text') => (
    <label className={`field ${cls}`}><span>{label}</span><input className="input" id={`j-${j.id}-${k}`} type={type} value={j.d[k] ?? ''} onChange={e => updD(j.id, k, e.target.value)} /></label>
  );

  return (
    <>
      <div className="page-head"><div><h1>Scan</h1><p>Add items from photos. Claude identifies each one, fills in the details and estimates a value. You review before anything is saved.</p></div>
        <div className="actions"><Link className="btn" href="/items/new"><IconPlus />Add without a photo</Link></div></div>

      <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2>Scan in Claude (uses your Claude plan)</h2>
        <ol className="steps">
          <li>Open the <a className="link" href={ARTIFACT_URL} target="_blank" rel="noreferrer">Curio scanner in Claude</a>.</li>
          <li>The first time, paste your link code so scans land in your account:</li>
        </ol>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="code">{user?.id}</span>
          <button className="btn sm" type="button" onClick={async () => { try { await navigator.clipboard.writeText(user!.id); setCopied(true); } catch { toast('Select the code and copy it.'); } }}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
        <p className="small muted" style={{ margin: 0 }}>Items you approve in Claude show up here automatically. {pending ? `${pending} waiting now.` : ''}</p>
        <div><button className="btn sm" type="button" onClick={async () => { const n = await processInbox(user!.id); setPending(0); toast(n ? `Added ${n} item${n > 1 ? 's' : ''} from Claude` : 'No new scans from Claude yet.'); }}>Check for new scans</button></div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>Scan here with your own API key</h2>
        {!hasKey ? (
          <div className="banner"><p>Add an Anthropic API key in Settings to identify photos right on this site. Each scan costs a few cents on your API account. You can still add photos and fill in details yourself.</p><Link className="btn sm" href="/settings">Open Settings</Link></div>
        ) : null}
        <label className={`drop ${over ? 'over' : ''}`} htmlFor="scan-input" onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); addFiles([...e.dataTransfer.files]); }}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.6" /></svg>
          <b>Take or choose photos</b>
          <span className="muted small">One photo per item. Several at once is fine. JPG, PNG or WebP.</span>
          <input type="file" id="scan-input" accept="image/*" multiple className="hidden" onChange={e => { addFiles([...(e.target.files || [])]); e.target.value = ''; }} />
        </label>
        {jobs.filter(j => j.status === 'new').length > 1 && hasKey && <div><button className="btn primary" type="button" onClick={async () => { for (const j of jobs.filter(x => x.status === 'new')) await identify(j); }}><IconSpark />Identify all</button></div>}
        <div className="jobs">
          {jobs.map(j => (
            <article className="job" key={j.id}>
              <div className="pics">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={j.front.preview} alt="Front photo" />
                {j.back ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={j.back.preview} alt="Back photo" /> : (
                  <><label className="btn sm" htmlFor={`back-${j.id}`}><IconPlus />Back photo</label>
                    <input type="file" id={`back-${j.id}`} accept="image/*" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) upd(j.id, { back: await prepareImage(f) }); }} /></>
                )}
              </div>
              {j.status === 'new' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label className="field"><span>Anything you already know (optional)</span><input className="input" id={`hint-${j.id}`} value={j.hint} placeholder="e.g. PSA 9, 1st edition, signed" onChange={e => upd(j.id, { hint: e.target.value })} /></label>
                  <div className="actions">
                    {hasKey && <button className="btn primary" type="button" onClick={() => identify(j)}><IconSpark />Identify with Claude</button>}
                    <button className="btn" type="button" onClick={() => upd(j.id, { status: 'done' })}>Fill in myself</button>
                    <button className="btn ghost" type="button" onClick={() => setJobs(js => js.filter(x => x.id !== j.id))}>Discard</button>
                  </div>
                </div>
              )}
              {j.status === 'working' && <div className="working"><span className="spinner" />Working on it</div>}
              {j.status === 'error' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><p style={{ margin: 0, color: 'var(--bad)' }}>{j.error}</p>
                  <div className="actions"><button className="btn primary" type="button" onClick={() => identify(j)}>Try again</button><button className="btn" type="button" onClick={() => upd(j.id, { status: 'done' })}>Fill in myself</button></div></div>
              )}
              {j.status === 'done' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <h3>{j.d.name || 'New item'}</h3>
                    {j.d.confidence !== null && j.d.confidence !== undefined && (
                      <span className="conf">Match confidence <span className="track"><span className={`fill ${j.d.confidence < 0.45 ? 'low' : j.d.confidence < 0.75 ? 'mid' : ''}`} style={{ width: `${Math.round(j.d.confidence * 100)}%` }} /></span>{Math.round(j.d.confidence * 100)}%</span>
                    )}
                  </div>
                  {j.d.ai_notes && <p className="ai-note">{j.d.ai_notes}</p>}
                  {j.d.alternates?.length > 0 && (
                    <div className="alts"><span className="small muted">Not right? Could be:</span>
                      {j.d.alternates.map((a: any, k: number) => <button key={k} type="button" onClick={() => setJobs(js => js.map(x => x.id === j.id ? { ...x, d: { ...x.d, name: a.name, year: a.year || x.d.year, set_name: a.set_name || x.d.set_name, alternates: x.d.alternates.map((b: any, kk: number) => kk === k ? { name: x.d.name, year: x.d.year, set_name: x.d.set_name } : b) } } : x))}>{[a.year, a.name, a.set_name].filter(Boolean).join(' · ')}</button>)}
                    </div>
                  )}
                  <div className="form-grid">
                    {F(j, 'name', 'Name', 'w4')}
                    <label className="field w2"><span>Category</span><select className="input" id={`j-${j.id}-cat`} value={j.d.category} onChange={e => updD(j.id, 'category', e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
                    {F(j, 'year', 'Year')}{F(j, 'number', 'Number')}{F(j, 'brand', 'Brand / maker', 'w2')}{F(j, 'set_name', 'Set / series', 'w2')}
                    {F(j, 'subject', 'Player / character', 'w2')}{F(j, 'variant', 'Variant / edition', 'w2')}
                    <label className="field"><span>Condition</span><select className="input" id={`j-${j.id}-cond`} value={j.d.condition || ''} onChange={e => updD(j.id, 'condition', e.target.value)}><option value="">Not set</option>{CONDITIONS.map(c => <option key={c}>{c}</option>)}</select></label>
                    <label className="field"><span>Grader</span><select className="input" id={`j-${j.id}-grader`} value={j.d.grader || ''} onChange={e => updD(j.id, 'grader', e.target.value)}><option value="">Raw</option>{GRADERS.map(c => <option key={c}>{c}</option>)}</select></label>
                    {F(j, 'grade', 'Grade')}{F(j, 'quantity', 'Quantity', '', 'number')}{F(j, 'purchase_price', 'Price paid ($)')}{F(j, 'folder', 'Box or binder')}{F(j, 'value', 'Value each ($)')}
                    <div className="field"><span>Est. range</span><span className="num" style={{ lineHeight: '36px' }}>{j.d.value_low != null ? `${money(j.d.value_low)} to ${money(j.d.value_high)}` : '–'}</span></div>
                  </div>
                  <div className="actions">
                    <button className="btn primary" type="button" onClick={() => save(j, false)}><IconPlus />Add to collection</button>
                    <button className="btn" type="button" onClick={() => save(j, true)}>Add to wishlist</button>
                    {hasKey && <button className="btn ghost" type="button" onClick={() => identify(j)}>Identify again</button>}
                    <button className="btn ghost danger" type="button" onClick={() => setJobs(js => js.filter(x => x.id !== j.id))}>Discard</button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
