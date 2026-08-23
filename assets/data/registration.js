/*
  REGISTRATION LINKS — configuration for every "Register" button on the site.
  -----------------------------------------------------------------------------
  Two things live here:

  1. opensAt / opensAtLabel
     Registration stays LOCKED (buttons greyed out, unclickable) until this
     moment, then unlocks automatically — no manual flip needed on the day.
       - opensAt is compared against the visitor's clock, so keep it in ISO
         format with an explicit timezone offset. IST is +05:30.
       - opensAtLabel is just the human-readable text shown next to locked
         buttons ("Registration opens 25 Aug 2026"). Keep the two in sync.

  2. links
     Once opensAt has passed, each button below is filled in from here.
       - Paste the Google Form URL as the value (e.g. "https://forms.gle/xxxx").
       - Leave a value as "" (empty string) and that button stays locked with
         a "link coming soon" note, even after opensAt — so it's safe to open
         registration before every form is ready.
       - Every key below already has a button wired to it (see register.html
         and index.html) — don't rename keys unless you update the matching
         data-reg-link="..." attribute in the HTML too.
*/
window.REGISTRATION_CONFIG = {
  opensAt: "2026-08-25T00:00:00+05:30",
  opensAtLabel: "25 Aug 2026",

  links: {
    // register.html — "Register a Team" tab
    team: "",

    // register.html — "Register as a Judge" tab
    judge: "",

    // register.html — "Tech Team / Volunteer" tab
    techteamStudent: "",   // Student / Volunteer card
    techteamMentor: "",    // Faculty & Industry Mentor card
    techteamSme: "",       // Subject Matter Expert card

    // index.html — "Register your college" (Phase 1) modal
    phase1PrevTeam: "",    // Previously participated team
    phase1NewTeam: "",     // New / upcoming team
    phase1Individual: ""   // Individual, not yet attached to a team
  }
};