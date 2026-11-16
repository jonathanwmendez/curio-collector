'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth, useUi } from '@/components/Providers';
import { Avatar } from '@/components/ItemBits';
import { FeedPost, loadPosts, PostCard } from '@/components/PostCard';
import { supabaseBrowser } from '@/lib/supabase/client';
import { prepareImage, uploadPhoto } from '@/lib/images';

export default function FeedPage() {
  const { user, profile } = useAuth();
  const { toast } = useUi();
  const sb = supabaseBrowser();
  const [tab, setTab] = useState<'following' | 'everyone'>('everyone');
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState<{ store: Blob; preview: string } | null>(null);
  const [people, setPeople] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setPosts(null);
    let ids: string[] | undefined;
    if (tab === 'following') {
      const { data } = await sb.from('follows').select('following_id').eq('follower_id', user.id);
      ids = [user.id, ...(data || []).map((r: any) => r.following_id)];
    }
    setPosts(await loadPosts({ userIds: ids, viewerId: user.id, limit: 40 }));
  }, [tab, user, sb]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    sb.from('profiles').select('id,username,display_name,avatar_path,bio').neq('id', user?.id || '').order('created_at', { ascending: false }).limit(8).then(({ data }) => setPeople(data || []));
  }, [sb, user]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && !photo) return;
    setBusy(true);
    try {
      const path = photo ? await uploadPhoto(user!.id, photo.store) : null;
      const { error } = await sb.from('posts').insert({ user_id: user!.id, body: body.trim().slice(0, 1000), photo: path });
      if (error) throw error;
      setBody(''); setPhoto(null); load();
    } catch (err: any) { toast(err.message); }
    setBusy(false);
  }

  return (
    <>
      <div className="page-head"><div><h1>Feed</h1><p>Pickups, pulls and favorites from other collectors. Share an item from its detail page, or post below.</p></div></div>
      <div className="dash-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px', alignItems: 'start' }}>
        <div className="feed">
          <form className="panel" onSubmit={post} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}><Avatar path={profile?.avatar_path} name={profile?.display_name} />
              <textarea className="input" id="post-body" placeholder="What did you pick up?" maxLength={1000} value={body} onChange={e => setBody(e.target.value)} style={{ minHeight: 60 }} /></div>
            {photo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={photo.preview} alt="" className="post-photo" style={{ maxHeight: 240 }} />}
            <div className="actions" style={{ justifyContent: 'space-between' }}>
              <span><label className="btn sm" htmlFor="post-photo">{photo ? 'Change photo' : 'Add photo'}</label>
                <input type="file" id="post-photo" accept="image/*" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) { const p = await prepareImage(f); setPhoto({ store: p.store, preview: p.preview }); } }} /></span>
              <button className="btn primary" type="submit" disabled={busy || (!body.trim() && !photo)}>Post</button>
            </div>
          </form>
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'everyone'} onClick={() => setTab('everyone')}>Everyone</button>
            <button type="button" role="tab" aria-selected={tab === 'following'} onClick={() => setTab('following')}>Following</button>
          </div>
          {posts === null ? <div className="working"><span className="spinner" />Loading</div> : posts.length ? posts.map(p => <PostCard key={p.id} p={p} onDeleted={id => setPosts(ps => ps!.filter(x => x.id !== id))} />) : (
            <div className="empty"><p>{tab === 'following' ? 'Follow collectors to fill this feed.' : 'No posts yet. Be the first.'}</p></div>
          )}
        </div>
        <aside className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2>Collectors</h2>
          {people.length ? people.map(p => (
            <Link key={p.id} href={`/u/${p.username}`} style={{ display: 'flex', gap: 10, alignItems: 'center', textDecoration: 'none' }}>
              <Avatar path={p.avatar_path} name={p.display_name || p.username} />
              <span style={{ minWidth: 0 }}><span className="name">{p.display_name || p.username}</span><br /><span className="meta">@{p.username}</span></span>
            </Link>
          )) : <p className="muted small" style={{ margin: 0 }}>No other collectors yet. Share the site with friends.</p>}
        </aside>
      </div>
    </>
  );
}
