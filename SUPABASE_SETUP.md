# REEV 4.0 registration backend — Supabase setup

This replaces the old Google Sheets / Apps Script backend entirely.
Registrations, team rosters, and payment records now live in a Postgres
database (Supabase), and a single Edge Function — **registration-api** —
does everything Code.gs used to: receive form submissions, create Razorpay
orders, verify payments, and write rows. `REGISTRATION_SETUP.md` (the old
doc) is obsolete; this one is the source of truth going forward.

**Security model, in one paragraph**: every table has Row Level Security
turned on with *zero* policies (see `supabase/schema.sql`) — meaning the
public key embedded in the site's JS (`supabaseAnonKey`) cannot read or
write a single row directly, no matter what. The only door in is the Edge
Function, which uses your project's `service_role` key (kept secret,
server-side only, provided automatically by Supabase — you never see or
copy it) to do the actual writing, after its own validation and, for the
three paid forms, cryptographic payment verification. Nothing the browser
sends is ever trusted at face value.

## Step 1 — Create the tables

1. In your Supabase project: **SQL Editor → New query**.
2. Paste the entire contents of [supabase/schema.sql](supabase/schema.sql)
   and click **Run**.
3. You should now see 9 new tables in **Table Editor**: `team_registrations`,
   `team_members`, `judges`, `student_volunteers`, `mentors`, `smes`,
   `individuals`, `payments`, `submission_logs`.

This is where you'll actually look at registrations day-to-day — Table
Editor, filter/sort like a spreadsheet. `team_registrations` joined with
`team_members` (via `team_registration_id`) gives you each team plus its
full roster; `payments` gives you the Razorpay audit trail; `submission_logs`
has every attempt, successful or not, as a backup/debugging trail.

## Step 2 — Deploy the Edge Function

You'll need the [Supabase CLI](https://supabase.com/docs/guides/cli) installed
locally (`npm install -g supabase`, or see their docs for other install
methods) and to be logged in (`supabase login`).

1. From this repo's root, link the CLI to your project (find your project
   ref in the Supabase dashboard URL, or **Settings → General**):
   ```
   supabase link --project-ref YOUR_PROJECT_REF
   ```
2. Set the Razorpay secrets (see [Step 4](#step-4--connect-razorpay) for
   where these come from — you can also do this after deploying and just
   redeploy isn't even needed, secrets apply immediately):
   ```
   supabase secrets set RAZORPAY_KEY_ID=your_key_id RAZORPAY_KEY_SECRET=your_key_secret
   ```
3. Deploy the function (already written at
   [supabase/functions/registration-api/index.ts](supabase/functions/registration-api/index.ts) —
   nothing to paste, just deploy what's in the repo):
   ```
   supabase functions deploy registration-api
   ```
4. That's it — no separate "copy the URL" step like Apps Script had. The
   site derives the function's URL itself from `supabaseUrl` (Step 3).

### Redeploying after you change the Edge Function's code

Every `supabase functions deploy registration-api` overwrites the live
function immediately — there's no separate "make it live" step like Apps
Script's deployment versioning. Just redeploy after any edit.

## Step 3 — Connect the site

1. Supabase dashboard → **Settings → API**.
2. Copy the **Project URL** (looks like `https://xxxxxxxx.supabase.co`).
3. Copy the **anon / public** key (NOT the `service_role` key — that one
   must never appear anywhere in this repo or on the site).
4. Paste both into [assets/data/registration.js](assets/data/registration.js):
   ```javascript
   supabaseUrl: "https://xxxxxxxx.supabase.co",
   supabaseAnonKey: "eyJ...", // the long anon key, safe to publish
   ```
5. Push. Until both are filled in, every form on the site stays locked
   with a "registration isn't connected yet" message.

## Step 4 — Connect Razorpay

1. Log into your Razorpay dashboard → **Settings → API Keys**.
2. Generate/copy a **Key ID** and **Key Secret**. Start in **Test Mode**
   (toggle top-right of the dashboard) so you can rehearse the whole flow
   with Razorpay's test cards/UPI before ever touching real money — Test
   Mode keys look like `rzp_test_...`, Live Mode keys like `rzp_live_...`.
3. **Key ID** goes in **two** places (it's public, safe to publish):
   - `RAZORPAY_KEY_ID` via `supabase secrets set` (Step 2)
   - `razorpay.keyId` in [assets/data/registration.js](assets/data/registration.js), then push
4. **Key Secret** goes in **exactly one** place, and it is private:
   - `RAZORPAY_KEY_SECRET` via `supabase secrets set` (Step 2) only.
   - **Never** put it in `registration.js`, this doc, a commit, or anywhere
     else that reaches the git repo or a chat.
5. Test with registration temporarily unlocked (ask to have `opensAt`
   moved back) using [Razorpay's test card/UPI numbers](https://razorpay.com/docs/payments/payments/test-card-upi-details/)
   — confirm a row lands in `team_registrations` with `payment_status =
   'paid'` and a real `payment_id`, plus a matching row in `payments` with
   `status = 'verified'`. Then switch to Live Mode keys when ready for real
   registrations (repeat steps 2-4 with the live keys, then
   `supabase secrets set` + redeploy again).

## Step 5 — Admin dashboard

`admin.html` — a real login (Supabase Auth), showing every team/registrant
and payment collected, with CSV export and manual corrections. It's not
linked from any nav — reachable only if you know the URL.

1. **SQL Editor → New query**, paste the entire contents of
   [supabase/admin_schema.sql](supabase/admin_schema.sql), **Run**. This is
   additive on top of `schema.sql` (Step 1) — adds an `is_admin()` helper,
   admin-gated read/update/delete policies on all 9 tables, and a new
   `admin_audit_log` table recording every edit/delete an admin makes
   (who, when, before/after).
2. Create the first admin account: **Authentication → Users → Add User**
   (check **Auto Confirm User**), then run this in the SQL Editor with that
   user's email:
   ```sql
   insert into public.profiles (id, full_name, email, role)
   select id, '', email, 'admin' from auth.users where email = 'you@example.com'
   on conflict (id) do update set role = 'admin';
   ```
3. Visit `/admin.html`, sign in. Nothing further to configure — it reuses
   the same `supabaseUrl`/`supabaseAnonKey` from Step 3 above.

**What it does and doesn't do**: Teams (with full roster), Payments,
Judges, Student Volunteers, Mentors, SMEs, Individuals, and a read-only
Submission Logs viewer, each as a tab with Refresh + CSV export. Every
table except Logs supports Edit (any field) and Delete — deleting a team
also cascades its roster and payment record, so that one asks you to type
the team's name to confirm; everything else just needs a normal confirm.
There's no "add a brand-new record" button yet (only correcting/removing
existing ones) — an easy follow-on if you want it later. The dashboard
talks directly to Supabase (not through `registration-api`) using the same
RLS-everywhere model as the rest of this doc: an admin session can see and
write these tables only because `is_admin()` says so, nothing else changes
about the public lockdown.

Session note: sign-in doesn't persist past closing the browser (uses
`sessionStorage`, not `localStorage`) — deliberate, since this may run on
a shared computer. Reloading the page while the browser stays open keeps
you signed in; closing and reopening the browser requires signing in again.

## Step 6 — Payment idempotency (do this once, any time after Step 1)

Guards against one real Razorpay payment ever backing two registration
rows — e.g. a network blip right after a successful charge, followed by
the visitor clicking Submit again.

1. **SQL Editor → New query**, paste the entire contents of
   [supabase/payment_idempotency.sql](supabase/payment_idempotency.sql),
   **Run**. Adds a unique index on `payments.razorpay_payment_id`.
2. Redeploy the function so it picks up the matching code change (payment
   row written before the registration row, so a duplicate fails fast
   instead of creating an orphaned second registration):
   ```
   supabase functions deploy registration-api
   ```

That's the whole step — nothing in `assets/data/registration.js` or any
HTML page needs to change for this one.

## Step 7 — One email per registration type

Stops the same email from submitting the same form twice (bot spam,
accidental double-registration). Scope is per registration *type*, not
global — one email can be a team contact AND a judge AND a mentor, just
can't submit the Team form (or the Judge form, etc.) more than once.

1. **SQL Editor → New query**, paste the entire contents of
   [supabase/email_uniqueness.sql](supabase/email_uniqueness.sql), **Run**.
   Adds a unique index on the email column of `team_registrations`,
   `judges`, `student_volunteers`, `mentors`, `smes`, and `individuals`.
2. Redeploy so the function picks up the matching code (a friendly
   pre-payment check on the Team form — so nobody pays before finding out
   their email was already used — plus a duplicate-email message on every
   form if the database constraint above ever catches a race):
   ```
   supabase functions deploy registration-api
   ```

Same as Step 6 — nothing on the frontend needs to change.

## Step 8 — Individual registration (₹2,000, paid)

Adds a fourth, standalone paid path — the "Register — Individual" tab on
register.html — for anyone attending without a team, alongside Team, Judge,
and Tech Team/Volunteer. Same Razorpay flow as Team (order created and
verified server-side), just a smaller fee and its own `individuals` table
instead of `team_registrations`.

1. **SQL Editor → New query**, paste the entire contents of
   [supabase/individual_registration_payment.sql](supabase/individual_registration_payment.sql),
   **Run**. Adds `payment_status`/`payment_id`/`amount_paid_inr` to
   `individuals`, and an optional `individual_id` link on `payments`
   (mirrors `team_registration_id`).
2. Redeploy so the function picks up the matching code (`individual` added
   to `PAID_FORM_TYPES`, its own ₹2,000 fee constant, and its own
   validation/insert path — separate from the older, unrelated free
   `phase1Individual` path in index.html's Phase 1 modal):
   ```
   supabase functions deploy registration-api
   ```

Nothing else needed — email-uniqueness (Step 7) and payment-idempotency
(Step 6) already cover every table and the whole `payments` table
respectively, `individuals` included.

## Step 9 — Confirmation emails (optional)

Every successful registration (team, individual, judge, mentor, SME,
volunteer) can send the registrant a short "you're confirmed" email. This
is entirely optional — until it's set up, the function just silently
skips sending one; nothing else breaks.

1. Sign up at [resend.com](https://resend.com) (free tier: 3,000
   emails/month). You can start sending immediately from their shared
   `onboarding@resend.dev` sender — verifying your own domain (e.g.
   `reev@saeibs.org`) is a one-time DNS step you can do later, purely
   cosmetic for the "From" address.
2. Dashboard → **API Keys → Create API Key**, copy it.
3. Set the secrets (paste the key straight from Resend — never through
   chat/AI, same rule as the Razorpay Key Secret):
   ```
   supabase secrets set RESEND_API_KEY=your_resend_api_key
   ```
   Optional — only if you've verified your own sending domain:
   ```
   supabase secrets set RESEND_FROM_EMAIL="REEV SAEINDIA <reev@saeibs.org>"
   ```
4. Redeploy:
   ```
   supabase functions deploy registration-api
   ```

That's it — no frontend change, no new table. Every registration type
maps its own "who to email" field internally (`contactInfoFor` in
`registration-api/index.ts`).

## Local development note

`supabase/functions/registration-api/index.ts` is a Deno Edge Function —
it isn't run by any Node tooling in this repo, it only runs on Supabase's
servers once deployed (or via `supabase functions serve` locally if you
want to test against it before deploying, see the Supabase CLI docs).
