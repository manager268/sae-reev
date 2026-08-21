/* Intro loader — the car drives edge to edge across #preloader once, then the whole
   overlay fades out starting ~60% into that pass. No-ops if a page doesn't include
   the #preloader markup. Runs on every page load, same as the reference site. */
(function () {
  const loader = document.getElementById('preloader');
  if (!loader) return;

  const car = loader.querySelector('.racing-car');
  const speedLines = loader.querySelector('.speed-lines');

  const DRIVE_MS = 756;                          // matches the CSS animation-duration
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
}, { threshold: 0.15 });
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
  let current = 0;

  function goTo(index) {
    slides[current].classList.remove('active');
    dots[current]?.classList.remove('active');
    current = index;
    slides[current].classList.add('active');
    dots[current]?.classList.add('active');
  }

  dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));

  if (reduceMotion) return;
  setInterval(() => goTo((current + 1) % slides.length), 5000);
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

/* Back-to-top button */
(function () {
  const btn = document.querySelector('.to-top');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('show', window.scrollY > 480);
  });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();
