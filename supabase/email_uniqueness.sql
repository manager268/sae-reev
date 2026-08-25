-- REEV 4.0 one-email-per-registration-type — additive migration. Run ONCE,
-- any time after schema.sql, in Supabase Dashboard -> SQL Editor.
--
-- Scope: per registration TYPE, not global — the same email can be a team
-- contact AND a judge AND a mentor, but can't submit the same form twice.
-- This is the hard, database-level guarantee; registration-api/index.ts
-- pairs it with a friendly pre-check (so a paying team isn't charged only
-- to be told afterward their email was already used) and a matching
-- unique_violation (23505) catch on every insert as the final safety net
-- against a race between two simultaneous submissions.

create unique index if not exists team_registrations_contact_email_key
  on team_registrations (contact_email);

create unique index if not exists judges_email_key
  on judges (email);

create unique index if not exists student_volunteers_email_key
  on student_volunteers (email);

create unique index if not exists mentors_email_key
  on mentors (email);

create unique index if not exists smes_email_key
  on smes (email);

create unique index if not exists individuals_email_key
  on individuals (email);
