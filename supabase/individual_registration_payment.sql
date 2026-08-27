-- REEV 4.0 individual registration payment — additive migration. Run ONCE,
-- any time after schema.sql, in Supabase Dashboard -> SQL Editor.
--
-- Turns the "Register — Individual" tab (register.html) into a paid
-- registration (₹2,000, via Razorpay) — same pattern as team_registrations:
-- payment fields live directly on the individuals row, and the payments
-- audit-trail table gets an optional link back to it (mirrors
-- team_registration_id). The older free phase1Individual path (index.html's
-- Phase 1 modal) is untouched — its inserts just take the new columns'
-- defaults.
--
-- Already covered by earlier migrations, nothing more to do for these:
--   - Duplicate-payment protection: payments_razorpay_payment_id_key
--     (supabase/payment_idempotency.sql) applies to every row in the
--     shared payments table, individual payments included.
--   - One-email-per-type: individuals_email_key
--     (supabase/email_uniqueness.sql) already covers this table.

alter table individuals
  add column if not exists payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed')),
  add column if not exists payment_id text,
  add column if not exists amount_paid_inr numeric;

alter table payments
  add column if not exists individual_id uuid references individuals(id) on delete set null;
