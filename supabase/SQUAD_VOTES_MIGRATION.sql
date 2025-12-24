-- Run this in the Supabase SQL editor to add squad voting feature
-- This adds a separate voting system for entire enemy squad compositions

-- Squad votes table for voting on entire enemy squad compositions
create table if not exists public.squad_votes (
  squad_key text not null, -- sorted comma-separated enemy team IDs
  user_id uuid not null references auth.users (id) on delete cascade,
  value integer not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (squad_key, user_id)
);

-- Reuse the existing set_updated_at function
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
