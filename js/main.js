/* Intro loader — the car drives edge to edge across #preloader once, then the whole
   overlay fades out starting ~60% into that pass. No-ops if a page doesn't include
   the #preloader markup. Runs on every page load, same as the reference site. */
(function () {
  const loader = document.getElementById('preloader');
  if (!loader) return;

  const car = loader.querySelector('.racing-car');
  const speedLines = loader.querySelector('.speed-lines');

  const DRIVE_MS = 1800;                         // matches the CSS animation-duration
  const FADE_AT_MS = Math.round(DRIVE_MS * 0.6); // start fading once the car is ~60% across

  function restartDrive() {
    [car, speedLines].forEach(el => {
      if (!el) return;
      el.style.animation = 'none';
      void el.offsetWidth; // force reflow so the animation retriggers
      el.style.animation = '';
    });
  }

  function playLoader() {
    loader.classList.remove('loader-hidden');
    restartDrive();
    window.setTimeout(() => loader.classList.add('loader-hidden'), FADE_AT_MS);
  }

  window.addEventListener('load', playLoader);
})();

/* Quick Links menu — built from assets/data/quick-links.js (window.QUICK_LINKS).
   Runs first so the dropdown/accordion wiring below (which queries for
   .dd-submenu-toggle and .mnav-group) finds these elements already in place. */
(function () {
  const data = window.QUICK_LINKS;
  if (!Array.isArray(data)) return;

  const chevronRight = '<svg width="6" height="10" viewBox="0 0 6 10" fill="none" aria-hidden="true"><path d="M1 1L5 5L1 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

  const desktopMount = document.getElementById('ql-desktop');
  if (desktopMount) {
    data.forEach(item => {
      if (item.children) {
        const wrap = document.createElement('div');
        wrap.className = 'dd-submenu-wrap';
        const toggle = document.createElement('span');
        toggle.className = 'dd-submenu-toggle';
        toggle.innerHTML = item.label + ' ' + chevronRight;
        const sub = document.createElement('div');
        sub.className = 'dd-submenu';
        item.children.forEach(c => {
          const a = document.createElement('a');
          a.href = c.href;
          a.textContent = c.label;
          sub.appendChild(a);
        });
        wrap.appendChild(toggle);
        wrap.appendChild(sub);
        desktopMount.appendChild(wrap);
      } else {
        const a = document.createElement('a');
        a.href = item.href;
        a.textContent = item.label;
        desktopMount.appendChild(a);
      }
    });
  }

  const mobileMount = document.getElementById('ql-mobile');
  if (mobileMount) {
    data.forEach(item => {
      if (item.children) {
        const det = document.createElement('details');
        det.className = 'mnav-group';
        det.style.border = 'none';
        const sum = document.createElement('summary');
        sum.style.fontSize = '14px';
        sum.textContent = item.label;
        const nested = document.createElement('div');
        nested.className = 'mnav-sub-nested';
        item.children.forEach(c => {
          const a = document.createElement('a');
          a.href = c.href;
          a.textContent = c.label;
          nested.appendChild(a);
        });
        det.appendChild(sum);
        det.appendChild(nested);
        mobileMount.appendChild(det);
      } else {
        const a = document.createElement('a');
        a.href = item.href;
        a.textContent = item.label;
        mobileMount.appendChild(a);
      }
    });
  }
})();

const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0, rootMargin: '0px 0px 200px 0px' });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

const menuBtn = document.querySelector('.menu-btn');
const mobileNav = document.getElementById('mobile-nav');
if (menuBtn && mobileNav) {
  menuBtn.addEventListener('click', () => {
    const isOpen = mobileNav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(isOpen));
  });
  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    });
  });
}

(function () {
  const target = new Date('2026-09-10T23:59:59+05:30').getTime();
  const els = {
    d: document.getElementById('cd-days'),
    h: document.getElementById('cd-hours'),
    m: document.getElementById('cd-mins'),
    s: document.getElementById('cd-secs'),
  };
  if (!els.d) return;
  function tick() {
    const diff = target - Date.now();
    if (diff <= 0) {
      els.d.textContent = els.h.textContent = els.m.textContent = els.s.textContent = '00';
      return;
    }
    els.d.textContent = String(Math.floor(diff / 86400000)).padStart(2, '0');
    els.h.textContent = String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0');
    els.m.textContent = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
    els.s.textContent = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
  }
  tick();
  setInterval(tick, 1000);
})();

(function () {
  const slides = document.querySelectorAll('.hero-slideshow .slide');
  if (slides.length < 2) return;
  const dots = document.querySelectorAll('.hero-dot');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const heroVideo = document.querySelector('.hero-slideshow video.slide');
  const videoIndex = Array.prototype.indexOf.call(slides, heroVideo);
  const PHOTO_MS = 5000;
  const VIDEO_MS = 9000; // ~one full loop of the ~8.7s flag-off clip before advancing
  const FADE_MS = 1400;   // matches the .slide opacity transition duration in css/style.css
  let current = 0;

  // Slide 0 starts active straight from the HTML, so goTo() never runs for it —
  // set its dwell time here so the first dot's fill-bar animation still matches.
  dots[0]?.style.setProperty('--dwell', (0 === videoIndex ? VIDEO_MS : PHOTO_MS) + 'ms');

  // Respect reduced-motion: don't autoplay the flag-off clip, just show its poster frame.
  if (reduceMotion && heroVideo) {
    heroVideo.pause();
    heroVideo.removeAttribute('autoplay');
  }

  function goTo(index) {
    const prev = current;
    slides[prev].classList.remove('active');
    dots[prev]?.classList.remove('active');
    current = index;
    slides[current].classList.add('active');
    if (dots[current]) {
      // Drives the dot's fill-bar animation (see .hero-dot::after in css/style.css)
      // so it visually tracks how long this particular slide will actually dwell.
      dots[current].style.setProperty('--dwell', (current === videoIndex ? VIDEO_MS : PHOTO_MS) + 'ms');
      dots[current].classList.add('active');
    }

    if (heroVideo && !reduceMotion) {
      if (current === videoIndex) {
        // Always restart cleanly from the flag-off moment when its slide comes up.
        heroVideo.currentTime = 0;
        heroVideo.play().catch(() => {});
      } else if (prev === videoIndex) {
        // Keep playing through the fade-out so the dissolve reads as motion,
        // not a frozen frame; only pause + rewind once fully hidden.
        setTimeout(() => {
          if (current !== videoIndex) {
            heroVideo.pause();
            heroVideo.currentTime = 0;
          }
        }, FADE_MS);
      }
    }
  }

  dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));

  if (reduceMotion) return;

  function scheduleNext() {
    const dwell = current === videoIndex ? VIDEO_MS : PHOTO_MS;
    setTimeout(() => {
      goTo((current + 1) % slides.length);
      scheduleNext();
    }, dwell);
  }
  scheduleNext();
})();

(function () {
  const grid = document.querySelector('.gallery-grid');
  const lightbox = document.getElementById('lightbox');
  if (!grid || !lightbox) return;
  const lightboxImg = lightbox.querySelector('img');
  const lightboxCaption = lightbox.querySelector('.lightbox-caption');
  const closeBtn = lightbox.querySelector('.lightbox-close');

  grid.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('click', () => {
      const img = item.querySelector('img');
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightboxCaption.textContent = item.querySelector('.gallery-caption')?.textContent || '';
      lightbox.classList.add('open');
    });
  });

  function closeLightbox() {
    lightbox.classList.remove('open');
    lightboxImg.src = '';
  }
  closeBtn.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('open')) closeLightbox();
  });
})();

/* Desktop nav dropdowns: Quick Links / Results / Login / Register */
(function () {
  const dropdowns = document.querySelectorAll('.nav-dropdown');
  if (!dropdowns.length) return;

  function closeAll(except) {
    dropdowns.forEach(dd => { if (dd !== except) dd.classList.remove('open'); });
  }

  dropdowns.forEach(dd => {
    const toggle = dd.querySelector(':scope > .dd-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !dd.classList.contains('open');
      closeAll();
      dd.classList.toggle('open', willOpen);
    });
    dd.querySelectorAll('.dd-submenu-toggle').forEach(sub => {
      sub.addEventListener('click', (e) => {
        e.stopPropagation();
        sub.parentElement.classList.toggle('open');
      });
    });
  });

  document.addEventListener('click', () => closeAll());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
})();

/* Mobile nav: keep only one accordion group open at a time */
(function () {
  const groups = document.querySelectorAll('.mnav-group');
  if (!groups.length) return;
  groups.forEach(g => {
    g.addEventListener('toggle', () => {
      if (g.open) groups.forEach(o => { if (o !== g) o.open = false; });
    });
  });
})();

/* Register-page tabs (Team / Judge / Tech Team) */
(function () {
  const tabs = document.querySelectorAll('.reg-tab-btn');
  if (!tabs.length) return;
  const hashToTab = { team: 'tab-team', judge: 'tab-judge', techteam: 'tab-techteam' };

  function activate(btn) {
    tabs.forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.reg-tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab)?.classList.add('active');
  }

  tabs.forEach(btn => btn.addEventListener('click', () => activate(btn)));

  const hashTab = hashToTab[window.location.hash.replace('#', '')];
  if (hashTab) {
    const target = document.querySelector(`.reg-tab-btn[data-tab="${hashTab}"]`);
    if (target) activate(target);
  }
})();

/* Registration form gating/submission now lives in js/registration-form.js
   (assets/data/registration.js holds the shared config). See that file. */

/* Registration Phase 1 modal — no longer wired to any on-page button (the
   hero "Register your college" and footer "Registration — Phase 1" buttons
   both link straight to register.html now). Left in place in case a
   .js-open-phase1 opener is reintroduced; the guard below no-ops otherwise.
   Inside, picking a category (.phase-option[data-phase-go]) swaps in the
   matching .phase-step[data-phase-step] panel, which holds that category's
   form. */
(function () {
  const modal = document.getElementById('phase1-modal');
  const openers = document.querySelectorAll('.js-open-phase1');
  if (!modal || !openers.length) return;
  const closeBtn = modal.querySelector('.phase-modal-close');
  const steps = modal.querySelectorAll('[data-phase-step]');

  function showStep(name) {
    steps.forEach(s => s.classList.toggle('active', s.dataset.phaseStep === name));
  }

  function open() { modal.classList.add('open'); showStep('picker'); }
  function close() { modal.classList.remove('open'); }

  openers.forEach(btn => btn.addEventListener('click', open));
  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) close();
  });

  modal.querySelectorAll('[data-phase-go]').forEach((btn) => {
    btn.addEventListener('click', () => showStep(btn.dataset.phaseGo));
  });
  modal.querySelectorAll('[data-phase-back]').forEach((btn) => {
    btn.addEventListener('click', () => showStep('picker'));
  });
})();

/* Back-to-top button */
(function () {
  const btn = document.querySelector('.to-top');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('show', window.scrollY > 480);
  });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();
