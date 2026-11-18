'use strict';
/* ===================== IRON MERIDIAN · Shiftframe: transforming robot / hover vehicle ===================== */
/* Weak points by design: overheats if it lingers or flies too long, thinner armour in vehicle mode. Vehicle mode can fly (jet thrusters, up to 160 m). */
const SF_MAT = {
  1: { plate: std(0xb9c2c8, 0.38, 0.6, { map: TEX.armor.map, normalMap: TEX.armor.normal }), trim: std(0x2f6fae, 0.4, 0.5, { map: TEX.armor.map, normalMap: TEX.armor.normal }), dark: SMAT[1].dark, glow: basic(new T.Color(0.6, 2.2, 3.4)), core: basic(new T.Color(1, 3, 4)) },
  2: { plate: std(0x3a3434, 0.38, 0.6, { map: TEX.armor.map, normalMap: TEX.armor.normal }), trim: std(0xa8341f, 0.4, 0.5, { map: TEX.armor.map, normalMap: TEX.armor.normal }), dark: SMAT[2].dark, glow: basic(new T.Color(3.4, 1.0, 0.3)), core: basic(new T.Color(4, 1.5, 0.4)) },
};
class Shiftframe extends Ent {
  constructor(team) {
    super('shiftframe', team); this.name = (team === 1 ? 'Shiftframe Vector-' : 'Shiftframe Ruin-') + (Math.random() * 90 + 10 | 0);
    this.maxHp = this.hp = 1500; this.radius = 2.8; this.aimOff = 3.2; this.cull = 6; this.bulletMul = 0.2;
    const M = SF_MAT[team]; const root = new T.Group(); this.obj = root; this.parts = [];
    const part = (parent, A, B, build) => { const g = new T.Group(); parent.add(g); const b = bucket(); build(b); bakeInto(g, b, M, ['plate', 'trim', 'dark']); this.parts.push({ g, A, B }); return g; };
    // A = robot pose, B = vehicle pose: { p:[x,y,z], r:[x,y,z] }
    part(root, { p: [0, 4.3, 0], r: [0, 0, 0] }, { p: [0, 1.25, 0.7], r: [Math.PI / 2, 0, 0] }, b => {
      b.add('plate', rbox(2.6, 2.2, 1.5, 0.3)); b.add('trim', xf(rbox(2.2, 0.8, 0.3, 0.12, 2), [0, 0.6, 0.78])); b.add('dark', xf(rbox(1.6, 1.0, 0.4, 0.15, 2), [0, -0.6, 0.65]));
      b.add('core', xf(new T.CylinderGeometry(0.32, 0.32, 0.12, 16), [0, 0.1, 0.82], [Math.PI / 2, 0, 0])); b.add('glow', xf(rbox(0.9, 0.08, 0.05, 0.02, 1), [0, -0.3, 0.86]));
      b.add('plate', xf(rbox(2.9, 0.5, 1.7, 0.2, 2), [0, 1.1, 0])); b.add('dark', xf(rbox(1.6, 1.4, 0.6, 0.2, 2), [0, 0.2, -0.9]));
      for (const sx of [-1, 1]) b.add('glow', xf(new T.CircleGeometry(0.28, 12), [sx * 0.45, 0.2, -1.22], [0, Math.PI, 0]));
    });
    part(root, { p: [0, 5.75, 0.1], r: [0, 0, 0] }, { p: [0, 1.05, 2.15], r: [Math.PI / 2, 0, 0] }, b => {
      b.add('plate', rbox(0.8, 0.75, 0.8, 0.18)); b.add('glow', xf(rbox(0.6, 0.12, 0.05, 0.03, 1), [0, 0.05, 0.41])); b.add('trim', xf(rbox(0.12, 0.5, 0.9, 0.05, 1), [0, 0.45, 0]));
      for (const sx of [-1, 1]) b.add('trim', xf(rbox(0.12, 0.6, 0.3, 0.04, 1), [sx * 0.45, 0.25, -0.1], [0, 0, sx * -0.25]));
    });
    part(root, { p: [0, 3.0, 0], r: [0, 0, 0] }, { p: [0, 1.05, -0.9], r: [0, 0, 0] }, b => { b.add('dark', rbox(1.9, 0.8, 1.2, 0.2)); b.add('trim', xf(rbox(0.6, 0.6, 0.3, 0.1, 2), [0, -0.1, 0.6])); });
    this.legs = [];
    for (const sx of [-1, 1]) {
      const th = part(root, { p: [sx * 0.7, 3.0, 0], r: [0, 0, 0] }, { p: [sx * 0.9, 1.0, -1.1], r: [Math.PI / 2, 0, 0] }, b => { b.add('plate', xf(rbox(0.8, 1.6, 0.9, 0.2), [0, -0.8, 0])); b.add('trim', xf(rbox(0.82, 0.3, 0.92, 0.1, 2), [0, -0.4, 0])); });
      const sh = part(th, { p: [0, -1.6, 0], r: [0.25, 0, 0] }, { p: [0, -1.6, 0], r: [0, 0, 0] }, b => { b.add('plate', xf(rbox(0.75, 1.5, 0.95, 0.2), [0, -0.75, 0.05])); b.add('dark', xf(new T.CylinderGeometry(0.42, 0.42, 0.25, 16), [sx * 0.42, -0.7, 0], [0, 0, Math.PI / 2])); b.add('glow', xf(new T.CircleGeometry(0.25, 12), [sx * 0.56, -0.7, 0], [0, sx * Math.PI / 2, 0])); });
      const ft = part(sh, { p: [0, -1.5, 0], r: [-0.25, 0, 0] }, { p: [0, -1.5, 0], r: [0, 0, 0] }, b => { b.add('dark', xf(rbox(0.85, 0.35, 1.4, 0.12), [0, -0.15, 0.25])); b.add('glow', xf(new T.CircleGeometry(0.3, 14), [0, -0.33, 0.1], [Math.PI / 2, 0, 0])); });
      this.legs.push({ th, sh, ft });
    }
    this.arms = [];
    for (const sx of [-1, 1]) {
      const ua = part(root, { p: [sx * 1.6, 5.1, 0], r: [0, 0, sx * 0.08] }, { p: [sx * 1.35, 1.05, 0.9], r: [-Math.PI / 2, 0, 0] }, b => { b.add('plate', xf(rbox(1.0, 0.7, 1.1, 0.2), [sx * 0.2, 0.15, 0])); b.add('dark', xf(rbox(0.55, 1.4, 0.55, 0.15), [0, -0.7, 0])); });
      const fa = part(ua, { p: [0, -1.4, 0], r: [-0.9, 0, 0] }, { p: [0, -1.4, 0], r: [0, 0, 0] }, b => { b.add('plate', xf(rbox(0.65, 1.3, 0.65, 0.18), [0, -0.65, 0])); b.add('dark', xf(new T.CylinderGeometry(0.17, 0.2, 1.1, 10), [0, -1.5, 0.05])); b.add('glow', xf(new T.CylinderGeometry(0.1, 0.1, 0.05, 10), [0, -2.06, 0.05])); });
      this.arms.push({ ua, fa });
    }
    for (const sx of [-1, 1]) part(root, { p: [sx * 0.9, 4.8, -0.85], r: [0.1, 0, sx * 0.25] }, { p: [sx * 1.75, 1.35, -0.7], r: [0, 0, sx * Math.PI / 2] }, b => { b.add('trim', xf(rbox(0.12, 2.0, 1.0, 0.05, 1), [0, 0.9, 0])); b.add('glow', xf(rbox(0.06, 1.6, 0.06, 0.02, 1), [sx * 0.07, 0.9, 0.45])); });
    const thr = []; for (const [x, z] of [[-1.2, 1.6], [1.2, 1.6], [-1.2, -1.9], [1.2, -1.9]]) { const g = new T.Mesh(new T.CircleGeometry(0.6, 16).rotateX(Math.PI / 2), addMat(team === 1 ? 0x5ab8ff : 0xff6a30, 0.0)); g.position.set(x, 0.35, z); root.add(g); thr.push(g); }
    this.thr = thr; this.mode = 'robot'; this.tt = 0; this.yaw = 0; this.speed = 0; this.alt = 0; this.vy = 0; this.phase = 0; this.heat = 0; this.anchor = new V3(); this.anchorT = 0; this.cool = 0; this.gun = 0; this.think = 0; this.goal = new V3(); this.goalT = 0; this.aimYaw = 0; this.aimPitch = 0; this.wantMode = 'robot';
    this.applyPose(0);
  }
  applyPose(k) { const s = k * k * (3 - 2 * k); for (const p of this.parts) { p.g.position.set(lerp(p.A.p[0], p.B.p[0], s), lerp(p.A.p[1], p.B.p[1], s), lerp(p.A.p[2], p.B.p[2], s)); p.g.rotation.set(lerp(p.A.r[0], p.B.r[0], s), lerp(p.A.r[1], p.B.r[1], s), lerp(p.A.r[2], p.B.r[2], s)); } }
  spawnAt(p, yaw) { this.pos.set(p.x, groundY(p.x, p.z), p.z); this.yaw = yaw !== undefined ? yaw : (this.team === 1 ? Math.PI : 0); this.anchor.copy(this.pos); }
  transform() { if (this.tt > 0 && this.tt < 1 && this.mode === 'shift') return; this.wantMode = this.mode === 'robot' ? 'vehicle' : 'robot'; this.mode = 'shift'; snd('heavy', this.pos, 0.6); for (let i = 0; i < 10; i++) fxSparks(_v1.copy(this.pos).setY(this.pos.y + 2), 2, [1, 2.5, 4], 6); }
  damage(a, src, type) { if (this.mode === 'vehicle') a *= 1.35; else if (this.mode === 'robot') a *= 0.75; super.damage(a, src, type); }
  die(src) { if (this.mode !== 'robot') startTumble(this, _v1.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)), Math.max(8, this.speed * 0.7), 1); else { fxExplosion(_v1.copy(this.pos).setY(this.pos.y + 3), 3); this.collapse = 0; } if (!this.isPlayer && !this.noRespawn) SPAWNER.queue('shiftframe', this.team, 30); }
  muzzle(i, out) { this.arms[i].fa.localToWorld(out.set(0, -2.1, 0.05)); return out; }
  fire(tp) { this.gun ^= 1; this.obj.updateMatrixWorld(true); const m = this.muzzle(this.gun, new V3()); fireProj({ from: m, to: tp, speed: 480, kind: 'bolt', team: this.team, src: this, dmg: this.isPlayer ? 60 : 40, splash: 2.5, w: 0.22, len: 7, color: TEAM[this.team].laser, fx: 0.8 }); fxMuzzle(m, TEAM[this.team].laser); snd('laser', m, 0.4); }
  // anti-camping: heat builds whenever the frame lingers (robot) or slows down (vehicle)
  heatStep(dt) {
    this.anchorT += dt; if (this.pos.distanceTo(this.anchor) > 7) { this.anchor.copy(this.pos); this.anchorT = 0; }
    const lingering = this.mode === 'vehicle' ? Math.abs(this.speed) < 12 : this.anchorT > 6;
    this.heat = clamp(this.heat + (lingering ? (this.mode === 'vehicle' ? 0.45 : 0.18) : -0.3) * dt, 0, 1);
    if (this.heat >= 1) { this.damage(55 * dt, this, 'heat'); if (Math.random() < 0.4) FXS.spawn(this.pos.x, this.pos.y + 3, this.pos.z, 0, 3, 0, 1.5, 1, 4, 0.5, 0.5, 0.5, 0.3, 0.3, 0.3, 0.6, 0.5, 0.5); }
  }
  step(dt, thr, steer, up, boost) {
    if (this.mode === 'shift') { this.tt += dt / 0.8 * (this.wantMode === 'vehicle' ? 1 : -1); if (this.tt >= 1) { this.tt = 1; this.mode = 'vehicle'; } if (this.tt <= 0) { this.tt = 0; this.mode = 'robot'; } this.applyPose(clamp(this.tt, 0, 1)); this.speed *= 1 - dt; }
    const g = groundY(this.pos.x, this.pos.z), veh = this.mode === 'vehicle';
    if (veh) {
      const maxS = boost ? 70 : 52; this.speed = clamp(this.speed + thr * 30 * dt, -12, maxS); this.speed *= 1 - (thr === 0 ? 0.4 : 0.1) * dt;
      this.yaw += steer * 1.3 * dt * Math.min(1, Math.abs(this.speed) / 8 + 0.2);
      this.alt = clamp(this.alt + (up || 0) * 24 * dt, 0, 160); if (this.alt > 3) this.heat = Math.min(1, this.heat + 0.26 * dt); // flight: climb/dive, but the reactor heats up aloft
      const ty = g + 1.0 + this.alt; this.pos.y = lerp(this.pos.y, ty, Math.min(1, dt * 4));
      const sp = Math.abs(this.speed); for (const t of this.thr) t.material.opacity = 0.4 + Math.random() * 0.3;
      if (sp > 8 && Math.random() < sp / 40) { const bx = this.pos.x - Math.sin(this.yaw) * 3, bz = this.pos.z - Math.cos(this.yaw) * 3; if (H(bx, bz) < 0.2 && this.alt < 6) FXS.spawn(bx, 0.5, bz, rand(-3, 3), rand(3, 8), rand(-3, 3), rand(1, 2), 1.5, 5, 0.85, 0.9, 0.92, 0.6, 0.64, 0.66, 0.7, 0.6, -6); else if (this.alt < 6) fxDust(_v1.set(bx, H(bx, bz), bz), 1, 2, 4); }
    } else {
      for (const t of this.thr) t.material.opacity = this.mode === 'shift' ? 0.3 : 0;
      this.speed = lerp(this.speed, thr * (boost ? 9 : 6.5), Math.min(1, dt * 4)); this.yaw += steer * 1.6 * dt; this.alt = Math.max(0, this.alt - 30 * dt);
      if (H(this.pos.x, this.pos.z) < -2.5) this.speed = Math.min(this.speed, 2);
      this.pos.y = lerp(this.pos.y, g, Math.min(1, dt * 10));
      this.phase += dt * this.speed * 1.3; const s = Math.sin(this.phase), a = Math.min(1, Math.abs(this.speed) / 4);
      if (this.mode === 'robot') { this.legs[0].th.rotation.x = s * 0.6 * a; this.legs[1].th.rotation.x = -s * 0.6 * a; this.legs[0].sh.rotation.x = 0.25 + Math.max(0, -Math.cos(this.phase)) * 0.8 * a; this.legs[1].sh.rotation.x = 0.25 + Math.max(0, Math.cos(this.phase)) * 0.8 * a; }
    }
    const nx = this.pos.x + Math.sin(this.yaw) * this.speed * dt, nz = this.pos.z + Math.cos(this.yaw) * this.speed * dt;
    const b = buildingAt(_v1.set(nx, this.pos.y + 1, nz));
    if (b) { if (veh && Math.abs(this.speed) > 35) { b.damage(1500, this); this.damage(400, this, 'crash'); fxSparks(_v1, 20, [3, 2, 1], 12); } this.speed *= -0.3; } else { this.pos.x = clamp(nx, -BOUND, BOUND); this.pos.z = clamp(nz, -BOUND, BOUND); }
    if (!veh) pushOut(this.pos, 1.2);
    this.vel.set(Math.sin(this.yaw) * this.speed, 0, Math.cos(this.yaw) * this.speed);
    this.heatStep(dt);
    const roll = veh ? -steer * Math.min(1, Math.abs(this.speed) / 40) * 0.3 : 0;
    this.obj.position.copy(this.pos); this.obj.rotation.set(veh ? -this.alt * 0.004 : 0, this.yaw, roll, 'YXZ');
    if (this.mode === 'robot') { const ty = angDiff(this.yaw, this.aimYaw); this.parts[0].g.rotation.y = clamp(ty, -1.2, 1.2); for (const A of this.arms) A.ua.rotation.x = -this.aimPitch - 0.65; }
  }
  update(dt) {
    if (!this.alive) {
      this.deadT = (this.deadT || 0) + dt;
      if (this.tumble) tumbleStep(this, dt, 3.5); else { this.obj.rotation.x = Math.min(1.4, this.deadT * 0.8); this.obj.position.y = this.pos.y - Math.min(1, this.deadT * 0.5); if (this.deadT > 1 && !this.boomed) { this.boomed = true; fxExplosion(_v1.copy(this.pos).setY(this.pos.y + 2), 3.5); addEmitter(_v1.clone(), 2, 30); } }
      if (this.deadT > 30) this.remove = true; return;
    }
    if (this.isPlayer || this.parked) return;
    this.think -= dt; this.goalT -= dt;
    if (this.think <= 0) { this.think = 0.5; this.target = findTarget(this, 200, e => isGroundVeh(e) || e.kind === 'soldier' || e.kind === 'monster'); if (this.goalT <= 0 || this.pos.distanceTo(this.goal) < 20) { const cp = pickObjective(this.team, this.pos); this.goalCP = cp; this.goal.set(cp.x + rand(-40, 40), 0, cp.z + rand(-40, 40)); this.goalT = rand(14, 26); } }
    if (this.target && !this.target.alive) this.target = null;
    const dGoal = Math.hypot(this.goal.x - this.pos.x, this.goal.z - this.pos.z);
    const wantVeh = !this.target || this.pos.distanceTo(this.target.pos) > 90 || this.heat > 0.6;
    if ((wantVeh && this.mode === 'robot') || (!wantVeh && this.mode === 'vehicle' && Math.random() < dt)) this.transform();
    let want = Math.atan2(this.goal.x - this.pos.x, this.goal.z - this.pos.z);
    if (this.mode === 'robot' && this.target) want = Math.atan2(this.target.pos.x - this.pos.x, this.target.pos.z - this.pos.z) + Math.sin(TIME + this.pos.x) * 0.8;
    const ahead = _v2.set(this.pos.x + Math.sin(this.yaw) * 20, this.pos.y + 1, this.pos.z + Math.cos(this.yaw) * 20); const blk = buildingAt(ahead);
    this.step(dt, this.mode === 'robot' ? (this.target ? 0.6 : 1) : (dGoal > 15 ? 1 : 0.6), clamp(angDiff(this.yaw, want) * 2, -1, 1) * (blk ? -1 : 1), !!blk || (this.mode === 'vehicle' && H(ahead.x, ahead.z) > this.pos.y - 1), dGoal > 200);
    if (this.target) { this.target.aim(_v3); this.aimYaw = Math.atan2(_v3.x - this.pos.x, _v3.z - this.pos.z); this.aimPitch = Math.atan2(_v3.y - this.pos.y - 4, Math.hypot(_v3.x - this.pos.x, _v3.z - this.pos.z)); this.cool -= dt;
      const ok = this.mode === 'robot' || (this.mode === 'vehicle' && Math.abs(angDiff(this.yaw, this.aimYaw)) < 0.2);
      if (ok && this.cool <= 0 && this.pos.distanceTo(this.target.pos) < 220) { this.cool = rand(0.35, 0.7); this.fire(_v3.clone().add(randDir(_v4).multiplyScalar(this.pos.distanceTo(_v3) * 0.02))); } }
    else this.aimYaw = this.yaw;
  }
}
