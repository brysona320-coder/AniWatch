-- AniWatch GitHub Pages backend schema for Supabase.
-- Run this in Supabase SQL Editor. Safe to re-run.
-- Cleanup from older builds that included subscriptions:
drop table if exists public.subscriptions cascade;
alter table if exists public.profiles drop column if exists is_premium;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default 'Anime Fan',
  avatar_path text,
  default_audio text not null default 'japanese',
  default_subtitle text not null default 'english',
  theme text not null default 'DARK' check (theme in ('DARK','LIGHT','CUSTOM')),
  accent_color text not null default '#8b5cf6',
  density text not null default 'COMFORTABLE' check (density in ('COMPACT','COMFORTABLE','SPACIOUS')),
  subtitle_font text not null default 'DM Sans',
  subtitle_color text not null default '#ffffff',
  subtitle_background text not null default '#000000',
  subtitle_opacity double precision not null default 0.75 check (subtitle_opacity between 0 and 1),
  playback_speed double precision not null default 1 check (playback_speed between 0.25 and 4),
  auto_skip_intro boolean not null default false,
  auto_skip_outro boolean not null default false,
  intro_seconds integer not null default 90 check (intro_seconds between 0 and 600),
  outro_seconds integer not null default 90 check (outro_seconds between 0 and 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.watch_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text not null,
  visibility text not null default 'PRIVATE' check (visibility in ('PRIVATE','PUBLIC')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, slug)
);

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.watch_lists(id) on delete cascade,
  media_key text not null,
  provider text not null,
  anime_id text not null,
  title text not null,
  image text,
  source_url text,
  added_at timestamptz not null default now(),
  unique(list_id, media_key)
);

create table if not exists public.watch_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_key text not null,
  provider text not null,
  anime_id text not null,
  episode_id text not null,
  anime_title text not null,
  episode_title text,
  episode_number text,
  position double precision not null default 0 check (position >= 0),
  duration double precision not null default 0 check (duration >= 0),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, media_key)
);

create index if not exists watch_progress_user_updated_idx
  on public.watch_progress(user_id, updated_at desc);
create index if not exists watch_lists_user_updated_idx
  on public.watch_lists(user_id, updated_at desc);
create index if not exists list_items_list_added_idx
  on public.list_items(list_id, added_at desc);

create or replace function public.aniwatch_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.aniwatch_touch_updated_at();

drop trigger if exists watch_lists_touch_updated_at on public.watch_lists;
create trigger watch_lists_touch_updated_at
before update on public.watch_lists
for each row execute function public.aniwatch_touch_updated_at();

drop trigger if exists watch_progress_touch_updated_at on public.watch_progress;
create trigger watch_progress_touch_updated_at
before update on public.watch_progress
for each row execute function public.aniwatch_touch_updated_at();

create or replace function public.aniwatch_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  initial_name text;
begin
  initial_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    split_part(coalesce(new.email, 'Anime Fan'), '@', 1)
  );

  insert into public.profiles(id, email, display_name)
  values(new.id, new.email, initial_name)
  on conflict (id) do nothing;

  insert into public.watch_lists(user_id, name, slug, visibility)
  values
    (new.id, 'Plan to Watch', 'plan-to-watch', 'PRIVATE'),
    (new.id, 'Favorites', 'favorites', 'PRIVATE')
  on conflict (user_id, slug) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_aniwatch on auth.users;
create trigger on_auth_user_created_aniwatch
after insert on auth.users
for each row execute function public.aniwatch_new_user();

alter table public.profiles enable row level security;
alter table public.watch_lists enable row level security;
alter table public.list_items enable row level security;
alter table public.watch_progress enable row level security;

revoke all on public.profiles, public.watch_lists, public.list_items, public.watch_progress from anon;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.watch_lists to authenticated;
grant select, insert, update, delete on public.list_items to authenticated;
grant select, insert, update, delete on public.watch_progress to authenticated;
grant select on public.watch_lists, public.list_items, public.profiles to anon;

drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles
for select to authenticated
using (id = auth.uid());

drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "profiles public list owner read" on public.profiles;
create policy "profiles public list owner read" on public.profiles
for select to anon
using (
  exists (
    select 1 from public.watch_lists
    where watch_lists.user_id = profiles.id
      and watch_lists.visibility = 'PUBLIC'
  )
);

drop policy if exists "lists own all" on public.watch_lists;
create policy "lists own all" on public.watch_lists
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "lists public read auth" on public.watch_lists;
create policy "lists public read auth" on public.watch_lists
for select to authenticated
using (visibility = 'PUBLIC');

drop policy if exists "lists public read anon" on public.watch_lists;
create policy "lists public read anon" on public.watch_lists
for select to anon
using (visibility = 'PUBLIC');

drop policy if exists "items own all" on public.list_items;
create policy "items own all" on public.list_items
for all to authenticated
using (
  exists (
    select 1 from public.watch_lists
    where watch_lists.id = list_items.list_id
      and watch_lists.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.watch_lists
    where watch_lists.id = list_items.list_id
      and watch_lists.user_id = auth.uid()
  )
);

drop policy if exists "items public read auth" on public.list_items;
create policy "items public read auth" on public.list_items
for select to authenticated
using (
  exists (
    select 1 from public.watch_lists
    where watch_lists.id = list_items.list_id
      and watch_lists.visibility = 'PUBLIC'
  )
);

drop policy if exists "items public read anon" on public.list_items;
create policy "items public read anon" on public.list_items
for select to anon
using (
  exists (
    select 1 from public.watch_lists
    where watch_lists.id = list_items.list_id
      and watch_lists.visibility = 'PUBLIC'
  )
);

drop policy if exists "progress own all" on public.watch_progress;
create policy "progress own all" on public.watch_progress
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatar public read" on storage.objects;
create policy "avatar public read" on storage.objects
for select to public
using (bucket_id = 'avatars');

drop policy if exists "avatar own insert" on storage.objects;
create policy "avatar own insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatar own update" on storage.objects;
create policy "avatar own update" on storage.objects
for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatar own delete" on storage.objects;
create policy "avatar own delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
