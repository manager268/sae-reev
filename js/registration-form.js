/*
  REGISTRATION FORMS — shared submit/lock/payment logic for every
  <form data-reg-form="..."> on the site. Paired with
  assets/data/registration.js (window.REGISTRATION_CONFIG).

  SETUP (one-time, done by a human — not by this script): see
  SUPABASE_SETUP.md. Short version: create the Supabase project/tables,
  deploy the registration-api Edge Function, then paste supabaseUrl +
  supabaseAnonKey into REGISTRATION_CONFIG, and for the paid forms (below)
  paste your Razorpay Key ID into REGISTRATION_CONFIG.razorpay.keyId.
  Until supabaseUrl/supabaseAnonKey are set, every form stays locked with a
  clear reason instead of silently failing.

  HOW EACH FORM IS WIRED:
    <form data-reg-form="team"> ... </form>
    - data-reg-form's value is sent as "formType" so the backend knows
      which table(s) to write to.
    - Every <input>/<select>/<textarea> needs a "name" — that name becomes
      a field key sent to the backend, so keep names matching
      supabase/functions/registration-api/index.ts's expectations.
    - Native HTML `required` attributes drive the "all fields required"
      behavior — the browser won't let a visitor submit past a blank
      required field, and the code below re-checks with reportValidity()
      as a second line of defense before it ever calls fetch().
    - A `<p class="form-status" data-form-status></p>` right after the
      submit button gets the locked / submitting / success / error text.

  PAYMENT (Team, Phase1 Previously-Participated-Team, Phase1 New-Team, Individual):
    These form types (PAID_FORM_TYPES below) collect a registration fee via
    Razorpay before their data is ever written to the database — ₹20,000
    for the three team paths, ₹2,000 for Individual (the exact amount is
    always decided server-side, see point 1 below):
      1. Submit click -> ask the backend to create a Razorpay order (the
         fee amount is decided inside the Edge Function, never trusted
         from this file — this file never even knows the amount until
         Razorpay's order-creation response says so).
      2. Open Razorpay's Checkout popup for that order.
      3. On successful payment, the payment id/order id/signature Razorpay
         hands back are attached to the form data and THEN sent to the
         backend as a normal submission — the Edge Function cryptographically
         verifies that signature before writing anything, so a forged
         "I paid" claim without a real payment can't get through.
    Requires checkout.razorpay.com's checkout.js to already be loaded on
    the page (see the <script> tag in register.html / index.html).

  DOUBLE-CHARGE / DOUBLE-SUBMIT GUARDS:
    - Once a paid form's backend write actually succeeds, its submit
      button is left disabled permanently (never re-enabled on success) —
      that form instance can't be resubmitted at all.
    - If the payment succeeds but the backend write fails afterwards (a
      network blip, say), the verified payment id/order id/signature are
      stashed on the <form> element itself (form._verifiedPayment).
      Clicking Submit again resends that same verified payment instead of
      opening a brand new Razorpay order — so a retry can't charge twice.
    - The hard guarantee against a duplicate *registration* from one real
      payment is a unique constraint in the database itself (see
      supabase/payment_idempotency.sql + registration-api/index.ts writing
      the payments row before the registration row) — the form-level
      stash above is just what keeps a normal retry from even reaching
      that point.
*/
(function () {
  const cfg = window.REGISTRATION_CONFIG;
  const forms = document.querySelectorAll('form[data-reg-form]');
  if (!cfg || !forms.length) return;

  const PAID_FORM_TYPES = ['team', 'phase1PrevTeam', 'phase1NewTeam', 'individual'];

  const isOpen = Date.now() >= new Date(cfg.opensAt).getTime();
  const backendReady = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const functionUrl = backendReady ? `${cfg.supabaseUrl.replace(/\/+$/, '')}/functions/v1/registration-api` : '';

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

  function callBackend(body) {
    return fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.supabaseAnonKey,
        Authorization: 'Bearer ' + cfg.supabaseAnonKey
      },
      body: JSON.stringify(body)
    }).then((res) => res.json());
  }

  // Sends the (possibly payment-verified) submission to the backend and
  // renders the resulting status. Shared by the paid and unpaid paths.
  //
  // submitBtn is deliberately NOT re-enabled on a genuine success — a
  // completed registration should never be resubmittable from that same
  // form instance. It IS re-enabled on error/network-failure so the
  // visitor can retry; for a paid form that already has a verified
  // payment (see handlePaidSubmit's form._verifiedPayment), the submit
  // handler below re-sends that same payment rather than charging again.
  function submitToBackend(form, data, submitBtn) {
    setStatus(form, 'Submitting…', 'pending');
    return callBackend(data)
      .then((res) => {
        if (res && res.ok) {
          setStatus(form, 'Thanks — you’re registered. We’ll be in touch.', 'success');
          form.reset();
          delete form._verifiedPayment;
        } else {
          setStatus(form, (res && res.error) || 'Something went wrong — please try again.', 'error');
          if (submitBtn) submitBtn.disabled = false;
        }
      })
      .catch(() => {
        setStatus(form, 'Network error — please try again in a moment.', 'error');
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

    // Sends the full form data, not just formType, so the backend can
    // validate the registration itself — including the one-email-per-team
    // check — before ever creating a Razorpay order. Nobody should pay
    // ₹20,000 only to be told afterward the email was already used.
    callBackend(Object.assign({ action: 'createOrder' }, data))
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
          name: 'REEV SAEINDIA 4.0',
          description: data.formType === 'individual' ? 'Individual registration fee' : 'Team registration fee',
          prefill: {
            name: data.captainName || data.contactName || data.fullName || '',
            email: data.captainEmail || data.email || '',
            contact: data.captainPhone || data.phone || ''
          },
          theme: { color: '#1E8A4C' },
          handler: function (response) {
            data.razorpay_payment_id = response.razorpay_payment_id;
            data.razorpay_order_id = response.razorpay_order_id;
            data.razorpay_signature = response.razorpay_signature;
            // Remember this verified payment on the form itself: if the
            // submission below fails (network blip, backend hiccup, etc.)
            // and the visitor clicks Submit again, the handler further down
            // reuses this same already-paid payment instead of opening a
            // brand new Razorpay order and charging a second time.
            form._verifiedPayment = {
              razorpay_payment_id: data.razorpay_payment_id,
              razorpay_order_id: data.razorpay_order_id,
              razorpay_signature: data.razorpay_signature
            };
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
    if (!backendReady) {
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

      if (isPaid && form._verifiedPayment) {
        // A previous attempt already completed a real Razorpay payment but
        // the backend write failed afterwards — resend that same verified
        // payment (picking up any field edits made since) rather than
        // opening a new order and charging again.
        Object.assign(data, form._verifiedPayment);
        submitToBackend(form, data, submitBtn);
      } else if (isPaid) {
        handlePaidSubmit(form, data, submitBtn);
      } else {
        submitToBackend(form, data, submitBtn);
      }
    });
  });
})();
