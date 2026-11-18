'use strict';
/* ===================== IRON MERIDIAN · transports and insertions ===================== */
// Hover transports seat 1–30 (the Commander drives, his squads ride and shoot from the benches).
// Both teams arrive by bus, airdrop or landing craft; the Hero picks his own insertion.

const TR_NAMES = { 1: 'Skiff', 2: 'Dart', 3: 'Rover', 4: 'Ram', 5: 'Mule', 6: 'Bison', 8: 'Hauler', 12: 'Mammoth', 16: 'Colossus', 30: 'Behemoth' };
const TR_SPD = { 1: 1.15, 2: 1.1, 3: 1, 4: 0.95, 5: 0.9, 6: 0.86, 8: 0.8, 12: 0.72, 16: 0.66, 30: 0.56 };
const TR_MAT = [1, 2].reduce((o, t) => (o[t] = { paint: SPD_MAT[t].paint, dark: SPD_MAT[t].dark, gun: SPD_MAT[t].gun, glass: MAT_GLASS, glow: basic(new T.Color(0.6, 1.4, 3.2)) }, o), {});
const TR_GEO = {};
function transportGeo(cap) { // one cached, merged model per seat count: hull tub, cab, benches in rows, hover pads, roof gun
  if (TR_GEO[cap]) return TR_GEO[cap];
  const cols = cap <= 2 ? 1 : cap <= 6 ? 2 : cap <= 16 ? 4 : 6, rows = Math.ceil(Math.max(0, cap - 1) / cols);
  const len = 4 + rows * 1.2 + (cap >= 8 ? 1.2 : 0), wid = Math.max(1.8, cols * 0.9 + 1), hh = cap >= 8 ? 1.4 : 1, y0 = 0.5, b = bucket();
  b.add('paint', xf(rbox(wid, hh, len, 0.3, 2), [0, y0 + hh / 2, 0]));
  b.add('paint', xf(rbox(wid * 0.92, hh * 0.7, 1.6, 0.3, 2), [0, y0 + hh * 0.45, len / 2 + 0.6], [0.35, 0, 0]));
  b.add('dark', xf(rbox(wid + 0.3, 0.35, len + 0.4, 0.12, 1), [0, y0 + 0.1, 0]));
  b.add('dark', xf(rbox(wid * 0.8, 0.9, 1.4, 0.15, 1), [0, y0 + hh + 0.45, len / 2 - 1.1]));
  b.add('glass', xf(new T.PlaneGeometry(wid * 0.72, 0.6), [0, y0 + hh + 0.55, len / 2 - 0.39], [-0.3, 0, 0]));
  for (let r = 0; r < rows; r++) b.add('dark', xf(new T.BoxGeometry(cols * 0.85, 0.3, 0.55), [0, y0 + hh * 0.55, len / 2 - 2.6 - r * 1.2]));
  const pads = Math.max(2, Math.round(len / 3)); for (let i = 0; i < pads; i++) for (const s of [-1, 1]) b.add('dark', xf(new T.CylinderGeometry(0.45, 0.55, 0.4, 12), [s * (wid / 2 + 0.1), y0 - 0.1, -len / 2 + 1 + i * (len - 2) / (pads - 1)]));
  for (const s of [-1, 1]) b.add('gun', xf(new T.BoxGeometry(0.12, 0.12, len - 1.5), [s * (wid / 2 - 0.1), y0 + hh + 0.5, -0.6]));
  if (cap >= 4) { b.add('gun', xf(new T.CylinderGeometry(0.35, 0.4, 0.4, 10), [0, y0 + hh + 1.1, len / 2 - 1.2])); b.add('gun', xf(new T.CylinderGeometry(0.07, 0.07, 1.6, 6), [0, y0 + hh + 1.2, len / 2 - 0.3], [Math.PI / 2, 0, 0])); }
  b.add('glow', xf(new T.BoxGeometry(wid * 0.9, 0.05, len * 0.85), [0, y0 - 0.25, 0]));
  const geos = {}; for (const k of Object.keys(b)) if (k !== 'add') geos[k] = mergeGeos(b[k]);
  const seats = [new V3(cols === 1 ? 0 : -0.35, y0 + hh * 0.55 + 0.25, len / 2 - 1.3)];
  for (let k = 0; k < cap - 1; k++) { const r = (k / cols) | 0, c = k % cols; seats.push(new V3((c - (cols - 1) / 2) * 0.85, y0 + hh * 0.55 + 0.2, len / 2 - 2.6 - r * 1.2)); }
  return (TR_GEO[cap] = { geos, seats, len, wid, hh });
}
const _tq = new V3();
class Transport extends Speeder {
  constructor(cap, team) {
    super(team); const G = transportGeo(cap);
    this.kind = 'transport'; this.cap = cap; this.name = TR_NAMES[cap]; this.seats = G.seats; this.len = G.len; this.wid = G.wid; this.hh = G.hh;
    const r = new T.Group(), body = new T.Group(); r.add(body);
    for (const k in G.geos) { const m = new T.Mesh(G.geos[k], TR_MAT[team][k]); m.castShadow = k === 'paint'; body.add(m); }
    this.obj = r; this.body = body; this.flames = []; this.riders = new Array(cap).fill(null);
    this.radius = Math.max(G.len, G.wid) * 0.5; this.cull = this.radius + 2; this.aimOff = 1; this.maxHp = this.hp = 350 + cap * 110; this.bulletMul = 0.25;
    this.spdMul = TR_SPD[cap]; this.camD = 6 + G.len * 0.75; this.camUp = 3 + G.hh * 1.5; this.settleT = 0;
  }
  local(v, out) { return out.copy(v).applyQuaternion(this.obj.quaternion).add(this.pos); }
  saddle(out, who) { const i = this.riders.indexOf(who); this.local(this.seats[Math.max(0, i)], out); out.y -= 0.3; return out; }
  seat(s, i) {
    if (i === undefined) i = this.riders.indexOf(null, s.isPlayer ? 0 : 1); if (i < 0 || this.riders[i]) return false;
    if (s.mount) s.mount.dismount(s); s.mount = this; s.target = null; s.revTgt = null; this.riders[i] = s; if (s.team) this.team = s.team; this.settleT = 0; return true;
  }
  unseat(i) {
    const s = this.riders[i]; if (!s) return; this.riders[i] = null; s.mount = null;
    const side = i % 2 ? 1 : -1, back = (i / 2 | 0) * 1.4, c = Math.cos(this.yaw), sn = Math.sin(this.yaw), off = this.wid / 2 + 1.4;
    s.pos.set(this.pos.x + c * side * off + sn * (this.len / 2 - 2 - back), 0, this.pos.z - sn * side * off + c * (this.len / 2 - 2 - back)); pushOut(s.pos, 0.6); s.pos.y = surfY(s.pos.x, s.pos.z, this.pos.y);
    if (s.isPlayer) { PLAYER.yaw = this.yaw + Math.PI; PLAYER.vy = 0; PLAYER.camInit = false; this.driven = false; }
  }
  dismount(who) { // the Commander climbing out takes his squads with him
    const lead = who && who.isPlayer && who.alive && who.hp > 0; for (let i = 0; i < this.cap; i++) { const s = this.riders[i]; if (s && !s.driverDuty && (!who || s === who || (lead && s.cmd))) this.unseat(i); }
  }
  boardPlayer(pe) {
    if (this.riders[0] && !this.riders[0].isPlayer) { const ai = this.riders[0]; this.riders[0] = null; this.seat(ai); if (ai.mount !== this) ai.mount = null; }
    this.seat(pe, 0); PLAYER.yaw = this.yaw + Math.PI; PLAYER.camInit = false; snd('ui', null, 0.4);
    let n = 0; for (const ft of CMD.teams) if (ft.mode === 'follow') for (const s of ft.m) { if (this.riders.indexOf(null) < 0) break; if (!s.mount && !s.downed && s.pos.distanceTo(pe.pos) < 70 && this.seat(s)) n++; }
    comms('You', n ? `Mount up! ${n} aboard the ${this.name}.` : `Taking the ${this.name}.`, 'b');
  }
  die(src) {
    for (let i = 0; i < this.cap; i++) { const s = this.riders[i]; if (s) { this.unseat(i); s.damage(s.isPlayer ? 60 : 45, src, 'splash'); } }
    fxExplosion(this.pos, 1.4 + this.cap * 0.07); startTumble(this, this.fwd(_v1), Math.max(6, this.speed * 0.6), 1);
  }
  update(dt) {
    if (!this.alive) { if (this.tumble) tumbleStep(this, dt, this.radius); if (!this.tumble || this.tumble.t > 20) this.remove = true; return; }
    for (let i = 0; i < this.cap; i++) { const s = this.riders[i]; if (s && (!s.alive || s.mount !== this)) this.riders[i] = null; }
    const drv = this.riders[0]; if (drv && drv.isPlayer) return;
    if (this.auto) return this.autopilot(dt);
    if (this.convoy && drv && CONVOY.leader) return convoyDrive(this, dt);
    if (this.motorPool && drv && drv.driverDuty) return motorPoolDrive(this, dt);
    if ((this.settleT += dt) < 3 || this.riders.some(Boolean)) this.drive(dt, 0, 0, false);
  }
  autopilot(dt) { // arrival runs: drive to the drop point, unload, drive back out and despawn
    const a = this.auto, to = a.phase === 'leave' ? a.from : a.to, dx = to.x - this.pos.x, dz = to.z - this.pos.z, d = Math.hypot(dx, dz);
    if (a.phase === 'unload') { this.drive(dt, 0, 0, false); if ((a.t += dt) > 1 && !a.done) { a.done = true; arrivalUnload(this.team, this.pos, a.n, this.name); } if (a.t > 5) a.phase = 'leave'; return; }
    let want = Math.atan2(dx, dz); for (const look of [9, 20]) { _tq.set(this.pos.x + Math.sin(this.yaw) * look, this.pos.y + 1, this.pos.z + Math.cos(this.yaw) * look); if (buildingAt(_tq)) { want = this.yaw + 1.3; break; } }
    this.drive(dt, d > 40 ? 1 : 0.6, clamp(angDiff(this.yaw, want) * 2, -1, 1), false);
    const beached = a.beach && a.phase === 'go' && H(this.pos.x + Math.sin(this.yaw) * this.len, this.pos.z + Math.cos(this.yaw) * this.len) > 0.8;
    if (a.phase === 'go' && (d < 14 || beached)) { a.phase = 'unload'; a.t = 0; this.speed = 0; }
    else if (a.phase === 'leave' && (d < 20 || (a.lt = (a.lt || 0) + dt) > 45)) this.remove = true;
  }
}
function spawnTransport(cap, team, p, yaw) { const t = new Transport(cap, team); t.spawnAt(p, yaw); t.speed = 0; return addEnt(t); }
const nearTransport = pe => pe.pos.y < 300 ? ENTS.find(e => e.kind === 'transport' && e.alive && !e.auto && !isHostile(e.team) && (!e.riders[0] || !e.riders[0].isPlayer) && e.pos.distanceTo(pe.pos) < e.radius + 3) : null;

/* ---------- vehicle depots: small transports at every post and HQ, the 30-seat Behemoths out on the edges ---------- */
const DEPOTS = [];
function depot(cap, x, z, yaw) { _tq.set(x, 0, z); pushOut(_tq, 6); DEPOTS.push({ cap, x: _tq.x, z: _tq.z, yaw, ent: null, t: 99, idle: 0 }); }
/* one truck a district, not a car park: nothing here is rideable by you, and idle vehicles are clutter */
[8, 12, 6, 16, 8].forEach((cap, i) => { const c = CPDEF[i], a = 0.8 + i; depot(cap, c.x + Math.cos(a) * 34, c.z + Math.sin(a) * 34, a); });
[8, 16].forEach((cap, k) => depot(cap, HQ[1].x - 30 + k * 18, HQ[1].z - 75, Math.PI));
for (const [x, z, yaw] of [[-260, 250, 2.4], [255, -140, Math.PI]]) depot(30, x, z, yaw);
{ const z = 400; let x = coastX(z) - 120; while (H(x, z) > 1.2 && x < coastX(z) + 100) x += 4; depot(30, x - 6, z, -Math.PI / 2); } // a landing craft drawn up on the beach

/* ---------- parachutes ---------- */
const CANOPY_G = new T.SphereGeometry(3.2, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2.6).scale(1, 0.55, 1).translate(0, 5.5, 0);
const CANOPY_M = { 1: std(0x3a6a8a, 0.8, 0, { side: T.DoubleSide }), 2: std(0x8a3a2a, 0.8, 0, { side: T.DoubleSide }) };
function showCanopy(s, on) { if (!s.canopy && on) { s.canopy = new T.Mesh(CANOPY_G, CANOPY_M[s.team] || CANOPY_M[1]); s.obj.add(s.canopy); } if (s.canopy) s.canopy.visible = on; }
const CANOPY_FX = []; // landed canopies collapse onto the ground behind the trooper
function paraLand(s) {
  if (s.canopy && s.canopy.visible && CANOPY_FX.length < 24) { const c = new T.Mesh(CANOPY_G, s.canopy.material); c.position.copy(s.pos); c.rotation.y = s.yaw || 0; scene.add(c); CANOPY_FX.push({ c, t: 0, dx: rand(-1.5, 1.5), dz: rand(-1.5, 1.5) }); }
  s.para = false; showCanopy(s, false); fxDust(s.pos, 6, 3, 5);
  if (s.isPlayer) { PLAYER.para = false; PLAYER.free = false; shake(0.35); snd('stomp', null, 0.5); if ((PLAYER.lastLand || 0) < TIME - 20) { PLAYER.lastLand = TIME; comms('You', pick(['Boots on the ground. Company, on me!', 'Down and clear. Form up!', 'Landed. Move to the objective!']), 'b'); } }
}
function updateCanopies(dt) { for (let i = CANOPY_FX.length - 1; i >= 0; i--) { const f = CANOPY_FX[i]; f.t += dt; const k = Math.min(1, f.t / 1.6); f.c.scale.set(1 + k * 0.5, Math.max(0.04, 1 - k), 1 + k * 0.3); f.c.position.x += f.dx * dt; f.c.position.z += f.dz * dt; if (f.t > 6) { scene.remove(f.c); CANOPY_FX.splice(i, 1); } } }

/* ---------- transport planes: paratroop runs ---------- */
const PLANE_GEO = {};
function planeGeo() {
  if (PLANE_GEO.g) return PLANE_GEO.g; const b = bucket();
  b.add('paint', xf(new T.CylinderGeometry(2.6, 2.2, 32, 16), [0, 0, 0], [Math.PI / 2, 0, 0])); b.add('paint', xf(new T.SphereGeometry(2.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), [0, 0, 16], [Math.PI / 2, 0, 0], [1, 1.6, 1]));
  b.add('paint', xf(new T.BoxGeometry(46, 0.6, 7), [0, 1.2, 1])); b.add('paint', xf(new T.BoxGeometry(16, 0.4, 4), [0, 1.6, -14])); b.add('paint', xf(new T.BoxGeometry(0.5, 7, 5), [0, 4.5, -14]));
  for (const x of [-15, -8, 8, 15]) b.add('dark', xf(new T.CylinderGeometry(1, 1.1, 5, 12), [x, 0.2, 2.5], [Math.PI / 2, 0, 0]));
  b.add('glass', xf(new T.BoxGeometry(2.6, 0.8, 2), [0, 1.4, 15])); b.add('dark', xf(new T.BoxGeometry(3.4, 0.3, 6), [0, -2.4, -18.4], [0.45, 0, 0])); b.add('glow', xf(new T.SphereGeometry(0.4, 8, 6), [0, 2.6, -15])); // open tail ramp + jump light
  PLANE_GEO.g = {}; for (const k of Object.keys(b)) if (k !== 'add') PLANE_GEO.g[k] = mergeGeos(b[k]); return PLANE_GEO.g;
}
const PLANES = [];
class Plane {
  constructor(team, from, target, cargo) {
    this.kind = 'plane'; this.team = team; this.alive = true; this.hideRiders = true; this.name = team === 1 ? 'Condor lifter' : 'Vanta hauler'; this.camD = 40; this.camUp = 10;
    this.pos = from.clone(); this.target = target.clone(); this.dir = new V3(target.x - from.x, 0, target.z - from.z).normalize(); this.yaw = Math.atan2(this.dir.x, this.dir.z);
    this.speed = 115; this.riders = []; this.cargo = cargo || 0; this.jumped = false;
    this.obj = new T.Group(); const G = planeGeo(); for (const k in G) { const m = new T.Mesh(G[k], TR_MAT[team][k]); m.castShadow = k === 'paint'; this.obj.add(m); }
    scene.add(this.obj); PLANES.push(this);
  }
  saddle(out) { return out.set(this.pos.x, this.pos.y - 2.5, this.pos.z); }
  board(s) { if (s.mount) s.mount.dismount(s); s.mount = this; s.target = null; this.riders.push(s); if (s.isPlayer) s.obj.visible = false; }
  dismount(who) { if (who) { this.riders = this.riders.filter(r => r !== who); who.mount = null; who.obj.visible = true; } }
  jump() {
    if (this.jumped) return; this.jumped = true; const side = new V3(this.dir.z, 0, -this.dir.x);
    this.riders.forEach((s, i) => {
      s.mount = null; s.obj.visible = true; s.pos.copy(this.pos).addScaledVector(this.dir, -19 - i * 2.4).addScaledVector(side, rand(-2, 2)); s.pos.y -= 3 + i * 0.6; // out of the tail ramp in a stream
      if (s.isPlayer) { PLAYER.para = false; PLAYER.free = true; PLAYER.grounded = false; PLAYER.vy = -3; PLAYER.camInit = false; showCanopy(s, false); } else { s.para = true; s.goal.set(this.target.x + rand(-25, 25), 0, this.target.z + rand(-25, 25)); }
    });
    for (let i = 0; i < this.cargo; i++) { const s = new Soldier(this.team); s.spawnAt(this.pos); s.pos.copy(this.pos).addScaledVector(this.dir, -i * 2.5).addScaledVector(side, rand(-5, 5)); s.pos.y -= 4; s.para = true; s.goal.set(this.target.x + rand(-30, 30), 0, this.target.z + rand(-30, 30)); showCanopy(s, true); addEnt(s); }
    if (this.riders.some(s => s.isPlayer)) comms('Condor lifter', 'Green light! Go, go, go!', 'b'); else if (this.team === 1) comms(null, `Paratroopers dropping over ${nearestPostName(this.pos)}.`, 'cmd'); else if (Math.random() < 0.5) comms(null, 'Enemy paratroopers in the air!', 'cmd');
    this.riders = []; snd('ui', null, 0.3);
  }
  update(dt) {
    this.pos.addScaledVector(this.dir, this.speed * dt); this.obj.position.copy(this.pos); this.obj.rotation.set(0, this.yaw, Math.sin(TIME * 0.7) * 0.04);
    const ahead = (this.target.x - this.pos.x) * this.dir.x + (this.target.z - this.pos.z) * this.dir.z;
    if (!this.jumped && (ahead < 10 && (this.cargo || !this.riders.some(s => s.isPlayer)) || ahead < -140)) this.jump();
    if (Math.abs(this.pos.x) > BOUND + 700 || Math.abs(this.pos.z) > BOUND + 700) { this.alive = false; scene.remove(this.obj); }
  }
}
const nearestPostName = p => { let b = CPS[0], bd = 1e9; for (const c of CPS) { const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < bd) { bd = d; b = c; } } return b.name; };

function deckSoldier(L, team, edge, deck) { /* L is vestigial: the structures that owned these decks are gone */
  const s = new Soldier(team); s.squad = { m: [s], lead: null }; s.deck = deck; s.noRequeue = true; s.marine = true; /* platform and ship crews: paid from the reserve, but not capped like field troops */
  const a = rand(0, 6.28), r = edge ? deck.r - 3 : rand(3, deck.r * 0.6); s.spawnAt(new V3(deck.x + Math.cos(a) * r, 0, deck.z + Math.sin(a) * r)); s.pos.y = deck.y; addEnt(s);
  if (edge) { flashLight(_tq.copy(s.pos).setY(deck.y + 1.5), 3, 20, 0.3, 0xffaa66); fxSparks(_tq, 8, [3, 2, 1], 8); }
  return s;
}
function cmdJump(pe) { // the company follows its Commander off the jump gate
  let i = 0;
  for (const ft of CMD.teams) if (ft.mode === 'follow') for (const s of ft.m) {
    if (s.mount || s.downed || s.pos.y < 100 || !deckAt(s.pos.x, s.pos.z, s.pos.y) || Math.hypot(s.pos.x - pe.pos.x, s.pos.z - pe.pos.z) > 70) continue;
    const k = i++; s.pos.set(pe.pos.x + rand(-6, 6), s.pos.y - 6 - k * 1.5, pe.pos.z + rand(-6, 6)); s.para = true; s.target = null; s.goal.set(pe.pos.x + rand(-20, 20), 0, pe.pos.z + rand(-20, 20)); // they leap in a stream behind you
  }
  if (i) comms('Alpha Lead', 'Company, follow the Commander. Go, go, go!', 'b');
}
/* The space elevators are gone with everything that hung off them — the tether cars, the Orbital Dock, the Space Port
   and its ring of platforms, the jump gate and the launch pads. Heroes fly, and the Villains ride their own hulls up. */

/* ---------- arrivals: reinforcements reach the war by bus, airdrop and landing craft ---------- */
const ARRIVAL = { pool: { 1: 0, 2: 0 }, t: { 1: 18, 2: 25 }, wait: { 1: 0, 2: 0 } };
function arrivalUnload(team, p, n, by) {
  for (let i = 0; i < n; i++) { const s = new Soldier(team); const a = i * 0.8; s.spawnAt(new V3(p.x + Math.cos(a) * (3 + i * 0.3), 0, p.z + Math.sin(a) * (3 + i * 0.3))); addEnt(s); }
  if (team === 1 && Math.random() < 0.6) comms(by, `${n} troops off the ${by} near ${nearestPostName(p)}. Moving to the line.`, 'b');
}
function arrivalTarget(team) { const own = CPS.filter(c => c.owner === team && c.realm === 'land'); const c = own.length ? pick(own) : null; return c ? new V3(c.x + rand(-25, 25), 0, c.z + (team === 1 ? 45 : -45)) : new V3(HQ[team].x + rand(-30, 30), 0, HQ[team].z); }
function launchArrival(team, mode, n, to = arrivalTarget(team)) {
  const edgeZ = team === 1 ? BOUND - 15 : -BOUND + 15;
  if (mode === 'air') { new Plane(team, new V3(to.x + rand(-200, 200), 225, team === 1 ? BOUND + 250 : -BOUND - 250), to, n); return; }
  if (mode === 'sea') { const z = team === 1 ? rand(120, 420) : rand(-460, -200); const from = new V3(coastX(z) + 120, 0, z); const t = spawnTransport(30, team, from, -Math.PI / 2); t.auto = { phase: 'go', from, to: new V3(coastX(z) - 80, 0, z), n, beach: true }; return; }
  const from = new V3(rand(-200, 120), 0, edgeZ); const t = spawnTransport(n > 12 ? 30 : 16, team, from, team === 1 ? Math.PI : 0); t.auto = { phase: 'go', from, to, n };
}
function updateArrivals(dt) {
  if (GAME.state === 'menu' && GAME.clock < 5) return;
  for (const team of [1, 2]) {
    ARRIVAL.wait[team] += dt; if ((ARRIVAL.t[team] -= dt) > 0) continue; ARRIVAL.t[team] = 10;
    const n = ARRIVAL.pool[team]; if (n < 6 && !(n > 0 && ARRIVAL.wait[team] > 35)) continue;
    const k = Math.min(n, 16); ARRIVAL.pool[team] -= k; ARRIVAL.wait[team] = 0; launchArrival(team, pick(['bus', 'bus', 'air', 'air', 'sea', 'orbit']), k);
  }
}

/* ---------- the Commander's side: driving, interacting, insertions ---------- */
function mountCtl(dt, dx, dy) {
  const P = PLAYER, e = P.ent, m = e.mount;
  P.yaw -= dx; P.pitch = clamp(P.pitch - dy, -0.9, 0.6);
  if (m.kind === 'transport') {
    if (m.riders[0] !== e) { P.fireCd -= dt; if (m.cap >= 4 && mouse.b[0] && P.fireCd <= 0) { P.fireCd = 0.14; const r = rayCast(camera.position, camDir(_v5).clone(), 700, m, 1); m.local(_tq.set(0, m.hh + 1.7, m.len / 2 - 0.2), _v1); fireProj({ from: _v1, to: r.point, speed: 600, kind: 'bolt', team: 1, src: e, dmg: 26, splash: 1.5, w: 0.14, len: 5, color: TEAM[1].laser, fx: 0.6 }); snd('laser', _v1, 0.25); } return; } // riding in the back: man the roof gun
    const { f, s } = axis(); m.driven = true; m.drive(dt, f, -s, keys.ShiftLeft || keys.ShiftRight); if (!m.alive) return;
    if (Math.abs(dx) < 1e-4 && Math.abs(m.speed) > 4) P.yaw = angLerp(P.yaw, m.yaw + Math.PI, dt * 1.2);
    P.fireCd -= dt;
    if (m.cap >= 4 && mouse.b[0] && P.fireCd <= 0) { P.fireCd = 0.14; const r = rayCast(camera.position, camDir(_v5).clone(), 700, m, 1); m.local(_tq.set(0, m.hh + 1.7, m.len / 2 - 0.2), _v1); fireProj({ from: _v1, to: r.point, speed: 600, kind: 'bolt', team: 1, src: e, dmg: 34, splash: 1.8, w: 0.16, len: 6, color: TEAM[1].laser, fx: 0.55 }); fxMuzzle(_v1, [1.2, 2.4, 4]); snd('laser', null, 0.25); if (r.ent) cmdFocus(r.ent); }
    for (const t of ENTS) { if (!t.alive || !isHostile(t.team) || t.kind !== 'soldier' || t.pos.distanceTo(m.pos) > m.radius + 1) continue; if (Math.abs(m.speed) > 8) t.damage(Math.abs(m.speed) * 6, e, 'ram'); }
  } else if (m.kind === 'plane' && keys.Space) { keys.Space = false; m.jump(); }
}
function mountHint(pe) {
  if (pe.kind !== 'soldier') return null; const m = pe.mount;
  if (m && m.kind === 'escalator') return `${m.name} · riding ${(m.trips.get(pe) || {}).dir > 0 ? 'up to the ring' : 'down to the Space Port'}`;
  if (m) return m.kind === 'transport' ? `${m.name} · ${m.riders.filter(Boolean).length}/${m.cap} aboard` : m.kind === 'plane' ? 'Over the drop zone · SPACE to jump' : null;
  if (PLAYER.para) return 'Parachute open · steer with WASD';
  if (PLAYER.free) return 'Freefall · SPACE to open your parachute';
  return null;
}
/* insertion: the Commander always arrives by drop pod (main.js spawnPlayer); there is no other way in */
function updateTransports(dt) {
  updateCanopies(dt);
  for (let i = PLANES.length - 1; i >= 0; i--) { PLANES[i].update(dt); if (!PLANES[i].alive) PLANES.splice(i, 1); }
  updateArrivals(dt);
  if ((DEPOTS.t = (DEPOTS.t || 0) - dt) > 0) return; DEPOTS.t = 1;
  const pe = PLAYER.ent;
  for (const d of DEPOTS) {
    const e = d.ent;
    if (!e || !e.alive || e.remove) { if ((d.t += 1) > 30 && camera.position.distanceTo(_tq.set(d.x, groundY(d.x, d.z), d.z)) > 70) { d.ent = d.bike ? spawnBike(d.bike, 1, _tq.clone(), d.yaw) : spawnTransport(d.cap, 1, _tq, d.yaw); d.t = 0; } continue; }
    const busy = e.riders ? e.riders.some(Boolean) : e.isPlayer || !e.parked, far = Math.hypot(e.pos.x - d.x, e.pos.z - d.z) > 80, seen = pe && pe.alive && pe.pos.distanceTo(e.pos) < 140;
    d.idle = !busy && far && !seen ? d.idle + 1 : 0; if (d.idle > 45) { e.remove = true; d.t = 31; }
  }
  for (const e of ENTS) if (e.kind === 'transport' && e.temp && e.alive) { if (e.riders.some(Boolean)) e.tmpT = 0; else if ((e.tmpT = (e.tmpT || 0) + 1) > 90) e.remove = true; }
}
