/* Shared site shell: config, navigation, footer, chapter flow, scrolling, reveals and small canvas visuals.
   Every page loads this file right after <body>. Edit CONFIG and PAGES here and the whole site follows. */
(function () {
  const CONFIG = window.CONFIG = {
    brand: 'AE',                     // company mark, everywhere
    brandLong: 'Automated Engineering',
    email: 'umang@ucsb.edu',         // contact address, everywhere
    scene3dSeconds: 14               // home hero: time the live 3D scene stays up
  };
  // Site map, in reading order. Each page ends by handing off to the next one.
  const PAGES = [
    { key: 'home', href: 'index.html', title: 'Home', nav: false, pitch: 'Machines, designed by physics.' },
    { key: 'technology', href: 'technology.html', title: 'Technology', nav: true, pitch: 'How the engine turns a requirement into a verified part, and why it can’t fool itself.' },
    { key: 'applications', href: 'applications.html', title: 'Applications', nav: true, pitch: 'The machines the engine designs today, and the ones it is built to design next.' },
    { key: 'progress', href: 'progress.html', title: 'Progress', nav: true, pitch: 'What is verified, what is not yet, and what comes next.' },
    { key: 'company', href: 'company.html', title: 'Company', nav: true, pitch: 'Why we exist, how we work and who we are looking for.' },
    { key: 'contact', href: 'contact.html', title: 'Contact', nav: false, pitch: 'Design partners, investors and future teammates: start here.' },
  ];
  const page = document.body.dataset.page || 'home';
  const idx = PAGES.findIndex(p => p.key === page);
  const LOGO = '<svg viewBox="0 0 32 32" fill="none" stroke-width="1.5" aria-hidden="true"><path d="M16 2.5 27.5 9v14L16 29.5 4.5 23V9Z" stroke="#ff6a1a"/><path d="M4.5 9 16 15.5 27.5 9M16 15.5v14" stroke="#f1ebe3" stroke-opacity=".45"/></svg>';

  /* ---------- nav (rendered immediately, before content paints) ---------- */
  const navSlot = document.getElementById('site-nav');
  if (navSlot) navSlot.outerHTML = `
  <nav class="nav" id="nav"><div class="wrap">
    <a class="logo" href="index.html" aria-label="${CONFIG.brand} ${CONFIG.brandLong}, home">${LOGO}<span>${CONFIG.brand}</span><em class="logo-sub mono">${CONFIG.brandLong}</em></a>
    <div class="links mono">${PAGES.filter(p => p.nav).map(p => `<a href="${p.href}"${p.key === page ? ' class="cur" aria-current="page"' : ''}>${p.title}</a>`).join('')}</div>
    <a class="btn${page === 'contact' ? ' btn-hot' : ''}" href="contact.html">Contact</a>
    <span class="scrollbar" id="scrollbar"></span>
  </div></nav>`;

  /* ---------- footer + next chapter ---------- */
  function shell() {
    const nextSlot = document.getElementById('site-next');
    if (nextSlot && idx > -1 && idx < PAGES.length - 1) {
      const n = PAGES[idx + 1];
      nextSlot.outerHTML = `<a class="chapter" href="${n.href}"><div class="wrap grid">
        <div class="k mono"><b>Next</b>${String(idx + 2).padStart(2, '0')} / ${String(PAGES.length).padStart(2, '0')}</div>
        <div class="t">${n.title} <span class="ar">→</span></div>
        <div class="nd">${n.pitch}</div></div></a>`;
    } else if (nextSlot) nextSlot.remove();
    const f = document.getElementById('site-footer');
    if (f) f.outerHTML = `<footer><div class="wrap grid">
      <div class="f-brand"><a class="logo" href="index.html">${LOGO}<span>${CONFIG.brand}</span><em class="logo-sub mono">${CONFIG.brandLong}</em></a>
        <p>Machines, designed by physics. We are building the engine that designs hardware end to end, so it can move at the speed of software.</p></div>
      <div class="f-col f-c1 mono"><span class="h">Product</span><a href="technology.html">Technology</a><a href="applications.html">Applications</a><a href="progress.html">Progress</a></div>
      <div class="f-col f-c2 mono"><span class="h">Company</span><a href="company.html">About</a><a href="company.html#roles">Open roles</a><a href="contact.html">Contact</a></div>
      <div class="f-credit">Hero and page footage: NASA, public domain. Use does not imply NASA endorsement.<br>3D model and control-room values are illustrative.</div>
      <div class="f-bottom mono"><span>© ${new Date().getFullYear()} ${CONFIG.brand} · ${CONFIG.brandLong}</span>${CONFIG.email ? `<a href="mailto:${CONFIG.email}">${CONFIG.email}</a>` : '<a href="contact.html">Contact</a>'}</div>
    </div></footer>`;
    document.querySelectorAll('.brand').forEach(e => e.textContent = CONFIG.brand);
    // With an email set, buttons open a pre-addressed message; without one they say so plainly.
    document.querySelectorAll('.mailto').forEach(a => {
      if (CONFIG.email) a.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent((a.dataset.subject || '') + ' · ' + CONFIG.brand)}`;
      else { a.removeAttribute('href'); a.classList.add('soon'); a.innerHTML = 'Contact opens soon'; a.setAttribute('aria-disabled', 'true'); }
    });
    document.querySelectorAll('.email').forEach(e => { if (CONFIG.email) e.textContent = CONFIG.email; else e.remove(); });
  }

  /* ---------- helpers shared with page scripts ---------- */
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fit(c) { const r = c.getBoundingClientRect(), w = Math.round(r.width * DPR), h = Math.round(r.height * DPR); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return { w, h }; }
  function whileVisible(el, tick) {
    let on = false, id = 0, last = 0;
    const loop = t => { if (!on) return; tick(t, Math.min(.05, (t - last) / 1000)); last = t; id = requestAnimationFrame(loop); };
    new IntersectionObserver(([e]) => { if (e.isIntersecting && !on) { on = true; last = performance.now(); id = requestAnimationFrame(loop); } else if (!e.isIntersecting) { on = false; cancelAnimationFrame(id); } }, { rootMargin: '120px' }).observe(el);
  }
  function heat(t) { const s = [[40, 8, 4], [160, 30, 10], [255, 106, 26], [255, 190, 90], [255, 245, 220]]; t = Math.max(0, Math.min(.999, t)) * (s.length - 1); const i = t | 0, f = t - i, a = s[i], b = s[i + 1]; return `rgb(${a[0] + (b[0] - a[0]) * f | 0},${a[1] + (b[1] - a[1]) * f | 0},${a[2] + (b[2] - a[2]) * f | 0})`; }
  function rad(s) { if (s < 1.4) return .55; if (s < 1.95) { const t = (s - 1.4) / .55; return .22 + .33 * (.5 + .5 * Math.cos(Math.PI * t)); } const t = (s - 1.95) / 2.05; return .22 + .8 * (1 - Math.pow(1 - t, 2.3)); }

  // Small, quiet canvas visuals for domain cards: plate | hx | chamber | assembly | embers
  function viz(c, kind) {
    const x = c.getContext('2d'); let T = 0; const E = kind === 'embers' ? [...Array(120)].map(() => ({ x: Math.random(), y: Math.random(), s: Math.random() * .7 + .3, ph: Math.random() * 6 })) : null;
    whileVisible(c, (now, dt) => {
      T += dt; const { w: W, h: H } = fit(c); x.clearRect(0, 0, W, H); const t = T;
      if (kind === 'plate') { const cols = 44, rows = 22, cw = W * .78 / cols, ch = H * .55 / rows, ox = W * .11, oy = H * .08;
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const hs = Math.exp(-Math.pow(i - cols / 2, 2) / 80 - Math.pow(j - rows / 2, 2) / 30); x.globalAlpha = .6; x.fillStyle = heat(.12 + hs * .78 + .04 * Math.sin(t * 1.6 + i * .3 + j * .2)); x.fillRect(ox + i * cw, oy + j * ch, cw - 1.5 * DPR, ch - 1.5 * DPR); }
        x.globalAlpha = 1; x.strokeStyle = 'rgba(127,214,255,.45)'; x.lineWidth = DPR; x.setLineDash([3 * DPR, 9 * DPR]); x.lineDashOffset = -t * 30 * DPR;
        for (let k = 0; k < 5; k++) { const yy = oy + H * .55 * (k + .5) / 5; x.beginPath(); x.moveTo(W * .04, yy); x.bezierCurveTo(W * .4, yy - 6 * DPR, W * .6, yy + 6 * DPR, W * .96, yy); x.stroke(); } x.setLineDash([]); }
      else if (kind === 'hx') { const nx = 30, ny = 13; for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const px = W * (.06 + .88 * i / (nx - 1)), py = H * (.07 + .55 * j / (ny - 1)); const v = Math.sin(i * .55 + t * .8) * Math.cos(j * .7) + Math.sin(j * .55) * Math.cos(i * .5 - t * .5);
        x.fillStyle = v > 0 ? `rgba(255,106,26,${.12 + v * .32})` : `rgba(127,214,255,${.08 - v * .26})`; x.beginPath(); x.arc(px, py, Math.abs(v) * W * .008 + DPR, 0, 7); x.fill(); } }
      else if (kind === 'chamber') { const sc = H * .14, cx = W * .7, cy = H * .06; x.lineWidth = DPR;
        for (let j = 0; j <= 26; j++) { const s = 4 * j / 26, r = rad(s); x.beginPath(); for (let i = 0; i <= 40; i++) { const th = i / 40 * 6.283 + t * .35, X = r * Math.cos(th), Z = r * Math.sin(th), p = 5 / (5 + Z); const sx = cx + X * sc * p, sy = cy + (s + .2) * sc * p; i ? x.lineTo(sx, sy) : x.moveTo(sx, sy); }
          x.strokeStyle = heat(.3 + .65 * Math.exp(-Math.pow((s - 1.95) / .7, 2))); x.globalAlpha = .75; x.stroke(); } x.globalAlpha = 1; }
      else if (kind === 'assembly') { const e = (Math.sin(t * .7) + 1) / 2, P = [[0, 0, .3, .12], [0, -.17, .22, .07], [-.23, .02, .09, .2], [.23, .02, .09, .2], [0, .19, .36, .05], [0, -.3, .08, .07]];
        P.forEach((p, k) => { const px = W * (.5 + p[0] * (1 + e * .8)), py = H * (.36 + p[1] * (1 + e * .8)); x.strokeStyle = 'rgba(127,214,255,.14)'; x.setLineDash([3 * DPR, 5 * DPR]); x.beginPath(); x.moveTo(W * .5, H * .36); x.lineTo(px, py); x.stroke(); x.setLineDash([]);
          x.strokeStyle = k % 2 ? 'rgba(127,214,255,.7)' : 'rgba(255,106,26,.75)'; x.lineWidth = 1.2 * DPR; x.strokeRect(px - W * p[2] / 2, py - H * p[3] / 2, W * p[2], H * p[3]); }); }
      else if (kind === 'embers') { E.forEach(p => { p.y -= dt * .035 * p.s; if (p.y < -.02) { p.y = 1.02; p.x = Math.random(); } const px = W * (.45 + p.x * .55) + Math.sin(p.y * 9 + p.ph) * 14 * DPR;
        x.globalAlpha = .55 * p.s * Math.min(1, p.y * 3); x.fillStyle = heat(.35 + p.s * .55); x.beginPath(); x.arc(px, H * p.y, 1.3 * DPR * p.s, 0, 7); x.fill(); }); x.globalAlpha = 1; }
    });
  }

  // Control room demo (ledger + convergence + candidates)
  function controlRoom() {
    const led = document.getElementById('ledger'); if (!led) return;
    const L = [['Architect', 'a', 'proposed family: skived micro-fin, 0.15 mm fins'], ['Diversifier', 'a', 'added family: jet-impingement manifold'], ['Rule 1.3.0', 'pass', 'margins fixed: R ≤ 0.011 K/W, hotspot ≤ 87 °C'], ['Geometry', 'a', 'wrote plate T4 · 312 channels · CuCrZr'], ['Fast model', 'pass', 'T4 screened: R 0.0114 K/W, within uncertainty'], ['Tolerance', 'pass', 'worst-case fin −0.02 mm applied'], ['Coarse CFD', 'a', 'T4 meshed · 4.2 M cells · 150 ranks'], ['Judge', 'fail', 'T2 rejected: wall 112 °C over boiling margin'], ['Reviewer', 'a', 'requested a plenum grid study on T4'], ['Materials', 'pass', 'OF-Cu admitted · yield 34.5 MPa, cited'], ['Fine CFD', 'a', 'T4 round 2 started · self-check on'], ['Owner', 'halt', 'TIM not supplied → paused, notification sent'], ['Owner', 'pass', 'TIM supplied, run resumed'], ['Ledger', 'a', 'decision 4a48e70c written']];
    let li = 0, clock = 13 * 3600 + 42 * 60, on = false; const f = n => String(n).padStart(2, '0');
    const add = () => { const [w, c, m] = L[li++ % L.length]; clock += 7 + (Math.random() * 40 | 0); const r = document.createElement('div'); r.className = 'row'; r.innerHTML = `<span class="t">${f((clock / 3600 | 0) % 24)}:${f((clock / 60 | 0) % 60)}:${f(clock % 60)}</span><span class="${c}">${w}</span><span>${m}</span>`; led.prepend(r); if (led.children.length > 24) led.lastChild.remove(); };
    for (let i = 0; i < 10; i++) add(); setInterval(() => on && add(), 1900);
    new IntersectionObserver(([e]) => on = e.isIntersecting).observe(led);
    const cands = [['T1 skived fins', '0.0131', 'fail'], ['T2 jet impingement', '—', 'fail'], ['T3 printed TPMS', '0.0119', 'run'], ['T4 manifold micro-fin', '0.0114', 'run'], ['T5 split flow', '0.0122', 'run']];
    document.getElementById('cands').innerHTML = cands.map(c => `<tr><td>${c[0]}</td><td>${c[1]}</td><td><span class="tag" style="color:${c[2] === 'fail' ? 'var(--bad)' : 'var(--ember)'}">${c[2] === 'fail' ? 'Rejected' : 'In CFD'}</span></td></tr>`).join('');
    const cv = document.getElementById('conv'), cc = cv.getContext('2d'); let t = 0;
    whileVisible(cv, (now, dt) => { t += dt; const { w, h } = fit(cv); cc.clearRect(0, 0, w, h); const pad = 4 * DPR, y = v => h - pad - (v - .0102) / (.016 - .0102) * (h - pad * 2);
      cc.strokeStyle = 'rgba(143,227,168,.55)'; cc.setLineDash([4 * DPR, 5 * DPR]); cc.lineWidth = DPR; cc.beginPath(); cc.moveTo(0, y(.011)); cc.lineTo(w, y(.011)); cc.stroke(); cc.setLineDash([]);
      cc.fillStyle = '#8fe3a8'; cc.font = `${10 * DPR}px IBM Plex Mono`; cc.fillText('TARGET 0.011', 0, y(.011) - 8 * DPR);
      const n = 64, rev = Math.min(n, (t * 14) % (n + 40));
      [[.0156, .0117, '#ff6a1a'], [.015, .0123, '#7fd6ff'], [.0153, .0129, '#5f534b']].forEach(([a, b, col], k) => { cc.strokeStyle = col; cc.lineWidth = 1.6 * DPR; cc.lineJoin = 'round'; cc.beginPath();
        for (let i = 0; i <= rev; i++) { const X = i / n * w, v = b + (a - b) * Math.exp(-i / 15) + Math.sin(i * 1.1 + k * 2) * .00012 * Math.exp(-i / 40); i ? cc.lineTo(X, y(v)) : cc.moveTo(X, y(v)); }
        cc.stroke(); if (rev > 0) { const X = rev / n * w, v = b + (a - b) * Math.exp(-rev / 15); cc.fillStyle = col; cc.beginPath(); cc.arc(X, y(v), 3 * DPR, 0, 7); cc.fill(); } }); });
  }

  /* ---------- boot after the page body exists ---------- */
  function boot() {
    shell();
    requestAnimationFrame(() => document.documentElement.classList.add('ready'));
    // smooth scroll
    let lenis = null;
    if (window.Lenis && !reduce) {
      lenis = new Lenis({ duration: 1.15, easing: t => 1 - Math.pow(1 - t, 4), smoothWheel: true });
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
    }
    document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => { const id = a.getAttribute('href'); const el = id.length > 1 && document.querySelector(id); if (!el) return; e.preventDefault(); lenis ? lenis.scrollTo(el, { offset: -24 }) : el.scrollIntoView({ behavior: 'smooth' }); }));
    if (location.hash && lenis) { const el = document.querySelector(location.hash); if (el) setTimeout(() => lenis.scrollTo(el, { offset: -24, immediate: true }), 50); }
    window.Site.lenis = lenis;
    // chrome
    const nav = document.getElementById('nav'), bar = document.getElementById('scrollbar');
    const chrome = () => { const y = scrollY, h = document.documentElement.scrollHeight - innerHeight; nav && nav.classList.toggle('solid', y > 24); bar && (bar.style.transform = `scaleX(${h > 0 ? y / h : 0})`); };
    addEventListener('scroll', chrome, { passive: true }); chrome();
    // reveals + counters
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; e.target.classList.add('in'); io.unobserve(e.target);
      e.target.querySelectorAll('[data-count]').forEach(el => { const n = +el.dataset.count, t0 = performance.now(); (function f(t) { const p = Math.min(1, (t - t0) / 1600); el.textContent = Math.round(n * (1 - Math.pow(1 - p, 4))); if (p < 1) requestAnimationFrame(f); })(t0); });
    }), { threshold: .15, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.rv').forEach(el => io.observe(el));
    document.documentElement.classList.add('io');
    document.querySelectorAll('canvas[data-viz]').forEach(c => viz(c, c.dataset.viz));
    controlRoom();
  }
  window.Site = { CONFIG, PAGES, page, fit, whileVisible, heat, rad, viz, DPR, reduce };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
