'use strict';
/* ===================== IRON MERIDIAN · you never stay stuck =====================
   Three things could hold the Hero in place:
   · walkways, ramps, bridges and the Hive rim kept you inside their outline whenever you were within 40 m above
     them, flying included, so you could not fly away from one or step off its edge onto the ground beside it.
     Now: in the air nothing holds you; on foot you can step or drop off any edge (up to a 12 m drop; past that you
     are kept from walking off by accident, and flying or jumping still takes you anywhere);
   · running at an invisible collision wall (the sides of tunnels, gaps and entrances) climbed you up onto it.
     Now the auto-climb skips those tall walls and still takes you onto cover, crates, forts and low roofs;
   · if you do end up boxed in (inside a wall, or no way out in any direction) for a moment, you are moved to the
     nearest open spot at the same level, the way you were trying to go. */
const PF = { slow: 0, inside: 0, q: new V3(), r: new V3(), freed: 0 };
/* 1 · decks only hold you on foot, and only over a long drop */
{
  const _dc = deckClamp;
  deckClamp = function (p, free) {
    if (!free) return _dc(p);
    if (typeof POW !== 'undefined' && POW.fly) return; /* flying: nothing holds you */
    const x = p.x, z = p.z; _dc(p, true);
    if (p.x === x && p.z === z) return;
    const g = Math.max(wadeY(x, z), roofUnder(PF.q.set(x, p.y + 0.5, z)));
    if (p.y - g < 12) { p.x = x; p.z = z; } /* the ground beside it is close: walk off */
  };
}
/* 2 · no climbing onto the invisible collision walls */
{
  const _sm = startMantle;
  startMantle = function (e, fx, fz) {
    for (const h of [0.9, 2.2]) { const b = buildingAt(PF.q.set(e.pos.x + fx * 0.9, e.pos.y + h, e.pos.z + fz * 0.9)); if (b) { if (b.hp >= 1e9 && b.top - b.gy > 16) return false; break; } }
    return _sm(e, fx, fz);
  };
}
/* 2b · room floors hold you up (you stood on the bumpy ground under them, so a dip at a door read as a wall), and
   you walk in through a doorway instead of climbing the building */
{
  const _ru = roofUnder;
  roofUnder = function (p) {
    let top = _ru(p);
    for (const b of bldCell(p.x, p.z)) if (b.alive && bEnter(b) && p.y >= b.fl - 1.8 && p.y < b.ch && (inRoom(b, p.x, p.z, -0.6) || inDoor(b, p.x, p.z, b.fl)) && b.fl > top) top = b.fl;
    return top;
  };
  const _sm2 = startMantle;
  startMantle = function (e, fx, fz) {
    const b = buildingAt(PF.q.set(e.pos.x + fx * 0.9, e.pos.y + 0.9, e.pos.z + fz * 0.9)) || buildingAt(PF.q.set(e.pos.x + fx * 0.9, e.pos.y + 2.2, e.pos.z + fz * 0.9));
    if (b && bEnter(b) && e.pos.y < b.ch) {
      /* a doorway up a step: climb into it */
      const x = e.pos.x + fx * 1.6, z = e.pos.z + fz * 1.6, rise = b.fl - e.pos.y;
      if (rise > 0.4 && rise < 3.4 && (inDoor(b, x, z, b.fl) || inRoom(b, x, z, 0)) && !MOB.mantle) {
        MOB.mantle = { from: e.pos.clone(), to: new V3(x, b.fl, z), top: b.fl, t: 0, dur: 0.34 + rise * 0.04, vault: false }; MOB.slide = 0; PLAYER.vy = 0; snd('stomp', null, 0.2); return true;
      }
      return false;
    }
    return _sm2(e, fx, fz);
  };
}
/* 3 · boxed in: find the nearest open spot */
const pfStand = (x, z, y0) => { /* where you would stand at (x, z) near height y0, or null if it is inside something */
  let y = surfY(x, z, y0 + 2); const r = roofUnder(PF.r.set(x, y0 + 1.2, z)); if (r > y && r - y0 < 3) y = r;
  if (buildingAt(PF.r.set(x, y + 0.9, z)) || buildingAt(PF.r.set(x, y + 1.7, z))) return null;
  if (y < -2.4 && !deckAt(x, z, y0)) return null;
  return y;
};
function pfTrapped(e) { /* is there any way to step out? */
  for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283, x = e.pos.x + Math.cos(a) * 1.2, z = e.pos.z + Math.sin(a) * 1.2, y = pfStand(x, z, e.pos.y);
    if (y !== null && y - e.pos.y < 1.2) { PF.q.set(x, y, z); pushOut(PF.q, 0.5); if (Math.hypot(PF.q.x - x, PF.q.z - z) < 0.05) return false; } }
  return true;
}
function pfFree(e, dx, dz) {
  const base = Math.atan2(dz, dx), have = Math.hypot(dx, dz) > 0.1;
  for (const pass of [3.5, 1e9]) for (const r of [1.5, 3, 4.5, 6, 8, 10, 13, 16, 20, 25, 30, 40]) for (let k = 0; k < 16; k++) {
    const a = (have ? base : 0) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (6.283 / 16), x = e.pos.x + Math.cos(a) * r, z = e.pos.z + Math.sin(a) * r;
    const y = pfStand(x, z, e.pos.y); if (y === null || Math.abs(y - e.pos.y) > pass) continue;
    PF.q.set(x, y, z); pushOut(PF.q, 0.6); if (Math.hypot(PF.q.x - x, PF.q.z - z) > 0.05) continue;
    e.pos.set(x, y, z); MOB.v.set(0, 0, 0); MOB.mantle = null; PLAYER.vy = 0; PLAYER.grounded = true; PF.freed++;
    fxDust(PF.q.set(x, y, z), 4, 2, 4); return true;
  }
  return false;
}
{
  const _mt = moveTrooper;
  moveTrooper = function (dt, f, s, sprint) {
    const P = PLAYER, e = P.ent; if (!e) return _mt(dt, f, s, sprint);
    const x0 = e.pos.x, z0 = e.pos.z;
    const r = _mt(dt, f, s, sprint);
    if (!e.alive || (typeof POW !== 'undefined' && POW.fly) || P.pod || P.para || P.free || MOB.mantle || e.mount || GAME.state !== 'play') { PF.slow = PF.inside = 0; return r; }
    /* inside something: out, fast */
    if (buildingAt(PF.q.set(e.pos.x, e.pos.y + 1, e.pos.z))) PF.inside += dt; else PF.inside = 0;
    /* trying to move and going nowhere: only counts if every way out is blocked (a plain wall is not being stuck) */
    const inp = Math.hypot(f, s), moved = Math.hypot(e.pos.x - x0, e.pos.z - z0);
    if (inp > 0.4 && moved < 0.6 * dt) PF.slow += dt; else PF.slow = Math.max(0, PF.slow - dt * 2);
    if (PF.inside > 0.3 || (PF.slow > 1 && pfTrapped(e))) {
      const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw), mx = -sy * f + cy * s, mz = -cy * f - sy * s;
      pfFree(e, mx, mz); PF.slow = PF.inside = 0;
    } else if (PF.slow > 1) PF.slow = 0.5; /* a wall: check again in a moment */
    return r;
  };
}
