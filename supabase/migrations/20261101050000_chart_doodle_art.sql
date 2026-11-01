-- Applied to the Supabase project on 2026-11-01.
create extension if not exists vector with schema extensions;

-- Generated character art, keyed by the chart+forecast shape it was drawn for.
create table if not exists public.doodle_art (
  id uuid primary key default gen_random_uuid(),
  char text not null,
  dir smallint not null,
  sig extensions.vector(48) not null,
  image_path text not null,
  model text not null,
  hits integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists doodle_art_char_idx on public.doodle_art (char);

-- Per-IP (hashed) daily generation counts, for cost limits.
create table if not exists public.doodle_gen_log (
  ip_hash text not null,
  day date not null default (now() at time zone 'Asia/Seoul')::date,
  n integer not null default 0,
  primary key (ip_hash, day)
);

alter table public.doodle_art enable row level security;
alter table public.doodle_gen_log enable row level security;
-- No policies on purpose: only the edge function (service role) reads and writes these.

create or replace function public.match_doodle_art(p_char text, p_sig extensions.vector(48))
returns table (id uuid, image_path text, distance double precision)
language sql stable
set search_path = public, extensions
as $$
  select a.id, a.image_path, (a.sig <-> p_sig)::double precision as distance
  from public.doodle_art a
  where a.char = p_char
  order by a.sig <-> p_sig
  limit 1;
$$;

create or replace function public.doodle_try_generate(p_ip text, p_ip_limit int, p_global_limit int)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  total int;
  mine int;
begin
  select coalesce(sum(n), 0) into total from doodle_gen_log where day = today and ip_hash <> '__global__';
  select coalesce(n, 0) into mine from doodle_gen_log where day = today and ip_hash = p_ip;
  if total >= p_global_limit or coalesce(mine, 0) >= p_ip_limit then
    return false;
  end if;
  insert into doodle_gen_log (ip_hash, day, n) values (p_ip, today, 1)
  on conflict (ip_hash, day) do update set n = doodle_gen_log.n + 1;
  return true;
end;
$$;

create or replace function public.doodle_art_hit(p_id uuid)
returns void
language sql
set search_path = public
as $$
  update public.doodle_art set hits = hits + 1 where id = p_id;
$$;

revoke all on function public.match_doodle_art(text, extensions.vector) from public, anon, authenticated;
revoke all on function public.doodle_try_generate(text, int, int) from public, anon, authenticated;
revoke all on function public.doodle_art_hit(uuid) from public, anon, authenticated;

insert into storage.buckets (id, name, public)
values ('doodle-art', 'doodle-art', true)
on conflict (id) do nothing;
