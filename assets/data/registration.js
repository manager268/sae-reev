/*
  REGISTRATION — configuration for every on-site registration form.
  -----------------------------------------------------------------------------
  1. opensAt / opensAtLabel
     Every registration form stays LOCKED (fields disabled, submit blocked)
     until this moment, then unlocks automatically — no manual flip needed.
       - opensAt is compared against the visitor's clock, so keep it in ISO
         format with an explicit timezone offset. IST is +05:30.
       - opensAtLabel is the human-readable text shown on locked forms.

  2. endpoint
     The Google Apps Script Web App URL that receives every form's
     submission and appends a row to the matching tab of the
     "REEV 4.0 Registrations" Google Sheet. Leave it "" and every form
     stays locked with a "registration isn't connected yet" note, even
     after opensAt — so it's safe to open the site before the backend
     is deployed.
       - Deploy the Apps Script (see js/registration-form.js header
         comment / the setup doc you were given) and paste the resulting
         .../exec URL here.
       - One endpoint serves all 8 forms — each form sends its own
         formType (team, judge, techteamStudent, techteamMentor,
         techteamSme, phase1PrevTeam, phase1NewTeam, phase1Individual)
         so the script knows which sheet tab to append to.
*/
window.REGISTRATION_CONFIG = {
  opensAt: "2026-08-25T00:00:00+05:30",
  opensAtLabel: "25 Aug 2026",
  endpoint: "https://script.google.com/macros/s/AKfycby9l4SXWkBPEVTOPsXZ3ZwIxeI6yViEEO8pjpqKeOG7aXdrr__95BzukcSw7uf5JkuqqQ/exec"
};
