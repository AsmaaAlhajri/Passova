-- Passova admin: one admin account, approved sign-up emails, and a full
-- history of endorsements and admissions that never clears.
--
-- Until an admin exists, sign-up stays open exactly as before. Once an admin
-- is set, only emails on the approved list can create new accounts (signing
-- in to existing accounts is not affected).

-- ---------- Who is the admin ----------

alter table public.profiles
  add column is_admin boolean not null default false;

-- Not in the profile update grant, so no doctor can make themselves admin.

create function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and is_admin
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------- The shift window doctors see ----------

-- 08:00 Kuwait time today, or yesterday before 08:00.
create function public.current_shift_start()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (date_trunc('day', (now() at time zone 'Asia/Kuwait') - interval '8 hours') + interval '8 hours')
         at time zone 'Asia/Kuwait';
$$;

revoke execute on function public.current_shift_start() from public, anon;
grant execute on function public.current_shift_start() to authenticated;

-- ---------- Removing a patient keeps it in the history ----------

alter table public.endorsements add column deleted_at timestamptz;
alter table public.admissions add column deleted_at timestamptz;

create index endorsements_deleted_at_idx on public.endorsements (deleted_at);
create index admissions_deleted_at_idx on public.admissions (deleted_at);

-- The time a patient was removed is the database's, and removal is final.
create function public.stamp_removed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.deleted_at is not null then
    new.deleted_at := old.deleted_at;
  elsif new.deleted_at is not null then
    new.deleted_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.stamp_removed() from public, anon, authenticated;

create trigger endorsements_stamp_removed
  before update on public.endorsements
  for each row execute function public.stamp_removed();

create trigger admissions_stamp_removed
  before update on public.admissions
  for each row execute function public.stamp_removed();

-- Removing hides a patient but keeps it for the admin's history. Postgres
-- won't let a doctor update a row into one they can no longer see, so the
-- removal runs in this function, after checking the doctor entered it.
create function public.remove_patient(p_kind text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_rows int;
begin
  if p_kind = 'endorsement' then
    update public.endorsements set deleted_at = now()
      where id = p_id and created_by = (select auth.uid()) and deleted_at is null;
  elsif p_kind = 'admission' then
    update public.admissions set deleted_at = now()
      where id = p_id and created_by = (select auth.uid()) and deleted_at is null;
  else
    raise exception 'Unknown kind %', p_kind;
  end if;
  get diagnostics found_rows = row_count;
  if found_rows = 0 then
    raise exception 'Only the doctor who entered this can remove it.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.remove_patient(text, uuid) from public, anon;
grant execute on function public.remove_patient(text, uuid) to authenticated;

-- Nobody can erase a patient for real any more. (Applied once the pages
-- that use remove_patient went live.)
drop policy "Doctors can delete their own endorsements" on public.endorsements;
drop policy "Doctors can delete their own admissions" on public.admissions;
revoke delete on public.endorsements, public.admissions from authenticated;

-- ---------- Doctors see this shift; the admin sees everything ----------

drop policy "Doctors can see endorsements" on public.endorsements;
create policy "Doctors see this shift's endorsements; the admin sees all"
  on public.endorsements for select to authenticated
  using (
    (deleted_at is null and created_at >= (select public.current_shift_start()))
    or (select public.is_admin())
  );

drop policy "Doctors can see admissions" on public.admissions;
create policy "Doctors see this shift's admissions; the admin sees all"
  on public.admissions for select to authenticated
  using (
    (deleted_at is null and created_at >= (select public.current_shift_start()))
    or (select public.is_admin())
  );

drop policy "Doctors can see orders" on public.orders;
create policy "Doctors see this shift's orders; the admin sees all"
  on public.orders for select to authenticated
  using (created_at >= (select public.current_shift_start()) or (select public.is_admin()));

drop policy "Doctors can see reminders" on public.reminders;
create policy "Doctors see this shift's reminders; the admin sees all"
  on public.reminders for select to authenticated
  using (created_at >= (select public.current_shift_start()) or (select public.is_admin()));

-- Status, condition, synthesis and done stay open to any doctor, but only
-- for patients they can see (this shift, not removed).
drop policy "Doctors can update endorsement status" on public.endorsements;
create policy "Doctors can update this shift's endorsements"
  on public.endorsements for update to authenticated
  using (deleted_at is null and created_at >= (select public.current_shift_start()))
  with check (true);

drop policy "Doctors can update admission status" on public.admissions;
create policy "Doctors can update this shift's admissions"
  on public.admissions for update to authenticated
  using (deleted_at is null and created_at >= (select public.current_shift_start()))
  with check (true);

-- ---------- Approved sign-up emails ----------

create table public.allowed_emails (
  email text primary key check (email = lower(btrim(email)) and email like '%_@_%'),
  added_by uuid default auth.uid() references public.profiles (id) on delete set null,
  added_at timestamptz not null default now()
);

create index allowed_emails_added_by_idx on public.allowed_emails (added_by);

alter table public.allowed_emails enable row level security;

create policy "Only the admin sees approved emails"
  on public.allowed_emails for select to authenticated using ((select public.is_admin()));
create policy "Only the admin adds approved emails"
  on public.allowed_emails for insert to authenticated with check ((select public.is_admin()));
create policy "Only the admin removes approved emails"
  on public.allowed_emails for delete to authenticated using ((select public.is_admin()));

revoke all on public.allowed_emails from anon, authenticated;
grant select, insert, delete on public.allowed_emails to authenticated;

-- Emails are stored trimmed and lower-case, stamped with who added them.
create function public.normalise_allowed_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := lower(btrim(new.email));
  new.added_by := auth.uid();
  new.added_at := now();
  return new;
end;
$$;

revoke execute on function public.normalise_allowed_email() from public, anon, authenticated;

create trigger allowed_emails_normalise
  before insert on public.allowed_emails
  for each row execute function public.normalise_allowed_email();

-- For the admin's list: each approved email and whether it has signed up yet.
create function public.admin_allowed_emails()
returns table (email text, added_at timestamptz, added_by uuid, has_account boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select a.email, a.added_at, a.added_by,
         exists (select 1 from auth.users u where lower(u.email) = a.email)
  from public.allowed_emails a
  where public.is_admin()
  order by a.added_at desc;
$$;

revoke execute on function public.admin_allowed_emails() from public, anon;
grant execute on function public.admin_allowed_emails() to authenticated;

-- Sign-up gate: once an admin exists, a new account needs an approved email.
create function public.require_approved_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.profiles where is_admin)
     and not exists (select 1 from public.allowed_emails where email = lower(btrim(new.email))) then
    raise exception 'PASSOVA_EMAIL_NOT_APPROVED' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.require_approved_email() from public, anon, authenticated;

create trigger before_auth_user_created
  before insert on auth.users
  for each row execute function public.require_approved_email();
