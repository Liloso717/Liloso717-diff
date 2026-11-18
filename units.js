'use strict';
/* ===================== IRON MERIDIAN · units ===================== */
const ENTS = [];
const NAMES = {
  1: { soldier: ['Alpha', 'Bravo', 'Charlie', 'Delta'], tank: 'Mako', walker: 'Bulwark', gunship: 'Warden', fighter: 'Lancer', dropship: 'Pelican', naval: ['MCS Halberd', 'MCS Tideguard', 'MCS Resolute'], capital: ['MCS Aurelian', 'MCS Constance', 'MCS Indomitable'] },
  2: { soldier: ['Vex', 'Rook', 'Talon', 'Scald'], tank: 'Scourge', walker: 'Ravager', gunship: 'Harrow', fighter: 'Hex', dropship: 'Carrion', naval: ['VDS Gorgon', 'VDS Malice', 'VDS Undertow'], capital: ['VDS Sovereign Ash', 'VDS Nightfall', 'VDS Iron Wake'] },
};
NAMES[4] = { soldier: ['Cinder', 'Pyre', 'Ember', 'Slag'] }; NAMES[5] = { soldier: ['Thorn', 'Moss', 'Briar', 'Fern'] };
const nameCount = {};
function callsign(team, kind) {
  if (!NAMES[team] || !NAMES[team][kind]) return kind; const key = team + kind; nameCount[key] = (nameCount[key] || 0) + 1; const n = nameCount[key]; const N = NAMES[team][kind];
  if (kind === 'soldier') return `${N[(n - 1) % 4]} ${Math.ceil(n / 4)}-${((n - 1) % 4) + 1}`;
  if (Array.isArray(N)) return N[(n - 1) % N.length];
  return `${N} ${n}`;
}

class Ent {
  constructor(kind, team) {
    this.kind = kind; this.team = team; this.pos = new V3(); this.vel = new V3(); this.alive = true; this.hp = this.maxHp = 100;
    this.radius = 1; this.hitR = true; this.cull = 4; this.aimOff = 0; this.bulletMul = 1; this.isPlayer = false; this.remove = false; this.obj = null;
    this.name = callsign(team, kind);
  }
  aim(out) { return out.copy(this.pos).setY(this.pos.y + this.aimOff); }
  surfDist(p) { this.aim(_v4); return p.distanceTo(_v4) - this.radius; }
  damage(a, src, type) {
    if (!this.alive) return;
    if (this.spawnGuard > TIME && type !== 'crash') return;
    if (type === 'bullet') a *= this.bulletMul;
    if (src && src.team === this.team && src !== this) return;
    let crit = false; if (src && src.isPlayer && src !== this && (type === 'bullet' || type === 'bolt' || type === 'blade') && Math.random() < 0.13) { a *= 2.2; crit = true; }
    const kill = this.hp - a <= 0;
    this.hp -= a; this.lastHitBy = src; this.hurtT = 0.4;
    if (this.isPlayer && type !== 'crash') onPlayerHurt(a, src);
    if (src && src.isPlayer && src !== this) { if (type === 'bullet' && this.bulletMul < 0.1) dmgNumber(this, 0, false, 'armor'); else if (a > 0) { hitMarker(false); if (myShot(src, type)) dmgNumber(this, a, kill, crit ? 'crit' : undefined); if (crit) { snd('crit', null, 0.4); fxSparks(this.aim(_v4), 10, [4, 2.6, 0.6], 10); } } }
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.killed(src, type); }
  }
  killed(src, type) {
    const how = type === 'bullet' ? 'rifle' : type === 'missile' ? 'missile' : type === 'orbital' ? 'orbital' : type === 'shell' ? 'shell' : type === 'crash' ? 'crashed' : type === 'blade' ? 'blade' : type === 'ram' ? 'rammed' : 'laser';
    const big = this.kind !== 'soldier';
    if (src && src.isPlayer && src !== this) { PLAYER.kills++; onPlayerKill(this, type); hitMarker(true); awardPoints(this.kind === 'soldier' ? 100 : this.kind === 'walker' ? 500 : this.kind === 'naval' ? 600 : 250, this.kind === 'soldier' ? 'Enemy killed' : 'Vehicle destroyed'); }
    if (big || (src && src.isPlayer) || this.isPlayer || Math.random() < 0.3) killFeed(src && src !== this ? src : null, this, how, (src && src.isPlayer) || this.isPlayer);
    if (this.isPlayer) { if (PLAYER.hero && PLAYER.ent === this) hopOff(true); else onPlayerDeath(src); } // a destroyed ride throws the Commander clear
    this.die(src);
  }
  die() { }
  update() { }
}
function addEnt(e) { ENTS.push(e); if (e.obj) scene.add(e.obj); return e; }

/* a 96 m grid of everything shootable, rebuilt once a frame: target picking is the most-called search in the game
   (dozens of times a frame across the armies), and without it every call walks all ~280 units on the island */
const E_GRID = { c: 96, map: new Map(), t: -1 };
function entGrid() {
  if (E_GRID.t === TIME) return E_GRID.map;
  E_GRID.t = TIME; const m = E_GRID.map; m.clear();
  for (const e of ENTS) {
    if (!e.alive || !e.hitR || e.kind === 'shieldgen' || e.kind === 'capital') continue;
    const k = Math.floor(e.pos.x / 96) * 8192 + Math.floor(e.pos.z / 96); let L = m.get(k); if (!L) m.set(k, L = []); L.push(e);
  }
  return m;
}
function findTarget(self, range, pred) {
  let best = null, bd = range * range; const p = self.pos, m = entGrid();
  const i0 = Math.floor((p.x - range) / 96), i1 = Math.floor((p.x + range) / 96), j0 = Math.floor((p.z - range) / 96), j1 = Math.floor((p.z + range) / 96);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const L = m.get(i * 8192 + j); if (!L) continue;
    for (const e of L) {
      if (e.team === self.team) continue;
      const dx = e.pos.x - p.x, dy = e.pos.y - p.y, dz = e.pos.z - p.z, d = dx * dx + dy * dy + dz * dz; /* range first: the predicate is a call, the distance is three subtractions */
      if (d >= bd) continue;
      if (pred && !pred(e)) continue;
      bd = d; best = e;
    }
  }
  return best;
}
const isGroundVeh = e => e.kind === 'transport' || e.kind === 'tank' || e.kind === 'walker' || e.kind === 'speeder' || e.kind === 'shiftframe' || e.kind === 'monster' || e.kind === 'bird';
const isAir = e => e.kind === 'fighter' || e.kind === 'gunship' || e.kind === 'dropship';

const _bHit = [];
function explodeDamage(p, radius, dmg, src, team, skip) {
  p = p.clone(); // deaths (and nested blasts) inside the loop may rewrite the caller's scratch vector
  const st = src ? src.team : team;
  for (const e of ENTS) {
    if (!e.alive || e === skip || !e.hitR) continue; if (st && e.team === st) continue;
    const dx = e.pos.x - p.x, dz = e.pos.z - p.z; if (dx * dx + dz * dz > (radius + e.cull + 10) ** 2) continue;
    const sd = e.surfDist(p); if (sd < radius) e.damage(dmg * Math.sqrt(1 - Math.max(0, sd) / radius), src, 'splash');
  }
  bldCell(p.x, p.z); for (const b of bldNear(p.x, p.z, radius, _bHit)) { /* only the buildings the blast can reach */
    if (!b.alive) continue;
    const cx = clamp(p.x, b.x0, b.x1), cz = clamp(p.z, b.z0, b.z1), cy = clamp(p.y, b.gy, b.top);
    const d = Math.hypot(p.x - cx, p.y - cy, p.z - cz); if (d < radius) b.damage(dmg * 0.6 * (1 - d / radius), src);
  }
}

/* ---------------- command posts ---------------- */
const CPS = CPDEF.map(d => {
  const g = new T.Group(); const y = groundY(d.x, d.z); g.position.set(d.x, y, d.z);
  const base = new T.Mesh(new T.CylinderGeometry(6, 7, 0.8, 8), std(0x2a2b2d, 0.7, 0.5)); base.position.y = 0.4; base.receiveShadow = true; g.add(base);
  const pole = new T.Mesh(new T.BoxGeometry(0.5, 16, 0.5), MAT_GUN); pole.position.y = 8; pole.castShadow = true; g.add(pole);
  const flag = new T.Mesh(new T.PlaneGeometry(6, 3.4), basic(0xffffff, { side: T.DoubleSide })); flag.position.set(3.2, 14, 0); g.add(flag);
  const ring = new T.Mesh(new T.RingGeometry(27, 28.2, 72).rotateX(-Math.PI / 2), addMat(0xffffff, 0.55, { side: T.DoubleSide })); ring.position.y = 0.6; g.add(ring);
  const pillar = new T.Mesh(new T.CylinderGeometry(2.2, 2.2, 260, 12, 1, true).translate(0, 130, 0), new T.ShaderMaterial({
    uniforms: { color: { value: new T.Color(1, 1, 1) } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
    vertexShader: `varying float vY; void main(){ vY=position.y/260.; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 color; varying float vY; void main(){ float a=pow(1.-vY,2.5)*.55; gl_FragColor=vec4(color*a,1.); ${OUT} }`
  })); pillar.renderOrder = 5; g.add(pillar);
  scene.add(g);
  return Object.assign({}, d, { pos: new V3(d.x, y, d.z), owner: d.owner, start: d.owner, prog: d.owner === 1 ? 1 : d.owner === 2 ? -1 : 0, g, flag, ring, pillar, contested: false, nb: 0, nr: 0 });
});
function cpColor(cp) { return { 1: [0.4, 1.0, 1.8], 2: [1.9, 0.45, 0.2], 4: [2.0, 1.25, 0.25], 5: [0.45, 1.8, 0.6] }[cp.owner] || [1.1, 1.0, 0.85]; }
function refreshCP(cp) { const c = cpColor(cp); cp.flag.material.color.setRGB(c[0], c[1], c[2]); cp.ring.material.color.setRGB(c[0] * 0.6, c[1] * 0.6, c[2] * 0.6); cp.pillar.material.uniforms.color.value.setRGB(c[0] * 0.5, c[1] * 0.5, c[2] * 0.5); }
CPS.forEach(refreshCP);
// four-army capture: whichever army has the most troops on a post pushes its claim; anyone else holding it is
// neutralised first. cp.holder/cp.k is the claim; cp.prog keeps the old signed view (+ Meridian, − Vanta) for the HUD.
const CP_N = { 1: 0, 2: 0, 4: 0, 5: 0 };
for (const cp of CPS) { cp.holder = cp.owner; cp.k = cp.owner ? 1 : 0; }
/* one pass over the units, not one per district: with ten districts the old loop tested every soldier ten times */
const CP_TALLY = CPS.map(() => ({ 1: 0, 2: 0, 4: 0, 5: 0 }));
function updateCPs(dt) {
  for (const T of CP_TALLY) { T[1] = 0; T[2] = 0; T[4] = 0; T[5] = 0; }
  for (const e of ENTS) {
    if (!e.alive || e.downed || !e.hitR || CP_N[e.team] === undefined) continue;
    const k = e.kind; if (k !== 'soldier' && k !== 'walker' && k !== 'tank' && k !== 'shiftframe') continue;
    for (let i = 0; i < CPS.length; i++) {
      const cp = CPS[i], dx = e.pos.x - cp.x, dz = e.pos.z - cp.z;
      if (dx * dx + dz * dz < 784 && (cp.realm === 'land' || Math.abs(e.pos.y - cp.pos.y) < 25)) { CP_TALLY[i][e.team] += e.isPlayer ? 4 : 1; break; }
    }
  }
  for (let ci = 0; ci < CPS.length; ci++) {
    const cp = CPS[ci], T = CP_TALLY[ci];
    CP_N[1] = T[1]; CP_N[2] = T[2]; CP_N[4] = T[4]; CP_N[5] = T[5];
    let top = 0, topN = 0, second = 0; for (const t of ARMIES) { const n = CP_N[t]; if (n > topN) { second = topN; topN = n; top = t; } else if (n > second) second = n; }
    cp.nb = CP_N[1]; cp.nr = topN && top !== 1 ? topN : Math.max(CP_N[2], CP_N[4], CP_N[5]); cp.contested = topN > 0 && second > 0;
    const net = topN - second; if (!top || net <= 0) continue;
    const before = cp.owner, prev = cp.prog, rate = Math.min(net * 0.05, 0.22) * dt;
    if (!cp.holder || cp.holder === top) { cp.holder = top; cp.k = Math.min(1, cp.k + rate); if (cp.k >= 1) cp.owner = top; }
    else { cp.k -= rate; if (cp.k <= 0) { cp.k = 0; cp.holder = top; if (cp.owner && cp.owner !== top) cp.owner = 0; } }
    cp.prog = cp.holder === 1 ? cp.k : cp.holder ? -cp.k : 0; capTick(cp, prev);
    if (before !== cp.owner) {
      refreshCP(cp);
      if (cp.owner) {
        const mine = cp.owner === 1, T2 = TEAM[cp.owner];
        comms(null, mine ? `${cp.name} secured. Dig in and hold it.` : before === 1 ? `We've lost ${cp.name} to the ${T2.short}! Retake that post!` : `The ${T2.name} has taken ${cp.name}.`, 'cmd');
        banner(mine ? `${cp.name} captured` : `${cp.name} · ${T2.short}`, `${cp.tag} · ${T2.name} control`, TEAM_CSS[cp.owner]);
        snd('ui', null, 0.6);
        const pe = PLAYER.ent; if (mine && pe && pe.alive && pe.pos.distanceTo(cp.pos) < 30) { PLAYER.caps++; awardPoints(200, 'Post captured'); orderEvent('cap'); }
      } else comms(null, `${cp.name} neutralised.`, 'cmd');
    }
  }
}
const STEALTH = { player: 0 }; // > 0 while the Commander is hidden by a sand gust or foundry steam
function pickThreat(s, R) {
  let t = s.heavy ? (findTarget(s, R, e => isGroundVeh(e) || e.kind === 'gunship' || e.kind === 'dropship') || findTarget(s, R * 0.7, e => e.kind === 'soldier')) : (findTarget(s, R, e => e.kind === 'soldier') || findTarget(s, R * 0.7, isGroundVeh));
  const hb = s.lastHitBy; if (!t && hb && hb.alive && hb.hitR && hb.team !== s.team && hb.pos && hb.pos.distanceTo(s.pos) < 160) t = hb; // shot at: answer back
  if (t && t.isPlayer && isHostile(s.team) && t !== s.target && AGGRO.n >= AGGRO.max) t = findTarget(s, R, e => !e.isPlayer && (e.kind === 'soldier' || isGroundVeh(e))); // only a few hunt the player at once
  if (t && t.isPlayer && STEALTH.player > 0 && t.pos.distanceTo(s.pos) > 16) t = findTarget(s, R, e => !e.isPlayer && (e.kind === 'soldier' || isGroundVeh(e))); // lost him in the murk
  return t;
}
/* how many of an army are already heading for each post: counted once a frame, not once per asking soldier */
const CROWD_N = { n: -1, m: new Map() };
function cpCrowd(team, cp) {
  if (CROWD_N.n !== FRAMEN) { CROWD_N.n = FRAMEN; const m = CROWD_N.m; m.clear(); for (const e of ENTS) if (e.alive && e.goalCP) { const k = e.team * 64 + CPS.indexOf(e.goalCP); m.set(k, (m.get(k) || 0) + 1); } }
  return CROWD_N.m.get(team * 64 + CPS.indexOf(cp)) || 0;
}
function pickObjective(team, pos) {
  let best = null, bs = -1;
  for (const cp of CPS) {
    const w = (cp.owner !== team ? 3 : (cp.contested || cp.holder !== team || cp.k < 0.9) ? 2.4 : 0.7) * (cp.front ? 2.2 : 1) * (team < 4 ? 1 : cp.realm === 'air' ? 2 : cp.owner > 3 && cp.owner !== team ? 1.4 : 1); /* the new armies are drawn to the Skyport, where all four collide, and to each other's districts */
    const crowd = cpCrowd(team, cp);
    const d = Math.hypot(cp.x - pos.x, cp.z - pos.z); const s = w / (d + 260) / (1 + crowd * 0.22) * rand(0.5, 1.5);
    if (s > bs) { bs = s; best = cp; }
  }
  return best;
}

/* ---------------- squads: wedge formations behind a squad leader ---------------- */
const SQUADS = { 1: [], 2: [], 4: [], 5: [] }; const WEDGE = [[-3.5, -3.5], [3.5, -3.5], [-7, -7], [7, -7], [0, -9]];
function squadLeader(sq) { return sq.m.find(x => x.alive && !x.remove && !x.mount && !x.isPlayer) || null; }
function joinSquad(s) { let sq = SQUADS[s.team].find(q => { q.m = q.m.filter(x => x.alive && !x.remove); return q.m.length < 5; }); if (!sq) { sq = { m: [], lead: null }; SQUADS[s.team].push(sq); } sq.m.push(s); s.squad = sq; }
/* ---------------- soldier ---------------- */
const MEDIC_G = mergeGeos([new T.BoxGeometry(0.06, 0.18, 0.02), new T.BoxGeometry(0.18, 0.06, 0.02)]), MEDIC_M = basic(new T.Color(0.6, 3.2, 1.2));
const BEACON_G = new T.SphereGeometry(0.12, 8, 6), BEACON_M = basic(new T.Color(4, 0.4, 0.3));
class Soldier extends Ent {
  constructor(team, hero) {
    super('soldier', team); this.maxHp = this.hp = hero ? 160 : 100; this.hero = !!hero; this.radius = 0.75; this.aimOff = 1.15; this.cull = 2;
    const r = Math.random(); this.heavy = !hero && r < 0.18; this.medic = !hero && !this.heavy && r < 0.42;
    this.pers = { spd: rand(0.82, 1.18), range: rand(22, 70), aggr: Math.random(), crouchy: rand(0.1, 0.6), jit: new V3(rand(-2.5, 2.5), 0, rand(-2.5, 2.5)), jitT: rand(1, 5), lag: rand(0.6, 2.2) }; this.melee = 0;
    Object.assign(this, { yaw: 0, faceYaw: 0, phase: Math.random() * 6, cool: rand(0, 1), burst: 4, think: 0, goal: new V3(), goalCP: null, goalT: 0, deadT: 0, stuckT: 0, lastPos: new V3(), detourT: 0, detourA: 0, strafeT: 0, strafeDir: 1, crouch: false, moveSpeed: 0, aimP: 0, kick: 0, idleT: 0, chaseT: 0, lastSeen: new V3(), revT: 0 });
    if (hero) { const Hm = buildHeroModel(); this.heroParts = Hm; this.obj = Hm.root; this.body = Hm.body; this.radius = 0.8; }
    else { const tm = buildTrooperModel(team, this.heavy); this.obj = tm.root; this.body = tm.body; this.legs = tm.legs; if (this.medic) { const mk = new T.Mesh(MEDIC_G, MEDIC_M); mk.position.set(0, 1.42, -0.3); mk.rotation.y = Math.PI; this.body.add(mk); } }
  }
  muzzle(out) { const s = Math.sin(this.yaw), c = Math.cos(this.yaw); if (this.hero) return out.set(this.pos.x - 0.42 * c + 0.55 * s, this.pos.y + 1.22 + (this.crouch ? -0.35 : 0), this.pos.z + 0.42 * s + 0.55 * c); return out.set(this.pos.x + 0.07 * c + 0.95 * s, this.pos.y + 1.35 + (this.crouch ? -0.36 : 0), this.pos.z - 0.07 * s + 0.95 * c); }
  spawnAt(p) { this.pos.copy(p); this.pos.y = groundY(p.x, p.z); this.lastPos.copy(this.pos); this.obj.position.copy(this.pos); if (!this.hero && !this.squad && !this.cmd) joinSquad(this); }
  pickGoal() { if (this.deck) { const d = this.deck, a = Math.random() * 6.28, r = rand(0, d.r - 4); this.goalCP = null; this.goal.set(d.x + Math.cos(a) * r, 0, d.z + Math.sin(a) * r); this.goalT = rand(6, 14); return; } this.goalCP = pickObjective(this.team, this.pos); const a = Math.random() * 6.28, r = rand(3, 22); this.goal.set(this.goalCP.x + Math.cos(a) * r, 0, this.goalCP.z + Math.sin(a) * r); this.goalT = rand(14, 30); }
  damage(a, src, type) {
    if (this.downed) return;
    const real = type === 'bullet' ? a * this.bulletMul : a;
    if (!this.isPlayer && !this.hero && this.alive && this.hp - real <= 0 && real < 160 && Math.random() < 0.6 && !(src && src.team === this.team && src !== this)) {
      this.hp = 1; this.downed = true; this.hitR = false; this.downT = 0; this.downBy = src; this.downType = type; this.target = null; this.obj.rotation.order = 'YXZ';
      if (src && src.isPlayer) { hitMarker(true); if (myShot(src, type)) dmgNumber(this, real, true); awardPoints(50, 'Enemy downed'); }
      if (this.team === 1 && Math.random() < 0.25) comms(this.name, pick(["I'm hit! Need a medic!", 'Man down! Medic!', "Can't feel my legs! Medic!"]), 'b');
      return;
    }
    super.damage(a, src, type);
  }
  revive(by) {
    this.downed = false; this.hitR = true; this.hp = 55; this.reviver = null; this.hurtT = 0; if (this.beacon) this.beacon.visible = false;
    for (let i = 0; i < 16; i++) FXA.spawn(this.pos.x + rand(-0.6, 0.6), this.pos.y + rand(0, 1.5), this.pos.z + rand(-0.6, 0.6), 0, rand(1, 3), 0, rand(0.6, 1.2), 0.35, 0.1, 0.5, 3, 1.2, 0.2, 1, 0.4, 1, 0, 0);
    flashLight(_v1.copy(this.pos).setY(this.pos.y + 1), 2.5, 10, 0.5, 0x40ff80);
    if (by.isPlayer) awardPoints(100, 'Revive'); else if (by.team === 1 && Math.random() < 0.35) comms(by.name, pick([`${this.name} is back up!`, 'Got you. Back in the fight!', 'Patched. Move, move!']), 'b');
  }
  die(src) {
    if (this.mount) this.mount.dismount(this); if (this.reviver) this.reviver = null; if (this.beacon) this.beacon.visible = false;
    const sq = this.squad; if (sq && sq.lead === this) { const n = squadLeader(sq); sq.lead = n; if (n && this.team === 1 && Math.random() < 0.5) comms(n.name, 'Squad lead is down! I have point, form on me!', 'b'); }
    this.deadT = 0; this.obj.rotation.order = 'YXZ'; fxSparks(_v1.copy(this.pos).setY(this.pos.y + 1.2), 4, [2, 1, 0.5], 5);
    if (!this.isPlayer && !this.cmd && !this.deck && !this.noRequeue) SPAWNER.queue('soldier', this.team, 6);
  }
  update(dt) {
    if (!this.alive) {
      this.deadT += dt; const t = Math.min(1, this.deadT * 2.8);
      this.obj.rotation.x = Math.min(this.obj.rotation.x, -t * 1.5); this.body.position.y = 0; this.obj.position.copy(this.pos);
      if (this.deadT > 7) this.obj.position.y -= (this.deadT - 7) * 0.8;
      if (this.deadT > 9) this.remove = true; return;
    }
    if (this.downed) {
      this.downT += dt; this.obj.position.copy(this.pos); this.obj.rotation.set(-Math.min(1, this.downT * 3) * 1.45, this.yaw, Math.sin(this.downT * 2.5) * 0.06);
      if (!this.beacon) { this.beacon = new T.Mesh(BEACON_G, BEACON_M); this.beacon.position.set(0, 0.35, 0); this.obj.add(this.beacon); }
      this.beacon.visible = !this.reviver && Math.sin(TIME * 8) > 0;
      if (this.reviver && (!this.reviver.alive || this.reviver.downed || this.reviver.revTgt !== this)) this.reviver = null;
      if (this.downT > 18 && !this.reviver) { this.downed = false; this.beacon.visible = false; this.hp = 0; this.alive = false; this.killed(this.downBy, this.downType || 'bullet'); }
      return;
    }
    if (!this.isPlayer && !this.cmd && !this.downed) { /* distance LOD: far-off troops run at half or a third rate, with the time they missed */
      const cp = camera.position, dx = this.pos.x - cp.x, dy = this.pos.y - cp.y, dz = this.pos.z - cp.z, d2 = dx * dx + dy * dy + dz * dz;
      const every = LOW_END ? (d2 > 160000 ? 3 : d2 > 48400 ? 2 : 1) : d2 > 250000 ? 3 : d2 > 62500 ? 2 : 1; /* phones: the rings pull in to 220 m and 400 m */
      if (every > 1) { this.lodA = (this.lodA || 0) + dt; if ((FRAMEN + (this.par || (this.par = 1 + (Math.random() * 3 | 0)))) % every) return; dt = this.lodA; this.lodA = 0; }
    }
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.para && !this.isPlayer) { // parachute descent: drift toward the goal, then cut away on landing
      const g = surfY(this.pos.x, this.pos.z, this.pos.y), free = this.pos.y - g > 40, dr = free ? 8 : 3; showCanopy(this, !free); // freefall, then the chute
      this.pos.y -= (free ? 80 : 14) * dt; this.pos.x += (this.goal.x - this.pos.x > 0 ? 1 : -1) * dr * dt; this.pos.z += (this.goal.z - this.pos.z > 0 ? 1 : -1) * dr * dt;
      if (this.pos.y <= g) { this.pos.y = g; paraLand(this); }
      this.animate(dt, 0); return;
    }
    if (this.mount) {
      if (!this.mount.alive) this.mount = null;
      else {
        this.mount.saddle(this.pos, this); this.crouch = false;
        if (!this.isPlayer && !this.mount.hideRiders) {
          this.think -= dt; if (this.think <= 0) { this.think = 0.5; this.target = findTarget(this, 150, e => e.kind === 'soldier') || findTarget(this, 150, isGroundVeh); if (!this.goalCP || Math.random() < 0.05) this.pickGoal(); }
          if (this.target && !this.target.alive) this.target = null;
          this.yaw = this.target ? Math.atan2(this.target.pos.x - this.pos.x, this.target.pos.z - this.pos.z) : this.mount.yaw;
          this.cool -= dt; if (this.target && this.cool <= 0) { shootBullet(this, this.muzzle(_v1), this.target, 0.3, 13); this.burst--; if (this.burst <= 0) { this.burst = 4; this.cool = rand(0.7, 1.4); } else this.cool = 0.12; }
        }
        this.animate(dt, 0); if (this.mount.kind === 'cling') this.clingPose(); else this.ridePose(); return;
      }
    }
    if (this.isPlayer) { this.animate(dt, this.moveSpeed); return; }
    this.think -= dt; this.goalT -= dt;
    if (this.think <= 0) {
      this.think = rand(0.3, 0.6); const prev = this.target;
      // sense threats close by; reach out further only when holding or taking an objective (or perched as a marksman)
      const atObj = this.deck || (this.goalCP && Math.hypot(this.goalCP.x - this.pos.x, this.goalCP.z - this.pos.z) < 75);
      this.target = pickThreat(this, this.marksman ? 230 : atObj ? 170 : 85);
      if (!this.target && prev && prev.alive && !prev.downed && prev.pos.distanceTo(this.pos) < 260) { this.chaseT = 6; this.lastSeen.copy(prev.pos); }
      this.assist = null;
      if (!this.target && this.squad) for (const m of this.squad.m) { const at = m.lastHitBy; if (m !== this && m.alive && m.hurtT > 0 && at && at.alive && at.hitR && at.team !== this.team && at.pos) { this.assist = at; break; } }
      if (!this.revTgt && !this.isPlayer && (this.medic || !(this.mount || this.finGo || this.finLock || this.zipGo || this.trGo || this.warBoard || this.driverDuty || this.para || this.deck))) { let best = null, bd = this.medic ? 160 : this.target ? 30 : 60; /* medics run far for the wounded; any soldier picks up a downed friend close by */ for (const e of ENTS) if (e.downed && e.team === this.team && !e.reviver) { const d = e.pos.distanceTo(this.pos); if (d < bd) { bd = d; best = e; } } if (best) { this.revTgt = best; best.reviver = this; if (this.team === 1 && Math.random() < 0.3) comms(this.name, `Hang on, ${best.name}! I'm coming!`, 'b'); } }
      if (!this.goalCP || this.goalT <= 0 || (this.goalCP.owner === this.team && !this.goalCP.contested && Math.random() < 0.06)) this.pickGoal();
      this.follow = false; const sq = this.squad;
      if (sq && (!this.target || this.pos.distanceTo(this.target.pos) > 70)) { const L = squadLeader(sq); sq.lead = L;
        this.pers.lagT = (this.pers.lagT || 0) - 0.45; if (L && L !== this && L.pos.distanceTo(this.pos) < 170 && this.pers.lagT <= 0) { this.pers.lagT = this.pers.lag; const idx = sq.m.filter(x => x.alive && x !== L).indexOf(this); const off = WEDGE[Math.max(0, idx) % WEDGE.length]; const y = L.yaw; this.goal.set(L.pos.x + off[0] * Math.cos(y) + off[1] * Math.sin(y) + this.pers.jit.x, 0, L.pos.z - off[0] * Math.sin(y) + off[1] * Math.cos(y) + this.pers.jit.z); this.goalCP = L.goalCP; this.goalT = 4; this.follow = true; } else if (L && L !== this) this.follow = true; }
      this.pers.jitT -= 0.45; if (this.pers.jitT <= 0) { this.pers.jitT = rand(2, 6); this.pers.jit.set(rand(-3, 3), 0, rand(-3, 3)); }
      if (this.assist) { const a = this.assist; this.goal.set(a.pos.x + (this.pos.z - a.pos.z) * 0.3 * this.strafeDir, 0, a.pos.z - (this.pos.x - a.pos.x) * 0.3 * this.strafeDir); this.follow = false; if (this.pos.distanceTo(a.pos) < 150) this.target = a; }
      if (this.cmd) cmdThink(this);
      if (this.target && !this.cmd && !this.deck) { if (!this.coverPt || (this.coverT -= 0.45) <= 0) { this.coverPt = pickCover(this, this.target); this.coverT = rand(3, 7); } } else this.coverPt = null; // bound from prop to prop
      if (this.fleeT > 0) { this.fleeT -= 0.45; this.target = null; this.assist = null; this.coverPt = null; this.chaseT = 0; const pe = PLAYER.ent; if (pe) { const dx = this.pos.x - pe.pos.x, dz = this.pos.z - pe.pos.z, l = Math.hypot(dx, dz) || 1; this.goal.set(this.pos.x + dx / l * 40, 0, this.pos.z + dz / l * 40); this.follow = true; } }
    }
    if (this.target && (!this.target.alive || this.target.downed)) this.target = null;
    if (this.revTgt && (!this.revTgt.alive || !this.revTgt.downed)) { if (this.revTgt.reviver === this) this.revTgt.reviver = null; this.revTgt = null; this.revT = 0; }
    if (this.chaseT > 0 && !this.target) { this.chaseT -= dt; this.goal.copy(this.lastSeen); }
    let reviving = false;
    if (this.revTgt) { const p = this.revTgt.pos; this.goal.set(p.x, 0, p.z); this.follow = false; if (Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 1.7) { reviving = true; this.revT += dt; if (Math.random() < 0.5) FXA.spawn(p.x + rand(-0.4, 0.4), p.y + 0.3, p.z + rand(-0.4, 0.4), 0, rand(0.5, 1.5), 0, 0.8, 0.3, 0.1, 0.4, 2.6, 1.0, 0.1, 0.8, 0.3, 1, 0, 0); if (this.revT > 3) { this.revTgt.revive(this); this.revTgt = null; this.revT = 0; } } }
    if (this.target && this.target.pos.distanceTo(this.pos) > 85 && !this.revTgt && !this.cmd) { this.goal.set(this.target.pos.x, 0, this.target.pos.z); }
    let tx = this.goal.x - this.pos.x, tz = this.goal.z - this.pos.z; const gd = Math.hypot(tx, tz);
    let speed = (this.cmdMove && gd > 12 ? 8.8 : this.revTgt ? 6.8 : (this.follow && gd > 10) || this.assist || this.chaseT > 0 ? 6.4 : 5.4) * this.pers.spd, mx = 0, mz = 0;
    if (this.detourT > 0) { this.detourT -= dt; mx = Math.cos(this.detourA); mz = Math.sin(this.detourA); }
    else if (gd > (this.revTgt ? 1.2 : 3)) { mx = tx / gd; mz = tz / gd; }
    else { speed = 0; if (Math.random() < dt * 0.25 && this.goalCP && !this.cmd) this.goal.set(this.goalCP.x + rand(-20, 20), 0, this.goalCP.z + rand(-20, 20)); }
    this.crouch = reviving;
    if (reviving) { speed = 0; if (this.revTgt) this.faceYaw = Math.atan2(this.revTgt.pos.x - this.pos.x, this.revTgt.pos.z - this.pos.z); }
    else if (this.target) {
      const ax = this.target.pos.x - this.pos.x, az = this.target.pos.z - this.pos.z; const al = Math.hypot(ax, az) || 1;
      const pr = this.pers.range;
      if (this.coverPt && this.detourT <= 0 && !this.revTgt) { // move to cover, then crouch and fight from it
        const cx = this.coverPt.x - this.pos.x, cz = this.coverPt.z - this.pos.z, cd = Math.hypot(cx, cz);
        if (cd > 1.3) { mx = cx / cd; mz = cz / cd; speed = 6.2 * this.pers.spd; this.crouch = false; } else { speed = 0; this.crouch = (TIME + this.phase) % 4 > 0.8; }
      } else if (al < pr + 20 && this.detourT <= 0 && !this.revTgt && !this.cmdMove) {
        this.strafeT -= dt; if (this.strafeT <= 0) { this.strafeT = rand(0.5, 2.8) * (1.4 - this.pers.aggr); this.strafeDir = Math.random() < 0.5 ? -1 : 1; this.wantCrouch = Math.random() < this.pers.crouchy; this.rush = Math.random() < this.pers.aggr * 0.5; }
        mx = -az / al * this.strafeDir; mz = ax / al * this.strafeDir; speed = (this.wantCrouch ? 0 : rand(2.4, 3.4)) * this.pers.spd; this.crouch = this.wantCrouch;
        const push = al > pr ? 0.9 : al < pr * 0.5 && !this.rush ? -0.7 : this.rush ? 1.2 : 0; mx += ax / al * push; mz += az / al * push; if (this.rush) { speed = 6 * this.pers.spd; this.crouch = false; }
      }
      this.faceYaw = Math.atan2(ax, az); this.target.aim(_v2); this.aimP = Math.atan2(_v2.y - this.pos.y - 1.35, al);
    } else { this.aimP *= 0.9; if (speed > 0) this.faceYaw = Math.atan2(mx, mz); }
    const ml = Math.hypot(mx, mz); if (ml > 0) { mx /= ml; mz /= ml; }
    /* swimming: past wading depth troops swim (slower, no shooting) */
    this.swim = this.pos.y < 300 && !this.deck && !this.mount && H(this.pos.x, this.pos.z) < -1.8 && !deckAt(this.pos.x, this.pos.z, this.pos.y + 1);
    if (this.swim) speed *= 0.6;
    let nx = this.pos.x + mx * speed * dt, nz = this.pos.z + mz * speed * dt;
    const swimTo = this.goal && H(this.goal.x, this.goal.z) > 0.5 && Math.hypot(this.goal.x - this.pos.x, this.goal.z - this.pos.z) < 500; /* they swim across to land, never out to sea */
    if (this.pos.y < 300 && H(nx, nz) < -2.4 && H(nx, nz) <= H(this.pos.x, this.pos.z) && !deckAt(nx, nz, this.pos.y) && !(swimTo && H(nx, nz) > -40)) { nx = this.pos.x; nz = this.pos.z; this.detourT = 1.5; this.detourA = Math.atan2(-mz, -mx) + rand(-1, 1); }
    const lim = bnd(this.pos.y); this.pos.x = clamp(nx, -lim, lim); this.pos.z = clamp(nz, -lim, lim); pushOut(this.pos, 0.5); deckClamp(this.pos); this.pos.y = surfY(this.pos.x, this.pos.z, this.pos.y); if (this.pos.y < 0 && speed > 1 && Math.random() < 0.25) FXS.spawn(this.pos.x, 0.1, this.pos.z, rand(-1, 1), rand(1, 2.5), rand(-1, 1), 0.5, 0.4, 1.4, 0.8, 0.85, 0.88, 0.6, 0.65, 0.7, 0.6, 1, -6);
    this.stuckT += dt; if (this.stuckT > 2) { if (speed > 1 && this.pos.distanceTo(this.lastPos) < 1.5) { this.detourT = rand(1.5, 3); this.detourA = Math.random() * 6.28; } this.lastPos.copy(this.pos); this.stuckT = 0; }
    this.yaw = angLerp(this.yaw, this.faceYaw, 8 * dt);
    this.cool -= dt; this.melee -= dt;
    if (this.target && this.target.kind === 'soldier' && this.melee <= 0 && !reviving && this.pos.distanceTo(this.target.pos) < 2.6) {
      this.melee = rand(0.8, 1.4); this.kick = -0.6; this.target.damage(40, this, 'blade'); fxSparks(_v1.copy(this.target.pos).setY(this.target.pos.y + 1.3), 5, [2.5, 1.8, 1], 4); snd('stomp', this.pos, 0.4);
      if (this.target.alive) { _v2.subVectors(this.target.pos, this.pos).setY(0).normalize(); this.target.pos.addScaledVector(_v2, 0.8); if (!this.target.isPlayer) { this.target.melee = Math.min(this.target.melee || 0, rand(0.25, 0.55)); this.target.target = this; } } // the counter comes right back
    }
    if (this.target && this.cool <= 0 && !reviving && !this.swim) {
      const tgt = this.target; const d = this.pos.distanceTo(tgt.pos);
      if (this.heavy && (tgt.kind !== 'soldier' || (d > 22 && Math.random() < 0.3))) {
        this.muzzle(_v1); _v1.y += 0.3; tgt.aim(_v2);
        fireProj({ from: _v1, to: _v2, speed: 90, kind: 'missile', team: this.team, src: this, dmg: tgt.kind === 'soldier' ? 90 : 260, splash: 5, w: 0.25, len: 1.5, color: [3, 1.6, 0.6], homing: 3, target: tgt, maxDist: 400, fx: 1.4 });
        snd('missile', _v1, 0.6); this.cool = rand(5, 8); this.kick = 0.25;
      } else {
        const acc = clamp(0.55 - d / 210, 0.07, 0.5) * (this.marksman ? 2.6 : 1) * (tgt.isPlayer ? 0.5 : 1) * (tgt.kind === 'soldier' ? 1 : 0.8) * (this.crouch ? 1.2 : 1);
        shootBullet(this, this.muzzle(_v1), tgt, this.cmd ? Math.min(0.85, acc * (d < 45 ? 1.9 : 1.3)) : acc, this.cmd && d < 45 ? 20 : 13); this.kick = 0.07; /* the Commander's squads drop enemies close in */
        this.burst--; if (this.burst <= 0) { this.burst = 4 + ((Math.random() * 7) | 0); this.cool = rand(0.35, 1.0); } else this.cool = 0.085;
      }
    }
    this.moveSpeed = speed; this.animate(dt, speed);
  }
  clingPose() { // crouched, one knee down, holding on to the hull
    if (this.hero) return this.ridePose();
    this.legs[0].th.rotation.set(-0.9, 0, 0.3); this.legs[1].th.rotation.set(0.2, 0, -0.25); this.legs[0].sh.rotation.x = 1.1; this.legs[1].sh.rotation.x = 1.5; this.body.position.y = -0.38;
  }
  ridePose() {
    if (this.hero) { const L = this.heroParts.legs; L[0].thigh.rotation.set(-1.2, 0, 0.45); L[1].thigh.rotation.set(-1.2, 0, -0.45); L[0].shin.rotation.x = L[1].shin.rotation.x = 1.3; }
    else { this.legs[0].th.rotation.set(-1.2, 0, 0.45); this.legs[1].th.rotation.set(-1.2, 0, -0.45); this.legs[0].sh.rotation.x = this.legs[1].sh.rotation.x = 1.3; }
    this.body.position.y = -0.55;
  }
  animate(dt, speed) {
    if (this.imp) return; // drawn as a distant silhouette: skip the skeleton
    if (!this.hero && this.legs) { this.legs[0].th.rotation.z = 0; this.legs[1].th.rotation.z = 0; }
    this.obj.position.copy(this.pos); this.obj.rotation.set(0, this.yaw, 0);
    if (!this.obj.visible && !this.isPlayer) return; /* culled this frame: the pose would never be seen */
    if (this.hero) {
      this.slashT = Math.max(0, (this.slashT || 0) - dt); this.aimBlast = Math.max(0, (this.aimBlast || 0) - dt);
      animateHero(this.heroParts, dt, speed, this); return;
    }
    if (this.swim && !this.mount) { /* the swim: lying in the water, head up, legs kicking, the odd splash */
      this.obj.rotation.order = 'YXZ'; this.obj.rotation.set(1.5, this.yaw, Math.sin(TIME * 4 + this.phase) * 0.12); this.obj.position.y = this.pos.y + 0.84 + Math.sin(TIME * 3 + this.phase) * 0.04; /* torso at the waterline, head just above */
      const k = TIME * 9 + this.phase; this.legs[0].th.rotation.x = Math.sin(k) * 0.4; this.legs[1].th.rotation.x = -Math.sin(k) * 0.4; this.legs[0].sh.rotation.x = 0.3 + Math.max(0, Math.sin(k)) * 0.4; this.legs[1].sh.rotation.x = 0.3 + Math.max(0, -Math.sin(k)) * 0.4;
      this.body.position.y = 0; this.body.rotation.x = 0; this.crouch = false;
      if (speed > 0.5 && Math.random() < dt * 5) FXS.spawn(this.pos.x + Math.sin(this.yaw) * 1.2, 0.15, this.pos.z + Math.cos(this.yaw) * 1.2, rand(-0.6, 0.6), rand(0.6, 1.4), rand(-0.6, 0.6), 0.45, 0.35, 1.1, 0.85, 0.9, 0.95, 0.6, 0.64, 0.66, 0.5, 0.8, -5);
      return;
    }
    if (this.obj.rotation.order !== 'XYZ') { this.obj.rotation.order = 'XYZ'; this.obj.rotation.set(0, this.yaw, 0); }
    this.phase += dt * speed * 1.9 * (this.pers ? 1 / this.pers.spd : 1); const amp = Math.min(1, speed / 3); const s = Math.sin(this.phase);
    this.legs[0].th.rotation.x = s * 0.6 * amp; this.legs[1].th.rotation.x = -s * 0.6 * amp;
    this.legs[0].sh.rotation.x = Math.max(0, -Math.cos(this.phase)) * 0.9 * amp; this.legs[1].sh.rotation.x = Math.max(0, Math.cos(this.phase)) * 0.9 * amp;
    if (this.crouch) { this.legs[0].th.rotation.x = -1.1; this.legs[0].sh.rotation.x = 1.9; this.legs[1].th.rotation.x = -0.2; this.legs[1].sh.rotation.x = 1.4; }
    this.body.position.y = this.crouch ? -0.36 : Math.abs(Math.cos(this.phase)) * 0.04 * amp;
    this.kick = Math.max(0, (this.kick || 0) - dt * 0.8); this.body.rotation.x = (this.crouch ? 0.12 : speed > 6 ? 0.16 : 0.03) - clamp(this.aimP || 0, -0.5, 0.5) * 0.5 - this.kick;
  }
}
function losClear(a, b) { const L = a.distanceTo(b); for (let t = 1.5; t < L - 1; t += 2.5) { _v4.lerpVectors(a, b, t / L); if (_v4.y < groundY(_v4.x, _v4.z) || buildingAt(_v4)) return false; } return true; }
/* misses matter: rounds whiz past the Commander (sometimes grazing him); AI under fire gets suppressed and answers the shooter */
const NEAR = { t: 0 };
function bulletMissed(src, tgt, d) {
  if (tgt.isPlayer) {
    if (TIME - NEAR.t > 0.12) { NEAR.t = TIME; snd('whiz', null, 0.32); shake(0.04); }
    if (Math.random() < 0.12 && d < 120 && tgt.spawnGuard <= TIME) tgt.damage(4, src, 'graze');
    return;
  }
  if (tgt.kind !== 'soldier' || !tgt.alive || tgt.downed) return;
  tgt.crouch = true;
  if (src && src.alive && (!tgt.target || !tgt.target.alive || Math.random() < 0.35)) tgt.target = src; // turn on whoever is shooting
  if (tgt.hp < tgt.maxHp * 0.35 && !tgt.cmd && Math.random() < 0.4) tgt.fleeT = rand(2, 4); // flight when hurt and pinned
}
/* damage numbers are for your own shooting only: your gun, your laser, your blade, or the weapons of a vehicle you are
   driving. Hits scored in your name by the flying heroes, the storms, meteors and strikes still count, without numbers. */
const LASER_COL = [0.5, 3.2, 4.2];
function myShot(src, type) { return type === 'bullet' || type === 'laser' || type === 'blade' || !!src.mount; }
function shootBullet(src, from, tgt, acc, dmg) {
  if (src.wpn === 'laser') { /* the company's laser riflemen (two in every ten): a straighter, harder bolt that armour does not shrug off */
    tgt.aim(_v2); const d = from.distanceTo(_v2), hit = Math.random() < Math.min(0.9, acc * 1.25);
    if (!hit) { _v2.add(randDir(_v3).multiplyScalar(0.5 + d * 0.025)); _v3.subVectors(_v2, from).normalize(); _v2.addScaledVector(_v3, rand(2, 30)); }
    fireProj({ from, to: _v2, speed: 900, kind: 'bullet', team: src.team, w: 0.13, len: 16, color: LASER_COL, checkEnts: false });
    fxMuzzle(from, LASER_COL); if (Math.random() < 0.3 && camera.position.distanceTo(from) < 90) snd('laser', from, 0.14);
    if (hit) tgt.damage(dmg * (tgt.kind === 'soldier' ? 1.1 : 2.2), src, 'laser'); else bulletMissed(src, tgt, d);
    return;
  }
  tgt.aim(_v2); const d = from.distanceTo(_v2); const hit = Math.random() < acc && (!tgt.isPlayer || losClear(from, _v2.clone()));
  if (hit) _v2.add(randDir(_v3).multiplyScalar(0.25)); else _v2.add(randDir(_v3).multiplyScalar(0.6 + d * 0.03));
  _v3.subVectors(_v2, from).normalize(); _v2.addScaledVector(_v3, hit ? 0 : rand(2, 30));
  fireProj({ from, to: _v2, speed: 420, kind: 'bullet', team: src.team, w: 0.07, len: 7, color: TEAM[src.team].tracer, checkEnts: false });
  fxMuzzle(from, [3, 2.2, 1]);
  if (hit) tgt.damage(dmg, src, 'bullet'); else bulletMissed(src, tgt, d);
  snd('rifle', from, 0.35);
}

/* ---------------- hover tank ---------------- */
class Tank extends Ent {
  constructor(team) {
    super('tank', team); this.maxHp = this.hp = 900; this.radius = 4; this.aimOff = 1.8; this.cull = 6; this.bulletMul = 0.06;
    const M = MAT[team]; const r = new T.Group();
    const hull = new T.Mesh(new T.BoxGeometry(5.6, 1.8, 8.4), M.armor); hull.position.y = 1.6; hull.castShadow = true; r.add(hull);
    const nose = new T.Mesh(new T.BoxGeometry(5.2, 1.2, 2.4), M.dark); nose.position.set(0, 1.4, 4.6); nose.rotation.x = 0.4; r.add(nose);
    const skirt = new T.Mesh(new T.BoxGeometry(6, 0.6, 8.8), M.dark); skirt.position.y = 0.8; r.add(skirt);
    const glowP = new T.Mesh(new T.PlaneGeometry(5, 8).rotateX(Math.PI / 2), M.add); glowP.position.y = 0.45; r.add(glowP);
    const tur = new T.Group(); tur.position.y = 2.9; r.add(tur);
    const th = new T.Mesh(new T.BoxGeometry(3.4, 1.3, 3.8), M.armor); th.castShadow = true; tur.add(th);
    const bar = new T.Mesh(new T.CylinderGeometry(0.22, 0.28, 5.5, 8).rotateX(Math.PI / 2), MAT_GUN); bar.position.set(0, 0.1, 4.4); tur.add(bar);
    const eye = new T.Mesh(new T.BoxGeometry(1.6, 0.2, 0.1), M.glow); eye.position.set(0, 0.35, 1.95); tur.add(eye);
    this.tur = tur; this.obj = r; this.yaw = 0; this.cool = rand(1, 3); this.coax = 0; this.think = 0; this.goal = new V3(); this.goalT = 0; this.detourT = 0; this.stuckT = 0; this.lastPos = new V3();
  }
  spawnAt(p) { this.pos.set(p.x, groundY(p.x, p.z) + 0.6, p.z); this.yaw = this.team === 1 ? Math.PI : 0; this.lastPos.copy(this.pos); }
  die(src) { fxExplosion(_v1.copy(this.pos).setY(this.pos.y + 2), 3); this.deadT = 0; SPAWNER.queue('tank', this.team, 35); if (Math.random() < 0.6) startTumble(this, _v2.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)), 6, 0.9); else addEmitter(this.pos.clone().setY(this.pos.y + 2), 1.8, 40); }
  update(dt) {
    if (!this.alive) { this.deadT += dt; if (this.tumble) tumbleStep(this, dt, 4.5); else this.obj.position.y = this.pos.y - Math.min(0.6, this.deadT); if (this.deadT > 30) this.remove = true; return; }
    this.think -= dt; this.goalT -= dt;
    if (this.think <= 0) { this.think = 0.6; this.target = findTarget(this, 240, isGroundVeh) || findTarget(this, 160, e => e.kind === 'soldier'); if (this.goalT <= 0 || this.pos.distanceTo(this.goal) < 12) { const cp = pickObjective(this.team, this.pos); this.goalCP = cp; this.goal.set(cp.x + rand(-30, 30), 0, cp.z + rand(-30, 30)); this.goalT = rand(20, 40); } }
    if (this.target && !this.target.alive) this.target = null;
    const tx = this.goal.x - this.pos.x, tz = this.goal.z - this.pos.z; const gd = Math.hypot(tx, tz);
    let want = Math.atan2(tx, tz), speed = gd > 12 ? 9 : 0;
    if (this.detourT > 0) { this.detourT -= dt; want = this.detourA; speed = 7; }
    if (this.target && this.pos.distanceTo(this.target.pos) < 90) speed *= 0.3;
    this.yaw = angLerp(this.yaw, want, 0.9 * dt);
    const nx = this.pos.x + Math.sin(this.yaw) * speed * dt, nz = this.pos.z + Math.cos(this.yaw) * speed * dt;
    if (H(nx, nz) > 0.5) { this.pos.x = nx; this.pos.z = nz; } else { this.detourT = 2; this.detourA = this.yaw + Math.PI * 0.6; }
    pushOut(this.pos, 4); this.pos.x = clamp(this.pos.x, -BOUND, BOUND); this.pos.z = clamp(this.pos.z, -BOUND, BOUND);
    this.stuckT += dt; if (this.stuckT > 3) { if (speed > 1 && this.pos.distanceTo(this.lastPos) < 3) { this.detourT = 3; this.detourA = this.yaw + rand(1.5, 4.5); } this.lastPos.copy(this.pos); this.stuckT = 0; }
    const gy = groundY(this.pos.x, this.pos.z); this.pos.y = lerp(this.pos.y, gy + 0.6 + Math.sin(TIME * 2 + this.pos.x) * 0.15, Math.min(1, dt * 5));
    const pitch = Math.atan2(H(this.pos.x + Math.sin(this.yaw) * 4, this.pos.z + Math.cos(this.yaw) * 4) - H(this.pos.x - Math.sin(this.yaw) * 4, this.pos.z - Math.cos(this.yaw) * 4), 8);
    this.obj.position.copy(this.pos); this.obj.rotation.set(-pitch, this.yaw, 0, 'YXZ');
    if (speed > 2 && Math.random() < 0.5) fxDust(_v1.set(this.pos.x - Math.sin(this.yaw) * 4, gy, this.pos.z - Math.cos(this.yaw) * 4), 1, 2.5, 3);
    if (this.target) {
      const tw = Math.atan2(this.target.pos.x - this.pos.x, this.target.pos.z - this.pos.z) - this.yaw;
      this.tur.rotation.y = angLerp(this.tur.rotation.y, tw, 2 * dt);
      this.cool -= dt; this.coax -= dt;
      if (this.cool <= 0 && Math.abs(angDiff(this.tur.rotation.y, tw)) < 0.1) {
        this.cool = rand(3, 4.5); const a = this.yaw + this.tur.rotation.y;
        _v1.set(this.pos.x + Math.sin(a) * 7, this.pos.y + 3, this.pos.z + Math.cos(a) * 7); this.target.aim(_v2).add(randDir(_v3).multiplyScalar(this.pos.distanceTo(this.target.pos) * 0.02));
        fireProj({ from: _v1, to: _v2, speed: 220, kind: 'shell', team: this.team, src: this, dmg: 320, splash: 6, w: 0.5, len: 6, color: TEAM[this.team].laser, fx: 1.6 });
        fxMuzzle(_v1, [4, 3, 2]); FXS.spawn(_v1.x, _v1.y, _v1.z, 0, 1, 0, 1.5, 2, 6, 0.3, 0.28, 0.25, 0.4, 0.38, 0.35, 0.6, 1, 0.5); snd('heavy', _v1, 0.8); flashLight(_v1, 3, 25, 0.12, TEAM[this.team].hex);
      }
      if (this.coax <= 0 && this.target.kind === 'soldier') { this.coax = 0.15; const a = this.yaw + this.tur.rotation.y; _v1.set(this.pos.x + Math.sin(a) * 5, this.pos.y + 3.1, this.pos.z + Math.cos(a) * 5); shootBullet(this, _v1, this.target, 0.25, 16); if (Math.random() < 0.1) this.coax = 1.5; }
    }
  }
}

/* ---------------- walker ---------------- */
class Walker extends Ent {
  constructor(team) {
    super('walker', team); this.maxHp = this.hp = 3200; this.radius = 7; this.aimOff = 17; this.cull = 14; this.bulletMul = 0.02;
    const M = MAT[team]; const r = new T.Group(); const torso = new T.Group(); torso.position.y = 17; r.add(torso);
    const add = (p, g, m, x, y, z, rx = 0) => { const o = new T.Mesh(g, m); o.position.set(x, y, z); o.rotation.x = rx; o.castShadow = true; p.add(o); return o; };
    add(torso, new T.BoxGeometry(7.5, 5, 9.5), M.armor, 0, 0, 0);
    add(torso, new T.BoxGeometry(6, 3.2, 4), M.dark, 0, -0.4, 5.8, 0.35);
    add(torso, new T.BoxGeometry(8.4, 1.2, 10.4), M.dark, 0, 2.6, -0.3);
    add(torso, new T.BoxGeometry(4.6, 0.5, 0.2), M.glow, 0, 0.7, 7.5);
    for (const sx of [-1, 1]) {
      add(torso, new T.CylinderGeometry(0.35, 0.45, 6, 8).rotateX(Math.PI / 2), MAT_GUN, sx * 1.7, -2, 7.5);
      add(torso, new T.BoxGeometry(2.4, 2.4, 3.6), M.dark, sx * 5, 1, 0.5);
      for (let i = 0; i < 4; i++) add(torso, new T.CylinderGeometry(0.3, 0.3, 0.1, 6).rotateX(Math.PI / 2), M.glow, sx * 5 + (i % 2 - 0.5) * 1, 1 + ((i >> 1) - 0.5) * 1, 2.35);
    }
    add(torso, new T.BoxGeometry(0.15, 5, 0.15), MAT_GUN, -2.5, 4.5, -3);
    this.legs = [];
    for (const sx of [-1, 1]) {
      const hip = new T.Group(); hip.position.set(sx * 3.4, 16.2, -0.5); r.add(hip);
      add(hip, new T.SphereGeometry(1.4, 10, 8), M.dark, 0, 0, 0);
      add(hip, new T.BoxGeometry(1.5, 8.4, 1.8).translate(0, -4.2, 0), M.armor, 0, 0, 0);
      const knee = new T.Group(); knee.position.y = -8.4; hip.add(knee); add(knee, new T.SphereGeometry(1.1, 10, 8), M.dark, 0, 0, 0);
      add(knee, new T.BoxGeometry(1.3, 9, 1.4).translate(0, -4.5, 0), M.armor, 0, 0, 0);
      const ankle = new T.Group(); ankle.position.y = -9; knee.add(ankle); const foot = add(ankle, new T.BoxGeometry(3.2, 0.9, 4.6), M.dark, 0, -0.3, 0.6);
      this.legs.push({ hip, knee, ankle, foot, off: sx > 0 ? 0 : Math.PI, last: 0 });
    }
    this.torso = torso; this.obj = r; this.heading = 0; this.phase = 0; this.speed = 0; this.cool = 1; this.mcool = rand(4, 8); this.think = 0; this.goal = new V3(); this.goalT = 0; this.gun = 0; this.torsoYaw = 0;
  }
  spawnAt(p) { this.pos.set(p.x, groundY(p.x, p.z), p.z); this.heading = this.team === 1 ? Math.PI : 0; }
  die(src) {
    this.deadT = 0; this.fallDir = Math.random() < 0.5 ? 1 : -1; comms(null, `${TEAM[this.team].short} walker ${this.name} is going down!`, this.team === 1 ? 'b' : 'r');
    if (!this.isPlayer && !this.noRespawn) SPAWNER.queue('walker', this.team, 50);
  }
  muzzle(i, out) { const a = this.heading + this.torsoYaw; const sx = i ? 1.7 : -1.7; const s = Math.sin(a), c = Math.cos(a); return out.set(this.pos.x + sx * c + 10.5 * s, this.pos.y + 15 + this.torso.position.y - 17, this.pos.z - sx * s + 10.5 * c); }
  fireGuns(tp) {
    this.gun ^= 1; this.muzzle(this.gun, _v1);
    fireProj({ from: _v1, to: tp, speed: 300, kind: 'bolt', team: this.team, src: this, dmg: 170, splash: 5, w: 0.7, len: 14, color: TEAM[this.team].laser, fx: 1.4 });
    fxMuzzle(_v1, TEAM[this.team].laser); flashLight(_v1, 4, 30, 0.12, TEAM[this.team].hex); snd('heavy', _v1, 0.9);
  }
  fireMissiles(tp, tgt) {
    for (let i = 0; i < 6; i++) setTimeout(() => {
      if (!this.alive) return; const a = this.heading + this.torsoYaw; const sx = i % 2 ? 5 : -5;
      _v1.set(this.pos.x + sx * Math.cos(a) + 3 * Math.sin(a), this.pos.y + 19, this.pos.z - sx * Math.sin(a) + 3 * Math.cos(a));
      _v2.copy(tp).add(randDir(_v3).multiplyScalar(5));
      fireProj({ from: _v1, to: _v2, vel: _v3.set(Math.sin(a) * 30, 40, Math.cos(a) * 30), speed: 110, kind: 'missile', team: this.team, src: this, dmg: 140, splash: 6, w: 0.3, len: 1.6, color: [3, 1.5, 0.5], homing: 2.5, target: tgt, maxDist: 900, fx: 1.3 });
      snd('missile', _v1, 0.6);
    }, i * 140);
  }
  walk(dt, speed) {
    this.speed = lerp(this.speed, speed, Math.min(1, dt * 1.5)); this.phase += dt * Math.abs(this.speed) * 0.55 * Math.sign(this.speed || 1);
    const amp = Math.min(1, Math.abs(this.speed) / 2.5);
    for (const L of this.legs) {
      const ph = this.phase + L.off, s = Math.sin(ph), c = Math.cos(ph);
      const a1 = -0.42 + s * 0.38 * amp, lift = Math.max(0, c) * 0.55 * amp, a2 = 0.86 + lift;
      L.hip.rotation.x = a1; L.knee.rotation.x = a2; L.ankle.rotation.x = -(a1 + a2);
      if (L.last > 0 && c <= 0 && amp > 0.3) {
        L.foot.getWorldPosition(_v1); _v1.y = groundY(_v1.x, _v1.z); fxDust(_v1, 7, 4, 6); shake(0.35, _v1); snd('stomp', _v1, 1);
        if (Math.random() < 0.4) fxSparks(_v1, 3, [2, 1.4, 0.8], 5);
      }
      L.last = c;
    }
    this.torso.position.y = 17 - Math.abs(Math.sin(this.phase)) * 0.7 * amp; this.torso.rotation.z = Math.sin(this.phase) * 0.03 * amp;
    /* going round: a building too big to smash turns the walker aside for a few seconds */
    if (this.avoidT > 0) this.avoidT -= dt;
    const mh = this.heading + (this.avoidT > 0 ? this.avoidSide * 1.15 : 0);
    const f = this.speed * dt; let nx = this.pos.x + Math.sin(mh) * f, nz = this.pos.z + Math.cos(mh) * f;
    if (H(nx, nz) < -2) { nx = this.pos.x; nz = this.pos.z; }
    _v1.set(nx + Math.sin(mh) * 5, this.pos.y + 4, nz + Math.cos(mh) * 5); const b = buildingAt(_v1); /* look a stride ahead */
    const smash = b && !b.landmark && !b.cover && b.hp < 2500 && b.maxHp < 1e8; /* sheds, kiosks, small houses: through them */
    if (smash) { b.damage(900 * dt, this); this.speed *= 0.97; if (Math.random() < 0.3) fxDust(_v1, 2, 6, 6); }
    else if (b) { nx = this.pos.x; nz = this.pos.z; if (!(this.avoidT > 0)) { this.avoidT = rand(2.5, 4); this.avoidSide = this.avoidSide ? -this.avoidSide : (Math.random() < 0.5 ? 1 : -1); } }
    /* never left standing inside a building: slide out to its edge */
    _v2.set(this.pos.x, this.pos.y + 4, this.pos.z); const inb = buildingAt(_v2);
    if (inb && !(inb.hp < 2500 && !inb.cover && !inb.landmark)) { _v2.y = this.pos.y; pushOut(_v2, 6); nx = _v2.x; nz = _v2.z; }
    this.pos.x = clamp(nx, -BOUND, BOUND); this.pos.z = clamp(nz, -BOUND, BOUND); this.pos.y = lerp(this.pos.y, groundY(this.pos.x, this.pos.z), Math.min(1, dt * 3));
    this.obj.position.copy(this.pos); this.obj.rotation.y = this.heading; this.torso.rotation.y = this.torsoYaw;
  }
  update(dt) {
    if (!this.alive) {
      this.deadT += dt; const t = Math.min(1, this.deadT / 3.2);
      this.torso.position.y = 17 - 13 * t * t; this.torso.rotation.z = this.fallDir * 0.5 * t; this.torso.rotation.x = 0.35 * t;
      for (const L of this.legs) { L.hip.rotation.x = -1.2 * t; L.knee.rotation.x = 2.2 * t; }
      if (this.deadT < 3.5 && Math.random() < dt * 5) fxExplosion(_v1.set(this.pos.x + rand(-4, 4), this.pos.y + this.torso.position.y + rand(-1, 3), this.pos.z + rand(-4, 4)), rand(1.5, 2.5));
      if (t >= 1 && !this.crashed) { this.crashed = true; fxExplosion(_v1.set(this.pos.x, this.pos.y + 4, this.pos.z), 5); explodeDamage(_v1, 14, 400, null, 0); addEmitter(_v1.clone(), 3, 70); shake(1.4, _v1); }
      if (this.deadT > 60) this.remove = true; return;
    }
    if (this.isPlayer || this.parked) return;
    this.think -= dt; this.goalT -= dt;
    if (this.think <= 0) { this.think = 0.8; this.target = findTarget(this, 260, isGroundVeh) || findTarget(this, 220, e => e.kind === 'soldier') || findTarget(this, 260, e => e.kind === 'gunship' || e.kind === 'dropship'); if (this.goalT <= 0 || Math.hypot(this.goal.x - this.pos.x, this.goal.z - this.pos.z) < 15) { const cp = pickObjective(this.team, this.pos); this.goalCP = cp; this.goal.set(cp.x + rand(-25, 25), 0, cp.z + rand(-25, 25)); this.goalT = rand(30, 60); } }
    if (this.target && !this.target.alive) this.target = null;
    const tx = this.goal.x - this.pos.x, tz = this.goal.z - this.pos.z; const gd = Math.hypot(tx, tz);
    this.heading = angLerp(this.heading, Math.atan2(tx, tz), 0.35 * dt);
    this.walk(dt, gd > 15 ? 5.8 : 0);
    if (this.target) {
      const tw = Math.atan2(this.target.pos.x - this.pos.x, this.target.pos.z - this.pos.z) - this.heading;
      this.torsoYaw = clamp(angLerp(this.torsoYaw, tw, 1.2 * dt), -1.4, 1.4);
      this.cool -= dt; this.mcool -= dt;
      if (this.cool <= 0 && Math.abs(angDiff(this.torsoYaw, tw)) < 0.15) { this.cool = rand(0.5, 1); this.target.aim(_v2).add(randDir(_v3).multiplyScalar(this.pos.distanceTo(this.target.pos) * 0.015)); this.fireGuns(_v2.clone()); }
      if (this.mcool <= 0 && this.target.kind !== 'soldier') { this.mcool = rand(8, 12); this.fireMissiles(this.target.aim(new V3()), this.target); }
    } else this.torsoYaw = angLerp(this.torsoYaw, 0, dt);
  }
}

/* ---------------- gunship ---------------- */
class Gunship extends Ent {
  constructor(team) {
    super('gunship', team); this.maxHp = this.hp = 1000; this.radius = 5; this.cull = 8; this.bulletMul = 0.15;
    const M = MAT[team]; const r = new T.Group(); const add = (g, m, x, y, z) => { const o = new T.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; r.add(o); return o; };
    add(new T.BoxGeometry(3.6, 3, 11), M.armor, 0, 0, 0); add(new T.BoxGeometry(3, 2, 3.4), MAT_GLASS, 0, 0.3, 5.8);
    add(new T.BoxGeometry(11, 0.4, 2.4), M.dark, 0, 0.6, -0.5); add(new T.BoxGeometry(1, 1, 7), M.armor, 0, 0.6, -8); add(new T.BoxGeometry(0.3, 2.6, 2), M.dark, 0, 2, -10.5);
    for (const sx of [-1, 1]) { add(new T.TorusGeometry(1.8, 0.35, 6, 18).rotateX(Math.PI / 2), M.dark, sx * 6.2, 0.6, -0.5); const disc = new T.Mesh(new T.CircleGeometry(1.6, 16).rotateX(Math.PI / 2), M.add); disc.position.set(sx * 6.2, 0.3, -0.5); r.add(disc); add(new T.BoxGeometry(0.4, 0.4, 2.2), MAT_GUN, sx * 3, 0.1, 1.5); }
    add(new T.SphereGeometry(0.8, 8, 6), MAT_GUN, 0, -1.6, 5); add(new T.BoxGeometry(0.25, 0.25, 2.4), MAT_GUN, 0, -1.7, 6.4);
    add(new T.BoxGeometry(2.4, 0.2, 0.1), M.glow, 0, 0.6, 7.55);
    this.obj = r; this.yaw = 0; this.theta = Math.random() * 6; this.cp = null; this.think = 0; this.cool = 2; this.rcool = rand(4, 7); this.bank = 0;
  }
  spawnAt(p) { this.pos.set(p.x, groundY(p.x, p.z) + 30, p.z); }
  die(src) { this.deadT = 0; this.spin = rand(2, 4) * (Math.random() < 0.5 ? -1 : 1); fxExplosion(this.pos, 2); SPAWNER.queue('gunship', this.team, 40); }
  update(dt) {
    if (!this.alive) {
      this.deadT += dt; this.vel.y -= 14 * dt; this.pos.addScaledVector(this.vel, dt); this.yaw += this.spin * dt; this.obj.position.copy(this.pos); this.obj.rotation.set(0.4, this.yaw, this.deadT, 'YXZ');
      FXS.spawn(this.pos.x, this.pos.y, this.pos.z, 0, 1, 0, rand(3, 5), 2, 7, 0.08, 0.07, 0.06, 0.2, 0.18, 0.16, 0.9, 0.3, 0.4); FXA.spawn(this.pos.x, this.pos.y, this.pos.z, 0, 0, 0, 0.3, 2.5, 1, 4, 2, 0.6, 1, 0.2, 0.05, 1, 0, 0);
      if (this.pos.y < groundY(this.pos.x, this.pos.z) + 1 || this.deadT > 8) { fxExplosion(this.pos, 4); explodeDamage(this.pos, 10, 300, null, 0); if (H(this.pos.x, this.pos.z) > 0) addEmitter(this.pos.clone(), 2, 45); this.remove = true; }
      return;
    }
    this.think -= dt;
    if (this.think <= 0) {
      this.think = 0.7; if (!this.cp || Math.random() < 0.03) this.cp = pickObjective(this.team, this.pos);
      this.target = findTarget(this, 240, isGroundVeh) || findTarget(this, 200, e => e.kind === 'soldier');
    }
    if (this.target && !this.target.alive) this.target = null;
    this.theta += dt * 0.22; const R = 70;
    _v1.set(this.cp.x + Math.cos(this.theta) * R, 0, this.cp.z + Math.sin(this.theta) * R); _v1.y = Math.max(groundY(_v1.x, _v1.z), groundY(this.pos.x, this.pos.z)) + 55 + Math.sin(this.theta * 3) * 8;
    const bh = buildingAt(_v2.set(this.pos.x, this.pos.y - 6, this.pos.z)); if (bh) _v1.y = Math.max(_v1.y, bh.top + 25);
    _v2.subVectors(_v1, this.pos); const d = _v2.length(); _v2.multiplyScalar(Math.min(28, d * 0.6) / (d || 1));
    this.vel.lerp(_v2, Math.min(1, dt * 0.9)); this.pos.addScaledVector(this.vel, dt);
    const lookA = this.target ? Math.atan2(this.target.pos.x - this.pos.x, this.target.pos.z - this.pos.z) : Math.atan2(this.vel.x, this.vel.z);
    const prev = this.yaw; this.yaw = angLerp(this.yaw, lookA, 1.2 * dt); this.bank = lerp(this.bank, -angDiff(prev, this.yaw) / Math.max(dt, 0.001) * 0.6, dt * 2);
    const fwdV = this.vel.x * Math.sin(this.yaw) + this.vel.z * Math.cos(this.yaw);
    this.obj.position.copy(this.pos); this.obj.rotation.set(fwdV * 0.012, this.yaw, clamp(this.bank, -0.5, 0.5), 'YXZ');
    if (this.pos.y - groundY(this.pos.x, this.pos.z) < 30 && Math.random() < 0.3) fxDust(_v3.set(this.pos.x, groundY(this.pos.x, this.pos.z), this.pos.z), 1, 4, 8);
    if (this.target) {
      this.cool -= dt; this.rcool -= dt;
      if (this.cool <= 0) {
        this.burst = (this.burst || 0) + 1; this.cool = this.burst % 12 === 0 ? rand(1.5, 2.5) : 0.08;
        _v1.set(0, -1.7, 7.5).applyQuaternion(this.obj.quaternion).add(this.pos); this.target.aim(_v2).add(randDir(_v3).multiplyScalar(2 + this.pos.distanceTo(this.target.pos) * 0.02));
        fireProj({ from: _v1, to: _v2, speed: 360, kind: 'bolt', team: this.team, src: this, dmg: 26, splash: 2.5, w: 0.18, len: 5, color: [3, 1.6, 0.5], fx: 0.5 }); fxMuzzle(_v1, [4, 2.5, 1]); snd('rifle', _v1, 0.55);
      }
      if (this.rcool <= 0) {
        this.rcool = rand(6, 9); const tgt = this.target; for (let i = 0; i < 4; i++) setTimeout(() => { if (!this.alive) return; _v1.set(i % 2 ? 3 : -3, 0, 2).applyQuaternion(this.obj.quaternion).add(this.pos); fireProj({ from: _v1, to: tgt.aim(_v2), speed: 120, kind: 'missile', team: this.team, src: this, dmg: 160, splash: 6, w: 0.25, len: 1.4, color: [3, 1.5, 0.5], homing: 2, target: tgt, maxDist: 600, fx: 1.4 }); snd('missile', _v1, 0.5); }, i * 180);
      }
    }
  }
}

/* ---------------- fighter ---------------- */
class Fighter extends Ent {
  constructor(team, orbital) {
    super('fighter', team); this.maxHp = this.hp = 160; this.radius = 5.5; this.cull = 8; this.bulletMul = 0.5; this.orbital = !!orbital;
    const M = MAT[team]; const r = new T.Group(); const add = (g, m, x, y, z, ry = 0, rz = 0) => { const o = new T.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(0, ry, rz); o.castShadow = true; r.add(o); return o; };
    if (team === 1) {
      add(new T.CylinderGeometry(0.25, 1.15, 10, 8).rotateX(Math.PI / 2), M.armor, 0, 0, 0);
      add(new T.SphereGeometry(0.9, 10, 8).scale(0.8, 0.6, 1.8), MAT_GLASS, 0, 0.6, 1.2);
      add(new T.BoxGeometry(10, 0.22, 3.4), M.trim, 0, -0.1, -1.6); add(new T.BoxGeometry(0.22, 2, 2.2), M.dark, 1, 1, -4, 0, 0.3); add(new T.BoxGeometry(0.22, 2, 2.2), M.dark, -1, 1, -4, 0, -0.3);
      for (const sx of [-1, 1]) { add(new T.CylinderGeometry(0.12, 0.12, 3, 6).rotateX(Math.PI / 2), MAT_GUN, sx * 5, -0.1, 0.4); add(new T.CylinderGeometry(0.55, 0.55, 3, 10).rotateX(Math.PI / 2), M.dark, sx * 1.1, 0, -4.4); }
    } else {
      add(new T.BoxGeometry(1.8, 1.2, 9).translate(0, 0, 0), M.armor, 0, 0, 0); add(new T.ConeGeometry(0.9, 3, 4).rotateX(Math.PI / 2), M.dark, 0, 0, 5.8);
      add(new T.BoxGeometry(4.5, 0.2, 2.6), M.armor, 2.6, 0, -1.2, 0.45); add(new T.BoxGeometry(4.5, 0.2, 2.6), M.armor, -2.6, 0, -1.2, -0.45);
      add(new T.BoxGeometry(0.2, 1.8, 2.6), M.dark, 0, 1.1, -3.4); add(new T.BoxGeometry(1.4, 0.12, 3), M.glow, 0, 0.62, 1);
      for (const sx of [-1, 1]) { add(new T.CylinderGeometry(0.12, 0.12, 3, 6).rotateX(Math.PI / 2), MAT_GUN, sx * 4.4, 0, 1.4); add(new T.CylinderGeometry(0.55, 0.55, 2.6, 10).rotateX(Math.PI / 2), M.dark, sx * 0.9, 0, -4.4); }
    }
    for (const sx of [-1, 1]) { const flame = new T.Mesh(new T.ConeGeometry(0.5, 4, 10, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -7.6), MAT[team].add); flame.position.x = sx * (team === 1 ? 1.1 : 0.9); r.add(flame); }
    this.obj = r; this.dir = new V3(0, 0, 1); this.speed = 95; this.upv = new V3(0, 1, 0); this.cool = 0; this.think = 0; this.gun = 0; this.mcool = rand(4, 8); this.roll = 0; this.role = 'dog'; this.wp = new V3(); this.wpT = 0; this.rollExtra = 0;
  }
  spawnAt(p, dir) { this.pos.copy(p); this.dir.copy(dir || _v1.set(0, 0, this.team === 1 ? -1 : 1)).normalize(); this.speed = 95; const r = Math.random(); this.role = this.orbital ? 'orbit' : r < 0.55 ? 'dog' : r < 0.82 ? 'strike' : 'cap'; }
  die(src) { this.deadT = 0; this.spin = rand(3, 7) * (Math.random() < 0.5 ? -1 : 1); fxExplosion(this.pos, 1.8); if (!this.isPlayer && !this.noRespawn) SPAWNER.queue(this.orbital ? 'ofighter' : 'fighter', this.team, 14); }
  orient(dt, turnVec) {
    _v1.copy(UP).addScaledVector(turnVec, 0.9); if (this.orbital) _v1.addScaledVector(turnVec, 1);
    _v1.addScaledVector(this.dir, -_v1.dot(this.dir)).normalize();
    this.upv.lerp(_v1, Math.min(1, dt * 4)).normalize();
    _v2.crossVectors(this.upv, this.dir).normalize(); _v3.crossVectors(this.dir, _v2);
    _m.makeBasis(_v2, _v3, this.dir); this.obj.quaternion.setFromRotationMatrix(_m);
    if (this.rollExtra) { _q.setFromAxisAngle(ZAX, this.rollExtra); this.obj.quaternion.multiply(_q); }
    this.obj.position.copy(this.pos);
  }
  steer(dt, desired, rate) {
    const ang = this.dir.angleTo(desired); if (ang < 1e-4) return _v4.set(0, 0, 0);
    const t = Math.min(1, rate * dt / ang); _v4.copy(this.dir);
    _q.setFromUnitVectors(this.dir, desired); _q2.identity().slerp(_q, t); this.dir.applyQuaternion(_q2).normalize();
    return _v4.subVectors(this.dir, _v4).divideScalar(Math.max(dt, 0.001));
  }
  fireLasers(conv) {
    this.gun ^= 1; const sx = (this.team === 1 ? 5 : 4.4) * (this.gun ? 1 : -1);
    _v1.set(sx, 0, 2).applyQuaternion(this.obj.quaternion).add(this.pos); _v2.copy(this.pos).addScaledVector(this.dir, conv);
    fireProj({ from: _v1, to: _v2, maxDist: 900, speed: 650 + this.speed, kind: 'bolt', team: this.team, src: this, dmg: this.isPlayer ? 34 : 24, splash: 1.8, w: 0.22, len: 9, color: TEAM[this.team].laser, fx: 0.6 });
    snd('laser', _v1, this.isPlayer ? 0.35 : 0.4);
  }
  update(dt) {
    if (!this.alive) {
      this.deadT += dt; this.dir.y -= dt * 0.5; this.dir.normalize(); this.pos.addScaledVector(this.dir, this.speed * dt); this.rollExtra += this.spin * dt; this.orient(dt, _v4.set(0, 0, 0));
      FXS.spawn(this.pos.x, this.pos.y, this.pos.z, 0, 0, 0, rand(2, 4), 1.5, 6, 0.06, 0.05, 0.05, 0.22, 0.2, 0.18, 0.9, 0.2, 0.3); FXA.spawn(this.pos.x, this.pos.y, this.pos.z, 0, 0, 0, 0.25, 2, 0.8, 4, 2, 0.6, 1, 0.2, 0.05, 1, 0, 0);
      const gy = groundY(this.pos.x, this.pos.z);
      if (this.pos.y < gy + 1 || buildingAt(this.pos) || this.deadT > 10) { const b = buildingAt(this.pos); if (b) b.damage(3000, this.lastHitBy); fxExplosion(this.pos, 3.2); explodeDamage(this.pos, 9, 250, null, 0); if (H(this.pos.x, this.pos.z) > 0 && Math.random() < 0.5) addEmitter(this.pos.clone().setY(gy + 1), 1.6, 30); this.remove = true; }
      return;
    }
    if (this.isPlayer || this.parked) return;
    this.think -= dt; this.wpT -= dt;
    if (this.think <= 0) {
      this.think = rand(0.5, 1);
      if (this.role === 'orbit') this.target = findTarget(this, 1200, e => e.kind === 'fighter' && e.orbital) || findTarget(this, 900, e => e.kind === 'fighter');
      else if (this.role === 'dog') this.target = findTarget(this, 1100, e => e.kind === 'fighter' && !e.orbital) || findTarget(this, 900, isAir);
      else if (this.role === 'strike') this.target = findTarget(this, 900, e => isGroundVeh(e) || e.kind === 'gunship') || findTarget(this, 900, e => e.kind === 'fighter');
      else { const ec = CAPITALS[3 - this.team]; this.target = ec && ec.alive ? (ec.gens.find(g => g.alive) || ec) : findTarget(this, 900, isAir); }
    }
    if (this.target && !this.target.alive) this.target = null;
    let rate = 1.25 * (120 / Math.max(80, this.speed)); let throttle = 100;
    const desired = _v5;
    if (this.target) {
      this.target.aim(desired); const d = desired.distanceTo(this.pos);
      if (this.target.vel) desired.addScaledVector(this.target.vel, d / 700);
      desired.sub(this.pos).normalize();
      const behind = this.target.kind === 'fighter' && this.target.dir && this.target.dir.dot(_v3.subVectors(this.pos, this.target.pos).normalize()) > 0.6 && d < 250;
      if (d < 70 && this.target.kind !== 'fighter') { desired.y += 0.8; desired.normalize(); }
      if (behind) throttle = 140;
      const ang = this.dir.angleTo(desired); this.cool -= dt; this.mcool -= dt;
      if (ang < 0.09 && d < 550 && this.cool <= 0) { this.fireLasers(Math.min(d, 400)); this.salvo = (this.salvo || 0) + 1; this.cool = this.salvo % 10 === 0 ? rand(0.6, 1.4) : 0.11; }
      if (ang < 0.3 && d < 800 && d > 150 && this.mcool <= 0 && this.target.kind !== 'capital' && this.target.kind !== 'shieldgen') { this.mcool = rand(7, 12); if (this.target.isPlayer) banner('Missile inbound', 'Boost and break hard', 'var(--red)'); fireProj({ from: _v1.copy(this.pos).addScaledVector(this.dir, 4).setY(this.pos.y - 1), to: this.target.aim(_v2), vel: _v3.copy(this.dir).multiplyScalar(this.speed), speed: 230, kind: 'missile', team: this.team, src: this, dmg: this.target.isPlayer ? 110 : 200, splash: 6, w: 0.25, len: 1.4, color: [3, 1.5, 0.5], homing: 2.6, target: this.target, maxDist: 1400, fx: 1.5 }); snd('missile', this.pos, 0.6); }
      if (this.target.kind === 'capital' || this.target.kind === 'shieldgen') { if (d < 140) { desired.y += 1.2; desired.normalize(); } rate *= 0.8; }
    } else {
      if (this.wpT <= 0) { this.wpT = rand(5, 9); if (this.role === 'orbit') this.wp.set(rand(-900, 900), rand(1600, 2400), rand(-900, 900)); else { const cp = pick(CPS); this.wp.set(cp.x + rand(-150, 150), rand(60, 260), cp.z + rand(-150, 150)); if (Math.random() < 0.3) this.wp.set(rand(-150, 150), rand(30, 70), rand(-150, 150)); } }
      desired.subVectors(this.wp, this.pos).normalize();
    }
    // altitude & bounds & obstacle avoidance
    const minAlt = this.role === 'orbit' ? 1400 : 24; const gy = groundY(this.pos.x, this.pos.z);
    const ahead = _v3.copy(this.pos).addScaledVector(this.dir, 70); const ga = groundY(ahead.x, ahead.z);
    if (this.pos.y < gy + minAlt || ahead.y < ga + minAlt * 0.7) { desired.y = Math.max(desired.y, 0.6); desired.normalize(); rate *= 1.4; }
    const bA = buildingAt(ahead) || buildingAt(_v3.copy(this.pos).addScaledVector(this.dir, 35));
    if (bA) { desired.copy(this.dir); desired.y = 1.2; desired.normalize(); rate *= 2; }
    if (this.role !== 'orbit' && this.pos.y > 560) { desired.y = Math.min(desired.y, -0.3); desired.normalize(); }
    if (Math.abs(this.pos.x) > BOUND + 100 || Math.abs(this.pos.z) > BOUND + 100) { desired.set(-this.pos.x, (this.role === 'orbit' ? 1900 : 160) - this.pos.y, -this.pos.z).normalize(); }
    const tv = this.steer(dt, desired, rate);
    this.speed = lerp(this.speed, throttle, dt * 0.6);
    this.pos.addScaledVector(this.dir, this.speed * dt); this.vel.copy(this.dir).multiplyScalar(this.speed);
    if (this.pos.y < groundY(this.pos.x, this.pos.z) + 1.5) { this.lastHitBy = null; this.damage(9999, this, 'crash'); }
    this.orient(dt, tv);
    if (this.pos.y - gy < 40 && Math.random() < 0.4) fxDust(_v3.set(this.pos.x, gy, this.pos.z), 1, 4, 10);
  }
}

/* ---------------- dropship ---------------- */
class Dropship extends Ent {
  constructor(team, mode) {
    super('dropship', team); this.maxHp = this.hp = 700; this.radius = 7; this.cull = 10; this.bulletMul = 0.15;
    const M = MAT[team]; const r = new T.Group(); const add = (g, m, x, y, z) => { const o = new T.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; r.add(o); return o; };
    add(new T.BoxGeometry(6, 4.2, 15), M.armor, 0, 0, 0); add(new T.BoxGeometry(5, 2.4, 4), MAT_GLASS, 0, 0.8, 7.6); add(new T.BoxGeometry(7, 0.6, 10), M.dark, 0, 2.4, -1);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { add(new T.CylinderGeometry(1.1, 1.3, 2.4, 10), M.dark, sx * 4.4, -0.4, sz * 4.5); const d = new T.Mesh(new T.CircleGeometry(1, 12).rotateX(Math.PI / 2), M.add); d.position.set(sx * 4.4, -1.7, sz * 4.5); r.add(d); }
    add(new T.BoxGeometry(5, 0.2, 0.1), M.glow, 0, -1, 7.55);
    this.obj = r; this.mode = mode || 'drop'; this.state = 'launch'; this.lz = new V3(); this.t = 0; this.yaw = 0; this.cp = null; this.boardTarget = null;
  }
  spawnAt(p) { this.pos.copy(p); this.home = p.clone(); this.newLZ(); }
  newLZ() {
    if (this.mode === 'board') { this.state = 'board'; return; }
    const owned = CPS.filter(c => c.owner === this.team); const cp = owned.length && Math.random() < 0.75 ? pick(owned) : pickObjective(this.team, this.pos); this.cp = cp;
    const a = Math.random() * 6.28; this.lz.set(cp.x + Math.cos(a) * 35, 0, cp.z + Math.sin(a) * 35); this.lz.y = groundY(this.lz.x, this.lz.z); this.state = 'fly';
  }
  die(src) { this.deadT = 0; this.spin = 2; fxExplosion(this.pos, 2.5); if (this.mode === 'board') comms(null, this.team === 1 ? 'Boarding craft lost!' : 'Enemy boarding craft destroyed.', 'cmd'); if (!this.oneShot) SPAWNER.queue('dropship', this.team, 30); }
  update(dt) {
    if (!this.alive) { this.deadT += dt; this.vel.y -= 12 * dt; this.pos.addScaledVector(this.vel, dt); this.yaw += this.spin * dt; this.obj.position.copy(this.pos); this.obj.rotation.set(0.3, this.yaw, this.deadT * 0.7, 'YXZ'); FXS.spawn(this.pos.x, this.pos.y, this.pos.z, 0, 1, 0, 4, 2, 8, 0.08, 0.07, 0.06, 0.2, 0.18, 0.16, 0.9, 0.3, 0.4); if (this.pos.y < groundY(this.pos.x, this.pos.z) + 1 || this.deadT > 10) { fxExplosion(this.pos, 4.5); this.remove = true; } return; }
    this.t += dt; let target, spd = 45;
    if (this.state === 'fly') { target = _v1.copy(this.lz); target.y += 90; if (Math.hypot(this.pos.x - target.x, this.pos.z - target.z) < 12) this.state = 'descend'; }
    else if (this.state === 'descend') { target = _v1.copy(this.lz); target.y += 1.8; spd = 14; if (this.pos.y < this.lz.y + 3) { this.state = 'landed'; this.t = 0; fxDust(this.lz, 16, 6, 10); } }
    else if (this.state === 'landed') { target = _v1.copy(this.lz); target.y += 1.8; spd = 2; if (Math.random() < 0.3) fxDust(this.lz, 1, 5, 8); if (this.t > 8) { this.state = 'leave'; this.t = 0; } }
    else if (this.state === 'leave') { target = _v1.set(this.pos.x, 160, this.pos.z); spd = 20; if (this.pos.y > 120) { if (this.oneShot) { this.remove = true; return; } this.newLZ(); } }
    else if (this.state === 'board') {
      const ec = CAPITALS[3 - this.team]; if (!ec || !ec.alive) { this.mode = 'drop'; this.newLZ(); return; }
      ec.hangar(target = _v1); if (this.pos.distanceTo(target) < 10) { this.state = 'docked'; this.t = 0; comms(this.name, this.team === 1 ? `Docked on ${ec.name}. Boarding teams moving to the reactor!` : 'Hostiles aboard! They are cutting toward our reactor!', this.team === 1 ? 'b' : 'r'); banner(this.team === 1 ? 'Boarding party aboard' : 'Our capital ship is boarded', this.team === 1 ? 'Hold the shields down until the reactor blows' : 'Reactor under attack', this.team === 1 ? 'var(--blue)' : 'var(--red)'); }
      spd = 55;
    }
    else if (this.state === 'docked') {
      const ec = CAPITALS[3 - this.team]; if (!ec || !ec.alive) { this.remove = true; return; }
      ec.hangar(_v1); this.pos.copy(_v1); ec.damage(160 * dt, this, 'board');
      if (Math.random() < dt * 2) fxExplosion(_v2.copy(ec.pos).add(randDir(_v3).multiplyScalar(30)), 1.4);
      if (this.t > 26) { this.remove = true; SPAWNER.queue('dropship', this.team, 20); } this.obj.position.copy(this.pos); return;
    }
    _v2.subVectors(target, this.pos); const d = _v2.length(); _v2.multiplyScalar(Math.min(spd, d * 0.7 + 1) / (d || 1));
    this.vel.lerp(_v2, Math.min(1, dt * 0.8)); this.pos.addScaledVector(this.vel, dt);
    const gy = groundY(this.pos.x, this.pos.z); if (this.state !== 'descend' && this.state !== 'landed' && this.pos.y < gy + 30) this.pos.y = lerp(this.pos.y, gy + 30, dt * 2);
    const hb = buildingAt(_v3.set(this.pos.x, this.pos.y - 4, this.pos.z)); if (hb) this.pos.y = hb.top + 8;
    if (this.vel.lengthSq() > 4) this.yaw = angLerp(this.yaw, Math.atan2(this.vel.x, this.vel.z), dt * 1.2);
    this.obj.position.copy(this.pos); this.obj.rotation.set(Math.min(0.25, this.vel.length() * 0.004), this.yaw, 0, 'YXZ');
    if (this.state === 'descend' && this.pos.y - gy < 25 && Math.random() < 0.6) fxDust(_v3.set(this.pos.x, gy, this.pos.z), 2, 5, 10);
  }
}

/* ---------------- naval ships ---------------- */
class Naval extends Ent {
  constructor(team, lane) {
    super('naval', team); this.maxHp = this.hp = 3200; this.radius = 18; this.cull = 45; this.bulletMul = 0.01; this.aimOff = 6; this.lane = lane;
    const NM = buildNavalModel(team, (team === 1 ? 'MCS ' : 'VDS ') + (20 + ((Math.random() * 70) | 0)));
    this.turrets = NM.turrets; this.radars = NM.radars; this.crew = NM.crew; this.funnel = NM.funnel; this.wake = new Wake(); this.smokeT = 0;
    this.obj = NM.obj; this.yaw = team === 1 ? Math.PI : 0; this.cool = rand(2, 4); this.bcool = rand(6, 12); this.wp = new V3(); this.sinkT = 0; this.lastWake = 0;
  }
  spawnAt(p) { this.pos.set(p.x, 0, p.z); this.newWp(); }
  newWp() { const zr = this.team === 1 ? [rand(-250, 300)] : [rand(-300, 250)]; this.wp.set(Math.min(BOUND - 12, coastX(zr[0]) + 50 + this.lane * 60 + rand(-15, 15)), 0, zr[0]); } /* the east sea lanes, inside the map */
  die(src) { this.sinkT = 0; comms(null, `${this.name} is going down! Abandon ship!`, this.team === 1 ? 'b' : 'r'); for (let i = 0; i < 4; i++) addEmitter(new V3(rand(-5, 5), 6, rand(-30, 20)), 2.4, 40, this.obj, new V3(rand(-5, 5), 6, rand(-30, 20))); fxExplosion(_v1.copy(this.pos).setY(6), 5); SPAWNER.queue('naval' + this.lane, this.team, 50); }
  update(dt) {
    const bob = waveH(this.pos.x, this.pos.z);
    if (!this.alive) {
      this.sinkT += dt; const t = this.sinkT;
      this.obj.position.set(this.pos.x, -Math.pow(t, 1.4) * 0.55 + bob * 0.3, this.pos.z); this.obj.rotation.set(Math.min(0.42, t * 0.025), this.yaw, Math.min(0.3, t * 0.015), 'YXZ');
      if (Math.random() < dt * 1.5 && t < 18) fxExplosion(_v1.set(rand(-6, 6), rand(3, 10), rand(-35, 30)).applyMatrix4(this.obj.matrixWorld), rand(1.5, 3));
      if (Math.random() < 0.5) FXS.spawn(this.pos.x + rand(-10, 10), 0.4, this.pos.z + rand(-30, 30), rand(-2, 2), rand(1, 4), rand(-2, 2), 2, 1, 4, 0.8, 0.85, 0.85, 0.6, 0.62, 0.64, 0.6, 1, -2);
      for (const c of this.crew) { c.position.y -= dt * 2; c.position.x += dt * Math.sign(c.position.x || 1) * 3; }
      this.wake.update(this.pos, this.yaw, 0, Math.max(0, 1 - t / 8));
      if (t > 45) { this.remove = true; this.wake.dispose(); } return;
    }
    const tx = this.wp.x - this.pos.x, tz = this.wp.z - this.pos.z; if (Math.hypot(tx, tz) < 40) this.newWp();
    const enemy = findTarget(this, 900, e => e.kind === 'naval');
    const combat = enemy && this.pos.distanceTo(enemy.pos) < 650;
    let want = Math.atan2(tx, tz); if (combat) want = Math.atan2(enemy.pos.x - this.pos.x, enemy.pos.z - this.pos.z) + Math.PI / 2 * (this.lane ? 1 : -1) + Math.sin(TIME * 0.09 + this.lane * 2) * 0.45;
    if (H(this.pos.x + Math.sin(this.yaw) * 90, this.pos.z + Math.cos(this.yaw) * 90) > -14) want = Math.atan2(1, 0);
    const prevYaw = this.yaw; this.yaw = angLerp(this.yaw, want, 0.09 * dt); const turn = angDiff(prevYaw, this.yaw) / Math.max(dt, 1e-3);
    this.spd = lerp(this.spd || 6, combat ? 11 + Math.sin(TIME * 0.2 + this.lane) * 2 : 7 + Math.sin(TIME * 0.05 + this.lane) * 1.5, dt * 0.15); const sp = this.spd;
    this.pos.x += Math.sin(this.yaw) * sp * dt; this.pos.z += Math.cos(this.yaw) * sp * dt;
    if (H(this.pos.x, this.pos.z) > -12) { this.pos.x += 10 * dt; }
    this.vel.set(Math.sin(this.yaw) * sp, 0, Math.cos(this.yaw) * sp);
    const fwdH = waveH(this.pos.x + Math.sin(this.yaw) * 35, this.pos.z + Math.cos(this.yaw) * 35), aftH = waveH(this.pos.x - Math.sin(this.yaw) * 35, this.pos.z - Math.cos(this.yaw) * 35);
    this.heel = lerp(this.heel || 0, clamp(-turn * 3.5, -0.12, 0.12), dt * 0.8); this.recoilR = (this.recoilR || 0) * Math.pow(0.3, dt);
    const swell = Math.sin(TIME * 0.45 + this.pos.z * 0.01) * 0.6;
    this.obj.position.set(this.pos.x, bob * 0.6 + swell * 0.5 - 0.3, this.pos.z);
    this.obj.rotation.set(Math.atan2(aftH - fwdH, 70) * 2 + Math.sin(TIME * 0.6 + this.lane) * 0.012, this.yaw, this.heel + Math.sin(TIME * 0.5 + this.pos.z * 0.02) * 0.035 + this.recoilR, 'YXZ');
    this.radars[0].rotation.y += dt * 1.6; this.radars[1].rotation.y -= dt * 2.4;
    for (const c of this.crew) { const u = c.userData; u.ph += dt * u.s * 0.4; c.position.x = lerp(u.a, u.b, (Math.sin(u.ph) + 1) / 2); c.position.y = u.dy + Math.abs(Math.sin(u.ph * 14)) * 0.04; c.rotation.y = Math.cos(u.ph) > 0 ? Math.PI / 2 : -Math.PI / 2; }
    this.wake.update(this.pos, this.yaw, sp, 1);
    this.smokeT -= dt; if (this.smokeT <= 0) { this.smokeT = 0.12; this.obj.localToWorld(_v1.copy(this.funnel)); FXS.spawn(_v1.x, _v1.y, _v1.z, rand(-0.5, 0.5) - this.vel.x * 0.6, rand(2, 4), rand(-0.5, 0.5) - this.vel.z * 0.6, rand(5, 9), 2, 9, 0.28, 0.27, 0.26, 0.45, 0.43, 0.42, 0.5, 0.2, 0.2); }
    const aimP = this.aimPt; for (const t of this.turrets) { const want = aimP ? Math.atan2(aimP.x - this.pos.x, aimP.z - this.pos.z) - this.yaw : Math.sin(TIME * 0.2 + t.position.z) * 0.4; t.rotation.y = angLerp(t.rotation.y, want, dt * 0.8); }
    this.lastWake += dt;
    if (this.lastWake > 0.05) { this.lastWake = 0; const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      FXS.spawn(this.pos.x - s * 45 + rand(-3, 3), 0.4, this.pos.z - c * 45 + rand(-3, 3), -s * 3 + rand(-1, 1), rand(0.5, 2), -c * 3 + rand(-1, 1), rand(3, 6), 3, 10, 0.85, 0.9, 0.92, 0.6, 0.64, 0.66, 0.6, 0.4, -0.5);
      for (const side of [-1, 1]) FXS.spawn(this.pos.x + s * 44 + c * side * 2, 0.8, this.pos.z + c * 44 - s * side * 2, c * side * 5 + s * 2, rand(2, 4.5), -s * side * 5 + c * 2, rand(0.8, 1.6), 1.2, 4.5, 0.9, 0.93, 0.95, 0.65, 0.68, 0.7, 0.75, 0.6, -9);
    }
    this.cool -= dt; this.bcool -= dt;
    if (enemy && this.cool <= 0 && this.pos.distanceTo(enemy.pos) < 850) { this.cool = rand(2.5, 4); this.broadside(enemy.aim(new V3()).add(randDir(_v3).multiplyScalar(18))); }
    if (this.bcool <= 0) {
      this.bcool = rand(9, 15); const tgts = CPS.filter(c => c.owner !== this.team && c.x > 100); const cp = tgts.length ? pick(tgts) : null;
      if (cp) { const e = findTarget({ pos: cp.pos, team: this.team }, 60); const tp = e ? e.pos.clone() : cp.pos.clone().add(new V3(rand(-30, 30), 0, rand(-30, 30))); this.broadside(tp, true); }
    }
  }
  broadside(tp, bombard) {
    this.turrets.forEach((t, i) => {
      this.aimPt = tp.clone(); t.getWorldPosition(_v1); const want = Math.atan2(tp.x - _v1.x, tp.z - _v1.z) - this.yaw; t.rotation.y = want;
      for (let k = 0; k < 2; k++) setTimeout(() => {
        if (!this.alive) return; t.getWorldPosition(_v1); _v1.y += 2; const a = this.yaw + t.rotation.y; _v1.x += Math.sin(a) * 11; _v1.z += Math.cos(a) * 11;
        const d = Math.hypot(tp.x - _v1.x, tp.z - _v1.z); const Tf = Math.max(2, d / 170); const g = 9.8 * 0.7; _v2.copy(tp).add(randDir(_v3).multiplyScalar(bombard ? 14 : 10)); _v2.y = Math.max(_v2.y, 0);
        const vel = new V3((_v2.x - _v1.x) / Tf, (_v2.y - _v1.y + 0.5 * g * Tf * Tf) / Tf, (_v2.z - _v1.z) / Tf);
        fireProj({ from: _v1, to: _v2, vel, kind: 'shell', team: this.team, src: this, dmg: 300, splash: 9, w: 0.5, len: 4, color: [3, 2, 1], grav: 0.7, maxDist: 1e9, life: 20, fx: 2.2 });
        fxMuzzle(_v1, [5, 3.5, 2]); for (let j = 0; j < 6; j++) FXS.spawn(_v1.x, _v1.y, _v1.z, Math.sin(a) * rand(4, 10), rand(0, 3), Math.cos(a) * rand(4, 10), rand(2, 4), 3, 9, 0.35, 0.33, 0.3, 0.45, 0.42, 0.4, 0.7, 0.8, 0.5);
        flashLight(_v1, 6, 60, 0.15, 0xffc080); snd('heavy', _v1, 1.2); shake(0.15, _v1); this.recoilR += (Math.sin(a - this.yaw) > 0 ? -1 : 1) * 0.015; FXS.spawn(_v1.x, 0.5, _v1.z, 0, 2, 0, 1.6, 4, 12, 0.85, 0.9, 0.92, 0.6, 0.64, 0.66, 0.5, 0.5, 0);
      }, (i * 2 + k) * 260);
    });
  }
}

/* ---------------- capital ships ---------------- */
function buildCapital(team, fogless, scale = 1) {
  /* every part is static, so the whole ship bakes down to one mesh per material: five draw calls instead of fifty,
     across ten capitals, two dreadnoughts and six cruisers that are almost always somewhere on screen */
  const M = MAT[team]; const fl = fogless ? { fog: false } : {};
  const mats = {
    hull: fogless ? std(team === 1 ? 0x59626c : 0x3b3030, 0.6, 0.4, { fog: false, emissive: team === 1 ? 0x10161c : 0x1a0c0a }) : M.hull,
    dark: fogless ? std(0x1c1d20, 0.7, 0.3, fl) : M.dark,
    glow: basic(team === 1 ? new T.Color(1, 2.2, 3.2) : new T.Color(3.4, 1.0, 0.4), fl),
    plume: addMat(team === 1 ? 0x2f8fff : 0xff4a1a, 0.5, fl),
    lights: basic(team === 1 ? new T.Color(1, 2.2, 3.2) : new T.Color(3.4, 1.0, 0.4), fl),
  };
  const b = bucket(), add = (g, k, x, y, z) => b.add(k, g.translate(x, y, z));
  const hg = new T.BoxGeometry(56, 20, 220, 2, 2, 12); const hp = hg.attributes.position;
  for (let i = 0; i < hp.count; i++) { let x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i); if (z > -40) x *= 1 - ((z + 40) / 150) * 0.85; if (y < 0) x *= 0.78; if (team === 2 && y > 0) y += (z / 110) * -4; hp.setXYZ(i, x, y, z); }
  boxProjUV(hg, 24, false); b.add('hull', hg);
  const ug = new T.BoxGeometry(30, 10, 100, 1, 1, 4); const up = ug.attributes.position; for (let i = 0; i < up.count; i++) { if (up.getZ(i) > 0) up.setX(i, up.getX(i) * 0.5); } boxProjUV(ug, 24, false); add(ug, 'hull', 0, 14, -40);
  add(new T.BoxGeometry(16, 22, 14), 'dark', 0, 30, -82); add(new T.BoxGeometry(17, 1.2, 0.4), 'glow', 0, 38, -74.8);
  add(new T.BoxGeometry(28, 2, 6), 'dark', 0, 41, -82);
  for (const ex of [-18, 0, 18]) {
    add(new T.CylinderGeometry(6.5, 7.5, 16, 14).rotateX(Math.PI / 2), 'dark', ex, 0, -116);
    b.add('glow', new T.CircleGeometry(5.6, 16).rotateY(Math.PI).translate(ex, 0, -124.2));
    b.add('plume', new T.ConeGeometry(5.5, 40, 16, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -20).translate(ex, 0, -124));
  }
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) { const z = 60 - i * 30; const w = (z > -40 ? 28 * (1 - ((z + 40) / 150) * 0.85) : 28); add(new T.BoxGeometry(4, 3, 5), 'dark', sx * (w + 1), 4, z); }
  add(new T.BoxGeometry(20, 1, 30), 'glow', 0, -10.6, 15);
  for (let i = 0; i < 14; i++) add(new T.BoxGeometry(0.8, 0.8, 0.8), 'lights', rand(-20, 20), rand(-8, 10), rand(-100, 60));
  const r = new T.Group(); bakeInto(r, b, mats, fogless ? [] : ['hull', 'dark']);
  for (const o of r.children) if (o.material === mats.lights) o.userData.blink = Math.random() * 6; /* the running lights blink as one */
  r.scale.setScalar(scale);
  return r;
}
const CAPITALS = { 1: null, 2: null }; /* the capital ships are gone; this stays empty so the fighters and dropships that used to ask for one fall back to flying in from the horizon */
const DREADS = {};
for (const t of [1, 2]) { const d = buildCapital(t, true, 3.2); d.position.copy(t === 1 ? new V3(-650, 2050, 950) : new V3(650, 2150, -950)); d.rotation.y = t === 1 ? Math.PI * 0.85 : -0.15; scene.add(d); DREADS[t] = d; }
let dreadDuelT = 4;
const STRIKES = [];
const strikeRingMat = t => addMat(t === 1 ? 0x3fb6ff : 0xff3010, 0.8, { side: T.DoubleSide });
function callOrbital(p, team, src) {
  const g = new T.Group(); const r1 = new T.Mesh(new T.RingGeometry(30, 32, 64).rotateX(-Math.PI / 2), strikeRingMat(team)); const r2 = new T.Mesh(new T.RingGeometry(0, 4, 32).rotateX(-Math.PI / 2), strikeRingMat(team)); g.add(r1, r2);
  g.position.set(p.x, groundY(p.x, p.z) + 1, p.z); scene.add(g);
  STRIKES.push({ p: g.position.clone(), team, src, t: 0, g, r1, fired: false });
  comms(team === 1 ? 'MCS Aurelian Orbital' : null, team === 1 ? 'Orbital lance locked. Impact in four seconds. Clear the zone.' : 'Enemy orbital lance locking on! Get clear!', team === 1 ? 'b' : 'cmd');
  const pe = PLAYER.ent; if (team === 2 && pe && pe.alive && pe.pos.distanceTo(p) < 80) banner('Orbital strike inbound', 'Move out of the red zone', 'var(--red)');
}
function updateStrikes(dt) {
  dreadDuelT -= dt;
  if (dreadDuelT <= 0) { dreadDuelT = rand(4, 8); const a = DREADS[1].position, b = DREADS[2].position; const t = Math.random() < 0.5 ? 1 : 2; const from = t === 1 ? a : b, to = t === 1 ? b : a; _v1.copy(from).add(randDir(_v2).multiplyScalar(60)); _v3.copy(to).add(randDir(_v2).multiplyScalar(90)); beam(_v1, _v3, 3, 2.2, TEAM[t].hex); FXA.spawn(_v3.x, _v3.y, _v3.z, 0, 0, 0, 1.5, 120, 260, 4, 3, 2, 1, 0.3, 0.1, 1, 0, 0); }
  for (let i = STRIKES.length - 1; i >= 0; i--) {
    const s = STRIKES[i]; s.t += dt;
    s.r1.material.opacity = 0.5 + 0.5 * Math.sin(s.t * 14); const k = 1 - Math.min(1, s.t / 4); s.r1.scale.setScalar(0.25 + 0.75 * k + 0.0001);
    if (s.t > 4 && !s.fired) {
      s.fired = true; const from = DREADS[s.team].position; beam(_v1.copy(from), s.p, 9, 2, TEAM[s.team].hex);
      fxExplosion(s.p, 7); explodeDamage(s.p, 34, 1400, s.src, s.team); shockRing(s.p, 140, 1.6); shake(2.2, s.p); snd('big', s.p, 2);
      for (let j = 0; j < 30; j++) { const a = Math.random() * 6.283, r = rand(5, 40); fxDust(_v2.set(s.p.x + Math.cos(a) * r, s.p.y, s.p.z + Math.sin(a) * r), 1, 10, 14); }
      addEmitter(s.p.clone().setY(s.p.y + 2), 4, 80); flashLight(_v1.copy(s.p).setY(s.p.y + 20), 20, 400, 1.2, 0xffe0c0);
    }
    if (s.fired && s.t < 5.8 && Math.random() < dt * 6) fxExplosion(_v2.set(s.p.x + rand(-25, 25), s.p.y + rand(0, 6), s.p.z + rand(-25, 25)), rand(2, 3.5));
    if (s.t > 6) { scene.remove(s.g); STRIKES.splice(i, 1); }
  }
}
function spawnPoint(team, prefer) {
  let cp = prefer;
  if (!cp) { const owned = CPS.filter(c => c.owner === team); if (owned.length && Math.random() < 0.8) cp = pick(owned); }
  if (cp && cp !== 'hq' && cp.owner === team) { const a = Math.random() * 6.28, r = rand(6, 22); _v1.set(cp.x + Math.cos(a) * r, 0, cp.z + Math.sin(a) * r); pushOut(_v1, 1); return _v1.clone(); }
  const h = HQ[team] || HQ[2] || HQ[1]; /* a team with no muster of its own falls back rather than taking the frame down with it */
  return new V3(h.x + rand(-40, 40), 0, h.z + rand(-20, 20));
}
const SPAWNER = {
  q: [],
  queue(type, team, delay) { this.q.push({ type, team, t: delay }); },
  update(dt) {
    for (let i = this.q.length - 1; i >= 0; i--) { const s = this.q[i]; s.t -= dt; if (s.t <= 0) { this.q.splice(i, 1); if (s.type === 'soldier' && GAME.clock > 8 && ARRIVAL.pool[s.team] !== undefined) ARRIVAL.pool[s.team]++; else spawnUnit(s.type, s.team); } /* infantry reinforcements arrive by bus, plane, sea or lift */ }
  },
};
function spawnUnit(type, team) {
  if (GAME.state === 'end') return null;
  let e;
  if (type === 'soldier') {
    e = new Soldier(team);
    const ds = ENTS.find(d => d.kind === 'dropship' && d.team === team && d.alive && d.state === 'landed');
    e.spawnAt(ds && Math.random() < 0.6 ? _v1.copy(ds.lz).add(new V3(rand(-6, 6), 0, rand(-6, 6))) : spawnPoint(team));
  } else if (type === 'tank') { e = new Tank(team); e.spawnAt(spawnPoint(team, 'hq')); }
  else if (type === 'walker') { e = new Walker(team); e.spawnAt(spawnPoint(team, 'hq')); comms(null, team === 1 ? `Walker ${e.name} deploying from HQ.` : `Enemy walker spotted leaving their HQ.`, 'cmd'); }
  else if (type === 'gunship') { e = new Gunship(team); e.spawnAt(spawnPoint(team, 'hq')); }
  else if (type === 'fighter' || type === 'ofighter') {
    e = new Fighter(team, type === 'ofighter'); const cap = CAPITALS[team];
    if (type === 'ofighter') e.spawnAt(DREADS[team].position.clone().add(new V3(rand(-80, 80), -60, rand(-80, 80))), new V3(rand(-1, 1), 0, team === 1 ? -1 : 1));
    else if (cap && cap.alive) { cap.hangar(_v1); e.spawnAt(_v1.clone().add(new V3(rand(-8, 8), -4, 0)), new V3(rand(-0.4, 0.4), -0.25, team === 1 ? -1 : 1)); }
    else e.spawnAt(new V3(rand(-300, 300), 300, team === 1 ? 1100 : -1100), new V3(0, -0.1, team === 1 ? -1 : 1));
  }
  else if (type === 'shiftframe') { e = new Shiftframe(team); e.spawnAt(spawnPoint(team, 'hq')); }
  else if (type === 'speeder') { e = new Speeder(team); const rt = e.route; const w = rt[(Math.random() * rt.length) | 0]; e.spawnAt(new V3(w[0] + rand(-20, 20), 0, w[1] + rand(-20, 20)), Math.random() * 6.28); }
  else if (type === 'dropship') { e = new Dropship(team); const cap = CAPITALS[team]; e.spawnAt(cap && cap.alive ? cap.hangar(new V3()) : new V3(HQ[team].x, 200, HQ[team].z)); }
  else if (type.startsWith('naval')) { const lane = +type.slice(5) || 0; e = new Naval(team, lane); const z = team === 1 ? 560 : -560; e.spawnAt(new V3(coastX(z) + 70 + lane * 60, 0, z)); }
  if (e) addEnt(e); /* no flag bearers: armies read by helmet colour */
  return e;
}
const FORCE = { shiftframe: 2, soldier: LOW_END ? 18 : 26, tank: 2, walker: 2, gunship: 2, fighter: 5, ofighter: 3, dropship: 2, speeder: 4 };
