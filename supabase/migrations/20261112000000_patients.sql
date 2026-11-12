-- ClearDx: simple patient management for signed-in users.
-- Each user keeps their own list of patients; saved analyses can be linked to one.
-- Row-level security: users can only see and change their own rows.

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  birth_year int check (birth_year between 1900 and 2100),
  sex text check (sex in ('male', 'female', 'other')),
  notes text check (char_length(notes) <= 500)
);

create index if not exists patients_user_name_idx on public.patients (user_id, name);

alter table public.patients enable row level security;

drop policy if exists "Users read own patients" on public.patients;
create policy "Users read own patients" on public.patients
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users insert own patients" on public.patients;
create policy "Users insert own patients" on public.patients
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "Users update own patients" on public.patients;
create policy "Users update own patients" on public.patients
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Users delete own patients" on public.patients;
create policy "Users delete own patients" on public.patients
  for delete to authenticated using (user_id = (select auth.uid()));

-- Link analyses to a patient (optional). Deleting a patient keeps their reports, unlinked.
alter table public.analyses
  add column if not exists patient_id uuid references public.patients (id) on delete set null;

create index if not exists analyses_patient_created_idx on public.analyses (patient_id, created_at desc);

-- A user may only link their own analyses to their own patients.
drop policy if exists "Users insert own analyses" on public.analyses;
create policy "Users insert own analyses" on public.analyses
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (patient_id is null or exists (
      select 1 from public.patients p where p.id = patient_id and p.user_id = (select auth.uid())
    ))
  );

drop policy if exists "Users update own analyses" on public.analyses;
create policy "Users update own analyses" on public.analyses
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and (patient_id is null or exists (
      select 1 from public.patients p where p.id = patient_id and p.user_id = (select auth.uid())
    ))
  );
