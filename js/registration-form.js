/*
  REGISTRATION FORMS — shared submit/lock/payment logic for every
  <form data-reg-form="..."> on the site. Paired with
  assets/data/registration.js (window.REGISTRATION_CONFIG).

  SETUP (one-time, done by a human — not by this script): see
  REGISTRATION_SETUP.md. Short version: deploy the Apps Script backend,
  paste its Web App URL into REGISTRATION_CONFIG.endpoint, and for the
  paid forms (below) paste your Razorpay Key ID into
  REGISTRATION_CONFIG.razorpay.keyId. Until the endpoint is set, every
  form stays locked with a clear reason instead of silently failing.

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

  PAYMENT (Team, Phase1 Previously-Participated-Team, Phase1 New-Team):
    These three form types (PAID_FORM_TYPES below) collect a registration
    fee via Razorpay before their data is ever sent to the sheet:
      1. Submit click -> ask the backend to create a Razorpay order (the
         fee amount is decided server-side in Code.gs, never trusted from
         this file — this file never even knows the amount until Razorpay's
         order-creation response says so).
      2. Open Razorpay's Checkout popup for that order.
      3. On successful payment, the payment id/order id/signature Razorpay
         hands back are attached to the form data and THEN sent to the
         backend as a normal submission — Code.gs verifies that signature
         cryptographically before writing anything to the sheet, so a
         forged "I paid" claim without a real payment can't get through.
    Requires checkout.razorpay.com's checkout.js to already be loaded on
    the page (see the <script> tag in register.html / index.html).
*/
(function () {
  const cfg = window.REGISTRATION_CONFIG;
  const forms = document.querySelectorAll('form[data-reg-form]');
  if (!cfg || !forms.length) return;

  const PAID_FORM_TYPES = ['team', 'phase1PrevTeam', 'phase1NewTeam'];

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

  // Sends the (possibly payment-verified) submission to the backend and
  // renders the resulting status. Shared by the paid and unpaid paths.
  function submitToBackend(form, data, submitBtn) {
    setStatus(form, 'Submitting…', 'pending');
    return fetch(cfg.endpoint, {
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
  }

  function handlePaidSubmit(form, data, submitBtn) {
    if (!window.Razorpay) {
      setStatus(form, 'Payment isn’t available right now — please try again shortly.', 'error');
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    if (!cfg.razorpay || !cfg.razorpay.keyId) {
      setStatus(form, 'Payment isn’t connected yet — check back soon.', 'error');
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    setStatus(form, 'Preparing payment…', 'pending');

    fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'createOrder', formType: data.formType })
    })
      .then((res) => res.json())
      .then((order) => {
        if (!order || !order.ok) {
          setStatus(form, (order && order.error) || 'Could not start payment — please try again.', 'error');
          if (submitBtn) submitBtn.disabled = false;
          return;
        }

        setStatus(form, 'Opening payment…', 'pending');

        const rzp = new window.Razorpay({
          key: cfg.razorpay.keyId,
          order_id: order.orderId,
          amount: order.amount,
          currency: order.currency,
          name: 'SAEINDIA REEV 4.0',
          description: 'Team registration fee',
          prefill: {
            name: data.captainName || data.contactName || '',
            email: data.captainEmail || data.email || '',
            contact: data.captainPhone || data.phone || ''
          },
          theme: { color: '#1E8A4C' },
          handler: function (response) {
            data.razorpay_payment_id = response.razorpay_payment_id;
            data.razorpay_order_id = response.razorpay_order_id;
            data.razorpay_signature = response.razorpay_signature;
            setStatus(form, 'Verifying payment…', 'pending');
            submitToBackend(form, data, submitBtn);
          },
          modal: {
            ondismiss: function () {
              setStatus(form, 'Payment cancelled — you can try again whenever you’re ready.', 'error');
              if (submitBtn) submitBtn.disabled = false;
            }
          }
        });

        rzp.on('payment.failed', function () {
          setStatus(form, 'Payment failed — you weren’t charged. Please try again.', 'error');
          if (submitBtn) submitBtn.disabled = false;
        });

        rzp.open();
      })
      .catch(() => {
        setStatus(form, 'Network error while starting payment — please try again.', 'error');
        if (submitBtn) submitBtn.disabled = false;
      });
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

    const formType = form.dataset.regForm;
    const isPaid = PAID_FORM_TYPES.indexOf(formType) !== -1;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;

      const submitBtn = form.querySelector('button[type="submit"]');
      const data = Object.fromEntries(new FormData(form).entries());
      data.formType = formType;

      if (submitBtn) submitBtn.disabled = true;

      if (isPaid) {
        handlePaidSubmit(form, data, submitBtn);
      } else {
        submitToBackend(form, data, submitBtn);
      }
    });
  });
})();
