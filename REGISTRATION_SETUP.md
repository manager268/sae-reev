# REEV 4.0 registration backend — one-time setup

The site's registration forms (register.html, and the Phase 1 modal on
index.html) post to a Google Apps Script Web App, which appends each
submission as a row in the **"REEV 4.0 Registrations"** Google Sheet:
https://docs.google.com/spreadsheets/d/1-0hE2gt60LVAvYnv5sCrnGQUju06xUv6UPgfLWCHRlY/edit

> **Already deployed this before and just need the backup/logging update?**
> Skip to [Step 1a](#step-1a--add-the-logs-tab-backup--audit-trail) and
> [Step 3](#step-3--deploy-the-apps-script) — those are the only two things
> that changed. Everything else below is unchanged from the original setup.
>
> **Also already have `Team` and `Phase1_NewTeam` tabs set up?** The "Category"
> (REEV / e-Baja) question was removed from both forms. Delete the `Category`
> column from those two tabs' header rows (and shift the columns after it
> left, so they still line up with the field order in the table below), then
> redeploy per Step 3 — the field order in the script has to match the sheet.

Do these steps once. Nothing on the live site works until step 3 is done —
forms stay locked with a "not connected yet" message until then.

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
- **Log**: failed attempts (a network hiccup, a bad form type, a script error)
  show up here with the error message, even though nothing was written to
  the category tab — so nothing silently vanishes without a trace.

## Step 2 — Paste the header row into each tab

Row 1 of each tab, exactly as listed (the script appends columns in this
order — Timestamp is filled in automatically, don't type it):

| Tab | Header row (row 1) |
|---|---|
| `Team` | Timestamp, College / Institution Name, Team Name, Team Size, Captain Name, Captain Email, Captain Phone, Notes |
| `Judge` | Timestamp, Full Name, Organisation, Area of Expertise, Email, Phone, Notes |
| `Student` | Timestamp, Full Name, College, Year of Study, Area of Interest, Email, Phone |
| `Mentor` | Timestamp, Full Name, Organisation/Institution, Area of Expertise, Email, Phone, Notes |
| `SME` | Timestamp, Full Name, Organisation, Area of Expertise, Email, Phone |
| `Phase1_PrevTeam` | Timestamp, College Name, Team Name (Past), Edition Competed In, Contact Name, Email, Phone |
| `Phase1_NewTeam` | Timestamp, College Name, Intended Team Name, Contact Name, Email, Phone |
| `Phase1_Individual` | Timestamp, Full Name, College, Year of Study, Reason for Interest, Email, Phone |
| `Logs` | Timestamp, Form Type, Status, Error, Raw Data (JSON) |

## Step 3 — Deploy the Apps Script

1. In the Sheet: **Extensions → Apps Script**.
2. Delete whatever's in `Code.gs` and paste in the script below.
3. **Save** (Ctrl/Cmd+S).
4. First time deploying: **Deploy → New deployment** → gear icon → type
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
   and logs every attempt (success or failure) to the "Logs" tab. */

var FORM_CONFIG = {
  team: {
    sheet: 'Team',
    fields: ['collegeName', 'teamName', 'teamSize', 'captainName', 'captainEmail', 'captainPhone', 'notes'],
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
    fields: ['collegeName', 'teamName', 'edition', 'contactName', 'email', 'phone'],
    required: ['collegeName', 'teamName', 'edition', 'contactName', 'email', 'phone']
  },
  phase1NewTeam: {
    sheet: 'Phase1_NewTeam',
    fields: ['collegeName', 'teamName', 'contactName', 'email', 'phone'],
    required: ['collegeName', 'teamName', 'contactName', 'email', 'phone']
  },
  phase1Individual: {
    sheet: 'Phase1_Individual',
    fields: ['fullName', 'college', 'year', 'reason', 'email', 'phone'],
    required: ['fullName', 'college', 'year', 'reason', 'email', 'phone']
  }
};

var LOG_SHEET_NAME = 'Logs';

function doPost(e) {
  var data = {};
  var formType = '';
  try {
    data = JSON.parse(e.postData.contents);
    formType = data.formType || '(missing)';
    var config = FORM_CONFIG[formType];
    if (!config) {
      logAttempt(formType, data, 'ERROR', 'Unknown form type');
      return jsonOut({ ok: false, error: 'Unknown form type' });
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
    config.fields.forEach(function (f) { row.push(data[f] || ''); });
    sheet.appendRow(row);

    logAttempt(formType, data, 'OK', '');
    return jsonOut({ ok: true });
  } catch (err) {
    logAttempt(formType, data, 'ERROR', String(err));
    return jsonOut({ ok: false, error: String(err) });
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

## Extra safety net you already have for free

Google Sheets keeps its own **version history** independent of all of the
above — **File → Version history → See version history** — every past state
of the whole spreadsheet, restorable with one click. Worth knowing about,
no setup required.
