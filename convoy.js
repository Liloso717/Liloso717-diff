'use strict';
/* ===================== IRON MERIDIAN · convoys: the company mounts up when the Commander rides ===================== */
// When you take a ride, squads that are following you fill your vehicle first, then run to the nearest free transports
// (a squad member takes the wheel) and form a convoy on you. The convoy trails in column, or swings out line-abreast,
// depending on where the threat is: contact ahead or behind → line abreast so every gun bears; contact on a flank →
// column, shifted toward the threat to screen the Commander. Hop off and the convoy halts and dismounts with you.
const CONVOY = { leader: null, cars: [], mode: 'trail', shift: 0, t: 0, sayT: 0 };
/* ---------- clinging: when the seats run out, troopers grab on to the outside of the ride ---------- */
// A Shiftframe carries up to six on its hull (robot mode: shoulders, back and arms). A walker carries ten on its roof, the Titan six,
// big transports four on the roof, small ones two, a speeder or quad two, a bike one. Clingers keep shooting.
const CLING_CAP = { fighter: 4, shiftframe: 6, walker: 10, monster: 6, speeder: 2, transport: 2 };
const CLING_SLOTS = {
  shiftframe: { vehicle: [[-0.9, 2.35, 0.9], [0.9, 2.35, 0.9], [-0.9, 2.35, -0.6], [0.9, 2.35, -0.6], [-1.9, 1.6, -1.6], [1.9, 1.6, -1.6]], robot: [[-1.7, 5.45, -0.1], [1.7, 5.45, -0.1], [-0.6, 4.7, -1.25], [0.6, 4.7, -1.25], [-1.9, 3.6, 0.6], [1.9, 3.6, 0.6]] },
  walker: [[-2.8, 20.2, 3.6], [-0.95, 20.2, 3.6], [0.95, 20.2, 3.6], [2.8, 20.2, 3.6], [-2.8, 20.2, 0], [2.8, 20.2, 0], [-2.8, 20.2, -3.6], [-0.95, 20.2, -3.6], [0.95, 20.2, -3.6], [2.8, 20.2, -3.6]], /* ten on the roof deck */
  monster: [[-3, 17, 4], [3, 17, 4], [-3, 18, -2], [3, 18, -2], [0, 18.5, -6], [0, 17.5, 8]],
  speeder: [[-1.1, 1.75, -1.6], [1.1, 1.75, -1.6]],
  fighter: [[-2.4, 0.75, -0.8], [2.4, 0.75, -0.8], [-0.9, 1.1, -2.6], [0.9, 1.1, -2.6]], /* on the wing roots and the spine */
};
class Cling {
  constructor(v, o = {}) { this.v = v; this.kind = 'cling'; this.isCling = true; this.hideRiders = !!o.hide; this.capO = o.cap || 0; this.inside = !!o.inside; this.riders = []; this.name = v.name; }
  get alive() { return this.v.alive && !this.v.remove; }
  get yaw() { return leaderYaw(this.v); }
  get cap() { if (this.capO) return this.capO; const v = this.v; if (v.bike) return v.bike === 'quad' || v.bike === 'moto3' ? 2 : 1; if (v.kind === 'transport') return v.cap >= 8 ? 4 : CLING_CAP.transport; return CLING_CAP[v.kind] || 0; }
  slot(i, out) {
    const v = this.v, K = CLING_SLOTS[v.kind]; let p; if (this.inside) return out.copy(v.pos);
    if (v.kind === 'shiftframe') p = (v.mode === 'robot' ? K.robot : K.vehicle)[i];
    else if (K) p = K[i];
    else { const L = v.len || 4, W = v.wid || 2, H2 = (v.hh || 1) + 0.6; p = v.bike ? [0, 0.15, -1.25 - i * 0.5] : [(i % 2 ? 1 : -1) * W * 0.3, H2 + 0.5, -L * 0.15 - ((i / 2) | 0) * 1.4]; }
    const wk = v.kind === 'walker' && v.torso, y = leaderYaw(v) + (wk ? v.torsoYaw || 0 : 0), c = Math.cos(y), sn = Math.sin(y), sc = v.obj.scale.x || 1; /* yaw-only: clingers stay upright; on a walker they ride the turning, bobbing torso */
    const py = wk ? p[1] - 17 + v.torso.position.y : p[1];
    return out.set(v.pos.x + (p[0] * c + p[2] * sn) * sc, (v.kind === 'transport' || v.kind === 'speeder' ? v.pos.y : v.obj.position.y) + py * sc, v.pos.z + (-p[0] * sn + p[2] * c) * sc);
  }
  attach(s) { if (this.riders.length >= this.cap || this.riders.includes(s)) return false; if (s.mount) s.mount.dismount(s); this.riders.push(s); s.mount = this; s.target = null; return true; }
  saddle(out, who) { const i = this.riders.indexOf(who); return this.slot(Math.max(0, i), out); }
  dismount(who) {
    const i = this.riders.indexOf(who); if (i < 0) return; this.riders.splice(i, 1); who.mount = null; const v = this.v, a = Math.random() * 6.283, r = (v.radius || 3) + rand(1.5, 3);
    who.pos.set(v.pos.x + Math.cos(a) * r, 0, v.pos.z + Math.sin(a) * r); pushOut(who.pos, 0.6); const g = surfY(who.pos.x, who.pos.z, v.pos.y + 2);
    if (v.pos.y - g > 15) { who.pos.y = v.pos.y - 3; who.para = true; who.goal.set(who.pos.x + rand(-20, 20), 0, who.pos.z + rand(-20, 20)); } else who.pos.y = g; /* thrown clear in the air: chutes */
  }
  dropAll() { for (const s of this.riders.slice()) this.dismount(s); }
}
const clingOf = v => v.clingRack || (v.clingRack = new Cling(v));
const cabinOf = v => v.cabin || (v.cabin = new Cling(v, { hide: true, inside: true, cap: v.kind === 'fighter' ? 1 : 40 })); // pilots and passengers ride inside, unseen
const clingFree = v => { const c = clingOf(v); return c.cap - c.riders.length; };
function convoyLeader() {
  const P = PLAYER, e = P.ent; if (!e || !e.alive || GAME.state !== 'play') return null;
  if (P.hero) return e.kind === 'fighter' || e.kind === 'starship' || e.pos.y < 300 ? e : null; // a possessed ride: ground vehicles, jets and starships
  const m = e.mount; return m && (m.kind === 'transport' || m.kind === 'bird') ? m : null;
}
const leaderYaw = L => L.kind === 'walker' || L.kind === 'monster' ? L.heading || 0 : L.kind === 'fighter' && L.dir ? Math.atan2(L.dir.x, L.dir.z) : L.yaw || 0; // forward = (sin, cos)
function topUpClingers(L) { // troopers left on foot keep grabbing free handholds while the ride is moving slowly enough
  if (L.kind === 'starship') { if (L.landed) for (const s of followers(L, 70)) if (!s.boardTarget) { s.boardTarget = cabinOf(L); s.boardT = 12; } return; }
  if (L.kind === 'fighter' || Math.abs(L.speed || 0) > 14) return;
  for (const ft of CMD.teams) if (ft.mode === 'follow') for (const s of ft.m) {
    if (!s.alive || s.downed || s.mount || s.boardTarget || s.pos.distanceTo(L.pos) > 60) continue;
    const v = clingFree(L) - (clingOf(L).pending || 0) > 0 ? L : CONVOY.cars.find(c => c.alive && clingFree(c) - (clingOf(c).pending || 0) > 0 && c.pos.distanceTo(s.pos) < 60); if (!v) return;
    const r = clingOf(v); s.boardTarget = r; s.boardT = 12; r.pending = (r.pending || 0) + 1;
  }
}
function followers(L, r) { const a = []; for (const ft of CMD.teams) if (ft.mode === 'follow') for (const s of ft.m) if (s.alive && !s.downed && !s.mount && !s.para && s.pos.distanceTo(L.pos) < r) a.push(s); return a.sort((p, q) => p.pos.distanceTo(L.pos) - q.pos.distanceTo(L.pos)); }
function formShipCrew(L) { // a starship: the whole following company runs aboard and rides inside
  const cab = cabinOf(L); let n = 0; for (const s of followers(L, 150)) { if (s.pos.distanceTo(L.pos) < 30) { cab.attach(s); n++; } else { s.boardTarget = cab; s.boardT = 14; cab.pending = (cab.pending || 0) + 1; n++; } }
  if (n) comms('Alpha Lead', `Company boarding the ${L.name}. ${n} troopers aboard or running for the ramp!`, 'b');
}
function formWing(L) { // a jet: four scramble on to your wings; the rest man the other jets on the strip and fly as your wingmen
  const F = followers(L, 160); let i = 0;
  const on = r => { while (i < F.length && r.riders.length < r.cap) { const s = F[i++]; r.attach(s); } };
  on(clingOf(L)); let w = 0;
  for (const f of ENTS) {
    if (i >= F.length) break; if (f === L || f.kind !== 'fighter' || !f.alive || !f.parked || f.isPlayer || f.pos.distanceTo(L.pos) > 500) continue;
    cabinOf(f).attach(F[i++]); on(clingOf(f)); f.parked = false; f.convoy = true; f.speed = 95; f.pos.y += 24; f.dir.y = 0.3; f.dir.normalize(); w++; CONVOY.cars.push(f);
  }
  comms('Alpha Lead', w ? `Scramble! ${Math.min(4, clingOf(L).riders.length)} of us on your wings, ${w} more jet${w > 1 ? 's' : ''} up as your wingmen.` : `${clingOf(L).riders.length} of us holding on to your wings, Commander!`, 'b');
}
function formConvoy(L) {
  if (L.kind === 'starship') return formShipCrew(L);
  if (L.kind === 'fighter') return formWing(L);
  const need = []; for (const ft of CMD.teams) if (ft.mode === 'follow') for (const s of ft.m) if (s.alive && !s.downed && s.mount !== L && !(s.mount && (s.mount.kind === 'transport' || s.mount.kind === 'cling'))) need.push(s);
  if (!need.length) return;
  const cars = ENTS.filter(e => e.kind === 'transport' && e.alive && !e.auto && e !== L && !isHostile(e.team) && !e.riders.some(r => r && r.isPlayer) && e.pos.distanceTo(L.pos) < 160).sort((a, b) => a.pos.distanceTo(L.pos) - b.pos.distanceTo(L.pos));
  need.sort((a, b) => a.pos.distanceTo(L.pos) - b.pos.distanceTo(L.pos)); let i = 0, nc = 0;
  const grab = (v, max) => { const rack = clingOf(v); let k = Math.min(max, clingFree(v) - (rack.pending || 0)); while (k-- > 0 && i < need.length) { const s = need[i++]; s.boardTarget = rack; s.boardT = 14; rack.pending = (rack.pending || 0) + 1; nc++; } };
  if (L.kind === 'shiftframe' || L.kind === 'walker') grab(L, L.kind === 'walker' ? 10 : 6); // Shiftframe or walker: the nearest climb straight on to it
  for (const car of cars) {
    if (i >= need.length) break; let free = car.riders.filter(r => !r).length; if (!free) continue;
    car.convoy = true; car.expect = car.riders.filter(Boolean).length; car.waitT = 0; CONVOY.cars.push(car); while (free-- > 0 && i < need.length) { const s = need[i++]; s.boardTarget = car; s.boardT = 18; car.expect++; }
  }
  CONVOY.escorts = []; // spare troopers take whatever is parked nearby (jets, walkers, Shiftframes, speeders) and escort the convoy
  for (const v of ENTS) {
    if (i >= need.length || CONVOY.escorts.length >= 4) break;
    if (!v.alive || !v.parked || v.isPlayer || v.team !== 1 || !['walker', 'shiftframe', 'speeder', 'fighter'].includes(v.kind) || v.pos.distanceTo(L.pos) > 180) continue;
    cabinOf(v).attach(need[i++]); v.parked = false; v.escortOf = L; CONVOY.escorts.push(v);
    if (v.kind === 'fighter') { v.speed = 95; v.pos.y += 24; v.dir.y = 0.3; v.dir.normalize(); }
  }
  if (CONVOY.escorts.length) comms('Bravo Lead', `${CONVOY.escorts.length} of ours grabbing a ${CONVOY.escorts.map(v => rideName(v)).join(', ')} to escort you!`, 'b');
  if (i < need.length) grab(L, 10); for (const car of CONVOY.cars) if (i < need.length) grab(car, 4); // whoever is left clings on outside
  const n = CONVOY.cars.length;
  if (nc) comms('Alpha Lead', L.kind === 'shiftframe' || L.kind === 'walker' ? `${nc} of us climbing onto your ${L.kind === 'walker' ? 'walker' : 'Shiftframe'}, Commander. Hang on!` : `${nc} troopers grabbing on to the outside. Go, go!`, 'b');
  if (n) comms('Alpha Lead', n > 1 ? `Company mounting up in ${n} vehicles. Convoy on you, Commander.` : `Squads boarding the ${CONVOY.cars[0].name}. Right behind you.`, 'b');
}
// squad members assigned a seat run to it (called from cmdThink); the first one aboard takes the wheel
function convoyBoard(s) {
  const c = s.boardTarget; if (!c) return false; const v = c.isCling ? c.v : c;
  /* a motor-pool truck waiting to pick the company up counts as a ride to run to, the same as a convoy car */
  if (!v.alive || (!c.isCling && !c.convoy && !((c.pickup || 0) > TIME)) || (s.boardT -= 0.45) <= 0) { if (c.isCling) c.pending = Math.max(0, (c.pending || 1) - 1); s.boardTarget = null; return false; }
  s.goal.copy(v.pos); s.cmdMove = true; s.follow = true;
  if (Math.hypot(s.pos.x - v.pos.x, s.pos.z - v.pos.z) < (v.radius || 3) + 3.5) {
    if (c.isCling) { c.pending = Math.max(0, (c.pending || 1) - 1); c.attach(s); } else { const seat = c.riders.indexOf(null); if (seat >= 0) c.seat(s, seat); }
    s.boardTarget = null;
  }
  return true;
}
function convoyDrive(car, dt) { // hold a slot on the leader: column behind, or line abreast
  const L = CONVOY.leader, k = CONVOY.cars.indexOf(car); if (!L || k < 0) return car.drive(dt, 0, 0, false);
  if ((car.waitT += dt) < 12 && car.riders.filter(Boolean).length < car.expect) return car.drive(dt, 0, 0, false); // wait for everyone running to this car
  const ly = leaderYaw(L), fx = Math.sin(ly), fz = Math.cos(ly), rx = Math.cos(ly), rz = -Math.sin(ly);
  let lat, fwd;
  if (CONVOY.mode === 'abreast') { const side = k % 2 ? 1 : -1, lane = (k >> 1) + 1; lat = side * lane * 15; fwd = -3 - lane * 3; }
  else { lat = CONVOY.shift; fwd = -(k + 1) * (16 + car.len * 0.6) - (L.len || 6) * 0.5; }
  const tx = L.pos.x + rx * lat + fx * fwd, tz = L.pos.z + rz * lat + fz * fwd, dx = tx - car.pos.x, dz = tz - car.pos.z, d = Math.hypot(dx, dz);
  let want = d < 8 ? ly : Math.atan2(dx, dz);
  for (const look of [9, 20]) { _v1.set(car.pos.x + Math.sin(car.yaw) * look, car.pos.y + 1, car.pos.z + Math.cos(car.yaw) * look); if (buildingAt(_v1)) { want = car.yaw + 1.3; break; } }
  const thr = d > 35 ? 1 : d > 12 ? 0.75 : d > 4 ? 0.35 : 0;
  car.driven = true; car.spdMul = d > 40 ? Math.max(car.baseSpd || TR_SPD[car.cap], 1.2) : car.baseSpd || TR_SPD[car.cap]; // squad drivers crash like the player does, and catch up when strung out
  car.drive(dt, thr, clamp(angDiff(car.yaw, want) * 2, -1, 1), d > 70);
}
function releaseConvoy() {
  for (const car of CONVOY.cars) { car.convoy = false; if (car.kind !== 'transport') continue; car.driven = false; car.spdMul = car.baseSpd || TR_SPD[car.cap]; car.speed *= 0.3; car.settleT = 0; for (let i = 0; i < car.cap; i++) if (car.riders[i] && car.riders[i].cmd && !car.riders[i].driverDuty) car.unseat(i); }
  for (const v of CONVOY.escorts || []) { if (v.cabin) v.cabin.dropAll(); v.escortOf = null; if (v.alive && v.kind !== 'fighter') { v.parked = true; v.speed = 0; } } CONVOY.escorts = [];
  let off = 0; for (const ft of CMD.teams) for (const s of ft.m) { s.boardTarget = null; if (s.mount && s.mount.isCling) { s.mount.dismount(s); off++; } }
  if (off && !CONVOY.cars.length) comms('Alpha Lead', 'Everybody off! Form on the Commander!', 'b');
  for (const e of ENTS) if (e.clingRack) e.clingRack.pending = 0;
  if (CONVOY.cars.length) comms('Alpha Lead', 'Convoy halt. Everybody out, form on the Commander!', 'b');
  CONVOY.cars = []; CONVOY.leader = null;
}
function updateConvoy(dt) {
  const L = convoyLeader();
  if (!L) { if (CONVOY.leader) releaseConvoy(); return; }
  if (L !== CONVOY.leader) { const had = CONVOY.leader; CONVOY.leader = L; if (!had) { CONVOY.cars = []; formConvoy(L); } }
  CONVOY.cars = CONVOY.cars.filter(c => c.alive && !c.remove && c.convoy);
  if ((CONVOY.topT = (CONVOY.topT || 0) - dt) <= 0) { CONVOY.topT = 2; topUpClingers(L); }
  for (const v of CONVOY.escorts || []) if (v.alive && v.goal && (v.kind === 'walker' || v.kind === 'shiftframe')) { const k = CONVOY.escorts.indexOf(v), a = leaderYaw(L) + Math.PI + (k - 1.5) * 0.6; v.goal.set(L.pos.x + Math.sin(a) * 30, 0, L.pos.z + Math.cos(a) * 30); v.goalT = 6; if (v.kind === 'shiftframe' && v.mode === 'robot' && v.pos.distanceTo(L.pos) > 60) v.transform(); }
  if ((CONVOY.t -= dt) > 0) return; CONVOY.t = 0.5;
  // where is the threat? average direction to hostiles within 220 m of the leader
  let tx = 0, tz = 0, n = 0;
  for (const e of ENTS) { if (!e.alive || !isHostile(e.team) || !e.hitR) continue; const dx = e.pos.x - L.pos.x, dz = e.pos.z - L.pos.z, d = Math.hypot(dx, dz); if (d > 220 || d < 1) continue; tx += dx / d; tz += dz / d; n++; }
  const ly = leaderYaw(L), ff = tx * Math.sin(ly) + tz * Math.cos(ly), lat = tx * Math.cos(ly) - tz * Math.sin(ly), prev = CONVOY.mode;
  if (n && Math.abs(ff) >= Math.abs(lat)) { CONVOY.mode = 'abreast'; CONVOY.shift = 0; }
  else { CONVOY.mode = 'trail'; CONVOY.shift = n ? Math.sign(lat) * 9 : 0; }
  if (prev !== CONVOY.mode && CONVOY.cars.length && CONVOY.sayT < TIME) { CONVOY.sayT = TIME + 12; comms('Alpha Lead', CONVOY.mode === 'abreast' ? `Contact ${ff > 0 ? 'ahead' : 'behind'}! Line abreast, all guns on them!` : 'Contact on the flank! Column, screen the Commander!', 'b'); }
}
