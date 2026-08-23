/*
  REGISTRATION FORMS — shared submit/lock logic for every <form data-reg-form="...">
  on the site. Paired with assets/data/registration.js (window.REGISTRATION_CONFIG).

  SETUP (one-time, done by a human — not by this script):
    1. Open the "REEV 4.0 Registrations" Google Sheet. Rename the default tab
       to "Team" and add 7 more tabs named exactly: Judge, Student, Mentor,
       SME, Phase1_PrevTeam, Phase1_NewTeam, Phase1_Individual. Give each tab
       the header row it was set up with (see the setup doc you were given).
    2. In that Sheet: Extensions -> Apps Script. Replace the default code
       with the Code.gs you were given, save, then Deploy -> New deployment
       -> type "Web app" -> Execute as "Me" -> Who has access "Anyone".
    3. Copy the deployment's Web App URL (ends in /exec) into
       REGISTRATION_CONFIG.endpoint in assets/data/registration.js.
    Until step 3 is done, every form below stays locked with a clear reason
    instead of silently failing.

  HOW EACH FORM IS WIRED:
    <form data-reg-form="team"> ... </form>
    - data-reg-form's value is sent as "formType" so the backend knows which
      sheet tab to append the row to.
    - Every <input>/<select>/<textarea> needs a "name" — that name becomes
      the column key sent to the sheet, so keep names matching the header
      row setup doc.
    - Native HTML `required` attributes drive the "all fields required"
      behavior — the browser won't let a visitor submit past a blank
      required field, and the code below re-checks with reportValidity()
      as a second line of defense before it ever calls fetch().
    - A `<p class="form-status" data-form-status></p>` right after the
      submit button gets the locked / submitting / success / error text.
*/
(function () {
  const cfg = window.REGISTRATION_CONFIG;
  const forms = document.querySelectorAll('form[data-reg-form]');
  if (!cfg || !forms.length) return;

  const isOpen = Date.now() >= new Date(cfg.opensAt).getTime();

  function statusEl(form) {
    return form.querySelector('[data-form-status]');
  }

  function setStatus(form, text, kind) {
    const el = statusEl(form);
    if (!el) return;
    el.textContent = text;
    el.className = 'form-status' + (kind ? ' form-status-' + kind : '');
  }

  function lockForm(form, reason) {
    form.querySelectorAll('input, select, textarea, button').forEach((el) => {
      el.disabled = true;
    });
    setStatus(form, reason, 'locked');
  }

  forms.forEach((form) => {
    if (!isOpen) {
      lockForm(form, `Registration opens ${cfg.opensAtLabel}`);
      return;
    }
    if (!cfg.endpoint) {
      lockForm(form, 'Registration isn’t connected yet — check back soon');
      return;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (!form.reportValidity()) return;

      const submitBtn = form.querySelector('button[type="submit"]');
      const data = Object.fromEntries(new FormData(form).entries());
      data.formType = form.dataset.regForm;

      if (submitBtn) submitBtn.disabled = true;
      setStatus(form, 'Submitting…', 'pending');

      fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids a CORS preflight the Apps Script doesn't handle
        body: JSON.stringify(data)
      })
        .then((res) => res.json())
        .then((res) => {
          if (res && res.ok) {
            setStatus(form, 'Thanks — you’re registered. We’ll be in touch.', 'success');
            form.reset();
          } else {
            setStatus(form, (res && res.error) || 'Something went wrong — please try again.', 'error');
          }
        })
        .catch(() => {
          setStatus(form, 'Network error — please try again in a moment.', 'error');
        })
        .finally(() => {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  });
})();
