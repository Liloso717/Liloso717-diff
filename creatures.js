'use strict';
/* ===================== IRON MERIDIAN · the deep titan and the skyrunner mounts ===================== */
TEX.scales = bakeTex(256, (S, col, hgt) => {
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const cs = 14, cx = Math.floor(x / cs), u = x / cs, v = y / cs + (cx % 2) * 0.5; const fx = u - Math.floor(u) - 0.5, fy = v - Math.floor(v) - 0.5; const d = Math.hypot(fx, fy * 1.15);
    const k = y * S + x, n = vnoise(x * 0.08, y * 0.08); hgt[k] = Math.max(0, 1 - d * 1.7) + n * 0.2; const b = 0.75 + (1 - d) * 0.3 + n * 0.15 - (d > 0.46 ? 0.35 : 0);
    col[k * 3] = b * 0.95; col[k * 3 + 1] = b; col[k * 3 + 2] = b * 1.05;
  }
}, 3.2, 6);
const crackTex = canvasTex(512, 512, (g) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
  const branch = (x, y, a, len, w) => { if (len < 6 || w < 0.4) return; g.strokeStyle = `rgba(255,255,255,${0.5 + w * 0.15})`; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); let px = x, py = y; for (let i = 0; i < 6; i++) { a += rand(-0.5, 0.5); px += Math.cos(a) * len / 6; py += Math.sin(a) * len / 6; g.lineTo(px, py); } g.stroke(); if (Math.random() < 0.8) branch(px, py, a + rand(-1, 1), len * 0.7, w * 0.7); if (Math.random() < 0.5) branch(px, py, a + rand(-1.5, 1.5), len * 0.6, w * 0.6); };
  for (let i = 0; i < 26; i++) branch(Math.random() * 512, Math.random() * 512, Math.random() * 6.28, rand(60, 160), rand(2, 4));
});
crackTex.repeat.set(3, 3);

/* ---------------- the Deep Titan ---------------- */
const TITAN_MAT = {
  skin: std(0x34363c, 0.5, 0.25, { map: TEX.scales.map, normalMap: TEX.scales.normal, emissiveMap: crackTex, emissive: 0x2fd0ff, emissiveIntensity: 0.9 }),
  belly: std(0x4a4640, 0.6, 0.2, { map: TEX.scales.map, normalMap: TEX.scales.normal }),
  metal: std(0x45484e, 0.28, 0.95, { normalMap: TEX.armor.normal }),
  spine: std(0x1c1e22, 0.35, 0.4, { emissive: 0x38e0ff, emissiveIntensity: 0.6, normalMap: TEX.scales.normal }),
  teeth: std(0xe8e2d0, 0.3, 0.1), claw: std(0x15130f, 0.3, 0.3),
  eye: basic(new T.Color(1.2, 4, 5)), glow: basic(new T.Color(0.8, 3, 4)),
};
class Titan extends Ent {
  constructor() {
    super('monster', 3); this.name = 'Gorgauth, the Deep Titan'; this.maxHp = this.hp = 52000; this.radius = 18; this.cull = 60; this.aimOff = 34; this.bulletMul = 0.08;
    const M = TITAN_MAT; const root = new T.Group(); this.obj = root;
    const hips = new T.Group(); hips.position.y = 22; root.add(hips); this.hips = hips;
    const mesh = (g, m, p, r = [0, 0, 0], s = [1, 1, 1], parent) => { const o = new T.Mesh(g, m); o.position.set(p[0], p[1], p[2]); o.rotation.set(r[0], r[1], r[2]); o.scale.set(s[0], s[1], s[2]); o.castShadow = true; (parent || hips).add(o); return o; };
    // legs
    this.legs = [];
    for (const sx of [-1, 1]) {
      const th = new T.Group(); th.position.set(sx * 7, 0, 0); hips.add(th);
      mesh(new T.SphereGeometry(6, 18, 14), M.skin, [0, -1, 0], [0, 0, 0], [1, 1.2, 1.1], th);
      mesh(lathe([[5.2, 0], [5.4, -3], [4.4, -8], [3.4, -12]], 16), M.skin, [0, 0, 0], [0, 0, 0], [1, 1, 1], th);
      const kn = new T.Group(); kn.position.y = -12; th.add(kn);
      mesh(lathe([[3.4, 0], [3.2, -4], [2.6, -11]], 14), M.skin, [0, 0, 0], [0, 0, 0], [1, 1, 1], kn);
      mesh(rbox(3, 3, 5, 1), M.metal, [0, -3, 2.2], [0.2, 0, 0], [1, 1, 1], kn);
      const an = new T.Group(); an.position.y = -11; kn.add(an);
      mesh(rbox(6.5, 2.6, 9, 1.2), M.skin, [0, -0.6, 2.2], [0, 0, 0], [1, 1, 1], an);
      for (const cx of [-2.2, 0, 2.2]) mesh(new T.ConeGeometry(0.8, 3.2, 8), M.claw, [cx, -1, 7.2], [Math.PI / 2 + 0.3, 0, 0], [1, 1, 1], an);
      this.legs.push({ th, kn, an, last: 0 });
    }
    // torso
    const torso = new T.Group(); torso.rotation.x = 0.38; hips.add(torso); this.torso = torso;
    mesh(new T.SphereGeometry(1, 28, 20), M.skin, [0, 12, 0], [0, 0, 0], [11, 16, 11.5], torso);
    for (let i = 0; i < 8; i++) mesh(rbox(10 - Math.abs(i - 3) * 0.8, 1.8, 2, 0.8, 2), M.belly, [0, 2 + i * 2.6, 9.6 - Math.abs(i - 4) * 0.4], [-0.15, 0, 0], [1, 1, 1], torso);
    mesh(rbox(7, 6, 1.5, 0.6, 2), M.metal, [-6, 16, 6.5], [0, -0.7, 0.2], [1, 1, 1], torso); mesh(new T.CylinderGeometry(1.2, 1.2, 0.4, 14), M.glow, [-7.4, 16, 7.6], [Math.PI / 2, -0.7, 0], [1, 1, 1], torso);
    mesh(rbox(1, 9, 0.8, 0.3, 1), M.glow, [-5.5, 14, 7.4], [0, -0.7, 0.2], [1, 1, 1], torso);
    // arms
    this.arms = [];
    for (const sx of [-1, 1]) {
      const sh = new T.Group(); sh.position.set(sx * 9.5, 20, 4); torso.add(sh);
      mesh(lathe([[2.4, 0], [2.6, -2], [1.9, -7]], 12), M.skin, [0, 0, 0], [0, 0, 0], [1, 1, 1], sh);
      const el = new T.Group(); el.position.y = -7; sh.add(el); el.rotation.x = -1.1;
      mesh(lathe([[1.9, 0], [1.6, -6]], 12), M.skin, [0, 0, 0], [0, 0, 0], [1, 1, 1], el);
      for (const cx of [-0.9, 0, 0.9]) mesh(new T.ConeGeometry(0.4, 2.4, 6), M.claw, [cx, -7, 0.5], [Math.PI, 0, 0], [1, 1, 1], el);
      sh.rotation.x = -0.5; this.arms.push({ sh, el });
    }
    // neck & head
    const neck = new T.Group(); neck.position.set(0, 25, 3); torso.add(neck); this.neck = neck;
    mesh(lathe([[6.5, 0], [5.2, 4], [4.4, 8]], 18), M.skin, [0, 0, 0], [0.5, 0, 0], [1, 1, 1], neck);
    const head = new T.Group(); head.position.set(0, 7, 4); neck.add(head); this.head = head;
    mesh(new T.SphereGeometry(1, 24, 18), M.skin, [0, 1.2, 3], [0, 0, 0], [4.4, 3.8, 6.5], head);
    mesh(rbox(5.2, 3.2, 7, 1.3), M.skin, [0, 0.4, 8.4], [0.08, 0, 0], [1, 1, 1], head);
    for (const sx of [-1, 1]) {
      mesh(new T.SphereGeometry(0.75, 12, 10), M.eye, [sx * 2.7, 2.4, 6.6], [0, 0, 0], [1, 0.6, 1], head);
      mesh(rbox(2, 0.8, 4, 0.3, 1), M.skin, [sx * 2.6, 3.3, 6.4], [0.15, sx * 0.2, sx * -0.3], [1, 1, 1], head);
      mesh(new T.ConeGeometry(0.9, 6, 8), M.spine, [sx * 2.2, 4, -0.5], [-1.0, 0, sx * -0.35], [1, 1, 1], head);
      mesh(rbox(1.2, 3.2, 4, 0.4, 1), M.metal, [sx * 4.2, 1.2, 2.5], [0, sx * 0.2, 0], [1, 1, 1], head);
      for (let i = 0; i < 7; i++) mesh(new T.ConeGeometry(0.32, 1.6, 6), M.teeth, [sx * 2.3, -1.3, 5.6 + i * 0.95], [Math.PI, 0, 0], [1, 1, 1], head);
    }
    mesh(new T.CylinderGeometry(0.6, 0.6, 0.3, 12), M.glow, [-4.35, 1.5, 3], [0, 0, Math.PI / 2], [1, 1, 1], head);
    const jaw = new T.Group(); jaw.position.set(0, -0.6, 2.5); head.add(jaw); this.jaw = jaw;
    mesh(rbox(4.4, 1.6, 8.5, 0.7, 2), M.belly, [0, -1, 5], [0, 0, 0], [1, 1, 1], jaw);
    for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) mesh(new T.ConeGeometry(0.3, 1.4, 6), M.teeth, [sx * 1.9, 0.2, 4 + i * 1.0], [0, 0, 0], [1, 1, 1], jaw);
    // dorsal plates along back and neck
    for (let i = 0; i < 9; i++) { const h = 5 + Math.sin(i / 8 * Math.PI) * 5; for (const sx of [-1, 0, 1]) { if (sx && i % 2) continue; mesh(new T.ConeGeometry(2.2, h, 4), M.spine, [sx * 2.4, 4 + i * 3, -9 + i * 0.9 - (sx ? 0.4 : 0)], [-0.55, Math.PI / 4, sx * 0.35], [sx ? 0.25 : 0.35, 1, 1], torso); } }
    // tail
    this.tail = []; let parent = hips; let px = 0, py = -1, pz = -7;
    for (let i = 0; i < 13; i++) {
      const r0 = 6.2 - i * 0.44, L = 4.6 - i * 0.12; const seg = new T.Group(); seg.position.set(px, py, pz); parent.add(seg);
      mesh(new T.CylinderGeometry(Math.max(0.5, r0 - 0.44), Math.max(0.6, r0), L + 0.6, 14).rotateX(Math.PI / 2).translate(0, 0, -L / 2), M.skin, [0, 0, 0], [0, 0, 0], [1, 0.9, 1], seg);
      mesh(new T.ConeGeometry(Math.max(0.6, r0 * 0.38), Math.max(1.2, r0 * 0.9), 4), M.spine, [0, r0 * 0.75, -L / 2], [-0.5, Math.PI / 4, 0], [0.3, 1, 1], seg);
      seg.rotation.x = i === 0 ? -0.18 : 0.04; this.tail.push(seg); parent = seg; px = 0; py = 0; pz = -L;
    }
    this.heading = 0; this.speed = 0; this.phase = 0; this.state = 'walk'; this.st = 0; this.think = 0; this.goal = new V3(); this.breathCd = 8; this.biteCd = 0; this.roarCd = 6; this.crushT = 0;
    this.beamPt = new V3(); this.beamA = 0; this.mouth = new V3(); this.glowK = 0.6; this.deadT = 0;
  }
  aim(out) { return out.set(this.pos.x + Math.sin(this.heading) * 4, this.pos.y + 34, this.pos.z + Math.cos(this.heading) * 4); }
  surfDist(p) { this.aim(_v4); const a = p.distanceTo(_v4) - 17; this.head.getWorldPosition(_v4); return Math.min(a, p.distanceTo(_v4) - 8, Math.hypot(p.x - this.pos.x, p.z - this.pos.z) - 9 + Math.max(0, p.y - this.pos.y - 30)); }
  spawnAt(p) { this.pos.set(p.x, Math.min(groundY(p.x, p.z), 0), p.z); this.heading = Math.atan2(-p.x, -p.z); this.goal.set(0, 0, 0); }
  killed(src) {
    if (this.isPlayer) { if (PLAYER.hero && PLAYER.ent === this) hopOff(true); else onPlayerDeath(src); }
    if (src && src.isPlayer) { PLAYER.kills++; hitMarker(true); awardPoints(5000, 'Titan slain'); }
    killFeed(src && src.kind ? src : null, this, 'brought down', src && src.isPlayer);
    banner('The Titan has fallen', src && src.team ? `${TEAM[src.team].name} landed the final blow` : 'Both armies breathe again', 'var(--amber)');
    comms(null, 'The titan is down! Repeat, the titan is down!', 'cmd'); this.deadT = 0; this.cineEvent = TIME; TITAN_CTL.next = rand(150, 210);
  }
  mouthPos(out) { return this.head.localToWorld(out.set(0, -0.6, 11.5)); }
  update(dt) {
    const M = TITAN_MAT;
    if (!this.alive) {
      this.deadT += dt; const t = Math.min(1, this.deadT / 3.5);
      this.obj.rotation.z = t * t * 1.35; this.obj.position.y = this.pos.y - t * 6; this.jaw.rotation.x = 0.5;
      if (t >= 1 && !this.landed) { this.landed = true; _v1.set(this.pos.x + Math.cos(this.heading) * -30, groundY(this.pos.x, this.pos.z), this.pos.z); fxExplosion(_v1, 6); shockRing(_v1, 200, 2); shake(2.5, _v1); fxDust(_v1, 30, 18, 20); explodeDamage(_v1, 30, 900, this, 3); for (let i = 0; i < 4; i++) addEmitter(_v1.clone().add(new V3(rand(-25, 25), 4, rand(-25, 25))), 3, 80); }
      M.skin.emissiveIntensity = Math.max(0, 0.9 - this.deadT * 0.05); M.spine.emissiveIntensity = Math.max(0, 0.6 - this.deadT * 0.05);
      if (this.deadT > 40) this.remove = true; return;
    }
    this.life = (this.life || 0) + dt;
    if (this.life > 300 && !this.leaving && !this.isPlayer && this.team === 3) { this.leaving = true; this.state = 'walk'; comms(null, 'The titan is turning back toward the sea!', 'cmd'); }
    if (this.leaving) { this.target = null; this.goal.set(coastX(this.pos.z) + 400, 0, this.pos.z); this.think = 9; if (this.pos.x > coastX(this.pos.z) + 330) { this.remove = true; TITAN_CTL.next = rand(150, 210); banner('The titan has retreated', 'It will return', 'var(--amber)'); return; } }
    this.st += dt; this.think -= dt; this.breathCd -= dt; this.biteCd -= dt; this.roarCd -= dt; this.crushT -= dt; this.stompCd = (this.stompCd || 0) - dt;
    if (this.think <= 0 && !this.isPlayer) {
      this.think = 1.5; let best = null, bs = 0;
      for (const e of ENTS) { if (!e.alive || e === this || !e.hitR || e.kind === 'capital' || e.kind === 'shieldgen' || (e.kind === 'fighter' && e.pos.y > 140)) continue; const d = e.pos.distanceTo(this.pos); if (d > 330) continue; if (e.kind === 'naval' && d > 90) continue; const w = ({ walker: 6, tank: 4, shiftframe: 4, speeder: 3, gunship: 3, naval: 2, bird: 3 }[e.kind] || 1) * (e.isPlayer ? 1.2 : 1) / (d + 40) * (H(e.pos.x, e.pos.z) > 0 ? 1.6 : 0.5); if (w > bs) { bs = w; best = e; } }
      this.target = best;
      if (best) this.goal.copy(best.pos); else if (this.goal.distanceTo(this.pos) < 30) { const cp = pick(CPS); this.goal.set(cp.x + rand(-40, 40), 0, cp.z + rand(-40, 40)); }
    }
    if (this.target && !this.target.alive) this.target = null;
    this.mouthPos(this.mouth);
    let wantSpeed = 0;
    const C = this.ctl;
    if (this.state === 'walk' && this.isPlayer && C) {
      this.heading += -C.turn * 0.6 * dt; wantSpeed = C.f > 0 ? (C.run ? 9.5 : 6) : C.f < 0 ? -2.5 : 0;
      if (C.breath && this.breathCd <= 0) { this.state = 'charge'; this.st = 0; this.breathCd = 9; }
      else if (C.bite && this.biteCd <= 0) { this.state = 'bite'; this.st = 0; this.biteCd = 1.6; }
      else if (C.stomp && this.stompCd <= 0) { this.state = 'stomp'; this.st = 0; this.stompCd = 6; }
      else if (C.roar && this.roarCd <= 0) { this.state = 'roar'; this.st = 0; this.roarCd = 14; banner('ROAR', 'The titan roars across the battlefield', 'var(--amber)'); }
    } else if (this.state === 'walk') {
      const dx = this.goal.x - this.pos.x, dz = this.goal.z - this.pos.z; const d = Math.hypot(dx, dz);
      this.heading = angLerp(this.heading, Math.atan2(dx, dz), 0.3 * dt); wantSpeed = d > 25 ? (H(this.pos.x, this.pos.z) < -4 ? 5 : 6) : 0;
      if (this.target) {
        this.target.aim(_v1); const hd = Math.hypot(_v1.x - this.mouth.x, _v1.z - this.mouth.z); const td = this.pos.distanceTo(this.target.pos);
        if (hd < 16 && _v1.y < this.mouth.y + 10 && this.biteCd <= 0) { this.state = 'bite'; this.st = 0; this.biteCd = 4; }
        else if (td > 45 && td < 260 && this.breathCd <= 0) { this.state = 'charge'; this.st = 0; this.breathCd = rand(14, 20); comms(null, 'The titan is charging its breath! Get to cover!', 'cmd'); }
      }
      if (this.roarCd <= 0) { this.state = 'roar'; this.st = 0; this.roarCd = rand(26, 40); }
    } else if (this.state === 'roar') {
      this.jaw.rotation.x = Math.min(0.75, this.st * 2) * (this.st < 2.6 ? 1 : (3 - this.st) / 0.4); this.head.rotation.x = -0.35 * Math.sin(Math.min(1, this.st / 3) * Math.PI);
      if (this.st > 0.3 && this.st < 0.35) { snd('roar', this.pos, 2.2); shake(1.2, this.pos); for (let i = 0; i < 16; i++) { randDir(_v5); FXS.spawn(this.mouth.x, this.mouth.y, this.mouth.z, _v5.x * 6 + Math.sin(this.heading) * 14, _v5.y * 4, _v5.z * 6 + Math.cos(this.heading) * 14, 2.5, 3, 14, 0.4, 0.42, 0.45, 0.3, 0.3, 0.32, 0.4, 0.8, 0.5); } }
      if (this.st > 3) { this.state = 'walk'; this.jaw.rotation.x = 0; this.head.rotation.x = 0; }
    } else if (this.state === 'charge') {
      this.glowK = 0.6 + this.st * 1.6 + Math.sin(TIME * 30) * 0.3; this.jaw.rotation.x = this.st * 0.15;
      for (let i = 0; i < 3; i++) { randDir(_v5).multiplyScalar(14); FXA.spawn(this.mouth.x + _v5.x, this.mouth.y + _v5.y, this.mouth.z + _v5.z, -_v5.x * 1.6, -_v5.y * 1.6, -_v5.z * 1.6, 0.6, 1.5, 0.3, 0.8, 3, 4, 0.5, 2, 3, 1, 0, 0); }
      if (this.isPlayer && C) this.beamPt.copy(C.aim); else if (this.target) { this.target.aim(this.beamPt); this.heading = angLerp(this.heading, Math.atan2(this.beamPt.x - this.pos.x, this.beamPt.z - this.pos.z), dt); }
      if (this.st > 2.2) { this.state = 'breath'; this.st = 0; this.beamA = rand(-1, 1) < 0 ? -1 : 1; snd('roar', this.pos, 1.6); if (this.isPlayer && C) this.beamPt.copy(C.aim); else if (this.target) { this.target.aim(this.beamPt); } else this.beamPt.set(this.pos.x + Math.sin(this.heading) * 120, 0, this.pos.z + Math.cos(this.heading) * 120); this.beamBase = this.beamPt.clone(); }
    } else if (this.state === 'breath') {
      this.glowK = 3.2 + Math.random(); this.jaw.rotation.x = 0.55;
      const side = _v2.set(Math.cos(this.heading), 0, -Math.sin(this.heading)); const sweep = (this.st / 3.6 - 0.5) * 70 * this.beamA;
      if (this.isPlayer && C) this.beamPt.copy(C.aim); else { this.beamPt.copy(this.beamBase).addScaledVector(side, sweep); this.beamPt.y = groundY(this.beamPt.x, this.beamPt.z); }
      _v3.subVectors(this.beamPt, this.mouth).normalize(); const r = rayCast(this.mouth.clone().addScaledVector(_v3, 8), _v3.clone(), 600, this, this.team);
      if (!this.beamG || !this.beamG.visible) this.beamG = beam(this.mouth, r.point, 4.5, 3.8, 0x38d8ff);
      this.beamG.position.copy(this.mouth); _v1.subVectors(r.point, this.mouth); this.beamG.scale.y = _v1.length(); this.beamG.quaternion.setFromUnitVectors(UP, _v1.normalize()); this.beamG.userData.t = Math.min(this.beamG.userData.t, 1.5);
      this.beamTick = (this.beamTick || 0) - dt;
      if (this.beamTick <= 0) { this.beamTick = 0.14; fxExplosion(r.point, 2.6); explodeDamage(r.point, 9, 240, this, 3); if (r.bld) r.bld.damage(2500, this); if (Math.random() < 0.3) addEmitter(r.point.clone().setY(r.point.y + 1), 2, 40); FXA.spawn(r.point.x, r.point.y + 2, r.point.z, 0, 4, 0, 0.4, 14, 22, 1.2, 3.4, 4.5, 0.2, 1, 2, 1, 0, 0); }
      shake(dt * 1.2, this.pos);
      if (this.st > 3.6) { this.state = 'walk'; this.jaw.rotation.x = 0; this.glowK = 0.6; if (this.beamG) this.beamG.visible = false; }
    } else if (this.state === 'stomp') {
      this.hips.position.y = 22 - Math.sin(Math.min(1, this.st / 0.7) * Math.PI) * 4; this.torso.rotation.x = 0.38 + Math.sin(Math.min(1, this.st / 0.7) * Math.PI) * 0.25;
      if (this.st > 0.55 && !this.slammed) { this.slammed = true; _v1.set(this.pos.x + Math.sin(this.heading) * 8, groundY(this.pos.x, this.pos.z), this.pos.z + Math.cos(this.heading) * 8); explodeDamage(_v1, 30, 650, this, this.team); shockRing(_v1, 120, 1.2, 0xd8c8b0); fxDust(_v1, 40, 14, 22); shake(2, _v1); snd('big', _v1, 1.6); for (let i = 0; i < 6; i++) fxExplosion(_v4.set(_v1.x + rand(-20, 20), _v1.y, _v1.z + rand(-20, 20)), 1.5); }
      if (this.st > 1.2) { this.state = 'walk'; this.slammed = false; this.torso.rotation.x = 0.38; }
    } else if (this.state === 'bite') {
      const k = this.st / 1.2; this.neck.rotation.x = Math.sin(k * Math.PI) * 0.6; this.jaw.rotation.x = k < 0.45 ? k * 1.6 : Math.max(0, 0.72 - (k - 0.45) * 3);
      if (this.st > 0.55 && !this.bit) { this.bit = true; explodeDamage(this.mouthPos(_v1), 11, 900, this, 3); fxSparks(_v1, 20, [3, 2, 1], 12); shake(0.8, _v1); snd('boom', _v1, 1); }
      if (this.st > 1.2) { this.state = 'walk'; this.bit = false; this.neck.rotation.x = 0; this.jaw.rotation.x = 0; }
    }
    M.skin.emissiveIntensity = 0.6 + this.glowK * 0.35 + Math.sin(TIME * 2) * 0.1; M.spine.emissiveIntensity = this.glowK;
    // locomotion
    this.speed = lerp(this.speed, wantSpeed, Math.min(1, dt * 0.8)); this.phase += dt * this.speed * 0.2;
    const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt, nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
    this.pos.x = clamp(nx, -BOUND - 300, BOUND + 300); this.pos.z = clamp(nz, -BOUND, BOUND); this.pos.y = lerp(this.pos.y, H(this.pos.x, this.pos.z), Math.min(1, dt * 2));
    const amp = Math.min(1, Math.abs(this.speed) / 3);
    this.legs.forEach((L, i) => {
      const ph = this.phase + i * Math.PI, s = Math.sin(ph), c = Math.cos(ph);
      L.th.rotation.x = -0.15 + s * 0.42 * amp; L.kn.rotation.x = 0.35 + Math.max(0, c) * 0.5 * amp; L.an.rotation.x = -(L.th.rotation.x + L.kn.rotation.x) + 0.05;
      if (L.last > 0 && c <= 0 && amp > 0.3) {
        L.an.getWorldPosition(_v1); _v1.y = groundY(_v1.x, _v1.z);
        if (H(_v1.x, _v1.z) < 0) fxWaterSplash(_v1, 3); else { fxDust(_v1, 14, 9, 12); shockRing(_v1, 30, 0.8, 0xd8c8b0); }
        shake(1.0, _v1); snd('stomp', _v1, 2); explodeDamage(_v1, 9, 260, this, 3);
        for (const b of BUILDINGS) if (b.alive && Math.abs(b.x - _v1.x) < b.w / 2 + 8 && Math.abs(b.z - _v1.z) < b.d / 2 + 8) b.damage(5000, this);
      }
      L.last = c;
    });
    this.hips.position.y = 22 - Math.abs(Math.sin(this.phase)) * 1.2 * amp; this.hips.rotation.z = Math.sin(this.phase) * 0.05 * amp; this.hips.rotation.y = Math.sin(this.phase) * 0.06 * amp;
    for (let i = 0; i < this.tail.length; i++) { this.tail[i].rotation.y = Math.sin(TIME * 1.1 - i * 0.5) * (0.08 + i * 0.008); if (i) this.tail[i].rotation.x = 0.03 + Math.sin(TIME * 0.7 - i * 0.4) * 0.02; }
    for (const A of this.arms) A.sh.rotation.x = -0.5 + Math.sin(this.phase + 1) * 0.15 * amp;
    if (this.state === 'walk' && this.target) { this.target.aim(_v1); const want = angDiff(this.heading, Math.atan2(_v1.x - this.pos.x, _v1.z - this.pos.z)); this.neck.rotation.y = lerp(this.neck.rotation.y, clamp(want, -0.7, 0.7), dt * 1.5); } else if (this.state !== 'bite') this.neck.rotation.y *= 1 - dt;
    if (this.crushT <= 0) { this.crushT = 0.3; for (const b of BUILDINGS) if (b.alive && Math.abs(b.x - this.pos.x) < b.w / 2 + 12 && Math.abs(b.z - this.pos.z) < b.d / 2 + 12) { b.damage(3000, this); fxDust(_v1.set(b.x, b.gy + 4, b.z), 4, 8, 8); } }
    if (H(this.pos.x, this.pos.z) < -2 && this.speed > 1 && Math.random() < 0.5) fxWaterSplash(_v1.set(this.pos.x + rand(-10, 10), 0, this.pos.z + rand(-10, 10)), 1.2);
    this.vel.set(Math.sin(this.heading) * this.speed, 0, Math.cos(this.heading) * this.speed);
    this.obj.position.copy(this.pos); this.obj.rotation.set(0, this.heading, 0);
  }
}
const TITAN_CTL = { next: 75, ent: null };
function updateTitanSpawner(dt) {
  if (TITAN_CTL.ent && !TITAN_CTL.ent.remove) return;
  TITAN_CTL.ent = null; if (GAME.state === 'menu' || GAME.state === 'showcase') return; TITAN_CTL.next -= dt;
  if (TITAN_CTL.next <= 0) {
    const z = rand(-280, 280); const t = new Titan(); t.spawnAt(new V3(coastX(z) + 150, 0, z)); t.heading = -Math.PI / 2; t.goal.set(DIST('dam').x, 0, DIST('dam').z); addEnt(t); TITAN_CTL.ent = t;
    banner('Titan surfacing', 'Gorgauth is coming ashore below the Seawall Dam. It attacks everyone.', 'var(--amber)');
    comms(null, 'ALL UNITS: massive bio-signature rising off the east coast! It is hostile to both sides!', 'cmd'); snd('roar', null, 1.2);
    for (let i = 0; i < 20; i++) fxWaterSplash(_v1.set(t.pos.x + rand(-30, 30), 0, t.pos.z + rand(-30, 30)), 3);
  }
}

/* ---------------- Skyrunners: rideable raptor-birds ---------------- */
const BIRD_COL = [
  { feather: std(0x2e6a62, 0.75, 0.05, { normalMap: TEX.cloth.normal }), under: std(0xd8c49a, 0.8, 0), accent: std(0xc8962e, 0.5, 0.3), name: 'Skyrunner Jadewing' },
  { feather: std(0x6e1e1a, 0.75, 0.05, { normalMap: TEX.cloth.normal }), under: std(0x2a2422, 0.8, 0), accent: std(0xe0b040, 0.5, 0.3), name: 'Skyrunner Emberclaw' },
];
class Bird extends Ent {
  constructor(idx) {
    super('bird', 0); const C = BIRD_COL[idx]; this.name = C.name; this.maxHp = this.hp = 1100; this.radius = 2.4; this.aimOff = 2.4; this.cull = 5; this.bulletMul = 0.5; this.hitR = false; this.idx = idx;
    const root = new T.Group(); const body = new T.Group(); root.add(body); this.obj = root; this.body = body;
    const m = (g, mat, p, r = [0, 0, 0], s = [1, 1, 1], par) => { const o = new T.Mesh(g, mat); o.position.set(p[0], p[1], p[2]); o.rotation.set(r[0], r[1], r[2]); o.scale.set(s[0], s[1], s[2]); o.castShadow = true; (par || body).add(o); return o; };
    m(new T.SphereGeometry(1, 20, 14), C.feather, [0, 2.5, 0], [0.1, 0, 0], [1.05, 1.0, 2.0]);
    m(new T.SphereGeometry(1, 16, 12), C.under, [0, 2.2, 0.4], [0.1, 0, 0], [0.85, 0.75, 1.6]);
    m(rbox(1.3, 0.25, 1.4, 0.1), MAT_RUST, [0, 3.45, -0.2]); m(rbox(1.0, 0.4, 0.2, 0.08), std(0x2a1c14, 0.6, 0.2), [0, 3.65, 0.4]);
    for (const sx of [-1, 1]) m(new T.TorusGeometry(1.05, 0.05, 4, 20, Math.PI), std(0x2a1c14, 0.6, 0.2), [sx * 0.02, 2.6, -0.2], [0, Math.PI / 2, 0], [1, 1, 1.05]);
    const neck = new T.Group(); neck.position.set(0, 3, 1.6); body.add(neck); this.neck = neck;
    m(tube([[0, 0, 0], [0, 0.8, 0.5], [0, 1.6, 0.6]], 0.42, 10, 8), C.feather, [0, 0, 0], [0, 0, 0], [1, 1, 1], neck);
    const head = new T.Group(); head.position.set(0, 1.7, 0.7); neck.add(head); this.head = head;
    m(new T.SphereGeometry(0.45, 14, 10), C.feather, [0, 0, 0], [0, 0, 0], [0.9, 0.9, 1.25], head);
    m(new T.ConeGeometry(0.28, 1.1, 10), C.accent, [0, -0.1, 0.9], [Math.PI / 2 + 0.15, 0, 0], [1, 1, 0.75], head);
    for (const sx of [-1, 1]) m(new T.SphereGeometry(0.08, 8, 6), basic(new T.Color(3, 2.2, 0.4)), [sx * 0.3, 0.12, 0.35], [0, 0, 0], [1, 1, 1], head);
    for (let i = 0; i < 5; i++) m(new T.ConeGeometry(0.07, 0.9 + i * 0.12, 4), C.accent, [(i - 2) * 0.08, 0.4, -0.2 - i * 0.12], [-1.1 - i * 0.08, 0, 0], [1, 1, 0.4], head);
    this.wings = [];
    for (const sx of [-1, 1]) {
      const w = new T.Group(); w.position.set(sx * 0.95, 3.0, 0.4); body.add(w);
      m(rbox(2.4, 0.12, 1.3, 0.05), C.feather, [sx * 1.2, 0, 0], [0, 0, 0], [1, 1, 1], w);
      const tip = new T.Group(); tip.position.set(sx * 2.4, 0, 0); w.add(tip);
      for (let i = 0; i < 6; i++) m(rbox(1.9 - i * 0.12, 0.05, 0.38, 0.03, 1), i % 2 ? C.accent : C.feather, [sx * (0.9 - i * 0.05), 0, 0.4 - i * 0.32], [0, sx * (0.12 + i * 0.12), 0], [1, 1, 1], tip);
      this.wings.push({ w, tip, sx });
    }
    for (let i = 0; i < 7; i++) m(rbox(0.32, 0.05, 2.2, 0.03, 1), i % 2 ? C.accent : C.feather, [0, 2.6, -2.5], [0.15, (i - 3) * 0.16, 0], [1, 1, 1]);
    this.legs = [];
    for (const sx of [-1, 1]) {
      const th = new T.Group(); th.position.set(sx * 0.6, 2.0, 0); body.add(th);
      m(lathe([[0.36, 0], [0.34, -0.5], [0.2, -1.0]], 10), C.feather, [0, 0, 0], [0, 0, 0], [1, 1, 1], th);
      const sh = new T.Group(); sh.position.y = -1.0; th.add(sh); m(new T.CylinderGeometry(0.12, 0.1, 1.05, 8).translate(0, -0.52, 0), C.accent, [0, 0, 0], [0, 0, 0], [1, 1, 1], sh);
      const ft = new T.Group(); ft.position.y = -1.05; sh.add(ft); for (const a of [-0.4, 0, 0.4]) m(new T.ConeGeometry(0.07, 0.6, 5), MAT_GUN, [Math.sin(a) * 0.2, -0.05, 0.25], [Math.PI / 2, 0, -a], [1, 1, 1], ft);
      this.legs.push({ th, sh, ft });
    }
    this.yaw = 0; this.speed = 0; this.vy = 0; this.air = false; this.phase = 0; this.flap = 0; this.stamina = 1; this.rider = null; this.home = new V3(); this.wander = new V3(); this.wanderT = 0; this.clawCd = 0; this.respawnT = 0;
  }
  spawnAt(p) { this.pos.set(p.x, groundY(p.x, p.z), p.z); this.home.copy(this.pos); this.wander.copy(this.pos); this.alive = true; this.hp = this.maxHp; this.obj.visible = true; this.obj.rotation.set(0, 0, 0); this.team = 0; this.hitR = false; }
  saddle(out) { return out.set(this.pos.x - Math.sin(this.yaw) * 0.2, this.pos.y + this.body.position.y + 2.95, this.pos.z - Math.cos(this.yaw) * 0.2); }
  mount(s) { if (this.rider || !this.alive) return false; this.rider = s; s.mount = this; this.team = s.team; this.hitR = true; return true; }
  dismount() { const s = this.rider; if (!s) return; s.mount = null; this.rider = null; this.team = 0; this.hitR = false; s.pos.set(this.pos.x + Math.cos(this.yaw) * 2.5, 0, this.pos.z - Math.sin(this.yaw) * 2.5); s.pos.y = groundY(s.pos.x, s.pos.z); }
  killed(src) {
    if (src && src.isPlayer) { PLAYER.kills++; hitMarker(true); awardPoints(300, 'Mount brought down'); }
    killFeed(src && src.kind ? src : null, this, 'downed', src && src.isPlayer);
    this.dismount(); this.deadT = 0; this.respawnT = 45;
  }
  move(dt, thr, steer, flapWant, sprint) {
    const maxS = this.air ? 34 : sprint ? 30 : 22;
    this.speed = clamp(this.speed + thr * (this.air ? 10 : 24) * dt, -6, maxS); this.speed *= 1 - (thr === 0 ? 1.2 : 0.15) * dt;
    this.yaw += steer * (this.air ? 1.0 : 1.9) * dt * Math.min(1, Math.abs(this.speed) / 4 + 0.4);
    if (flapWant && this.stamina > 0.05) { this.vy = Math.max(this.vy, 7.5); this.air = true; this.flap = 1; this.stamina -= dt * 0.35; } else this.stamina = Math.min(1, this.stamina + dt * (this.air ? 0.05 : 0.25));
    let nx = this.pos.x + Math.sin(this.yaw) * this.speed * dt, nz = this.pos.z + Math.cos(this.yaw) * this.speed * dt;
    if (buildingAt(_v1.set(nx, this.pos.y + 1, nz))) { nx = this.pos.x; nz = this.pos.z; this.speed *= -0.3; }
    this.pos.x = clamp(nx, -BOUND, BOUND); this.pos.z = clamp(nz, -BOUND, BOUND);
    const g = groundY(this.pos.x, this.pos.z), ceil = g + (this.rider && this.rider.isPlayer ? 60 : 90);
    if (this.air) { this.vy -= (flapWant ? 6 : 9) * dt; this.vy = Math.max(this.vy, -5.5); this.pos.y += this.vy * dt; if (this.pos.y > ceil) { this.pos.y = ceil; this.vy = Math.min(0, this.vy); } if (this.pos.y <= g) { this.pos.y = g; this.air = false; fxDust(_v1.set(this.pos.x, g, this.pos.z), 4, 2, 4); } }
    else { this.pos.y = lerp(this.pos.y, g, Math.min(1, dt * 14)); if (g < -0.5) { this.air = true; this.vy = 4; } }
    this.vel.set(Math.sin(this.yaw) * this.speed, this.air ? this.vy : 0, Math.cos(this.yaw) * this.speed);
  }
  animate(dt) {
    const sp = Math.abs(this.speed); this.phase += dt * (this.air ? 0 : sp * 0.9);
    const s = Math.sin(this.phase), amp = Math.min(1, sp / 8);
    this.legs[0].th.rotation.x = this.air ? 0.9 : s * 0.9 * amp; this.legs[1].th.rotation.x = this.air ? 0.9 : -s * 0.9 * amp;
    this.legs[0].sh.rotation.x = this.air ? -1.6 : -0.3 - Math.max(0, Math.cos(this.phase)) * 0.9 * amp; this.legs[1].sh.rotation.x = this.air ? -1.6 : -0.3 - Math.max(0, -Math.cos(this.phase)) * 0.9 * amp;
    this.body.position.y = this.air ? 0 : Math.abs(Math.cos(this.phase)) * 0.2 * amp; this.body.rotation.x = this.air ? -this.vy * 0.03 : 0.08 + amp * 0.12;
    this.flap = Math.max(0, this.flap - dt * 1.5);
    for (const W of this.wings) {
      const fold = this.air ? 0 : 1; const beat = this.air ? Math.sin(TIME * (this.flap > 0.2 ? 14 : 3)) * (this.flap > 0.2 ? 0.75 : 0.12) : 0;
      W.w.rotation.z = W.sx * (beat - 0.1) + W.sx * fold * -1.25; W.w.rotation.y = W.sx * fold * 0.9; W.tip.rotation.z = W.sx * (fold * -1.4 + beat * 0.5); W.tip.rotation.y = W.sx * fold * 1.2;
    }
    this.neck.rotation.x = this.air ? 0.4 : -0.1 + Math.sin(this.phase * 2) * 0.05 * amp; this.head.rotation.y = Math.sin(TIME * 0.7 + this.idx) * 0.3 * (1 - amp);
    this.obj.position.copy(this.pos); this.obj.rotation.set(0, this.yaw, this.air ? -this.vel.x * 0 : 0);
  }
  claw() {
    if (this.clawCd > 0) return; this.clawCd = 0.9; this.neck.rotation.x = 0.7;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw); _v1.set(this.pos.x + fx * 3, this.pos.y + 2, this.pos.z + fz * 3);
    for (const e of ENTS) { if (!e.alive || e.team === this.team || e === this || !e.hitR || e.kind === 'capital' || e === this.rider) continue; if (e.surfDist(_v1) < 2.6) { e.damage(e.kind === 'soldier' ? 90 : 160, this.rider || this, 'blade'); fxSparks(_v1, 10, [3, 1.2, 0.5], 8); } }
    snd('stomp', _v1, 0.6);
  }
  update(dt) {
    this.clawCd -= dt;
    if (!this.alive) {
      this.deadT += dt; this.obj.rotation.z = Math.min(1.5, this.deadT * 3); this.pos.y = lerp(this.pos.y, groundY(this.pos.x, this.pos.z), Math.min(1, dt * 4)); this.obj.position.copy(this.pos);
      this.respawnT -= dt; if (this.deadT > 8) this.obj.visible = false; if (this.respawnT <= 0) { const h = [new V3(-255, 0, 375), new V3(-40, 0, -395)][this.idx]; this.spawnAt(h); this.name = BIRD_COL[this.idx].name; }
      return;
    }
    const R = this.rider;
    if (R && (!R.alive || R.remove)) { this.dismount(); }
    if (this.rider && this.rider.isPlayer) { this.animate(dt); return; }
    if (this.rider) {
      const s = this.rider; const tgt = s.target && s.target.alive ? s.target : null;
      const goal = tgt ? tgt.pos : (s.goalCP ? _v1.set(s.goalCP.x, 0, s.goalCP.z) : this.home);
      const want = Math.atan2(goal.x - this.pos.x, goal.z - this.pos.z); const d = Math.hypot(goal.x - this.pos.x, goal.z - this.pos.z);
      _v2.set(this.pos.x + Math.sin(this.yaw) * 8, this.pos.y + 1, this.pos.z + Math.cos(this.yaw) * 8); const blocked = buildingAt(_v2) || H(_v2.x, _v2.z) < -0.5;
      const wantAlt = d > 90 ? groundY(this.pos.x, this.pos.z) + 45 : 0; this.move(dt, d > 6 ? 1 : 0, clamp(angDiff(this.yaw, want) * 2, -1, 1), blocked || (wantAlt && this.pos.y < wantAlt), d > 60);
      if (tgt && tgt.pos.distanceTo(this.pos) < 5) this.claw();
    } else {
      this.flyT = (this.flyT === undefined ? rand(8, 20) : this.flyT) - dt;
      if (this.flyT > 0 && this.flyT < 30 && this.soaring) {
        this.soarA = (this.soarA || 0) + dt * 0.35; const R = 70 + Math.sin(this.soarA * 0.7) * 25;
        _v1.set(this.home.x + Math.cos(this.soarA) * R, 0, this.home.z + Math.sin(this.soarA) * R); const alt = groundY(_v1.x, _v1.z) + 40 + Math.sin(this.soarA * 1.3) * 18;
        this.move(dt, 1, clamp(angDiff(this.yaw, Math.atan2(_v1.x - this.pos.x, _v1.z - this.pos.z)) * 2, -1, 1), this.pos.y < alt, false); this.stamina = 1;
      } else if (this.flyT <= 0 && !this.soaring) { this.soaring = true; this.flyT = rand(18, 30); }
      else {
        if (this.soaring && this.flyT <= 0) { this.soaring = false; this.flyT = rand(15, 35); }
        this.wanderT -= dt; if (this.wanderT <= 0 || this.wander.distanceTo(this.pos) < 3) { this.wanderT = rand(4, 9); this.wander.set(this.home.x + rand(-30, 30), 0, this.home.z + rand(-30, 30)); }
        const want = Math.atan2(this.wander.x - this.pos.x, this.wander.z - this.pos.z); const d = Math.hypot(this.wander.x - this.pos.x, this.wander.z - this.pos.z);
        this.move(dt, d > 4 ? 0.35 : 0, clamp(angDiff(this.yaw, want) * 2, -1, 1), false, false);
      }
      for (const e of ENTS) { if (this.air) break; if (e.kind !== 'soldier' || !e.alive || e.downed || e.isPlayer || e.mount || e.hero) continue; const dd = e.pos.distanceTo(this.pos); if (dd < 9 && Math.random() < dt * 0.6) { this.mount(e); comms(e.name, `Mounted ${this.name}. Riding to the front!`, TEAM[e.team].css); break; } }
    }
    this.animate(dt);
  }
}
const BIRDS = [];

/* ---------------- wild flocks: winged reptiles soaring over the battlefield ---------------- */
const FLOCKS = (() => {
  const bodyG = mergeGeos([xf(new T.SphereGeometry(0.5, 10, 8), [0, 0, 0], [0, 0, 0], [0.7, 0.6, 2.2]), xf(new T.ConeGeometry(0.22, 1.3, 8), [0, 0.05, 1.5], [Math.PI / 2, 0, 0]), xf(new T.ConeGeometry(0.18, 1.6, 6), [0, 0, -1.7], [-Math.PI / 2, 0, 0]), xf(new T.ConeGeometry(0.12, 0.8, 4), [0, 0.35, 1.1], [-0.6, 0, 0])]);
  const wingG = new T.BufferGeometry(); wingG.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0.6, 3.2, 0, -0.2, 0, 0, -0.7, 0, 0, 0.6, 2.2, 0, 0.5, 3.2, 0, -0.2], 3)); wingG.computeVertexNormals();
  const skin = std(0x3a2e2a, 0.7, 0.1), memb = std(0x6a3a2a, 0.8, 0, { side: T.DoubleSide, emissive: 0x200805 });
  const out = [];
  for (let f = 0; f < 4; f++) {
    const fl = { c: new V3(rand(-700, 700), rand(90, 220), rand(-700, 700)), h: rand(0, 6.28), sp: rand(14, 22), turn: rand(-0.15, 0.15), t: 0, m: [] };
    for (let i = 0; i < 6 + (f % 3); i++) {
      const g = new T.Group(); g.add(new T.Mesh(bodyG, skin)); const wl = new T.Mesh(wingG, memb), wr = new T.Mesh(wingG, memb); wr.scale.x = -1; g.add(wl, wr); g.scale.setScalar(rand(1.3, 2.1)); scene.add(g);
      fl.m.push({ g, wl, wr, off: new V3(((i + 1) >> 1) * (i % 2 ? 1 : -1) * 5 + rand(-1.5, 1.5), rand(-3, 3), -((i + 1) >> 1) * 5 + rand(-2, 2)), ph: Math.random() * 6, fr: rand(5, 7) });
    }
    out.push(fl);
  }
  return out;
})();
function updateFlocks(dt) {
  for (const fl of FLOCKS) {
    fl.t += dt; if (Math.random() < dt * 0.1) fl.turn = rand(-0.25, 0.25);
    if (Math.abs(fl.c.x) > 900 || Math.abs(fl.c.z) > 900) fl.turn = angDiff(fl.h, Math.atan2(-fl.c.x, -fl.c.z)) > 0 ? 0.3 : -0.3;
    fl.h += fl.turn * dt; const dive = Math.sin(fl.t * 0.13) > 0.93 ? -12 : 2 * Math.sin(fl.t * 0.3);
    fl.c.x += Math.sin(fl.h) * fl.sp * dt; fl.c.z += Math.cos(fl.h) * fl.sp * dt; fl.c.y = clamp(fl.c.y + dive * dt, groundY(fl.c.x, fl.c.z) + 45, 320);
    const cs = Math.cos(fl.h), sn = Math.sin(fl.h);
    for (const b of fl.m) {
      b.ph += dt * b.fr; const gliding = Math.sin(fl.t * 0.4 + b.off.x) > 0.3; const flap = gliding ? 0.15 : Math.sin(b.ph) * 0.7;
      b.wl.rotation.z = flap; b.wr.rotation.z = -flap;
      _v1.set(fl.c.x + b.off.x * cs + b.off.z * sn, fl.c.y + b.off.y + Math.sin(b.ph * 0.5) * 0.6, fl.c.z - b.off.x * sn + b.off.z * cs);
      b.g.position.lerp(_v1, Math.min(1, dt * 2)); b.g.rotation.set(-dive * 0.02, fl.h, -fl.turn * 1.5, 'YXZ');
    }
  }
}
