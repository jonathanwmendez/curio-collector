'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { dataUrlToBlob, uploadPhoto } from '@/lib/images';
import { useAuth, useUi } from './Providers';
import { BrandMark, IconFeed, IconGrid, IconHeart, IconPortfolio, IconScan, IconSettings, IconUser } from './Icons';

const ITEM_FIELDS = ['name', 'category', 'year', 'brand', 'set_name', 'number', 'subject', 'variant', 'condition', 'grader', 'grade',
  'cert_number', 'sealed', 'quantity', 'purchase_price', 'purchase_date', 'value', 'value_low', 'value_high', 'value_note',
  'folder', 'tags', 'notes', 'ai_notes', 'confidence'];

/** Moves items saved by the Curio scanner in Claude (scan_inbox) into the collection, uploading their photos. */
export async function processInbox(userId: string) {
  const sb = supabaseBrowser();
  const { data: rows } = await sb.from('scan_inbox').select('*').is('processed_at', null).order('created_at').limit(25);
  let added = 0;
  for (const r of rows || []) {
    try {
      const p = r.payload || {};
      if (p.kind === 'wish') {
        const photo = r.photo_front ? await uploadPhoto(userId, await dataUrlToBlob(r.photo_front)) : null;
        const w: any = { user_id: userId, name: String(p.name || 'Untitled').slice(0, 200), photo };
        ['category', 'year', 'set_name', 'number', 'subject', 'condition', 'notes'].forEach(k => { if (typeof p[k] === 'string') w[k] = p[k]; });
        ['target_price', 'value'].forEach(k => { if (typeof p[k] === 'number') w[k] = p[k]; });
        if (typeof p.value === 'number') w.value_updated_at = new Date().toISOString();
        const { error } = await sb.from('wishes').insert(w);
        if (error) throw error;
        await sb.from('scan_inbox').update({ processed_at: new Date().toISOString(), photo_front: null, photo_back: null }).eq('id', r.id);
        added++;
        continue;
      }
      const item: any = { user_id: userId };
      ITEM_FIELDS.forEach(k => { if (p[k] !== undefined && p[k] !== null) item[k] = p[k]; });
      item.name = String(item.name || 'Untitled item').slice(0, 200);
      if (!Array.isArray(item.tags)) item.tags = [];
      if (item.value !== undefined) { item.value_source = p.value_source || 'Claude estimate'; item.value_updated_at = new Date().toISOString(); }
      if (r.photo_front) item.photo_front = await uploadPhoto(userId, await dataUrlToBlob(r.photo_front));
      if (r.photo_back) item.photo_back = await uploadPhoto(userId, await dataUrlToBlob(r.photo_back));
      const { data: ins, error } = await sb.from('items').insert(item).select('id').single();
      if (error) throw error;
      await sb.from('scan_inbox').update({ processed_at: new Date().toISOString(), item_id: ins.id, photo_front: null, photo_back: null }).eq('id', r.id);
      added++;
    } catch (e) { console.error('inbox item failed', e); }
  }
  return added;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const { toast } = useUi();
  const router = useRouter();
  const path = usePathname();
  const ran = useRef(false);

  useEffect(() => { if (!loading && !user) router.replace('/login?next=' + encodeURIComponent(path)); }, [loading, user, router, path]);
  useEffect(() => {
    if (!user || ran.current) return;
    ran.current = true;
    processInbox(user.id).then(n => { if (n) { toast(`Added ${n} item${n > 1 ? 's' : ''} you scanned in Claude`); router.refresh(); window.dispatchEvent(new Event('curio:items-changed')); } });
  }, [user, toast, router]);

  const nav = [
    { href: '/portfolio', label: 'Portfolio', Icon: IconPortfolio },
    { href: '/collection', label: 'Collection', Icon: IconGrid },
    { href: '/scan', label: 'Scan', Icon: IconScan },
    { href: '/wishlist', label: 'Wishlist', Icon: IconHeart },
    { href: '/feed', label: 'Feed', Icon: IconFeed },
    { href: profile ? `/u/${profile.username}` : '/settings', label: 'Profile', Icon: IconUser },
    { href: '/settings', label: 'Settings', Icon: IconSettings }
  ];
  const active = (h: string) => path === h || (h !== '/' && path.startsWith(h + '/')) || (h === '/collection' && path.startsWith('/items'));

  if (loading || !user) return <div className="center-page"><span className="spinner" aria-label="Loading" /></div>;

  return (
    <div className="app">
      <aside className="rail" aria-label="Main">
        <Link href="/portfolio" className="brand" style={{ textDecoration: 'none' }}><BrandMark /><b>Curio</b></Link>
        <nav className="nav">
          {nav.map(({ href, label, Icon }) => (
            <Link key={label} href={href} aria-current={active(href) ? 'page' : undefined}><Icon />{label}</Link>
          ))}
        </nav>
        <div className="rail-foot">
          <div className="status"><span className="dot ok" /><span>{profile ? `@${profile.username}` : 'Signed in'}</span></div>
        </div>
      </aside>
      <main className="app-main">{children}</main>
      <nav className="tabbar" aria-label="Main">
        {nav.filter(n => n.label !== 'Settings').map(({ href, label, Icon }) => (
          <Link key={label} href={href} aria-current={active(href) ? 'page' : undefined}><Icon /><span>{label}</span></Link>
        ))}
      </nav>
    </div>
  );
}
