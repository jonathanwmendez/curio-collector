'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/Providers';
import { Avatar, Thumb } from '@/components/ItemBits';
import { BrandMark } from '@/components/Icons';
import { supabaseBrowser } from '@/lib/supabase/client';

const FEATURES = [
  ['Scan and identify', 'Snap a photo. Claude names the item, fills in year, set, number and grade, and estimates a value.'],
  ['Track value', 'Every update is saved, so you see your portfolio over time, cost basis, gains and the biggest movers.'],
  ['Cross-check eBay', 'Current eBay asking prices sit next to each estimate, refreshed weekly.'],
  ['Wishlist', 'Set the price you would pay and see when a want drops into range.'],
  ['Showcase', 'A public profile for the pieces you are proudest of, with your whole collection if you choose.'],
  ['Feed', 'Follow collectors, share pickups, like and comment.']
];

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);

  useEffect(() => { if (!loading && user) router.replace('/portfolio'); }, [loading, user, router]);
  useEffect(() => {
    const sb = supabaseBrowser();
    sb.from('items').select('id,name,year,category,photo_front,user_id').eq('featured', true).not('photo_front', 'is', null).order('updated_at', { ascending: false }).limit(12).then(({ data }) => setItems(data || []));
    sb.from('profiles').select('id,username,display_name,avatar_path').order('created_at', { ascending: false }).limit(6).then(({ data }) => setPeople(data || []));
  }, []);

  return (
    <>
      <header className="topbar">
        <span className="brand" style={{ padding: 0 }}><BrandMark /><b>Curio</b></span>
        <div className="actions"><Link className="btn sm" href="/login">Sign in</Link><Link className="btn primary sm" href="/login?mode=signup">Get started</Link></div>
      </header>
      <main className="public-main">
        <section className="landing-hero">
          <h1>Know what your collection is worth.</h1>
          <p className="muted" style={{ fontSize: 18, margin: 0, maxWidth: '58ch' }}>Cards, coins, comics, toys and everything else. Scan it, value it, watch it move, and show it off.</p>
          <div className="actions"><Link className="btn primary" href="/login">Start your vault</Link></div>
        </section>
        <section className="features">{FEATURES.map(([t, d]) => <div key={t} className="tile"><h3>{t}</h3><span className="sub">{d}</span></div>)}</section>
        {items.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><h2>Recently showcased</h2>
            <div className="show-grid">{items.map(i => <div key={i.id} className="show-item"><Thumb path={i.photo_front} /><span className="name">{i.name}</span><span className="meta">{[i.year, i.category].filter(Boolean).join(' · ')}</span></div>)}</div></section>
        )}
        {people.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><h2>Collectors</h2>
            <div className="collectors">{people.map(p => <Link key={p.id} className="collector" href={`/u/${p.username}`} style={{ flexDirection: 'row', alignItems: 'center', textDecoration: 'none' }}><Avatar path={p.avatar_path} name={p.display_name || p.username} /><span><span className="name">{p.display_name || p.username}</span><br /><span className="meta">@{p.username}</span></span></Link>)}</div></section>
        )}
      </main>
    </>
  );
}
