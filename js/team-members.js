/*
  TEAM MEMBERS — repeatable participant rows on the Team registration form
  (register.html, form[data-reg-form="team"]).

  Each row (cloned from #team-member-template) captures one member's name,
  branch, year, email and phone. On every change, this:
    - filters out empty rows (no name entered yet)
    - serializes the rest as JSON into the hidden "participants" field, which
      travels to the backend like any other form field
    - recomputes "Team size (incl. captain)" as member-rows-with-a-name + 1

  The backend (Code.gs, see REGISTRATION_SETUP.md) parses that JSON and
  writes a readable numbered list into the sheet's Participants column.
*/
(function () {
  const form = document.querySelector('form[data-reg-form="team"]');
  if (!form) return;

  const template = document.getElementById('team-member-template');
  const list = form.querySelector('[data-member-list]');
  const addBtn = form.querySelector('[data-member-add]');
  const participantsInput = form.querySelector('[data-participants-json]');
  const teamSizeInput = form.querySelector('[data-team-size]');
  if (!template || !list || !addBtn || !participantsInput || !teamSizeInput) return;

  function addRow() {
    const row = template.content.firstElementChild.cloneNode(true);
    row.querySelector('[data-member-remove]').addEventListener('click', () => {
      row.remove();
      sync();
    });
    list.appendChild(row);
  }

  function sync() {
    const members = Array.from(list.querySelectorAll('.member-row'))
      .map((row) => ({
        name: row.querySelector('[data-member-field="name"]').value.trim(),
        branch: row.querySelector('[data-member-field="branch"]').value.trim(),
        year: row.querySelector('[data-member-field="year"]').value.trim(),
        email: row.querySelector('[data-member-field="email"]').value.trim(),
        phone: row.querySelector('[data-member-field="phone"]').value.trim()
      }))
      .filter((m) => m.name);

    participantsInput.value = JSON.stringify(members);
    teamSizeInput.value = String(members.length + 1); // +1 for the captain
  }

  addBtn.addEventListener('click', () => { addRow(); sync(); });
  list.addEventListener('input', sync);

  // Start with two blank rows so the section isn't empty on load.
  addRow();
  addRow();
  sync();
})();
