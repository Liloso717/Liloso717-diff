'use strict';
/* ===================== IRON MERIDIAN · player, camera, HUD, loop ===================== */
const PLAYER = {
  ent: null, role: 'trooper', yaw: 0, pitch: -0.05, vy: 0, grounded: true, weapon: 0, ammo: 40, mag: 40, reload: 0, rockets: 5, nades: 3,
  orbCd: 20, nadeCd: 0, fireCd: 0, rocketCd: 0, kills: 0, deaths: 0, caps: 0, aimYaw: 0, aimPitch: 0, throttle: 110, boost: 1, lockT: 0, lockTarget: null,
  mslCd: 0, mslAmmo: 6, dealt: 0, taken: 0, lifeDealt: 0, lifeTaken: 0, wCd: 0, wmCd: 0, deadT: 0, deathPos: new V3(), hurt: 0, ads: false, camPos: new V3(), camLook: new V3(), camInit: false,
};
const ROLES = [ // one role: the Hero. Powers instead of guns, flight instead of rides, and a destroyer's helm on the pier.
  { id: 'trooper', ic: 'C', nm: 'Commander', ds: 'Cape, gauntlets and no gun on you anywhere. Space and you are flying, from anywhere. The Force pulls a car off the street and throws it. Five powers on your aim point: a tornado, a hurricane, a comet, a thunder strike and an air strike. None of it can touch a civilian.', st: '160 HP' },
];
const KEYS = [['W A S D', 'Move · flying: steer'], ['Mouse', 'Aim'], ['Space', 'FLY · press it anywhere, press it again to drop'], ['Shift', 'Fly faster'], ['X', 'Descend while flying'], ['F', 'The Force: pull a car to you, press again to throw it'], ['1', 'Tornado'], ['2', 'Hurricane'], ['3', 'Comet'], ['4', 'Thunder strike'], ['5', 'Air strike'], ['Right click (flying)', 'Dive: fold up and smash down where you look'], ['Land and stay', 'On a catastrophe: defuse it · by a downed civilian: get them up · in a Hero district: muster a convoy'], ['F9', 'Unstick: reset the camera and put you back on your feet']];

/* ---------------- input ---------------- */
const keys = {}; const mouse = { dx: 0, dy: 0, b: [false, false, false], pressed: [false, false, false] };
let locked = false, lockFailed = false;
const TOUCH = { on: false, mx: 0, my: 0, stickId: null, lookId: null, sx: 0, sy: 0, lx: 0, ly: 0 };
/* While you play, only the kit reaches the game: flight, the Force and the five powers. Every other key that used
   to do something (weapons, orders, raids, vehicles, cameras, the map) is simply not listened to. */
const PLAY_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyX', 'KeyF', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Escape', 'F9']);
addEventListener('keydown', e => {
  if (e.code === 'Tab') e.preventDefault();
  if ((GAME.state === 'play' || GAME.state === 'dead') && !PLAY_KEYS.has(e.code)) return;
  keys[e.code] = true;
  if (e.code === 'KeyP' && (GAME.state === 'play' || GAME.state === 'spectate')) toggleSpectate();
  if (e.code === 'Enter' && GAME.state === 'spectate') showMenu();
  if (e.code === 'Escape' && GAME.state === 'showcase') { unShow(); showMenu(); }
  if (e.code === 'Space' && GAME.state === 'play') e.preventDefault();
  /* (E and T used to ride, revive, dismount and transform: none of that is on the keys any more) */
});
/* Taps are latched: a quick press (a touch pad sends its release 140 ms later) used to be wiped out by the release when
   a frame ran long, so a power button sometimes did nothing. Now a press always survives at least one full frame. */
const TAP_KEYS = new Set(['Space', 'KeyF', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5']); let UPQ = new Set(), UPQ_NEXT = new Set();
addEventListener('keyup', e => { if (TAP_KEYS.has(e.code) && keys[e.code]) UPQ_NEXT.add(e.code); else keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.b = [false, false, false]; });
addEventListener('mousemove', e => { if (locked || (lockFailed && GAME.state === 'play')) { mouse.dx += e.movementX || 0; mouse.dy += e.movementY || 0; } });
canvas.addEventListener('mousedown', e => {
  audioInit(); if (GAME.state === 'showcase') { SHOWCASE.drag = true; return; }
  if (GAME.state === 'spectate') { showMenu(); return; }
  if (GAME.state === 'play' && !locked && !lockFailed && !TOUCH.on) { requestLock(); return; }
  mouse.b[e.button] = true; mouse.pressed[e.button] = true;
  /* left click fires the laser eyes (lasers.js); the Force is on F */
});
addEventListener('mouseup', e => { mouse.b[e.button] = false; SHOWCASE.drag = false; });
addEventListener('mousemove', e => { if (SHOWCASE.drag && GAME.state === 'showcase') { SHOWCASE.ang -= (e.movementX || 0) * 0.008; SHOWCASE.pitch = clamp(SHOWCASE.pitch + (e.movementY || 0) * 0.005, -0.3, 0.9); } });
canvas.addEventListener('wheel', e => { if (GAME.state === 'play') { PLAYER.camDist = clamp((PLAYER.camDist || 7) * (1 + Math.sign(e.deltaY) * 0.12), 2.6, 16); e.preventDefault(); } else if (GAME.state === 'showcase') { SHOWCASE.dist = clamp(SHOWCASE.dist * (1 + Math.sign(e.deltaY) * 0.1), 1.4, 9); e.preventDefault(); } }, { passive: false });
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('pointerlockchange', () => { const was = locked; locked = document.pointerLockElement === canvas; if (was && !locked && GAME.state === 'play' && !lockFailed && !TOUCH.on) { showMenu(); $('#bDeploy').textContent = 'Resume'; } if (locked) $('#bDeploy').textContent = 'Deploy'; });
document.addEventListener('pointerlockerror', () => { lockFailed = true; });
function requestLock() { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { lockFailed = true; }); } catch (err) { lockFailed = true; } }
// touch
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
  TOUCH.on = true;
  const stick = $('#stick');
  canvas.addEventListener('touchstart', e => {
    audioInit(); if (GAME.state === 'spectate') { showMenu(); return; }
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth * 0.45 && TOUCH.stickId === null) { TOUCH.stickId = t.identifier; TOUCH.sx = t.clientX; TOUCH.sy = t.clientY; stick.style.display = 'block'; stick.style.left = (t.clientX - 55) + 'px'; stick.style.top = (t.clientY - 55) + 'px'; }
      else if (TOUCH.lookId === null) { TOUCH.lookId = t.identifier; TOUCH.lx = t.clientX; TOUCH.ly = t.clientY; }
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === TOUCH.stickId) { const dx = clamp((t.clientX - TOUCH.sx) / 50, -1, 1), dy = clamp((t.clientY - TOUCH.sy) / 50, -1, 1); TOUCH.mx = dx; TOUCH.my = dy; stick.firstElementChild.style.transform = `translate(${dx * 33}px,${dy * 33}px)`; }
      if (t.identifier === TOUCH.lookId) { mouse.dx += (t.clientX - TOUCH.lx) * 2.2; mouse.dy += (t.clientY - TOUCH.ly) * 2.2; TOUCH.lx = t.clientX; TOUCH.ly = t.clientY; }
    }
  }, { passive: true });
  const end = e => { for (const t of e.changedTouches) { if (t.identifier === TOUCH.stickId) { TOUCH.stickId = null; TOUCH.mx = TOUCH.my = 0; stick.style.display = 'none'; stick.firstElementChild.style.transform = ''; } if (t.identifier === TOUCH.lookId) TOUCH.lookId = null; } };
  canvas.addEventListener('touchend', end); canvas.addEventListener('touchcancel', end);
  const hold = (id, on, off) => { const el = $(id); el.addEventListener('touchstart', e => { e.preventDefault(); on(); }, { passive: false }); el.addEventListener('touchend', e => { e.preventDefault(); off(); }); };
  // the kit on glass: the Force under the thumb, flight round it, the five powers above. Taps replay the keyboard, so
  // touch and keys share one code path.
  const key = (code, down) => window.dispatchEvent(new window.KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
  const tap = (id, code) => { const el = $(id); if (el) el.addEventListener('touchstart', e => { e.preventDefault(); key(code, true); setTimeout(() => key(code, false), 140); }, { passive: false }); };
  tap('#tForce', 'KeyF'); tap('#tFly', 'Space');
  { const d = $('#tDive'); if (d) d.addEventListener('touchstart', e => { e.preventDefault(); POW.diveReq = true; }, { passive: false }); } /* latched: the flight step reads it */
  tap('#tP1', 'Digit1'); tap('#tP2', 'Digit2'); tap('#tP3', 'Digit3'); tap('#tP4', 'Digit4'); tap('#tP5', 'Digit5');
  hold('#tDown', () => { keys.KeyX = true; }, () => { keys.KeyX = false; });
  $('#tBoost').addEventListener('touchstart', e => { e.preventDefault(); keys.ShiftLeft = !keys.ShiftLeft; $('#tBoost').classList.toggle('on', keys.ShiftLeft); }, { passive: false });
  window.setInterval(() => { /* the power pads dim while they recharge, and say how long */
    if (typeof KIT === 'undefined') return;
    KIT.forEach(([slot, name], i) => { const el = $('#tP' + (i + 1)); if (!el) return; const cd = GOD.cd[slot] || 0; el.classList.toggle('cd', cd > 0); el.dataset.cd = cd > 0 ? Math.ceil(cd) : ''; });
    $('#tFly').classList.toggle('on', !!POW.fly); $('#tForce').classList.toggle('on', !!POW.tk);
    $('#touch').classList.toggle('flying', !!POW.fly || !!POW.dive); { const d = $('#tDive'); if (d) { d.classList.toggle('cd', GOD.cd.dive > 0); d.dataset.cd = GOD.cd.dive > 0 ? Math.ceil(GOD.cd.dive) : ''; } }
  }, 250);
}
function axis() {
  let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  if (TOUCH.on) { f -= TOUCH.my; s += TOUCH.mx; }
  return { f: clamp(f, -1, 1), s: clamp(s, -1, 1) };
}

/* ---------------- ray casting ---------------- */
function rayCast(o, d, maxD, skip, team) {
  let best = maxD, ent = null, bld = null, water = false;
  for (const e of ENTS) {
    if (!e.alive || e === skip || !e.hitR || e.team === team) continue;
    if (e.kind === 'monster' || e.kind === 'walker') { const R = e.kind === 'monster' ? 13 : 5, Hc = e.kind === 'monster' ? 50 : 22; const ox = o.x - e.pos.x, oz = o.z - e.pos.z, a = d.x * d.x + d.z * d.z, b = ox * d.x + oz * d.z, c = ox * ox + oz * oz - R * R, h = b * b - a * c; if (h > 0 && a > 1e-6) { const t = (-b - Math.sqrt(h)) / a, y = o.y + d.y * t; if (t > 0 && t < best && y > e.pos.y && y < e.pos.y + Hc) { best = t; ent = e; } } continue; }
    e.aim(_v1); const r = e.radius * (e.kind === 'soldier' ? 1 : 1.1);
    _v2.subVectors(o, _v1); const b = _v2.dot(d), c = _v2.dot(_v2) - r * r, h = b * b - c;
    if (h > 0) { const t = -b - Math.sqrt(h); if (t > 0 && t < best) { best = t; ent = e; } }
  }
  for (const B of BUILDINGS) {
    if (!B.alive) continue;
    const cx = (B.x0 + B.x1) / 2 - o.x, cy = (B.gy + B.top) / 2 - o.y, cz = (B.z0 + B.z1) / 2 - o.z, R2 = (B.w * B.w + B.d * B.d + B.h * B.h) / 4, tc = cx * d.x + cy * d.y + cz * d.z;
    if (tc < -B.h - B.w - B.d || tc * tc > (best + 80) * (best + 80) && tc > 0 || cx * cx + cy * cy + cz * cz - tc * tc > R2) continue; // ray misses the bounding sphere
    let tmin = 0, tmax = best, ok = true;
    for (let k = 0; k < 3 && ok; k++) {
      const oo = k === 0 ? o.x : k === 1 ? o.y : o.z, dd = k === 0 ? d.x : k === 1 ? d.y : d.z, lo = k === 0 ? B.x0 : k === 1 ? B.gy : B.z0, hi = k === 0 ? B.x1 : k === 1 ? B.top : B.z1;
      if (Math.abs(dd) < 1e-8) { if (oo < lo || oo > hi) ok = false; continue; }
      let t1 = (lo - oo) / dd, t2 = (hi - oo) / dd; if (t1 > t2) { const q = t1; t1 = t2; t2 = q; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) ok = false;
    }
    if (ok && tmin > 0 && tmin < best) { best = tmin; bld = B; ent = null; }
  }
  let prev = 0;
  for (let t = 1; t < best; t += t < 200 ? 2 : 5) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    if (y < groundY(x, z)) { let lo = prev, hi = t; for (let k = 0; k < 7; k++) { const m = (lo + hi) / 2; if (o.y + d.y * m < groundY(o.x + d.x * m, o.z + d.z * m)) hi = m; else lo = m; } best = hi; ent = null; bld = null; water = H(o.x + d.x * hi, o.z + d.z * hi) < 0; break; }
    prev = t;
  }
  return { t: best, point: o.clone().addScaledVector(d, best), ent, bld, water };
}

/* ---------------- player lifecycle ---------------- */
function spawnPlayer() { // every player is the Commander; vehicles and the Titan are rides (rides.js)
  if (PLAYER.hero) hopOff(); if (PLAYER.ent && PLAYER.ent.alive) PLAYER.ent.isPlayer = false;
  const P = PLAYER; P.role = 'trooper'; applyPerks();
  const e = new Soldier(1, true); e.spawnAt(spawnPoint(1, frontPost()));
  Object.assign(P, { yaw: 0, pitch: -0.05, ammo: P.mag, rockets: P.maxRockets, nades: P.maxNades, reload: 0, vy: -45, pod: true, grounded: false, free: false, para: false });
  e.pos.y += 60; // drop pod: the only way in
  e.isPlayer = true; e.name = 'You'; e.spawnGuard = TIME + 2.5; e.spawnT = TIME; if (!ENTS.includes(e)) addEnt(e);
  Object.assign(P, { ent: e, camInit: false, hurt: 0, lifeDealt: 0, lifeTaken: 0 });
  GAME.state = 'play'; hideOverlays(); setCine(false); $('#hud').classList.remove('hidden');
  if (TOUCH.on) $('#touch').classList.remove('hidden');
  const fp = frontPost(); const where = fp && fp !== 'hq' ? fp.name + ' (front line)' : 'Meridian HQ';
  comms('COMMAND', `Boots on the ground at ${where}. Move to the objective.`, 'cmd');
  P.orbCd = Math.max(P.orbCd, 10);
  cmdOnSpawn(e.pos);
}
function onPlayerHurt(a, src) {
  cmdThreat(src); PLAYER.hurt = Math.min(1, PLAYER.hurt + a / 60); PLAYER.taken += a; PLAYER.lifeTaken += a;
  const box = $('#inc'); let row = box.firstChild && box.firstChild._src === src && box.firstChild._t > TIME - 0.6 ? box.firstChild : null;
  if (!row) { row = document.createElement('div'); row._amt = 0; row._src = src; box.insertBefore(row, box.firstChild); while (box.children.length > 5) box.lastChild.remove(); const r = row; setTimeout(() => { r.style.opacity = '0'; r.style.transform = 'translateX(-10px)'; }, 2200); setTimeout(() => r.remove(), 2900); }
  row._amt += a; row._t = TIME; row.innerHTML = `−${Math.round(row._amt)}<small>${src && src.name && src !== PLAYER.ent ? src.name : 'blast'}</small>`;
  if (src && src.pos && src !== PLAYER.ent) { const arcs = DIR_ARCS(); const el = arcs.find(x => x._src === src) || arcs.reduce((o, x) => (x._t || 0) < (o._t || 0) ? x : o, arcs[0]); el._src = src; el._t = TIME; el.style.opacity = '1'; el._fade = 1.4; }
}
const DMGN = []; let _arcs = null; const DIR_ARCS = () => _arcs || (_arcs = [...document.querySelectorAll('#dirs i')]);
function awardPoints(n, label) {
  if (STATION.on) { n *= 2; label += ' ×2'; } PLAYER.points = (PLAYER.points || 0) + n; addXP(n); const box = $('#pts'); const d = document.createElement('div'); d.innerHTML = `<b>+${n}</b>${label}`; box.insertBefore(d, box.firstChild);
  while (box.children.length > 4) box.lastChild.remove(); setTimeout(() => { d.style.opacity = '0'; d.style.transform = 'translateY(-10px)'; }, 1800); setTimeout(() => d.remove(), 2600);
}
let plateEnt = null;
function updatePlate() {
  const el = $('#plate'); if (!plateEnt || !plateEnt.alive || GAME.state !== 'play') { el.classList.add('hidden'); return; }
  plateEnt.aim(_v1); _v1.y += plateEnt.radius + 0.6; _v1.project(camera); if (_v1.z > 1) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden'); el.style.left = ((_v1.x + 1) / 2 * innerWidth) + 'px'; el.style.top = ((1 - _v1.y) / 2 * innerHeight) + 'px'; $('#plHp').style.width = (plateEnt.hp / plateEnt.maxHp * 100) + '%';
}
function dmgNumber(ent, a, kill, kind) {
  if (!kind || kind === 'crit') { PLAYER.dealt += a; PLAYER.lifeDealt += a; }
  let n = DMGN.find(d => d.ent === ent && d.t < 0.45);
  if (!n) { if (DMGN.length > 26) { const o = DMGN.shift(); o.div.remove(); } const div = document.createElement('div'); div.className = 'dn'; $('#dmg').appendChild(div); n = { ent, div, amt: 0, t: 0, pos: new V3(), jx: rand(30, 60), kill: false }; DMGN.push(n); }
  n.amt += a; n.t = 0; n.kill = n.kill || kill; ent.aim(n.pos);
  if (kind === 'crit') n.crit = true;
  n.div.textContent = kind === 'shield' ? 'SHIELDED' : kind === 'armor' ? 'NO EFFECT · USE ROCKETS' : (n.crit ? 'CRIT ' : '') + Math.max(1, Math.round(n.amt)); n.div.className = 'dn' + (n.kill ? ' k' : n.amt >= 150 ? ' big' : '') + (n.crit ? ' crit' : '') + (kind && kind !== 'crit' ? ' sh' : '');
}
function updateDamageUI(dt) {
  for (let i = DMGN.length - 1; i >= 0; i--) {
    const n = DMGN[i]; n.t += dt; if (n.t > 1.3) { n.div.remove(); DMGN.splice(i, 1); continue; }
    _v1.copy(n.pos); _v1.y += 0.6 + n.t * (n.ent.radius * 0.4 + 0.8); _v1.project(camera);
    if (_v1.z > 1) { n.div.style.display = 'none'; continue; } n.div.style.display = 'block';
    n.div.style.left = ((_v1.x + 1) / 2 * innerWidth + n.jx) + 'px'; n.div.style.top = ((1 - _v1.y) / 2 * innerHeight) + 'px';
    n.div.style.opacity = n.t < 0.9 ? 1 : 1 - (n.t - 0.9) / 0.4; n.div.style.transform = `translate(-50%,-50%) scale(${n.t < 0.1 ? 1.4 - n.t * 4 : 1})`;
  }
  const pe = PLAYER.ent; camDir(_v2); const cy = Math.atan2(_v2.x, _v2.z);
  for (const el of DIR_ARCS()) {
    if (!el._fade) continue; el._fade -= dt; if (el._fade <= 0 || !pe || GAME.state !== 'play') { el._fade = 0; el.style.opacity = '0'; continue; }
    const s = el._src; if (s && s.pos) { const a = Math.atan2(s.pos.x - pe.pos.x, s.pos.z - pe.pos.z) - cy; el.style.transform = `rotate(${-a}rad)`; }
    el.style.opacity = Math.min(1, el._fade);
  }
}
function onPlayerDeath(src) {
  PLAYER.deaths++; STK.n = 0; PLAYER.pod = false; PLAYER.free = false; PLAYER.para = false; GAME.state = 'dead'; PLAYER.deadT = 0; PLAYER.killer = src; PLAYER.deathPos.copy(PLAYER.ent.pos);
  $('#dpWhy').textContent = 'Killed in action'; $('#dpTitle').textContent = src && src !== PLAYER.ent && src.name ? `${src.name} got you` : 'Redeploy';
  if (document.pointerLockElement) document.exitPointerLock();
}
let hmT = 0;
function hitMarker(kill) { if (!kill) snd('ui', null, 0.06); const x = $('#hitx'); x.classList.add('on'); x.classList.toggle('k', !!kill); hmT = kill ? 0.35 : 0.12; if (kill) snd('ui', null, 0.25); }

/* ---------------- player control ---------------- */
function updatePlayer(dt) {
  const P = PLAYER, e = P.ent; if (!e || !e.alive) return;
  const sens = 0.0022 * (P.ads ? 0.55 : 1) * (typeof LZ !== 'undefined' && LZ.zoom ? 0.2 : 1); /* steady hands in the scope */ const dx = mouse.dx, dy = mouse.dy; mouse.dx = mouse.dy = 0;
  P.hurt = Math.max(0, P.hurt - dt * 0.8);
  P.orbCd = Math.max(0, P.orbCd - dt);
  if (P.role === 'trooper' && e.mount && e.mount.kind !== 'bird') mountCtl(dt, dx * 0.0022, dy * 0.0022);
  else if (P.role === 'trooper') trooper(dt, dx * sens, dy * sens);
  if (P.role === 'trooper' && e.hp < e.maxHp && e.hurtT <= 0) e.hp = Math.min(e.maxHp, e.hp + dt * (P.regenT > 4 ? 12 : 0));
  P.regenT = e.hurtT > 0 ? 0 : (P.regenT || 0) + dt;
  mouse.pressed[0] = mouse.pressed[1] = mouse.pressed[2] = false;
}
const camDir = out => camera.getWorldDirection(out);
function trooper(dt, dx, dy) {
  const P = PLAYER, e = P.ent;
  P.yaw -= dx; P.pitch = clamp(P.pitch - dy, -1.3, 1.15);
  P.ads = false;
  const { f, s } = axis();
  const sprint = !(keys.ShiftLeft || keys.ShiftRight) && f > 0 && !P.ads; P.sprint = sprint; /* auto-sprint: always at a run when moving forward, Shift to walk */
  moveTrooper(dt, f, s, sprint); /* momentum, slide, mantle, dodge, gravity, chute, landing: mobility.js */
  /* no weapons: the Hero's hands are the Force and the five powers (powers.js) */
}

/* ---------------- cameras ---------------- */
const CINE = { subj: null, t: 0, dur: 0, shot: 'orbit', ang: 0, anchor: new V3(), pos: new V3(0, 120, 400), look: new V3(), snap: true, R: 40, H: 10, label: '' };
let firstVista = true;
function cinePick() {
  if (directorPick()) return;
  if (firstVista || Math.random() < 0.22) {
    const v = firstVista ? VISTAS[0] : pick(VISTAS); firstVista = false;
    CINE.subj = null; CINE.vista = v; CINE.shot = 'vista'; CINE.t = 0; CINE.dur = rand(8, 11); CINE.snap = true; CINE.anchor.copy(v.pos());
    $('#cineSub').textContent = v.sub; $('#cineName').textContent = v.name; return;
  }
  CINE.vista = null;
  const pool = [];
  for (const e of ENTS) {
    if (!e.alive && !(e.kind === 'speeder' && e.tumble && e.tumble.t < 2) && !(e.kind === 'capital' && TIME - (e.cineEvent || -99) < 20) && !(e.kind === 'naval' && e.sinkT < 25)) continue;
    let w = { monster: 7, bird: 2, shiftframe: 2.6, speeder: 3.4, walker: 4, fighter: 2.5, gunship: 2, naval: 2.2, capital: 1.6, tank: 1.6, dropship: 1.2, soldier: 0.12, shieldgen: 0 }[e.kind] || 0;
    if (e.kind === 'soldier') { const near = CPS.find(c => c.contested && c.pos.distanceTo(e.pos) < 40); w = near ? 1.2 : 0.08; }
    if (e.kind === 'fighter' && e.target) w *= 1.6; if (e.kind === 'fighter' && e.orbital) w *= 0.8;
    if (!e.alive) w = e.kind === 'speeder' && e.tumble && e.tumble.t < 2 ? 60 : 30;
    if (e === CINE.subj) w *= 0.15;
    if (w > 0) pool.push([e, w]);
  }
  let tot = pool.reduce((a, b) => a + b[1], 0), r = Math.random() * tot; let s = pool[0] && pool[0][0];
  for (const [e, w] of pool) { r -= w; if (r <= 0) { s = e; break; } }
  if (!s) return;
  CINE.subj = s; CINE.t = 0; CINE.snap = true;
  const shots = { monster: ['low', 'wide', 'orbit', 'low'], bird: ['chase', 'orbit'], shiftframe: ['chase', 'orbit', 'low'], speeder: ['chase', 'chase', 'low', 'flyby'], fighter: ['chase', 'chase', 'flyby'], walker: ['low', 'orbit', 'wide', 'chase'], soldier: ['shoulder', 'shoulder', 'wide'], naval: ['orbit', 'wide'], capital: ['wide', 'under'], tank: ['chase', 'orbit', 'low'], gunship: ['orbit', 'chase', 'wide'], dropship: ['chase', 'wide'] }[s.kind] || ['orbit'];
  CINE.shot = pick(shots); CINE.dur = s.kind === 'capital' ? 12 : rand(6, 9.5); CINE.ang = Math.random() * 6.28;
  const sz = { monster: 30, bird: 3, shiftframe: 4, speeder: 3, soldier: 1, tank: 4, walker: 12, gunship: 7, fighter: 6, dropship: 8, naval: 40, capital: 120 }[s.kind] || 5; CINE.R = sz; s.aim(_v1);
  if (CINE.shot === 'wide') { const a = Math.random() * 6.28; CINE.anchor.set(_v1.x + Math.cos(a) * sz * 9, 0, _v1.z + Math.sin(a) * sz * 9); CINE.anchor.y = Math.max(groundY(CINE.anchor.x, CINE.anchor.z) + sz * 2.5, _v1.y - sz) + 8; }
  if (CINE.shot === 'low') { const a = Math.random() * 6.28; CINE.anchor.set(_v1.x + Math.cos(a) * sz * 2.4, 0, _v1.z + Math.sin(a) * sz * 2.4); CINE.anchor.y = groundY(CINE.anchor.x, CINE.anchor.z) + 1.6; }
  if (CINE.shot === 'flyby') { const d = s.dir || _v2.set(0, 0, 1); CINE.anchor.copy(s.pos).addScaledVector(d, 260).add(new V3(rand(-30, 30), rand(-10, 25), rand(-30, 30))); CINE.anchor.y = Math.max(CINE.anchor.y, groundY(CINE.anchor.x, CINE.anchor.z) + 6); }
  if (CINE.shot === 'under') { CINE.anchor.set(s.pos.x + rand(-150, 150), 0, s.pos.z + rand(150, 260) * (s.team === 1 ? -1 : 1)); CINE.anchor.y = groundY(CINE.anchor.x, CINE.anchor.z) + 3; }
  const kindName = { monster: 'Bio-titan', bird: 'Skyrunner mount', shiftframe: 'Shiftframe', speeder: 'Speeder', soldier: 'Infantry', tank: 'Hover tank', walker: 'Assault walker', gunship: 'Gunship', fighter: s.orbital ? 'Orbital interceptor' : 'Starfighter', dropship: 'Dropship', naval: 'Destroyer', capital: 'Capital ship' }[s.kind] || '';
  $('#cineSub').textContent = `${TEAM[s.team].name} · ${kindName}`; $('#cineName').textContent = s.name;
}
function fwdOf(e, out) {
  if (e.dir) return out.copy(e.dir);
  if (e.vel && e.vel.lengthSq() > 4) return out.copy(e.vel).normalize();
  const y = e.kind === 'walker' ? e.heading : (e.yaw || 0); return out.set(Math.sin(y), 0, Math.cos(y));
}
function cineUpdate(dt) {
  if (spectateShot(dt)) return;
  CINE.t += dt;
  const s = CINE.subj;
  if (CINE.shot === 'vista') {
    if (CINE.t > CINE.dur) cinePick();
    if (CINE.shot === 'vista') {
      const v = CINE.vista; const want = _v3.copy(CINE.anchor).addScaledVector(v.drift, CINE.t); want.y = Math.max(want.y, groundY(want.x, want.z) + 2); const look = v.look();
      if (CINE.snap) { CINE.pos.copy(want); CINE.look.copy(look); CINE.snap = false; }
      CINE.pos.lerp(want, 1 - Math.exp(-dt * 3)); CINE.look.lerp(look, 1 - Math.exp(-dt * 3));
      camera.position.copy(CINE.pos); camera.up.set(0, 1, 0); camera.lookAt(CINE.look); camera.fov = lerp(camera.fov, v.fov, dt * 3); camera.updateProjectionMatrix(); return;
    }
  }
  if (!s || CINE.t > CINE.dur || (s.remove) || (!s.alive && CINE.t > 5 && s.kind !== 'capital')) cinePick();
  if (CINE.shot === 'vista') return;
  const S = CINE.subj; if (!S) return;
  const c = S.aim(_v1).clone(); const R = CINE.R; const f = fwdOf(S, _v2).clone();
  const want = _v3, look = _v4.copy(c);
  switch (CINE.shot) {
    case 'chase': want.copy(c).addScaledVector(f, -R * 3.2 - 6).add(_v5.set(0, R * 0.9 + 2, 0)); look.addScaledVector(f, R * 4); break;
    case 'orbit': CINE.ang += dt * 0.16; want.set(c.x + Math.cos(CINE.ang) * R * 4.5, c.y + R * 1.1 + 3, c.z + Math.sin(CINE.ang) * R * 4.5); break;
    case 'wide': want.copy(CINE.anchor).addScaledVector(_v5.set(1, 0, 0), CINE.t * 2); break;
    case 'low': want.copy(CINE.anchor); look.y += R * 0.2; break;
    case 'flyby': want.copy(CINE.anchor); break;
    case 'under': want.copy(CINE.anchor); break;
    case 'shoulder': { const y = S.yaw || 0; want.set(S.pos.x - Math.sin(y) * 4 + Math.cos(y) * -0.9, S.pos.y + 1.9, S.pos.z - Math.cos(y) * 4 - Math.sin(y) * -0.9); look.set(S.pos.x + Math.sin(y) * 30, S.pos.y + 1.3, S.pos.z + Math.cos(y) * 30); break; }
  }
  want.y = Math.max(want.y, groundY(want.x, want.z) + 1.2);
  if (CINE.snap) { CINE.pos.copy(want); CINE.look.copy(look); CINE.snap = false; }
  const k = CINE.shot === 'chase' ? 1 - Math.exp(-dt * 5) : CINE.shot === 'shoulder' ? 1 - Math.exp(-dt * 6) : 1 - Math.exp(-dt * 2);
  CINE.pos.lerp(want, k); CINE.look.lerp(look, 1 - Math.exp(-dt * 5));
  camera.position.copy(CINE.pos); camera.up.set(0, 1, 0); camera.lookAt(CINE.look);
  camera.fov = lerp(camera.fov, CINE.shot === 'wide' || CINE.shot === 'under' ? 50 : CINE.shot === 'low' ? 78 : 62, dt * 2); camera.updateProjectionMatrix();
}
function playerCamera(dt) {
  const P = PLAYER, e = P.ent;
  if (GAME.state === 'dead') {
    P.deadT += dt; const c = P.deathPos; const a = P.deadT * 0.25 + P.yaw; const r = 14 + P.deadT * 3;
    _v1.set(c.x + Math.sin(a) * r, c.y + 6 + P.deadT * 2.2, c.z + Math.cos(a) * r); _v1.y = Math.max(_v1.y, groundY(_v1.x, _v1.z) + 2);
    camera.position.lerp(_v1, 1 - Math.exp(-dt * 3)); const k = P.killer && P.killer.alive && P.killer.pos ? P.killer.aim(_v2) : _v2.copy(c);
    _v3.lerpVectors(c, k, 0.35); camera.lookAt(_v3); if (P.deadT > 2.2 && $('#deploy').classList.contains('hidden') && GAME.state === 'dead') showDeploy();
    return;
  }
  if (P.role === 'trooper' && !e.mount) {
    // third-person chase camera: full body in frame, zoom with the wheel or cycle presets with H
    const zoom = typeof LZ !== 'undefined' && LZ.zoom, ads = P.ads || zoom, cd = P.free || P.para ? Math.max(P.camDist || 7, 11) : P.camDist || 7; /* pull back for the skydive */ const dist = ads ? 1.9 : cd, sh = ads ? 0.55 : clamp(1.1 - cd * 0.06, 0.3, 0.95), cp = Math.cos(P.pitch);
    const dir = _v1.set(-Math.sin(P.yaw) * cp, Math.sin(P.pitch), -Math.cos(P.yaw) * cp);
    const right = _v2.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
    const head = _v3.copy(e.pos).setY(e.pos.y + (e.crouch ? 1.4 : 1.85) + (ads ? 0 : Math.max(0, cd - 3) * 0.14));
    const eye = _v4.copy(head).addScaledVector(dir, -dist).addScaledVector(right, sh);
    eye.y = Math.max(eye.y, surfY(eye.x, eye.z, eye.y) + 0.6);
    for (let k = 1; k <= 12; k++) { _v6.lerpVectors(head, eye, k / 12); if (buildingAt(_v6)) { eye.lerpVectors(head, eye, Math.max(0, k - 1.5) / 12); break; } }
    if (!P.camInit || P.pod) { P.camPos.copy(eye); P.camInit = true; } else P.camPos.lerp(eye, 1 - Math.exp(-dt * 18));
    eye.copy(P.camPos); camera.position.copy(eye); camera.up.set(0, 1, 0); camera.lookAt(_v5.copy(eye).add(dir));
    camera.fov = lerp(camera.fov, zoom ? 11 : ads ? 44 : POW.fly ? 74 + Math.min(22, (POW.spd || 0) * 0.22) : (P.sprint ? 78 : 72), Math.min(1, dt * 10));
  } else if ((P.role === 'trooper' && e.mount) || P.role === 'shiftframe' || P.role === 'starship') {
    const tgt = e.mount || e; const veh = P.role === 'shiftframe' && e.mode !== 'robot'; const robot = P.role === 'shiftframe' && !veh;
    const cp = Math.cos(P.pitch); const dir = _v1.set(-Math.sin(P.yaw) * cp, Math.sin(P.pitch), -Math.cos(P.yaw) * cp); const right = _v2.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
    const dist = tgt.camD || (robot ? 8.5 : veh ? 12 : 10), up = tgt.camUp || (robot ? 5.6 : veh ? 4.5 + tgt.alt * 0.1 : 4.6), sh = robot ? 1.8 : 0;
    const want = _v3.copy(tgt.pos).setY(tgt.pos.y + up).addScaledVector(dir, -dist).addScaledVector(right, sh);
    if (!P.camInit) { P.camPos.copy(want); P.camInit = true; }
    P.camPos.lerp(want, 1 - Math.exp(-dt * 10)); P.camPos.y = Math.max(P.camPos.y, surfY(P.camPos.x, P.camPos.z, P.camPos.y) + 0.8);
    camera.position.copy(P.camPos); camera.up.set(0, 1, 0); camera.lookAt(_v4.copy(P.camPos).add(dir));
    camera.fov = lerp(camera.fov, 70 + (veh || P.role === 'starship' ? Math.min(14, Math.max(0, Math.abs(tgt.speed) - 25) * 0.15) : 0), dt * 3);
  } else {
    const cp = Math.cos(P.aimPitch); const aim = _v1.set(-Math.sin(P.aimYaw) * cp, Math.sin(P.aimPitch), -Math.cos(P.aimYaw) * cp);
    const flat = _v2.set(-Math.sin(P.aimYaw), 0, -Math.cos(P.aimYaw));
    const want = _v3.copy(e.pos).setY(e.pos.y + 27).addScaledVector(flat, -34).addScaledVector(aim, -6);
    if (!P.camInit) { P.camPos.copy(want); P.camInit = true; }
    P.camPos.lerp(want, 1 - Math.exp(-dt * 8)); P.camPos.y = Math.max(P.camPos.y, groundY(P.camPos.x, P.camPos.z) + 2);
    camera.position.copy(P.camPos); camera.up.set(0, 1, 0); camera.lookAt(_v4.copy(P.camPos).add(aim));
    camera.fov = lerp(camera.fov, 70, dt * 3);
  }
  camera.updateProjectionMatrix();
}

/* ---------------- HUD ---------------- */
/* One marker in the world, not ten. It follows whichever district the war is being decided at, so the HUD answers
   "where now" with a single answer instead of a menu. */
const mkEl = $('#markers');
const FOCUS_MK = (() => { const m = document.createElement('div'); m.className = 'mk'; const b = document.createElement('b'), q = document.createElement('small'); m.appendChild(b); m.appendChild(q); mkEl.appendChild(m); m._name = b; m._sub = q; return m; })();
const focusCP = () => (POOL.cat && POOL.cat.cp) || (POOL.raid && POOL.raid.cp) || (THEATRE.cur && THEATRE.cur.cp) || null;
const waveBars = [...document.querySelectorAll('#wave i')];
const mini = $('#mini'), mctx = mini.getContext('2d');
let hudT = 0;
function setText(id, v) { const el = typeof id === 'string' ? $(id) : id; if (el && el.textContent !== String(v)) el.textContent = v; }
const HUD_MAP = { due: false };
function updateHUD(dt) {
  /* the HUD's ten-a-second refresh used to do its text and redraw the whole minimap in one frame, a hitch you could
     feel; the map now takes the frame halfway between text refreshes */
  if (HUD_MAP.due && hudT < 0.05) { HUD_MAP.due = false; drawMinimap(mctx); /* map.js */ }
  // per-frame bits
  if (hmT > 0) { hmT -= dt; if (hmT <= 0) $('#hitx').classList.remove('on'); }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) bannerEl.classList.remove('on'); }
  waveLevel *= Math.pow(0.15, dt);
  sty($('#vign'), 'opacity', GAME.state === 'play' ? Math.min(0.9, PLAYER.hurt + (PLAYER.ent && PLAYER.ent.hp < PLAYER.ent.maxHp * 0.3 ? 0.35 + 0.15 * Math.sin(TIME * 6) : 0)).toFixed(2) : '0');
  const playing = GAME.state === 'play' && PLAYER.ent && PLAYER.ent.alive;
  // the one marker: where the fight is
  const fcp = focusCP();
  if (fcp && (playing || GAME.state === 'dead')) {
    _v1.copy(fcp.pos).setY(fcp.pos.y + 20).project(camera);
    const vis = _v1.z < 1 && Math.abs(_v1.x) < 1.1 && Math.abs(_v1.y) < 1.1;
    sty(FOCUS_MK, 'display', vis ? 'block' : 'none');
    if (vis) { sty(FOCUS_MK, 'left', Math.round((_v1.x + 1) / 2 * innerWidth) + 'px'); sty(FOCUS_MK, 'top', Math.round((1 - _v1.y) / 2 * innerHeight) + 'px'); }
  } else sty(FOCUS_MK, 'display', 'none');
  sty($('#nose'), 'display', 'none'); sty($('#lock'), 'display', 'none'); /* the nose and lock reticles belonged to the starfighter */
  sty($('#cross'), 'display', playing ? 'block' : 'none');
  hudT -= dt; if (hudT > 0) return; hudT = 0.1;
  waveBars.forEach((b, i) => b.style.height = (3 + Math.random() * 9 * waveLevel * (1 - Math.abs(i - 3) / 5)) + 'px');
  const w = Math.max(0, WARS.t) | 0; setText('#clock', `${(DAY.phase || 'day').toUpperCase()}${WEATHER.state !== 'sunny' ? ' · ' + WEATHER.state.toUpperCase() : ''} · ${(w / 60) | 0}:${String(w % 60).padStart(2, '0')} LEFT`);
  if (fcp) {
    FOCUS_MK.className = 'mk o' + fcp.owner + (POOL.raid && POOL.raid.cp === fcp ? ' raid' : '');
    setText(FOCUS_MK._name, fcp.name);
    if (playing) setText(FOCUS_MK._sub, `${Math.round(PLAYER.ent.pos.distanceTo(fcp.pos))} m · ${fcp.pop || 0} people left`);
  }
  // objective + capture
  const capEl = $('#capture');
  if (playing) {
    const pe = PLAYER.ent;
    /* one line, one job: the district the war is being decided at, and how many people are still in it */
    const fc = fcp, fd = fc ? Math.round(pe.pos.distanceTo(fc.pos)) : 0;
    const hint = fc ? `${POOL.raid && POOL.raid.cp === fc ? POOL.raid.kind.toUpperCase() : fc.owner === 2 ? 'They hold' : fc.owner === 1 ? 'Hold' : 'Take'} ${fc.name} · ${fc.pop || 0} people left · ${fd} m` : 'Hold the line';
    let hint2 = hint; $('#hint').style.color = '';
    const mh = mountHint(pe); if (mh) hint2 = mh;
    else if (STATION.on) { hint2 = 'BATTLE STATION · repairing · recharging · double XP'; $('#hint').style.color = 'var(--green, #6dff9a)'; }
    else if (pe.kind === 'soldier' && !pe.mount && ENTS.some(x => x.downed && x.team === 1 && x.pos.distanceTo(pe.pos) < 2.8)) hint2 = `Stay with them · reviving your teammate ${Math.round(Math.min(1, (POOL.autoT || 0) / 1.2) * 100)}%`;
    setText('#hint', hint2);
    const near = CPS.find(c => pe.pos.distanceTo(c.pos) < 28);
    if (near) { capEl.classList.remove('hidden'); setText('#capName', `${near.name}${near.contested ? ' · contested' : ''}`); const fl = $('#capFill'); const p = near.prog; fl.style.left = p >= 0 ? '50%' : (50 + p * 50) + '%'; fl.style.width = Math.abs(p) * 50 + '%'; fl.style.background = TEAM_CSS[near.holder] || 'var(--blue)'; }
    else capEl.classList.add('hidden');
    const rr = rayCast(camera.position, camDir(_v2).clone(), 450, pe, 1); const pt = rr.ent && isHostile(rr.ent.team) ? rr.ent : null;
    $('#cross').classList.toggle('foe', !!pt);
    if (pt !== plateEnt) { plateEnt = pt; if (pt) setText('#plName', pt.kind === 'soldier' ? pt.name : `${pt.name} · ${{ tank: 'hover tank', walker: 'walker', gunship: 'gunship', fighter: 'fighter', speeder: 'speeder', dropship: 'dropship', naval: 'destroyer', capital: 'capital ship', shieldgen: 'shield generator' }[pt.kind] || ''}`); }
  } else { setText('#hint', ''); capEl.classList.add('hidden'); plateEnt = null; }
  // status
  if (PLAYER.ent) {
    const pe = PLAYER.ent; setText('#stHp', Math.ceil(pe.hp)); $('#stHpB').style.width = (pe.hp / pe.maxHp * 100) + '%';
    $('#stHpB').style.background = pe.hp < pe.maxHp * 0.3 ? 'var(--red)' : 'var(--ink)';
    const roleName = 'Hero';
    setText('#stRole', `${roleName} · ${TEAM[1].name}`);
    setText('#stHpL', PLAYER.role === 'trooper' ? 'HEALTH' : 'HULL');
    let sub = '';
    if (PLAYER.role === 'trooper' && !pe.mount) sub = POW.fly ? 'FLYING' : POW.tk ? 'CARRYING A CAR' : PLAYER.reload > 0 ? 'RECHARGING' : 'ON FOOT';
    else if (PLAYER.role === 'trooper' && pe.mount) sub = pe.mount.hp !== undefined ? `${pe.mount.name.toUpperCase()} ${Math.ceil(pe.mount.hp)} HP · ${Math.round(Math.abs(pe.mount.speed) * 3.6)} KM/H` : pe.mount.name.toUpperCase();
    else sub = `${(pe.prevName || pe.name || 'SHIP').toUpperCase()} ${Math.ceil(pe.hp)} HP · ${Math.abs(pe.spd || 0).toFixed(1)} KN`;
    setText('#stSub', sub); setText('#stDealt', Math.round(PLAYER.lifeDealt).toLocaleString()); setText('#stTaken', Math.round(PLAYER.lifeTaken).toLocaleString()); setText('#stPts', (PLAYER.points || 0).toLocaleString());
    // abilities
    const ab = $('#abil'); let html = '';
    const cell = (k, n, c, ready, sel, cd) => `<div class="ab${ready ? ' ready' : ''}${sel ? ' sel' : ''}"><div class="k">${k}</div><div class="n">${n}</div><div class="c">${c}</div>${cd !== undefined ? `<div class="cd" style="width:${cd * 100}%"></div>` : ''}</div>`;
    {
      html = cell('Space', 'Fly', POW.fly ? 'flying' : 'take off', true, POW.fly) + cell('F', 'Force', POW.tk ? 'throw it' : 'pull a car', true, !!POW.tk);
      if (POW.fly || POW.dive) html += cell('RMB', 'Dive', GOD.cd.dive > 0 ? `${Math.ceil(GOD.cd.dive)} s` : 'ready', GOD.cd.dive <= 0, !!POW.dive, 1 - GOD.cd.dive / GOD_CD.dive);
      for (const [slot, name, k] of KIT) { const cd = GOD.cd[slot] || 0; html += cell(k, name, cd > 0 ? `${Math.ceil(cd)} s` : 'ready', cd <= 0, false, 1 - cd / GOD_CD[slot]); }
    }
    if (ab._html !== html) { ab._html = html; ab.innerHTML = html; } /* reading innerHTML back serialised the bar ten times a second */
  }
  HUD_MAP.due = true; /* the minimap is drawn on a later frame than the text (see the top of this function) */
}

/* ---------------- battle chatter ---------------- */
const CHATTER = {
  soldier: ['Contact front, two hundred metres!', 'Moving up on {cp}, cover me!', 'Smoke out! Push, push!', 'Taking fire from the high windows!', 'Man down at {cp}! Need a medic!', 'Reloading!', 'Grenade out!', 'I see their walker in the smoke near {cp}!', 'Hold this line, nobody falls back!', 'Their armour is rolling on {cp}!'],
  fighter: ['Bandit on my six, break right!', 'Splash one!', 'Lining up a run on their gunship.', 'I\'m hit, I\'m hit! Still flying!', 'Going vertical, follow me up.', 'Threading the towers, stay tight!', 'Shields on that cruiser are holding, keep hammering!'],
  walker: ['Walker advancing. Clear the road.', 'Hull at seventy percent, still pushing.', 'Targeting their armour, firing!', 'Stepping over the barricade.'],
  gunship: ['Gunship on station over {cp}, rolling in hot.', 'Rockets away!', 'Taking flak, swinging wide.'],
  naval: ['Broadside, fire!', 'Shore bombardment on {cp}, splash in twenty.', 'Enemy destroyer bearing two-seven-zero!'],
  tank: ['Gun up, target armour!', 'Hover drive is overheating.', 'Hull down at {cp}.'],
  capital: ['Point defence engaging fighters.', 'Main batteries, fire on that cruiser!', 'Launching another wave of fighters.'],
};
const INTERCEPT = ['...Dominion squad three, flank through the foundry...', '...walker Ravager pushing on the plaza, all units follow...', '...orbital battery charged, awaiting coordinates...', '...shields holding at sixty percent...', '...they have armour on the coast road...'];
let chatT = 3;
function chatter(dt) {
  chatT -= dt; if (chatT > 0) return; chatT = rand(3.5, 7);
  if (Math.random() < 0.18) { comms('INTERCEPT', INTERCEPT[(Math.random() * INTERCEPT.length) | 0], 'icpt r'); return; }
  const pool = ENTS.filter(e => e.alive && e.team === 1 && CHATTER[e.kind] && !e.isPlayer); if (!pool.length) return;
  const e = pick(pool); let cp = CPS.reduce((a, c) => c.pos.distanceTo(e.pos) < a.pos.distanceTo(e.pos) ? c : a, CPS[0]);
  comms(e.name, pick(CHATTER[e.kind]).replace('{cp}', cp.name), 'b');
}

/* ---------------- menus / overlays ---------------- */
/* one role and one way in: the menu and the deploy screen carry nothing to pick (the Hero always drops in by pod at the front) */
$('#keyList').innerHTML = KEYS.map(([k, v]) => `<kbd>${k}</kbd><span>${v}</span>`).join('');
function hideOverlays() { for (const id of ['#menu', '#deploy', '#showUI']) $(id).classList.add('hidden'); }
function setCine(on) { $('#letterbox').classList.toggle('on', on); $('#cinecap').classList.toggle('on', on); for (const id of ['#status', '#abil', '#cross', '#hint']) $(id).classList.toggle('hidden', on); }
function showMenu() { hideOverlays(); $('#menu').classList.remove('hidden'); GAME.state = PLAYER.ent && PLAYER.ent.alive ? 'spectate' : 'menu'; setCine(true); if (document.pointerLockElement) document.exitPointerLock(); }
function showDeploy() { hideOverlays(); setText('#sK', PLAYER.kills); setText('#sD', PLAYER.deaths); setText('#sC', PLAYER.caps); $('#deploy').classList.remove('hidden'); $('#touch').classList.add('hidden'); }
function toggleSpectate() {
  if (GAME.state === 'play') { GAME.state = 'spectate'; setCine(true); CINE.subj = null; if (document.pointerLockElement) document.exitPointerLock(); $('#cineSub').textContent = 'Press P to return · Enter for menu'; }
  else if (GAME.state === 'spectate' && PLAYER.ent && PLAYER.ent.alive) { PLAYER.camInit = false; deploy(); }
}
function deploy() { audioInit(); if (GAME.state === 'spectate' && PLAYER.ent && PLAYER.ent.alive) { GAME.state = 'play'; hideOverlays(); setCine(false); requestLock(); return; } if (PLAYER.hero) hopOff(); { const o = PLAYER.ent; if (o && o.alive) { if (o.mount) o.mount.dismount(o); o.isPlayer = false; o.hitR = false; o.remove = true; } } spawnPlayer(); requestLock(); } // redeploying retires the old body
$('#bDeploy').onclick = deploy; $('#bRedeploy').onclick = deploy;
const unShow = () => { for (const id of ['#top', '#comms', '#feed', '#mini']) $(id).classList.remove('hidden'); };
/* spectate the battle: the cinematic camera follows the fighting; tap (or Enter) brings the menu back */
$('#bWatch').onclick = () => { audioInit(); hideOverlays(); GAME.state = 'spectate'; setCine(true); CINE.subj = null; $('#cineSub').textContent = IS_MOBILE ? 'Tap for the menu' : 'Click or press Enter for the menu'; };
$('#bWatch2').onclick = () => { hideOverlays(); GAME.state = 'spectate'; setCine(true); CINE.subj = null; $('#cineSub').textContent = IS_MOBILE ? 'Tap for the menu' : 'Click or press Enter for the menu'; };
$('#bShowBack').onclick = () => { unShow(); showMenu(); };
$('#bShowDeploy').onclick = () => { unShow(); PLAYER.role = 'trooper'; deploy(); };
TOUCH.on && canvas.addEventListener('touchmove', e => { if (GAME.state === 'showcase' && e.touches.length === 1) { const t = e.touches[0]; if (SHOWCASE.lx) { SHOWCASE.ang -= (t.clientX - SHOWCASE.lx) * 0.01; SHOWCASE.pitch = clamp(SHOWCASE.pitch + (t.clientY - SHOWCASE.ly) * 0.006, -0.3, 0.9); } SHOWCASE.lx = t.clientX; SHOWCASE.ly = t.clientY; } }, { passive: true });
TOUCH.on && canvas.addEventListener('touchend', () => { SHOWCASE.lx = 0; });
function showcaseCamera(dt) {
  const c = _v1.copy(SHOWCASE.pos); c.y += 1.15; const d = SHOWCASE.dist;
  SHOWCASE.ang += dt * (SHOWCASE.drag ? 0 : 0.12);
  camera.position.set(c.x + Math.sin(SHOWCASE.ang) * Math.cos(SHOWCASE.pitch) * d, c.y + Math.sin(SHOWCASE.pitch) * d, c.z + Math.cos(SHOWCASE.ang) * Math.cos(SHOWCASE.pitch) * d);
  camera.up.set(0, 1, 0); camera.lookAt(c.x - Math.sin(SHOWCASE.ang) * 0.35, c.y, c.z); camera.fov = lerp(camera.fov, 40, dt * 4); camera.updateProjectionMatrix();
}
const SHOW_ST = { slashT: 0, slashDir: 1, aimBlast: 0, crouch: false, demo: 3 };
function animateShowcase(dt) {
  if (camera.position.distanceTo(SHOWCASE.pos) > 260) return;
  SHOW_ST.demo -= dt; if (SHOW_ST.demo <= 0) { SHOW_ST.demo = rand(3.5, 6); SHOW_ST.slashT = 0.38; SHOW_ST.slashDir *= -1; }
  SHOW_ST.slashT = Math.max(0, SHOW_ST.slashT - dt); animateHero(SHOWCASE.parts, dt, 0, SHOW_ST);
}
const gfxSel = () => document.querySelectorAll('#gfx button').forEach(b => b.classList.toggle('sel', b.dataset.q === POST.quality));
document.querySelectorAll('#gfx button').forEach(b => b.onclick = () => { POST.setQuality(b.dataset.q); gfxSel(); }); gfxSel();

/* ---------------- match setup ---------------- */
function setupMatch() {
  GAME.tickets = { 1: GAME.maxTickets, 2: GAME.maxTickets }; GAME.clock = 0;
  for (const t of [1, 2]) {
    for (const lane of [0, 1]) { const e = new Naval(t, lane); const z = t === 1 ? rand(80, 280) : rand(-280, -80); e.spawnAt(new V3(Math.min(BOUND - 12, coastX(z) + 50 + lane * 60), 0, z)); addEnt(e); }
    for (const [type, n0] of Object.entries(FORCE)) { if (type === 'team1Soldiers') continue; const n = type === 'soldier' && t === 1 ? FORCE.team1Soldiers || 0 : n0; for (let i = 0; i < n; i++) {
      const e = spawnUnit(type, t);
      if (e && type === 'soldier' && Math.random() < 0.5) { const cp = pick(CPS.filter(c => c.owner !== 3 - t)); e.spawnAt(_v1.set(cp.x + rand(-60, 60), 0, cp.z + rand(-60, 60) + (t === 1 ? 40 : -40))); }
      if (e && type === 'fighter') { e.pos.set(rand(-500, 500), rand(120, 300), rand(-400, 400) + (t === 1 ? 300 : -300)); }
      if (e && (type === 'walker' || type === 'tank') && i === 0) { const cp = CPS.find(c => c.owner === t); if (cp) e.spawnAt(_v1.set(cp.x + rand(-30, 30), 0, cp.z + (t === 1 ? 60 : -60))); }
      if (e && type === 'gunship') e.pos.y += 40;
    } }
  }
  setupArmies(); setupStarships(); cmdSetup(); POST.aniso();
  BIRDS.length = 0; for (let i = 0; i < 2; i++) { const b = new Bird(i); b.spawnAt(i ? new V3(-40, 0, -395) : new V3(-255, 0, 375)); addEnt(b); BIRDS.push(b); }
  comms(null, 'All units, this is Meridian Command. The war runs across land, ocean, air and space. Follow the realm markers. Good hunting.', 'cmd');
}

/* ---------------- resize ---------------- */
function resize() {
  POST.build();
}
let resizeT = 0; const resizeSoon = () => { window.clearTimeout(resizeT); resizeT = setTimeout(resize, 120); }; /* rebuilding render targets is heavy: once per burst */
addEventListener('resize', resizeSoon); addEventListener('orientationchange', resizeSoon); if (window.visualViewport) window.visualViewport.addEventListener('resize', resizeSoon); resize();
/* browser housekeeping: survive a GPU reset, go quiet and release held keys when the tab is hidden */
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); banner('Graphics paused', 'The browser reset the GPU · it resumes on its own, or reload', 'var(--amber)'); });
canvas.addEventListener('webglcontextrestored', () => POST.build());
document.addEventListener('visibilitychange', () => { try { if (AU.ctx) { if (document.hidden) AU.ctx.suspend(); else AU.ctx.resume(); } } catch (err) { /* audio optional */ } for (const k in keys) keys[k] = false; mouse.b = [false, false, false]; });

/* ---------------- blade glow ---------------- */
const BLADE_LIGHT = new T.PointLight(0x3f8cff, 0, 7, 2); scene.add(BLADE_LIGHT);
function updateBladeLight() {
  if (GAME.state === 'showcase' || !(PLAYER.ent && PLAYER.ent.alive && PLAYER.ent.heroParts)) { if (camera.position.distanceTo(SHOWCASE.pos) < 120) { SHOWCASE.parts.blade.getWorldPosition(BLADE_LIGHT.position); BLADE_LIGHT.intensity = 1.8 + Math.random() * 0.3; } else BLADE_LIGHT.intensity = 0; return; }
  const e = PLAYER.ent;
  e.heroParts.blade.getWorldPosition(BLADE_LIGHT.position); BLADE_LIGHT.position.y += 0.3; BLADE_LIGHT.intensity = 1.6 + Math.random() * 0.3 + (e.slashT > 0 ? 1.5 : 0);
}
/* ---------------- main loop ---------------- */
let last = performance.now(), FRAMEN = 0;
// removed vehicles free their GPU buffers in batches (anything still drawn elsewhere is kept; shared assets re-upload if reused)
const GPU_FREE = []; let gpuT = 0;
function freeGPU(dt) {
  if ((gpuT -= dt) > 0) return; if (GPU_FREE.length < 6 && gpuT > -9) return; gpuT = 4; if (!GPU_FREE.length) return;
  /* the sweep walks the whole scene, so it waits for a batch of dead hulls (or ten quiet seconds) instead of running every few seconds mid-firefight */
  const used = new Set(), mark = o => { if (o.geometry) used.add(o.geometry); if (o.material) for (const m of [].concat(o.material)) used.add(m); };
  /* On phones only the live units are checked for sharing (a dead hull's parts are only ever shared with other units of its
     kind); walking the whole scene cost a 100 ms+ hitch every few seconds. Freeing something still shared elsewhere is
     harmless anyway: three uploads it again the next time it is drawn. */
  if (LOW_END) { for (const e of ENTS) if (e.obj) e.obj.traverse(mark); } else scene.traverse(mark);
  for (const root of GPU_FREE.splice(0)) root.traverse(o => { if (o.geometry && !used.has(o.geometry)) { o.geometry.dispose(); used.add(o.geometry); } if (o.material && !LOW_END) for (const m of [].concat(o.material)) if (!used.has(m)) { m.dispose(); used.add(m); } }); /* phones keep materials: disposing one static scenery shares means a shader recompile mid-fight */
}
const DT_S = { v: 0 };
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000)); last = now;
  /* even pacing: browsers hand out frame times that wobble (16, 17, 33, 16 ms...) even when the game is keeping up, and
     moving everything by the raw number makes motion shimmer. Small wobbles are averaged out; a real hitch (a frame
     more than twice the running average) is passed straight through so the game never falls behind the clock. */
  if (DT_S.v === 0 || dt > DT_S.v * 2 || dt < DT_S.v * 0.5) DT_S.v = dt; else { DT_S.v += (dt - DT_S.v) * 0.2; dt = DT_S.v; }
  if (HITSTOP.f > 0) { HITSTOP.f--; dt *= 0.002; } else if (HITSTOP.t > 0) { HITSTOP.t -= dt; dt *= 0.12; } /* f: a true freeze for that many frames (juice.js) */ dt *= directorScale(dt); TIME += dt; AU.budget = 0;
  if (GAME.state !== 'end') GAME.clock += dt;
  if (GAME.state === 'play') updatePlayer(dt); else { mouse.dx = mouse.dy = 0; mouse.pressed[0] = mouse.pressed[1] = mouse.pressed[2] = false; }
  /* On phones the war is thinned by distance: anything more than 400 m from the camera thinks every other frame and
     takes both frames' time when it does, so it moves just as far. Near units, the player and the projectiles still
     update every frame. Halves the cost of the hundred-odd units you cannot see. */
  /* On phones, vehicles and aircraft past 400 m think every other frame, past 700 m every third. Whatever you are riding
     or driving stays at full rate. Soldiers thin themselves the same way in units.js. */
  { const cp = camera.position, pm = PLAYER.ent && PLAYER.ent.mount, rd = typeof RIDE !== 'undefined' ? RIDE.on : null;
    for (let i = 0; i < ENTS.length; i++) {
      const e = ENTS[i];
      if (LOW_END && e.kind !== 'soldier' && e.pos && e !== pm && e !== rd) { /* soldiers thin themselves the same way (units.js), so they are left out here: doing it twice could park one for good */
        const dx = e.pos.x - cp.x, dz = e.pos.z - cp.z, d2 = dx * dx + dz * dz;
        if (d2 > 160000) { /* vehicles and aircraft: full rate out to 400 m (every other frame at 200 m read as judder on big machines) */
          const per = d2 > 490000 ? 3 : 2;
          if (e._ph === undefined) e._ph = i % 6;
          e._acc = (e._acc || 0) + dt;
          if ((FRAMEN + e._ph) % per !== 0) continue;
          const ad = Math.min(0.1, e._acc); e._acc = 0; e.update(ad); continue;
        }
        if (e._acc) { const ad = Math.min(0.1, e._acc + dt); e._acc = 0; e.update(ad); continue; }
      }
      e.update(dt);
    }
  }
  for (let i = ENTS.length - 1; i >= 0; i--) if (ENTS[i].remove) { const e = ENTS[i]; e.alive = false; if (e.obj) { scene.remove(e.obj); if (e.kind !== 'soldier') GPU_FREE.push(e.obj); } ENTS.splice(i, 1); }
  freeGPU(dt);
  updateProjectiles(dt); updateFX(dt); updateCPs(dt); updateStrikes(dt); SPAWNER.update(dt); chatter(dt);
  for (const b of BUILDINGS) b.update(dt);
  // camera
  updateWorld(dt); animateShowcase(dt); updateTitanSpawner(dt); updateDetails(dt); updateFlocks(dt); updateFun(dt); updateCommand(dt); updateTransports(dt); updateConvoy(dt); updateCover(dt); updateFronts(dt); updateArmies(dt); updateExhaust(dt); updateStarships(dt); updateSkyfall(dt); updateZones(dt); updateWeather(dt); updateContracts(dt); updateTheatres(dt); updateAction(dt); updateWar(dt); updateEncounters(dt); updateMotorPool(dt); updateBuilders(dt); updateWorks(dt); updateCinema(dt); updateDirector(dt); updateCity(dt); updateRealms(dt); updateRealmRules(dt); updateFlagship(dt); updatePool(dt); updatePowers(dt); updateChampions(dt); updateMobilityHud(dt); updateMap(dt); updateCrew(dt); updateZips(dt); updateNature(dt); updateMicroWx(dt); updateAgri(dt); updateCulture(dt); updateBldLod(dt);
  if (GAME.state === 'showcase') showcaseCamera(dt); else if ((GAME.state === 'play' && PLAYER.ent && PLAYER.ent.alive) || GAME.state === 'dead') { playerCamera(dt); mobilityCamera(); } else cineUpdate(dt);
  /* safety net: if anything ever hands the camera a non-number, put it back rather than show a black screen */
  if (!isFinite(SHAKE.v)) SHAKE.v = 0;
  if (!isFinite(camera.position.x + camera.position.y + camera.position.z)) { PLAYER.camInit = false; if (PLAYER.ent && isFinite(PLAYER.ent.pos.x + PLAYER.ent.pos.y + PLAYER.ent.pos.z)) camera.position.copy(PLAYER.ent.pos).add(_v1.set(0, 3, 7)); else camera.position.set(0, 80, 300); }
  SHAKE.v = 0; /* no camera shake: blasts, impacts and powers keep their effects, the view stays steady */
  // world anchors
  const cy = camera.position.y;
  sky.position.copy(camera.position); clouds.position.x = camera.position.x; clouds.position.z = camera.position.z; water.position.x = camera.position.x; water.position.z = camera.position.z;
  const space = smooth(650, 1300, cy); skyU.space.value = space;
  const fd = FOG_D * (1 - smooth(450, 1150, cy) * 0.9) * (1 + WX.k * 1.8) * ZONE.fogMul * WEATHER.fogMul; scene.fog.density = fd; for (const u of [cloudU, waterU, FXA.mat.uniforms, FXS.mat.uniforms]) u.fogD.value = fd;
  cloudU.time.value = TIME; waterU.time.value = TIME; shaftMat.uniforms.time.value = TIME;
  const fpp = (renderer.domElement.height / 2) / Math.tan(camera.fov * Math.PI / 360); FXA.mat.uniforms.scale.value = FXS.mat.uniforms.scale.value = fpp;
  const focus = (PLAYER.ent && PLAYER.ent.alive && GAME.state === 'play') ? PLAYER.ent.pos : camDir(_v1).multiplyScalar(60).add(camera.position);
  _v2.copy(focus); _v2.y = _v2.y > 600 ? _v2.y : Math.max(groundY(_v2.x, _v2.z), Math.min(_v2.y, 200));
  { const sc = sun.shadow.camera, tx = (sc.right - sc.left) / sun.shadow.mapSize.x; _v2.applyMatrix4(SHBi); _v2.x = Math.round(_v2.x / tx) * tx; _v2.y = Math.round(_v2.y / tx) * tx; _v2.applyMatrix4(SHB); }
  sun.target.position.copy(_v2); sun.position.copy(_v2).addScaledVector(LIGHT_DIR, 600);
  if (AU.amb) AU.amb.gain.value = 0.22 * (1 - space * 0.8);
  for (const s of BUILDINGS) if (s.mesh.userData.beacon) s.mesh.userData.beacon.visible = Math.sin(TIME * 4) > 0;
  updateBladeLight(); updateHUD(dt); updateDamageUI(dt); updatePlate();
  { const cp = camera.position; for (const e of ENTS) if (e.kind === 'soldier' && e.obj && !e.isPlayer) { const dx = e.pos.x - cp.x, dz = e.pos.z - cp.z; e.obj.visible = !(e.mount && e.mount.hideRiders) && dx * dx + dz * dz < 140000 * PERF.lod * POST.lod; } updateCrowd(); }
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = FRAMEN++ % (LOW_END ? 3 : 2) === 0; // shadows refresh at half rate: ~20% fewer draw calls
  POST.render(dt);
  for (const c of UPQ) keys[c] = false; UPQ = UPQ_NEXT; UPQ_NEXT = new Set(); /* released taps let go after a frame has seen them */
}
setupMatch();
GAME.state = 'menu'; setCine(true); $('#hud').classList.remove('hidden');
// compile every shader up front behind the boot screen, so the first frames don't freeze
/* the loading line says what is actually happening, and the bar fills with it */
function bootStep(text, k) { const m = $('#bootMsg'); if (m) m.textContent = text; const b = $('#boot'); const bar = b && b.querySelector('.bt-bar i'); if (bar) { bar.style.animation = 'none'; bar.style.width = Math.round(k * 100) + '%'; } }
bootStep('Ten thousand people placed across ten districts…', 0.55);
/* Clearing the boot screen must not depend on the first frame succeeding. It used to: one exception in frame(), or a
   browser that never fires an animation frame because the tab opened in the background, and the loading screen stayed
   up for ever with nothing said. Now the screen comes down whatever happens, and anything that went wrong is shown. */
function bootDone(err) {
  const b = $('#boot'); if (!b) return;
  if (err) { const m = $('#bootMsg'); if (m) m.textContent = 'Started with an error · ' + String(err && err.message || err).slice(0, 120); setTimeout(() => { const q = $('#boot'); if (q) q.remove(); }, 4000); return; }
  b.remove();
}
/* The escape hatch. Anything can go wrong in a browser — a frame that throws, a tab that opened in the background and
   never got an animation frame, a camera left pointing at nothing, a body stuck in geometry. One button, and the key
   F9, puts the camera back behind you and your feet back on the ground, from wherever the game has got to. */
function unstick(why) {
  const P = PLAYER;
  try { bootDone(); } catch (err) { /* already down */ }
  try {
    if (typeof POW !== 'undefined') { POW.fly = false; POW.dive = null; POW.diveReq = false; if (POW.tk) { POW.tk.state = 'rest'; POW.tk = null; POW.dirty = true; } POW.flyCd = 0; }
    if (P.hero) hopOff();
    const e = P.ent;
    if (e && e.mount && e.mount.dismount) e.mount.dismount(e);
    P.pod = false; P.para = false; P.free = false; P.vy = 0; P.hurt = 0;
    if (typeof MOB !== 'undefined') { MOB.mantle = null; MOB.slide = 0; MOB.roll = 0; MOB.v.set(0, 0, 0); }
    if (typeof HITSTOP !== 'undefined') HITSTOP.t = 0;
    if (typeof SHAKE !== 'undefined') SHAKE.v = 0;
    if (!e || !e.alive) { deploy(); }
    else {
      const c = (typeof focusCP === 'function' && focusCP()) || CPS[0];
      const p = landNear(c.x, c.z, 32); pushOut(p, 0.8);
      e.pos.set(p.x, surfY(p.x, p.z, p.y + 2), p.z);
      e.hp = Math.max(e.hp, e.maxHp * 0.5); e.spawnGuard = TIME + 3; e.obj.visible = true; e.hitR = true;
      P.grounded = true; P.role = 'trooper';
      GAME.state = 'play'; hideOverlays(); setCine(false); requestLock();
    }
    P.camInit = false;
    banner('Unstuck', why || 'Camera and controls reset · you are back on your feet', 'var(--blue)');
  } catch (err) { console.error('unstick', err); }
}
addEventListener('keydown', e => { if (e.code === 'F9') { e.preventDefault(); unstick(); } });
{ const b = $('#unstick'); if (b) b.addEventListener('click', ev => { ev.preventDefault(); unstick(); }); }
{ const b = $('#bootSkip'); if (b) { b.addEventListener('click', ev => { ev.preventDefault(); bootDone(); }); setTimeout(() => { if ($('#boot')) b.classList.remove('hidden'); }, 6000); } }
setTimeout(() => {
  bootStep('Compiling shaders…', 0.8);
  try { renderer.compile(scene, camera); } catch (err) { /* compiled lazily instead */ }
  bootStep('Ready', 1);
  const start = t => { last = t; try { frame(t); bootDone(); } catch (err) { console.error(err); bootDone(err); requestAnimationFrame(frame); } };
  requestAnimationFrame(start);
  setTimeout(() => { if ($('#boot')) { /* no animation frame ever came (a background tab, usually): start the clock by hand */ if (!FRAMEN) { try { start(performance.now()); } catch (err) { bootDone(err); } } else bootDone(); } }, 9000);
}, 60);
document.addEventListener('visibilitychange', () => { if (!document.hidden && $('#boot') && FRAMEN) bootDone(); });
