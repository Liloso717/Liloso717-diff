'use strict';
/* ===================== IRON MERIDIAN · engine exhaust burns anyone in the wash ===================== */
// Speeding vehicles throw a hot jet behind them; hovering craft blast a cone of downwash beneath. Anyone on foot caught in it
// burns: the player, the company, and every army's troopers alike. Burnt troopers stagger clear and smoulder for a moment.
// Ticked at 10 Hz. Vehicle speed comes from frame-to-frame motion, so it works for every vehicle class the same way.
const EXH = {
  /* kind: jet = rear jet when moving fast (len scales with speed), wash = downwash radius when hovering (max height) */
  speeder: { jet: 7, jetMin: 14, dps: 55, wash: 2.2, washH: 3.5, wdps: 25 },
  transport: { jet: 5, jetMin: 16, dps: 30 },
  tank: { jet: 6, jetMin: 8, dps: 40, wash: 4.5, washH: 3.5, wdps: 18 },
  shiftframe: { jet: 8, jetMin: 16, dps: 60, wash: 4, washH: 26, wdps: 70, fly: true },
  gunship: { jet: 9, jetMin: 10, dps: 60, wash: 8, washH: 24, wdps: 80 },
  dropship: { jet: 9, jetMin: 10, dps: 60, wash: 9.5, washH: 26, wdps: 85 },
  starship: { jet: 18, jetMin: 14, dps: 110, wash: 8, washH: 22, wdps: 90 },
  fighter: { jet: 26, jetMin: 20, dps: 140, wash: 6, washH: 14, wdps: 90, low: 30 },
};
const BURN = { t: 0, sayT: 0, list: [] };
const _xd = new V3();
function exhaustOf(v) { // → { jetLen, fwd (unit, xz + y for fighters), agl } or null when cold
  const C = EXH[v.kind]; if (!C || !v.alive || v.parked || v.tumble) return null;
  const last = v._exP || (v._exP = v.pos.clone()); const sp = v.pos.distanceTo(last) / 0.1; last.copy(v.pos);
  const agl = v.pos.y - surfY(v.pos.x, v.pos.z, v.pos.y + 1);
  if (C.low && agl > C.low) return null; // fighters only scorch the ground when they are low
  if (v.kind === 'shiftframe' && v.mode !== 'vehicle') return null;
  if (v.kind === 'fighter') _xd.copy(v.dir); else { const y = v.kind === 'walker' ? v.heading : v.yaw || 0; _xd.set(Math.sin(y), 0, Math.cos(y)); }
  return { C, sp, agl, f: _xd.clone(), jet: sp > C.jetMin ? Math.min(C.jet * (0.6 + sp / 60), C.jet * 1.8) : 0, hover: C.wash && agl > 0.4 && agl < C.washH && (!C.fly || v.alt > 2) };
}
function burnTrooper(s, dmg, v, f) {
  if (s.spawnGuard > TIME) return;
  const src = v.team !== s.team ? v : null; // own-side exhaust still burns, it just credits nobody
  s.damage(dmg, src, 'burn');
  if (!s.alive) return; s.burnT = Math.max(s.burnT || 0, 2.4); if (!BURN.list.includes(s)) BURN.list.push(s);
  if (s.isPlayer) { if (BURN.sayT < TIME) { BURN.sayT = TIME + 14; comms('Alpha Lead', pick(['Commander, you\'re in the jet wash! Get clear!', 'Engine blast! Off the exhaust line, sir!', 'You\'re standing in their downwash, move!']), 'b'); } }
  else if (!s.cmdMove && s.alive && !s.downed) { // stagger out of the wash, sideways from the vehicle
    const dx = s.pos.x - v.pos.x, dz = s.pos.z - v.pos.z, l = Math.hypot(dx, dz) || 1; s.fleeT = Math.max(s.fleeT || 0, 1.4);
    if (s.goal) s.goal.set(s.pos.x + dx / l * 9 + f.z * 6, 0, s.pos.z + dz / l * 9 - f.x * 6);
  }
}
function updateExhaust(dt) {
  // burning troopers smoulder (a little damage over time, flames and smoke on the body)
  for (let i = BURN.list.length - 1; i >= 0; i--) {
    const s = BURN.list[i]; if (!s.alive || s.remove || (s.burnT -= dt) <= 0) { s.burnT = 0; BURN.list.splice(i, 1); continue; }
    if (s.spawnGuard <= TIME && !(s.mount)) s.damage(7 * dt, null, 'burn');
    if (Math.random() < dt * 22 && s.obj && s.obj.visible) { const r = Math.random(); FXA.spawn(s.pos.x + rand(-0.3, 0.3), s.pos.y + 0.4 + r * 1.3, s.pos.z + rand(-0.3, 0.3), rand(-0.4, 0.4), rand(1.5, 3), rand(-0.4, 0.4), rand(0.3, 0.55), 0.35, 0.1, 3.2, 1.6, 0.4, 1.2, 0.3, 0.05, 1, 0.5, -1); }
  }
  if ((BURN.t -= dt) > 0) return; BURN.t = 0.1;
  const hot = [];
  for (const v of ENTS) { if (!EXH[v.kind]) continue; const x = exhaustOf(v); if (x && (x.jet || x.hover)) hot.push([v, x]); }
  if (!hot.length) return;
  for (const [v, x] of hot) {
    const C = x.C, back = v.radius * 0.8, fx = x.f.x, fy = x.f.y, fz = x.f.z, fl = Math.hypot(fx, fz) || 1;
    const ex = v.pos.x - fx / fl * back, ez = v.pos.z - fz / fl * back, ey = v.pos.y + (v.kind === 'fighter' ? 0 : 0.6);
    // the wash scorches the ground: dust and embers where it touches
    if (x.hover && Math.random() < 0.5) { const g = surfY(v.pos.x, v.pos.z, v.pos.y); fxDust(_v1.set(v.pos.x + rand(-C.wash, C.wash) * 0.5, g, v.pos.z + rand(-C.wash, C.wash) * 0.5), 2, C.wash * 0.35, 5); }
    if (x.jet && Math.random() < 0.6) FXA.spawn(ex - fx * 1.5, ey, ez - fz * 1.5, -fx * x.sp * 0.4 + rand(-1, 1), rand(0, 1), -fz * x.sp * 0.4 + rand(-1, 1), 0.25, 0.6, 1.6, 2.6, 1.3, 0.5, 0.6, 0.2, 0.1, 0.5, 2, 0);
    const reach = Math.max(x.jet + back, x.hover ? C.wash : 0) + 3;
    for (const s of ENTS) {
      if (s.kind !== 'soldier' || !s.alive || s.mount || s.hitR === false || s === v) continue;
      const dx = s.pos.x - v.pos.x, dz = s.pos.z - v.pos.z; if (Math.abs(dx) > reach || Math.abs(dz) > reach) continue;
      if (v.riders && v.riders.includes(s)) continue;
      let dmg = 0;
      if (x.jet) { // behind the vehicle, inside a widening cone along the exhaust line
        const rx = s.pos.x - ex, rz = s.pos.z - ez, ry = s.pos.y + 1 - ey, along = -(rx * fx + rz * fz) / fl;
        if (along > -0.5 && along < x.jet) { const lat = Math.abs(rx * fz - rz * fx) / fl, w = 1 + along * 0.18, vy = v.kind === 'fighter' ? Math.abs(s.pos.y + 1 - (ey - fy * along)) : Math.abs(ry); if (lat < w && vy < 2.6 + along * 0.15) dmg += C.dps * 0.1 * (1 - along / x.jet * 0.6); }
      }
      if (x.hover) { // under a hovering craft: the closer and lower, the hotter
        const d = Math.hypot(dx, dz), below = v.pos.y - s.pos.y; if (d < C.wash && below > -0.5 && below < C.washH + 2) dmg += C.wdps * 0.1 * (1 - d / C.wash * 0.5) * (1 - clamp(below / (C.washH + 2), 0, 0.8));
      }
      if (dmg > 0) burnTrooper(s, dmg, v, x.f);
    }
  }
}
