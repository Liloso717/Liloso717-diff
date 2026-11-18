'use strict';
/* ===================== IRON MERIDIAN · mobility: Fortnite-quick feet, Battlefield weight ===================== */
// On foot the Commander moves with momentum instead of snapping to a speed:
//  · SPRINT    · automatic when moving forward (Shift to walk); speed builds and bleeds off rather than snapping
//  · SLIDE     · crouch (C/X) at a sprint to slide: a burst of speed that runs out on the flat and keeps going downhill;
//                jump out of a slide to carry the momentum
//  · MANTLE    · run at anything up to 3.4 m tall and you climb onto it; low, thin cover you vault straight over; it
//                works mid-jump too (ledge grab). You can stand on cover, containers and low rooftops
//  · DODGE     · V rolls you out of the way (brief invulnerability, 1.4 s cooldown)
//  · AIR       · momentum carries through jumps; light air control
// and it feels heavier: footsteps by surface (dirt, metal decks, water), a camera dip on hard landings, a strafe lean,
// a low camera in the slide, red damage arcs pointing at whoever hit you, and a suppression vignette when rounds crack past.
const MOB = { v: new V3(), slide: 0, roll: 0, dodgeCd: 0, mantle: null, dip: 0, stepT: 0, stepPh: 0, supp: 0, crouchPrev: false, ent: null, lean: 0, arcs: [], el: null, supEl: null };
function roofUnder(p) { let top = -1e9; for (const b of bldCell(p.x, p.z)) if (b.alive && p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1 && p.y >= b.top - 0.6 && b.top > top) top = b.top; return top; }
function startMantle(e, fx, fz) { /* climb onto, or vault over, whatever is in front */
  let b = null; for (const h of [0.9, 2.2]) { b = buildingAt(_v1.set(e.pos.x + fx * 0.9, e.pos.y + h, e.pos.z + fz * 0.9)); if (b) break; }
  if (!b || b.realmBlock) return false; const rise = b.top - e.pos.y; if (rise < 0.5 || rise > 3.4) return false;
  if (buildingAt(_v2.set(e.pos.x + fx * 1.5, b.top + 1, e.pos.z + fz * 1.5))) return false;
  const from = e.pos.clone(); let to = new V3(e.pos.x + fx * 1.5, b.top, e.pos.z + fz * 1.5), vault = false;
  if (rise < 1.7) { for (let k = 1.6; k < 4.5; k += 0.4) { const x = e.pos.x + fx * k, z = e.pos.z + fz * k; if (!(x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1)) { if (!buildingAt(_v2.set(x, e.pos.y + 1, z))) { to = new V3(x + fx * 0.6, 0, z + fz * 0.6); to.y = surfY(to.x, to.z, e.pos.y + 1); vault = true; } break; } } }
  MOB.mantle = { from, to, top: b.top, t: 0, dur: vault ? 0.42 : 0.34 + rise * 0.04, vault }; MOB.slide = 0; PLAYER.vy = 0;
  snd('stomp', null, 0.25); fxDust(_v3.set(to.x, b.top, to.z), 4, 2, 4); return true;
}
/* the on-foot movement step (called from trooper() in main.js) */
function moveTrooper(dt, f, s, sprint) {
  const P = PLAYER, e = P.ent, M = MOB; if (M.ent !== e) { M.ent = e; M.v.set(0, 0, 0); M.slide = 0; M.mantle = null; }
  const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw), fx = -sy, fz = -cy, space = e.pos.y > 1200;
  let mx = fx * f + cy * s, mz = fz * f - sy * s; const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  const crouchKey = !!(keys.KeyX || keys.KeyC); let hs = Math.hypot(M.v.x, M.v.z);
  M.dodgeCd -= dt; M.roll -= dt; M.dip = Math.max(0, M.dip - dt * 2.2); M.lean = lerp(M.lean, -s * 0.035 + (M.slide > 0 ? 0.05 : 0), Math.min(1, dt * 6));
  /* mantle / vault in progress */
  if (M.mantle) {
    const Mt = M.mantle; Mt.t = Math.min(1, Mt.t + dt / Mt.dur); const k = smooth(0, 1, Mt.t);
    e.pos.lerpVectors(Mt.from, Mt.to, k); e.pos.y = Mt.vault ? Math.max(lerp(Mt.from.y, Mt.to.y, k), Mt.top + 0.2 - Math.pow(k * 2 - 1, 2) * 0.6) : lerp(Mt.from.y, Mt.to.y, Math.min(1, k * 1.4)) + Math.sin(k * Math.PI) * 0.3;
    if (Mt.t >= 1) { M.mantle = null; P.vy = 0; P.grounded = true; M.v.set(fx * 5, 0, fz * 5); }
    e.yaw = P.yaw + Math.PI; e.moveSpeed = 4; e.crouch = true; return;
  }
  /* slide start: crouch at a sprint */
  if (crouchKey && !M.crouchPrev && P.grounded && hs > 9 && M.slide <= 0) { M.slide = 1.1; const k = Math.min(1.4, 19 / hs); M.v.x *= k; M.v.z *= k; snd('skid', null, 0.4); fxDust(_v1.copy(e.pos), 6, 3, 6); }
  M.crouchPrev = crouchKey;
  /* dodge roll */
  /* velocity: accelerate toward the wanted speed (sprint 11.9, run 7, crouch-walk 3.5), or slide */
  const base = P.free ? 34 : 7 * (sprint ? 1.7 : 1) * (crouchKey && M.slide <= 0 ? 0.5 : 1), wx = mx * base, wz = mz * base; /* freefall: track across the sky to pick your landing */
  if (M.slide > 0) {
    M.slide -= dt; const gx = (H(e.pos.x + 1, e.pos.z) - H(e.pos.x - 1, e.pos.z)) / 2, gz = (H(e.pos.x, e.pos.z + 1) - H(e.pos.x, e.pos.z - 1)) / 2;
    M.v.x -= gx * 14 * dt; M.v.z -= gz * 14 * dt; const fr = Math.max(0, 1 - 4.5 * dt / Math.max(hs, 0.1)); M.v.x *= fr; M.v.z *= fr; M.v.x += mx * 3 * dt; M.v.z += mz * 3 * dt;
    hs = Math.hypot(M.v.x, M.v.z); if (hs < 4 || (!crouchKey && M.slide < 0.75)) M.slide = 0;
    if (Math.random() < 0.6) FXS.spawn(e.pos.x, groundY(e.pos.x, e.pos.z) + 0.2, e.pos.z, rand(-1, 1), rand(0.5, 1.5), rand(-1, 1), rand(0.6, 1.2), 0.6, 2.2, 0.55, 0.5, 0.42, 0.5, 0.46, 0.4, 0.5, 0.6, 0);
  } else if (M.roll <= 0) {
    const acc = (P.grounded ? 60 : P.free ? 22 : 14) * dt, dvx = wx - M.v.x, dvz = wz - M.v.z, dl = Math.hypot(dvx, dvz); if (dl > acc) { M.v.x += dvx / dl * acc; M.v.z += dvz / dl * acc; } else { M.v.x = wx; M.v.z = wz; }
  }
  const sw = e.pos.y < 300 && H(e.pos.x, e.pos.z) < -2.4 && !deckAt(e.pos.x, e.pos.z, e.pos.y) ? 0.5 : 1;
  { const lim = bnd(e.pos.y); e.pos.x = clamp(e.pos.x + M.v.x * sw * dt, -lim, lim); e.pos.z = clamp(e.pos.z + M.v.z * sw * dt, -lim, lim); }
  /* mantle: running into something climbable (or reaching for a ledge mid-jump) */
  if ((f > 0.3 || M.slide > 0) && !P.para && !P.pod && !P.free && startMantle(e, fx, fz)) return;
  const bx = e.pos.x, bz = e.pos.z; pushOut(e.pos, 0.5); if (e.pos.x !== bx || e.pos.z !== bz) { M.v.x *= 0.5; M.v.z *= 0.5; } /* walls take your speed */
  /* gravity, skydive and chute */
  P.vy -= (space ? 5.5 : 22) * dt;
  if (!P.grounded && !P.para && !P.pod) {
    const agl = e.pos.y - surfY(e.pos.x, e.pos.z, e.pos.y);
    if (agl > 45 && P.vy < -8) { if (!P.free) { P.free = true; cmdJump(e); } P.vy = agl > 380 ? Math.max(P.vy - (space ? 34 : 24) * dt, space ? -150 : -240) : lerp(P.vy, Math.max(P.vy, -85), Math.min(1, dt * 2.5)); /* from orbit: tuck and drop, then flare out low */ if (keys.Space || agl < 60) { keys.Space = false; P.free = false; P.para = true; showCanopy(e, true); snd('ui', null, 0.3); } }
  }
  if (P.para) P.vy = lerp(P.vy, -14, Math.min(1, dt * 6));
  e.pos.y += P.vy * dt; deckClamp(e.pos, true); const g = Math.max(surfY(e.pos.x, e.pos.z, e.pos.y), roofUnder(e.pos));
  if (e.pos.y <= g || (P.grounded && P.vy <= 0 && e.pos.y - g < 0.6)) {
    if (!P.grounded && P.vy < -12) { M.dip = Math.min(0.55, -P.vy * 0.025); snd('stomp', null, Math.min(0.6, -P.vy * 0.02)); if (P.vy < -18) fxDust(_v1.set(e.pos.x, g, e.pos.z), 6, 3, 5); }
    if (P.vy < -24 && !P.pod && !P.grounded) e.damage((-P.vy - 24) * 4, e, 'crash'); e.pos.y = g; P.vy = 0; P.grounded = true; P.free = false; if (P.pod) podLand(e); if (P.para) paraLand(e);
  } else { P.grounded = false; if (P.pod) podStep(e); }
  if (keys.Space && P.grounded && !P.pod) { keys.Space = false; P.vy = space ? 8.5 : 8.2; P.grounded = false; if (M.slide > 0) { M.slide = 0; M.v.multiplyScalar(1.08); } } /* slide-jump keeps the momentum */
  /* footsteps by surface */
  hs = Math.hypot(M.v.x, M.v.z);
  if (P.grounded && hs > 1.5 && M.slide <= 0) { M.stepPh += dt * hs * 0.9; M.stepT -= dt * hs / 2.3; if (M.stepT <= 0) { M.stepT = 1; const wet = H(e.pos.x, e.pos.z) < 0.1 && e.pos.y < 1.5, metal = e.pos.y - H(e.pos.x, e.pos.z) > 1.5; snd(wet ? 'splash' : metal ? 'clank' : 'step', null, sprint ? 0.32 : 0.2); if (wet) FXS.spawn(e.pos.x, 0.2, e.pos.z, rand(-1, 1), rand(1, 2), rand(-1, 1), 0.6, 0.4, 1.4, 0.85, 0.9, 0.95, 0.6, 0.64, 0.66, 0.6, 0.5, -4); } }
  e.yaw = P.yaw + Math.PI; e.moveSpeed = hs; e.crouch = crouchKey || M.slide > 0;
}
/* poses: the roll and the slide on the Commander's model */
{
  const _anim = Soldier.prototype.animate;
  Soldier.prototype.animate = function (dt, speed) {
    _anim.call(this, dt, speed); if (!this.isPlayer || this !== MOB.ent) return;
    if (MOB.roll > 0) { const k = 1 - MOB.roll / 0.4; this.obj.rotation.x = -k * Math.PI * 2; this.obj.position.y += Math.sin(k * Math.PI) * 0.35; }
    else if (MOB.slide > 0) { this.obj.rotation.x = 0.42; this.obj.position.y -= 0.35; }
    else if (MOB.mantle) this.obj.rotation.x = -0.25;
  };
}
/* camera feel: landing dip, slide crouch, strafe lean, a little head bob (applied after the follow camera) */
function mobilityCamera() {
  const P = PLAYER, e = P.ent; if (GAME.state !== 'play' || !e || !e.alive || P.role !== 'trooper' || e.mount || MOB.ent !== e) return;
  const hs = Math.hypot(MOB.v.x, MOB.v.z); camera.position.y += -MOB.dip - (MOB.slide > 0 ? 0.6 : 0) + (P.grounded && MOB.slide <= 0 ? Math.sin(MOB.stepPh * Math.PI) * 0.035 * Math.min(1, hs / 7) : 0);
  if (MOB.supp > 0.05) { camera.position.x += (Math.random() - 0.5) * MOB.supp * 0.05; camera.position.y += (Math.random() - 0.5) * MOB.supp * 0.05; }
  camera.rotateZ(MOB.lean);
}
/* ---------- damage direction arcs and suppression ---------- */
{
  const _sd = Soldier.prototype.damage;
  Soldier.prototype.damage = function (a, src, type) {
    const hp = this.hp; _sd.call(this, a, src, type);
    if (this.isPlayer && src && src.pos && src !== this && this.hp < hp) { MOB.arcs.push({ x: src.pos.x, z: src.pos.z, t: 1.4 }); if (MOB.arcs.length > 4) MOB.arcs.shift(); MOB.supp = Math.min(1, MOB.supp + 0.25); }
  };
  const _bm = bulletMissed;
  bulletMissed = function (src, tgt, d) { if (tgt && tgt.isPlayer) MOB.supp = Math.min(1, MOB.supp + 0.12); return _bm(src, tgt, d); };
}
function updateMobilityHud(dt) {
  if (!MOB.el) { MOB.el = document.createElement('div'); MOB.el.id = 'dmgdir'; document.body.appendChild(MOB.el); MOB.supEl = document.createElement('div'); MOB.supEl.id = 'supp'; document.body.appendChild(MOB.supEl); }
  MOB.supp = Math.max(0, MOB.supp - dt * 0.45); const pe = PLAYER.ent, on = GAME.state === 'play' && pe && pe.alive;
  MOB.supEl.style.opacity = on ? (MOB.supp * 0.75).toFixed(2) : '0';
  let html = ''; if (on) for (let i = MOB.arcs.length - 1; i >= 0; i--) { const A = MOB.arcs[i]; A.t -= dt; if (A.t <= 0) { MOB.arcs.splice(i, 1); continue; }
    const ang = Math.atan2(A.x - pe.pos.x, A.z - pe.pos.z) - (PLAYER.yaw + Math.PI); html += `<i style="transform:rotate(${(-ang * 180 / Math.PI).toFixed(1)}deg);opacity:${Math.min(1, A.t).toFixed(2)}"></i>`; }
  if (MOB.el.innerHTML !== html) MOB.el.innerHTML = html;
}
