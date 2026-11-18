'use strict';
/* ===================== IRON MERIDIAN · finishers: ending a knocked-down soldier, both locked in one animation =====================
   A soldier who goes down waits for a medic. Get the Hero to him first and the FINISH button lights up (V on a
   keyboard). Press it and the two of you are locked together: the Hero is set beside him, the camera swings round to
   the side, and one of three kills plays through on both bodies at once.
     · Slam:    hauled up by the collar, lifted overhead and driven into the ground
     · Crush:   lifted on the Force, twisted in the air and crushed in a burst of light
     · Strike:  a leap and a downward palm that calls the lightning in after it
   Neither of you can be interrupted: the soldier cannot be shot or revived, and the Hero takes a quarter of any damage
   while it plays. The line troops do it to each other too. A soldier who finds a knocked enemy at his feet with no fight close by
   finishes him (a rifle butt, a stamp, or a haul up by the collar and a throw), both locked in the same way. That only plays where you can see it. */
const FIN = { on: null, cand: null, scanT: 0, cool: 0, req: false, ai: [], aiT: 0, pad: null, tip: null, ring: null };
const FIN_KINDS = { slam: { dur: 1.9, hit: 1.05, name: 'Slam' }, crush: { dur: 1.85, hit: 1.15, name: 'Crush' }, strike: { dur: 1.6, hit: 0.78, name: 'Strike' } };
const FIN_AI_MAX = LOW_END ? 2 : 4;
/* the line troops' finishers: each blow is a time in seconds; the last one kills */
const FIN_AI = {
  butt:  { dur: 1.5, hit: 1.0, blows: [0.58, 0.98] },   /* kneel and drive the rifle butt down, twice */
  stomp: { dur: 1.3, hit: 0.86, blows: [0.86] },        /* stand over him, boot raised, one stamp */
  haul:  { dur: 1.75, hit: 1.22, blows: [1.22] },       /* haul him up by the collar and throw him down */
};
const _fq = new V3(), _fq2 = new V3();
const ease = k => k * k * (3 - 2 * k), seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
PLAY_KEYS.add('KeyV'); TAP_KEYS.add('KeyV');

/* ---------- the button, the prompt and the ring on the ground ---------- */
{
  const st = document.createElement('style');
  st.textContent = `#tFin{display:none!important;left:50%;right:auto!important;transform:translateX(-50%);bottom:calc(30px + env(safe-area-inset-bottom,0px));width:78px!important;height:78px!important;border-color:rgba(255,93,61,.9)!important;background:rgba(70,14,6,.6)!important;color:#ffc2b3;font-size:12px!important;letter-spacing:.12em;animation:finP .7s ease-in-out infinite alternate}
#touch.canfin #tFin{display:grid!important}
@keyframes finP{from{box-shadow:0 0 0 rgba(255,93,61,0)}to{box-shadow:0 0 22px rgba(255,93,61,.75)}}
@media (max-height:500px){#tFin{width:64px!important;height:64px!important;bottom:calc(14px + env(safe-area-inset-bottom,0px))}}
#finTip{position:fixed;left:50%;top:62%;transform:translateX(-50%);font:800 14px var(--display);letter-spacing:.16em;color:#ffc2b3;text-shadow:0 0 8px #000;padding:6px 14px;border:1px solid rgba(255,93,61,.75);background:rgba(30,6,4,.55);border-radius:3px;display:none;pointer-events:none;z-index:5}
#finTip.on{display:block} #finTip b{color:#fff;margin-right:8px}
@media (pointer:coarse){#finTip{display:none!important}}`;
  document.head.appendChild(st);
  const touch = document.getElementById('touch');
  if (touch) { const p = document.createElement('div'); p.className = 'tb'; p.id = 'tFin'; p.textContent = 'FINISH'; touch.appendChild(p); FIN.pad = p;
    p.addEventListener('touchstart', e => { e.preventDefault(); FIN.req = true; }, { passive: false }); }
  const tip = document.createElement('div'); tip.id = 'finTip'; tip.innerHTML = '<b>V</b>FINISH'; document.body.appendChild(tip); FIN.tip = tip;
  const ring = new T.Mesh(new T.RingGeometry(0.9, 1.15, 28).rotateX(-Math.PI / 2), basic(new T.Color(3.2, 0.7, 0.4), { transparent: true, opacity: 0.85, depthWrite: false, side: T.DoubleSide }));
  ring.visible = false; ring.renderOrder = 3; scene.add(ring); FIN.ring = ring;
}

/* ---------- who can be finished ---------- */
const finVictim = v => v && v.kind === 'soldier' && v.alive && v.downed && !v.remove && !v.finLock;
function finScan() {
  const P = PLAYER, pe = P.ent; FIN.cand = null;
  if (GAME.state !== 'play' || FIN.on || FIN.cool > TIME || !pe || !pe.alive || P.role !== 'trooper' || pe.mount || P.pod || POW.dive) return;
  const reach = POW.fly ? 9 : 6; let bd = reach * reach;
  for (const e of ENTS) {
    if (!finVictim(e) || !isHostile(e.team) || Math.abs(e.pos.y - pe.pos.y) > 9) continue;
    const dx = e.pos.x - pe.pos.x, dz = e.pos.z - pe.pos.z, d = dx * dx + dz * dz; if (d < bd) { bd = d; FIN.cand = e; }
  }
}
function releaseVictim(v) { for (const e of ENTS) if (e.revTgt === v) e.revTgt = null; v.reviver = null; if (v.beacon) v.beacon.visible = false; v.hitR = false; }
function resetTrooperPose(s) { if (s.body) { s.body.position.set(0, 0, 0); s.body.rotation.set(0, 0, 0); } if (s.legs) for (const l of s.legs) { l.th.rotation.set(0, 0, 0); l.sh.rotation.set(0, 0, 0); } s.obj.scale.set(1, 1, 1); }

/* ---------- the Hero's finisher ---------- */
function finStart(v) {
  const P = PLAYER, pe = P.ent;
  POW.fly = false; POW.dive = null; POW.diveReq = false; P.vy = 0; P.para = false; P.free = false; if (typeof showCanopy === 'function') showCanopy(pe, false);
  const g = surfY(v.pos.x, v.pos.z, v.pos.y); v.pos.y = g;
  let dx = pe.pos.x - v.pos.x, dz = pe.pos.z - v.pos.z, l = Math.hypot(dx, dz); if (l < 0.3) { dx = Math.sin(v.yaw); dz = Math.cos(v.yaw); l = 1; }
  const hx = v.pos.x + dx / l * 1.5, hz = v.pos.z + dz / l * 1.5; pe.pos.set(hx, surfY(hx, hz, g + 1), hz);
  const yaw = Math.atan2(v.pos.x - hx, v.pos.z - hz), kind = pick(['slam', 'crush', 'strike']);
  releaseVictim(v);
  const L = { kind, K: FIN_KINDS[kind], v, a: pe, t: 0, hit: false, yaw, g, hp: pe.pos.clone(), vp: v.pos.clone(), cam0: camera.position.clone(), side: Math.random() < 0.5 ? -1 : 1, player: true };
  v.finLock = L; pe.finLock = L; FIN.on = L; FIN.cand = null;
  P.yaw = yaw + Math.PI; pe.yaw = yaw; v.yaw = yaw + Math.PI;
  const lb = document.getElementById('letterbox'); if (lb) lb.classList.add('on');
  snd('ui', null, 0.5); shake(0.08, pe.pos);
}
function finImpact(L) {
  const v = L.v, p = _fq.copy(v.pos); L.hit = true;
  if (L.kind === 'slam') { p.y = L.g; shockRing(p, 9, 0.5, 0xffc890); fxDust(p, 18, 5, 9); debrisBurst(p, 14, 9, 0.5, 'concrete'); shake(0.55, p); snd('stomp', p, 0.9); snd('boom', p, 0.5); flashLight(_fq2.copy(p).setY(p.y + 1.5), 4, 20, 0.2, 0xffd0a0); }
  else if (L.kind === 'crush') { p.y += 1.2; fxSparks(p, 30, [1.6, 2.6, 4], 14); flashLight(p, 8, 30, 0.25, 0x8fd8ff); shockRing(_fq2.copy(p).setY(L.g), 7, 0.4, 0x8fd8ff); shake(0.4, p); snd('heavy', p, 0.6); }
  else { p.y = L.g; _fq2.set(p.x + rand(-6, 6), p.y + 260, p.z + rand(-6, 6)); beam(_fq2, p, 0.9, 0.3, 0x9fd0ff); flashLight(_fq2.copy(p).setY(p.y + 6), 10, 60, 0.25, 0xbfe2ff); shockRing(p, 11, 0.4, 0x9fd0ff); fxDust(p, 14, 4, 8); debrisBurst(p, 10, 8, 0.45, 'concrete'); shake(0.6, p); snd('heavy', p, 0.7); }
  finKill(L, L.kind === 'crush' ? 'splash' : 'blade');
  awardPoints(150, `Finisher · ${L.K.name}`);
}
function finKill(L, type) {
  const v = L.v, a = L.a; v.finLock = null; resetTrooperPose(v); v.hitR = true; v.downed = false; if (v.beacon) v.beacon.visible = false;
  if (L.kind === 'slam') v.pos.y = L.g;
  v.lastHit = { src: a, type, a: 200, t: TIME }; v.hp = 0; v.alive = false; v.killed(a, type);
}
function finEnd(L) {
  const P = PLAYER, pe = L.a; pe.finLock = null;
  if (L.v.finLock === L) { L.v.finLock = null; resetTrooperPose(L.v); L.v.hitR = true; } /* cut short: he is still down, and can still be saved */
  pe.pos.y = surfY(pe.pos.x, pe.pos.z, pe.pos.y + 1); P.vy = 0; P.grounded = true;
  P.yaw = L.yaw + Math.PI; P.pitch = -0.12; P.camPos.copy(camera.position); P.camInit = true;
  const lb = document.getElementById('letterbox'); if (lb) lb.classList.remove('on');
  FIN.on = null; FIN.cool = TIME + 0.5;
}
function finTick(L, dt) {
  const pe = L.a, v = L.v; L.t += dt; const t = L.t, K = L.K;
  if (!pe.alive || pe !== PLAYER.ent || (!L.hit && (!v.alive || v.remove || v.finLock !== L))) return finEnd(L);
  /* the Hero's feet: planted, except for the leap of the strike */
  pe.pos.copy(L.hp);
  if (L.kind === 'strike') { const k = seg(t, 0.35, 0.74), fx = Math.sin(L.yaw), fz = Math.cos(L.yaw); pe.pos.x += fx * ease(k) * 0.8; pe.pos.z += fz * ease(k) * 0.8; pe.pos.y += Math.sin(k * Math.PI) * 2.2 * (k < 1 ? 1 : 0); }
  if (!L.hit && t >= K.hit) finImpact(L);
  if (t >= K.dur) finEnd(L);
}
/* poses, on the Hero rig (arms, legs, body) and on the trooper rig (body, legs, the whole figure) */
function finHeroPose(L, e) {
  const H = e.heroParts, R = H.arms[0], Lf = H.arms[1], t = L.t; e.yaw = L.yaw; e.obj.rotation.set(0, L.yaw, 0); e.obj.position.copy(e.pos);
  const knees = k => { H.legs[0].thigh.rotation.x = -0.5 * k; H.legs[1].thigh.rotation.x = 0.25 * k; H.legs[0].shin.rotation.x = 0.9 * k; H.legs[1].shin.rotation.x = 0.7 * k; H.body.position.y = -0.25 * k; };
  if (L.kind === 'slam') {
    const reach = ease(seg(t, 0, 0.35)), lift = ease(seg(t, 0.35, 0.95)), down = ease(seg(t, 0.95, 1.06)), rec = ease(seg(t, 1.3, 1.9));
    const sh = lerp(lerp(lerp(-0.3, -1.25, reach), -2.95, lift), -0.7, down); R.sh.rotation.set(lerp(sh, -0.3, rec), 0.15, 0.1); R.el.rotation.x = lerp(-0.2, -0.5, lift) * (1 - rec);
    Lf.sh.rotation.set(lerp(-0.1, -2.6, lift) * (1 - down) * (1 - rec), -0.1, -0.2); Lf.el.rotation.x = -0.3;
    H.body.rotation.x = lerp(lerp(lerp(0.02, 0.35, reach), -0.15, lift), 0.55, down) * (1 - rec); knees(Math.max(reach * (1 - lift), down) * (1 - rec));
  } else if (L.kind === 'crush') {
    const up = ease(seg(t, 0, 0.3)), both = ease(seg(t, 0.55, 0.85)), close = ease(seg(t, 0.95, 1.15)), rec = ease(seg(t, 1.35, 1.85));
    Lf.sh.rotation.set(-1.45 * up * (1 - rec), -0.15, -0.05); Lf.el.rotation.x = lerp(-0.1, -0.9, close) * (1 - rec);
    R.sh.rotation.set(-1.4 * both * (1 - rec) - 0.3 * (1 - both), 0.15, 0.1); R.el.rotation.x = lerp(-0.1, -0.9, close) * (1 - rec);
    H.body.rotation.x = (-0.08 * up + 0.25 * close) * (1 - rec); knees(0.4 * close * (1 - rec));
  } else {
    const wind = ease(seg(t, 0, 0.35)), air = seg(t, 0.35, 0.72), drive = ease(seg(t, 0.68, 0.8)), rec = ease(seg(t, 1.05, 1.6));
    R.sh.rotation.set(lerp(lerp(lerp(-0.3, 0.8, wind), -2.9, ease(air)), -0.5, drive) * (1 - rec) - 0.3 * rec, 0.1, 0.1); R.el.rotation.x = -0.3;
    Lf.sh.rotation.set(-0.6 * wind * (1 - rec), 0, -0.5 * air); Lf.el.rotation.x = -0.3;
    H.body.rotation.x = lerp(lerp(0.3 * wind, -0.2, ease(air)), 0.6, drive) * (1 - rec);
    knees(Math.max(wind * (1 - air), drive) * (1 - rec)); if (air > 0 && air < 1) { H.legs[0].thigh.rotation.x = -1.1; H.legs[1].thigh.rotation.x = -0.4; H.legs[0].shin.rotation.x = 1.6; H.legs[1].shin.rotation.x = 1.1; }
  }
}
function finVictimPose(L, v, dt) {
  const t = L.t, o = v.obj; o.rotation.order = 'YXZ'; v.yaw = L.yaw + Math.PI;
  const legs = (a, b) => { if (!v.legs) return; v.legs[0].th.rotation.set(a, 0, 0.15); v.legs[1].th.rotation.set(b, 0, -0.15); v.legs[0].sh.rotation.x = 0.4 + Math.max(0, a) * 0.6; v.legs[1].sh.rotation.x = 0.4 + Math.max(0, b) * 0.6; };
  if (!L.player) { /* the troops' finishers: on his back, a jolt with each blow */
    let j = 0; for (const b of L.K.blows) j += Math.max(0, Math.sin(seg(t, b - 0.03, b + 0.12) * Math.PI));
    if (L.kind === 'haul') { /* dragged up to sitting by the collar, then thrown back down */
      const up = ease(seg(t, 0.3, 0.95)), down = ease(seg(t, 1.12, 1.24)), fx = Math.sin(L.yaw), fz = Math.cos(L.yaw);
      o.position.set(L.vp.x - fx * 0.3 * up * (1 - down), L.g + 0.55 * up * (1 - down) + j * 0.08, L.vp.z - fz * 0.3 * up * (1 - down));
      o.rotation.set(lerp(-1.45, -0.35, up) * (1 - down) - 1.5 * down, v.yaw, Math.sin(t * 14) * 0.1 * up * (1 - down)); legs(0.5 * up * (1 - down) + j * 0.3, 0.2 * up); return;
    }
    o.position.copy(v.pos); o.rotation.set(-1.45 + j * 0.12, v.yaw, Math.sin(t * 9) * 0.05 * (1 - seg(t, L.K.hit - 0.05, L.K.hit))); legs(-0.2 + j * 0.3, 0.1 + (L.kind === 'stomp' ? j * 0.4 : 0)); return;
  }
  const fx = Math.sin(L.yaw), fz = Math.cos(L.yaw); /* toward the victim, from the Hero */
  if (L.kind === 'slam') {
    const reach = ease(seg(t, 0.15, 0.4)), lift = ease(seg(t, 0.35, 0.95)), down = ease(seg(t, 0.95, 1.06));
    const y = L.g + lerp(0, lerp(1.1, 2.6, lift), reach) * (1 - down);
    o.position.set(L.vp.x - fx * 0.35 * reach * (1 - down), y, L.vp.z - fz * 0.35 * reach * (1 - down));
    o.rotation.set(lerp(-1.45, lerp(0.15, -0.25, lift), reach) * (1 - down) + -1.5 * down, v.yaw, Math.sin(t * 13) * 0.12 * lift * (1 - down)); legs(Math.sin(t * 15) * 0.6 * lift * (1 - down), -Math.sin(t * 15) * 0.6 * lift * (1 - down));
    if (v.body) v.body.rotation.x = -0.3 * lift * (1 - down);
  } else if (L.kind === 'crush') {
    const rise = ease(seg(t, 0.1, 0.9)), close = ease(seg(t, 0.95, 1.15)), spin = seg(t, 0.2, 1.15);
    o.position.set(L.vp.x + Math.sin(t * 31) * 0.05 * close, L.g + 2.1 * rise, L.vp.z + Math.cos(t * 27) * 0.05 * close);
    o.rotation.set(lerp(-1.45, 0.1, rise), v.yaw + spin * spin * 3.5, Math.sin(t * 7) * 0.25 * rise); legs(Math.sin(t * 11) * 0.7 * rise, Math.cos(t * 11) * 0.7 * rise);
    o.scale.set(1 - 0.35 * close, 1 - 0.5 * close, 1 - 0.35 * close);
    if (rise > 0 && Math.random() < 0.6) FXA.spawn(o.position.x + rand(-1.2, 1.2), o.position.y + rand(0, 1.8), o.position.z + rand(-1.2, 1.2), rand(-1, 1), rand(0.5, 2), rand(-1, 1), 0.4, 0.4, 1.2, 0.5, 1.6, 3.2, 0.2, 0.6, 1.8, 1, 0, 0);
  } else {
    const jolt = Math.max(0, 1 - Math.abs(t - L.K.hit) * 8), look = ease(seg(t, 0.2, 0.6));
    o.position.set(L.vp.x, L.g + jolt * 0.25, L.vp.z); o.rotation.set(-1.45 + 0.35 * look - jolt * 0.2, v.yaw, 0); legs(0.3 * look + jolt, -0.1 - jolt * 0.5);
  }
}
function finAttackerPose(L, a) { /* the trooper's side: step in and finish him */
  const t = L.t, o = a.obj; a.yaw = L.yaw; o.position.copy(a.pos); o.rotation.set(0, L.yaw, 0);
  if (L.kind === 'stomp') { /* boot raised high, then down */
    const raise = ease(seg(t, 0.15, 0.7)), drive = ease(seg(t, 0.72, 0.86)), rec = ease(seg(t, 0.95, 1.3)), k = raise * (1 - drive);
    if (a.legs) { a.legs[0].th.rotation.set((-1.35 * k - 0.35 * drive) * (1 - rec), 0, 0); a.legs[0].sh.rotation.x = (1.5 * k + 0.1 * drive) * (1 - rec); a.legs[1].th.rotation.set(0.15 * raise * (1 - rec), 0, 0); a.legs[1].sh.rotation.x = 0.25 * raise * (1 - rec); }
    if (a.body) { a.body.position.y = -0.08 * drive * (1 - rec); a.body.rotation.x = (-0.12 * k + 0.35 * drive) * (1 - rec); } return;
  }
  if (L.kind === 'haul') { /* bend, grab, straighten with him, throw */
    const bend = ease(seg(t, 0, 0.35)), pull = ease(seg(t, 0.3, 0.95)), thr = ease(seg(t, 1.05, 1.24)), rec = ease(seg(t, 1.35, 1.75));
    if (a.legs) { const kn = (bend * (1 - pull) * 0.9 + 0.3 * thr) * (1 - rec); a.legs[0].th.rotation.set(-0.7 * kn, 0, 0); a.legs[0].sh.rotation.x = 1.1 * kn; a.legs[1].th.rotation.set(0.25 * kn, 0, 0); a.legs[1].sh.rotation.x = 0.7 * kn; }
    if (a.body) { a.body.position.y = -0.25 * bend * (1 - pull) * (1 - rec); a.body.rotation.x = (0.85 * bend * (1 - pull) + 0.15 * pull * (1 - thr) + 0.7 * thr) * (1 - rec); } return;
  }
  const kneel = ease(seg(t, 0, 0.35)), b1 = Math.sin(seg(t, 0.4, 0.62) * Math.PI), b2 = Math.sin(seg(t, 0.78, 1.0) * Math.PI), rec = ease(seg(t, 1.15, 1.5));
  if (a.legs) { a.legs[0].th.rotation.set(-1.1 * kneel * (1 - rec), 0, 0); a.legs[0].sh.rotation.x = 1.9 * kneel * (1 - rec); a.legs[1].th.rotation.set(-0.2 * kneel * (1 - rec), 0, 0); a.legs[1].sh.rotation.x = 1.4 * kneel * (1 - rec); }
  if (a.body) { a.body.position.y = -0.36 * kneel * (1 - rec); a.body.rotation.x = (0.15 + Math.max(b1, b2) * 0.75) * kneel * (1 - rec); }
}

/* ---------- the line troops' finisher ---------- */
function finAIScan() {
  if (FIN.ai.length >= FIN_AI_MAX) return; const cp = camera.position;
  for (const v of ENTS) {
    if (!finVictim(v) || (v.finBy && v.finBy.alive && v.finBy.finGo === v) || v.pos.distanceToSquared(cp) > 220 * 220 || Math.random() > 0.6) continue;
    /* the one who put him down comes to finish it, if he is close enough; otherwise the nearest enemy who is free */
    let best = null, bd = 70 * 70; const ok = a => a && a.kind === 'soldier' && a.alive && !a.downed && !a.isPlayer && !a.hero && !a.mount && !a.finLock && !a.finGo && !a.driverDuty && !a.zipGo && !a.zipTrip && !a.warBoard && !a.para && !a.deck && a.team !== v.team && !(a.target && a.target !== v && a.target.alive && a.target.pos.distanceTo(a.pos) < 25);
    const by = v.downBy; if (ok(by) && by.pos.distanceToSquared(v.pos) < 90 * 90) { best = by; bd = by.pos.distanceToSquared(v.pos); }
    else for (const a of ENTS) { if (!ok(a)) continue; const d = a.pos.distanceToSquared(v.pos); if (d < bd) { bd = d; best = a; } }
    if (!best) continue;
    if (bd > 3.6 * 3.6) { best.finGo = v; best.finGoT = 17; v.finBy = best; continue; } /* walk over to him first */
    finAIStart(best, v); if (FIN.ai.length >= FIN_AI_MAX) return;
  }
}
function finAIStart(best, v) {
  {
    const dx = best.pos.x - v.pos.x, dz = best.pos.z - v.pos.z, l = Math.hypot(dx, dz) || 1, g = surfY(v.pos.x, v.pos.z, v.pos.y);
    best.pos.set(v.pos.x + dx / l * 1.1, surfY(v.pos.x + dx / l * 1.1, v.pos.z + dz / l * 1.1, g + 1), v.pos.z + dz / l * 1.1);
    releaseVictim(v); best.target = null;
    const kind = pick(['butt', 'stomp', 'haul']);
    const L = { kind, K: FIN_AI[kind], bi: 0, v, a: best, t: 0, hit: false, yaw: Math.atan2(v.pos.x - best.pos.x, v.pos.z - best.pos.z), g, vp: v.pos.clone(), player: false };
    v.finLock = L; best.finLock = L; v.finBy = null; best.finGo = null; FIN.ai.push(L);
  }
}
function finAITick(dt) {
  for (let i = FIN.ai.length - 1; i >= 0; i--) {
    const L = FIN.ai[i], a = L.a, v = L.v; L.t += dt;
    const broken = !a.alive || a.downed || a.finLock !== L || (!L.hit && (!v.alive || v.remove || v.finLock !== L));
    if (!broken && L.bi < L.K.blows.length && L.t >= L.K.blows[L.bi]) { L.bi++; fxSparks(_fq.copy(v.pos).setY(v.pos.y + 0.4), 5, [2.5, 1.8, 1], 5); snd('stomp', v.pos, 0.35);
      if (L.kind !== 'butt') { fxDust(_fq.set(v.pos.x, L.g, v.pos.z), 6, 2, 4); shake(0.08, v.pos); } }
    if (!broken && !L.hit && L.t >= L.K.hit) { L.hit = true; finKill(L, 'blade'); if (a.team === 1 && Math.random() < 0.3) comms(a.name, pick(['He is done.', 'Stay down.', 'One less.']), 'b'); }
    if (broken || L.t >= L.K.dur) {
      if (a.finLock === L) { a.finLock = null; resetTrooperPose(a); a.think = 0; }
      if (v.finLock === L) { v.finLock = null; resetTrooperPose(v); v.hitR = true; }
      FIN.ai.splice(i, 1);
    }
  }
}

/* ---------- wiring ---------- */
{
  const _upd = Soldier.prototype.update;
  Soldier.prototype.update = function (dt) {
    const L = this.finLock;
    if (L && !this.isPlayer) { if (this === L.v) { finVictimPose(L, this, dt); return; } if (this === L.a) { finAttackerPose(L, this); return; } this.finLock = null; }
    const v = this.finGo;
    if (v && this.alive && !this.downed && !this.mount) { /* striding over to a knocked enemy to finish him */
      if (!finVictim(v) || (this.finGoT -= dt) <= 0 || FIN.ai.length >= FIN_AI_MAX) { this.finGo = null; if (v.finBy === this) v.finBy = null; }
      else if (Math.hypot(v.pos.x - this.pos.x, v.pos.z - this.pos.z) < 3.6) finAIStart(this, v);
      else { this.goal.set(v.pos.x, 0, v.pos.z); this.goalT = 3; this.target = null; if (this.think < 0.25) this.think = 0.25; }
      if (this.finLock) return;
    }
    return _upd.call(this, dt);
  };
  const _anim = Soldier.prototype.animate;
  Soldier.prototype.animate = function (dt, speed) { _anim.call(this, dt, speed); const L = this.finLock; if (L && this.isPlayer && this.hero && FIN.on === L) finHeroPose(L, this); };
  const _dmg = Soldier.prototype.damage;
  Soldier.prototype.damage = function (a, src, type) { if (this.finLock) { if (this === this.finLock.v && !this.finLock.hit) return; if (this.isPlayer) a *= 0.25; } return _dmg.call(this, a, src, type); };
  const _mt = moveTrooper;
  moveTrooper = function (dt, f, s, sprint) { if (FIN.on) { const e = PLAYER.ent; e.moveSpeed = 0; e.crouch = false; e.yaw = FIN.on.yaw; PLAYER.vy = 0; PLAYER.grounded = true; MOB.v.set(0, 0, 0); return; } return _mt(dt, f, s, sprint); };
  const _cam = playerCamera;
  playerCamera = function (dt) {
    _cam(dt); const L = FIN.on; if (!L) return;
    /* the side-on shot: low, both bodies in frame, drifting round them as it plays */
    const mx = (L.a.pos.x + L.v.pos.x) / 2, mz = (L.a.pos.z + L.v.pos.z) / 2, my = L.g + 1.3, k = ease(seg(L.t, 0, 0.3));
    const ang = L.yaw + L.side * (Math.PI / 2 - 0.35 + L.t * 0.3);
    let dist = 5.2; for (; dist > 2.2; dist -= 0.6) { _fq.set(mx + Math.sin(ang) * dist, my + 0.5, mz + Math.cos(ang) * dist); if (!buildingAt(_fq)) break; }
    _fq.y = Math.max(_fq.y, surfY(_fq.x, _fq.z, _fq.y) + 0.6);
    camera.position.lerpVectors(L.cam0, _fq, k); camera.up.set(0, 1, 0); camera.lookAt(mx, my + (L.kind === 'slam' ? 0.7 : L.kind === 'crush' ? 0.9 : 0.3), mz);
    camera.fov = lerp(camera.fov, 56, Math.min(1, dt * 6)); camera.updateProjectionMatrix();
  };
  const _up = updatePowers;
  updatePowers = function (dt) {
    _up(dt);
    if ((FIN.scanT -= dt) <= 0) { FIN.scanT = 0.15; finScan(); }
    const go = keys.KeyV || FIN.req; keys.KeyV = false; FIN.req = false;
    if (go && FIN.cand && !FIN.on && finVictim(FIN.cand)) finStart(FIN.cand);
    if (FIN.on) finTick(FIN.on, dt);
    if (GAME.state === 'play' && (FIN.aiT -= dt) <= 0) { FIN.aiT = 1; finAIScan(); }
    finAITick(dt);
    const c = !FIN.on && FIN.cand; if (FIN.pad) FIN.pad.parentElement.classList.toggle('canfin', !!c); FIN.tip.classList.toggle('on', !!c);
    FIN.ring.visible = !!c; if (c) { FIN.ring.position.set(c.pos.x, c.pos.y + 0.08, c.pos.z); const s = 1 + Math.sin(TIME * 7) * 0.08; FIN.ring.scale.set(s, 1, s); }
  };
}
