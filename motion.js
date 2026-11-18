'use strict';
/* ===================== IRON MERIDIAN · HUD motion layer ===================== */
// Screen-space motion design that sits on top of the game without touching it: its own rAF loop, MutationObservers on the
// HUD the game already writes, and read-only peeks at game globals. Everything is guarded; nothing here may throw into the game.
// One easing family (fast-out, soft landing), short durations, and nothing loops in the play space except during freefall.
(function () {
  const W = window, D = document;
  const E_OUT = 'cubic-bezier(.16,1,.3,1)';
  const RMQ = W.matchMedia ? W.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const rm = () => !!(RMQ && RMQ.matches);
  const q = s => D.querySelector(s);
  const now = () => performance.now();
  const safe = fn => function () { try { return fn.apply(this, arguments); } catch (err) { /* motion must never break the game */ } };
  const anim = (el, kf, opt) => { try { return el && el.animate ? el.animate(kf, opt) : null; } catch (err) { return null; } };
  const observe = (el, fn, opt) => { try { if (el && W.MutationObserver) new W.MutationObserver(safe(fn)).observe(el, opt); } catch (err) { /* ignore */ } };
  const later = (fn, ms) => setTimeout(safe(fn), ms);
  const num = s => { const n = parseFloat(String(s).replace(/[^0-9.-]/g, '')); return isFinite(n) ? n : 0; };
  // live game globals (declared by later scripts in the shared scope); read defensively every time
  const G = () => {
    const o = {};
    try { o.P = typeof PLAYER !== 'undefined' ? PLAYER : null; } catch (err) { o.P = null; }
    try { o.S = typeof GAME !== 'undefined' ? GAME : null; } catch (err) { o.S = null; }
    try { o.C = typeof CPS !== 'undefined' ? CPS : null; } catch (err) { o.C = null; }
    try { o.M = typeof CMD !== 'undefined' ? CMD : null; } catch (err) { o.M = null; }
    try { o.F = typeof FRONT !== 'undefined' ? FRONT : null; } catch (err) { o.F = null; }
    return o;
  };

  /* ---------- tweens ---------- */
  const TW = [];
  const tween = (dur, fn, delay = 0, done) => { TW.push({ t0: now() + delay, dur, fn, done }); };
  const easeOut = p => 1 - Math.pow(1 - p, 3);
  function runTweens(t) {
    for (let i = TW.length - 1; i >= 0; i--) {
      const w = TW[i]; if (t < w.t0) continue; const p = Math.min(1, (t - w.t0) / w.dur);
      try { w.fn(easeOut(p)); } catch (err) { p; }
      if (p >= 1) { TW.splice(i, 1); try { if (w.done) w.done(); } catch (err) { /* ignore */ } }
    }
  }

  /* ---------- boot: message cross-fades, then the whole card dissolves instead of cutting ---------- */
  observe(q('#bootMsg'), () => { if (!rm()) anim(q('#bootMsg'), [{ opacity: 0, translate: '0 4px' }, { opacity: 1, translate: '0 0' }], { duration: 320, easing: E_OUT }); }, { childList: true, characterData: true, subtree: true });
  observe(D.body, recs => {
    for (const r of recs) for (const n of r.removedNodes) {
      if (n.id !== 'boot') continue;
      n.id = 'mBootGhost'; n.style.pointerEvents = 'none'; D.body.appendChild(n);
      const mark = n.querySelector('.bt-mark');
      if (!rm() && mark) anim(mark, [{ scale: 1, opacity: 1 }, { scale: 1.06, opacity: 0 }], { duration: 650, easing: E_OUT, fill: 'forwards' });
      const a = anim(n, [{ opacity: 1 }, { opacity: 0 }], { duration: rm() ? 250 : 800, delay: rm() ? 0 : 120, easing: 'ease-in-out', fill: 'forwards' });
      const kill = () => { try { n.remove(); } catch (err) { /* ignore */ } };
      if (a) a.onfinish = kill; later(kill, 1200);
      replayColumn(q('#menu'));
    }
  }, { childList: true });

  /* ---------- menu / deploy overlays ---------- */
  function replayColumn(ov) {
    if (!ov || ov.classList.contains('hidden')) return;
    for (const el of [ov, ...ov.querySelectorAll('.col>*')]) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
  }
  for (const id of ['#menu', '#deploy', '#showUI']) {
    const ov = q(id); if (!ov) continue; let was = !ov.classList.contains('hidden');
    observe(ov, () => {
      const vis = !ov.classList.contains('hidden'); if (vis === was) return; was = vis;
      if (!vis) { // the column slides away as a ghost while the battle comes forward
        const gh = D.createElement('div'); gh.className = 'm-ghost'; gh.style.zIndex = '5'; gh.style.background = W.getComputedStyle(ov).backgroundImage;
        D.body.appendChild(gh);
        const a = anim(gh, [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: rm() ? '0 0' : '-5% 0' }], { duration: rm() ? 200 : 460, easing: E_OUT, fill: 'forwards' });
        const kill = () => { try { gh.remove(); } catch (err) { /* ignore */ } }; if (a) a.onfinish = kill; later(kill, 900);
      } else if (id === '#deploy') tickStats(ov);
    }, { attributes: true, attributeFilter: ['class'] });
  }
  function tickStats(ov) { // after-action numbers count up, left to right
    if (rm()) return;
    [...ov.querySelectorAll('.stats b')].forEach((b, i) => {
      const txt = b.textContent, n = num(txt); if (n <= 0) return; const comma = /,/.test(txt) || n >= 1000;
      b.textContent = '0';
      tween(Math.min(1100, 450 + n * 0.4), p => { b.textContent = comma ? Math.round(n * p).toLocaleString() : String(Math.round(n * p)); }, 180 + i * 70);
    });
  }

  /* ---------- banner: kinetic typography ---------- */
  const bannerEl = q('#banner');
  function kinetic() {
    const t = bannerEl.querySelector('.t'), s = bannerEl.querySelector('.s');
    if (!t || !bannerEl.classList.contains('on') || !t.firstChild || t.firstChild.nodeType !== 3) return;
    let rule = bannerEl.querySelector('.m-rule'); if (!rule) { rule = D.createElement('div'); rule.className = 'm-rule'; bannerEl.insertBefore(rule, s); }
    if (rm()) { anim(bannerEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 }); return; }
    const text = t.textContent; const frag = D.createDocumentFragment(); let k = 0;
    text.split(' ').forEach((word, wi) => {
      if (wi) frag.appendChild(D.createTextNode(' '));
      const w = D.createElement('span'); w.className = 'm-w';
      for (const ch of word) { const c = D.createElement('span'); c.className = 'm-ch'; c.textContent = ch; c.style.animationDelay = Math.min(k++ * 22, 460) + 'ms'; w.appendChild(c); }
      frag.appendChild(w);
    });
    t.textContent = ''; t.appendChild(frag);
    anim(t, [{ letterSpacing: '.14em' }, { letterSpacing: '.04em' }], { duration: 900, easing: E_OUT });
    anim(rule, [{ transform: 'scaleX(0)', opacity: 0 }, { transform: 'scaleX(1)', opacity: 1 }], { duration: 700, delay: 140, easing: E_OUT, fill: 'backwards' });
    if (s) anim(s, [{ opacity: 0, letterSpacing: '.48em' }, { opacity: 1, letterSpacing: '.24em' }], { duration: 650, delay: 260, easing: E_OUT, fill: 'backwards' });
  }
  if (bannerEl) observe(bannerEl, kinetic, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });

  /* ---------- hit marker + kill confirm ---------- */
  const hitx = q('#hitx'), cross = q('#cross'), hud = q('#hud');
  const mk = (id, cls, tag, under) => { let e = q('#' + id); if (!e && hud) { e = D.createElement(tag || 'div'); e.id = id; if (cls) e.className = cls; if (under) hud.insertBefore(e, hud.firstChild); else hud.appendChild(e); } return e; };
  let lastHit = 0;
  if (hitx) observe(hitx, () => {
    if (!hitx.classList.contains('on')) return; const t = now(); if (t - lastHit < 45) return; lastHit = t;
    const kill = hitx.classList.contains('k');
    if (!rm() && cross) { cross.classList.add('m-kick'); later(() => cross.classList.remove('m-kick'), kill ? 120 : 60); }
    if (kill) {
      const ring = mk('mRing', 'm-ring'), ring2 = mk('mRing2', 'm-ring');
      if (rm()) { anim(ring, [{ opacity: 0.9 }, { opacity: 0 }], { duration: 400 }); return; }
      anim(ring, [{ opacity: 0.95, scale: 0.55 }, { opacity: 0, scale: 1.9 }], { duration: 520, easing: E_OUT });
      if (ring2) { ring2.style.borderWidth = '1px'; anim(ring2, [{ opacity: 0.6, scale: 0.5 }, { opacity: 0, scale: 2.6 }], { duration: 640, delay: 80, easing: E_OUT, fill: 'backwards' }); }
      anim(cross, [{ scale: 1.3 }, { scale: 1 }], { duration: 300, easing: E_OUT });
    }
  }, { attributes: true, attributeFilter: ['class'] });

  /* ---------- floating damage numbers: punch on every merged hit ---------- */
  observe(q('#dmg'), recs => {
    if (rm()) return; const seen = new Set();
    for (const r of recs) {
      const el = r.target.id === 'dmg' ? r.addedNodes[0] : r.target.closest && r.target.closest('.dn'); if (!el || el.nodeType !== 1 || seen.has(el)) continue; seen.add(el);
      const isK = el.classList.contains('k');
      if (isK && !el._mk) { el._mk = 1; anim(el, [{ scale: 1.5, filter: 'drop-shadow(0 0 10px rgba(255,181,71,.9))' }, { scale: 1, filter: 'drop-shadow(0 0 0 rgba(255,181,71,0))' }], { duration: 520, easing: E_OUT }); }
      else if (r.target !== el.parentNode) anim(el, [{ scale: 1.2 }, { scale: 1 }], { duration: 180, easing: E_OUT });
    }
  }, { childList: true, subtree: true, characterData: true });

  /* ---------- points popups tick up ---------- */
  observe(q('#pts'), recs => {
    if (rm()) return;
    for (const r of recs) for (const d of r.addedNodes) {
      const b = d.querySelector && d.querySelector('b'); if (!b) continue; const n = num(b.textContent); if (n <= 1) continue;
      b.textContent = '+0'; tween(Math.min(600, 220 + n * 2), p => { b.textContent = '+' + Math.round(n * p); });
    }
  }, { childList: true });

  /* ---------- hint: re-settle only when its meaning changes (not on distance ticks) ---------- */
  const hint = q('#hint'); let hintKey = '';
  observe(hint, () => {
    const key = hint.textContent.replace(/[\d,.]+/g, '#'); if (key === hintKey) return; hintKey = key;
    if (key && !rm()) anim(hint, [{ opacity: 0, translate: '0 -5px' }, { opacity: 1, translate: '0 0' }], { duration: 320, easing: E_OUT });
  }, { childList: true, characterData: true, subtree: true });

  /* ---------- squads + battle fronts panels ---------- */
  const sq = q('#squads'), fr = q('#fronts');
  const PEND = { sqRows: false, sqSel: 0, frRows: false };
  function stagger(rows, dx) { rows.forEach((r, i) => anim(r, [{ opacity: 0, translate: dx + 'px 0' }, { opacity: 1, translate: '0 0' }], { duration: 340, delay: i * 60, easing: E_OUT, fill: 'backwards' })); }
  function panel(el, rowSel, fromBottom, flag) {
    if (!el) return; let was = !el.classList.contains('hidden');
    observe(el, recs => {
      const vis = !el.classList.contains('hidden');
      if (vis !== was) { was = vis; if (vis && !rm()) { anim(el, [{ clipPath: fromBottom ? 'inset(100% 0 0 0)' : 'inset(0 0 100% 0)', opacity: 0 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }], { duration: 480, easing: E_OUT }); PEND[flag] = true; } }
      if (!recs.some(r => r.type === 'childList') || rm()) return;
      const rows = [...el.querySelectorAll(rowSel)];
      if (PEND[flag]) { PEND[flag] = false; stagger(rows, fromBottom ? -12 : 12); }
      else if (flag === 'sqRows' && PEND.sqSel > now()) { PEND.sqSel = 0; rows.filter(r => r.classList.contains('on')).forEach(r => anim(r, [{ backgroundColor: 'rgba(92,202,255,.38)', translate: '5px 0' }, { backgroundColor: 'rgba(11,12,14,.58)', translate: '0 0' }], { duration: 480, easing: E_OUT })); }
    }, { attributes: true, attributeFilter: ['class'], childList: true });
  }
  panel(sq, '.sqd', true, 'sqRows'); panel(fr, '.fr', false, 'frRows');

  /* ---------- number tick-ups painted over live values ---------- */
  const TICK = [];
  function tickInit() {
    for (const [id, rate] of [['#stHp', 16], ['#stPts', 7], ['#stDealt', 7], ['#stTaken', 9]]) {
      const el = q(id); if (!el || el._mtk) continue; el._mtk = 1;
      el.style.setProperty('--mc', W.getComputedStyle(el).color); el.classList.add('m-tk');
      const v = num(el.textContent); TICK.push({ el, rate, cur: v, shown: '' });
    }
  }
  function tickRun(dt) {
    for (const k of TICK) {
      const tgt = num(k.el.textContent); const loc = k.el.id !== 'stHp';
      if (rm() || Math.abs(tgt - k.cur) < 0.5) k.cur = tgt; else k.cur += (tgt - k.cur) * (1 - Math.exp(-dt * k.rate));
      const r = Math.round(k.cur), s = loc ? r.toLocaleString() : String(r);
      if (s !== k.shown) { k.shown = s; k.el.setAttribute('data-v', s); }
    }
  }

  /* ---------- lagging damage trails on ticket and health bars ---------- */
  const TRAIL = [];
  function trailInit() {
    for (const id of ['#barB', '#barR', '#stHpB']) {
      const el = q(id); if (!el || el._mtr || !el.parentNode) continue; el._mtr = 1;
      const s = D.createElement('span'); s.className = 'm-trail'; el.parentNode.appendChild(s);
      TRAIL.push({ el, s, v: 100, hold: 0, shown: -1 });
    }
  }
  function trailRun(dt) {
    for (const k of TRAIL) {
      const w = k.el.style.width; if (!w) continue; const real = parseFloat(w); if (!isFinite(real)) continue;
      if (real >= k.v || rm()) { k.v = real; k.hold = 0; }
      else if (k.hold < 0.5) k.hold += dt; else k.v = Math.max(real, k.v - dt * 40);
      const v = Math.round(k.v * 10) / 10; if (v !== k.shown) { k.shown = v; k.s.style.width = v + '%'; }
    }
  }

  /* ---------- freefall / drop pod / parachute: speed lines + wind ---------- */
  let fallCv = null, fctx = null, wind = null, flash = null, sweep = null, modeCard = null;
  const LINES = []; for (let i = 0; i < 80; i++) LINES.push({ a: Math.random() * 6.283, r: Math.random() * 1.2, v: 0.35 + Math.random() * 0.6, w: 0.6 + Math.random() * 0.9 });
  const FALL = { I: 0, L: 0, mode: '', podT: 0, wasPod: false, wasPara: false };
  function fxInit() {
    if (!hud || fallCv) return;
    sweep = mk('mSweep', '', 'div', true); flash = mk('mFlash', '', 'div', true); wind = mk('mWind', '', 'div', true); // under the HUD panels
    fallCv = mk('mFall', '', 'canvas', true); fctx = fallCv.getContext ? fallCv.getContext('2d') : null;
    modeCard = mk('mMode'); modeCard.innerHTML = '<small></small><b></b>';
  }
  function fallRun(dt, g) {
    const P = g.P, pe = P && P.ent, playing = g.S && g.S.state === 'play' && pe && pe.alive;
    let tI = 0, tL = 0, mode = '';
    if (playing) {
      if (P.pod) { tI = 0.9; tL = 1; mode = 'pod'; } else if (P.free) { tI = 0.8; tL = 0.85; mode = 'free'; }
      else if (P.para) { tI = 0.35; tL = 0.16; mode = 'para'; } else if (pe.mount && pe.mount.kind === 'plane') { tI = 0.16; mode = 'plane'; }
    }
    // landing beats: a hard pod impact, a soft parachute touchdown
    if (playing && P.pod) FALL.podT += dt;
    if (FALL.wasPod && !P.pod && playing && FALL.podT > 0.5) {
      anim(flash, [{ opacity: rm() ? 0.35 : 0.85 }, { opacity: 0 }], { duration: 650, easing: 'ease-out' });
      if (!rm()) anim(hud, [{ translate: '0 0' }, { translate: '0 8px', offset: 0.18 }, { translate: '0 -2px', offset: 0.55 }, { translate: '0 0' }], { duration: 460, easing: 'ease-out' });
    }
    if (FALL.wasPara && !P.para && !P.free && playing && !rm()) anim(hud, [{ translate: '0 0' }, { translate: '0 3px', offset: 0.3 }, { translate: '0 0' }], { duration: 340, easing: 'ease-out' });
    FALL.wasPod = !!(P && P.pod && playing); FALL.wasPara = !!(P && P.para && playing); if (!FALL.wasPod) FALL.podT = 0;
    if (mode) FALL.mode = mode;
    const k = 1 - Math.exp(-dt * (tI > FALL.I ? 3.5 : 2.2)); FALL.I += (tI - FALL.I) * k; FALL.L += (tL - FALL.L) * k;
    if (FALL.I < 0.004) FALL.I = 0; if (FALL.L < 0.004) FALL.L = 0;
    if (wind) {
      const op = FALL.I.toFixed(3); if (wind._op !== op) { wind._op = op; wind.style.opacity = op; }
      wind.classList.toggle('pod', FALL.mode === 'pod'); wind.classList.toggle('buffet', !rm() && FALL.I > 0.4);
    }
    if (!fallCv || !fctx) return;
    if (FALL.L <= 0 || rm()) { if (fallCv._on) { fallCv._on = false; fallCv.style.opacity = '0'; fctx.clearRect(0, 0, fallCv.width, fallCv.height); } return; }
    const w = Math.max(2, Math.round(W.innerWidth / 2)), h = Math.max(2, Math.round(W.innerHeight / 2));
    if (fallCv.width !== w || fallCv.height !== h) { fallCv.width = w; fallCv.height = h; }
    if (!fallCv._on) { fallCv._on = true; fallCv.style.opacity = '1'; }
    fctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, R = Math.hypot(cx, cy), L = FALL.L, n = Math.round(LINES.length * Math.min(1, 0.35 + L));
    const col = FALL.mode === 'pod' ? '255,214,170' : '236,242,250';
    fctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const s = LINES[i]; s.r += s.v * dt * (0.5 + 1.9 * L);
      if (s.r > 1.25) { s.r = 0.3 + Math.random() * 0.25; s.a = Math.random() * 6.283; s.v = 0.35 + Math.random() * 0.6; }
      const fade = Math.min(1, Math.max(0, (s.r - 0.42) / 0.25)); if (fade <= 0) continue;
      const len = (0.05 + 0.2 * L) * s.v, ca = Math.cos(s.a), sa = Math.sin(s.a), r0 = s.r * R, r1 = (s.r + len) * R;
      fctx.strokeStyle = `rgba(${col},${(0.42 * L * fade).toFixed(3)})`; fctx.lineWidth = s.w;
      fctx.beginPath(); fctx.moveTo(cx + ca * r0, cy + sa * r0 * 0.8); fctx.lineTo(cx + ca * r1, cy + sa * r1 * 0.8); fctx.stroke();
    }
  }

  /* ---------- ride hop-on / hop-off ---------- */
  const RIDE = { key: null, live: false };
  const HERO = { fighter: 'Starfighter', walker: 'Walker', speeder: 'Speeder', shiftframe: 'Shiftframe', monster: 'Gorgauth · Titan' };
  function rideKey(P) {
    const pe = P.ent; if (P.hero) return 'hero:' + pe.kind;
    const m = pe.mount; if (m && m.kind !== 'lift') return 'mount:' + m.kind + ':' + (m.name || '');
    return 'foot';
  }
  function showMode(top, name) {
    if (!modeCard) return; modeCard.firstChild.textContent = top; modeCard.lastChild.textContent = name;
    anim(modeCard, [{ opacity: 0, translate: rm() ? '-50% 0' : '-50% 8px' }, { opacity: 1, translate: '-50% 0', offset: 0.14 }, { opacity: 1, translate: '-50% 0', offset: 0.78 }, { opacity: 0, translate: '-50% 0' }], { duration: 1900, easing: 'ease-out' });
    if (!rm()) anim(modeCard.lastChild, [{ letterSpacing: '.34em' }, { letterSpacing: '.08em' }], { duration: 650, easing: E_OUT });
  }
  function rideFx(prev, key, P) {
    const pe = P.ent;
    if (key.startsWith('hero:')) showMode('Now piloting', HERO[pe.kind] || 'Ride');
    else if (key.startsWith('mount:')) { const m = pe.mount; showMode(m.kind === 'transport' ? 'Driving' : m.kind === 'plane' ? 'Aboard' : 'Riding', m.name || m.kind); }
    else if (prev.startsWith('hero:')) showMode('On foot', 'Commander');
    else if (prev.indexOf('mount:transport') === 0) showMode('Dismounted', 'Commander');
    else return; // stepping off the plane is a jump: the freefall layer carries that beat
    if (rm()) return;
    anim(sweep, [{ opacity: 0, transform: 'translateY(-30vh)' }, { opacity: 1, offset: 0.2 }, { opacity: 0, transform: 'translateY(100vh)' }], { duration: 560, easing: 'cubic-bezier(.5,0,.3,1)' });
    [q('#status'), q('#abil')].forEach((el, i) => anim(el, [{ opacity: 0, translate: '0 10px' }, { opacity: 1, translate: '0 0' }], { duration: 460, delay: 120 + i * 70, easing: E_OUT, fill: 'backwards' }));
  }
  function rideRun(g) {
    const P = g.P, pe = P && P.ent, playing = g.S && g.S.state === 'play' && pe && pe.alive;
    if (!playing) { RIDE.key = null; return; }
    const key = rideKey(P); if (RIDE.key !== null && key !== RIDE.key) rideFx(RIDE.key, key, P); RIDE.key = key;
  }

  /* ---------- game-state beats: HUD reveal on deploy, dim on death ---------- */
  const ST = { state: null };
  function stateRun(g) {
    const s = g.S && g.S.state; if (!s || !hud) return;
    if (s !== ST.state) {
      if (s === 'play' && ST.state !== null) { hud.classList.remove('m-in'); void hud.offsetWidth; hud.classList.add('m-in'); later(() => hud.classList.remove('m-in'), 1400); }
      hud.classList.toggle('m-dead', s === 'dead'); ST.state = s;
    }
  }

  /* ---------- capture progress + command post flips ---------- */
  const CAP = { w: '', t: 0, owners: new WeakMap() };
  const capEl = q('#capture'), capFill = q('#capFill');
  function capRun(g) {
    const t = now();
    if (capEl && capFill && !capEl.classList.contains('hidden')) { const w = capFill.style.width; if (w !== CAP.w) { CAP.w = w; CAP.t = t; } }
    if (capEl) capEl.classList.toggle('m-moving', t - CAP.t < 350 && !rm());
    if (!g.C) return;
    for (const c of g.C) {
      const prev = CAP.owners.get(c); CAP.owners.set(c, c.owner); if (prev === undefined || prev === c.owner) continue;
      const glow = (c.owner && typeof TEAM_CSS !== 'undefined' && TEAM_CSS[c.owner]) || 'rgba(236,230,217,.7)';
      const kf = rm() ? [{ filter: 'brightness(2)' }, { filter: 'brightness(1)' }] : [{ scale: 1.4, filter: 'brightness(2.2)' }, { scale: 1, filter: 'brightness(1)' }];
      anim(c.chip, kf, { duration: 750, easing: E_OUT }); anim(c.mk, kf, { duration: 750, easing: E_OUT });
      const nm = q('#capName');
      if (capEl && !capEl.classList.contains('hidden') && nm && nm.textContent.indexOf(c.name) === 0) anim(capEl, [{ boxShadow: `0 0 0 1px ${glow}, 0 0 26px ${glow}` }, { boxShadow: '0 0 0 1px rgba(0,0,0,0), 0 0 0 rgba(0,0,0,0)' }], { duration: 900, easing: E_OUT });
    }
  }

  /* ---------- damage direction arcs pulse on each fresh hit ---------- */
  let arcs = null;
  function dirRun() {
    if (!arcs) arcs = [...D.querySelectorAll('#dirs i')];
    const t = now();
    for (const el of arcs) {
      if (!el._t || el._t === el._mt) continue; el._mt = el._t; if (rm() || t - (el._mp || 0) < 260) continue; el._mp = t;
      anim(el, [{ scale: 1.14, filter: 'drop-shadow(0 0 10px rgba(255,60,20,1)) brightness(1.5)' }, { scale: 1, filter: 'drop-shadow(0 0 4px rgba(255,40,0,.8)) brightness(1)' }], { duration: 340, easing: E_OUT });
    }
  }

  /* ---------- squad selection + front rotation watchers ---------- */
  const WATCH = { sel: null, modes: '', fronts: '' };
  function watchRun(g) {
    if (g.M && g.M.teams) {
      const modes = g.M.teams.map(t => t.mode).join(',');
      if (WATCH.sel !== null && (g.M.sel !== WATCH.sel || modes !== WATCH.modes)) PEND.sqSel = now() + 900;
      WATCH.sel = g.M.sel; WATCH.modes = modes;
    }
    if (g.F && g.F.list) { const ids = g.F.list.map(f => f.cp && f.cp.id).join(','); if (WATCH.fronts && ids !== WATCH.fronts) PEND.frRows = true; WATCH.fronts = ids; }
  }

  /* ---------- the loop ---------- */
  let last = now();
  function loop() {
    requestAnimationFrame(loop);
    const t = now(), dt = Math.min(0.1, (t - last) / 1000); last = t;
    try {
      if (D.getElementById('boot')) return; // nothing to animate behind the boot card
      fxInit(); tickInit(); trailInit();
      const g = G();
      runTweens(t); stateRun(g); tickRun(dt); trailRun(dt); fallRun(dt, g); rideRun(g); capRun(g); dirRun(); watchRun(g);
    } catch (err) { /* motion must never break the game */ }
  }
  requestAnimationFrame(loop);
})();
