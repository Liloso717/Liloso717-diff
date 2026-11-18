'use strict';
/* ===================== IRON MERIDIAN · crews: turrets, lifters and gunboats =====================
   Soldiers crew vehicles on land, in the air and at sea, carry squads, and fight from them:
   · TURRETS: a crewed, rotating gun on the roof of every troop carrier, the door of every lifter, the bow of every
     gunboat. With its gunner aboard it tracks the nearest enemy (troops, armour, aircraft, boats) and fires bursts.
   · LIFTERS (air): a VTOL per army. It finds a squad a long way from where it is going, flies to it, lands, takes
     it aboard, flies it to its objective, lands short and puts it down. The Heroes' lifter carries your company's
     stragglers up to you instead.
   · GUNBOATS (sea): a ferry per army runs round the island offshore and puts in at four beaches (the military base,
     Hero Muster, the port, the north shore). Troops at a beach bound for a far one board and get off there.
   Every one has a pilot and a gunner; shoot the gunner and the gun goes quiet; shoot the pilot and it drifts. */
const CREW = { turrets: [], lifters: { 1: [], 2: [] }, ferries: { 1: [], 2: [] }, dead: { L1: 0, L2: 0, F1: 0, F2: 0 }, t: 0, ring: [], docks: [] };
const _cw = new V3(), _cw2 = new V3(), _cw3 = new V3();
const crewMarine = (team, p) => { const s = new Soldier(team); s.squad = { m: [s], lead: null }; s.noRequeue = true; s.marine = true; s.spawnAt(p); addEnt(s); return s; };

/* ---------- the turret ---------- */
const TUR_G = { base: new T.CylinderGeometry(0.55, 0.65, 0.4, 10), head: mergeGeos([new T.BoxGeometry(0.7, 0.45, 0.8).translate(0, 0.25, 0), new T.CylinderGeometry(0.07, 0.07, 1.6, 6).rotateX(Math.PI / 2).translate(-0.14, 0.28, 0.9), new T.CylinderGeometry(0.07, 0.07, 1.6, 6).rotateX(Math.PI / 2).translate(0.14, 0.28, 0.9), new T.BoxGeometry(0.9, 0.5, 0.06).translate(0, 0.3, 0.42)]) };
const TUR_M = std(0x2a2d31, 0.45, 0.75);
function addTurret(v, off, o = {}) {
  const g = new T.Group(), base = new T.Mesh(TUR_G.base, TUR_M), head = new T.Mesh(TUR_G.head, TUR_M); g.add(base); head.position.y = 0.2; g.add(head); g.position.copy(off); (v.body || v.obj).add(g);
  const T0 = { v, g, head, tgt: null, think: rand(0, 0.5), cool: rand(0.5, 1.5), burst: 5, range: o.range || 160, dmg: o.dmg || 20, seat: o.seat };
  CREW.turrets.push(T0); v.turret = T0; return T0;
}
const turretPrey = e => e.alive && e.hitR && !e.downed && !e.remove && e.kind !== 'capital' && (e.kind === 'soldier' || isGroundVeh(e) || isAir(e) || e.kind === 'naval');
function updateTurrets(dt) {
  for (let i = CREW.turrets.length - 1; i >= 0; i--) {
    const T0 = CREW.turrets[i], v = T0.v;
    if (!v.alive || v.remove) { CREW.turrets.splice(i, 1); continue; }
    const gunner = T0.seat === undefined || (v.riders && v.riders[T0.seat] && v.riders[T0.seat].alive && v.riders[T0.seat].mount === v);
    if (!gunner) continue;
    if ((T0.think -= dt) <= 0) { T0.think = 0.45; T0.tgt = findTarget(v, T0.range, turretPrey); }
    const t = T0.tgt; if (!t || !t.alive || t.downed) { T0.tgt = null; continue; }
    const aim = t.aim(_cw2); T0.head.lookAt(aim);
    if ((T0.cool -= dt) > 0) continue;
    const mz = T0.head.localToWorld(_cw.set(0, 0.28, 1.8));
    _cw3.copy(aim); _cw3.x += rand(-1.2, 1.2); _cw3.y += rand(-0.6, 0.6); _cw3.z += rand(-1.2, 1.2);
    fireProj({ from: _cw, to: _cw3, speed: 460, kind: 'bolt', team: v.team, src: v, dmg: T0.dmg, splash: 1.2, w: 0.12, len: 4, color: TEAM[v.team].laser, fx: 0.4 });
    if (camera.position.distanceToSquared(_cw) < 90000) fxMuzzle(_cw, TEAM[v.team].laser);
    if (--T0.burst > 0) T0.cool = 0.13; else { T0.burst = 4 + (Math.random() * 3 | 0); T0.cool = rand(0.8, 1.5); }
  }
}

/* ---------- carriers get their gun and a gunner (warlift.js builds them) ---------- */
{
  const _ws = wlSpawn;
  wlSpawn = function (team) {
    const car = _ws(team), g = crewMarine(team, car.pos.clone()); g.gunDuty = true; car.seat(g, 1);
    addTurret(car, new V3(0, 0.5 + car.hh + 1.15, car.len / 2 - 1.2 - 0.0001), { seat: 1, range: 150 });
    return car;
  };
}

/* ---------- the lifter: a VTOL troop ship ---------- */
const LIFT_G = (() => {
  const b = bucket();
  b.add('paint', xf(rbox(3.4, 2.4, 11, 0.6, 2), [0, 1.6, 0])); b.add('paint', xf(rbox(1.4, 1.2, 6, 0.4, 2), [0, 2.3, -7]));
  b.add('glass', xf(rbox(2.6, 1.1, 2, 0.4, 2), [0, 2.5, 4.6], [0.25, 0, 0]));
  b.add('dark', xf(new T.BoxGeometry(9, 0.3, 2.2), [0, 2.6, 0.5])); b.add('paint', xf(new T.BoxGeometry(3.6, 1.6, 0.25), [0, 3, -9.8]));
  for (const [x, z] of [[-4.6, 2.2], [4.6, 2.2], [-4.6, -1.2], [4.6, -1.2]]) { b.add('dark', xf(new T.CylinderGeometry(1.25, 1.25, 0.8, 16, 1, true), [x, 2.6, z])); b.add('glow', xf(new T.CircleGeometry(1.1, 14).rotateX(Math.PI / 2), [x, 2.15, z])); }
  b.add('dark', xf(new T.BoxGeometry(2.8, 0.2, 7), [0, 0.45, -0.5]));
  const geos = {}; for (const k of Object.keys(b)) if (k !== 'add') geos[k] = mergeGeos(b[k]); return geos;
})();
class Lifter extends Transport {
  constructor(team) {
    super(8, team);
    for (const c of this.body.children.slice()) this.body.remove(c);
    for (const k in LIFT_G) { const m = new T.Mesh(LIFT_G[k], TR_MAT[team][k] || TR_MAT[team].dark); m.castShadow = k === 'paint'; this.body.add(m); }
    this.seats = [new V3(0, 1.4, 4.2), new V3(1.5, 1.2, 1.0)]; for (let k = 0; k < 6; k++) this.seats.push(new V3(k % 2 ? 0.75 : -0.75, 1.1, 2.2 - (k >> 1) * 1.5 - 1.6));
    this.len = 11; this.wid = 3.4; this.radius = 6.5; this.cull = 9; this.maxHp = this.hp = 1100; this.name = team === 1 ? 'Hero lifter' : 'Villain lifter';
    this.flyH = 0; this.vy = 0; this.lift = { phase: 'seek', t: 0, sq: null, dest: null, cp: null, look: 0 }; this.war = { phase: 'seek' };
  }
  update(dt) {
    if (!this.alive) { if (!this.tumble) startTumble(this, this.fwd(_cw), 8, 1); tumbleStep(this, dt, this.radius); if (this.tumble.t > 18) this.remove = true; return; }
    for (let i = 0; i < this.cap; i++) { const s = this.riders[i]; if (s && (!s.alive || s.mount !== this)) this.riders[i] = null; }
    if (!this.riders[0]) { /* the pilot is down: she drops out of the sky */ this.vy -= 9 * dt; this.pos.y += this.vy * dt; const g = surfY(this.pos.x, this.pos.z, this.pos.y + 2); if (this.pos.y <= g + 0.5) this.damage(this.hp + 1, null, 'crash'); this.obj.position.copy(this.pos); return; }
    lifterStep(this, dt);
  }
}
/* fly toward (x, z): cruise high over everything between, settle when `land` and close */
function lifterFly(L, x, z, dt, land) {
  const p = L.pos, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz), sp = d > 80 ? 40 : Math.max(14, d * 0.5);
  let gmax = Math.max(0, surfY(p.x, p.z, p.y + 3)); for (const k of [20, 50, 90]) { const ax = p.x + dx / (d || 1) * Math.min(k, d), az = p.z + dz / (d || 1) * Math.min(k, d); gmax = Math.max(gmax, groundY(ax, az)); for (const b of bldCell(ax, az)) if (b.alive && ax > b.x0 - 6 && ax < b.x1 + 6 && az > b.z0 - 6 && az < b.z1 + 6) gmax = Math.max(gmax, b.top); }
  const settle = land && d < 22, want = settle ? Math.max(0, surfY(x, z, p.y + 3)) + 1.2 : gmax + 45;
  if (d > 0.5) { const k = Math.min(1, sp * dt / d); p.x += dx * k; p.z += dz * k; }
  p.y += clamp(want - p.y, -14 * dt, 18 * dt);
  const want_yaw = d > 2 ? Math.atan2(dx, dz) : L.yaw; L.yaw += clamp(angDiff(L.yaw, want_yaw), -1.6 * dt, 1.6 * dt);
  L.obj.position.copy(p); L.obj.rotation.set(-Math.min(0.25, sp / 160) * (settle ? 0 : 1), L.yaw, Math.sin(TIME * 1.3) * 0.03, 'YXZ');
  return { d, landed: settle && Math.abs(p.y - want) < 0.6 };
}
/* the Heroes' lifter: your company's stragglers, a long way behind you */
function lifterSeekCompany(L) {
  let best = null, bd = 1e9;
  for (const ft of CMD.teams) { if (ft.mode !== 'follow') continue; const far = ft.m.filter(s => s.alive && !s.downed && !s.mount && !s.trGo && !s.warBoard && Math.hypot(s.pos.x - ft.anchor.x, s.pos.z - ft.anchor.z) > 240); if (far.length < 2) continue;
    const c = far[0], d = c.pos.distanceTo(L.pos); if (d < bd) { bd = d; best = { m: far, ft, lead: c }; } }
  return best;
}
function lifterStep(L, dt) {
  const w = L.lift; w.t += dt; L.war.phase = w.phase === 'board' ? 'board' : w.phase;
  if (w.phase === 'seek') {
    if ((w.look -= dt) <= 0) { w.look = 2;
      if (L.team === 1) { const q = lifterSeekCompany(L); if (q) { w.sq = q; w.phase = 'fetch'; w.t = 0; } }
      else { const sq = wlSeek(L); if (sq) { w.sq = { m: sq.m, raw: sq, lead: squadLeader(sq) }; sq.wlCar = L; w.phase = 'fetch'; w.t = 0; } } }
    const h = HQ[L.team]; lifterFly(L, h.x + (L.team === 1 ? 40 : -40), h.z, dt, true); return;
  }
  if (w.phase === 'fetch') {
    const lead = w.sq && (w.sq.raw ? squadLeader(w.sq.raw) : w.sq.m.find(s => s.alive && !s.mount && !s.downed));
    if (!lead || w.t > 45 || onMesa(lead.pos)) { w.phase = 'seek'; w.sq = null; w.lz = null; return; } /* a squad up on the mesa takes the lift */
    if (!w.lz || Math.hypot(lead.pos.x - L.pos.x, lead.pos.z - L.pos.z) > 110) w.lz = new V3(lead.pos.x + 12, 0, lead.pos.z + 12); /* a landing spot by the squad, fixed once close: no chasing a walking man down */
    const r = lifterFly(L, w.lz.x, w.lz.z, dt, true);
    if (r.landed) { w.lz = null; w.phase = 'board'; w.t = 0; w.dest = L.team === 1 ? w.sq.ft.anchor : lead.goalCP; let n = 0;
      for (const s of w.sq.m) if (n < 6 && s.alive && !s.downed && !s.mount && s.pos.distanceTo(L.pos) < 70) { s.warBoard = L; s.warBoardT = 14; n++; } }
    return;
  }
  if (w.phase === 'board') {
    lifterFly(L, L.pos.x, L.pos.z, dt, true);
    const waiting = w.sq && w.sq.m.some(s => s.warBoard === L && s.alive && !s.downed);
    if (!waiting || w.t > 15) { for (const s of (w.sq ? w.sq.m : [])) if (s.warBoard === L) s.warBoard = null;
      const n = L.riders.filter((r, i) => r && !r.gunDuty && i > 0).length; if (n && w.dest) { w.phase = 'go'; w.t = 0; } else { w.phase = 'seek'; w.sq = null; } }
    return;
  }
  if (w.phase === 'go') {
    const D = w.dest, dx = L.pos.x - D.x, dz = L.pos.z - D.z, l = Math.hypot(dx, dz) || 1, tx = D.x + dx / l * 40, tz = D.z + dz / l * 40;
    const r = lifterFly(L, tx, tz, dt, true); if (r.landed || w.t > 80) { w.phase = 'drop'; w.t = 0; } return;
  }
  if (w.phase === 'drop') {
    lifterFly(L, L.pos.x, L.pos.z, dt, true);
    if (w.t > 0.8) for (let i = 1; i < L.riders.length; i++) { const s = L.riders[i]; if (!s || s.gunDuty) continue; L.unseat(i); if (!s.cmd && w.dest && w.dest.id) { s.goalCP = w.dest; s.goal.set(w.dest.x + rand(-20, 20), 0, w.dest.z + rand(-20, 20)); s.goalT = rand(14, 28); } s.think = 0; s.trCool = TIME + 30; }
    if (w.t > 3) { w.phase = 'seek'; w.sq = null; w.dest = null; }
  }
}
function lifterSpawn(team) {
  const h = HQ[team], p = new V3(h.x + (team === 1 ? 40 : -40), 0, h.z); p.y = Math.max(0, groundY(p.x, p.z)) + 1.2;
  const L = new Lifter(team); L.spawnAt(p, team === 1 ? Math.PI : 0); L.pos.copy(p); addEnt(L);
  const pilot = crewMarine(team, p.clone()); pilot.driverDuty = true; L.seat(pilot, 0);
  const gun = crewMarine(team, p.clone()); gun.gunDuty = true; L.seat(gun, 1);
  addTurret(L, new V3(1.75, 1.6, 1.2), { seat: 1, range: 170, dmg: 22 }); CREW.lifters[team].push(L); return L;
}

/* ---------- the gunboat ferries ---------- */
const FERRY_G = (() => {
  const b = bucket(), hull = rbox(4.2, 1.8, 15, 0.6, 2); { const p = hull.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i); if (z > 4) p.setX(i, p.getX(i) * (1 - (z - 4) / 5)); } hull.computeVertexNormals(); }
  b.add('paint', xf(hull, [0, 0.6, 0])); b.add('dark', xf(new T.BoxGeometry(4, 0.2, 13), [0, 1.55, -0.6])); b.add('paint', xf(rbox(2.6, 2, 3, 0.3, 2), [0, 2.6, -3.6])); b.add('glass', xf(new T.BoxGeometry(2.4, 0.6, 0.1), [0, 3.1, -2.05]));
  b.add('gun', xf(new T.CylinderGeometry(0.08, 0.08, 4, 5), [0, 4.5, -4.2]));
  const geos = {}; for (const k of Object.keys(b)) if (k !== 'add') geos[k] = mergeGeos(b[k]); return geos;
})();
class Ferry extends Transport {
  constructor(team) {
    super(12, team);
    for (const c of this.body.children.slice()) this.body.remove(c);
    for (const k in FERRY_G) { const m = new T.Mesh(FERRY_G[k], TR_MAT[team][k] || TR_MAT[team].dark); m.castShadow = k === 'paint'; this.body.add(m); }
    this.seats = [new V3(0, 1.9, -3.2), new V3(0, 1.9, 4.2)]; for (let k = 0; k < 10; k++) this.seats.push(new V3(k % 2 ? 1.1 : -1.1, 1.8, 2.2 - (k >> 1) * 1.6));
    this.len = 15; this.wid = 4.2; this.radius = 7; this.cull = 10; this.maxHp = this.hp = 1300; this.name = team === 1 ? 'Hero gunboat' : 'Villain gunboat';
    this.fer = { i: 0, phase: 'cruise', dock: -1, t: 0 }; this.war = { phase: 'cruise' };
  }
  update(dt) {
    if (!this.alive) { this.pos.y -= dt * 1.5; this.obj.position.copy(this.pos); this.obj.rotation.z += dt * 0.2; if (this.pos.y < -12) this.remove = true; return; }
    for (let i = 0; i < this.cap; i++) { const s = this.riders[i]; if (s && (!s.alive || s.mount !== this)) this.riders[i] = null; }
    if (!this.riders[0]) { this.bob(dt, 0); return; } /* no pilot: adrift */
    ferryStep(this, dt);
  }
  bob(dt, sp) { this.pos.y = 0.15 + Math.sin(TIME * 1.4 + this.seed) * 0.15; this.obj.position.copy(this.pos); this.obj.rotation.set(-Math.min(0.08, sp / 300), this.yaw, Math.sin(TIME * 1.1 + this.seed) * 0.04, 'YXZ'); }
}
(function ferryRoutes() { /* a ring offshore round the island, and four beaches it puts in at */
  for (let k = 0; k < 44; k++) { const a = k / 44 * Math.PI * 2; let r = islandR(a) + 38; let x = Math.cos(a) * r, z = Math.sin(a) * r; for (let n = 0; n < 12 && H(x, z) > -4; n++) { r += 8; x = Math.cos(a) * r; z = Math.sin(a) * r; } x = clamp(x, -BOUND + 8, BOUND - 8); z = clamp(z, -BOUND + 8, BOUND - 8); CREW.ring.push(new V3(x, 0, z)); }
  for (const [name, lx, lz] of [['Sector beach', -440, 30], ['Muster beach', -60, 450], ['Port quay', 380, 330], ['North shore', -40, -470]]) {
    let bi = 0, bd = 1e9; CREW.ring.forEach((q, i) => { const d = Math.hypot(q.x - lx, q.z - lz); if (d < bd) { bd = d; bi = i; } });
    const q = CREW.ring[bi]; let x = q.x, z = q.z; for (let n = 0; n < 60; n++) { const nx = x + (lx - x) * 0.04, nz = z + (lz - z) * 0.04; if (H(nx, nz) > -2.2) break; x = nx; z = nz; } /* in to the shallows */
    CREW.docks.push({ name, ri: bi, x, z, land: new V3(lx, 0, lz) });
  }
})();
function ferryMove(F, x, z, dt, sp) { const p = F.pos, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); if (d > 0.3) { const k = Math.min(1, sp * dt / d); p.x += dx * k; p.z += dz * k; const wy = Math.atan2(dx, dz); F.yaw += clamp(angDiff(F.yaw, wy), -0.9 * dt, 0.9 * dt); } F.bob(dt, sp); return d; }
function ferryStep(F, dt) {
  const f = F.fer, R = CREW.ring, n = R.length; f.t += dt; F.war.phase = f.phase === 'dock' ? 'board' : f.phase;
  if (f.phase === 'cruise') {
    const q = R[f.i]; if (ferryMove(F, q.x, q.z, dt, 16) < 6) { const dk = CREW.docks.find(D => D.ri === f.i && CREW.docks.indexOf(D) !== f.dock); if (dk) { f.phase = 'in'; f.dock = CREW.docks.indexOf(dk); f.t = 0; } else f.i = (f.i + F.dirn + n) % n; }
    return;
  }
  const D = CREW.docks[f.dock];
  if (f.phase === 'in') { if (ferryMove(F, D.x, D.z, dt, 8) < 3 || f.t > 30) { f.phase = 'dock'; f.t = 0; ferryArrive(F, f.dock); } return; }
  if (f.phase === 'dock') { F.bob(dt, 0); if (f.t > 10) { for (const s of ENTS) if (s.warBoard === F) s.warBoard = null; f.phase = 'out'; f.t = 0; } return; }
  if (f.phase === 'out') { const q = R[D.ri]; if (ferryMove(F, q.x, q.z, dt, 10) < 6) { f.phase = 'cruise'; f.i = (D.ri + F.dirn + n) % n; } }
}
function ferryArrive(F, di) {
  const D = CREW.docks[di];
  for (let i = 1; i < F.riders.length; i++) { const s = F.riders[i]; if (!s || s.gunDuty || s.ferryTo !== di) continue; F.unseat(i); s.pos.set(D.land.x + rand(-8, 8), 0, D.land.z + rand(-8, 8)); s.pos.y = surfY(s.pos.x, s.pos.z, 30); s.ferryTo = undefined; s.goalT = 0; s.think = 0; s.trCool = TIME + 30; }
  let seats = F.riders.filter(r => !r).length;
  for (const s of ENTS) { /* who on this beach wants a far one */
    if (seats <= 0) break; if (s.team !== F.team || !trOk(s) || (s.trCool || 0) > TIME || Math.hypot(s.pos.x - D.land.x, s.pos.z - D.land.z) > 60) continue;
    const dest = wlDest(s); if (!dest) continue; const here = Math.hypot(dest.x - s.pos.x, dest.z - s.pos.z);
    let best = -1, bd = here - 180; CREW.docks.forEach((E, k) => { if (k === di) return; const d = Math.hypot(dest.x - E.land.x, dest.z - E.land.z); if (d < bd) { bd = d; best = k; } });
    if (best < 0) continue; s.warBoard = F; s.warBoardT = 10; s.ferryTo = best; seats--;
  }
}
function ferrySpawn(team) {
  const D = CREW.docks[team === 1 ? 1 : 3], F = new Ferry(team), p = new V3(D.x, 0.2, D.z);
  F.spawnAt(p, 0); F.pos.copy(p); F.dirn = team === 1 ? 1 : -1; F.fer.i = D.ri; addEnt(F);
  const pilot = crewMarine(team, p.clone()); pilot.driverDuty = true; F.seat(pilot, 0);
  const gun = crewMarine(team, p.clone()); gun.gunDuty = true; F.seat(gun, 1);
  addTurret(F, new V3(0, 2.1, 4.6), { seat: 1, range: 190, dmg: 26 }); CREW.ferries[team].push(F); return F;
}
/* boarding a ferry: warlift's runner checks war.phase === 'board' */

/* ---------- upkeep: one lifter and one gunboat per army, replaced when lost ---------- */
function updateCrews(dt) {
  updateTurrets(dt);
  if (GAME.state !== 'play' || (CREW.t -= dt) > 0) return; CREW.t = 1;
  for (const team of [1, 2]) {
    for (const [list, key, spawn, wait] of [[CREW.lifters[team], 'L' + team, lifterSpawn, 45], [CREW.ferries[team], 'F' + team, ferrySpawn, 50]]) {
      for (let i = list.length - 1; i >= 0; i--) if (!list[i].alive || list[i].remove) list.splice(i, 1);
      if (!list.length) { CREW.dead[key] += 1; if (CREW.dead[key] > (GAME.clock > 5 ? wait : 3)) { CREW.dead[key] = 0; spawn(team); } }
    }
  }
}
{ const _uz = updateZips; updateZips = function (dt) { _uz(dt); updateCrews(dt); }; }
