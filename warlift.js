'use strict';
/* ===================== IRON MERIDIAN · war lift: the armies move themselves =====================
   Two things the line troops of both armies do on their own, with no part for the Hero:
   1. TRANSPORTS: each army runs a small fleet of crewed troop carriers. A carrier finds a squad that is a long way
      from its objective and drives to it. The squad piles in and the carrier runs them toward the post. It stops
      short of the post, they unload and push in on foot, and it goes back for more. The passengers shoot from the
      benches on the way. A carrier that is destroyed is replaced from HQ after a while.
   2. ZIPLINES: soldiers near the foot of a tower, pylon or rooftop line take the cable network when it carries
      them toward their objective: up the vertical, across the span, down the far side. Then they carry on.
   Budgets are small on phones (fewer carriers, fewer riders), and the scans are spread across ticks. */
const WL = { why: {}, cars: { 1: [], 2: [] }, dead: { 1: [], 2: [] }, t: 0, zt: 0, routes: [], rt: 0, ri: 0, zipN: 0 };
const WL_CARS = LOW_END ? 2 : 3, WL_CAP = 8, WL_ZIPMAX = LOW_END ? 6 : 14;
const _wq = new V3();
/* the Hero's side is his own company, carried by its motor pool (motorpool.js): the carriers here are the other army's */
const WL_TEAMS = ARMIES.filter(t => t !== 1 && TR_MAT[t]);
const wlFree = s => s.kind === 'soldier' && s.alive && !s.remove && !s.isPlayer && !s.trGo && !s.cmd && !s.hero && !s.mount && !s.downed && !s.deck && !s.para && !s.driverDuty && !s.marine && !s.marksman && !s.warBoard && !s.zipGo && !s.zipTrip && !s.revTgt && !s.boardTarget;

/* who may take a cable, and where they are trying to get to: line troops to their objective, the Commander's
   company to its place beside him when he has flown on ahead */
const wlZipOk = s => s.kind === 'soldier' && s.alive && !s.remove && !s.isPlayer && !s.trGo && !s.hero && !s.mount && !s.downed && !s.deck && !s.para && !s.driverDuty && !s.marine && !s.marksman && !s.warBoard && !s.zipGo && !s.zipTrip && !s.revTgt && !s.boardTarget && (s.cmd ? true : !s.target);
const wlDest = s => s.cmd ? (s.cmd.mode === 'follow' && Math.hypot(s.cmd.anchor.x - s.pos.x, s.cmd.anchor.z - s.pos.z) > 150 ? s.cmd.anchor : null) : s.goalCP;
/* ---------- transports ---------- */
function wlHome(team) { const h = HQ[team], dz = team === 1 ? -70 : 70; return { x: h.x, z: h.z + dz }; }
function wlSpawn(team) {
  const h = wlHome(team), q = landNear(h.x, h.z, 30); pushOut(q, 6);
  const car = spawnTransport(WL_CAP, team, q, team === 1 ? Math.PI : 0); car.war = { phase: 'seek', t: 0, sq: null, cp: null, dest: null, stuckT: 0, revT: 0 }; car.driven = true;
  car.name = team === 1 ? 'Hero carrier' : 'Villain carrier';
  const d = new Soldier(team); d.squad = { m: [d], lead: null }; d.noRequeue = true; d.marine = true; /* crew: outside the line company cap, like ship crews */ d.driverDuty = true; d.spawnAt(q); addEnt(d); car.seat(d, 0);
  return car;
}
/* across the island the carriers take the underpass rather than the mesa's cliffs: steer for the near mouth, run the
   tunnel, come out of the far one */
const WL_MS = { x: 30, z: UNDERPASS.zS + 22 }, WL_MN = { x: 38, z: UNDERPASS.zN - 18 };
function wlVia(car, x, z) {
  const p = car.pos;
  if (inUnderpass(p.x, p.z) || inBunker(p.x, p.z)) return z < p.z ? WL_MN : WL_MS; /* in the tunnel: carry on through */
  const dx = x - p.x, dz = z - p.z, L2 = dx * dx + dz * dz || 1, t = clamp(((CITYC.x - p.x) * dx + (CITYC.z - p.z) * dz) / L2, 0, 1), cx = p.x + dx * t - CITYC.x, cz = p.z + dz * t - CITYC.z;
  if (Math.hypot(cx, cz) > MESA.r1 + 8 || Math.hypot(x - CITYC.x, z - CITYC.z) < MESA.r0) return null; /* clear of the mesa (or going up onto it) */
  const near = p.z > CITYC.z ? WL_MS : WL_MN, far = near === WL_MS ? WL_MN : WL_MS;
  if ((z > CITYC.z) === (p.z > CITYC.z)) return null; /* same side: round the mesa as before */
  return Math.hypot(near.x - p.x, near.z - p.z) < 14 ? far : near;
}
function wlDrive(car, x, z, dt, slow) { /* steer for a point, look ahead for buildings, back off when stuck */
  const dReal = Math.hypot(x - car.pos.x, z - car.pos.z); let via = false; /* the phases judge arrival by the real destination, not the tunnel mouth */
  { const v = wlVia(car, x, z); if (v) { x = v.x; z = v.z; via = true; } }
  const w = car.war, dx = x - car.pos.x, dz = z - car.pos.z, d = Math.hypot(dx, dz);
  if (w.revT > 0) { w.revT -= dt; car.drive(dt, -0.8, w.side || 1, false); return d; }
  let want = Math.atan2(dx, dz);
  for (const look of [9, 20]) { _wq.set(car.pos.x + Math.sin(car.yaw) * look, car.pos.y + 1, car.pos.z + Math.cos(car.yaw) * look); if (buildingAt(_wq)) { want = car.yaw + 1.3 * (w.side || 1); break; } }
  const thr = slow ? 0.35 : d > 60 ? 1 : d > 25 ? 0.6 : 0.35;
  car.spdMul = TR_SPD[car.cap] * (d > 150 ? 1.05 : 0.9);
  car.drive(dt, thr, clamp(angDiff(car.yaw, want) * 2, -1, 1), false);
  if (Math.abs(car.speed) < 2.5) { if ((w.stuckT += dt) > 3) { w.stuckT = 0; w.revT = 1.6; w.side = Math.random() < 0.5 ? -1 : 1; } } else w.stuckT = 0;
  return via ? Math.max(dReal, 30) : d;
}
const wlRiders = car => { let n = 0; for (let i = 1; i < car.riders.length; i++) if (car.riders[i] && !car.riders[i].gunDuty) n++; return n; }; /* the gunner is crew, not cargo */
function wlUnload(car) {
  const cp = car.war.cp;
  for (let i = 1; i < car.riders.length; i++) { const s = car.riders[i]; if (!s || s.gunDuty) continue; car.unseat(i);
    if (cp) { s.goalCP = cp; s.goal.set(cp.x + rand(-20, 20), 0, cp.z + rand(-20, 20)); s.goalT = rand(14, 28); } s.think = 0; }
}
function wlSeek(car) { /* the nearest squad that is far from where it is going and not already being fetched */
  let best = null, bd = 700;
  for (const sq of SQUADS[car.team] || []) {
    if ((sq.wlNext || 0) > TIME || (sq.wlCar && sq.wlCar.alive && sq.wlCar.war.sq === sq)) continue;
    const L = squadLeader(sq); if (!L || !wlFree(L) || !L.goalCP || (L.target && L.target.pos.distanceTo(L.pos) < 110)) continue;
    if (Math.hypot(L.goalCP.x - L.pos.x, L.goalCP.z - L.pos.z) < 200) continue;
    const d = L.pos.distanceTo(car.pos); if (d < bd) { bd = d; best = sq; }
  }
  return best;
}
function wlCarStep(car, dt) {
  const w = car.war;
  for (let i = 0; i < car.cap; i++) { const s = car.riders[i]; if (s && (!s.alive || s.mount !== car)) car.riders[i] = null; }
  if (!car.riders[0]) { /* the driver is down: a passenger takes the wheel */
    const i = car.riders.findIndex((r, k) => k > 0 && r); if (i > 0) { const r = car.riders[i]; car.riders[i] = null; car.riders[0] = r; r.driverDuty = true; }
    else { car.drive(dt, 0, 0, false); if ((w.emptyT = (w.emptyT || 0) + dt) > 25) car.remove = true; return; }
  }
  w.emptyT = 0; w.t += dt;
  if (w.phase === 'seek') {
    if ((w.look = (w.look || 0) - dt) <= 0) { w.look = 1.5; const sq = wlSeek(car); if (sq) { w.sq = sq; sq.wlCar = car; w.phase = 'fetch'; w.t = 0; } }
    const h = wlHome(car.team); if (w.phase === 'seek') { if (Math.hypot(h.x - car.pos.x, h.z - car.pos.z) > 40) wlDrive(car, h.x, h.z, dt, true); else car.drive(dt, 0, 0, false); }
    return;
  }
  if (w.phase === 'fetch') {
    const L = w.sq && squadLeader(w.sq);
    const why = !L ? 'gone' : w.t > 45 ? 'late' : !wlFree(L) ? 'busy' : (L.target && L.target.pos.distanceTo(L.pos) < 60) ? 'fight' : null;
    if (why) { WL.why[why] = (WL.why[why] || 0) + 1; if (w.sq) w.sq.wlNext = TIME + 20; w.sq = null; w.phase = 'seek'; return; }
    if (wlDrive(car, L.pos.x, L.pos.z, dt) < 20) {
      w.phase = 'board'; w.t = 0; w.cp = L.goalCP; car.speed *= 0.3; let n = 0;
      for (const s of w.sq.m) if (n < car.cap - 1 && wlFree(s) && s.pos.distanceTo(car.pos) < 70) { s.warBoard = car; s.warBoardT = 15; n++; }
      if (car.team === 1 && n && Math.random() < 0.3) comms(L.name, pick(['Ride is here, mount up!', 'Everybody in, move!', 'Carrier on us. Load up!']), 'b');
    }
    return;
  }
  if (w.phase === 'board') {
    car.drive(dt, 0, 0, false);
    const waiting = w.sq && w.sq.m.some(s => s.warBoard === car && s.alive && !s.downed);
    if (!waiting || w.t > 16) {
      for (const s of (w.sq ? w.sq.m : [])) if (s.warBoard === car) s.warBoard = null;
      if (w.sq) w.sq.wlNext = TIME + 40;
      const cp = w.cp; if (wlRiders(car) >= 2 && cp) {
        const dx = car.pos.x - cp.x, dz = car.pos.z - cp.z, l = Math.hypot(dx, dz) || 1; w.dest = { x: cp.x + dx / l * 45, z: cp.z + dz / l * 45 }; w.phase = 'go'; w.t = 0;
      } else { wlUnload(car); w.phase = 'seek'; w.sq = null; }
    }
    return;
  }
  if (w.phase === 'go') {
    const d = wlDrive(car, w.dest.x, w.dest.z, dt);
    if (!wlRiders(car)) { WL.why.emptied = (WL.why.emptied || 0) + 1; w.phase = 'seek'; w.sq = null; w.cp = null; return; } /* everyone aboard was shot off: go back for more */
    if (d < 18 || w.t > 75 || (car.hp < car.maxHp * 0.35)) { w.phase = 'drop'; w.t = 0; }
    return;
  }
  if (w.phase === 'drop') { car.drive(dt, 0, 0, false); if (w.t > 0.8 && wlRiders(car)) wlUnload(car); if (w.t > 3) { w.phase = 'seek'; w.sq = null; w.cp = null; } }
}
/* a carrier is armoured for the run in: bumping a tank at speed dents it rather than wrecking it. Fire still kills it. */
const _wlTrDmg = Transport.prototype.damage;
Transport.prototype.damage = function (a, src, type) { return _wlTrDmg.call(this, this.war && type === 'crash' ? a * 0.2 : a, src, type); };
const _wlTrUpd = Transport.prototype.update;
Transport.prototype.update = function (dt) { if (this.war && this.alive) return wlCarStep(this, dt); return _wlTrUpd.call(this, dt); };

/* ---------- zipline routes: up a vertical, across a span, down the far vertical ---------- */
function wlRoutes() {
  const V = ZIPS.lines.filter(L => L.kind === 'v'), R = [];
  const topOf = p => { let b = null, bd = 8; for (const v of V) { const d = Math.hypot(v.lb.x - p.x, v.lb.z - p.z); if (d < bd && Math.abs(v.lb.y - p.y) < 3) { bd = d; b = v; } } return b; };
  for (const h of ZIPS.lines) {
    if (h.kind !== 'h' || h.a.y > 1200) continue; const va = topOf(h.la), vb = topOf(h.lb); if (!va || !vb || va === vb) continue;
    R.push({ v1: va, h, hf: 0, v2: vb }, { v1: vb, h, hf: 1, v2: va });
  }
  WL.routes = R; WL.ri = 0;
}
const wlRouteOn = R => R.v1.on && R.h.on && R.v2.on;
function zipHop(s, L, from, done) { const p0 = s.pos.clone(), r = zipRide(s, L, from, done); r.p0 = p0; r.blend = 0; r.saddle(s.pos); return r; }
function zipTrip(s, R) {
  s.zipTrip = true; const end = () => { s.zipTrip = false; s.zipCool = TIME + 25; s.goalT = 0; s.think = 0; };
  zipHop(s, R.v1, 0, () => {
    if (!s.alive) return end();
    if (!R.h.on || !R.v2.on) return zipHop(s, R.v1, 1, end); /* the span is down: back the way they came */
    zipHop(s, R.h, R.hf, () => { if (!s.alive) return end(); if (!R.v2.on) return end(); zipHop(s, R.v2, 1, end); });
  });
}
function wlZipScan() {
  if (!WL.routes.length) return; let n = 0;
  for (const e of ENTS) if (e.kind === 'soldier' && e.alive && (e.zipGo || e.zipTrip)) n++;
  WL.zipN = n; if (n >= WL_ZIPMAX) return;
  const batch = []; for (let k = 0; k < 6 && k < WL.routes.length; k++) { const R = WL.routes[WL.ri++ % WL.routes.length]; if (wlRouteOn(R)) batch.push(R); }
  if (!batch.length) return;
  const take = new Map();
  for (const s of ENTS) {
    if (n >= WL_ZIPMAX) break; if (!wlZipOk(s) || (s.zipCool || 0) > TIME || s.hurtT > 0 || (s.squad && s.squad.wlCar && s.squad.wlCar.alive && s.squad.wlCar.war.sq === s.squad)) continue;
    const cp = wlDest(s); if (!cp) continue;
    for (const R of batch) {
      const f = R.v1.la; if (Math.abs(f.x - s.pos.x) > 35 || Math.abs(f.z - s.pos.z) > 35) continue;
      const here = Math.hypot(cp.x - s.pos.x, cp.z - s.pos.z), there = Math.hypot(cp.x - R.v2.la.x, cp.z - R.v2.la.z);
      if (here - there < 70 || there > 380) continue;
      const k = take.get(R) || 0; if (k >= 2) continue; take.set(R, k + 1);
      s.zipGo = R; s.zipGoT = 15; n++; break;
    }
  }
}

/* ---------- the soldiers' side: run to a seat, run to a cable foot ---------- */
const _wlSolUpd = Soldier.prototype.update;
Soldier.prototype.update = function (dt) {
  if (this.alive && !this.downed && !this.mount) {
    const c = this.warBoard;
    if (c) {
      if (!c.alive || !c.war || c.war.phase !== 'board' || (this.warBoardT -= dt) <= 0) this.warBoard = null;
      else {
        this.goal.set(c.pos.x, 0, c.pos.z); this.goalT = 3; this.target = null; if (this.think < 0.25) this.think = 0.25;
        if (Math.hypot(c.pos.x - this.pos.x, c.pos.z - this.pos.z) < (c.radius || 3) + 3.5) { const seat = c.riders.indexOf(null, 1); if (seat > 0) c.seat(this, seat); this.warBoard = null; }
      }
    } else if (this.zipGo) {
      const R = this.zipGo, f = R.v1.la;
      if ((this.zipGoT -= dt) <= 0 || !wlRouteOn(R) || this.hurtT > 0) { this.zipGo = null; this.zipCool = TIME + 20; }
      else if (Math.hypot(f.x - this.pos.x, f.z - this.pos.z) < 3.5) { this.zipGo = null; zipTrip(this, R); }
      else { this.goal.set(f.x, 0, f.z); this.goalT = 3; this.target = null; if (this.think < 0.25) this.think = 0.25; }
    }
  }
  return _wlSolUpd.call(this, dt);
};

/* ---------- tick ---------- */
function updateWarLift(dt) {
  if (GAME.state !== 'play') return;
  if ((WL.rt -= dt) <= 0) { WL.rt = 30; wlRoutes(); } /* fortress towers add their verticals as they are finished */
  if ((WL.zt -= dt) <= 0) { WL.zt = 0.5; wlZipScan(); }
  if ((WL.t -= dt) > 0) return; WL.t = 1;
  for (const team of WL_TEAMS) {
    const cars = WL.cars[team]; for (let i = cars.length - 1; i >= 0; i--) if (!cars[i].alive || cars[i].remove) { cars.splice(i, 1); WL.dead[team].push(GAME.clock > 5 ? 40 : 2); }
    while (cars.length + WL.dead[team].length < WL_CARS) WL.dead[team].push(2);
    const q = WL.dead[team]; for (let i = q.length - 1; i >= 0; i--) if ((q[i] -= 1) <= 0) { q.splice(i, 1); cars.push(wlSpawn(team)); }
  }
}
const _wlZips = updateZips;
updateZips = function (dt) { _wlZips(dt); updateWarLift(dt); };
