# REEV 4.0 registration backend — one-time setup

The site's registration forms (register.html, and the Phase 1 modal on
index.html) post to a Google Apps Script Web App, which appends each
submission as a row in the **"REEV 4.0 Registrations"** Google Sheet:
https://docs.google.com/spreadsheets/d/1-0hE2gt60LVAvYnv5sCrnGQUju06xUv6UPgfLWCHRlY/edit

Do these three steps once. Nothing on the live site works until step 3 is done
— forms stay locked with a "not connected yet" message until then.

## Step 1 — Add the 8 tabs

Rename the sheet's default tab to `Team`, then add 7 more tabs with these
**exact** names (case-sensitive — the script looks them up by name):

`Judge`, `Student`, `Mentor`, `SME`, `Phase1_PrevTeam`, `Phase1_NewTeam`, `Phase1_Individual`

## Step 2 — Paste the header row into each tab

Row 1 of each tab, exactly as listed (the script appends columns in this
order — Timestamp is filled in automatically, don't type it):

| Tab | Header row (row 1) |
|---|---|
| `Team` | Timestamp, College / Institution Name, Team Name, Category, Team Size, Captain Name, Captain Email, Captain Phone, Notes |
| `Judge` | Timestamp, Full Name, Organisation, Area of Expertise, Email, Phone, Notes |
| `Student` | Timestamp, Full Name, College, Year of Study, Area of Interest, Email, Phone |
| `Mentor` | Timestamp, Full Name, Organisation/Institution, Area of Expertise, Email, Phone, Notes |
| `SME` | Timestamp, Full Name, Organisation, Area of Expertise, Email, Phone |
| `Phase1_PrevTeam` | Timestamp, College Name, Team Name (Past), Edition Competed In, Contact Name, Email, Phone |
| `Phase1_NewTeam` | Timestamp, College Name, Intended Team Name, Category, Contact Name, Email, Phone |
| `Phase1_Individual` | Timestamp, Full Name, College, Year of Study, Reason for Interest, Email, Phone |

## Step 3 — Deploy the Apps Script

1. In the Sheet: **Extensions → Apps Script**.
2. Delete whatever's in `Code.gs` and paste in the script below.
3. **Save** (Ctrl/Cmd+S).
4. **Deploy → New deployment** → gear icon → type **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
5. **Deploy**, authorize when prompted (it's your own script/sheet).
6. Copy the **Web app URL** it gives you (ends in `/exec`).
7. Paste that URL into `endpoint: ""` in
   [assets/data/registration.js](assets/data/registration.js), then push.

```javascript
/* Code.gs — REEV 4.0 registration intake.
   Bound to the "REEV 4.0 Registrations" Sheet. Receives a POST from the
   site's registration forms and appends a row to the matching tab. */

var FORM_CONFIG = {
  team: {
    sheet: 'Team',
    fields: ['collegeName', 'teamName', 'category', 'teamSize', 'captainName', 'captainEmail', 'captainPhone', 'notes'],
    required: ['collegeName', 'teamName', 'category', 'teamSize', 'captainName', 'captainEmail', 'captainPhone']
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
    fields: ['collegeName', 'teamName', 'category', 'contactName', 'email', 'phone'],
    required: ['collegeName', 'teamName', 'category', 'contactName', 'email', 'phone']
  },
  phase1Individual: {
    sheet: 'Phase1_Individual',
    fields: ['fullName', 'college', 'year', 'reason', 'email', 'phone'],
    required: ['fullName', 'college', 'year', 'reason', 'email', 'phone']
  }
};

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var config = FORM_CONFIG[data.formType];
    if (!config) return jsonOut({ ok: false, error: 'Unknown form type' });

    for (var i = 0; i < config.required.length; i++) {
      var key = config.required[i];
      if (!data[key] || String(data[key]).trim() === '') {
        return jsonOut({ ok: false, error: 'Missing required field: ' + key });
      }
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(config.sheet);
    if (!sheet) return jsonOut({ ok: false, error: 'Sheet tab not found: ' + config.sheet });

    var row = [new Date()];
    config.fields.forEach(function (f) { row.push(data[f] || ''); });
    sheet.appendRow(row);

    return jsonOut({ ok: true });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
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
