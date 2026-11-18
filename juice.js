'use strict';
/* ===================== IRON MERIDIAN · hit feel =====================
   Every hit you land, from any weapon or power, now has weight. Frame counts are at 60 frames a second, so they feel
   the same on any phone:
   1 · hit stop      the whole game freezes for 5 frames on contact (the first touch on a target, and every kill);
   2 · hit flash     the enemy turns pure white for 2 frames;
   3 · knockback     it is shoved back half a metre (vehicles a fifth of that), easing out over 8 frames;
   4 · particles     10 drops splash out of every kill (blood from troops, oil and sparks from machines);
   5 · impact spark  a small four-point star where the attack lands, for 4 frames;
   6 · trail         a glowing arc follows the sweep of your laser across what it is burning;
   7 · damage numbers pop up, hop, and blink out.
   One hit point drives it all: wherever the player's damage lands (the game's damage-number call). */
const JUICE = { last: new WeakMap(), flash: [], knock: [], sparks: [], gapT: 0, frame: 0, v: new V3(), v2: new V3(), v3: new V3() };
const F60 = 1 / 60;
/* ---- 1 · hit stop: a true freeze, counted in frames (main.js honours HITSTOP.f) ---- */
HITSTOP.f = 0;
function juiceStop(frames) { if (TIME - JUICE.gapT < 0.18) return; JUICE.gapT = TIME; HITSTOP.f = Math.max(HITSTOP.f, frames); }
/* ---- 2 · hit flash ---- */
const JUICE_WHITE = new T.MeshBasicMaterial({ color: 0xffffff, fog: false });
function juiceFlash(e) {
  if (!e.obj || e.imp || e.flashF > 0) return; const list = [];
  e.obj.traverse(o => { if (o.isMesh && o.visible && o.material !== JUICE_WHITE && !o.isInstancedMesh) { list.push([o, o.material]); o.material = JUICE_WHITE; } });
  if (list.length) { e.flashF = 3; JUICE.flash.push({ e, list }); } /* counted down at the end of this frame's update: white for 2 drawn frames */
}
/* ---- 3 · knockback ---- */
function juiceKnock(e, from) {
  if (!e.alive || e.downed || e.mount || e.deck) return;
  const D = e.kind === 'soldier' ? 0.55 : (e.kind === 'tank' || e.kind === 'speeder' || e.kind === 'shiftframe') ? 0.12 : 0; if (!D) return;
  let dx = e.pos.x - from.x, dz = e.pos.z - from.z, l = Math.hypot(dx, dz); if (l < 0.01) { dx = 1; dz = 0; l = 1; }
  const k = JUICE.knock.find(q => q.e === e); const q = k || { e }; q.dx = dx / l; q.dz = dz / l; q.D = D; q.f = 0; q.done = 0; if (!k) JUICE.knock.push(q);
}
/* ---- 4 · kill particles ---- */
function juiceDrops(e, at) {
  const meat = e.kind === 'soldier';
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * 6.283, sp = rand(2.5, 6.5), up = rand(2.5, 6);
    if (meat) FXS.spawn(at.x, at.y, at.z, Math.cos(a) * sp, up, Math.sin(a) * sp, rand(0.45, 0.8), 0.22, 0.12, 0.62, 0.03, 0.03, 0.32, 0.01, 0.01, 1, 0.6, -16);
    else if (i % 2) FXS.spawn(at.x, at.y, at.z, Math.cos(a) * sp, up, Math.sin(a) * sp, rand(0.5, 0.9), 0.3, 0.16, 0.06, 0.05, 0.04, 0.02, 0.02, 0.02, 1, 0.6, -16);
    else FXA.spawn(at.x, at.y, at.z, Math.cos(a) * sp * 1.4, up * 1.2, Math.sin(a) * sp * 1.4, rand(0.3, 0.55), 0.22, 0.05, 3, 1.8, 0.6, 1.6, 0.5, 0.1, 1, 0.5, -14);
  }
}
/* ---- 5 · impact spark: a small four-point star ---- */
const JUICE_STAR = canvasTex(64, 64, c => {
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,240,200,.9)'); g.addColorStop(1, 'rgba(255,200,120,0)');
  c.fillStyle = g; c.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, r = i % 2 ? 6 : 31; c.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } c.closePath(); c.fill();
});
for (let i = 0; i < 10; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: JUICE_STAR, color: new T.Color(2.6, 2.3, 1.8), transparent: true, blending: T.AdditiveBlending, depthWrite: false, depthTest: false, fog: false })); s.visible = false; s.renderOrder = 22; scene.add(s); JUICE.sparks.push({ s, f: 0 }); }
function juiceSpark(at, big) {
  const k = JUICE.sparks.reduce((a, b) => (b.f < a.f ? b : a)); k.f = 5; /* 4 drawn frames */ k.s.position.copy(at); k.s.material.rotation = Math.random() * 6.283;
  k.s.scale.setScalar(big ? 1.7 : 1.05); k.s.visible = true;
}
/* ---- 6 · the laser's trail: a fading ribbon through the last points it burned ---- */
const TRAIL_N = 14;
const JUICE_TRAIL = (() => {
  const g = new T.BufferGeometry(), pos = new Float32Array(TRAIL_N * 2 * 3), col = new Float32Array(TRAIL_N * 2 * 3), idx = [];
  for (let i = 0; i < TRAIL_N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setIndex(idx); g.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage)); g.setAttribute('color', new T.BufferAttribute(col, 3).setUsage(T.DynamicDrawUsage));
  const m = new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
  m.frustumCulled = false; m.renderOrder = 20; m.visible = false; scene.add(m); return { m, pts: [], pos, col };
})();
function juiceTrail() {
  const T0 = JUICE_TRAIL, firing = typeof LZ !== 'undefined' && LZ.on && LZ.hit;
  if (firing) { if (T0.pts.length && T0.pts[0].p.distanceTo(LZ.hit) > 5) T0.pts.length = 0; /* the beam jumped to another target: a new arc, not a streak across the ground */
    T0.pts.unshift({ p: LZ.hit.clone(), a: 0 }); } for (const q of T0.pts) q.a++;
  while (T0.pts.length > TRAIL_N || (T0.pts.length && T0.pts[T0.pts.length - 1].a > 10)) T0.pts.pop();
  if (T0.pts.length < 2) { T0.m.visible = false; return; }
  const cam = camera.position, P = T0.pos, C = T0.col, w = JUICE.v, d = JUICE.v2, toC = JUICE.v3;
  for (let i = 0; i < TRAIL_N; i++) {
    const q = T0.pts[Math.min(i, T0.pts.length - 1)], nb = T0.pts[Math.min(i + 1, T0.pts.length - 1)], pb = T0.pts[Math.min(Math.max(0, i - 1), T0.pts.length - 1)];
    d.subVectors(pb.p, nb.p); if (d.lengthSq() < 1e-6) d.set(1, 0, 0); toC.subVectors(cam, q.p).normalize(); w.crossVectors(d, toC).normalize();
    const k = 1 - Math.min(1, q.a / 10) * (i < T0.pts.length ? 1 : 0), fade = (1 - i / TRAIL_N) * k, hw = 0.12 + fade * 0.35;
    P.set([q.p.x + w.x * hw, q.p.y + w.y * hw, q.p.z + w.z * hw, q.p.x - w.x * hw, q.p.y - w.y * hw, q.p.z - w.z * hw], i * 6);
    const r = 2.2 * fade, g = 0.55 * fade, b = 0.25 * fade; C.set([r, g, b, r, g, b], i * 6);
  }
  T0.m.geometry.attributes.position.needsUpdate = true; T0.m.geometry.attributes.color.needsUpdate = true; T0.m.visible = true;
}
/* ---- the hit itself: wherever the player's damage lands ---- */
function juiceHit(e, a, kill) {
  const pe = PLAYER.ent; if (!e || !e.pos || !pe) return;
  /* where it landed: the laser's burn point if that is what hit, else the near side of the target */
  const at = JUICE.v.copy(e.aim ? e.aim(JUICE.v3) : e.pos);
  if (typeof LZ !== 'undefined' && LZ.on && LZ.hit && LZ.hit.distanceTo(at) < (e.radius || 2) + 3) at.copy(LZ.hit);
  else { const dx = pe.pos.x - at.x, dz = pe.pos.z - at.z, l = Math.hypot(dx, dz) || 1, r = Math.min(3, (e.radius || 1) * 0.7); at.x += dx / l * r; at.z += dz / l * r; }
  const seen = JUICE.last.get(e) || -9, fresh = TIME - seen > 0.5; JUICE.last.set(e, TIME);
  if (fresh || kill) juiceStop(5);
  if (TIME - (e.flashT || -9) > 0.12) { e.flashT = TIME; juiceFlash(e); }
  if (TIME - (e.knockT || -9) > 0.15) { e.knockT = TIME; juiceKnock(e, pe.pos); }
  if (TIME - (e.sparkT || -9) > 0.08 || kill) { e.sparkT = TIME; juiceSpark(at, kill || a >= 150); }
  if (kill) juiceDrops(e, at);
}
{
  const _dn = dmgNumber;
  dmgNumber = function (ent, a, kill, kind) {
    /* the number: a fresh one at most every 0.2 s per target (it adds up), so each can pop, hop and blink out */
    if (!kind || kind === 'crit') { PLAYER.dealt += a; PLAYER.lifeDealt += a; }
    let n = DMGN.find(d => d.ent === ent && d.t < 0.2);
    if (!n) { if (DMGN.length > 26) { const o = DMGN.shift(); o.div.remove(); } const div = document.createElement('div'); div.className = 'dn'; $('#dmg').appendChild(div); n = { ent, div, amt: 0, t: 0, pos: new V3(), jx: rand(-18, 18), kill: false }; DMGN.push(n); }
    n.amt += a; n.kill = n.kill || kill; ent.aim(n.pos); if (kind === 'crit') n.crit = true;
    n.div.textContent = kind === 'shield' ? 'SHIELDED' : kind === 'armor' ? 'NO EFFECT · USE ROCKETS' : (n.crit ? 'CRIT ' : '') + Math.max(1, Math.round(n.amt));
    n.div.className = 'dn' + (n.kill ? ' k' : n.amt >= 150 ? ' big' : '') + (n.crit ? ' crit' : '') + (kind && kind !== 'crit' ? ' sh' : '');
    if (a > 0 && (!kind || kind === 'crit')) juiceHit(ent, a, kill);
  };
  /* pop (overshoot to 1.5×), hop (up and settle), blink out — 0.85 s in all */
  const _ud = updateDamageUI;
  updateDamageUI = function (dt) {
    for (let i = DMGN.length - 1; i >= 0; i--) if (DMGN[i].t > 0.85) { DMGN[i].div.remove(); DMGN.splice(i, 1); }
    _ud(dt);
    for (const n of DMGN) {
      const t = n.t, v = JUICE.v2.copy(n.pos); v.y += 0.6; v.project(camera); if (v.z > 1) { n.div.style.display = 'none'; continue; }
      const pop = t < 0.06 ? t / 0.06 * 1.5 : t < 0.14 ? 1.5 - (t - 0.06) / 0.08 * 0.5 : 1;
      const hop = t < 0.24 ? -Math.sin(t / 0.24 * Math.PI / 2) * 38 : -38 + Math.min(1, (t - 0.24) / 0.2) * 14;
      const blink = t > 0.55 ? (Math.floor((t - 0.55) / 0.05) % 2 === 0 ? 1 : 0) : 1;
      n.div.style.display = 'block'; n.div.style.left = ((v.x + 1) / 2 * innerWidth + n.jx) + 'px'; n.div.style.top = ((1 - v.y) / 2 * innerHeight + hop) + 'px';
      n.div.style.opacity = blink; n.div.style.transform = `translate(-50%,-50%) scale(${pop})`;
    }
  };
}
/* ---- every frame: flashes end, knockbacks ease out, sparks expire, the trail follows the beam ---- */
function juiceTick() {
  JUICE.frame++;
  for (let i = JUICE.flash.length - 1; i >= 0; i--) { const q = JUICE.flash[i]; if (--q.e.flashF > 0) continue; for (const [o, m] of q.list) if (o.material === JUICE_WHITE) o.material = m; JUICE.flash.splice(i, 1); }
  const frozen = HITSTOP.f > 0;
  if (!frozen) for (let i = JUICE.knock.length - 1; i >= 0; i--) {
    const q = JUICE.knock[i], e = q.e; if (!e.alive || e.downed) { JUICE.knock.splice(i, 1); continue; }
    q.f++; const k = Math.min(1, q.f / 8), want = q.D * (1 - Math.pow(1 - k, 3)), step = want - q.done; q.done = want;
    e.pos.x += q.dx * step; e.pos.z += q.dz * step; pushOut(e.pos, e.kind === 'soldier' ? 0.5 : 3); if (e.obj) { e.obj.position.x = e.pos.x; e.obj.position.z = e.pos.z; }
    if (k >= 1) JUICE.knock.splice(i, 1);
  }
  for (const k of JUICE.sparks) if (k.f > 0 && --k.f === 0) k.s.visible = false;
  juiceTrail();
}
{ const _uw = updateWorld; updateWorld = function (dt) { _uw(dt); juiceTick(); }; }
