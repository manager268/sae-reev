# REEV 4.0 registration backend — one-time setup

The site's registration forms (register.html, and the Phase 1 modal on
index.html) post to a Google Apps Script Web App, which appends each
submission as a row in the **"REEV 4.0 Registrations"** Google Sheet:
https://docs.google.com/spreadsheets/d/1-0hE2gt60LVAvYnv5sCrnGQUju06xUv6UPgfLWCHRlY/edit

> **Already deployed this before and just need the latest update?**
> Everything below (header rows + Code.gs) is the full current state, not a
> diff — re-paste `Code.gs` in full and redeploy (Step 3) rather than
> hand-editing your existing copy, then fix up the tabs per the callouts
> below. Skip Steps 1/1a if you already have all the tabs.
>
> **Category (REEV / e-Baja) removed**: delete the `Category` column from
> `Team`/`Phase1_NewTeam` if you still have it, shifting later columns left.
>
> **Team roster added**: `Team`, `Phase1_PrevTeam` and `Phase1_NewTeam` now
> collect every team member (not just a headcount) — add `Team Size` and
> `Participants` columns to whichever of the three don't have them yet.
>
> **⚠️ Payment added — read this one**: `Team`, `Phase1_PrevTeam` and
> `Phase1_NewTeam` now require a ₹20,000 Razorpay payment before they'll
> submit at all. This needs your Razorpay **Key ID** and **Key Secret** —
> see [Step 4](#step-4--connect-razorpay) — and three more columns on
> those same tabs: `Payment Status`, `Payment ID`, `Amount Paid (₹)`.

Do these steps once. Nothing on the live site works until Step 3 is done —
forms stay locked with a "not connected yet" message until then. The three
paid forms specifically also need Step 4 before they'll accept a submission.

## Step 1 — Add the 8 category tabs

Rename the sheet's default tab to `Team`, then add 7 more tabs with these
**exact** names (case-sensitive — the script looks them up by name):

`Judge`, `Student`, `Mentor`, `SME`, `Phase1_PrevTeam`, `Phase1_NewTeam`, `Phase1_Individual`

## Step 1a — Add the `Logs` tab (backup + audit trail)

Add one more tab named exactly `Logs`. Unlike the 8 category tabs, this one
gets a row for **every** submission attempt — successful or not — with the
full raw data that was submitted. It serves two purposes:

- **Backup**: since it captures every field from every form in one place, it's
  a complete second copy of every participant, independent of the 8 category
  tabs (so if a category tab ever gets accidentally edited or a row deleted,
  the data still exists here).
- **Log**: failed attempts (a network hiccup, a bad form type, a failed
  payment, a script error) show up here with the error message, even though
  nothing was written to the category tab — so nothing silently vanishes
  without a trace.

## Step 2 — Paste the header row into each tab

Row 1 of each tab, exactly as listed (the script appends columns in this
order — Timestamp is filled in automatically, don't type it):

| Tab | Header row (row 1) |
|---|---|
| `Team` | Timestamp, College / Institution Name, Team Name, Team Size, Captain Name, Captain Email, Captain Phone, Participants, Notes, Payment Status, Payment ID, Amount Paid (₹) |
| `Judge` | Timestamp, Full Name, Organisation, Area of Expertise, Email, Phone, Notes |
| `Student` | Timestamp, Full Name, College, Year of Study, Area of Interest, Email, Phone |
| `Mentor` | Timestamp, Full Name, Organisation/Institution, Area of Expertise, Email, Phone, Notes |
| `SME` | Timestamp, Full Name, Organisation, Area of Expertise, Email, Phone |
| `Phase1_PrevTeam` | Timestamp, College Name, Team Name (Past), Edition Competed In, Contact Name, Email, Phone, Team Size, Participants, Payment Status, Payment ID, Amount Paid (₹) |
| `Phase1_NewTeam` | Timestamp, College Name, Intended Team Name, Contact Name, Email, Phone, Team Size, Participants, Payment Status, Payment ID, Amount Paid (₹) |
| `Phase1_Individual` | Timestamp, Full Name, College, Year of Study, Reason for Interest, Email, Phone |
| `Logs` | Timestamp, Form Type, Status, Error, Raw Data (JSON) |

## Step 3 — Deploy the Apps Script

1. In the Sheet: **Extensions → Apps Script**.
2. Delete whatever's in `Code.gs` and paste in the script below.
3. Near the top, fill in `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` — see
   [Step 4](#step-4--connect-razorpay) for where to get them. You can leave
   them blank for now and come back — the three paid forms just stay locked
   with a "payment isn't connected yet" message until both are filled in.
4. **Save** (Ctrl/Cmd+S).
5. First time deploying: **Deploy → New deployment** → gear icon → type
   **Web app** → Execute as **Me** → Who has access **Anyone** → **Deploy**,
   authorize when prompted, then copy the **Web app URL** (ends in `/exec`)
   into `endpoint: ""` in
   [assets/data/registration.js](assets/data/registration.js), then push.
   Already deployed before? Just redeploy the existing one — see the note
   at the bottom, your URL doesn't change.

```javascript
/* Code.gs — REEV 4.0 registration intake.
   Bound to the "REEV 4.0 Registrations" Sheet. Receives a POST from the
   site's registration forms, appends a row to the matching category tab,
   logs every attempt (success or failure) to the "Logs" tab, and for the
   three paid form types, creates/verifies a Razorpay payment first. */

// ⚠️ Fill these in, then NEVER paste them anywhere outside this script
// editor — not in the git repo, not in a chat, not in a screenshot.
// RAZORPAY_KEY_ID is the *public* one (also goes in assets/data/registration.js
// — that's fine, it's meant to be public). RAZORPAY_KEY_SECRET is the
// private one; it must only ever live here.
var RAZORPAY_KEY_ID = '';
var RAZORPAY_KEY_SECRET = '';
var TEAM_FEE_PAISE = 2000000; // ₹20,000 — the amount actually charged. The
                               // client-side "₹20,000" text is just a label;
                               // this constant is what's enforced.

var FORM_CONFIG = {
  team: {
    sheet: 'Team',
    fields: ['collegeName', 'teamName', 'teamSize', 'captainName', 'captainEmail', 'captainPhone', 'participants', 'notes'],
    required: ['collegeName', 'teamName', 'teamSize', 'captainName', 'captainEmail', 'captainPhone']
  },
  judge: {
    sheet: 'Judge',
    fields: ['fullName', 'organisation', 'expertise', 'email', 'phone', 'notes'],
    required: ['fullName', 'organisation', 'expertise', 'email', 'phone']
  },
  techteamStudent: {
    sheet: 'Student',
    fields: ['fullName', 'college', 'year', 'interest', 'email', 'phone'],
    required: ['fullName', 'college', 'year', 'interest', 'email', 'phone']
  },
  techteamMentor: {
    sheet: 'Mentor',
    fields: ['fullName', 'organisation', 'expertise', 'email', 'phone', 'notes'],
    required: ['fullName', 'organisation', 'expertise', 'email', 'phone']
  },
  techteamSme: {
    sheet: 'SME',
    fields: ['fullName', 'organisation', 'expertise', 'email', 'phone'],
    required: ['fullName', 'organisation', 'expertise', 'email', 'phone']
  },
  phase1PrevTeam: {
    sheet: 'Phase1_PrevTeam',
    fields: ['collegeName', 'teamName', 'edition', 'contactName', 'email', 'phone', 'teamSize', 'participants'],
    required: ['collegeName', 'teamName', 'edition', 'contactName', 'email', 'phone']
  },
  phase1NewTeam: {
    sheet: 'Phase1_NewTeam',
    fields: ['collegeName', 'teamName', 'contactName', 'email', 'phone', 'teamSize', 'participants'],
    required: ['collegeName', 'teamName', 'contactName', 'email', 'phone']
  },
  phase1Individual: {
    sheet: 'Phase1_Individual',
    fields: ['fullName', 'college', 'year', 'reason', 'email', 'phone'],
    required: ['fullName', 'college', 'year', 'reason', 'email', 'phone']
  }
};

var LOG_SHEET_NAME = 'Logs';
var PAID_FORM_TYPES = ['team', 'phase1PrevTeam', 'phase1NewTeam'];

function doPost(e) {
  var data = {};
  var formType = '';
  try {
    data = JSON.parse(e.postData.contents);

    // Step 1 of the paid flow: the form asks for a Razorpay order before
    // it ever collects a "submission" — no sheet involvement yet.
    if (data.action === 'createOrder') {
      return handleCreateOrder(data);
    }

    formType = data.formType || '(missing)';
    var config = FORM_CONFIG[formType];
    if (!config) {
      logAttempt(formType, data, 'ERROR', 'Unknown form type');
      return jsonOut({ ok: false, error: 'Unknown form type' });
    }

    // Step 2 of the paid flow: this submission must carry a real, verified
    // Razorpay payment before anything gets written to the sheet.
    if (PAID_FORM_TYPES.indexOf(formType) !== -1) {
      var verified = verifyPayment(data.razorpay_order_id, data.razorpay_payment_id, data.razorpay_signature);
      if (!verified) {
        logAttempt(formType, data, 'ERROR', 'Payment verification failed');
        return jsonOut({ ok: false, error: 'Payment verification failed. If you were charged, contact us with payment ID ' + (data.razorpay_payment_id || '(none)') + '.' });
      }
    }

    for (var i = 0; i < config.required.length; i++) {
      var key = config.required[i];
      if (!data[key] || String(data[key]).trim() === '') {
        logAttempt(formType, data, 'ERROR', 'Missing required field: ' + key);
        return jsonOut({ ok: false, error: 'Missing required field: ' + key });
      }
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(config.sheet);
    if (!sheet) {
      logAttempt(formType, data, 'ERROR', 'Sheet tab not found: ' + config.sheet);
      return jsonOut({ ok: false, error: 'Sheet tab not found: ' + config.sheet });
    }

    var row = [new Date()];
    config.fields.forEach(function (f) {
      var val = data[f] || '';
      if (f === 'participants') val = formatParticipants(val);
      row.push(val);
    });
    if (PAID_FORM_TYPES.indexOf(formType) !== -1) {
      row.push('Paid');
      row.push(data.razorpay_payment_id || '');
      row.push(TEAM_FEE_PAISE / 100);
    }
    sheet.appendRow(row);

    logAttempt(formType, data, 'OK', '');
    return jsonOut({ ok: true });
  } catch (err) {
    logAttempt(formType, data, 'ERROR', String(err));
    return jsonOut({ ok: false, error: String(err) });
  }
}

// Creates a Razorpay order for the fixed team fee and hands back just
// enough for the browser to open Razorpay's Checkout widget. The amount
// is never taken from the client — TEAM_FEE_PAISE above is the only
// source of truth for how much gets charged.
function handleCreateOrder(data) {
  try {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return jsonOut({ ok: false, error: 'Payment isn’t connected yet — check back soon.' });
    }
    var payload = {
      amount: TEAM_FEE_PAISE,
      currency: 'INR',
      receipt: 'reev4-' + new Date().getTime(),
      payment_capture: 1
    };
    var res = UrlFetchApp.fetch('https://api.razorpay.com/v1/orders', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      headers: { Authorization: 'Basic ' + Utilities.base64Encode(RAZORPAY_KEY_ID + ':' + RAZORPAY_KEY_SECRET) },
      muteHttpExceptions: true
    });
    var body = JSON.parse(res.getContentText());
    if (res.getResponseCode() !== 200 || !body.id) {
      return jsonOut({ ok: false, error: (body.error && body.error.description) || 'Could not start payment.' });
    }
    return jsonOut({ ok: true, orderId: body.id, amount: body.amount, currency: body.currency });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

// Razorpay's documented verification formula: HMAC-SHA256 of
// "order_id|payment_id" using your Key Secret must equal the signature
// Razorpay's Checkout widget handed back. This is what actually proves a
// payment happened — never trust a client claiming "I paid" without it.
function verifyPayment(orderId, paymentId, signature) {
  if (!orderId || !paymentId || !signature || !RAZORPAY_KEY_SECRET) return false;
  var expected = toHex(Utilities.computeHmacSha256Signature(orderId + '|' + paymentId, RAZORPAY_KEY_SECRET));
  return expected === signature;
}

function toHex(bytes) {
  return bytes.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

// Turns the team-roster forms' participants JSON (an array of {name,
// branch, year, email, phone}) into a readable numbered list for the
// sheet cell, e.g.:
//   1. Asha Rao — CSE — Yr 3 — asha@x.com — 98765xxxxx
//   2. ...
// Falls back to the raw string if it isn't valid JSON for any reason.
function formatParticipants(json) {
  try {
    var members = JSON.parse(json || '[]');
    if (!members.length) return '';
    return members.map(function (m, i) {
      var parts = [m.name];
      if (m.branch) parts.push(m.branch);
      if (m.year) parts.push('Yr ' + m.year);
      if (m.email) parts.push(m.email);
      if (m.phone) parts.push(m.phone);
      return (i + 1) + '. ' + parts.join(' — ');
    }).join('\n');
  } catch (err) {
    return json || '';
  }
}

// Records every attempt — success or failure — to the Logs tab. Never lets
// a logging problem break the actual submission; if the Logs tab is
// missing or anything goes wrong here, it just skips logging silently.
function logAttempt(formType, data, status, error) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var logSheet = ss.getSheetByName(LOG_SHEET_NAME);
    if (!logSheet) return;
    logSheet.appendRow([new Date(), formType, status, error, JSON.stringify(data)]);
  } catch (loggingErr) {
    // swallow — logging must never take down a real submission
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### Re-deploying after you edit Code.gs

Apps Script Web App URLs don't change on their own, but a code edit isn't
live until you redeploy: **Deploy → Manage deployments → edit (pencil) →
Version: New version → Deploy**. (A brand new deployment would give you a
*different* URL — only do that if you want to retire the old one.)

## Step 4 — Connect Razorpay

1. Log into your Razorpay dashboard → **Settings → API Keys**.
2. Generate/copy a **Key ID** and **Key Secret**. Start in **Test Mode**
   (toggle top-right of the dashboard) so you can rehearse the whole flow
   with Razorpay's test cards/UPI before ever touching real money — Test
   Mode keys look like `rzp_test_...`, Live Mode keys like `rzp_live_...`.
3. **Key ID** goes in **two** places (it's public, safe to publish):
   - `RAZORPAY_KEY_ID` in `Code.gs` (Step 3)
   - `razorpay.keyId` in [assets/data/registration.js](assets/data/registration.js), then push
4. **Key Secret** goes in **exactly one** place, and it is private:
   - `RAZORPAY_KEY_SECRET` in `Code.gs` only.
   - **Never** put it in `registration.js`, this doc, a commit, or anywhere
     else that reaches the git repo or a chat — Code.gs lives on Google's
     servers, not in git, and that's the only safe place for it.
5. Redeploy Code.gs (see above) so the new keys take effect.
6. Test with registration temporarily unlocked (ask to have `opensAt`
   moved back) using [Razorpay's test card/UPI numbers](https://razorpay.com/docs/payments/payments/test-card-upi-details/)
   — confirm a row lands in `Team` (or whichever tab) with Payment Status
   "Paid" and a real Payment ID, then switch to Live Mode keys when ready
   for real registrations (repeat steps 2-5 with the live keys).

## Extra safety net you already have for free

Google Sheets keeps its own **version history** independent of all of the
above — **File → Version history → See version history** — every past state
of the whole spreadsheet, restorable with one click. Worth knowing about,
no setup required.
