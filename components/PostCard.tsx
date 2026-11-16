'use client';
import Link from 'next/link';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { money, timeAgo } from '@/lib/format';
import { Avatar, GradeBadge, Thumb } from './ItemBits';
import { IconHeart } from './Icons';
import { useAuth, useUi } from './Providers';

export type FeedPost = {
  id: string; user_id: string; body: string; photo: string | null; created_at: string; like_count: number; comment_count: number;
  author?: any; item?: any; liked?: boolean;
};

export function PostCard({ p, onDeleted }: { p: FeedPost; onDeleted?: (id: string) => void }) {
  const { user } = useAuth();
  const { toast, confirm } = useUi();
  const sb = supabaseBrowser();
  const [liked, setLiked] = useState(!!p.liked);
  const [likes, setLikes] = useState(p.like_count);
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<any[] | null>(null);
  const [count, setCount] = useState(p.comment_count);
  const [text, setText] = useState('');
  const a = p.author || {};

  async function like() {
    if (!user) { toast('Sign in to like posts.'); return; }
    if (liked) { setLiked(false); setLikes(l => l - 1); await sb.from('likes').delete().eq('post_id', p.id).eq('user_id', user.id); }
    else { setLiked(true); setLikes(l => l + 1); await sb.from('likes').insert({ post_id: p.id, user_id: user.id }); }
  }
  async function loadComments() {
    setOpen(o => !o);
    if (comments) return;
    const { data } = await sb.from('comments').select('id,body,created_at,user_id,profiles(username,display_name,avatar_path)').eq('post_id', p.id).order('created_at');
    setComments(data || []);
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { toast('Sign in to comment.'); return; }
    const body = text.trim(); if (!body) return;
    const { data, error } = await sb.from('comments').insert({ post_id: p.id, user_id: user.id, body: body.slice(0, 500) }).select('id,body,created_at,user_id,profiles(username,display_name,avatar_path)').single();
    if (error) { toast(error.message); return; }
    setComments(c => [...(c || []), data]); setCount(n => n + 1); setText('');
  }
  async function remove() {
    if (!(await confirm('Delete this post?'))) return;
    await sb.from('posts').delete().eq('id', p.id); onDeleted?.(p.id);
  }

  return (
    <article className="panel post">
      <div className="post-head">
        <Link href={`/u/${a.username}`}><Avatar path={a.avatar_path} name={a.display_name || a.username} /></Link>
        <div style={{ flex: 1, minWidth: 0 }}><Link href={`/u/${a.username}`} className="name" style={{ textDecoration: 'none' }}>{a.display_name || a.username}</Link><br /><span className="meta">@{a.username} · {timeAgo(p.created_at)}</span></div>
        {user?.id === p.user_id && <button className="btn ghost sm" type="button" onClick={remove}>Delete</button>}
      </div>
      {p.body && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{p.body}</p>}
      {p.item ? (
        <Link className="post-item" href={user?.id === p.user_id ? `/items/${p.item.id}` : `/u/${a.username}`}>
          <Thumb path={p.item.photo_front || p.photo} />
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="name">{p.item.name}</span>
            <span className="meta">{[p.item.year, p.item.category].filter(Boolean).join(' · ')}</span>
            <span><GradeBadge i={p.item} /></span>
            {a.show_values && p.item.value !== null && <span className="num">{money(Number(p.item.value))}</span>}
          </span>
        </Link>
      ) : p.photo ? <Thumb path={p.photo} className="post-photo" /> : null}
      <div className="post-actions">
        <button className={`btn sm ${liked ? 'liked' : ''}`} type="button" onClick={like} aria-pressed={liked}><IconHeart />{likes}</button>
        <button className="btn sm" type="button" onClick={loadComments}>{count} comment{count === 1 ? '' : 's'}</button>
      </div>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(comments || []).map(c => (
            <div className="comment" key={c.id}><Avatar path={c.profiles?.avatar_path} name={c.profiles?.display_name} />
              <span><Link href={`/u/${c.profiles?.username}`} className="name" style={{ textDecoration: 'none' }}>{c.profiles?.display_name || c.profiles?.username}</Link> <span className="meta">{timeAgo(c.created_at)}</span><br />{c.body}</span></div>
          ))}
          {user && <form onSubmit={send} style={{ display: 'flex', gap: 8 }}><input className="input" id={`c-${p.id}`} placeholder="Add a comment" value={text} onChange={e => setText(e.target.value)} maxLength={500} /><button className="btn sm" type="submit">Send</button></form>}
        </div>
      )}
    </article>
  );
}

/** Loads posts with author, item and like state attached. */
export async function loadPosts(opts: { userIds?: string[]; authorId?: string; limit?: number; viewerId?: string }) {
  const sb = supabaseBrowser();
  let q = sb.from('post_feed').select('*').order('created_at', { ascending: false }).limit(opts.limit || 30);
  if (opts.authorId) q = q.eq('user_id', opts.authorId);
  if (opts.userIds) q = q.in('user_id', opts.userIds.length ? opts.userIds : ['00000000-0000-0000-0000-000000000000']);
  const { data: posts } = await q;
  const list = (posts || []) as FeedPost[];
  const authorIds = [...new Set(list.map(p => p.user_id))];
  const itemIds = [...new Set(list.map((p: any) => p.item_id).filter(Boolean))];
  const [{ data: authors }, { data: items }, { data: likes }] = await Promise.all([
    authorIds.length ? sb.from('profiles').select('id,username,display_name,avatar_path,show_values').in('id', authorIds) : Promise.resolve({ data: [] as any[] }),
    itemIds.length ? sb.from('items').select('id,name,year,category,photo_front,value,grader,grade,condition,sealed').in('id', itemIds) : Promise.resolve({ data: [] as any[] }),
    opts.viewerId && list.length ? sb.from('likes').select('post_id').eq('user_id', opts.viewerId).in('post_id', list.map(p => p.id)) : Promise.resolve({ data: [] as any[] })
  ]);
  const am = new Map((authors || []).map((a: any) => [a.id, a]));
  const im = new Map((items || []).map((i: any) => [i.id, i]));
  const lk = new Set((likes || []).map((l: any) => l.post_id));
  return list.map((p: any) => ({ ...p, author: am.get(p.user_id), item: p.item_id ? im.get(p.item_id) : null, liked: lk.has(p.id) }));
}
