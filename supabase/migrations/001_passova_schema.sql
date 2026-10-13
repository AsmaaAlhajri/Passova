-- Passova schema: doctor profiles, I-PASS endorsements, new admissions,
-- pending orders (I-PASS action list) and manual reminders.
--
-- Rules the database enforces, so the pages cannot get them wrong:
--   * Only signed-in doctors can read or write anything.
--   * Every row records who created it and when; nobody can forge that.
--   * New patients always start as "not seen".
--   * Marking a patient "seen" records who and when, and is final.
--   * Doctors may change only a patient's status (and the I-PASS synthesis),
--     tick off orders and reminders, and delete what they created themselves.

-- ---------- Profiles ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  position text check (position is null or char_length(position) <= 60),
  team smallint check (team between 1 and 3),
  phone text check (phone is null or char_length(phone) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Doctors can see every profile"
  on public.profiles for select to authenticated using (true);

create policy "Doctors can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, position, team, phone) on public.profiles to authenticated;

-- A profile is created with the name given at sign-up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------- Patients: endorsements and admissions ----------

create table public.endorsements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,

  ward text not null check (char_length(ward) between 1 and 20),
  room text not null check (char_length(room) between 1 and 20),
  team smallint not null check (team between 1 and 3),

  patient_name text not null check (char_length(patient_name) between 1 and 120),
  age smallint check (age between 0 and 130),
  gender text check (gender in ('male', 'female')),

  -- I: illness severity
  severity text not null check (severity in ('stable', 'watcher', 'star')),
  -- P: patient summary
  working_diagnosis text not null check (char_length(working_diagnosis) between 1 and 300),
  summary text not null default '' check (char_length(summary) <= 4000),
  ongoing_assessment text not null default '' check (char_length(ongoing_assessment) <= 2000),
  plan text not null default '' check (char_length(plan) <= 2000),
  -- A: action list lives in public.orders
  -- S: suggestions (if/then)
  suggestions text not null default '' check (char_length(suggestions) <= 2000),
  -- S: synthesis by the receiving doctor
  synthesis text not null default '' check (char_length(synthesis) <= 2000),

  status text not null default 'not_seen' check (status in ('not_seen', 'reassess', 'seen')),
  status_by uuid references public.profiles (id) on delete set null,
  status_at timestamptz,
  seen_by uuid references public.profiles (id) on delete set null,
  seen_at timestamptz
);

create table public.admissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,

  ward text not null check (char_length(ward) between 1 and 20),
  room text not null check (char_length(room) between 1 and 20),
  patient_name text not null check (char_length(patient_name) between 1 and 120),
  age smallint not null check (age between 0 and 130),
  diagnosis text not null check (char_length(diagnosis) between 1 and 300),
  condition text not null check (condition in ('stable', 'unstable', 'watcher')),

  status text not null default 'not_seen' check (status in ('not_seen', 'reassess', 'seen')),
  status_by uuid references public.profiles (id) on delete set null,
  status_at timestamptz,
  seen_by uuid references public.profiles (id) on delete set null,
  seen_at timestamptz
);

create index endorsements_created_at_idx on public.endorsements (created_at);
create index endorsements_created_by_idx on public.endorsements (created_by);
create index endorsements_status_by_idx on public.endorsements (status_by);
create index endorsements_seen_by_idx on public.endorsements (seen_by);
create index admissions_created_at_idx on public.admissions (created_at);
create index admissions_created_by_idx on public.admissions (created_by);
create index admissions_status_by_idx on public.admissions (status_by);
create index admissions_seen_by_idx on public.admissions (seen_by);

-- New patients start unseen; on update only the status may move, "seen" is
-- final and stamps who and when.
create function public.guard_patient_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
    new.status := 'not_seen';
    new.status_by := null;
    new.status_at := null;
    new.seen_by := null;
    new.seen_at := null;
    return new;
  end if;

  if new.status is distinct from old.status then
    if old.status = 'seen' then
      raise exception 'This patient is already marked as seen.' using errcode = 'check_violation';
    end if;
    new.status_by := auth.uid();
    new.status_at := now();
    if new.status = 'seen' then
      new.seen_by := auth.uid();
      new.seen_at := now();
    end if;
  else
    new.status_by := old.status_by;
    new.status_at := old.status_at;
  end if;

  if new.status <> 'seen' then
    new.seen_by := null;
    new.seen_at := null;
  elsif old.status = 'seen' then
    new.seen_by := old.seen_by;
    new.seen_at := old.seen_at;
  end if;

  return new;
end;
$$;

create trigger endorsements_guard
  before insert or update on public.endorsements
  for each row execute function public.guard_patient_status();

create trigger admissions_guard
  before insert or update on public.admissions
  for each row execute function public.guard_patient_status();

alter table public.endorsements enable row level security;
alter table public.admissions enable row level security;

create policy "Doctors can see endorsements"
  on public.endorsements for select to authenticated using (true);
create policy "Doctors can add endorsements as themselves"
  on public.endorsements for insert to authenticated
  with check ((select auth.uid()) = created_by);
create policy "Doctors can update endorsement status"
  on public.endorsements for update to authenticated using (true) with check (true);
create policy "Doctors can delete their own endorsements"
  on public.endorsements for delete to authenticated
  using ((select auth.uid()) = created_by);

create policy "Doctors can see admissions"
  on public.admissions for select to authenticated using (true);
create policy "Doctors can add admissions as themselves"
  on public.admissions for insert to authenticated
  with check ((select auth.uid()) = created_by);
create policy "Doctors can update admission status"
  on public.admissions for update to authenticated using (true) with check (true);
create policy "Doctors can delete their own admissions"
  on public.admissions for delete to authenticated
  using ((select auth.uid()) = created_by);

revoke all on public.endorsements, public.admissions from anon, authenticated;
grant select, insert, delete on public.endorsements, public.admissions to authenticated;
grant update (status) on public.admissions to authenticated;
grant update (status, synthesis) on public.endorsements to authenticated;

-- ---------- Pending orders (I-PASS action list) ----------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endorsement_id uuid references public.endorsements (id) on delete cascade,
  admission_id uuid references public.admissions (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 200),
  due_at timestamptz,
  done boolean not null default false,
  done_by uuid references public.profiles (id) on delete set null,
  done_at timestamptz,
  check (num_nonnulls(endorsement_id, admission_id) = 1)
);

-- ---------- Manual reminders ----------

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endorsement_id uuid references public.endorsements (id) on delete cascade,
  admission_id uuid references public.admissions (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 200),
  due_at timestamptz,
  done boolean not null default false,
  done_by uuid references public.profiles (id) on delete set null,
  done_at timestamptz,
  check (num_nonnulls(endorsement_id, admission_id) <= 1)
);

create index orders_endorsement_idx on public.orders (endorsement_id);
create index orders_admission_idx on public.orders (admission_id);
create index orders_created_by_idx on public.orders (created_by);
create index orders_done_by_idx on public.orders (done_by);
create index reminders_created_at_idx on public.reminders (created_at);
create index reminders_endorsement_idx on public.reminders (endorsement_id);
create index reminders_admission_idx on public.reminders (admission_id);
create index reminders_created_by_idx on public.reminders (created_by);
create index reminders_done_by_idx on public.reminders (done_by);

-- Creator and time are stamped on insert; ticking an item off stamps who
-- and when, and a done item stays done.
create function public.guard_task()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
    new.done := false;
    new.done_by := null;
    new.done_at := null;
    return new;
  end if;

  if old.done then
    new.done := true;
    new.done_by := old.done_by;
    new.done_at := old.done_at;
  elsif new.done then
    new.done_by := auth.uid();
    new.done_at := now();
  end if;
  return new;
end;
$$;

create trigger orders_guard
  before insert or update on public.orders
  for each row execute function public.guard_task();

create trigger reminders_guard
  before insert or update on public.reminders
  for each row execute function public.guard_task();

alter table public.orders enable row level security;
alter table public.reminders enable row level security;

create policy "Doctors can see orders"
  on public.orders for select to authenticated using (true);
create policy "Doctors can add orders as themselves"
  on public.orders for insert to authenticated
  with check ((select auth.uid()) = created_by);
create policy "Doctors can tick off orders"
  on public.orders for update to authenticated using (true) with check (true);
create policy "Doctors can delete their own orders"
  on public.orders for delete to authenticated
  using ((select auth.uid()) = created_by);

create policy "Doctors can see reminders"
  on public.reminders for select to authenticated using (true);
create policy "Doctors can add reminders as themselves"
  on public.reminders for insert to authenticated
  with check ((select auth.uid()) = created_by);
create policy "Doctors can tick off reminders"
  on public.reminders for update to authenticated using (true) with check (true);
create policy "Doctors can delete their own reminders"
  on public.reminders for delete to authenticated
  using ((select auth.uid()) = created_by);

revoke all on public.orders, public.reminders from anon, authenticated;
grant select, insert, delete on public.orders, public.reminders to authenticated;
grant update (done) on public.orders, public.reminders to authenticated;

-- ---------- Live updates ----------

alter publication supabase_realtime
  add table public.endorsements, public.admissions, public.orders, public.reminders;

-- ---------- Trigger functions are not part of the API ----------

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.guard_patient_status() from public, anon, authenticated;
revoke execute on function public.guard_task() from public, anon, authenticated;

-- ---------- Sign-up can also carry the doctor's position and team ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  team_text text := meta ->> 'team';
begin
  insert into public.profiles (id, full_name, position, team)
  values (
    new.id,
    left(coalesce(meta ->> 'full_name', ''), 120),
    nullif(left(coalesce(meta ->> 'position', ''), 60), ''),
    case when team_text in ('1', '2', '3') then team_text::smallint end
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------- Every reminder names a patient ----------
-- Either one of this shift's patients, or one typed in by hand ("Other").

alter table public.reminders
  add column patient_label text check (patient_label is null or char_length(patient_label) between 1 and 120);

alter table public.reminders
  drop constraint reminders_check;

alter table public.reminders
  add constraint reminders_one_patient
  check (num_nonnulls(endorsement_id, admission_id, nullif(btrim(patient_label), '')) = 1);

-- ---------- Severity "STAR" is now called "Unstable"; condition can change ----------

alter table public.endorsements drop constraint endorsements_severity_check;
update public.endorsements set severity = 'unstable' where severity = 'star';
alter table public.endorsements
  add constraint endorsements_severity_check check (severity in ('stable', 'watcher', 'unstable'));

-- Any doctor can update an admitted patient's condition.
grant update (condition) on public.admissions to authenticated;
