/*
  TEAM FORM STEP WIZARD — splits the Team form (register.html) into two
  visual steps within the SAME <form> element (Next/Back just toggle
  which [data-form-step] is hidden; nothing is removed from the DOM, so
  team-members.js and registration-form.js's normal FormData-based submit
  both keep working unmodified — this file only handles navigation and the
  New/Previously-participated-team toggle).

  Markup contract (see register.html):
    <div class="step-indicator">
      <span class="step-dot" data-step-dot="1">...</span>
      <span class="step-dot" data-step-dot="2">...</span>
    </div>
    <div data-form-step="1"> ... <button data-step-next> ... </div>
    <div data-form-step="2" hidden> ... <button data-step-back> ...
      <button type="submit"> ... </div>

    <input type="radio" name="teamStatus" value="new" data-team-status checked>
    <input type="radio" name="teamStatus" value="previous" data-team-status>
    <div data-edition-field hidden><input name="edition"></div>

  Validation split: clicking Next only checks step 1's own fields
  (:invalid, scoped to that step's container) — never the whole form. This
  avoids the browser's "can't reportValidity() on a hidden field" error
  that would happen if step 2's required fields were checked while still
  hidden. By the time the real submit button is clicked, step 2 is visible
  and step 1's fields are already valid, so the normal whole-form
  validation in registration-form.js works exactly as it does for every
  other form on the site — nothing there needed to change.
*/
(function () {
  document.querySelectorAll('form[data-reg-form="team"]').forEach((form) => {
    const steps = form.querySelectorAll('[data-form-step]');
    if (!steps.length) return;
    const dots = form.querySelectorAll('[data-step-dot]');

    function goToStep(n) {
      steps.forEach((s) => { s.hidden = s.dataset.formStep !== String(n); });
      dots.forEach((d) => { d.classList.toggle('active', d.dataset.stepDot === String(n)); });
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const nextBtn = form.querySelector('[data-step-next]');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const step1 = form.querySelector('[data-form-step="1"]');
        const invalid = step1.querySelector(':invalid');
        if (invalid) {
          invalid.reportValidity();
          invalid.focus();
          return;
        }
        goToStep(2);
      });
    }

    const backBtn = form.querySelector('[data-step-back]');
    if (backBtn) backBtn.addEventListener('click', () => goToStep(1));

    // New team / Previously participated team -> show + require "which
    // edition" only for the latter. registration-form.js reads this same
    // teamStatus value to pick the right backend formType (see its
    // "TEAM STATUS -> formType" section).
    const editionField = form.querySelector('[data-edition-field]');
    const editionInput = editionField ? editionField.querySelector('input') : null;
    form.querySelectorAll('[data-team-status]').forEach((radio) => {
      radio.addEventListener('change', () => {
        const isPrevious = form.querySelector('[data-team-status]:checked')?.value === 'previous';
        if (editionField) editionField.hidden = !isPrevious;
        if (editionInput) editionInput.required = isPrevious;
      });
    });
  });
})();
