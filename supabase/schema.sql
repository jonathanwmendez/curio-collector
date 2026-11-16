-- Curio Collector schema (Supabase / Postgres 17). Apply in order on a fresh project.
create extension if not exists pgcrypto;

-- Profiles ------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null default '',
  bio text not null default '' check (char_length(bio) <= 300),
  avatar_path text,
  is_public boolean not null default true,
  collection_public boolean not null default false,
  show_values boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare base text; candidate text; n int := 0;
begin
  base := lower(regexp_replace(split_part(coalesce(new.email, 'collector'), '@', 1), '[^a-z0-9_]', '', 'g'));
  if char_length(base) < 3 then base := base || 'collector'; end if;
  base := left(base, 24);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1; candidate := base || n::text;
  end loop;
  insert into public.profiles (id, username, display_name)
  values (new.id, candidate, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', candidate));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

-- Items ---------------------------------------------------------------------
create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  category text not null default 'Other',
  year text not null default '', brand text not null default '', set_name text not null default '',
  number text not null default '', subject text not null default '', variant text not null default '',
  condition text not null default '', grader text not null default '', grade text not null default '',
  cert_number text not null default '', sealed boolean not null default false,
  quantity int not null default 1 check (quantity >= 1),
  purchase_price numeric(12,2), purchase_date date,
  status text not null default 'owned' check (status in ('owned','sold')),
  sold_price numeric(12,2), sold_date date,
  value numeric(12,2), value_low numeric(12,2), value_high numeric(12,2),
  value_source text not null default '', value_note text not null default '', value_updated_at timestamptz,
  ask_median numeric(12,2), ask_low numeric(12,2), ask_high numeric(12,2), ask_count int, ask_query text, ask_checked_at timestamptz,
  folder text not null default '', tags text[] not null default '{}', notes text not null default '',
  ai_notes text not null default '', confidence numeric(4,3),
  photo_front text, photo_back text, featured boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index items_user_idx on public.items(user_id);
create index items_reprice_idx on public.items(value_updated_at nulls first) where status = 'owned';
create trigger items_touch before update on public.items for each row execute function public.touch_updated_at();

create table public.value_history (
  item_id uuid not null references public.items(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  t date not null default current_date,
  value numeric(12,2) not null,
  source text not null default '',
  primary key (item_id, t)
);
create index value_history_user_idx on public.value_history(user_id);

create or replace function public.record_value()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.value is not null and (tg_op = 'INSERT' or new.value is distinct from old.value) then
    insert into public.value_history (item_id, user_id, t, value, source)
    values (new.id, new.user_id, current_date, new.value, new.value_source)
    on conflict (item_id, t) do update set value = excluded.value, source = excluded.source;
  end if;
  return new;
end $$;
create trigger items_value_hist after insert or update of value on public.items for each row execute function public.record_value();

-- Wishlist ------------------------------------------------------------------
create table public.wishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  category text not null default 'Other', year text not null default '', set_name text not null default '',
  number text not null default '', subject text not null default '', condition text not null default '',
  target_price numeric(12,2), value numeric(12,2), value_note text not null default '', value_updated_at timestamptz,
  ask_median numeric(12,2), ask_count int, ask_checked_at timestamptz,
  photo text, notes text not null default '', created_at timestamptz not null default now()
);
create index wishes_user_idx on public.wishes(user_id);

-- Social --------------------------------------------------------------------
create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id), check (follower_id <> following_id)
);
create index follows_following_idx on public.follows(following_id);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,
  body text not null default '' check (char_length(body) <= 1000),
  photo text, created_at timestamptz not null default now()
);
create index posts_created_idx on public.posts(created_at desc);
create index posts_user_idx on public.posts(user_id);

create table public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (post_id, user_id)
);
create index likes_user_idx on public.likes(user_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments(post_id);
create index comments_user_idx on public.comments(user_id);

create view public.post_feed with (security_invoker = true) as
select p.*, (select count(*) from public.likes l where l.post_id = p.id)::int as like_count,
  (select count(*) from public.comments c where c.post_id = p.id)::int as comment_count
from public.posts p;

create view public.profile_stats with (security_invoker = true) as
select pr.id, (select count(*) from public.follows f where f.following_id = pr.id)::int as followers,
  (select count(*) from public.follows f where f.follower_id = pr.id)::int as following
from public.profiles pr;

-- Claude scanner inbox and repricing log ----------------------------------
create table public.scan_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  payload jsonb not null, photo_front text, photo_back text,
  created_at timestamptz not null default now(), processed_at timestamptz,
  item_id uuid references public.items(id) on delete set null
);
create index scan_inbox_user_idx on public.scan_inbox(user_id) where processed_at is null;

create table public.reprice_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(), finished_at timestamptz,
  items_checked int not null default 0, items_updated int not null default 0,
  tokens_used int, notes text not null default ''
);

-- Row Level Security --------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.value_history enable row level security;
alter table public.wishes enable row level security;
alter table public.follows enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.scan_inbox enable row level security;
alter table public.reprice_runs enable row level security;
revoke all on public.reprice_runs from anon, authenticated;

create policy "profiles readable" on public.profiles for select using (is_public or id = (select auth.uid()));
create policy "profiles self update" on public.profiles for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "items read" on public.items for select using (
  user_id = (select auth.uid())
  or exists (select 1 from public.profiles p where p.id = items.user_id and p.is_public and (p.collection_public or items.featured)));
create policy "items insert own" on public.items for insert with check (user_id = (select auth.uid()));
create policy "items update own" on public.items for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "items delete own" on public.items for delete using (user_id = (select auth.uid()));

create policy "history read" on public.value_history for select using (
  user_id = (select auth.uid())
  or exists (select 1 from public.items i join public.profiles p on p.id = i.user_id
             where i.id = value_history.item_id and p.is_public and (p.collection_public or i.featured)));
create policy "history write own" on public.value_history for insert with check (user_id = (select auth.uid()));
create policy "history delete own" on public.value_history for delete using (user_id = (select auth.uid()));

create policy "wishes own" on public.wishes for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "follows read" on public.follows for select using (true);
create policy "follows insert own" on public.follows for insert with check (follower_id = (select auth.uid()));
create policy "follows delete own" on public.follows for delete using (follower_id = (select auth.uid()));

create policy "posts read" on public.posts for select using (
  user_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = posts.user_id and p.is_public));
create policy "posts insert own" on public.posts for insert with check (user_id = (select auth.uid()));
create policy "posts delete own" on public.posts for delete using (user_id = (select auth.uid()));

create policy "likes read" on public.likes for select using (true);
create policy "likes insert own" on public.likes for insert with check (user_id = (select auth.uid()));
create policy "likes delete own" on public.likes for delete using (user_id = (select auth.uid()));

create policy "comments read" on public.comments for select using (true);
create policy "comments insert own" on public.comments for insert with check (user_id = (select auth.uid()));
create policy "comments delete own or post owner" on public.comments for delete using (
  user_id = (select auth.uid()) or exists (select 1 from public.posts po where po.id = comments.post_id and po.user_id = (select auth.uid())));

create policy "inbox own" on public.scan_inbox for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Storage: public-read photos bucket, writes limited to the user's own folder
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;
create policy "photos insert own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Cron access without a service-role key -----------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.settings (key text primary key, value text not null);
-- Replace with: encode(digest('<your CRON_SECRET>', 'sha256'), 'hex')
insert into private.settings values ('cron_secret_sha256', 'REPLACE_WITH_SHA256_OF_CRON_SECRET');

create or replace function private.check_cron(p_secret text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_secret is null or encode(extensions.digest(p_secret, 'sha256'), 'hex') <>
     (select value from private.settings where key = 'cron_secret_sha256') then
    raise exception 'unauthorized';
  end if;
end $$;

create or replace function public.cron_due_comps(p_secret text, p_limit int default 200)
returns table (kind text, id uuid, query text)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_cron(p_secret);
  return query
  (select 'item'::text, i.id,
     trim(concat_ws(' ', i.year, i.brand, case when i.set_name <> i.brand then i.set_name end, i.subject,
       case when i.number <> '' then '#' || i.number end, i.variant,
       case when i.grader <> '' then i.grader || ' ' || i.grade end)) as query
   from public.items i
   where i.status = 'owned' and (i.ask_checked_at is null or i.ask_checked_at < now() - interval '7 days')
   order by i.ask_checked_at nulls first limit p_limit)
  union all
  (select 'wish'::text, w.id,
     trim(concat_ws(' ', w.year, w.set_name, w.subject, case when w.number <> '' then '#' || w.number end, case when w.subject = '' then w.name end))
   from public.wishes w
   where w.ask_checked_at is null or w.ask_checked_at < now() - interval '7 days'
   order by w.ask_checked_at nulls first limit greatest(p_limit / 4, 10));
end $$;

create or replace function public.cron_save_comps(p_secret text, p_kind text, p_id uuid, p_query text,
  p_median numeric, p_low numeric, p_high numeric, p_count int)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_cron(p_secret);
  if p_kind = 'item' then
    update public.items set ask_query = p_query, ask_median = p_median, ask_low = p_low, ask_high = p_high,
      ask_count = p_count, ask_checked_at = now() where id = p_id;
  else
    update public.wishes set ask_median = p_median, ask_count = p_count, ask_checked_at = now() where id = p_id;
  end if;
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.record_value() from public, anon, authenticated;
revoke all on function public.cron_due_comps(text, int) from public, authenticated;
revoke all on function public.cron_save_comps(text, text, uuid, text, numeric, numeric, numeric, int) from public, authenticated;
grant execute on function public.cron_due_comps(text, int) to anon;
grant execute on function public.cron_save_comps(text, text, uuid, text, numeric, numeric, numeric, int) to anon;
