/*
  REGISTRATION — configuration for every on-site registration form.
  Backend: Supabase (Postgres + an Edge Function called "registration-api").
  See SUPABASE_SETUP.md for the one-time setup this depends on.
  -----------------------------------------------------------------------------
  1. opensAt / opensAtLabel
     Every registration form stays LOCKED (fields disabled, submit blocked)
     until this moment, then unlocks automatically — no manual flip needed.
       - opensAt is compared against the visitor's clock, so keep it in ISO
         format with an explicit timezone offset. IST is +05:30.
       - opensAtLabel is the human-readable text shown on locked forms.

  2. supabaseUrl / supabaseAnonKey
     Your Supabase project's URL (e.g. "https://xxxxx.supabase.co") and its
     public "anon" key — both meant to be public, safe to publish here (the
     anon key can't do anything on its own; every table has Row Level
     Security enabled with no policies, so it grants zero direct table
     access — see supabase/schema.sql). These two are just what's needed to
     call the registration-api Edge Function, which does the actual work.
       - Leave either blank and every form stays locked with a "registration
         isn't connected yet" note, even after opensAt.
       - The Edge Function URL is derived from supabaseUrl automatically:
         `${supabaseUrl}/functions/v1/registration-api`.
       - One function serves all 8 forms — each form sends its own
         formType (team, judge, techteamStudent, techteamMentor,
         techteamSme, phase1PrevTeam, phase1NewTeam, phase1Individual)
         so the function knows which table(s) to write to.

  3. razorpay.keyId
     The three team-registration forms (team, phase1PrevTeam,
     phase1NewTeam) collect a ₹20,000 fee via Razorpay before they submit
     — see js/registration-form.js. This is Razorpay's public "Key ID"
     (safe to publish — it identifies your account, it can't move money on
     its own). Leave it "" and those three forms stay locked with a
     "payment isn't connected yet" note, same idea as above.
       - The Key SECRET is a completely different thing and must NEVER go
         in this file (or anywhere in this repo) — it lives only as a
         Supabase Edge Function secret (`supabase secrets set
         RAZORPAY_KEY_SECRET=...`), which is not part of git.
         See SUPABASE_SETUP.md.
       - The actual fee amount is decided inside the Edge Function, not by
         anything in this file — this is just the public identifier
         Razorpay's Checkout widget needs to open.
*/
window.REGISTRATION_CONFIG = {
  // TEMPORARILY unlocked early for testing — see TESTING note below.
  // Real value to restore: "2026-08-25T00:00:00+05:30"
  opensAt: "2026-08-23T00:00:00+05:30",
  opensAtLabel: "25 Aug 2026",
  supabaseUrl: "https://ykgisvvjsxvuqqwjcjjh.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZ2lzdnZqc3h2dXFxd2pjampoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0OTY5NjksImV4cCI6MjEwMzA3Mjk2OX0.l8EMwrUxvUnzv43MaHoTp3Qmhs4G4g0lsaE0YSVqiNo",
  razorpay: {
    keyId: "rzp_test_TTHoHaB0U0buyX"
  }
};
