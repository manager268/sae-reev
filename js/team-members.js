/*
  TEAM MEMBERS — repeatable participant rows, used on every form that
  registers a team: the Team form (register.html) and the "Previously
  Participated Team" / "New or Upcoming Team" forms in the Phase 1 modal
  (index.html). Not used on individual-person forms (Judge, Student,
  Mentor, SME, Phase 1 Individual).

  Markup contract per form (see register.html / index.html for the actual
  instances):
    <div data-member-list data-member-template="some-template-id"></div>
    <button type="button" data-member-add>+ Add member</button>
    <input type="hidden" name="participants" data-participants-json>
    <input data-team-size readonly>
    <template id="some-template-id"> ... one .member-row ... </template>

  Each [data-member-list] is wired up independently — its own template,
  its own add button, its own hidden/participants + team-size fields,
  all scoped to whichever <form> it lives in. On every change, this:
    - filters out empty rows (no name entered yet)
    - serializes the rest as JSON into that form's hidden "participants"
      field, which travels to the backend like any other form field
    - recomputes that form's team-size field as
      member-rows-with-a-name + 1 (for the captain / contact person)

  The backend (Code.gs, see REGISTRATION_SETUP.md) parses that JSON and
  writes a readable numbered list into the sheet's Participants column,
  for every form type that includes "participants" in its field list.
*/
(function () {
  document.querySelectorAll('[data-member-list]').forEach((list) => {
    const template = document.getElementById(list.dataset.memberTemplate || '');
    const form = list.closest('form');
    if (!template || !form) return;

    const addBtn = form.querySelector('[data-member-add]');
    const participantsInput = form.querySelector('[data-participants-json]');
    const teamSizeInput = form.querySelector('[data-team-size]');
    if (!addBtn || !participantsInput || !teamSizeInput) return;

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
      teamSizeInput.value = String(members.length + 1); // +1 for the captain/contact person
    }

    addBtn.addEventListener('click', () => { addRow(); sync(); });
    list.addEventListener('input', sync);

    // Start with two blank rows so the section isn't empty on load.
    addRow();
    addRow();
    sync();
  });
})();
