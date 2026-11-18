'use strict';
/* ===================== IRON MERIDIAN · the living city: neon, infrastructure, rooftops ===================== */
// The downtown grid gets dressed and lit:
//  · NEON      · coloured light lines trace the roof edges and floor bands of the towers, blade signs flicker on the
//                corners, holo billboards glow on the tallest roofs. All brighter at night.
//  · STREETS   · traffic lights cycling at the intersections, steaming manholes, sparking power lines that crackle and
//                throw blue light, rooftop plant (AC units, water tanks, masts).
//  · ROOFTOPS  · every skyscraper roof is a deck to fight from, with a beacon in the colour of the army holding it
//                (ziplines up and across are in zips.js)
// Everything is instanced; a building that collapses takes its neon and roof plant with it (and gets them back when
// the Builder Guild raises it again).
const CITY = { list: [], att: [], roofs: [], t: 0, vents: [], wires: [], boards: [], phase: 0, phT: 0, flick: [], sayT: 0 };
const NEON_COLS = [[0.2, 2.4, 3], [3, 0.35, 2.6], [3.2, 1.6, 0.3], [0.9, 3, 0.5], [3.2, 0.5, 0.5], [1.4, 0.9, 3.2]];
(function cityDetail() {
  const C = BUILDINGS.filter(b => b.generic && b.alive && Math.hypot(b.x, b.z) < 300 && b.h > 12); CITY.list = C;
  const box = new T.BoxGeometry(1, 1, 1), att = [], add = (list, b, x, y, z, sx, sy, sz, ry = 0, col) => { list.push({ b, x, y, z, sx, sy, sz, ry, col }); };
  /* neon edge lines and bands */
  const neon = [];
  for (const b of C) {
    if (b.h < 22 || Math.random() < 0.25) continue; const c = pick(NEON_COLS), y = b.top + 0.15;
    add(neon, b, b.x, y, b.z - b.d / 2, b.w + 0.3, 0.28, 0.28, 0, c); add(neon, b, b.x, y, b.z + b.d / 2, b.w + 0.3, 0.28, 0.28, 0, c);
    add(neon, b, b.x - b.w / 2, y, b.z, 0.28, 0.28, b.d + 0.3, 0, c); add(neon, b, b.x + b.w / 2, y, b.z, 0.28, 0.28, b.d + 0.3, 0, c);
    if (b.h > 45 && Math.random() < 0.6) { const c2 = Math.random() < 0.5 ? c : pick(NEON_COLS); for (const k of [0.33, 0.66]) { const yy = b.gy + b.h * k; add(neon, b, b.x, yy, b.z - b.d / 2 - 0.1, b.w + 0.2, 0.18, 0.18, 0, c2); add(neon, b, b.x, yy, b.z + b.d / 2 + 0.1, b.w + 0.2, 0.18, 0.18, 0, c2); add(neon, b, b.x - b.w / 2 - 0.1, yy, b.z, 0.18, 0.18, b.d + 0.2, 0, c2); add(neon, b, b.x + b.w / 2 + 0.1, yy, b.z, 0.18, 0.18, b.d + 0.2, 0, c2); } }
  }
  /* blade signs on corners */
  const signs = [];
  for (const b of C) { if (b.h < 18 || Math.random() < 0.55) continue; const sx = Math.random() < 0.5 ? -1 : 1, sz = Math.random() < 0.5 ? -1 : 1, h = Math.min(11, b.h * 0.35), y = b.gy + 5 + h / 2 + rand(0, Math.max(0, b.h - h - 10) * 0.4);
    const alongX = Math.random() < 0.5; add(signs, b, b.x + sx * (b.w / 2 + (alongX ? 0.9 : 0)), y, b.z + sz * (b.d / 2 + (alongX ? 0 : 0.9)), alongX ? 1.6 : 0.3, h, alongX ? 0.3 : 1.6, 0, pick(NEON_COLS)); }
  /* roof plant */
  const ac = [], tanks = [], masts = [];
  for (const b of C) { const n = 1 + ((Math.random() * 3) | 0); for (let i = 0; i < n; i++) { const x = b.x + rand(-0.3, 0.3) * b.w, z = b.z + rand(-0.3, 0.3) * b.d, r = Math.random(); if (r < 0.5) add(ac, b, x, b.top + 0.6, z, rand(1.6, 2.6), 1.2, rand(1.6, 2.6), rand(0, 3)); else if (r < 0.8) add(tanks, b, x, b.top, z, 1, 1, 1, 0); else add(masts, b, x, b.top, z, 1, rand(0.8, 1.6), 1, 0); } }
  const mkI = (geo, mat, list, shadow, colored) => {
    if (!list.length) return null; const im = new T.InstancedMesh(geo, mat, list.length);
    list.forEach((r, i) => { _m.compose(_v1.set(r.x, r.y, r.z), _q.setFromAxisAngle(UP, r.ry), _s.set(r.sx, r.sy, r.sz)); im.setMatrixAt(i, _m); if (colored) im.setColorAt(i, _c.setRGB(r.col[0], r.col[1], r.col[2])); att.push({ b: r.b, im, i, r, on: true }); });
    im.castShadow = !!shadow; im.receiveShadow = !!shadow; scene.add(im); return im;
  };
  CITY.neonMat = basic(new T.Color(1, 1, 1)); CITY.signMat = basic(new T.Color(1, 1, 1));
  mkI(box, CITY.neonMat, neon, false, true); CITY.signs = mkI(box, CITY.signMat, signs, false, true); CITY.signList = signs;
  mkI(rbox(1, 1, 1, 0.08, 1), std(0x8a8e92, 0.6, 0.6, { normalMap: TEX.armor.normal }), ac, true);
  mkI(mergeGeos([new T.CylinderGeometry(1.4, 1.4, 2.6, 12).translate(0, 3.3, 0), new T.ConeGeometry(1.5, 0.8, 12).translate(0, 5, 0), ...[0, 1, 2, 3].map(i => new T.CylinderGeometry(0.08, 0.08, 2, 4).translate(Math.cos(i * 1.57) * 1.1, 1, Math.sin(i * 1.57) * 1.1))]), std(0x6a5040, 0.85, 0.2), tanks, true);
  mkI(mergeGeos([new T.CylinderGeometry(0.08, 0.14, 9, 5).translate(0, 4.5, 0), new T.BoxGeometry(1.6, 0.08, 0.08).translate(0, 7, 0), new T.BoxGeometry(1, 0.08, 0.08).translate(0, 8.2, 0)]), MAT_GUN, masts, true);
  CITY.att = att;
  /* holo billboards on the tallest roofs */
  const ADS = [['KESSA COLA', 'ice cold on the front line', '#ff4fd8'], ['IRON MERIDIAN', 'hold the line', '#3fd9ff'], ['ENLIST TODAY', 'the Heroes need you', '#ffb347'], ['VANTA LIES', 'do not trust the red banners', '#ff5252'], ['FLY, HERO', 'the sky is yours · no lifts, no wings', '#8dff5a']];
  const tall = C.filter(b => b.h > 55).sort((a, b) => b.h - a.h).slice(0, 9);
  tall.forEach((b, i) => {
    const ad = ADS[i % ADS.length], tex = canvasTex(256, 128, (g, w, h) => { g.fillStyle = 'rgba(0,0,0,0)'; if (g.clearRect) g.clearRect(0, 0, w, h); if (typeof g.fillText !== 'function') return; g.strokeStyle = ad[2]; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = ad[2]; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.fillText(ad[0], w / 2, 62); g.font = '20px sans-serif'; g.fillText(ad[1], w / 2, 98); });
    const m = new T.Mesh(new T.PlaneGeometry(18, 9), new T.MeshBasicMaterial({ map: tex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, color: new T.Color(1.6, 1.6, 1.6) }));
    const a = Math.atan2(b.x, b.z); m.position.set(b.x, b.top + 6.5, b.z); m.rotation.y = a; scene.add(m);
    const frame = new T.Mesh(mergeGeos([new T.BoxGeometry(0.3, 6, 0.3).translate(-7, 3, 0), new T.BoxGeometry(0.3, 6, 0.3).translate(7, 3, 0)]), MAT_GUN); frame.position.set(b.x, b.top, b.z); frame.rotation.y = a; scene.add(frame);
    CITY.boards.push({ b, m, frame, ph: Math.random() * 6 });
  });
  /* traffic lights at the intersections */
  const tl = [];
  for (let gx = -7; gx <= 6; gx++) for (let gz = -7; gz <= 6; gz++) { const x = gx * 34 + 17, z = gz * 34 + 17, dc = Math.hypot(x, z); if (dc > 240 || dc < 40 || Math.random() < 0.45) continue; const px = x + 6, pz = z + 6; if (buildingAt(_v1.set(px, H(px, pz) + 2, pz)) || H(px, pz) < 1) continue; tl.push({ x: px, z: pz, y: H(px, pz), ax: (gx + gz) & 1 }); }
  if (tl.length) {
    const poles = new T.InstancedMesh(mergeGeos([new T.CylinderGeometry(0.1, 0.14, 5.4, 6).translate(0, 2.7, 0), new T.BoxGeometry(0.1, 0.1, 3).translate(0, 5.3, -1.4), new T.BoxGeometry(0.5, 1.5, 0.45).translate(0, 4.6, -2.8)]), MAT_GUN, tl.length);
    const heads = new T.InstancedMesh(new T.SphereGeometry(0.16, 8, 6), basic(new T.Color(1, 1, 1)), tl.length * 3);
    tl.forEach((l, i) => { _q.setFromAxisAngle(UP, l.ax ? Math.PI / 2 : 0); _m.compose(_v1.set(l.x, l.y, l.z), _q, _s.set(1, 1, 1)); poles.setMatrixAt(i, _m);
      for (let k = 0; k < 3; k++) { _v2.set(0, 5.05 - k * 0.45, -2.8 + 0.25).applyQuaternion(_q).add(_v1); _m.compose(_v2, _q, _s.set(1, 1, 1)); heads.setMatrixAt(i * 3 + k, _m); } });
    poles.castShadow = true; scene.add(poles, heads); CITY.tl = tl; CITY.tlHeads = heads;
  }
  /* manholes that steam */
  const mh = []; for (let i = 0; i < 260 && mh.length < 28; i++) { const gx = ((Math.random() * 14) | 0) - 7, x = CITYC.x + gx * 26 + 13 + rand(-1.5, 1.5), z = CITYC.z + rand(-180, 180), sw = Math.random() < 0.5, px = sw ? z : x, pz = sw ? x : z; if (Math.hypot(px, pz) > 240 || buildingAt(_v1.set(px, H(px, pz) + 1, pz)) || H(px, pz) < 1) continue; mh.push({ x: px, z: pz, y: H(px, pz) + 0.05, acc: 0, hissT: rand(0, 6) }); }
  if (mh.length) { const im = new T.InstancedMesh(new T.CylinderGeometry(0.7, 0.7, 0.08, 14), MAT_GUN, mh.length); mh.forEach((m, i) => { _m.compose(_v1.set(m.x, m.y, m.z), _q.identity(), _s.set(1, 1, 1)); im.setMatrixAt(i, _m); }); im.receiveShadow = true; scene.add(im); }
  CITY.vents = mh;
  /* power lines between neighbouring towers, some snapped and sparking */
  const pos = []; for (let i = 0; i < C.length && CITY.wires.length < 22; i++) { const a = C[i]; if (a.h < 20) continue; const b = C.find(o => o !== a && o.h > 20 && Math.hypot(o.x - a.x, o.z - a.z) < 45 && Math.hypot(o.x - a.x, o.z - a.z) > 22 && !CITY.wires.some(w => w.b === o || w.a === o)); if (!b) continue;
    const y = Math.min(a.top, b.top) * 0.5 + rand(-3, 3), p0 = new V3(a.x, Math.max(a.gy + 8, y), a.z), p1 = new V3(b.x, Math.max(b.gy + 8, y), b.z), broken = Math.random() < 0.5;
    const segs = 10; for (let k = 0; k < segs; k++) { const t0 = k / segs, t1 = (k + 1) / segs; if (broken && t0 >= 0.5) break; const q0 = p0.clone().lerp(p1, t0), q1 = p0.clone().lerp(p1, t1); q0.y -= Math.sin(t0 * Math.PI) * 3 + (broken ? t0 * 8 : 0); q1.y -= Math.sin(t1 * Math.PI) * 3 + (broken ? t1 * 8 : 0); pos.push(q0.x, q0.y, q0.z, q1.x, q1.y, q1.z); }
    CITY.wires.push({ a, b, broken, end: broken ? p0.clone().lerp(p1, 0.5).setY(p0.y - 7) : null, t: rand(0, 3) }); }
  if (pos.length) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); scene.add(new T.LineSegments(g, new T.LineBasicMaterial({ color: 0x1a1a1a }))); }
})();
/* ---------- skyscraper roofs: a deck to fight from and a beacon in the colour of whoever holds it ---------- */
class RoofMark {
  constructor(b) {
    this.b = b; this.top = b.top; this.deck = { x: b.x, z: b.z, y: b.top, r: Math.min(b.w, b.d) / 2 - 0.4 }; DECKS.push(this.deck); this.pos = new V3(b.x, b.top, b.z);
    this.beacon = new T.Mesh(new T.CylinderGeometry(0.6, 1.4, 60, 10, 1, true).translate(0, 30, 0), addMat(0xffffff, 0.12)); this.beacon.position.set(b.x, b.top + 0.5, b.z); scene.add(this.beacon);
    this.ring = new T.Mesh(new T.TorusGeometry(this.deck.r, 0.22, 4, 40).rotateX(Math.PI / 2), basic(new T.Color(0.3, 0.35, 0.4))); this.ring.position.set(b.x, b.top + 0.3, b.z); scene.add(this.ring);
    this.holder = -1; this.scanT = rand(0, 1); this.live = true; this.vzip = null; CITY.roofs.push(this);
  }
  roofScan() { /* who holds the roof: beacon and edge ring take their colour, visible across the map */
    const n = {}; let best = 0, bn = 0; for (const e of ENTS) if (e.kind === 'soldier' && e.alive && !e.downed && Math.abs(e.pos.y - this.top) < 3 && Math.hypot(e.pos.x - this.b.x, e.pos.z - this.b.z) < this.deck.r + 1) { n[e.team] = (n[e.team] || 0) + 1; if (n[e.team] > bn) { bn = n[e.team]; best = e.team; } }
    if (best === this.holder) return; const was = this.holder; this.holder = best; const hex = best && TEAM[best] ? TEAM[best].hex : 0x8899aa, k = best ? 2.4 / 255 : 0.6 / 255;
    this.beacon.material.color.setHex(hex); this.beacon.material.opacity = best ? 0.5 : 0.12; this.ring.material.color.setRGB(((hex >> 16) & 255) * k, ((hex >> 8) & 255) * k, (hex & 255) * k);
    if (best && was !== -1 && camera.position.distanceTo(this.pos) < 900) comms(null, best === 1 ? 'We hold a rooftop! Overwatch is up.' : `${TEAM[best].name} on a rooftop. Watch the skyline!`, best === 1 ? 'b' : 'cmd');
  }
  update(dt) {
    const on = this.b.alive; if (on !== this.live) { this.live = on; this.beacon.visible = this.ring.visible = on; const k = DECKS.indexOf(this.deck); if (on && k < 0) DECKS.push(this.deck); if (!on && k >= 0) DECKS.splice(k, 1); }
    if (on && (this.scanT -= dt) <= 0) { this.scanT = 1; this.roofScan(); }
  }
}
for (const b of CITY.list) if (b.h > 50 && Math.min(b.w, b.d) > 12) new RoofMark(b);
/* ---------- rooftop overwatch: armies send small teams up the vertical ziplines to hold the skyline ---------- */
function roofOverwatch() {
  for (const R of CITY.roofs) for (const s of R.queue || []) { /* recruits walking to the zipline foot ride up when they reach it */
    const L = R.vzip; if (!L || !s.alive || s.mount || (s.liftT -= 1) <= 0) { R.queue = R.queue.filter(q => q !== s); continue; }
    if (Math.hypot(s.pos.x - L.la.x, s.pos.z - L.la.z) < 4 && R.b.alive) { R.queue = R.queue.filter(q => q !== s); zipRide(s, L, 0, () => { s.deck = R.deck; s.marksman = true; s.goalCP = null; s.goalT = 0; }); continue; }
    if (s.liftT < 32 && camera.position.distanceTo(s.pos) > 160 && camera.position.distanceTo(L.la) > 160) { s.pos.set(L.la.x + rand(-1, 1), L.la.y, L.la.z + rand(-1, 1)); s.target = null; continue; } /* off camera: they make it to the cable */
    s.goal.set(L.la.x, 0, L.la.z); s.goalT = 10; s.goalCP = null; s.target = null;
  }
  if ((CITY.owT = (CITY.owT || 12) - 1) > 0) return; CITY.owT = rand(20, 35);
  const R = pick(CITY.roofs.filter(r => r.b.alive && r.vzip && r.holder <= 0 && !(r.queue && r.queue.length))); if (!R) return;
  let cp = CPS[0], bd = 1e9; for (const c of CPS) { const d = Math.hypot(c.x - R.b.x, c.z - R.b.z); if (d < bd) { bd = d; cp = c; } }
  const t = cp.owner && cp.owner !== 1 ? cp.owner : pick(ARMIES.filter(a => a !== 1 && !(typeof ELIM !== 'undefined' && ELIM[a]))); if (!t) return;
  R.queue = ENTS.filter(e => e.kind === 'soldier' && e.alive && e.team === t && !e.cmd && !e.mount && !e.deck && !e.downed && Math.hypot(e.pos.x - R.b.x, e.pos.z - R.b.z) < 600).sort((a, b) => Math.hypot(a.pos.x - R.b.x, a.pos.z - R.b.z) - Math.hypot(b.pos.x - R.b.x, b.pos.z - R.b.z)).slice(0, 3);
  for (const s of R.queue) s.liftT = 40;
}
/* ---------- per frame: neon at night, flicker, traffic lights, steam, sparks, collapse bookkeeping ---------- */
const TL_COL = [[0.2, 3, 0.6], [3.2, 2.2, 0.2], [3.2, 0.3, 0.2]];
function updateCity(dt) {
  const night = skyU.night ? skyU.night.value : 0, c = camera.position;
  if (CITY.neonMat) { const k = 0.55 + night * 1.1; const k2 = k * (0.92 + Math.random() * 0.08); CITY.neonMat.color.setRGB(k, k, k); CITY.signMat.color.setRGB(k2, k2, k2); }
  for (const B of CITY.boards) { const on = B.b.alive; B.m.visible = B.frame.visible = on; if (on) { B.m.material.opacity = (0.7 + 0.3 * Math.sin(TIME * 1.3 + B.ph)) * (Math.random() < 0.015 ? 0.2 : 1); B.m.position.y = B.b.top + 6.5 + Math.sin(TIME * 0.8 + B.ph) * 0.3; } }
  /* flickering signs */
  if (CITY.signs && Math.random() < dt * 6) { const i = (Math.random() * CITY.signList.length) | 0, r = CITY.signList[i]; CITY.signs.setColorAt(i, _c.setRGB(r.col[0] * 0.08, r.col[1] * 0.08, r.col[2] * 0.08)); CITY.signs.instanceColor.needsUpdate = true; CITY.flick.push({ i, t: rand(0.05, 0.3) }); if (camera.position.distanceTo(_v1.set(r.x, r.y, r.z)) < 40) snd('buzz', _v1, 0.3); }
  for (let k = CITY.flick.length - 1; k >= 0; k--) { const F = CITY.flick[k]; if ((F.t -= dt) > 0) continue; const r = CITY.signList[F.i]; CITY.signs.setColorAt(F.i, _c.setRGB(r.col[0], r.col[1], r.col[2])); CITY.signs.instanceColor.needsUpdate = true; CITY.flick.splice(k, 1); }
  /* traffic lights: green, amber, red, cross-street opposite */
  if (CITY.tl && (CITY.phT -= dt) <= 0) {
    CITY.phase = (CITY.phase + 1) % 4; CITY.phT = CITY.phase % 2 ? 2 : 7;
    CITY.tl.forEach((l, i) => { const st = (CITY.phase + (l.ax ? 2 : 0)) % 4, lit = st === 0 ? 0 : st === 1 || st === 3 ? 1 : 2; for (let k = 0; k < 3; k++) { const col = TL_COL[2 - k], on = (2 - k) === lit; CITY.tlHeads.setColorAt(i * 3 + k, _c.setRGB(on ? col[0] : 0.05, on ? col[1] : 0.05, on ? col[2] : 0.05)); } });
    CITY.tlHeads.instanceColor.needsUpdate = true;
  }
  /* steam from the manholes, near the camera */
  for (const m of CITY.vents) { const d = Math.hypot(m.x - c.x, m.z - c.z); if (d > 160) continue; m.acc += dt * (d < 60 ? 6 : 2.5); while (m.acc > 1) { m.acc -= 1; FXS.spawn(m.x + rand(-0.4, 0.4), m.y + 0.2, m.z + rand(-0.4, 0.4), rand(-0.4, 0.4) + 0.4, rand(2, 3.5), rand(-0.4, 0.4), rand(2, 3.5), 0.8, 4, 0.85, 0.86, 0.88, 0.7, 0.72, 0.74, 0.45, 0.4, 0.2); }
    if ((m.hissT -= dt) <= 0) { m.hissT = rand(5, 12); if (d < 35) snd('hiss', _v1.set(m.x, m.y, m.z), 0.5); } }
  /* snapped power lines throw sparks and blue light */
  for (const w of CITY.wires) { if (!w.broken || !w.a.alive) continue; if ((w.t -= dt) > 0) continue; w.t = rand(0.3, 2.2); const d = w.end.distanceTo(c); if (d > 220) continue;
    fxSparks(w.end, 14, [1.2, 2.4, 3.6], 9); if (d < 120) flashLight(w.end, 4, 25, 0.12, 0x7ab8ff); if (d < 60) snd('zap', w.end, 0.6); }
  for (const R of CITY.roofs) R.update(dt);
  /* neon and roof plant go with their building */
  if ((CITY.t -= dt) > 0) return; CITY.t = 0.5; if ((CITY.owS = (CITY.owS || 0) + 1) % 2 === 0) roofOverwatch(); const dirty = new Set();
  for (const a of CITY.att) { const on = a.b.alive; if (on === a.on) continue; a.on = on; const r = a.r; _m.compose(_v1.set(r.x, r.y, r.z), _q.setFromAxisAngle(UP, r.ry), on ? _s.set(r.sx, r.sy, r.sz) : _s.set(0, 0, 0)); a.im.setMatrixAt(a.i, _m); dirty.add(a.im); }
  for (const im of dirty) im.instanceMatrix.needsUpdate = true;
}
