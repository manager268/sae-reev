-- REEV 4.0 registration backend — Supabase/Postgres schema.
-- Run this once in Supabase Dashboard → SQL Editor → New query → Run.
-- See SUPABASE_SETUP.md for the full setup walkthrough.
--
-- Design: every table has Row Level Security enabled and ZERO policies.
-- That means the public anon key (embedded in the site's JS — normal and
-- expected) can reach these tables through nothing at all: no direct
-- inserts, no reads. The only way data gets in is the "registration-api"
-- Edge Function, which uses the service_role key (server-side only,
-- bypasses RLS by design) after doing its own validation and, for paid
-- registrations, cryptographic payment verification. This is the Postgres
-- equivalent of what Code.gs did on the Apps Script side — nothing the
-- browser sends is ever trusted at face value.

-- ============ TEAM REGISTRATIONS ============
-- Covers all three team-entry paths: the Team form (register.html) and
-- the two team options in the Phase 1 modal (index.html).
create table team_registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  registration_type text not null
    check (registration_type in ('team', 'phase1_prev_team', 'phase1_new_team')),
  college_name text not null,
  team_name text not null,
  edition text, -- only set for phase1_prev_team ("which edition did you compete in?")
  contact_name text not null,   -- team captain (team) or contact person (phase1 paths)
  contact_email text not null,
  contact_phone text not null,
  team_size int not null default 1,
  notes text,
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed')),
  payment_id text,
  amount_paid_inr numeric
);

create table team_members (
  id uuid primary key default gen_random_uuid(),
  team_registration_id uuid not null references team_registrations(id) on delete cascade,
  name text not null,
  branch text,
  year text,
  email text,
  phone text
);

-- ============ FREE (NON-PAID) REGISTRATIONS ============
create table judges (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  organisation text not null,
  expertise text not null,
  email text not null,
  phone text not null,
  notes text
);

create table student_volunteers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  college text not null,
  year text not null,
  interest text not null,
  email text not null,
  phone text not null
);

create table mentors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  organisation text not null,
  expertise text not null,
  email text not null,
  phone text not null,
  notes text
);

create table smes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  organisation text not null,
  expertise text not null,
  email text not null,
  phone text not null
);

create table individuals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  college text not null,
  year text not null,
  reason text not null,
  email text not null,
  phone text not null
);

-- ============ PAYMENTS (audit trail, separate from team_registrations) ============
create table payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  team_registration_id uuid references team_registrations(id) on delete set null,
  razorpay_order_id text not null,
  razorpay_payment_id text,
  razorpay_signature text,
  amount_paise int not null,
  status text not null default 'created'
    check (status in ('created', 'verified', 'failed')),
  verified_at timestamptz
);

-- ============ LOGS (backup + audit trail for every attempt) ============
-- Every submission attempt — success or failure, paid or free — lands
-- here too, with the raw payload, independent of the tables above. Same
-- role the "Logs" sheet tab played in the old Apps Script backend.
create table submission_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  form_type text not null,
  status text not null,
  error_message text,
  raw_payload jsonb
);

-- ============ LOCK EVERYTHING DOWN ============
alter table team_registrations enable row level security;
alter table team_members enable row level security;
alter table judges enable row level security;
alter table student_volunteers enable row level security;
alter table mentors enable row level security;
alter table smes enable row level security;
alter table individuals enable row level security;
alter table payments enable row level security;
alter table submission_logs enable row level security;
-- No policies defined for any table on purpose — see the note at the top.

-- Helpful indexes for browsing in the Table Editor / building an admin view later.
create index on team_registrations (created_at desc);
create index on team_members (team_registration_id);
create index on payments (team_registration_id);
create index on submission_logs (created_at desc);
