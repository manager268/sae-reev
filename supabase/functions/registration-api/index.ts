// REEV 4.0 registration intake — Supabase Edge Function.
// Deployed as "registration-api". Receives every submission from the
// site's registration forms, and for the three paid form types, also
// handles Razorpay order creation + payment verification first. Mirrors
// the old Code.gs (Apps Script) backend one-for-one — see SUPABASE_SETUP.md.
//
// Secrets this function reads from its environment (set via
// `supabase secrets set`, never committed to git — see SUPABASE_SETUP.md):
//   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by
// the Supabase runtime — you don't set those yourself.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";

// The amount actually charged. The "₹20,000" text on the site is just a
// label — this constant is the only thing that decides what gets billed,
// exactly like TEAM_FEE_PAISE did in the old Code.gs.
const TEAM_FEE_PAISE = 2000000; // ₹20,000

const PAID_FORM_TYPES = new Set(["team", "phase1PrevTeam", "phase1NewTeam"]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// service_role client — bypasses RLS by design. This is the only piece of
// code allowed to write to these tables; see schema.sql's note at the top.
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  let data: Record<string, any> = {};
  let formType = "";

  try {
    data = await req.json();

    if (data.action === "createOrder") {
      return await handleCreateOrder(data);
    }

    formType = data.formType || "(missing)";

    if (PAID_FORM_TYPES.has(formType)) {
      const verified = await verifyPayment(
        data.razorpay_order_id,
        data.razorpay_payment_id,
        data.razorpay_signature,
      );
      if (!verified) {
        await logAttempt(formType, data, "ERROR", "Payment verification failed");
        return jsonResponse({
          ok: false,
          error: `Payment verification failed. If you were charged, contact us with payment ID ${data.razorpay_payment_id || "(none)"}.`,
        });
      }
    }

    const result = await submitForm(formType, data);
    await logAttempt(formType, data, result.ok ? "OK" : "ERROR", result.ok ? "" : result.error!);
    return jsonResponse(result);
  } catch (err) {
    await logAttempt(formType, data, "ERROR", String(err));
    return jsonResponse({ ok: false, error: String(err) });
  }
});

// ---- Razorpay order creation ----------------------------------------------

async function handleCreateOrder(data: Record<string, any>) {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return jsonResponse({ ok: false, error: "Payment isn’t connected yet — check back soon." });
  }

  // Validate the registration itself — including the one-email-per-team-
  // registration check — BEFORE ever creating a Razorpay order. Nobody
  // should pay ₹20,000 only to be told afterward their email was already
  // used or a required field was missing.
  const formType = data.formType || "";
  const validation = await validateTeamRegistration(formType, data);
  if (!validation.ok) return jsonResponse(validation);

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`),
    },
    body: JSON.stringify({
      amount: TEAM_FEE_PAISE,
      currency: "INR",
      receipt: "reev4-" + Date.now(),
      payment_capture: 1,
    }),
  });
  const body = await res.json();
  if (!res.ok || !body.id) {
    return jsonResponse({ ok: false, error: body?.error?.description || "Could not start payment." });
  }
  return jsonResponse({ ok: true, orderId: body.id, amount: body.amount, currency: body.currency });
}

// Razorpay's documented verification formula: HMAC-SHA256 of
// "order_id|payment_id" using the Key Secret must equal the signature
// Razorpay's Checkout widget handed back. This is what actually proves a
// payment happened — never trust a client claiming "I paid" without it.
async function verifyPayment(orderId?: string, paymentId?: string, signature?: string) {
  if (!orderId || !paymentId || !signature || !RAZORPAY_KEY_SECRET) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(RAZORPAY_KEY_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${orderId}|${paymentId}`));
  const expected = Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === signature;
}

// ---- Submission handling ---------------------------------------------------

type SubmitResult = { ok: true } | { ok: false; error: string };

function missingField(data: Record<string, any>, keys: string[]): string | null {
  for (const k of keys) {
    if (!data[k] || String(data[k]).trim() === "") return `Missing required field: ${k}`;
  }
  return null;
}

function parseParticipants(json?: string): Array<{ name: string; branch?: string; year?: string; email?: string; phone?: string }> {
  try {
    const arr = JSON.parse(json || "[]");
    return Array.isArray(arr) ? arr.filter((m: any) => m && m.name) : [];
  } catch {
    return [];
  }
}

// One email per registration TYPE, not globally — the same address can be
// a team contact and also a judge/mentor/etc, just not submit the same
// form twice. True Postgres unique indexes (see supabase/email_uniqueness.sql)
// are the hard guarantee; this is a friendly pre-check so a paying team
// isn't charged only to be told afterward, and duplicateEmailError() below
// is the matching last-resort catch on the actual insert (covers the race
// between two people submitting the same email at the same instant).
function isUniqueViolation(error: any): boolean {
  return !!error && error.code === "23505";
}

function duplicateEmailError(label: string): SubmitResult {
  return {
    ok: false,
    error: `This email has already been used to register as a ${label} for REEV 4.0. If you believe this is a mistake, contact us.`,
  };
}

async function emailAlreadyUsed(table: string, column: string, email: string): Promise<boolean | SubmitResult> {
  const { data: existing, error } = await supabase.from(table).select("id").eq(column, email).limit(1);
  if (error) return { ok: false, error: error.message };
  return !!(existing && existing.length);
}

// Shared by both the pre-payment check (handleCreateOrder) and the actual
// write (submitTeamRegistration), so the two can never drift out of sync.
async function validateTeamRegistration(formType: string, data: Record<string, any>): Promise<SubmitResult> {
  const contactName = data.captainName || data.contactName;
  const contactEmail = data.captainEmail || data.email;
  const contactPhone = data.captainPhone || data.phone;

  const requiredBase = ["collegeName", "teamName"];
  if (formType === "phase1PrevTeam") requiredBase.push("edition");
  const err = missingField(data, requiredBase) ||
    (!contactName ? "Missing required field: contact name" : null) ||
    (!contactEmail ? "Missing required field: email" : null) ||
    (!contactPhone ? "Missing required field: phone" : null);
  if (err) return { ok: false, error: err };

  const used = await emailAlreadyUsed("team_registrations", "contact_email", contactEmail);
  if (typeof used === "object") return used; // lookup itself errored
  if (used) return duplicateEmailError("team");

  return { ok: true };
}

async function submitForm(formType: string, data: Record<string, any>): Promise<SubmitResult> {
  switch (formType) {
    case "team":
    case "phase1PrevTeam":
    case "phase1NewTeam":
      return submitTeamRegistration(formType, data);
    case "judge": {
      const err = missingField(data, ["fullName", "organisation", "expertise", "email", "phone"]);
      if (err) return { ok: false, error: err };
      const used = await emailAlreadyUsed("judges", "email", data.email);
      if (typeof used === "object") return used;
      if (used) return duplicateEmailError("judge");
      const { error } = await supabase.from("judges").insert({
        full_name: data.fullName,
        organisation: data.organisation,
        expertise: data.expertise,
        email: data.email,
        phone: data.phone,
        notes: data.notes || null,
      });
      if (error) return isUniqueViolation(error) ? duplicateEmailError("judge") : { ok: false, error: error.message };
      return { ok: true };
    }
    case "techteamStudent": {
      const err = missingField(data, ["fullName", "college", "year", "interest", "email", "phone"]);
      if (err) return { ok: false, error: err };
      const used = await emailAlreadyUsed("student_volunteers", "email", data.email);
      if (typeof used === "object") return used;
      if (used) return duplicateEmailError("student volunteer");
      const { error } = await supabase.from("student_volunteers").insert({
        full_name: data.fullName,
        college: data.college,
        year: data.year,
        interest: data.interest,
        email: data.email,
        phone: data.phone,
      });
      if (error) return isUniqueViolation(error) ? duplicateEmailError("student volunteer") : { ok: false, error: error.message };
      return { ok: true };
    }
    case "techteamMentor": {
      const err = missingField(data, ["fullName", "organisation", "expertise", "email", "phone"]);
      if (err) return { ok: false, error: err };
      const used = await emailAlreadyUsed("mentors", "email", data.email);
      if (typeof used === "object") return used;
      if (used) return duplicateEmailError("mentor");
      const { error } = await supabase.from("mentors").insert({
        full_name: data.fullName,
        organisation: data.organisation,
        expertise: data.expertise,
        email: data.email,
        phone: data.phone,
        notes: data.notes || null,
      });
      if (error) return isUniqueViolation(error) ? duplicateEmailError("mentor") : { ok: false, error: error.message };
      return { ok: true };
    }
    case "techteamSme": {
      const err = missingField(data, ["fullName", "organisation", "expertise", "email", "phone"]);
      if (err) return { ok: false, error: err };
      const used = await emailAlreadyUsed("smes", "email", data.email);
      if (typeof used === "object") return used;
      if (used) return duplicateEmailError("SME");
      const { error } = await supabase.from("smes").insert({
        full_name: data.fullName,
        organisation: data.organisation,
        expertise: data.expertise,
        email: data.email,
        phone: data.phone,
      });
      if (error) return isUniqueViolation(error) ? duplicateEmailError("SME") : { ok: false, error: error.message };
      return { ok: true };
    }
    case "phase1Individual": {
      const err = missingField(data, ["fullName", "college", "year", "reason", "email", "phone"]);
      if (err) return { ok: false, error: err };
      const used = await emailAlreadyUsed("individuals", "email", data.email);
      if (typeof used === "object") return used;
      if (used) return duplicateEmailError("individual");
      const { error } = await supabase.from("individuals").insert({
        full_name: data.fullName,
        college: data.college,
        year: data.year,
        reason: data.reason,
        email: data.email,
        phone: data.phone,
      });
      if (error) return isUniqueViolation(error) ? duplicateEmailError("individual") : { ok: false, error: error.message };
      return { ok: true };
    }
    default:
      return { ok: false, error: "Unknown form type" };
  }
}

async function submitTeamRegistration(formType: string, data: Record<string, any>): Promise<SubmitResult> {
  const registrationType = formType === "team" ? "team" : formType === "phase1PrevTeam" ? "phase1_prev_team" : "phase1_new_team";

  const contactName = data.captainName || data.contactName;
  const contactEmail = data.captainEmail || data.email;
  const contactPhone = data.captainPhone || data.phone;

  // Re-validates (including the email-already-used check) even though
  // handleCreateOrder already did this before payment — cheap, and closes
  // the race where two people submit the same email at nearly the same
  // instant. The unique index catch just below is the final backstop.
  const validation = await validateTeamRegistration(formType, data);
  if (!validation.ok) return validation;

  // Reaching here means: for team/phase1PrevTeam/phase1NewTeam, doPost's
  // caller has already verified the Razorpay signature — this row only
  // gets created for a genuinely paid registration.
  const members = parseParticipants(data.participants);

  // Payment row goes in FIRST, deliberately, and on its own (team_registration_id
  // null for now) — this is what payments_razorpay_payment_id_key (see
  // supabase/payment_idempotency.sql) actually protects. If this exact
  // payment was already used for a registration (retry after a network
  // blip, accidental double-submit, etc.), this insert fails fast on that
  // unique constraint and nothing else below runs — no duplicate
  // registration gets created for one real charge.
  const { data: paymentRow, error: paymentErr } = await supabase
    .from("payments")
    .insert({
      razorpay_order_id: data.razorpay_order_id,
      razorpay_payment_id: data.razorpay_payment_id,
      razorpay_signature: data.razorpay_signature,
      amount_paise: TEAM_FEE_PAISE,
      status: "verified",
      verified_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (paymentErr) {
    if (paymentErr.code === "23505") {
      // unique_violation on razorpay_payment_id — this payment already
      // completed a registration once.
      return {
        ok: false,
        error: "This payment has already been used to complete a registration. If you believe this is a mistake, contact us with payment ID " +
          (data.razorpay_payment_id || "(none)") + ".",
      };
    }
    return { ok: false, error: paymentErr.message };
  }

  const { data: row, error } = await supabase
    .from("team_registrations")
    .insert({
      registration_type: registrationType,
      college_name: data.collegeName,
      team_name: data.teamName,
      edition: data.edition || null,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      team_size: Number(data.teamSize) || members.length + 1,
      notes: data.notes || null,
      payment_status: "paid",
      payment_id: data.razorpay_payment_id,
      amount_paid_inr: TEAM_FEE_PAISE / 100,
    })
    .select()
    .single();

  // Payment is already safely recorded above even if anything from here
  // down fails — it just won't be linked to a registration yet. That's a
  // real payment needing a manual look via the payments audit trail
  // (never a lost/unrecorded charge), not a silent failure.
  if (error) {
    return isUniqueViolation(error) ? duplicateEmailError("team") : { ok: false, error: error.message };
  }

  if (members.length) {
    const { error: memberErr } = await supabase.from("team_members").insert(
      members.map((m) => ({
        team_registration_id: row.id,
        name: m.name,
        branch: m.branch || null,
        year: m.year || null,
        email: m.email || null,
        phone: m.phone || null,
      })),
    );
    if (memberErr) return { ok: false, error: memberErr.message };
  }

  const { error: linkErr } = await supabase
    .from("payments")
    .update({ team_registration_id: row.id })
    .eq("id", paymentRow.id);
  if (linkErr) return { ok: false, error: linkErr.message };

  return { ok: true };
}

// ---- Logging ----------------------------------------------------------------

async function logAttempt(formType: string, data: Record<string, any>, status: string, error: string) {
  try {
    await supabase.from("submission_logs").insert({
      form_type: formType,
      status,
      error_message: error || null,
      raw_payload: data,
    });
  } catch {
    // never let logging break a real submission
  }
}
