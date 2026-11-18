'use strict';
/* ===================== IRON MERIDIAN · riding on top =====================
   Walkers, gunships, fighters and dropships, friend or foe, have a roof you can land on:
   · fly or drop onto one and you touch down on its top, like any rooftop;
   · it carries you: you move, climb and turn with it, and can walk about up there and fire from it;
   · jump or take off to leave; if it is destroyed, or flies out from under you, you drop.
   Each machine's top is measured from its own model the first time you come near it. */
const RIDE = { on: null, lp: new V3(), yaw: 0, cand: [], box: new WeakMap(), hit: null, msgT: -99, v: new V3(), f: new V3(), q: new T.Quaternion() };
const RIDE_KINDS = { walker: 1, gunship: 1, fighter: 1, dropship: 1 };
function rideYaw(e) { RIDE.f.set(0, 0, 1).applyQuaternion(e.obj.quaternion); return Math.atan2(RIDE.f.x, RIDE.f.z); }
function rideBox(e) { /* the model's own extent, with its heading and tilt taken out */
  let b = RIDE.box.get(e); if (b) return b;
  const o = e.obj, q = o.quaternion.clone(), p = o.position.clone(); o.quaternion.identity(); o.position.set(0, 0, 0); o.updateMatrixWorld(true);
  const box = new T.Box3(), tmp = new T.Box3();
  o.traverse(m => { if (!m.isMesh || m.isSprite || !m.visible || !m.geometry) return; if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); tmp.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); box.union(tmp); });
  o.quaternion.copy(q); o.position.copy(p); o.updateMatrixWorld(true);
  if (box.isEmpty()) box.set(new V3(-3, 0, -3), new V3(3, 3, 3));
  b = { top: box.max.y, hx: Math.max(1.2, (box.max.x - box.min.x) / 2 * 0.85), hz: Math.max(1.2, (box.max.z - box.min.z) / 2 * 0.85), cx: (box.max.x + box.min.x) / 2, cz: (box.max.z + box.min.z) / 2 };
  RIDE.box.set(e, b); return b;
}
/* the top of a machine under point p (in its own frame), or null */
function rideTop(e, p) {
  const b = rideBox(e), yaw = rideYaw(e), dx = p.x - e.pos.x, dz = p.z - e.pos.z, c = Math.cos(yaw), s = Math.sin(yaw);
  const lx = dx * c - dz * s - b.cx, lz = dx * s + dz * c - b.cz;
  if (Math.abs(lx) > b.hx || Math.abs(lz) > b.hz) return null;
  return e.pos.y + b.top;
}
/* rooftops now include the machines near you */
{
  const _ru = roofUnder;
  roofUnder = function (p) {
    let top = _ru(p); RIDE.hit = null;
    for (const e of RIDE.cand) { if (!e.alive) continue; const y = rideTop(e, p); if (y !== null && y > top && p.y >= y - 0.8) { top = y; RIDE.hit = e; } }
    return top;
  };
}
/* carried along: before the player moves each frame, apply how far the machine moved and turned since the last */
{
  const _up = updatePlayer;
  updatePlayer = function (dt) {
    const pe = PLAYER.ent, V = RIDE.on;
    if (V && pe && pe.alive && V.alive && GAME.state === 'play') {
      const yaw = rideYaw(V); let dy = yaw - RIDE.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const rx = pe.pos.x - RIDE.lp.x, rz = pe.pos.z - RIDE.lp.z, c = Math.cos(dy), s = Math.sin(dy);
      pe.pos.x = V.pos.x + rx * c + rz * s; pe.pos.z = V.pos.z - rx * s + rz * c; pe.pos.y += V.pos.y - RIDE.lp.y; /* round its centre as it turns */
      PLAYER.yaw += dy; RIDE.lp.copy(V.pos); RIDE.yaw = yaw;
    }
    const sx = pe ? pe.pos.x : 0, sz = pe ? pe.pos.z : 0;
    _up(dt);
    /* machines drive through kerbs, posts and wall corners that would shove you off the roof: up there, only your own
       walking moves you */
    if (V && pe && pe.alive && V.alive && !POW.fly) { const mx = pe.pos.x - sx, mz = pe.pos.z - sz, own = Math.hypot(MOB.v.x, MOB.v.z) * dt + 0.12; if (Math.hypot(mx, mz) > own) { pe.pos.x = sx + MOB.v.x * dt; pe.pos.z = sz + MOB.v.z * dt; } }
    /* still on it? (standing on its top, not flying) */
    if (pe && pe.alive) roofUnder(RIDE.v.copy(pe.pos).setY(pe.pos.y + 0.5)); /* which machine (if any) is under the feet right now */
    const now = pe && pe.alive && !POW.fly && !pe.mount && RIDE.hit && Math.abs(pe.pos.y - (rideTop(RIDE.hit, pe.pos) ?? -1e9)) < 0.9 ? RIDE.hit : null;
    if (now !== RIDE.on) {
      RIDE.on = now; if (now) { RIDE.lp.copy(now.pos); RIDE.yaw = rideYaw(now);
        if (TIME - RIDE.msgT > 20) { RIDE.msgT = TIME; comms(null, `On top of the ${now.kind === 'walker' ? 'walker' : now.kind}. Jump or fly to get off.`, 'b'); } }
    }
  };
}
/* the candidates: walkers and aircraft within 80 m, refreshed each frame */
{
  const _uw = updateWorld;
  updateWorld = function (dt) {
    _uw(dt); const pe = PLAYER.ent; RIDE.cand.length = 0; if (!pe || !pe.alive) { RIDE.on = null; return; }
    for (const e of ENTS) if (e.alive && RIDE_KINDS[e.kind] && e.obj && !e.orbital && Math.abs(e.pos.x - pe.pos.x) < 80 && Math.abs(e.pos.z - pe.pos.z) < 80 && Math.abs(e.pos.y - pe.pos.y) < 60) RIDE.cand.push(e);
    if (RIDE.on && !RIDE.on.alive) RIDE.on = null;
  };
}
