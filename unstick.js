'use strict';
/* ===================== IRON MERIDIAN · nobody stays stuck =====================
   Troops, tanks and walkers steer straight for their goal and only sidestep at random when something stops them, so
   a river, a gap between two buildings or the foot of a cliff could hold them for good. Once a second this checks who
   has stopped closing on their goal:
   · goal across the river: they are sent round by the nearest bridge (to its near end, across, then on);
   · still stuck after that, or wedged in terrain or between walls: they are moved to the nearest open ground, out of
     your sight if you are close, so you never see anyone pop. */
const UNSTICK = { t: 0, hold: new Map(), moved: 0, bridged: 0 };
const usOk = e => e.alive && !e.isPlayer && !e.remove && e.goal && e.goal.isVector3 && !e.mount && !e.downed && !e.deck && !e.para && !e.rag && !e.finLock && !e.finGo && !e.zipGo && !e.trGo && !e.warBoard && !e.driverDuty
  && (e.kind === 'soldier' || e.kind === 'tank' || e.kind === 'walker') && !(e.pos.y > 300);
const usSide = (x, z) => Math.sign(z - riverZ(x)) || 1;
function usCrosses(a, g) { /* both near the river's run, on opposite banks */
  if (Math.max(Math.abs(a.x), Math.abs(g.x)) > 560) return false;
  return usSide(a.x, a.z) !== usSide(g.x, g.z) && riverD(a.x, a.z) < 220 && riverD(g.x, g.z) < 400;
}
function usBridge(e, g) {
  const s = usSide(e.pos.x, e.pos.z); let best = null, bd = 1e9;
  for (const b of BRIDGES) { const d = Math.hypot(b.x - e.pos.x, b.z - e.pos.z) + Math.hypot(b.x - g.x, b.z - g.z); if (d < bd) { bd = d; best = b; } }
  if (!best) return null;
  return [new V3(best.x, 0, best.z + 40 * s), new V3(best.x, 0, best.z - 40 * s), g.clone()];
}
function usOpen(e) { /* the nearest standing spot: no wall, dry, not on a steep face */
  const r0 = e.kind === 'soldier' ? 0.6 : 4.5, P = e.pos, pv = new V3();
  const far = H(P.x, P.z) < 0 ? 160 : 40; /* out at sea: look further for the shore */
  for (let rad = 4; rad <= far; rad += rad < 40 ? 4 : 12) for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2 + rad, x = P.x + Math.cos(a) * rad, z = P.z + Math.sin(a) * rad, h = H(x, z);
    if (h < 0.6 || Math.abs(x) > BOUND - 5 || Math.abs(z) > BOUND - 5) continue;
    if (Math.max(Math.abs(H(x + 3, z) - h), Math.abs(H(x - 3, z) - h), Math.abs(H(x, z + 3) - h), Math.abs(H(x, z - 3) - h)) > 2.2) continue;
    let clear = true; for (const [dx, dz] of [[0, 0], [r0, 0], [-r0, 0], [0, r0], [0, -r0]]) if (buildingAt(pv.set(x + dx, h + 1, z + dz))) { clear = false; break; }
    if (clear) return pv.set(x, h, z);
  }
  return null;
}
function usRoute(s, e) {
  if (!s.wp) return; if (!e.alive || !usOk(e)) return;
  const w = s.wp[0]; e.goal.set(w.x, 0, w.z); e.goalT = Math.max(e.goalT || 0, 2);
  if (Math.hypot(e.pos.x - w.x, e.pos.z - w.z) < 9) { s.wp.shift(); if (!s.wp.length) { s.wp = null; e.goalT = 0; } }
}
function updateUnstick(dt) {
  /* bridge routes: hold the goal on the next waypoint until it is reached */
  if (UNSTICK.routes > 0) UNSTICK.hold.forEach(usRoute); /* only walked when someone is on a bridge route; no per-frame garbage */
  if ((UNSTICK.t -= dt) > 0 || GAME.state === 'menu') return; UNSTICK.t = 1;
  const cam = camera.position; UNSTICK.routes = 0;
  UNSTICK.hold.forEach((s, e) => { if (!e.alive || e.remove) UNSTICK.hold.delete(e); else if (s.wp) UNSTICK.routes++; });
  for (const e of ENTS) {
    if (!usOk(e)) { const s = UNSTICK.hold.get(e); if (s) { s.n = 0; s.best = 1e9; } continue; }
    let s = UNSTICK.hold.get(e); if (!s) UNSTICK.hold.set(e, s = { best: 1e9, n: 0, wp: null, tries: 0, gx: e.goal.x, gz: e.goal.z });
    if (Math.hypot(s.gx - e.goal.x, s.gz - e.goal.z) > 15 && !s.wp) { s.gx = e.goal.x; s.gz = e.goal.z; s.best = 1e9; s.n = 0; } /* a new goal: start over */
    const gd = Math.hypot(e.goal.x - e.pos.x, e.goal.z - e.pos.z);
    const busy = e.target && e.target.alive && e.target.pos && e.target.pos.distanceTo(e.pos) < 120; /* fighting where they stand is not being stuck */
    if (gd < 14 || busy) { s.n = 0; s.best = gd; continue; }
    if (gd < s.best - 2) { s.best = gd; s.n = 0; continue; }
    if (++s.n < 7) continue; s.n = 0; s.best = gd; s.tries++;
    /* across the river: by the bridge */
    if (!s.wp && usCrosses(e.pos, e.goal)) { const wp = usBridge(e, e.goal); if (wp) { s.wp = wp; UNSTICK.bridged++; UNSTICK.routes = (UNSTICK.routes || 0) + 1; continue; } }
    /* otherwise: to open ground nearby, when nobody is looking */
    const wedged = buildingAt(new V3(e.pos.x, e.pos.y + 1, e.pos.z)) || H(e.pos.x, e.pos.z) < -30 || s.tries >= 2 /* swimming across is not stuck; far out at sea is */;
    if (!wedged || cam.distanceTo(e.pos) < 45) { e.detourT = 3; e.detourA = Math.random() * 6.28; continue; }
    const p = usOpen(e); if (!p) continue;
    e.pos.copy(p); if (e.obj) e.obj.position.copy(p); if (e.lastPos) e.lastPos.copy(p); e.detourT = 0; s.tries = 0; s.wp = null; UNSTICK.moved++;
  }
}
{ const _uw = updateWorld; updateWorld = function (dt) { _uw(dt); updateUnstick(dt); }; }
