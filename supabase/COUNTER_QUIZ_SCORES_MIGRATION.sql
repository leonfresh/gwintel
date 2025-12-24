-- Counter Quiz leaderboard (global)

create table if not exists public.counter_quiz_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text,
  score integer not null default 0,
  best_streak integer not null default 0,
  created_at timestamptz not null default now(),
  constraint counter_quiz_scores_score_nonneg check (score >= 0),
  constraint counter_quiz_scores_streak_nonneg check (best_streak >= 0)
);

create index if not exists counter_quiz_scores_leaderboard_idx
  on public.counter_quiz_scores (score desc, best_streak desc, created_at desc);

create index if not exists counter_quiz_scores_user_idx
  on public.counter_quiz_scores (user_id, score desc, best_streak desc, created_at desc);

alter table public.counter_quiz_scores enable row level security;

drop policy if exists "read counter quiz scores" on public.counter_quiz_scores;
create policy "read counter quiz scores"
  on public.counter_quiz_scores
  for select
  using (true);

drop policy if exists "insert own counter quiz score" on public.counter_quiz_scores;
create policy "insert own counter quiz score"
  on public.counter_quiz_scores
  for insert
  to authenticated
  with check (auth.uid() = user_id);
