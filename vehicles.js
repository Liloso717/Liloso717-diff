'use strict';
/* ===================== IRON MERIDIAN · speeders, chases, crashes ===================== */

/* ---------- generic tumble physics for crashing vehicles ---------- */
function startTumble(e, fwd, speed, lift = 1) {
  e.tumble = { v: new V3().copy(fwd).multiplyScalar(speed).add(new V3(rand(-3, 3), rand(6, 13) * lift, rand(-3, 3))), av: new V3(rand(-6, 6), rand(-5, 5), rand(-9, 9)), bounces: 0, t: 0, boom: false };
}
function tumbleStep(e, dt, size, onBoom) {
  const tb = e.tumble; tb.t += dt;
  if (!tb.boom) {
    tb.v.y -= 22 * dt; e.pos.addScaledVector(tb.v, dt);
    e.obj.rotation.x += tb.av.x * dt; e.obj.rotation.y += tb.av.y * dt; e.obj.rotation.z += tb.av.z * dt;
    FXA.spawn(e.pos.x, e.pos.y + 0.5, e.pos.z, rand(-1, 1), rand(0, 2), rand(-1, 1), rand(0.3, 0.6), size * 1.1, size * 0.4, 4, 2, 0.6, 1.4, 0.3, 0.05, 1, 1, 2);
    FXS.spawn(e.pos.x, e.pos.y + 0.5, e.pos.z, rand(-1, 1), rand(1, 3), rand(-1, 1), rand(2.5, 4.5), size, size * 4, 0.05, 0.045, 0.04, 0.2, 0.18, 0.16, 0.9, 0.4, 0.6);
    const g = groundY(e.pos.x, e.pos.z) + size * 0.3; const hitB = buildingAt(_v1.set(e.pos.x, e.pos.y, e.pos.z));
    if (e.pos.y < g || hitB) {
      if (hitB) { hitB.damage(800, null); tb.v.x *= -0.3; tb.v.z *= -0.3; tb.bounces += 2; }
      e.pos.y = Math.max(e.pos.y, g); tb.bounces++; tb.v.y = Math.abs(tb.v.y) * 0.45 + 2; tb.v.x *= 0.62; tb.v.z *= 0.62; tb.av.multiplyScalar(0.72);
      fxDust(_v1.set(e.pos.x, groundY(e.pos.x, e.pos.z), e.pos.z), 10, size * 1.6, 9); fxSparks(e.pos, 22, [3, 2, 0.8], 14); spawnDebris(e.pos, 3, 9, size * 0.25);
      shake(0.25 * size / 2, e.pos); snd('boom', e.pos, 0.6);
      if (tb.bounces === 1) fxExplosion(_v1.copy(e.pos).setY(e.pos.y + 1), size * 0.6);
    }
    if ((tb.bounces >= 3 && tb.t > 1.4) || tb.t > 5.5) {
      tb.boom = true; fxExplosion(_v1.copy(e.pos).setY(e.pos.y + 1), size * 1.5); explodeDamage(e.pos, size * 3, 220, null, 0);
      addEmitter(e.pos.clone().setY(e.pos.y + 1), size * 0.7, 30); e.obj.rotation.z = Math.round(e.obj.rotation.z / Math.PI) * Math.PI + rand(-0.3, 0.3); e.obj.rotation.x = rand(-0.2, 0.2);
      if (onBoom) onBoom();
    }
  }
  e.obj.position.copy(e.pos);
}

/* ---------- speeder geometry (shared per team) ---------- */
const SPD_CACHE = {};
function speederGeos(team) {
  if (SPD_CACHE[team]) return SPD_CACHE[team];
  const b = bucket();
  b.add('paint', xf(rbox(3.1, 0.62, 4.6, 0.22), [0, 0.95, -0.1]));
  b.add('dark', xf(rbox(2.6, 0.5, 4.9, 0.18), [0, 0.5, -0.1]));
  b.add('paint', xf(rbox(2.5, 0.38, 1.5, 0.15), [0, 0.86, 2.5], [0.22, 0, 0]));
  b.add('dark', xf(rbox(1.2, 0.18, 0.5, 0.06), [0, 0.95, 3.2], [0.22, 0, 0]));
  for (const sx of [-1, 1]) {
    b.add('dark', xf(new T.CylinderGeometry(0.62, 0.66, 1.8, 18), [sx * 1.32, 0.95, -2.35], [Math.PI / 2, 0, 0]));
    b.add('brass', xf(new T.TorusGeometry(0.64, 0.07, 6, 20), [sx * 1.32, 0.95, -3.2]));
    b.add('brass', xf(new T.TorusGeometry(0.66, 0.05, 6, 20), [sx * 1.32, 0.95, -1.6]));
    b.add('glow', xf(new T.CircleGeometry(0.52, 18), [sx * 1.32, 0.95, -3.26], [0, Math.PI, 0]));
    b.add('dark', xf(new T.CylinderGeometry(0.16, 0.16, 0.06, 10), [sx * 1.32, 0.95, -3.27], [Math.PI / 2, 0, 0]));
    b.add('brass', tube([[sx * 1.3, 1.0, 2.1], [sx * 1.55, 1.1, 0.8], [sx * 1.6, 1.05, -0.6], [sx * 1.45, 1.0, -1.6]], 0.08, 14, 6));
    b.add('brass', tube([[sx * 1.15, 0.7, 2.0], [sx * 1.5, 0.75, 0.6], [sx * 1.5, 0.75, -0.8], [sx * 1.3, 0.8, -1.5]], 0.06, 14, 5));
    b.add('dark', xf(rbox(0.35, 0.45, 1.3, 0.08), [sx * 1.45, 0.75, 0.6]));
    b.add('glow', xf(rbox(0.5, 0.1, 0.05, 0.02, 1), [sx * 0.85, 0.95, 3.27], [0.22, 0, 0]));
    b.add('lamp', xf(new T.CircleGeometry(0.1, 10), [sx * 0.55, 0.42, -2.58], [0, Math.PI, 0]));
  }
  // roll cage
  for (const z of [0.9, -0.85]) b.add('brass', tube([[-1.15, 1.2, z], [-0.95, 2.0, z - 0.1], [0, 2.15, z - 0.12], [0.95, 2.0, z - 0.1], [1.15, 1.2, z]], 0.065, 18, 6));
  for (const sx of [-1, 1]) b.add('brass', tube([[sx * 0.95, 2.0, 0.8], [sx * 0.95, 2.05, 0], [sx * 0.95, 2.0, -0.95], [sx * 1.1, 1.3, -1.7]], 0.06, 12, 6));
  b.add('dark', xf(rbox(1.0, 0.45, 0.25, 0.06), [0, 1.42, 0.85], [-0.4, 0, 0]));
  b.add('glow', xf(rbox(0.32, 0.18, 0.02, 0.01, 1), [-0.22, 1.47, 0.97], [-0.4, 0, 0])); b.add('glow', xf(rbox(0.32, 0.18, 0.02, 0.01, 1), [0.22, 1.47, 0.97], [-0.4, 0, 0]));
  b.add('dark', xf(rbox(0.9, 0.12, 0.9, 0.05), [0, 1.3, -0.25])); b.add('dark', xf(rbox(0.9, 0.7, 0.14, 0.05), [0, 1.62, -0.68], [0.15, 0, 0]));
  for (let i = 0; i < 4; i++) b.add('dark', xf(rbox(0.6, 0.08, 0.5, 0.03, 1), [0, 1.3, -1.3 - i * 0.12 + 0.1]));
  b.add('gun', xf(new T.CylinderGeometry(0.07, 0.07, 1.5, 8), [-0.45, 0.6, 2.9], [Math.PI / 2, 0, 0])); b.add('gun', xf(new T.CylinderGeometry(0.07, 0.07, 1.5, 8), [0.45, 0.6, 2.9], [Math.PI / 2, 0, 0]));
  // pilot (seated)
  b.add('pilot', xf(rbox(0.42, 0.5, 0.3, 0.08), [0, 1.66, -0.28])); b.add('pilotH', xf(new T.SphereGeometry(0.15, 14, 10), [0, 2.03, -0.25], [0, 0, 0], [1, 1.05, 1.1]));
  b.add('glow', xf(rbox(0.2, 0.04, 0.02, 0.01, 1), [0, 2.04, -0.09]));
  return (SPD_CACHE[team] = bakeGeos(b));
}
const SPD_MAT = {
  1: { paint: std(0x2f5c54, 0.45, 0.45, { map: TEX.armor.map, normalMap: TEX.armor.normal }), dark: SMAT[1].dark, brass: HMAT.bronze, glow: basic(new T.Color(3.2, 1.6, 0.6)), lamp: basic(new T.Color(3, 0.3, 0.2)), gun: SMAT[1].gun, pilot: SMAT[1].cloth, pilotH: SMAT[1].armor },
  2: { paint: std(0x6a2a1c, 0.45, 0.45, { map: TEX.armor.map, normalMap: TEX.armor.normal }), dark: SMAT[2].dark, brass: std(0x2a2826, 0.4, 0.8, { normalMap: TEX.bronze.normal }), glow: basic(new T.Color(3.0, 0.8, 0.3)), lamp: basic(new T.Color(3, 0.3, 0.2)), gun: SMAT[2].gun, pilot: SMAT[2].cloth, pilotH: SMAT[2].armor },
};

/* ---------- chase routes: desert circuit around the buried wreck, and a coastal run ---------- */
const ROUTES = [
  [[-150, -250], [60, -275], [220, -265], [300, -160], [200, -125], [0, -140], [-200, -130], [-260, -200]],
  [[-200, -170], [60, -228], [250, -130], [310, 80], [200, 260], [30, 300], [-170, 250], [-260, 100], [-250, -60]],
  [[-250, 300], [-100, 345], [60, 330], [220, 300], [300, 200], [170, 270], [-60, 290], [-200, 200]],
];

class Speeder extends Ent {
  constructor(team) {
    super('speeder', team); this.maxHp = this.hp = 420; this.radius = 2.6; this.aimOff = 1.1; this.cull = 5; this.bulletMul = 0.3;
    this.name = (team === 1 ? 'Kestrel ' : 'Jackal ') + (Math.random() * 90 + 10 | 0);
    const G3 = speederGeos(team), M = SPD_MAT[team]; const r = new T.Group(); const body = new T.Group(); r.add(body);
    for (const k in G3) { const m = new T.Mesh(G3[k], M[k]); m.castShadow = k === 'paint' || k === 'dark'; body.add(m); }
    this.flames = [];
    for (const sx of [-1, 1]) { const f = new T.Mesh(new T.ConeGeometry(0.5, 3, 14, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -1.5), addMat(team === 1 ? 0xff9a40 : 0xff6020, 0.75)); f.position.set(sx * 1.32, 0.95, -3.3); body.add(f); this.flames.push(f); const h = new T.Mesh(new T.CircleGeometry(0.9, 16), addMat(0x6aa8ff, 0.35)); h.position.set(sx * 1.32, 0.95, -3.35); h.rotation.y = Math.PI; body.add(h); }
    const under = new T.Mesh(new T.PlaneGeometry(2.6, 4.4).rotateX(Math.PI / 2), addMat(0x6ab0ff, 0.35)); under.position.y = 0.2; body.add(under);
    this.obj = r; this.body = body; this.yaw = 0; this.speed = 0; this.vy = 0; this.air = false; this.pitch = 0; this.roll = 0; this.steerS = 0;
    this.think = 0; this.cool = 0; this.burst = 0; this.wp = 0; this.route = ROUTES[(Math.random() * ROUTES.length) | 0]; this.seed = Math.random() * 10; this.boostE = 1;
  }
  spawnAt(p, yaw) { this.pos.set(p.x, groundY(p.x, p.z) + 1.3, p.z); this.yaw = yaw !== undefined ? yaw : (this.team === 1 ? Math.PI : 0); let best = 0, bd = 1e9; this.route.forEach((w, i) => { const d = Math.hypot(w[0] - p.x, w[1] - p.z); if (d < bd) { bd = d; best = i; } }); this.wp = best; this.speed = 20; }
  fwd(out) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  die(src) {
    startTumble(this, this.fwd(_v1), Math.max(10, this.speed * 0.8), 1.1);
    if (src && src.isPlayer) comms('You', `Speeder ${this.name} is down!`, 'b');
    if (!this.isPlayer && !this.noRespawn) SPAWNER.queue('speeder', this.team, 16);
  }
  drive(dt, thr, steer, boost) {
    const k = this.spdMul || 1, maxS = (boost && this.boostE > 0.02 ? 82 : 56) * k; if (boost && thr > 0) this.boostE = Math.max(0, this.boostE - dt / 4); else this.boostE = Math.min(1, this.boostE + dt / 10);
    this.speed += (thr > 0 ? thr * (boost ? 40 : 26) * k : thr * 45) * dt; this.speed *= 1 - (thr === 0 ? 0.5 : 0.12) * dt; this.speed = clamp(this.speed, -16, maxS);
    this.steerS = lerp(this.steerS, steer, Math.min(1, dt * 6));
    const tr = this.steerS * (1.5 - Math.min(1, Math.abs(this.speed) / 90) * 0.7) * (this.air ? 0.3 : 1);
    this.yaw += tr * dt * (this.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(this.speed) / 6 + 0.15);
    const nx = this.pos.x + Math.sin(this.yaw) * this.speed * dt, nz = this.pos.z + Math.cos(this.yaw) * this.speed * dt;
    const b = buildingAt(_v1.set(nx, this.pos.y + 0.5, nz));
    if (b) {
      if (Math.abs(this.speed) > 32) { b.damage(600 + Math.abs(this.speed) * 20, this); fxSparks(_v1, 30, [3, 2, 1], 16); shake(0.6, _v1); const hit = (Math.abs(this.speed) - 32) * 9; this.speed *= -0.3; this.lastHitBy = null; this.damage(this.isPlayer || this.driven ? hit : 9999, this, 'crash'); return; }
      this.speed *= -0.35; fxSparks(_v1, 10, [3, 2, 1], 8); snd('boom', _v1, 0.3); shake(0.2, _v1);
    } else { this.pos.x = clamp(nx, -BOUND, BOUND); this.pos.z = clamp(nz, -BOUND, BOUND); }
    const target = groundY(this.pos.x, this.pos.z) + 1.25 + Math.sin(TIME * 3 + this.seed) * 0.08; const oy = this.pos.y;
    if (this.air) { this.vy -= 24 * dt; this.pos.y += this.vy * dt; if (this.pos.y <= target) { this.pos.y = target; this.air = false; if (this.vy < -9) { fxDust(_v1.set(this.pos.x, target - 1.2, this.pos.z), 10, 4, 9); shake(0.3, this.pos); snd('stomp', this.pos, 0.5); this.speed *= 0.92; } this.vy = 0; } }
    else { this.pos.y = lerp(this.pos.y, target, Math.min(1, dt * 12)); const vy = (this.pos.y - oy) / Math.max(dt, 1e-3); if (target < this.pos.y - 0.6 && vy > -2) { this.air = true; this.vy = Math.max(vy, 0) + Math.abs(this.speed) * 0.04; } else this.vy = vy; }
    const pa = this.air ? -this.vy * 0.025 : Math.atan2(H(this.pos.x + Math.sin(this.yaw) * 3, this.pos.z + Math.cos(this.yaw) * 3) - H(this.pos.x - Math.sin(this.yaw) * 3, this.pos.z - Math.cos(this.yaw) * 3), 6);
    this.pitch = lerp(this.pitch, clamp(pa, -0.5, 0.5), Math.min(1, dt * 6)); this.roll = lerp(this.roll, -this.steerS * Math.min(1, Math.abs(this.speed) / 40) * 0.38 * (this.leanMul || 1), Math.min(1, dt * 5));
    this.obj.position.copy(this.pos); this.obj.rotation.set(-this.pitch, this.yaw, this.roll, 'YXZ');
    this.vel.set(Math.sin(this.yaw) * this.speed, this.vy, Math.cos(this.yaw) * this.speed);
    const fl = 0.4 + Math.max(0, this.speed) / 56 * (boost ? 1.6 : 1); for (const f of this.flames) f.scale.set(1, 1, fl * (0.85 + Math.random() * 0.3));
    const sp = Math.abs(this.speed); const gh = H(this.pos.x, this.pos.z);
    if (sp > 8 && !this.air && Math.random() < sp / 40) {
      const bx = this.pos.x - Math.sin(this.yaw) * 3.5, bz = this.pos.z - Math.cos(this.yaw) * 3.5;
      if (gh < 0.2) FXS.spawn(bx, 0.6, bz, rand(-3, 3), rand(3, 7), rand(-3, 3), rand(1, 2), 1.5, 5, 0.85, 0.9, 0.92, 0.6, 0.64, 0.66, 0.7, 0.6, -6);
      else FXS.spawn(bx + rand(-1.5, 1.5), gh + 0.4, bz + rand(-1.5, 1.5), rand(-2, 2) - Math.sin(this.yaw) * sp * 0.15, rand(1, 3), rand(-2, 2) - Math.cos(this.yaw) * sp * 0.15, rand(2, 4.5), 2 + sp * 0.05, 7 + sp * 0.12, 0.5, 0.42, 0.3, 0.55, 0.48, 0.38, 0.55, 0.8, 0.4);
    }
  }
  fireGuns(tp) {
    for (const sx of [-0.45, 0.45]) { _v1.set(sx, 0.6, 3.7).applyQuaternion(this.obj.quaternion).add(this.pos); fireProj({ from: _v1, to: tp, speed: 520 + Math.max(0, this.speed), kind: 'bolt', team: this.team, src: this, dmg: this.isPlayer ? 30 : 20, splash: 1.6, w: 0.16, len: 6, color: TEAM[this.team].laser, fx: 0.5 }); fxMuzzle(_v1, TEAM[this.team].laser); }
    snd('laser', this.pos, this.isPlayer ? 0.3 : 0.35);
  }
  update(dt) {
    if (!this.alive) { if (this.tumble) tumbleStep(this, dt, 2.6); if (this.tumble && this.tumble.t > 28) this.remove = true; return; }
    if (this.isPlayer || this.parked) return;
    if (this.escortOf) { // a squad member riding escort: hold a slot off the Commander's flank
      const L = this.escortOf; if (!L.alive) this.escortOf = null; else {
        const ly = leaderYaw(L), tx = L.pos.x - Math.sin(ly) * 18 + Math.cos(ly) * 14, tz = L.pos.z - Math.cos(ly) * 18 - Math.sin(ly) * 14, dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
        this.drive(dt, d > 40 ? 1 : d > 10 ? 0.5 : 0, clamp(angDiff(this.yaw, Math.atan2(dx, dz)) * 2.4, -1, 1), d > 120); return;
      }
    }
    this.think -= dt;
    if (this.think <= 0) {
      this.think = rand(0.3, 0.6);
      const t = findTarget(this, 520, e => e.kind === 'speeder'); this.target = t || findTarget(this, 140, e => e.kind === 'soldier' || e.kind === 'tank');
      this.pursuer = null; for (const e of ENTS) if (e.alive && e.kind === 'speeder' && e.team !== this.team && e.target === this && e.pos.distanceTo(this.pos) < 160) { this.pursuer = e; break; }
    }
    if (this.target && !this.target.alive) this.target = null;
    let dx, dz, boost = false, thr = 1;
    if (this.target && this.target.kind === 'speeder') {
      const d = this.pos.distanceTo(this.target.pos); const lead = d / 140; dx = this.target.pos.x + this.target.vel.x * lead - this.pos.x; dz = this.target.pos.z + this.target.vel.z * lead - this.pos.z;
      boost = d > 90; if (d < 22) thr = 0.2;
    } else {
      const w = this.route[this.wp]; dx = w[0] - this.pos.x; dz = w[1] - this.pos.z; if (Math.hypot(dx, dz) < 45) this.wp = (this.wp + 1) % this.route.length;
    }
    let want = Math.atan2(dx, dz);
    if (this.pursuer) { want += Math.sin(TIME * 2.2 + this.seed) * 0.9; boost = true; }
    let steer = clamp(angDiff(this.yaw, want) * 2.4, -1, 1);
    for (const look of [18, 34]) { _v2.set(this.pos.x + Math.sin(this.yaw) * look, this.pos.y + 0.6, this.pos.z + Math.cos(this.yaw) * look); if (buildingAt(_v2) || H(_v2.x, _v2.z) - this.pos.y > 6) { const l = buildingAt(_v3.set(this.pos.x + Math.sin(this.yaw + 0.6) * look, this.pos.y + 0.6, this.pos.z + Math.cos(this.yaw + 0.6) * look)); steer = l ? -1 : 1; thr = 0.4; break; } }
    if (Math.abs(this.pos.x) > BOUND - 40 || Math.abs(this.pos.z) > BOUND - 40) steer = clamp(angDiff(this.yaw, Math.atan2(-this.pos.x, -this.pos.z)) * 3, -1, 1);
    this.drive(dt, thr, steer, boost);
    if (!this.alive) return;
    // weapons
    this.cool -= dt;
    if (this.target && this.cool <= 0) {
      this.target.aim(_v4); const d = _v4.distanceTo(this.pos); const ang = Math.abs(angDiff(this.yaw, Math.atan2(_v4.x - this.pos.x, _v4.z - this.pos.z)));
      if (ang < 0.16 && d < 240) { _v4.add(randDir(_v5).multiplyScalar(d * 0.02)); this.fireGuns(_v4.clone()); this.burst++; this.cool = this.burst % 8 === 0 ? rand(0.8, 1.6) : 0.14; }
    }
    // ramming / side-swipes
    for (const e of ENTS) {
      if (e === this || !e.alive || e.kind !== 'speeder') continue; const d = e.pos.distanceTo(this.pos);
      if (d < 4.2) { const rel = Math.abs(this.speed - (e.speed || 0)) + 10; if (e.team !== this.team) { e.damage(rel * 1.4 * dt * 10, this, 'ram'); } fxSparks(_v1.lerpVectors(this.pos, e.pos, 0.5), 6, [3, 2, 0.8], 10); _v2.subVectors(this.pos, e.pos).setY(0).normalize(); this.pos.addScaledVector(_v2, (4.2 - d) * 0.6); this.yaw += (Math.random() - 0.5) * 0.3; snd('rifle', this.pos, 0.3); }
    }
  }
}
