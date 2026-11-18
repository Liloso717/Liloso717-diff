'use strict';
/* ===================== IRON MERIDIAN · powers: you are not carrying a rifle, you are the weapon ===================== */
// The Hero has no guns. The whole kit, and nothing else on the keys:
//  · FLIGHT       · Space · you fly, Space again and you drop · Shift faster · X down
//  · THE FORCE    · F or left click · a car in reach lifts off the road (or is pulled in from down the street);
//                  press again to throw it where you look. What it lands on it flattens.
//  · 1 TORNADO · 2 HURRICANE · 3 COMET · 4 THUNDER STRIKE · 5 AIR STRIKE, all on your aim point
//  · THE DIVE     · right click (or the DIVE pad) while flying · fold up and smash down where you are looking
const POW = { fly: false, flyCd: 0, flyT: 0, tk: null, tkCd: 0, cars: [], hintT: 0, dirty: true, drawn: 0 };
const _pv = new V3(); /* reused: the powers never allocate in the frame */
const TK_GRAB = 16, TK_PULL = 46, TK_SPEED = 64;
/* ---------- the civilian cars you can pick up ---------- */
const CARS = (() => {
  const g = mergeGeos([xf(rbox(1.9, 0.75, 4.4, 0.25), [0, 0.65, 0]), xf(rbox(1.7, 0.6, 2.2, 0.25), [0, 1.25, -0.2]),
    xf(new T.CylinderGeometry(0.34, 0.34, 2.0, 10), [0, 0.34, 1.35], [0, 0, Math.PI / 2]), xf(new T.CylinderGeometry(0.34, 0.34, 2.0, 10), [0, 0.34, -1.35], [0, 0, Math.PI / 2])]);
  const im = new T.InstancedMesh(g, std(0xffffff, 0.35, 0.55), 72); im.castShadow = im.receiveShadow = true; im.frustumCulled = false; scene.add(im);
  im.instanceColor = new T.InstancedBufferAttribute(new Float32Array(72 * 3), 3); return im;
})();
const CAR_COL = [0xb8bcc0, 0x2a4a6a, 0x8a2a20, 0x2e2e30, 0xd8d0b8, 0x3a5a3a, 0xc08a2a, 0x7a2a5a];
(function parkCars() { /* a handful of abandoned cars on the streets of every district */
  for (const cp of CPS) {
    for (let i = 0; i < 5 && POW.cars.length < 50; i++) {
      const a = Math.random() * 6.283, r = rand(28, 64), x = cp.x + Math.cos(a) * r, z = cp.z + Math.sin(a) * r; /* out on the streets, not parked where you stand */
      if (H(x, z) < 1.2 || buildingAt(_v1.set(x, H(x, z) + 1.2, z))) continue;
      POW.cars.push({ pos: new V3(x, 0, z), vel: new V3(), yaw: rand(0, 6.283), roll: 0, pitch: 0, spin: 0, state: 'rest', col: pick(CAR_COL), burn: 0 });
      POW.cars[POW.cars.length - 1].pos.y = groundY(x, z);
    }
  }
})();
const _eul = new T.Euler();
function carDraw() {
  if (!POW.dirty) return; /* a street of parked cars costs nothing: the buffers are only rewritten when one moves */
  POW.dirty = false;
  let n = 0;
  for (const c of POW.cars) {
    if (n >= 72) break;
    _eul.set(c.pitch, c.yaw, c.roll); _q.setFromEuler(_eul); _m.compose(c.pos, _q, _s.set(1, 1, 1));
    CARS.setMatrixAt(n, _m); if (CARS.instanceColor) CARS.instanceColor.setXYZ(n, ((c.col >> 16) & 255) / 255, ((c.col >> 8) & 255) / 255, (c.col & 255) / 255); n++;
  }
  CARS.count = n; CARS.instanceMatrix.needsUpdate = true; if (CARS.instanceColor) CARS.instanceColor.needsUpdate = true;
}
function carImpact(c) { /* what a two-tonne car does when it arrives */
  const p = c.pos;
  let hit = 0; for (const e of ENTS) if (e.alive && e.team === 2 && e.kind === 'soldier' && e.pos.distanceToSquared(p) < 49) hit++;
  explodeDamage(p, 7, 340, PLAYER.ent, 1);
  if (hit) { let left = 0; for (const e of ENTS) if (e.alive && e.team === 2 && e.kind === 'soldier' && e.pos.distanceToSquared(p) < 49) left++; if (hit > left && typeof contractProgress === 'function') contractProgress('throw', hit - left); }
  fxExplosion(p, 0.8, { smoke: 1 }); fxDust(_v1.copy(p), 10, 4, 7); shake(0.5, p); snd('heavy', p, 0.8);
  for (const b of bldNear(p.x, p.z, 8, [])) if (b.alive && b.cover) b.damage(500, PLAYER.ent);
  c.burn = rand(10, 24); c.state = 'rest'; c.vel.set(0, 0, 0); POW.dirty = true;
  addEmitter(new V3(p.x, p.y + 1, p.z), 0.9, c.burn);
  awardPoints(25, 'Thrown car');
}
function carTick(dt) {
  for (const c of POW.cars) {
    if (c.state === 'held') { POW.dirty = true; continue; }
    if (c.state === 'rest' && c.vel.lengthSq() < 0.01) { if (c.burn > 0) { c.burn -= dt; if (camera.position.distanceToSquared(c.pos) < 40000 && Math.random() < dt * 8) FXA.spawn(c.pos.x + rand(-1, 1), c.pos.y + 1, c.pos.z + rand(-1, 1), 0, rand(1.5, 3), 0, 1.1, 0.5, 1.6, 1.4, 1.0, 0.4, 0.5, 0.3, 0.1, 1, 0, -1); } continue; }
    POW.dirty = true;
    c.vel.y -= 22 * dt;
    c.pos.addScaledVector(c.vel, dt);
    c.yaw += c.spin * dt; c.pitch += c.spin * 0.7 * dt;
    const g = surfY(c.pos.x, c.pos.z, c.pos.y + 1);
    if (c.state === 'thrown') {
      let hit = buildingAt(_v1.copy(c.pos)) ? true : false;
      if (!hit) for (const e of ENTS) if (e.alive && e.team !== 1 && e.hitR && e.kind !== 'capital' && e.pos.distanceToSquared(c.pos) < 36) { hit = true; break; }
      if (c.pos.y <= g + 0.4 || hit) { c.pos.y = Math.max(g, c.pos.y); carImpact(c); c.pitch = rand(-0.2, 0.2); c.roll = rand(-0.3, 0.3); continue; }
      if (Math.random() < dt * 30) FXS.spawn(c.pos.x, c.pos.y, c.pos.z, 0, 0.4, 0, 1.2, 0.5, 1.8, 0.5, 0.48, 0.45, 0.4, 0.38, 0.35, 0.6, 1, 0.2);
    } else if (c.pos.y <= g) { /* rolling to a stop */
      c.pos.y = g; c.vel.y = 0; c.vel.x *= 0.82; c.vel.z *= 0.82; c.spin *= 0.8;
      if (c.vel.lengthSq() < 0.05) { c.vel.set(0, 0, 0); c.spin = 0; c.state = 'rest'; }
    }
  }
}
/* ---------- telekinesis ---------- */
function tkFind(pe) {
  let best = null, bd = 1e9;
  for (const c of POW.cars) { if (c.state === 'held' || c.state === 'thrown') continue; const d = c.pos.distanceToSquared(pe.pos); if (d < bd) { bd = d; best = c; } }
  if (!best) return null; const d = Math.sqrt(bd);
  return d < TK_PULL ? { c: best, d } : null;
}
function tkGrab(c, pull) {
  POW.tk = c; c.state = 'held'; POW.dirty = true; c.vel.set(0, 0, 0); c.spin = 2.2;
  /* it tears loose: road dust where it sat, a ring where the grip took it */
  fxDust(_v1.copy(c.pos), nfx(10), 3, 6); shockRing(c.pos, 8, 0.5, 0x7fd0ff); if (isWater(c.pos.x, c.pos.z)) sprayUp(c.pos.x, c.pos.z, 1.2, 2);
  snd(pull ? 'heavy' : 'chime', c.pos, 0.5); shake(pull ? 0.2 : 0.08, c.pos);
  if (pull) comms('You', 'Pulling it in.', 'b');
}
function tkThrow() {
  const c = POW.tk; if (!c) return; POW.tk = null; c.state = 'thrown'; POW.dirty = true;
  const dir = camDir(_pv);
  c.vel.copy(dir).multiplyScalar(TK_SPEED); c.vel.y += 6; c.spin = rand(3, 7);
  snd('missile', c.pos, 0.7); shake(0.18);
  { const pe = PLAYER.ent; if (pe) shockRing(pe.pos, 10, 0.4, 0x7fd0ff); } /* the push leaves your hands as a ring */
  FXA.spawn(c.pos.x, c.pos.y + 1, c.pos.z, 0, 0, 0, 2.4, 0.5, 1.2, 0.6, 1.4, 2.2, 0.4, 0.6, 1, 1, 0, 0);
}
function tkTick(dt) {
  const P = PLAYER, pe = P.ent, c = POW.tk; POW.tkCd -= dt;
  if (c) {
    if (!pe || !pe.alive || pe.mount) { c.state = 'rest'; POW.tk = null; POW.dirty = true; return; }
    const dir = camDir(_pv), t = _v1.copy(pe.pos).addScaledVector(dir, 7); t.y = pe.pos.y + 2.4 + dir.y * 5;
    c.pos.lerp(t, Math.min(1, dt * 7)); c.yaw += dt * 1.6; c.pitch = Math.sin(TIME * 2) * 0.12;
    if (Math.random() < dt * 20) FXA.spawn(c.pos.x + rand(-2, 2), c.pos.y + rand(-1, 1), c.pos.z + rand(-2, 2), 0, 0.5, 0, 0.4, 0.4, 0.8, 0.5, 1.6, 2.4, 0.3, 0.5, 1, 1, 0, 0);
    /* the cause made visible: a current running from your hands to the car the whole time you hold it */
    { const hx = pe.pos.x, hy = pe.pos.y + 1.3, hz = pe.pos.z; for (let i = 0; i < nfx(3); i++) { const u = Math.random(); FXA.spawn(lerp(hx, c.pos.x, u) + rand(-0.3, 0.3), lerp(hy, c.pos.y + 0.8, u) + rand(-0.3, 0.3), lerp(hz, c.pos.z, u) + rand(-0.3, 0.3), (c.pos.x - hx) * 0.6, (c.pos.y - hy) * 0.6, (c.pos.z - hz) * 0.6, 0.25, 0.5, 0.15, 0.6, 1.6, 3, 0.3, 0.8, 2, 1, 0, 0); } }
    if (c.pos.y - groundY(c.pos.x, c.pos.z) < 2 && Math.random() < dt * 12) fxDust(_v1.copy(c.pos), 1, 2.5, 4); /* dragged in along the road */
  }
  if (!keys.KeyF || POW.tkCd > 0 || GAME.state !== 'play' || !pe || !pe.alive || pe.mount) return;
  keys.KeyF = false; POW.tkCd = 0.25;
  if (c) { tkThrow(); return; }
  const f = tkFind(pe); if (!f) { if (TIME - (POW.noneT || -9) > 3) { POW.noneT = TIME; banner('Nothing in reach', 'The Force needs something loose — a car on the street', 'var(--amber)'); } return; }
  tkGrab(f.c, f.d > TK_GRAB);
}
/* ---------- flight ---------- */
function flyStep(dt, f, s) {
  const P = PLAYER, e = P.ent, M = MOB;
  POW.flyT += dt;
  if (keys.Space && POW.flyCd <= 0) { keys.Space = false; POW.fly = false; POW.flyCd = 0.3; P.vy = 0; return; }
  const space = e.pos.y > BARRIER_Y; /* above the barrier there is nothing to push against and nothing to slow you */
  const dir = camDir(_pv), boost = (keys.ShiftLeft || keys.ShiftRight) ? 2.6 : 1, spd = (space ? 78 : 48) * boost;
  const rx = -Math.cos(P.yaw), rz = Math.sin(P.yaw);
  const vx = dir.x * f * spd + rx * s * spd * 0.7, vz = dir.z * f * spd + rz * s * spd * 0.7;
  let vy = dir.y * f * spd + (keys.KeyX || keys.KeyC ? -26 : 0);
  if (f <= 0.05 && !(keys.KeyX || keys.KeyC)) vy += 3; /* hover drifts gently up rather than stalling */
  if (POW.climb > 0) { const k = Math.min(1, POW.climb); POW.climb -= dt; vy += 26 * k; }
  if (space) { /* you are out of the air: the trail thins and the stars come up */
    if (Math.random() < dt * 8) FXA.spawn(e.pos.x + rand(-1, 1), e.pos.y + rand(-1, 1), e.pos.z + rand(-1, 1), 0, 0, 0, 1.1, 0.5, 0.1, 0.5, 1.4, 2.6, 0.2, 0.6, 1.6, 0.8, 0, 0);
  } else if (POW.reentry > 0) { /* and coming back down, you burn */
    POW.reentry -= dt;
    for (let i = 0; i < 2; i++) FXA.spawn(e.pos.x + rand(-1.2, 1.2), e.pos.y + rand(-1, 2), e.pos.z + rand(-1.2, 1.2), -vx * 0.06, -vy * 0.06 + 2, -vz * 0.06, 0.5, 1.6, 0.4, 4, 2, 0.5, 1.5, 0.4, 0.1, 1, 0.4, 0);
    if (Math.random() < dt * 3) snd('hiss', null, 0.25);
  }
  POW.spd = Math.hypot(vx, vz); /* the camera widens with it */
  M.v.set(vx, 0, vz);
  const lim = bnd(e.pos.y);
  /* at a hundred metres a second you cross a tower in a single frame, so step the move and stop at the wall rather
     than waking up inside it */
  const nx = clamp(e.pos.x + vx * dt, -lim, lim), nz = clamp(e.pos.z + vz * dt, -lim, lim), ny = clamp(e.pos.y + vy * dt, -5, 1244); /* the barrier at 1250 m is a ceiling: no flying up into space */
  const steps = Math.min(4, 1 + ((Math.hypot(nx - e.pos.x, ny - e.pos.y, nz - e.pos.z) / 6) | 0));
  let ox = e.pos.x, oy = e.pos.y, oz = e.pos.z, hit = false;
  for (let i = 1; i <= steps; i++) {
    const k = i / steps, px = lerp(e.pos.x, nx, k), py = lerp(e.pos.y, ny, k), pz = lerp(e.pos.z, nz, k);
    if (buildingAt(_v3.set(px, py, pz))) { hit = true; break; }
    ox = px; oy = py; oz = pz;
  }
  e.pos.set(ox, oy, oz);
  if (hit) { fxSparks(_v1.copy(e.pos), 8, [1.4, 2.4, 4], 7); shake(0.25, e.pos); snd('clank', e.pos, 0.35); }
  pushOut(e.pos, 0.5); deckClamp(e.pos, true);
  const g = Math.max(surfY(e.pos.x, e.pos.z, e.pos.y), roofUnder(e.pos));
  if (e.pos.y <= g + 0.3 && vy < -1) { e.pos.y = g; POW.fly = false; P.vy = 0; P.grounded = true; fxDust(_v1.set(e.pos.x, g, e.pos.z), 6, 3, 5); snd('stomp', null, 0.3); }
  else if (e.pos.y < g + 0.3) e.pos.y = g + 0.3; /* skimming: you hold the hover instead of being dumped on the ground */
  else { P.grounded = false; P.vy = 0; P.free = false; P.para = false; }
  if (Math.random() < dt * 40) FXA.spawn(e.pos.x + rand(-0.4, 0.4), e.pos.y + 0.5, e.pos.z + rand(-0.4, 0.4), -vx * 0.1, -0.5, -vz * 0.1, 0.5, 0.4, 0.9, 0.5, 1.7, 2.6, 0.2, 0.5, 1.6, 1, 0, 0);
  e.yaw = P.yaw + Math.PI; e.moveSpeed = Math.hypot(vx, vz); e.crouch = false;
}
{ /* This is not a game about walking. Space lifts you off the ground on the spot — standing, running, falling, under
     a chute, it does not matter — and Space again drops you out of the sky. Walking is what you do in the last ten
     metres. */
  const _mt = moveTrooper;
  function takeOff(dt, f, s) {
    const P = PLAYER, e = P.ent;
    keys.Space = false; POW.fly = true; POW.flyCd = 0.3; POW.flyT = 0; P.free = false; P.grounded = false;
    if (P.para) { P.para = false; showCanopy(e, false); }
    if (MOB.slide > 0) MOB.slide = 0;
    e.pos.y += 0.6; P.vy = 0; POW.climb = 1.1; /* the first second lifts you over the rooftops instead of into them */
    snd('ui', null, 0.45); flashLight(e.pos, 3, 18, 0.25, 0x7fd0ff);
    fxDust(_v1.set(e.pos.x, surfY(e.pos.x, e.pos.z, e.pos.y), e.pos.z), 9, 3.5, 7);
    for (let i = 0; i < 10; i++) FXA.spawn(e.pos.x + rand(-0.6, 0.6), e.pos.y + rand(0, 1.2), e.pos.z + rand(-0.6, 0.6), rand(-2, 2), rand(-6, -2), rand(-2, 2), 0.5, 0.6, 1.4, 0.5, 1.7, 2.8, 0.2, 0.5, 1.6, 1, 0, 0);
    flyStep(dt, f, s);
  }
  moveTrooper = function (dt, f, s, sprint) {
    const P = PLAYER, e = P.ent;
    if (POW.dive) { if (!e || !e.alive) { POW.dive = null; } else { diveStep(dt); return; } }
    if (POW.fly) {
      if (!e || !e.alive || P.pod) { POW.fly = false; POW.diveReq = false; }
      else {
        /* the dive: right click on a mouse, the DIVE pad on glass, only while flying */
        if ((mouse.pressed[2] || POW.diveReq) && GOD.cd.dive <= 0) { mouse.pressed[2] = false; POW.diveReq = false; if (startDive()) { diveStep(dt); return; } }
        POW.diveReq = false;
        flyStep(dt, f, s); return;
      }
    }
    if (keys.Space && !P.pod && !MOB.mantle && POW.flyCd <= 0 && e && e.alive) { takeOff(dt, f, s); return; }
    return _mt(dt, f, s, sprint);
  };
}
{ /* the pose: upright on a hover, leaning out flat into the cruise, cape streaming */
  const _anim = Soldier.prototype.animate;
  Soldier.prototype.animate = function (dt, speed) {
    _anim.call(this, dt, speed);
    if (!this.isPlayer || !POW.fly) return;
    const k = clamp((POW.spd || 0) / 52, 0, 1);
    this.obj.rotation.x = -k * 1.15;
    this.obj.position.y += k * 0.5;
  };
}
/* a Hero passes the barrier: flying up through it ripples it instead of stopping you */
{
  const _rr = realmRules;
  realmRules = function () {
    _rr();
    const P = PLAYER, e = P.ent; if (!e || !e.alive) return;
    const above = e.pos.y > BARRIER_Y;
    if (POW.fly && Math.abs(e.pos.y - BARRIER_Y) < 8 && typeof barrierHit === 'function') barrierHit(e, 0.5);
    if (above !== POW.space) { /* the barrier that turns starships back lets a Hero through, once each way */
      POW.space = above;
      if (above) { banner('Orbit', 'You are through the barrier · the fleet is up here', 'var(--blue)'); comms('You', 'Through the barrier. I am in orbit.', 'b'); snd('ui', null, 0.6); shake(0.5); }
      else { POW.reentry = 4; banner('Re-entry', 'Coming down hot', 'var(--amber)'); snd('big', null, 0.5); shake(0.8); }
      if (typeof barrierHit === 'function') barrierHit(e, 1.4);
    }
  };
}
/* ===================== the godlike half of the kit =====================
   Q  METEOR   · the lance you already had, called down on your aim point
   T  TORNADO  · a funnel that walks where you send it, tearing at Villains and throwing cars
   Y  TSUNAMI  · the sea comes in: a wall of water off the nearest coast, inland and through them
   U  COMET    · one asteroid out of the sky. Ninety seconds between them, and it levels a block
   RMB in the air · the DIVE: you fold up head-first, break the sound barrier, and land on them
   None of it touches a civilian, the Builder Guild, or your own company. A Hero cannot kill the people. */
const GOD = { tor: null, comet: null, hur: null, air: null, cd: { T: 0, U: 0, H: 0, L: 0, A: 0, dive: 0 } };
const GOD_CD = { T: 30, U: 60, H: 50, L: 5, A: 16, dive: 7 };
/* the five on the keys, in order: [cooldown slot, name, key] — the ability bar and the touch pads read this */
const KIT = [['T', 'Tornado', '1'], ['H', 'Hurricane', '2'], ['U', 'Comet', '3'], ['L', 'Thunder', '4'], ['A', 'Air strike', '5']];
function aimPoint(range) { const pe = PLAYER.ent; const r = rayCast(camera.position, camDir(_pv), range || 1200, pe, 1); return r.point.clone(); }
function godHurt(p, radius, dmg) { explodeDamage(p, radius, dmg, PLAYER.ent, 1); } /* team 1: it passes through your own and through the people */
/* ---------- tornado ---------- */
const TOR_G = new T.CylinderGeometry(1.6, 13, 52, 18, 4, true);
function castTornado(to) {
  if (GOD.tor) return; const p = to.clone(); p.y = groundY(p.x, p.z);
  const m = new T.Mesh(TOR_G, basic(new T.Color(0.55, 0.6, 0.72), { transparent: true, opacity: 0.3, depthWrite: false, side: T.DoubleSide }));
  m.position.copy(p); m.position.y += 26; m.castShadow = false; scene.add(m);
  GOD.tor = { m, pos: p, t: 0, life: 16, dir: rand(0, 6.283), hitT: 0 };
  banner('Tornado', 'It walks where you sent it', 'var(--amber)'); comms('You', 'Tornado on the ground. Clear of it.', 'b'); snd('big', p, 0.9);
}
function tornadoTick(dt) {
  const W = GOD.tor; if (!W) return; W.t += dt;
  if (W.t > W.life) { scene.remove(W.m); GOD.tor = null; return; }
  W.dir += rand(-0.5, 0.5) * dt; const sp = 9;
  W.pos.x = clamp(W.pos.x + Math.sin(W.dir) * sp * dt, -BOUND, BOUND); W.pos.z = clamp(W.pos.z + Math.cos(W.dir) * sp * dt, -BOUND, BOUND);
  W.pos.y = groundY(W.pos.x, W.pos.z);
  W.m.position.set(W.pos.x, W.pos.y + 26, W.pos.z); W.m.rotation.y += dt * 7; W.m.material.opacity = 0.3 * Math.min(1, (W.life - W.t) / 2);
  for (let i = 0; i < 3; i++) { const a = Math.random() * 6.283, r = rand(2, 13); FXS.spawn(W.pos.x + Math.cos(a) * r, W.pos.y + rand(0, 40), W.pos.z + Math.sin(a) * r, -Math.sin(a) * 14, rand(6, 16), -Math.cos(a) * 14, rand(1.2, 2.4), 4, 12, 0.5, 0.48, 0.45, 0.42, 0.42, 0.44, 0.7, 0.2, 0.3); }
  /* the cause: it drops out of a turning cloud, the funnel growing down from the cloud base over the first second */
  const fk = Math.min(1, W.t / 1.1); W.m.scale.y = Math.max(0.06, fk); W.m.position.y = W.pos.y + 52 - 26 * fk;
  if (W.t < 1.6) for (let i = 0; i < nfx(3); i++) { const a = Math.random() * 6.283, r = rand(10, 34); FXS.spawn(W.pos.x + Math.cos(a) * r, W.pos.y + 54, W.pos.z + Math.sin(a) * r, -Math.sin(a) * 16, 0, Math.cos(a) * 16, rand(1, 1.6), 8, 16, 0.32, 0.33, 0.37, 0.26, 0.27, 0.3, 0.7, 0.3, 0); }
  /* the effect: what it stands on is what it carries */
  if ((W.surfT = (W.surfT || 0) - dt) <= 0) { W.surfT = 0.25; W.surf = surfaceAt(W.pos.x, W.pos.z); }
  const tc = W.surf === 'water' ? _c.setRGB(0.74, 0.84, 0.94) : W.surf === 'crops' ? _c.setRGB(0.5, 0.56, 0.36) : W.surf === 'city' ? _c.setRGB(0.5, 0.5, 0.53) : _c.setRGB(0.6, 0.52, 0.42);
  W.m.material.color.lerp(tc, Math.min(1, dt * 2));
  if (W.surf === 'water') { for (let i = 0; i < nfx(4); i++) { const a = Math.random() * 6.283, r = rand(1, 9); FXS.spawn(W.pos.x + Math.cos(a) * r, 0.5, W.pos.z + Math.sin(a) * r, -Math.sin(a) * 10, rand(14, 30), Math.cos(a) * 10, rand(1.4, 2.4), 1.5, 6, 0.86, 0.9, 0.95, 0.7, 0.75, 0.82, 0.7, 0.2, 0.6); } if (Math.random() < dt * 3) shockRing(W.pos, 14, 0.8, 0xcfe6ff); } /* a waterspout */
  else if (W.surf === 'crops') { if (Math.random() < dt * 3) scorchCrops(W.pos, 9, false); for (let i = 0; i < nfx(2); i++) FXS.spawn(W.pos.x + rand(-8, 8), W.pos.y + 1, W.pos.z + rand(-8, 8), rand(-6, 6), rand(10, 22), rand(-6, 6), rand(1, 2), 0.6, 1.4, 0.45, 0.55, 0.22, 0.6, 0.55, 0.25, 0.9, 0.3, 0.2); } /* the crop torn up */
  else if (W.surf === 'city' && Math.random() < dt * 2) spawnDebris(W.pos.clone().setY(W.pos.y + 2), 2, 14, 0.5); /* the street going up with it */
  for (const c of POW.cars) if (c.state === 'rest' && Math.hypot(c.pos.x - W.pos.x, c.pos.z - W.pos.z) < 22) { c.state = 'thrown'; c.vel.set(rand(-14, 14), rand(16, 30), rand(-14, 14)); c.spin = rand(4, 9); POW.dirty = true; }
  if ((W.hitT -= dt) > 0) return; W.hitT = 0.3;
  godHurt(W.pos, 15, 110); shake(0.25, W.pos);
  for (const e of ENTS) if (e.alive && e.team === 2 && e.kind === 'soldier' && e.pos.distanceToSquared(W.pos) < 400 && !e.tumble) { e.pos.y += 8 * 0.3; e.vel.set(rand(-6, 6), 12, rand(-6, 6)); }
}
/* ---------- comet ---------- */
function castComet(to) {
  if (GOD.comet) return; const p = to.clone(); p.y = groundY(p.x, p.z);
  const g = new T.Group();
  const head = new T.Mesh(new T.DodecahedronGeometry(7, 1), std(0x2a2420, 0.9, 0.1)); g.add(head);
  const glow = new T.Mesh(new T.SphereGeometry(10, 16, 12), addMat(0xff8a3a, 0.55)); g.add(glow);
  g.position.set(p.x - 260, 900, p.z - 260); scene.add(g);
  GOD.comet = { g, head, to: p, t: 0, dur: 3.1, from: g.position.clone(), surf: surfaceAt(p.x, p.z), warnT: 0 };
  banner('Comet', 'Something is coming down on that block', 'var(--red)'); comms('You', 'Pulling a rock out of the sky. Everyone clear.', 'b'); snd('missile', null, 0.9);
}
function cometTick(dt) {
  const C = GOD.comet; if (!C) return; C.t += dt; const k = Math.min(1, C.t / C.dur);
  C.g.position.lerpVectors(C.from, C.to, k * k); C.head.rotation.x += dt * 3; C.head.rotation.z += dt * 2;
  for (let i = 0; i < 4; i++) FXA.spawn(C.g.position.x + rand(-4, 4), C.g.position.y + rand(-4, 4), C.g.position.z + rand(-4, 4), rand(-6, 6), rand(2, 10), rand(-6, 6), rand(0.5, 1.2), 7, 2, 4, 1.8, 0.5, 1.4, 0.3, 0.05, 1, 0.5, 1.5);
  /* the cause you can read from the ground: its shadow, a ring tightening on the mark, and the light growing as it comes */
  if ((C.warnT -= dt) <= 0) { C.warnT = 0.4 * (1 - k * 0.7); shockRing(C.to, 70 - 50 * k, 0.4, 0xff8a3a); flashLight(C.g.position, 6 + 20 * k, 400, 0.3, 0xffb070); }
  if (k < 1) return;
  const p = C.to; scene.remove(C.g); GOD.comet = null;
  fxExplosion(p, 14); godHurt(p, 62, 4200); shockRing(p, 260, 2.4); shake(3.4, p); snd('big', p, 2.4);
  flashLight(_v1.copy(p).setY(p.y + 30), 30, 600, 1.6, 0xffd0a0);
  if (C.surf === 'water') { /* into the sea: a column of steam, the water thrown up, and rings that roll out to the shore */
    for (let j = 0; j < nfx(46); j++) { const a = Math.random() * 6.283, r = rand(0, 26); FXS.spawn(p.x + Math.cos(a) * r, 2, p.z + Math.sin(a) * r, Math.cos(a) * rand(2, 8), rand(16, 44), Math.sin(a) * rand(2, 8), rand(3, 6), 10, 46, 0.92, 0.94, 0.97, 0.78, 0.8, 0.84, 0.75, 0.25, 1.2); }
    for (let j = 0; j < nfx(30); j++) { const a = Math.random() * 6.283, r = rand(20, 70); sprayUp(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, 2.2, 4); }
    for (let w = 0; w < 3; w++) setTimeout(() => shockRing(_v1.set(p.x, 0, p.z), 140 + w * 90, 2.6, 0xcfe6ff), 250 + w * 500);
    for (const c of POW.cars) if (c.state === 'rest' && c.pos.distanceToSquared(p) < 40000) { const a = Math.atan2(c.pos.x - p.x, c.pos.z - p.z); c.state = 'thrown'; c.vel.set(Math.sin(a) * 30, 12, Math.cos(a) * 30); c.spin = rand(2, 5); POW.dirty = true; }
  } else { /* on land: the crater, the dust ring, the rock thrown out and the fire */
    for (let j = 0; j < nfx(40); j++) { const a = Math.random() * 6.283, r = rand(6, 60); fxDust(_v2.set(p.x + Math.cos(a) * r, p.y, p.z + Math.sin(a) * r), 2, 14, 18); }
    spawnDebris(p, 14, 26, 1.4); addEmitter(p.clone().setY(p.y + 2), 6, 120);
    if (typeof addCrater === 'function') { addCrater(p.x, p.z, 36); for (let j = 0; j < 5; j++) addCrater(p.x + rand(-40, 40), p.z + rand(-40, 40), rand(6, 12)); }
    if (C.surf === 'crops') scorchCrops(p, 80, true);
  }
}
/* ===================== cause and effect: every power reads the ground it lands on =====================
   Each power shows where its energy comes from and what it does to what is there:
     HURRICANE  · it feeds on the sea. Near water you watch spray torn off the surface and drawn up into the wall, rain
                  comes down under it, the surge rolls out over the water and it grows. Over dry land it is a dust storm
                  that starves and blows itself out fast.
     TORNADO    · drops out of a turning cloud; over water it becomes a waterspout, over fields it shreds the crop, in the
                  city it throws debris.
     COMET      · a shadow on the ground, then steam and a tidal ring if it lands in the sea, a crater if it lands on rock.
     THUNDER    · the cloud gathers over the mark first. In water the strike runs across the surface; it jumps to the
                  nearest armour; it sets a field alight.
     AIR STRIKE · you see the jets come over and drop the run; craters where it lands, spray where it lands in the sea.
     THE FORCE  · a visible current from your hands to the car, the road dust when it tears loose. */
const FXK = (typeof LOW_END !== 'undefined' && LOW_END) ? 0.55 : 1; /* particle budget: phones get a bit over half */
const nfx = n => Math.max(1, Math.round(n * FXK));
const isWater = (x, z) => H(x, z) < 0;
const _near = [];
function waterAround(p, R) { /* how much of the ground within R is water, and up to eight water points to draw on */
  const pts = []; let n = 0, w = 0;
  for (let ring = 1; ring <= 3; ring++) { const r = R * ring / 3, m = 8 + ring * 4; for (let i = 0; i < m; i++) { const a = i / m * 6.283 + ring * 0.7, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; n++; if (isWater(x, z)) { w++; if (pts.length < 8) pts.push(new V3(x, 0, z)); } } }
  if (isWater(p.x, p.z)) { w += 3; n += 3; pts.unshift(new V3(p.x, 0, p.z)); }
  return { frac: w / n, pts };
}
function surfaceAt(x, z) {
  if (isWater(x, z)) return 'water';
  if (typeof AGRI !== 'undefined') for (const B of AGRI.belts) if (Math.abs(x - B.x) < B.w / 2 && Math.abs(z - B.z) < B.d / 2) return 'crops';
  for (const b of bldNear(x, z, 14, _near)) if (b.alive && !b.cover) return 'city';
  return 'ground';
}
function sprayUp(x, z, h, spread) { /* white water torn off the surface */
  FXS.spawn(x + rand(-spread, spread), 0.4, z + rand(-spread, spread), rand(-2, 2), rand(7, 15) * h, rand(-2, 2), rand(1, 2), 1.4, 5, 0.86, 0.9, 0.95, 0.68, 0.74, 0.8, 0.7, 0.4, -6);
}
function scorchCrops(p, r, hard) { if (typeof agriScorch === 'function') agriScorch(p, r, hard); }
/* ---------- hurricane ---------- */
const HUR_DECK = new T.CylinderGeometry(78, 64, 8, 28, 1, true);
function castHurricane(to) {
  if (GOD.hur) return; const p = to.clone(); p.y = groundY(p.x, p.z);
  const feed = waterAround(p, 260), k = 0.35 + 0.65 * Math.min(1, feed.frac * 2.2);
  const mat = basic(new T.Color(0.5, 0.55, 0.66), { transparent: true, opacity: 0.26, depthWrite: false, side: T.DoubleSide });
  const arms = []; for (let i = 0; i < 4; i++) { const m = new T.Mesh(TOR_G, mat); m.castShadow = false; scene.add(m); arms.push(m); }
  const deck = new T.Mesh(HUR_DECK, basic(new T.Color(0.36, 0.38, 0.44), { transparent: true, opacity: 0.4, depthWrite: false, side: T.DoubleSide })); scene.add(deck);
  GOD.hur = { arms, deck, mat, pos: p, t: 0, life: 12 + 8 * k, dir: rand(0, 6.283), hitT: 0, boltT: 0.6, k, feed, feedT: 1, surgeT: 0.4, dryC: new T.Color(0.62, 0.52, 0.4), wetC: new T.Color(0.5, 0.55, 0.66) };
  if (feed.frac > 0.08) { banner('Hurricane', 'It is drawing the sea up into it', 'var(--blue)'); comms('You', 'Pulling the sea into it. Watch the wall build.', 'b'); }
  else { banner('Hurricane', 'No sea to feed it · a dry storm, and short', 'var(--amber)'); comms('You', 'Nothing to feed on out here. It will not last.', 'b'); }
  snd('big', p, 1.1); shake(0.6, p);
}
function hurricaneTick(dt) {
  const W = GOD.hur; if (!W) return;
  /* the feed: where the sea is, relative to where the storm is now */
  if ((W.feedT -= dt) <= 0) { W.feedT = 1; W.feed = waterAround(W.pos, 220); }
  const wet = Math.min(1, W.feed.frac * 2.2), kT = 0.35 + 0.65 * wet;
  W.k += (kT - W.k) * Math.min(1, dt * 0.5); /* it builds over the sea and starves over land */
  W.t += dt * (1 + (1 - wet) * 0.8);
  if (W.t > W.life) { for (const m of W.arms) scene.remove(m); scene.remove(W.deck); GOD.hur = null; return; }
  W.dir += rand(-0.3, 0.3) * dt; const sp = 4;
  W.pos.x = clamp(W.pos.x + Math.sin(W.dir) * sp * dt, -BOUND, BOUND); W.pos.z = clamp(W.pos.z + Math.cos(W.dir) * sp * dt, -BOUND, BOUND); W.pos.y = groundY(W.pos.x, W.pos.z);
  const fade = Math.min(1, W.t / 1.2, (W.life - W.t) / 2), K = W.k, R = 30 * (0.8 + 0.5 * K);
  W.mat.color.copy(W.dryC).lerp(W.wetC, wet); W.mat.opacity = (0.18 + 0.12 * K) * fade; W.deck.material.opacity = (0.25 + 0.25 * K) * fade;
  W.deck.position.set(W.pos.x, W.pos.y + 68, W.pos.z); W.deck.rotation.y += dt * 0.9; W.deck.scale.set(0.8 + 0.4 * K, 1, 0.8 + 0.4 * K);
  for (let i = 0; i < W.arms.length; i++) {
    const a = W.t * 1.4 + i * Math.PI / 2, x = W.pos.x + Math.cos(a) * R, z = W.pos.z + Math.sin(a) * R;
    const m = W.arms[i], s = 0.8 + 0.5 * K; m.position.set(x, groundY(x, z) + 26 * fade * s + 1, z); m.scale.set(s, fade * s, s); m.rotation.y += dt * 8;
  }
  const near = camera.position.distanceToSquared(W.pos) < 810000;
  if (near) {
    if (wet > 0.05 && W.feed.pts.length) { /* the cause: spray torn off the sea and drawn in and up toward the wall */
      for (let i = 0; i < nfx(5); i++) {
        const q = pick(W.feed.pts), x = q.x + rand(-10, 10), z = q.z + rand(-10, 10), dx = W.pos.x - x, dz = W.pos.z - z, d = Math.hypot(dx, dz) || 1, v = 22 + 18 * K, life = clamp(d / v, 1.2, 4.5);
        FXS.spawn(x, 0.6, z, dx / d * v, 60 / life * 0.5, dz / d * v, life, 1.2, 6, 0.82, 0.87, 0.94, 0.62, 0.66, 0.74, 0.55, 0.05, 2);
      }
      if (Math.random() < dt * 6) { const q = pick(W.feed.pts); sprayUp(q.x, q.z, 1, 6); }
    }
    if (wet > 0.2) for (let i = 0; i < nfx(7); i++) { /* rain under the deck: the sea coming back down */
      const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * 70 * (0.8 + 0.4 * K), x = W.pos.x + Math.cos(a) * r, z = W.pos.z + Math.sin(a) * r;
      FXS.spawn(x, W.pos.y + 62, z, rand(-3, 3), -46, rand(-3, 3), 1.4, 0.25, 0.35, 0.7, 0.76, 0.86, 0.6, 0.66, 0.76, 0.5, 0, -6);
    } else for (let i = 0; i < nfx(3); i++) { /* a dry storm drags dust instead */
      const a = Math.random() * 6.283, r = rand(10, 55), x = W.pos.x + Math.cos(a) * r, z = W.pos.z + Math.sin(a) * r;
      FXS.spawn(x, groundY(x, z) + 1, z, -Math.sin(a) * 18, rand(4, 10), Math.cos(a) * 18, rand(1.5, 2.6), 4, 12, 0.55, 0.47, 0.36, 0.48, 0.42, 0.34, 0.55, 0.2, 0.3);
    }
    for (let i = 0; i < nfx(2); i++) { const a = Math.random() * 6.283, r = rand(10, 48); FXS.spawn(W.pos.x + Math.cos(a) * r, W.pos.y + rand(0, 50), W.pos.z + Math.sin(a) * r, -Math.sin(a) * 20, rand(4, 12), Math.cos(a) * 20, rand(1.2, 2.2), 5, 14, 0.5, 0.52, 0.56, 0.42, 0.44, 0.48, 0.6, 0.2, 0.3); }
  }
  /* the surge: where the storm stands over or beside water, the sea rolls out from it */
  if (wet > 0.1 && (W.surgeT -= dt) <= 0) {
    W.surgeT = 0.7; const pts = W.feed.pts.filter(q => Math.hypot(q.x - W.pos.x, q.z - W.pos.z) < 140); const q = pts.length ? pick(pts) : null;
    if (q) { shockRing(q, 26 + 20 * K, 1.4, 0xcfe6ff); sprayUp(q.x, q.z, 1.3, 8); sprayUp(q.x, q.z, 1.3, 8); }
  }
  /* rain over a farm belt: the crop drinks it */
  if (wet > 0.2 && typeof AGRI !== 'undefined') for (const B of AGRI.belts) if (Math.hypot(B.x - W.pos.x, B.z - W.pos.z) < 120) { for (const q of B.plots) if (q.g < 1 && q.b < 0.2) q.g = Math.min(1, q.g + dt * 0.02 * K); B.dirty = true; }
  for (const c of POW.cars) if (c.state === 'rest' && Math.hypot(c.pos.x - W.pos.x, c.pos.z - W.pos.z) < 48 * (0.8 + 0.4 * K)) { const a = Math.atan2(c.pos.x - W.pos.x, c.pos.z - W.pos.z) + 1.2; c.state = 'thrown'; c.vel.set(Math.sin(a) * 22, rand(14, 26), Math.cos(a) * 22); c.spin = rand(4, 9); POW.dirty = true; }
  if ((W.boltT -= dt) <= 0 && fade > 0.6) { /* lightning inside the wall, more of it the more the sea feeds it */
    W.boltT = rand(0.6, 1.1) / (0.6 + K); const a = Math.random() * 6.283, r = rand(8, 42);
    const p = _v3.set(W.pos.x + Math.cos(a) * r, 0, W.pos.z + Math.sin(a) * r); p.y = groundY(p.x, p.z);
    thunderBolt(p.clone(), 0.5 + 0.4 * K);
  }
  if ((W.hitT -= dt) > 0) return; W.hitT = 0.35;
  godHurt(W.pos, 44 * (0.8 + 0.4 * K), 60 + 60 * K); shake(0.18, W.pos);
  for (const e of ENTS) if (e.alive && e.team === 2 && e.kind === 'soldier' && e.pos.distanceToSquared(W.pos) < 1936 && !e.tumble) { e.pos.y += 2.4; e.vel.set(rand(-8, 8), 14, rand(-8, 8)); }
}
/* ---------- thunder strike ---------- */
function thunderBolt(p, k) { /* one fork out of the sky onto p, and what it does to what is there */
  _v1.set(p.x + rand(-40, 40), p.y + 620, p.z + rand(-40, 40)); beam(_v1, p, 1.1 * k + 0.4, 0.32, 0x9fd0ff);
  fxExplosion(p, 1.1 * k, { smoke: 0.4 }); godHurt(p, 9 + 5 * k, 520 * k); flashLight(_v2.copy(p).setY(p.y + 8), 10 * k, 140, 0.25, 0xbfe2ff);
  shockRing(p, 18 * k + 6, 0.4, 0x9fd0ff); shake(0.35 * k, p); snd('heavy', p, 0.6 * k);
  for (const b of bldNear(p.x, p.z, 6, [])) if (b.alive && b.cover) b.damage(300 * k, PLAYER.ent);
  const surf = surfaceAt(p.x, p.z), pe = PLAYER.ent;
  if (surf === 'water') { /* the current runs out across the surface and takes anyone standing in it */
    for (let i = 0; i < nfx(18); i++) { const a = Math.random() * 6.283, sp = rand(18, 34); FXA.spawn(p.x, 0.35, p.z, Math.cos(a) * sp, rand(0, 1.5), Math.sin(a) * sp, rand(0.35, 0.7), 0.9, 0.2, 1.2, 2.2, 4, 0.5, 1, 2.6, 1, 2.2, 0); }
    shockRing(_v4.set(p.x, 0, p.z), 30 * k, 0.6, 0x7fd6ff);
    for (const e of ENTS) if (e.alive && e.team !== 1 && e.hitR && e.pos.y < 1.6 && isWater(e.pos.x, e.pos.z) && Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < 28 * k) { e.damage(240 * k, pe, 'thunder'); fxSparks(e.pos, 6, [1.6, 2.4, 4], 8); }
  } else if (surf === 'crops') { scorchCrops(p, 12 * k, false); addEmitter(p.clone().setY(p.y + 0.5), 0.8, 9); }
  else if (typeof addCrater === 'function') addCrater(p.x, p.z, 3 + 2 * k);
  /* it jumps to the nearest armour first, then whoever is closest: up to three arcs */
  let arcs = 0; const hit = new Set();
  for (const pass of [0, 1]) for (const e of ENTS) {
    if (arcs >= 3) break; if (!e.alive || e.team === 1 || !e.hitR || hit.has(e) || e.kind === 'capital') continue;
    if (pass === 0 && e.kind === 'soldier') continue;
    const d = e.pos.distanceTo(p); if (d > 22 * k + 4 || d < 1) continue;
    hit.add(e); arcs++; e.aim(_v4); beam(_v5.copy(p).setY(p.y + 1.5), _v4, 0.45, 0.22, 0x9fd0ff); e.damage(170 * k, pe, 'thunder'); fxSparks(_v4, 8, [1.6, 2.4, 4], 9);
  }
}
function castThunder() {
  const pe = PLAYER.ent, r = rayCast(camera.position, camDir(_pv), 1600, pe, 1), p = r.point.clone();
  /* whatever the crosshair is on takes the first fork straight — up above the barrier that is how you hit the fleet */
  if (r.ent && r.ent.team !== 1) { r.ent.damage(r.ent.kind === 'capital' ? 1400 : 700, pe, 'thunder'); fxSparks(p, 14, [1.6, 2.4, 4], 10); }
  if (!r.ent && r.t >= 1599) { beam(_v1.copy(pe.pos).setY(pe.pos.y + 1.4), p, 1, 0.3, 0x9fd0ff); return; }
  /* the cause first: the cloud gathers over the mark and darkens, then it lets go */
  if (p.y < 600) for (let i = 0; i < nfx(16); i++) { const a = Math.random() * 6.283, r0 = rand(30, 60); FXS.spawn(p.x + Math.cos(a) * r0, p.y + 85 + rand(-6, 6), p.z + Math.sin(a) * r0, -Math.cos(a) * r0 / 0.5, 0, -Math.sin(a) * r0 / 0.5, rand(0.7, 1.1), 10, 22, 0.2, 0.21, 0.25, 0.14, 0.15, 0.18, 0.75, 2.4, 0); }
  flashLight(_v2.copy(p).setY(p.y + 80), 4, 200, 0.4, 0x8fb0ff);
  for (let i = 0; i < 3; i++) setTimeout(() => {
    const q = p.clone(); if (i) { q.x += rand(-6, 6); q.z += rand(-6, 6); if (q.y < 600) q.y = surfY(q.x, q.z, q.y + 2); }
    thunderBolt(q, 1);
  }, 320 + i * 160);
}
/* ---------- air strike: the jets you see come over ---------- */
const JET_G = mergeGeos([new T.ConeGeometry(0.9, 9, 8).rotateX(Math.PI / 2), xf(new T.BoxGeometry(9, 0.25, 2.6), [0, 0, 0.8]), xf(new T.BoxGeometry(3.4, 0.2, 1.2), [0, 0, 3.8]), xf(new T.BoxGeometry(0.2, 1.8, 1.4), [0, 0.9, 3.8])]);
const JET_M = std(0x5d646c, 0.45, 0.6), JETS = [0, 1].map(() => { const m = new T.Mesh(JET_G, JET_M); m.visible = false; m.castShadow = false; scene.add(m); return m; });
function castAirStrike(to) {
  const pe = PLAYER.ent, fx = -Math.sin(PLAYER.yaw), fz = -Math.cos(PLAYER.yaw); /* the run comes in along the way you face */
  const alt = Math.max(groundY(to.x, to.z), 0) + 150, targets = [];
  for (let i = 0; i < 7; i++) { const k = (i - 3) * 13, tx = to.x + fx * k, tz = to.z + fz * k; targets.push({ along: k, p: new V3(tx, groundY(tx, tz), tz), done: false }); }
  GOD.air = { to: to.clone(), fx, fz, alt, t: 0, dur: 3.4, targets, pe };
  banner('Air strike', 'Jets inbound on your mark', 'var(--amber)'); comms('You', 'Strike run on my mark. Heads down.', 'b'); snd('roar', to, 0.9);
}
function airTick(dt) {
  const A = GOD.air; if (!A) { for (const j of JETS) j.visible = false; return; }
  A.t += dt; const k = A.t / A.dur;
  if (k > 1) { GOD.air = null; for (const j of JETS) j.visible = false; return; }
  const along = -560 + k * 1120; /* they cross the mark at the half-way point */
  JETS.forEach((j, i) => {
    const side = (i ? 1 : -1) * 14, lag = i * 18, a = along - lag;
    j.visible = true; j.position.set(A.to.x + A.fx * a - A.fz * side, A.alt + i * 6, A.to.z + A.fz * a + A.fx * side);
    j.rotation.set(0, Math.atan2(-A.fx, -A.fz), 0);
    if (Math.random() < dt * 40 * FXK) FXS.spawn(j.position.x - A.fx * 5, j.position.y, j.position.z - A.fz * 5, 0, 0, 0, rand(1.2, 2), 0.8, 3, 0.9, 0.92, 0.95, 0.8, 0.82, 0.86, 0.6, 0, 0); /* contrails */
  });
  /* release each missile as the lead jet passes a little short of its mark: you watch it fall out from under the wing */
  for (const T0 of A.targets) {
    if (T0.done || along < T0.along - 90) continue; T0.done = true;
    const from = JETS[0].position.clone(); from.y -= 1.5; const d = from.distanceTo(T0.p);
    fireProj({ from, to: T0.p, speed: d / 0.75, kind: 'missile', team: 1, src: A.pe, dmg: 380, splash: 9, w: 0.32, len: 2.2, color: [3, 1.6, 0.6], homing: 0, maxDist: d + 2, fx: 1.8 });
    const p = T0.p.clone();
    setTimeout(() => { const s = surfaceAt(p.x, p.z); if (s === 'water') { sprayUp(p.x, p.z, 1.8, 3); sprayUp(p.x, p.z, 1.8, 3); } else if (typeof addCrater === 'function') addCrater(p.x, p.z, 6); }, 780);
  }
}
/* ---------- the dive ---------- */
function startDive() {
  const P = PLAYER, e = P.ent; if (!POW.fly || !e || !e.alive || POW.dive) return false;
  if (e.pos.y - surfY(e.pos.x, e.pos.z, e.pos.y) < 16) { if (TIME - (POW.lowT || -9) > 2) { POW.lowT = TIME; banner('Too low to dive', 'Climb higher, then dive', 'var(--amber)'); } return false; }
  const d = camDir(_pv).clone(); if (d.y > -0.12) d.y = -0.45; d.normalize();
  POW.dive = { dir: d, t: 0 }; GOD.cd.dive = GOD_CD.dive;
  snd('missile', e.pos, 0.8); shockRing(e.pos, 26, 0.5); shake(0.4);
  return true;
}
function diveStep(dt) {
  const P = PLAYER, e = P.ent, D = POW.dive; D.t += dt;
  const sp = 150;
  e.pos.addScaledVector(D.dir, sp * dt); pushOut(e.pos, 0.5);
  e.pos.x = clamp(e.pos.x, -BOUND, BOUND); e.pos.z = clamp(e.pos.z, -BOUND, BOUND);
  for (let i = 0; i < 3; i++) FXA.spawn(e.pos.x + rand(-0.8, 0.8), e.pos.y + rand(0, 1.4), e.pos.z + rand(-0.8, 0.8), -D.dir.x * 18, -D.dir.y * 18, -D.dir.z * 18, 0.4, 0.8, 2.2, 0.6, 1.9, 3.2, 0.25, 0.6, 1.8, 1, 0, 0);
  const g = Math.max(surfY(e.pos.x, e.pos.z, e.pos.y), roofUnder(e.pos));
  const hitB = buildingAt(_v3.copy(e.pos));
  if (e.pos.y <= g + 1 || hitB || D.t > 2.4) {
    e.pos.y = Math.max(g, e.pos.y); POW.dive = null; POW.fly = false; P.vy = 0; P.grounded = true;
    const p = e.pos.clone();
    fxExplosion(p, 4.5); godHurt(p, 24, 1100); shockRing(p, 90, 1.3); shake(1.8, p); snd('big', p, 1.4);
    spawnDebris(p, 8, 16, 0.7); fxDust(p, 20, 8, 14); flashLight(_v1.copy(p).setY(p.y + 6), 12, 160, 0.6, 0xffe0c0);
    { const s = surfaceAt(p.x, p.z); /* what you land on: the sea goes up in a column, a field burns */
      if (s === 'water') { fxWaterSplash(p, 4); for (let j = 0; j < nfx(16); j++) sprayUp(p.x + rand(-6, 6), p.z + rand(-6, 6), 2.4, 3); }
      else if (s === 'crops') scorchCrops(p, 22, true);
      else if (typeof addCrater === 'function') addCrater(p.x, p.z, 14); }
    for (const c of POW.cars) if (c.state === 'rest' && c.pos.distanceToSquared(p) < 900) { c.state = 'thrown'; const a = Math.atan2(c.pos.x - p.x, c.pos.z - p.z); c.vel.set(Math.sin(a) * 26, 16, Math.cos(a) * 26); c.spin = rand(3, 7); POW.dirty = true; }
    awardPoints(120, 'Dive smash');
    return;
  }
  e.yaw = Math.atan2(D.dir.x, D.dir.z) + Math.PI; e.moveSpeed = sp; MOB.v.set(D.dir.x * sp, 0, D.dir.z * sp);
  if (e.obj) { e.obj.position.copy(e.pos); e.obj.rotation.x = -1.45; e.obj.rotation.z = D.t * 14; }
}
/* ---------- the keys ---------- */
function godTick(dt) {
  for (const k in GOD.cd) GOD.cd[k] = Math.max(0, GOD.cd[k] - dt);
  tornadoTick(dt); cometTick(dt); hurricaneTick(dt); airTick(dt);
  if (GAME.state !== 'play' || !PLAYER.ent || !PLAYER.ent.alive || PLAYER.role !== 'trooper' || PLAYER.ent.mount) return;
  const go = (code, slot, cast) => { if (!keys[code]) return; keys[code] = false; if (GOD.cd[slot] > 0) return; GOD.cd[slot] = GOD_CD[slot]; cast(); };
  go('Digit1', 'T', () => castTornado(aimPoint(900)));
  go('Digit2', 'H', () => castHurricane(aimPoint(1000)));
  go('Digit3', 'U', () => castComet(aimPoint(1400)));
  go('Digit4', 'L', () => castThunder());
  go('Digit5', 'A', () => castAirStrike(aimPoint(1000)));
}
/* ---------- the hint line ---------- */
mountHint = (prev => function (pe) {
  if (POW.tk) return 'F / click · throw it where you are looking'; /* what is in your hands beats whatever you are standing next to */
  const h = prev(pe); if (h) return h;
  const f = pe && pe.kind === 'soldier' && !pe.mount ? tkFind(pe) : null;
  if (f) return f.d > TK_GRAB ? 'F / click · pull that car to you' : 'F / click · lift that car';
  return POW.fly ? 'Space · stop flying · Shift · faster · X · down' : '';
})(mountHint);
/* ---------- your company keeps up ---------- */
// You fly and they do not, so a Hero who crosses the island leaves fifteen troopers jogging behind. Two answers, in
// this order: their own transport comes and gets them, and when the ground will not work — you are in the air, on a
// roof, over water, or simply too far — they light their packs and boost to you in an arc. J calls them in at once.
const SUP = { t: 3, sayT: 0 };
function jetTo(s, to, say) {
  if (!s || !s.alive || s.downed || s.jet || s.mount || (s.jetCd || 0) > TIME) return false;
  s.jet = { from: s.pos.clone(), to: to.clone(), t: 0, dur: clamp(s.pos.distanceTo(to) / 85, 0.9, 3.4), arc: clamp(s.pos.distanceTo(to) * 0.22, 14, 70) };
  s.jetCd = TIME + 9; s.target = null; s.coverPt = null; s.boardTarget = null;
  if (say && TIME - SUP.sayT > 9) { SUP.sayT = TIME; comms(s.name, pick(['Packs lit, Commander. On your position.', 'We cannot run that, boosting to you.', 'Coming to you, sir. Watch the sky.']), 'b'); }
  snd('missile', s.pos, 0.35); fxDust(_v1.copy(s.pos), 6, 2.5, 5);
  return true;
}
function jetStep(s, dt) {
  const J = s.jet; J.t += dt; const k = Math.min(1, J.t / J.dur);
  s.pos.x = lerp(J.from.x, J.to.x, k); s.pos.z = lerp(J.from.z, J.to.z, k);
  s.pos.y = lerp(J.from.y, J.to.y, k) + Math.sin(k * Math.PI) * J.arc;
  s.yaw = Math.atan2(J.to.x - J.from.x, J.to.z - J.from.z); s.moveSpeed = 8; s.crouch = false;
  if (Math.random() < dt * 50) FXA.spawn(s.pos.x + rand(-0.3, 0.3), s.pos.y + 0.4, s.pos.z + rand(-0.3, 0.3), 0, -2, 0, 0.45, 0.5, 1.1, 0.6, 1.8, 2.8, 0.25, 0.5, 1.5, 1, 0, 0);
  if (k >= 1) {
    s.pos.y = surfY(s.pos.x, s.pos.z, s.pos.y + 2); pushOut(s.pos, 0.5); s.jet = null; s.goalT = 0; s.think = 0;
    fxDust(_v1.copy(s.pos), 7, 3, 6); snd('stomp', s.pos, 0.3);
  }
  if (s.obj) { s.obj.position.copy(s.pos); s.obj.rotation.y = s.yaw; }
}
{ const _su = Soldier.prototype.update;
  Soldier.prototype.update = function (dt) { if (this.jet) { jetStep(this, dt); return; } return _su.call(this, dt); }; }
function squadSupport(dt, force) {
  const pe = PLAYER.ent; if (!pe || !pe.alive || pe.kind !== 'soldier' || GAME.state !== 'play') return;
  if (!force && (SUP.t -= dt) > 0) return; SUP.t = 2.5;
  const ground = surfY(pe.pos.x, pe.pos.z, pe.pos.y + 2), high = pe.pos.y - ground > 25 || POW.fly;
  for (const ft of CMD.teams) {
    if (ft.mode !== 'follow' && !force) continue;
    for (const s of ft.m) {
      if (!s.alive || s.downed || s.jet || s.mount) continue;
      const d = Math.hypot(s.pos.x - pe.pos.x, s.pos.z - pe.pos.z), dy = pe.pos.y - s.pos.y;
      if (!force && d < 150 && dy < 35) continue;
      /* a ride first, if one is near them and you are somewhere a truck can reach */
      let rode = false;
      if (!high && d > 150) for (const c of MOTOR.cars) {
        if (!c || !c.alive || c.remove || !c.riders[0] || s.boardTarget) continue;
        if (c.riders.filter(Boolean).length >= c.cap) continue;
        if (c.pos.distanceTo(s.pos) < 110 && c.pos.distanceTo(pe.pos) > 60) { s.boardTarget = c; s.boardT = 26; c.pickup = TIME + 26; rode = true; break; }
      }
      if (rode) continue;
      const a = Math.random() * 6.283, r = rand(5, 16);
      _v2.set(pe.pos.x + Math.cos(a) * r, 0, pe.pos.z + Math.sin(a) * r); pushOut(_v2, 0.6); _v2.y = surfY(_v2.x, _v2.z, pe.pos.y + 2);
      jetTo(s, _v2, true);
    }
  }
}
function updatePowers(dt) {
  godTick(dt);
  POW.flyCd -= dt; /* ticks whether or not you are in the air, so the next take-off is never blocked */
  squadSupport(dt, false);
  if (GAME.state === 'end' || GAME.state === 'showcase') { if (POW.tk) { POW.tk.state = 'rest'; POW.tk = null; POW.dirty = true; } }
  else tkTick(dt);
  carTick(dt); carDraw();
}
