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

## What's deliberately not built (yet)

Supabase also does user accounts (signup/login/sessions) — the "Team
Login" / "Alumni Login" pages on login.html are still just static "coming
soon" stubs, not wired to Supabase Auth. That's a separate, sizeable
feature (an actual dashboard for teams to log into and see/edit their own
registration) — say the word whenever you want that built; this pass was
scoped to replacing the registration/payment backend only.

## Local development note

`supabase/functions/registration-api/index.ts` is a Deno Edge Function —
it isn't run by any Node tooling in this repo, it only runs on Supabase's
servers once deployed (or via `supabase functions serve` locally if you
want to test against it before deploying, see the Supabase CLI docs).
