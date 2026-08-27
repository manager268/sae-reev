-- REEV 4.0 team faculty advisors — additive migration. Run ONCE, any time
-- after schema.sql, in Supabase Dashboard -> SQL Editor.
--
-- The Team form (register.html) now collects two faculty advisors per
-- team, alongside a New team / Previously participated team choice (which
-- was already supported — see registration_type/edition on
-- team_registrations — just newly exposed as a choice on the main Team
-- tab instead of only via the old Phase 1 modal).

alter table team_registrations
  add column if not exists advisor1_name text,
  add column if not exists advisor1_email text,
  add column if not exists advisor1_phone text,
  add column if not exists advisor2_name text,
  add column if not exists advisor2_email text,
  add column if not exists advisor2_phone text;
