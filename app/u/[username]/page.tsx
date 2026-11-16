'use client';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { useAuth, useUi } from '@/components/Providers';
import { Avatar, GradeBadge, ItemCard, Thumb } from '@/components/ItemBits';
import { BrandMark } from '@/components/Icons';
import { FeedPost, loadPosts, PostCard } from '@/components/PostCard';
import { supabaseBrowser } from '@/lib/supabase/client';
import { metaLine, money, qty } from '@/lib/format';
import type { Item, Profile } from '@/lib/types';

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const { user } = useAuth();
  const { toast } = useUi();
  const sb = supabaseBrowser();
  const [p, setP] = useState<Profile | null | undefined>(undefined);
  const [items, setItems] = useState<Item[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [stats, setStats] = useState({ followers: 0, following: 0 });
  const [following, setFollowing] = useState(false);
  const [tab, setTab] = useState<'showcase' | 'collection' | 'posts'>('showcase');
  const [view, setView] = useState<Item | null>(null);

  useEffect(() => {
    (async () => {
      const { data: prof } = await sb.from('profiles').select('*').eq('username', username.toLowerCase()).maybeSingle();
      setP(prof as Profile);
      if (!prof) return;
      const [{ data: its }, { data: st }] = await Promise.all([
        sb.from('items').select('*').eq('user_id', prof.id).eq('status', 'owned').order('value', { ascending: false, nullsFirst: false }).limit(500),
        sb.from('profile_stats').select('*').eq('id', prof.id).maybeSingle()
      ]);
      setItems((its || []) as Item[]);
      setStats({ followers: st?.followers || 0, following: st?.following || 0 });
      setPosts(await loadPosts({ authorId: prof.id, viewerId: user?.id, limit: 30 }));
      if (user) { const { data: f } = await sb.from('follows').select('follower_id').eq('follower_id', user.id).eq('following_id', prof.id).maybeSingle(); setFollowing(!!f); }
    })();
  }, [username, sb, user]);

  if (p === undefined) return <div className="center-page"><span className="spinner" /></div>;
  const mine = user?.id === p?.id;
  const showValues = !!p?.show_values || mine;
  const featured = items.filter(i => i.featured);
  const canSeeCollection = mine || !!p?.collection_public;
  const total = items.reduce((s, i) => s + (Number(i.value) || 0) * qty(i), 0);

  async function toggleFollow() {
    if (!user) { toast('Sign in to follow collectors.'); return; }
    if (following) { await sb.from('follows').delete().eq('follower_id', user.id).eq('following_id', p!.id); setFollowing(false); setStats(s => ({ ...s, followers: s.followers - 1 })); }
    else { const { error } = await sb.from('follows').insert({ follower_id: user.id, following_id: p!.id }); if (!error) { setFollowing(true); setStats(s => ({ ...s, followers: s.followers + 1 })); } }
  }

  return (
    <>
      <header className="topbar">
        <Link href={user ? '/portfolio' : '/'} className="brand" style={{ textDecoration: 'none', padding: 0 }}><BrandMark /><b>Curio</b></Link>
        <div className="actions">{user ? <><Link className="btn sm" href="/feed">Feed</Link><Link className="btn sm" href="/portfolio">My portfolio</Link></> : <Link className="btn primary sm" href="/login">Sign in</Link>}</div>
      </header>
      <main className="public-main">
        {!p ? <div className="empty"><p>No collector named @{username}, or their profile is private.</p></div> : (
          <>
            <section className="profile-head">
              <Avatar path={p.avatar_path} name={p.display_name || p.username} lg />
              <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <h1 style={{ fontSize: 28 }}>{p.display_name || p.username}</h1>
                <span className="muted">@{p.username}</span>
                {p.bio && <p style={{ margin: '4px 0 0', maxWidth: '62ch' }}>{p.bio}</p>}
                <div className="stats"><span><b>{stats.followers}</b> followers</span><span><b>{stats.following}</b> following</span>{canSeeCollection && <span><b>{items.length}</b> items</span>}{canSeeCollection && showValues && <span><b>{money(total, true)}</b> value</span>}</div>
              </div>
              {mine ? <Link className="btn" href="/settings">Edit profile</Link> : <button className={`btn ${following ? '' : 'primary'}`} type="button" onClick={toggleFollow}>{following ? 'Following' : 'Follow'}</button>}
            </section>
            {mine && !p.is_public && <div className="banner"><p>Your profile is private. Turn on Public profile in Settings to share it.</p></div>}
            <div className="tabs" role="tablist">
              <button type="button" role="tab" aria-selected={tab === 'showcase'} onClick={() => setTab('showcase')}>Showcase ({featured.length})</button>
              {canSeeCollection && <button type="button" role="tab" aria-selected={tab === 'collection'} onClick={() => setTab('collection')}>Collection ({items.length})</button>}
              <button type="button" role="tab" aria-selected={tab === 'posts'} onClick={() => setTab('posts')}>Posts ({posts.length})</button>
            </div>
            {tab === 'posts' ? (
              <div className="feed">{posts.length ? posts.map(x => <PostCard key={x.id} p={x} onDeleted={id => setPosts(ps => ps.filter(y => y.id !== id))} />) : <div className="empty"><p>No posts yet.</p></div>}</div>
            ) : (() => {
              const list = tab === 'showcase' ? featured : items;
              return list.length ? (
                <div className="grid">{list.map(i => <ItemCard key={i.id} i={i} href={mine ? `/items/${i.id}` : undefined} onClick={() => setView(i)} showValue={showValues} />)}</div>
              ) : <div className="empty"><p>{tab === 'showcase' ? (mine ? 'Feature items from their detail page to show them here.' : 'Nothing featured yet.') : 'No items yet.'}</p></div>;
            })()}
          </>
        )}
      </main>
      {view && (
        <>
          <div className="scrim" style={{ zIndex: 59 }} onClick={() => setView(null)} />
          <div className="modal" onClick={e => { if (e.target === e.currentTarget) setView(null); }}><div className="modal-card wide" role="dialog" aria-modal="true">
            <div className="panel-head" style={{ margin: 0 }}><h2>{view.name}</h2><button className="btn ghost sm" type="button" onClick={() => setView(null)}>Close</button></div>
            <div className="item-top">
              <div className="photo"><Thumb path={view.photo_front} alt="Front photo" />{view.photo_back && <Thumb path={view.photo_back} alt="Back photo" />}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className="meta">{metaLine(view)}</span>
                <span>{view.category}{view.subject ? ` · ${view.subject}` : ''}</span>
                <span><GradeBadge i={view} /></span>
                {showValues && view.value !== null && <span className="valuebox"><span className="big">{money(Number(view.value) * qty(view))}</span></span>}
                {view.notes && <p style={{ margin: 0 }}>{view.notes}</p>}
              </div>
            </div>
          </div></div>
        </>
      )}
    </>
  );
}
