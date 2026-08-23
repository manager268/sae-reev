-- REEV 4.0 admin dashboard — additive migration. Run ONCE, after
-- schema.sql, in Supabase Dashboard -> SQL Editor. Layers admin-only
-- access on top of the existing "RLS on, zero policies" lockdown from
-- schema.sql — does not loosen anything for the public anon key used by
-- the registration forms. See SUPABASE_SETUP.md Step 5.
--
-- Uses the pre-existing `profiles` table (id uuid pk references
-- auth.users, full_name, email, phone, role text check in ('team',
-- 'alumni','judge','tech_team','admin'), created_at) — not created here,
-- this migration only adds RLS + a helper function on top of it.

-- ============ PROFILES: lock it down the same way as everything else ============
alter table profiles enable row level security;
-- No SELECT/UPDATE/DELETE/INSERT policies added on purpose — nothing reads
-- profiles directly, not even its own owner. Only the SECURITY DEFINER
-- function below can see inside it.

-- ============ is_admin(): single source of truth ============
-- Used two ways: (1) inside every RLS policy below, (2) called directly by
-- the admin dashboard as an RPC (`supabase.rpc('is_admin')`) to drive the
-- login gate.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- ============ ADMIN READ ACCESS — all 9 existing tables ============
drop policy if exists "admin can read" on team_registrations;
create policy "admin can read" on team_registrations for select using (is_admin());

drop policy if exists "admin can read" on team_members;
create policy "admin can read" on team_members for select using (is_admin());

drop policy if exists "admin can read" on judges;
create policy "admin can read" on judges for select using (is_admin());

drop policy if exists "admin can read" on student_volunteers;
create policy "admin can read" on student_volunteers for select using (is_admin());

drop policy if exists "admin can read" on mentors;
create policy "admin can read" on mentors for select using (is_admin());

drop policy if exists "admin can read" on smes;
create policy "admin can read" on smes for select using (is_admin());

drop policy if exists "admin can read" on individuals;
create policy "admin can read" on individuals for select using (is_admin());

drop policy if exists "admin can read" on payments;
create policy "admin can read" on payments for select using (is_admin());

drop policy if exists "admin can read" on submission_logs;
create policy "admin can read" on submission_logs for select using (is_admin());
-- submission_logs: SELECT only, on purpose — append-only debug trail, no
-- admin UI edits it, no update/delete policy added for it.

-- ============ ADMIN UPDATE + DELETE — correction-capable tables ============
-- Everything except submission_logs.
do $$
declare t text;
begin
  foreach t in array array[
    'team_registrations','team_members','payments',
    'judges','student_volunteers','mentors','smes','individuals'
  ]
  loop
    execute format('drop policy if exists "admin can update" on %I', t);
    execute format('create policy "admin can update" on %I for update using (is_admin()) with check (is_admin())', t);
    execute format('drop policy if exists "admin can delete" on %I', t);
    execute format('create policy "admin can delete" on %I for delete using (is_admin())', t);
  end loop;
end $$;

-- ============ AUDIT LOG for manual corrections ============
create table if not exists admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid references auth.users(id),
  actor_email text,
  table_name text not null,
  row_id uuid,
  action text not null check (action in ('update', 'delete')),
  before jsonb,
  after jsonb
);
alter table admin_audit_log enable row level security;

drop policy if exists "admin can read audit log" on admin_audit_log;
create policy "admin can read audit log" on admin_audit_log for select using (is_admin());
drop policy if exists "admin can write audit log" on admin_audit_log;
create policy "admin can write audit log" on admin_audit_log for insert with check (is_admin());
-- No update/delete policy on admin_audit_log — append-only, even for admins.

create index if not exists admin_audit_log_created_at_idx on admin_audit_log (created_at desc);
create index if not exists admin_audit_log_table_row_idx on admin_audit_log (table_name, row_id);
