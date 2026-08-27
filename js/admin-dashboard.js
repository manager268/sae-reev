/*
  ADMIN DASHBOARD — auth, data fetching, rendering, CSV export, and manual
  corrections for admin.html. Talks directly to Supabase (not through
  registration-api) using supabase-js + Row Level Security: every table has
  RLS policies gated by is_admin() (see supabase/admin_schema.sql), so a
  logged-in non-admin account — or no session at all — gets back nothing,
  no matter what this file tries to query. See SUPABASE_SETUP.md Step 5.

  Session storage uses sessionStorage rather than the default localStorage:
  this dashboard may run on a shared computer, so a session should not
  survive a full browser close, only page reloads within one browser
  session.
*/
(function () {
  const cfg = window.REGISTRATION_CONFIG;
  const gate = document.getElementById('admin-gate');
  const dashboard = document.getElementById('admin-dashboard');
  const loginForm = document.getElementById('admin-login-form');
  const userEmailEl = document.getElementById('admin-user-email');
  const logoutBtn = document.getElementById('admin-logout');
  if (!gate || !dashboard || !loginForm) return;

  function setStatus(form, text, kind) {
    const el = form.querySelector('[data-form-status]');
    if (!el) return;
    el.textContent = text;
    el.className = 'form-status' + (kind ? ' form-status-' + kind : '');
  }

  if (!cfg || !cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    setStatus(loginForm, 'Admin dashboard isn’t connected yet — check back soon.', 'locked');
    loginForm.querySelectorAll('input, button').forEach((el) => { el.disabled = true; });
    return;
  }
  if (!window.supabase) {
    setStatus(loginForm, 'Could not load required libraries — please refresh the page.', 'error');
    return;
  }

  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true }
  });

  // ============ formatting helpers ============
  function fmtDateVal(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
  function fmtRegType(row) {
    const map = { team: 'Team', phase1_prev_team: 'Prev. team', phase1_new_team: 'New team' };
    return map[row.registration_type] || row.registration_type;
  }
  function fmtRoster(row) {
    const members = row.team_members || [];
    if (!members.length) return '—';
    return members.map((m) => m.name + (m.branch ? ' (' + m.branch + ')' : '')).join('; ');
  }
  function fmtLinkedTeam(row) {
    const t = row.team_registrations;
    return t ? `${t.team_name} — ${t.college_name}` : '—';
  }
  function fmtInr(row) {
    return row.amount_paise != null ? '₹' + (row.amount_paise / 100).toLocaleString('en-IN') : '—';
  }
  function fmtJson(row) {
    return row.raw_payload ? JSON.stringify(row.raw_payload) : '';
  }
  function badgeClass(value) {
    const v = String(value || '').toLowerCase();
    if (v === 'paid' || v === 'verified') return 'badge-paid';
    if (v === 'failed') return 'badge-failed';
    return 'badge-pending';
  }

  const FIELD_LABELS = {
    college_name: 'College name', team_name: 'Team name', contact_name: 'Contact name',
    contact_email: 'Contact email', contact_phone: 'Contact phone', team_size: 'Team size',
    notes: 'Notes', payment_status: 'Payment status', payment_id: 'Payment ID',
    amount_paid_inr: 'Amount paid (₹)', status: 'Status', full_name: 'Full name',
    organisation: 'Organisation', expertise: 'Expertise', email: 'Email', phone: 'Phone',
    college: 'College', year: 'Year', interest: 'Interest', reason: 'Reason',
    registration_type: 'Registration type', edition: 'Previous edition competed in',
    advisor1_name: 'Faculty advisor 1 - name', advisor1_email: 'Faculty advisor 1 - email',
    advisor1_phone: 'Faculty advisor 1 - phone', advisor2_name: 'Faculty advisor 2 - name',
    advisor2_email: 'Faculty advisor 2 - email', advisor2_phone: 'Faculty advisor 2 - phone'
  };

  // ============ per-tab table configuration ============
  const TABLE_CONFIGS = {
    teams: {
      table: 'team_registrations',
      select: '*, team_members(name,branch,year,email,phone), payments(razorpay_payment_id,status)',
      columns: [
        { key: 'created_at', label: 'Registered', format: (r) => fmtDateVal(r.created_at) },
        { key: 'registration_type', label: 'Type', format: fmtRegType },
        { key: 'edition', label: 'Prev. edition' },
        { key: 'college_name', label: 'College' },
        { key: 'team_name', label: 'Team' },
        { key: 'contact_name', label: 'Contact' },
        { key: 'contact_email', label: 'Email' },
        { key: 'contact_phone', label: 'Phone' },
        { key: 'team_size', label: 'Size' },
        { key: 'team_members', label: 'Roster', format: fmtRoster },
        { key: 'advisor1_name', label: 'Advisor 1' },
        { key: 'advisor1_email', label: 'Advisor 1 email' },
        { key: 'advisor1_phone', label: 'Advisor 1 phone' },
        { key: 'advisor2_name', label: 'Advisor 2' },
        { key: 'advisor2_email', label: 'Advisor 2 email' },
        { key: 'advisor2_phone', label: 'Advisor 2 phone' },
        { key: 'payment_status', label: 'Payment', badge: true },
        { key: 'payment_id', label: 'Payment ID' },
        { key: 'amount_paid_inr', label: 'Amount (₹)' },
        { key: 'notes', label: 'Notes' }
      ],
      editFields: ['college_name', 'team_name', 'edition', 'contact_name', 'contact_email', 'contact_phone', 'team_size', 'advisor1_name', 'advisor1_email', 'advisor1_phone', 'advisor2_name', 'advisor2_email', 'advisor2_phone', 'payment_status', 'payment_id', 'amount_paid_inr', 'notes'],
      createFields: ['registration_type', 'college_name', 'team_name', 'edition', 'contact_name', 'contact_email', 'contact_phone', 'team_size', 'advisor1_name', 'advisor1_email', 'advisor1_phone', 'advisor2_name', 'advisor2_email', 'advisor2_phone', 'payment_status', 'payment_id', 'amount_paid_inr', 'notes'],
      deleteConfirmField: 'team_name',
      insertable: true
    },
    payments: {
      table: 'payments',
      select: '*, team_registrations(team_name, college_name)',
      columns: [
        { key: 'created_at', label: 'Created', format: (r) => fmtDateVal(r.created_at) },
        { key: 'team_registrations', label: 'Team', format: fmtLinkedTeam },
        { key: 'razorpay_order_id', label: 'Order ID' },
        { key: 'razorpay_payment_id', label: 'Payment ID' },
        { key: 'amount_paise', label: 'Amount', format: fmtInr },
        { key: 'status', label: 'Status', badge: true },
        { key: 'verified_at', label: 'Verified', format: (r) => fmtDateVal(r.verified_at) }
      ],
      editFields: ['status']
    },
    judges: {
      table: 'judges', select: '*',
      columns: [
        { key: 'created_at', label: 'Registered', format: (r) => fmtDateVal(r.created_at) },
        { key: 'full_name', label: 'Name' }, { key: 'organisation', label: 'Organisation' },
        { key: 'expertise', label: 'Expertise' }, { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' }, { key: 'notes', label: 'Notes' }
      ],
      editFields: ['full_name', 'organisation', 'expertise', 'email', 'phone', 'notes'],
      insertable: true
    },
    student_volunteers: {
      table: 'student_volunteers', select: '*',
      columns: [
        { key: 'created_at', label: 'Registered', format: (r) => fmtDateVal(r.created_at) },
        { key: 'full_name', label: 'Name' }, { key: 'college', label: 'College' },
        { key: 'year', label: 'Year' }, { key: 'interest', label: 'Interest' },
        { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }
      ],
      editFields: ['full_name', 'college', 'year', 'interest', 'email', 'phone'],
      insertable: true
    },
    mentors: {
      table: 'mentors', select: '*',
      columns: [
        { key: 'created_at', label: 'Registered', format: (r) => fmtDateVal(r.created_at) },
        { key: 'full_name', label: 'Name' }, { key: 'organisation', label: 'Organisation' },
        { key: 'expertise', label: 'Expertise' }, { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' }, { key: 'notes', label: 'Notes' }
      ],
      editFields: ['full_name', 'organisation', 'expertise', 'email', 'phone', 'notes'],
      insertable: true
    },
    smes: {
      table: 'smes', select: '*',
      columns: [
        { key: 'created_at', label: 'Registered', format: (r) => fmtDateVal(r.created_at) },
        { key: 'full_name', label: 'Name' }, { key: 'organisation', label: 'Organisation' },
        { key: 'expertise', label: 'Expertise' }, { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' }
      ],
      editFields: ['full_name', 'organisation', 'expertise', 'email', 'phone'],
      insertable: true
    },
    individuals: {
      table: 'individuals', select: '*',
      columns: [
        { key: 'created_at', label: 'Registered', format: (r) => fmtDateVal(r.created_at) },
        { key: 'full_name', label: 'Name' }, { key: 'college', label: 'College' },
        { key: 'year', label: 'Year' }, { key: 'reason', label: 'Reason' },
        { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' },
        { key: 'payment_status', label: 'Payment', badge: true },
        { key: 'payment_id', label: 'Payment ID' },
        { key: 'amount_paid_inr', label: 'Amount (₹)' }
      ],
      editFields: ['full_name', 'college', 'year', 'reason', 'email', 'phone', 'payment_status', 'payment_id', 'amount_paid_inr'],
      insertable: true
    },
    submission_logs: {
      table: 'submission_logs', select: '*', limit: 500, readOnly: true,
      columns: [
        { key: 'created_at', label: 'Time', format: (r) => fmtDateVal(r.created_at) },
        { key: 'form_type', label: 'Form' },
        { key: 'status', label: 'Status', badge: true },
        { key: 'error_message', label: 'Error' },
        { key: 'raw_payload', label: 'Payload', format: fmtJson }
      ]
    }
  };

  const tabData = {};
  const loadedTabs = new Set();
  let activeTab = 'teams';

  // ============ table rendering ============
  function renderTable(tableEl, rows, config) {
    const thead = tableEl.querySelector('thead');
    const tbody = tableEl.querySelector('tbody');
    thead.innerHTML = '';
    tbody.innerHTML = '';

    const headRow = document.createElement('tr');
    config.columns.forEach((col) => {
      const th = document.createElement('th');
      th.textContent = col.label;
      headRow.appendChild(th);
    });
    if (!config.readOnly) {
      const th = document.createElement('th');
      th.textContent = 'Actions';
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);

    if (!rows.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = config.columns.length + (config.readOnly ? 0 : 1);
      td.textContent = 'No records yet.';
      td.style.textAlign = 'center';
      td.style.color = 'var(--steel)';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    rows.forEach((row) => {
      const tr = document.createElement('tr');
      config.columns.forEach((col) => {
        const td = document.createElement('td');
        const val = col.format ? col.format(row) : row[col.key];
        if (col.badge) {
          const span = document.createElement('span');
          span.className = 'badge ' + badgeClass(row[col.key]);
          span.textContent = row[col.key] || '—';
          td.appendChild(span);
        } else {
          td.textContent = val === null || val === undefined || val === '' ? '—' : val;
        }
        tr.appendChild(td);
      });
      if (!config.readOnly) {
        const td = document.createElement('td');
        td.style.whiteSpace = 'nowrap';
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn-ghost admin-action-btn';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => openEditModal(activeTab, config, row));
        td.appendChild(editBtn);
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn-ghost admin-action-btn';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', () => handleDelete(activeTab, config, row));
        td.appendChild(delBtn);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
  }

  // ============ CSV export ============
  function csvEscape(v) {
    const s = String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCsv(rows, config) {
    const lines = [config.columns.map((c) => csvEscape(c.label)).join(',')];
    rows.forEach((row) => {
      const vals = config.columns.map((col) => {
        const val = col.format ? col.format(row) : row[col.key];
        return val === null || val === undefined ? '' : val;
      });
      lines.push(vals.map(csvEscape).join(','));
    });
    return lines.join('\r\n');
  }
  function exportCsv(name) {
    const rows = tabData[name] || [];
    const csv = toCsv(rows, TABLE_CONFIGS[name]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reev4-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ============ audit log ============
  async function logAudit(tableName, rowId, action, before, after) {
    try {
      const { data: { user } } = await sb.auth.getUser();
      await sb.from('admin_audit_log').insert({
        actor_id: user ? user.id : null,
        actor_email: user ? user.email : null,
        table_name: tableName,
        row_id: rowId,
        action,
        before: before || null,
        after: after || null
      });
    } catch (err) {
      // never let audit logging block the main action
    }
  }

  // ============ edit modal ============
  const editModal = document.getElementById('admin-edit-modal');
  const editForm = document.getElementById('admin-edit-form');
  const editFieldsEl = document.getElementById('admin-edit-fields');
  let currentEdit = null;

  function fieldLabel(key) { return FIELD_LABELS[key] || key; }

  // Builds one <div class="field">...</div> for `key`, pre-filled from
  // `row` (pass {} for a blank create-mode field). Shared by both modes so
  // the same select/textarea/input logic never has to be written twice.
  function buildField(key, config, row) {
    const wrap = document.createElement('div');
    wrap.className = 'field' + (key === 'notes' ? ' field-wide' : '');
    const label = document.createElement('label');
    label.textContent = fieldLabel(key);
    label.setAttribute('for', 'edit-' + key);
    wrap.appendChild(label);

    let input;
    if (key === 'registration_type') {
      input = document.createElement('select');
      [['team', 'Team'], ['phase1_prev_team', 'Previously participated team'], ['phase1_new_team', 'New / upcoming team']].forEach(([v, text]) => {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = text;
        if ((row[key] || 'team') === v) opt.selected = true;
        input.appendChild(opt);
      });
    } else if (key === 'payment_status') {
      input = document.createElement('select');
      ['pending', 'paid', 'failed'].forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = v;
        if ((row[key] || 'pending') === v) opt.selected = true;
        input.appendChild(opt);
      });
    } else if (key === 'status' && config.table === 'payments') {
      input = document.createElement('select');
      ['created', 'verified', 'failed'].forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = v;
        if ((row[key] || 'created') === v) opt.selected = true;
        input.appendChild(opt);
      });
    } else if (key === 'notes') {
      input = document.createElement('textarea');
      input.value = row[key] || '';
    } else {
      input = document.createElement('input');
      input.type = key.includes('email') ? 'email' : key.includes('phone') ? 'tel' :
        (key === 'team_size' || key === 'amount_paid_inr') ? 'number' : 'text';
      input.value = row[key] === null || row[key] === undefined ? '' : row[key];
    }
    input.id = 'edit-' + key;
    input.name = key;
    wrap.appendChild(input);
    return wrap;
  }

  function openEditModal(tabName, config, row) {
    currentEdit = { mode: 'edit', tabName, config, row };
    document.getElementById('admin-modal-title').textContent =
      'Edit ' + (row.team_name || row.full_name || row.college_name || 'record');
    editFieldsEl.innerHTML = '';
    config.editFields.forEach((key) => editFieldsEl.appendChild(buildField(key, config, row)));
    setStatus(editForm, '', '');
    editModal.classList.add('open');
  }

  const TAB_SINGULAR = {
    teams: 'team', judges: 'judge', student_volunteers: 'student volunteer',
    mentors: 'mentor', smes: 'SME', individuals: 'individual'
  };

  function openCreateModal(tabName, config) {
    currentEdit = { mode: 'create', tabName, config, row: {} };
    document.getElementById('admin-modal-title').textContent = 'Add new ' + (TAB_SINGULAR[tabName] || tabName);
    editFieldsEl.innerHTML = '';
    (config.createFields || config.editFields).forEach((key) => editFieldsEl.appendChild(buildField(key, config, {})));
    setStatus(editForm, '', '');
    editModal.classList.add('open');
  }

  function closeEditModal() {
    editModal.classList.remove('open');
    currentEdit = null;
  }
  document.getElementById('admin-modal-close').addEventListener('click', closeEditModal);
  editModal.addEventListener('click', (e) => { if (e.target === editModal) closeEditModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && editModal.classList.contains('open')) closeEditModal();
  });

  document.querySelectorAll('[data-admin-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.adminAdd;
      openCreateModal(name, TABLE_CONFIGS[name]);
    });
  });

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentEdit) return;
    const { mode, tabName, config, row } = currentEdit;
    const fields = mode === 'create' ? (config.createFields || config.editFields) : config.editFields;
    const fd = new FormData(editForm);
    const patch = {};
    fields.forEach((key) => {
      let v = fd.get(key);
      if (key === 'team_size' || key === 'amount_paid_inr') v = v === '' ? null : Number(v);
      patch[key] = v;
    });

    setStatus(editForm, mode === 'create' ? 'Adding…' : 'Saving…', 'pending');

    if (mode === 'create') {
      const { data: created, error } = await sb.from(config.table).insert(patch).select().single();
      if (error) { setStatus(editForm, error.message, 'error'); return; }
      await logAudit(config.table, created.id, 'insert', null, patch);
    } else {
      const { error } = await sb.from(config.table).update(patch).eq('id', row.id);
      if (error) { setStatus(editForm, error.message, 'error'); return; }
      await logAudit(config.table, row.id, 'update', row, Object.assign({}, row, patch));
    }

    closeEditModal();
    loadTab(tabName, true);
  });

  // ============ delete ============
  async function handleDelete(tabName, config, row) {
    if (config.deleteConfirmField) {
      const expected = row[config.deleteConfirmField];
      const typed = window.prompt(
        `This deletes "${expected}" AND its full roster and payment record. Type the team name to confirm:`
      );
      if (typed === null) return;
      if (typed !== expected) { window.alert('Name did not match — nothing was deleted.'); return; }
    } else if (!window.confirm('Delete this record? This cannot be undone.')) {
      return;
    }

    const { error } = await sb.from(config.table).delete().eq('id', row.id);
    if (error) { window.alert('Delete failed: ' + error.message); return; }

    await logAudit(config.table, row.id, 'delete', row, null);
    loadTab(tabName, true);
  }

  // ============ tab data loading ============
  async function loadTab(name, force) {
    if (loadedTabs.has(name) && !force) return;
    const config = TABLE_CONFIGS[name];
    const tableEl = document.querySelector(`[data-admin-table="${name}"]`);
    let query = sb.from(config.table).select(config.select || '*').order('created_at', { ascending: false });
    if (config.limit) query = query.limit(config.limit);

    const { data, error } = await query;
    if (error) {
      tableEl.querySelector('thead').innerHTML = '';
      tableEl.querySelector('tbody').innerHTML = '';
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.textContent = 'Failed to load: ' + error.message;
      td.style.color = '#c0392b';
      tr.appendChild(td);
      tableEl.querySelector('tbody').appendChild(tr);
      return;
    }

    tabData[name] = data || [];
    loadedTabs.add(name);
    renderTable(tableEl, tabData[name], config);
    if (name === 'teams' || ['judges', 'student_volunteers', 'mentors', 'smes', 'individuals'].indexOf(name) !== -1) {
      loadStats();
    }
  }

  // ============ overview stats ============
  function setStat(key, val) {
    const el = document.querySelector(`[data-stat="${key}"]`);
    if (el) el.textContent = val;
  }
  async function loadStats() {
    const [teamsRes, judgesRes, studentsRes, mentorsRes, smesRes, individualsRes] = await Promise.all([
      sb.from('team_registrations').select('payment_status, amount_paid_inr'),
      sb.from('judges').select('*', { count: 'exact', head: true }),
      sb.from('student_volunteers').select('*', { count: 'exact', head: true }),
      sb.from('mentors').select('*', { count: 'exact', head: true }),
      sb.from('smes').select('*', { count: 'exact', head: true }),
      // Individuals now pay too (₹2,000 — see registration-api/index.ts), so this
      // also needs the payment columns, not just a head-count, for the revenue/
      // pending/failed stats below.
      sb.from('individuals').select('payment_status, amount_paid_inr', { count: 'exact' })
    ]);
    const teams = teamsRes.data || [];
    const individuals = individualsRes.data || [];
    // Revenue/pending/failed are collected across every paid registration
    // type, not just teams — individuals are part of the same event finances.
    const paid = teams.concat(individuals).filter((r) => r.payment_status === 'paid');
    const revenue = paid.reduce((sum, r) => sum + (Number(r.amount_paid_inr) || 0), 0);

    setStat('teamCount', teams.length);
    setStat('revenue', '₹' + revenue.toLocaleString('en-IN'));
    setStat('pendingCount', teams.concat(individuals).filter((r) => r.payment_status === 'pending').length);
    setStat('failedCount', teams.concat(individuals).filter((r) => r.payment_status === 'failed').length);
    setStat('judgeCount', judgesRes.count != null ? judgesRes.count : '—');
    setStat('studentCount', studentsRes.count != null ? studentsRes.count : '—');
    setStat('mentorCount', mentorsRes.count != null ? mentorsRes.count : '—');
    setStat('smeCount', smesRes.count != null ? smesRes.count : '—');
    setStat('individualCount', individualsRes.count != null ? individualsRes.count : '—');
  }

  // ============ tabs ============
  document.querySelectorAll('[data-admin-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-admin-tab]').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('[data-admin-panel]').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const name = btn.dataset.adminTab;
      document.querySelector(`[data-admin-panel="${name}"]`).classList.add('active');
      activeTab = name;
      loadTab(name, false);
    });
  });
  document.querySelectorAll('[data-admin-refresh]').forEach((btn) => {
    btn.addEventListener('click', () => loadTab(btn.dataset.adminRefresh, true));
  });
  document.querySelectorAll('[data-admin-export]').forEach((btn) => {
    btn.addEventListener('click', () => exportCsv(btn.dataset.adminExport));
  });

  // ============ auth flow ============
  function showGate(message) {
    dashboard.style.display = 'none';
    gate.style.display = '';
    if (message) setStatus(loginForm, message, 'error');
  }
  function showDashboard(session) {
    gate.style.display = 'none';
    dashboard.style.display = '';
    userEmailEl.textContent = session.user.email;
    loadTab(activeTab, true);
    loadStats();
  }

  async function checkSession() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { showGate(); return; }
    const { data: isAdmin, error } = await sb.rpc('is_admin');
    if (error || !isAdmin) {
      await sb.auth.signOut();
      showGate('This account isn’t authorized as an admin.');
      return;
    }
    showDashboard(session);
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;
    setStatus(loginForm, 'Signing in…', 'pending');
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { setStatus(loginForm, error.message, 'error'); return; }
    await checkSession();
  });

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await sb.auth.signOut();
      showGate();
    });
  }

  checkSession();
})();
