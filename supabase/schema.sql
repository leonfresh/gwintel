-- Run this in the Supabase SQL editor.
-- Creates tables for logs + votes and keeps vote totals in sync.

create extension if not exists pgcrypto;

create table if not exists public.strategy_logs (
  id uuid primary key default gen_random_uuid(),
  enemy_team text[] not null,
  counter_team text[] not null,
  skill_queue jsonb not null default '[]'::jsonb,
  type text not null check (type in ('success', 'fail')),
  notes text not null default '',
  votes integer not null default 0,
  author_id uuid not null references auth.users (id) on delete cascade,
  author_email text,
  author_name text,
  created_at timestamptz not null default now()
);

-- If you created the table before skill_queue existed
alter table public.strategy_logs
  add column if not exists skill_queue jsonb not null default '[]'::jsonb;

-- If you created the table before author_name existed
alter table public.strategy_logs
  add column if not exists author_name text;

create table if not exists public.log_votes (
  log_id uuid not null references public.strategy_logs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  value integer not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (log_id, user_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_log_votes_updated_at on public.log_votes;
create trigger set_log_votes_updated_at
before update on public.log_votes
for each row execute function public.set_updated_at();

create or replace function public.recompute_strategy_log_votes(p_log_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.strategy_logs
  set votes = coalesce((select sum(value) from public.log_votes where log_id = p_log_id), 0)
  where id = p_log_id;
end;
$$;

create or replace function public.tg_recompute_votes()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.recompute_strategy_log_votes(coalesce(new.log_id, old.log_id));
  return null;
end;
$$;

drop trigger if exists log_votes_after_change on public.log_votes;
create trigger log_votes_after_change
after insert or update or delete on public.log_votes
for each row execute function public.tg_recompute_votes();

alter table public.strategy_logs enable row level security;
alter table public.log_votes enable row level security;

drop policy if exists "read strategy logs" on public.strategy_logs;
create policy "read strategy logs"
  on public.strategy_logs
  for select
  using (true);

drop policy if exists "insert strategy logs" on public.strategy_logs;
create policy "insert strategy logs"
  on public.strategy_logs
  for insert
  to authenticated
  with check (auth.uid() = author_id);

drop policy if exists "delete own strategy logs" on public.strategy_logs;
create policy "delete own strategy logs"
  on public.strategy_logs
  for delete
  to authenticated
  using (auth.uid() = author_id);

drop policy if exists "read log votes" on public.log_votes;
create policy "read log votes"
  on public.log_votes
  for select
  using (true);

drop policy if exists "vote own" on public.log_votes;
create policy "vote own"
  on public.log_votes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "update own vote" on public.log_votes;
create policy "update own vote"
  on public.log_votes
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own vote" on public.log_votes;
create policy "delete own vote"
  on public.log_votes
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Squad votes table for voting on entire enemy squad compositions
create table if not exists public.squad_votes (
  squad_key text not null, -- sorted comma-separated enemy team IDs
  user_id uuid not null references auth.users (id) on delete cascade,
  value integer not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (squad_key, user_id)
);

drop trigger if exists set_squad_votes_updated_at on public.squad_votes;
create trigger set_squad_votes_updated_at
before update on public.squad_votes
for each row execute function public.set_updated_at();

alter table public.squad_votes enable row level security;

drop policy if exists "read squad votes" on public.squad_votes;
create policy "read squad votes"
  on public.squad_votes
  for select
  using (true);

drop policy if exists "vote on squad" on public.squad_votes;
create policy "vote on squad"
  on public.squad_votes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "update own squad vote" on public.squad_votes;
create policy "update own squad vote"
  on public.squad_votes
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own squad vote" on public.squad_votes;
create policy "delete own squad vote"
  on public.squad_votes
  for delete
  to authenticated
  using (auth.uid() = user_id);
