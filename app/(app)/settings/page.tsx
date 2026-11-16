'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth, useUi } from '@/components/Providers';
import { Avatar } from '@/components/ItemBits';
import { supabaseBrowser } from '@/lib/supabase/client';
import { CLAUDE_MODELS } from '@/lib/constants';
import { getClaudeKey, getClaudeModel, setClaudeKey, setClaudeModel } from '@/lib/claude';
import { csvToItems, toCSV } from '@/lib/csv';
import { prepareImage, uploadPhoto } from '@/lib/images';

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useUi();
  const router = useRouter();
  const sb = supabaseBrowser();
  const [p, setP] = useState<any>(null);
  const [key, setKey] = useState('');
  const [model, setModel] = useState('claude-sonnet-5-5');
  const [csv, setCsv] = useState<string | null>(null);
  const [busy, setBusy] = useState('');

  useEffect(() => { if (profile && !p) setP({ ...profile }); }, [profile, p]);
  useEffect(() => { setKey(getClaudeKey()); setModel(getClaudeModel()); }, []);
  if (!p) return <div className="working"><span className="spinner" />Loading</div>;

  async function saveProfile() {
    const username = String(p.username || '').toLowerCase().trim();
    if (!/^[a-z0-9_]{3,30}$/.test(username)) { toast('Usernames use 3 to 30 lowercase letters, numbers or underscores.'); return; }
    const { error } = await sb.from('profiles').update({ username, display_name: p.display_name.slice(0, 60), bio: p.bio.slice(0, 300), is_public: p.is_public, collection_public: p.collection_public, show_values: p.show_values, avatar_path: p.avatar_path }).eq('id', user!.id);
    if (error) { toast(error.message.includes('duplicate') ? 'That username is taken.' : error.message); return; }
    await refreshProfile(); toast('Profile saved');
  }
  async function exportCsv() {
    const { data } = await sb.from('items').select('*').eq('user_id', user!.id).order('created_at');
    if (!data?.length) { toast('Add items before exporting.'); return; }
    setCsv(toCSV(data));
  }
  async function importCsv(file: File) {
    try {
      const rows = csvToItems(await file.text());
      setBusy(`Importing ${rows.length} items`);
      for (let i = 0; i < rows.length; i += 200) {
        const now = new Date().toISOString();
        const { error } = await sb.from('items').insert(rows.slice(i, i + 200).map(r => ({ ...r, user_id: user!.id, value_updated_at: r.value != null ? now : null })));
        if (error) throw error;
      }
      toast(`Imported ${rows.length} item${rows.length === 1 ? '' : 's'}`);
    } catch (e: any) { toast(e.message); }
    setBusy('');
  }

  return (
    <>
      <div className="page-head"><div><h1>Settings</h1><p>Your profile, privacy, Claude connection and data.</p></div></div>
      <div className="two-col">
        <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2>Profile</h2>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <Avatar path={p.avatar_path} name={p.display_name} lg />
            <label className="btn sm" htmlFor="avatar">Change photo</label>
            <input type="file" id="avatar" accept="image/*" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (!f) return; const img = await prepareImage(f); const path = await uploadPhoto(user!.id, img.store); setP({ ...p, avatar_path: path }); }} />
          </div>
          <label className="field"><span>Display name</span><input className="input" id="s-name" maxLength={60} value={p.display_name} onChange={e => setP({ ...p, display_name: e.target.value })} /></label>
          <label className="field"><span>Username</span><input className="input" id="s-username" maxLength={30} value={p.username} onChange={e => setP({ ...p, username: e.target.value.toLowerCase() })} /></label>
          <label className="field"><span>About your collection</span><textarea className="input" id="s-bio" maxLength={300} value={p.bio} onChange={e => setP({ ...p, bio: e.target.value })} /></label>
          <label className="check"><input type="checkbox" id="s-public" checked={p.is_public} onChange={e => setP({ ...p, is_public: e.target.checked })} /> Public profile (others can see your featured items and posts)</label>
          <label className="check"><input type="checkbox" id="s-coll" checked={p.collection_public} onChange={e => setP({ ...p, collection_public: e.target.checked })} /> Show my whole collection on my profile, not just featured items</label>
          <label className="check"><input type="checkbox" id="s-values" checked={p.show_values} onChange={e => setP({ ...p, show_values: e.target.checked })} /> Show values to other people</label>
          <div className="actions"><button className="btn primary" type="button" onClick={saveProfile}>Save profile</button><button className="btn" type="button" onClick={() => router.push(`/u/${profile?.username}`)}>View my profile</button></div>
        </section>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2>Claude</h2>
            <p className="small muted" style={{ margin: 0 }}>Scanning in Claude and the nightly repricing run on your own Claude plan. To scan or re-estimate directly on this site, add an Anthropic API key. It stays in this browser and goes straight to Anthropic, never to our server.</p>
            <label className="field"><span>Your Claude link code</span><span className="code">{user?.id}</span></label>
            <label className="field"><span>Anthropic API key (optional)</span><input className="input" id="s-key" type="password" placeholder="sk-ant-..." value={key} onChange={e => setKey(e.target.value)} autoComplete="off" /></label>
            <label className="field"><span>Model</span><select className="input" id="s-model" value={model} onChange={e => setModel(e.target.value)}>{CLAUDE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
            <div className="actions"><button className="btn" type="button" onClick={() => { setClaudeKey(key.trim()); setClaudeModel(model); toast(key.trim() ? 'Key saved in this browser' : 'Key removed'); }}>Save key</button>
              {key && <button className="btn ghost" type="button" onClick={() => { setKey(''); setClaudeKey(''); toast('Key removed'); }}>Remove</button>}</div>
          </section>
          <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2>Your data</h2>
            <p className="small muted" style={{ margin: 0 }}>Import a CSV with a Name column. Columns like Category, Year, Set, Number, Player, Condition, Grade, Quantity, Paid, Value and Box are matched automatically.</p>
            <div className="actions">
              <button className="btn" type="button" onClick={exportCsv}>Export CSV</button>
              <label className="btn" htmlFor="csv-in">Import CSV</label>
              <input type="file" id="csv-in" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importCsv(f); }} />
              {busy && <span className="working small"><span className="spinner" />{busy}</span>}
            </div>
          </section>
          <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2>Account</h2>
            <p className="small muted" style={{ margin: 0 }}>Signed in as {user?.email}</p>
            <div><button className="btn" type="button" onClick={async () => { await sb.auth.signOut(); router.replace('/'); }}>Sign out</button></div>
          </section>
        </div>
      </div>
      {csv !== null && (
        <>
          <div className="scrim" style={{ zIndex: 59 }} onClick={() => setCsv(null)} />
          <div className="modal"><div className="modal-card wide" role="dialog" aria-modal="true">
            <h2>Export</h2>
            <textarea className="input num" id="csv-out" readOnly value={csv} style={{ minHeight: 240, fontSize: 12 }} />
            <div className="actions" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" type="button" onClick={() => setCsv(null)}>Close</button>
              <button className="btn" type="button" onClick={async () => { try { await navigator.clipboard.writeText(csv); toast('Copied'); } catch { toast('Select the text and copy it.'); } }}>Copy</button>
              <a className="btn primary" href={URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))} download={`curio-collection-${new Date().toISOString().slice(0, 10)}.csv`}>Download .csv</a>
            </div>
          </div></div>
        </>
      )}
    </>
  );
}
