-- ClearDx: saved analyses for signed-in users (optional feature).
-- Row-level security: every user can only see, add and delete their own rows.

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  source text not null check (source in ('mock', 'groq')),
  top_condition text,
  top_confidence real check (top_confidence between 0 and 1),
  input jsonb not null,   -- { symptoms, age, sex, duration, answers, excluded, noEffect }
  result jsonb not null   -- the PredictionResult exactly as returned by /api/predict
);

create index if not exists analyses_user_created_idx on public.analyses (user_id, created_at desc);

alter table public.analyses enable row level security;

drop policy if exists "Users read own analyses" on public.analyses;
create policy "Users read own analyses" on public.analyses
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users insert own analyses" on public.analyses;
create policy "Users insert own analyses" on public.analyses
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "Users delete own analyses" on public.analyses;
create policy "Users delete own analyses" on public.analyses
  for delete to authenticated using (user_id = (select auth.uid()));
