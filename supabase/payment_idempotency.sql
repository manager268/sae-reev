-- REEV 4.0 payment idempotency — additive migration. Run ONCE, after
-- schema.sql (and admin_schema.sql if you've already run that), in
-- Supabase Dashboard -> SQL Editor.
--
-- Why: nothing in the original schema stopped the same real, verified
-- Razorpay payment from being written into `payments` (and a matching
-- `team_registrations` row) twice — e.g. a network hiccup right after a
-- successful charge, followed by the user clicking Submit again. This
-- adds a hard database-level guarantee that one razorpay_payment_id can
-- back at most one payment row. Paired with the reordered write in
-- registration-api/index.ts (payment row inserted *before* the
-- registration row), a duplicate submission now fails fast with a clear
-- "already used" error instead of creating a second registration.

create unique index if not exists payments_razorpay_payment_id_key
  on payments (razorpay_payment_id)
  where razorpay_payment_id is not null;
