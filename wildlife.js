'use strict';
/* ===================== IRON MERIDIAN · giant wildlife =====================
   The island has its own animals, and they are enormous. They belong to neither army.
   · MOOSE (4): six metres at the shoulder, antlers as wide as a truck. They graze and wander. Leave one alone and it
     ignores you; walk right up to it, or shoot it, and it lowers its head and charges.
   · BEARS (4): the size of a tank. They roam, and they go for anything on two legs that comes within about 24 m,
     soldiers of either side and you: a run, a swipe that throws a man, then on to the next. Shot from a distance they
     come looking for whoever did it.
   · GREAT BIRDS (5): eagles with a 16 m wingspan, circling high over the island. Every so often one folds its wings
     and stoops on a soldier in the open (sometimes you), rakes him and climbs away.
   All of them can be killed (they are tough, and a kill scores); a dead one is replaced somewhere else on the island
   a little later. They keep off the water, out of buildings and away from the two headquarters. */
const WILD = { list: [], M: { fur: std(0x5a4030, 0.95, 0), dark: std(0x2e2118, 0.95, 0), bear: std(0x3a2a1e, 0.95, 0), snout: std(0x8a7256, 0.9, 0), antler: std(0xcdbb95, 0.8, 0.05), feather: std(0x4a3a2a, 0.9, 0), white: std(0xd9d4c8, 0.9, 0), beak: std(0xe0a52a, 0.6, 0.1), claw: std(0x1a1a1a, 0.6, 0.3), wing: std(0x4a3a2a, 0.9, 0, { side: T.DoubleSide }) } };
WILD.M.white.side = T.DoubleSide;
function wildSpot(far) { /* open dry ground, away from buildings and headquarters (and, when asked, from you) */
  const pe = PLAYER.ent;
  for (let i = 0; i < 60; i++) { const x = rand(-BOUND + 60, BOUND - 60), z = rand(-BOUND + 60, BOUND - 60), h = H(x, z);
    if (h < 2 || h > 120 || Math.abs(H(x + 4, z) - h) > 1.5 || Math.abs(H(x, z + 4) - h) > 1.5 || buildingAt(_v1.set(x, h + 1, z)) || deckAt(x, z, h + 30)) continue;
    if (Math.hypot(x - HQ[1].x, z - HQ[1].z) < 90 || Math.hypot(x - HQ[2].x, z - HQ[2].z) < 90) continue;
    if (far && pe && Math.hypot(x - pe.pos.x, z - pe.pos.z) < 160) continue;
    return new V3(x, h, z); }
  return new V3(0, groundY(0, -380), -380);
}
class Wild extends Ent {
  constructor(sp) {
    super('wild', 0); this.sp = sp; const M = WILD.M, g = new T.Group(), body = new T.Group(); g.add(body); this.obj = g; this.body = body; this.legs = []; this.wings = [];
    /* modelled from rounded forms, not boxes: ellipsoids for muscle and skull, tapered cylinders for limbs and necks, cones for tines, ears and beaks, cut feather shapes for wings */
    const ell = (rx, ry, rz, x, y, z, tilt) => { const q = new T.SphereGeometry(1, 14, 10).scale(rx, ry, rz); if (tilt) q.rotateX(tilt); return q.translate(x, y, z); };
    const cyl = (rt, rb, h, x, y, z, rx, rz) => { const q = new T.CylinderGeometry(rt, rb, h, 10); if (rx) q.rotateX(rx); if (rz) q.rotateZ(rz); return q.translate(x, y, z); };
    const cone = (r, h, x, y, z, rx, rz) => { const q = new T.ConeGeometry(r, h, 8); if (rx) q.rotateX(rx); if (rz) q.rotateZ(rz); return q.translate(x, y, z); };
    const mesh = (list, mat, par) => { const o = new T.Mesh(mergeGeos(list), mat); o.castShadow = true; (par || body).add(o); return o; };
    const leg = (x, y, z, parts, mat) => { const p = new T.Group(); p.position.set(x, y, z); mesh(parts, mat, p); body.add(p); this.legs.push(p); };
    if (sp === 'moose') { this.name = 'Giant moose'; this.maxHp = this.hp = 900; this.radius = 3.2; this.aimOff = 5; this.spd = 4; this.run = 13; this.reach = 5.5; this.hit = 55;
      mesh([ell(1.45, 1.55, 3.1, 0, 5.4, 0), ell(1.3, 1.45, 1.5, 0, 6.45, 1.7), ell(1.3, 1.4, 1.5, 0, 5.5, -2.1), cyl(0.7, 1.05, 2.9, 0, 6.9, 3.1, 0.75), ell(0.3, 0.75, 0.38, 0, 5.7, 3.5), cone(0.16, 0.7, 0, 5.6, -3.3, 2.6)], M.fur);
      const head = new T.Group(); head.position.set(0, 7.9, 4.1); body.add(head); this.head = head;
      mesh([ell(0.6, 0.62, 1.15, 0, 0, 0.6), cone(0.2, 0.75, -0.62, 0.72, -0.1, -0.3, 0.7), cone(0.2, 0.75, 0.62, 0.72, -0.1, -0.3, -0.7)], M.fur, head);
      mesh([ell(0.58, 0.5, 0.85, 0, -0.28, 1.75, 0.2), ell(0.5, 0.3, 0.3, 0, -0.5, 2.4)], M.snout, head); mesh([ell(0.09, 0.09, 0.09, -0.5, 0.2, 1.0), ell(0.09, 0.09, 0.09, 0.5, 0.2, 1.0)], M.claw, head);
      const ant = []; for (const e of [-1, 1]) { ant.push(cyl(0.13, 0.19, 1.7, e * 1.05, 1.05, 0, 0, -e * 1.0)); ant.push(new T.SphereGeometry(1, 12, 6).scale(1.25, 0.11, 0.8).rotateZ(e * 0.35).translate(e * 2.5, 1.75, 0.1));
        for (let k = 0; k < 6; k++) { const a = -0.9 + k * 0.42; ant.push(cone(0.1, 0.95, e * (2.5 + Math.cos(a) * 1.15), 2.25 + Math.cos(a) * 0.35, 0.1 + Math.sin(a) * 0.8, Math.sin(a) * 0.5, -e * (0.25 + Math.cos(a) * 0.3))); } }
      mesh(ant, M.antler, head);
      for (const [x, z] of [[-0.9, 2.3], [0.9, 2.3], [-0.9, -2.3], [0.9, -2.3]]) leg(x, 4.4, z, [cyl(0.5, 0.3, 2.3, 0, -1.1, 0), ell(0.3, 0.3, 0.3, 0, -2.25, 0), cyl(0.24, 0.19, 1.9, 0, -3.2, 0), cyl(0.2, 0.3, 0.32, 0, -4.24, 0.04)], M.dark);
    } else if (sp === 'bear') { this.name = 'Giant bear'; this.maxHp = this.hp = 1400; this.radius = 3.4; this.aimOff = 3.2; this.spd = 3.4; this.run = 11; this.reach = 5; this.hit = 70; this.mean = true;
      mesh([ell(1.9, 1.65, 3.2, 0, 3.6, 0), ell(1.75, 1.6, 1.7, 0, 4.15, 1.9), ell(1.8, 1.55, 1.6, 0, 3.5, -2.2), cyl(1.0, 1.3, 1.6, 0, 4.4, 3.2, 1.0), ell(0.3, 0.3, 0.3, 0, 3.9, -3.7)], M.bear);
      const head = new T.Group(); head.position.set(0, 4.6, 4.1); body.add(head); this.head = head;
      mesh([ell(1.1, 1.0, 1.1, 0, 0, 0), ell(0.34, 0.34, 0.16, -0.78, 0.82, -0.2), ell(0.34, 0.34, 0.16, 0.78, 0.82, -0.2)], M.bear, head); mesh([ell(0.58, 0.48, 0.8, 0, -0.3, 1.0)], M.snout, head);
      mesh([ell(0.24, 0.18, 0.18, 0, -0.16, 1.78), ell(0.1, 0.1, 0.1, -0.45, 0.25, 0.92), ell(0.1, 0.1, 0.1, 0.45, 0.25, 0.92)], M.claw, head);
      for (const [x, z] of [[-1.25, 2.2], [1.25, 2.2], [-1.25, -2.3], [1.25, -2.3]]) { leg(x, 2.7, z, [cyl(0.8, 0.62, 1.6, 0, -0.8, 0), cyl(0.6, 0.52, 1.0, 0, -1.9, 0), ell(0.62, 0.3, 0.85, 0, -2.42, 0.22)], M.bear);
        mesh([-0.32, 0, 0.32].map(c => cone(0.09, 0.45, c, -2.55, 1.05, 1.5)), M.claw, this.legs[this.legs.length - 1]); }
    } else { this.name = 'Great eagle'; this.maxHp = this.hp = 500; this.radius = 3; this.aimOff = 0; this.fly = true; this.hit = 40; this.alt = rand(45, 75); this.orb = rand(60, 130); this.ang = rand(0, 6.28); this.dirn = Math.random() < 0.5 ? 1 : -1; this.stoopT = rand(14, 34);
      const flat = pts => { const P = []; for (const t of pts) for (const v of t) P.push(v[0], v[1], v[2]); const q = new T.BufferGeometry(); q.setAttribute('position', new T.Float32BufferAttribute(P, 3)); q.computeVertexNormals(); return q; };
      const wing = e => { const tr = [], n = 12, L = [], Tr = []; /* a real planform: swept leading edge, scalloped trailing edge, an arch across the span, five primaries splayed at the tip */
        for (let k = 0; k <= n; k++) { const t = k / n, x = e * (0.3 + t * 7.4), y = Math.sin(t * 2.6) * 0.45 - t * t * 0.3, lz = 1.3 - t * t * 1.5, ch = 3.0 * (1 - t * 0.5); L.push([x, y, lz]); Tr.push([x, y - 0.05, lz - ch - (k & 1 ? 0.4 : 0)]); }
        for (let k = 0; k < n; k++) { tr.push([L[k], Tr[k], L[k + 1]], [L[k + 1], Tr[k], Tr[k + 1]]); }
        for (let f = 0; f < 5; f++) { const z0 = L[n][2] - f * 0.32, tipx = e * (7.7 + 2.2 - f * 0.25), tipz = z0 + 0.5 - f * 0.55; tr.push([[L[n][0], L[n][1], z0], [L[n][0], L[n][1], z0 - 0.3], [tipx, L[n][1] + 0.25 - f * 0.05, tipz]]); }
        return flat(tr); };
      const tail = []; for (let f = 0; f < 7; f++) { const a = -0.6 + f * 0.2, a2 = a + 0.2; tail.push([[0, 0.05, -1.8], [Math.sin(a) * 2.4, 0, -1.8 - Math.cos(a) * 2.6], [Math.sin(a2) * 2.2, 0, -1.8 - Math.cos(a2) * 2.3]]); }
      mesh([ell(0.85, 0.75, 2.3, 0, 0, 0), ell(0.75, 0.65, 0.9, 0, 0.15, 1.5)], M.feather); mesh([ell(0.52, 0.52, 0.62, 0, 0.5, 2.5), cyl(0.5, 0.7, 0.8, 0, 0.3, 2.0, 1.2), flat(tail)], M.white);
      mesh([cone(0.22, 0.75, 0, 0.42, 3.25, 1.75), cone(0.1, 0.3, 0, 0.2, 3.55, 2.7), cyl(0.1, 0.08, 0.9, -0.4, -0.9, 0.3), cyl(0.1, 0.08, 0.9, 0.4, -0.9, 0.3), ...[-0.4, 0.4].flatMap(c => [-0.15, 0, 0.15].map(o => cone(0.06, 0.4, c + o, -1.4, 0.5, 2.2)))], M.beak);
      mesh([ell(0.07, 0.07, 0.07, -0.36, 0.62, 2.85), ell(0.07, 0.07, 0.07, 0.36, 0.62, 2.85)], M.claw);
      for (const e of [-1, 1]) { const w = new T.Group(); w.position.set(e * 0.5, 0.45, 0.4); mesh([wing(e)], M.wing, w); body.add(w); this.wings.push(w); }
    }
    this.yaw = rand(0, 6.28); this.goal = new V3(); this.state = 'roam'; this.t = rand(0, 4); this.cd = 0; this.gait = rand(0, 6); this.prey = null; this.ctr = new V3(); this.deadT = 0; this.bulletMul = 0.6; this.cull = 9;
    this.place(false);
  }
  place(far) { const p = wildSpot(far); this.pos.copy(p); this.ctr.copy(p); if (this.fly) this.pos.y = p.y + this.alt; this.goal.copy(p); this.obj.position.copy(this.pos); this.obj.rotation.set(0, this.yaw, 0); this.obj.visible = true; this.state = 'roam'; this.prey = null; }
  damage(a, src, type) { super.damage(a, src, type); if (this.alive && src && src.alive && src.pos && src !== this && !this.fly) { this.prey = src; this.state = 'charge'; this.t = 9; } }
  killed(src) { if (src && src.isPlayer) { PLAYER.kills++; awardPoints(this.sp === 'eagle' ? 300 : 500, this.name + ' brought down'); hitMarker(true); } this.deadT = 0; snd('big', this.pos, 0.6); }
  strike(e) { /* antlers, a paw, or talons */
    this.cd = this.fly ? 2 : 1.3; e.damage(e.kind === 'soldier' ? this.hit : this.hit * 2.5, this, 'ram'); snd('stomp', this.pos, 0.8); fxDust(e.pos, 5, 2, 3);
    if (e.kind === 'soldier' && e.alive && !e.mount) { const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z, l = Math.hypot(dx, dz) || 1; e.pos.x += dx / l * 3; e.pos.z += dz / l * 3; if (e.isPlayer) { PLAYER.vy = Math.max(PLAYER.vy, 7); PLAYER.grounded = false; shake(0.4, e.pos); } }
    if (this.head) this.head.rotation.x = -0.6;
  }
  update(dt) {
    if (!this.alive) { this.deadT += dt; this.obj.rotation.z = Math.min(1.5, this.deadT * 2.5); this.pos.y = lerp(this.pos.y, groundY(this.pos.x, this.pos.z), Math.min(1, dt * 3)); this.obj.position.copy(this.pos);
      if (this.deadT > 10) this.obj.visible = false; if (this.deadT > 45) { this.alive = true; this.hp = this.maxHp; this.deadT = 0; this.place(true); } return; }
    this.cd -= dt; this.t -= dt; if (this.head) this.head.rotation.x += (0 - this.head.rotation.x) * Math.min(1, dt * 4);
    if (this.fly) return this.updFly(dt);
    let sp = this.spd;
    if (this.state === 'roam') {
      if (this.t <= 0 || Math.hypot(this.goal.x - this.pos.x, this.goal.z - this.pos.z) < 5) { this.t = rand(8, 18); if (Math.random() < 0.35) { this.state = 'graze'; this.t = rand(4, 9); } else { const a = rand(0, 6.28), r = rand(30, 110); this.goal.set(clamp(this.ctr.x + Math.cos(a) * r, -BOUND + 40, BOUND - 40), 0, clamp(this.ctr.z + Math.sin(a) * r, -BOUND + 40, BOUND - 40)); } }
      if ((this.scan = (this.scan || 0) - dt) <= 0) { this.scan = 0.6; const R = this.mean ? 24 : 7.5; let best = null, bd = R; /* who is too close */
        for (const e of ENTS) { if (!e.alive || e.kind !== 'soldier' || e.downed || e.mount || Math.abs(e.pos.y - this.pos.y) > 6) continue; const d = e.pos.distanceTo(this.pos); if (d < bd) { bd = d; best = e; } }
        if (best) { this.prey = best; this.state = 'charge'; this.t = this.mean ? 8 : 5; if (best.isPlayer) comms(null, `${this.name} is coming for you!`, 'r'); } }
    } else if (this.state === 'graze') { sp = 0; if (this.head) this.head.rotation.x = 0.55 + Math.sin(TIME * 3) * 0.06; if (this.t <= 0) { this.state = 'roam'; this.t = 0; } }
    else if (this.state === 'charge') { const e = this.prey; sp = this.run;
      if (!e || !e.alive || e.downed || this.t <= 0 || e.pos.distanceTo(this.pos) > 150) { this.state = 'roam'; this.prey = null; this.t = 0; this.ctr.copy(this.pos); }
      else { this.goal.copy(e.pos); if (this.cd <= 0 && e.pos.distanceTo(this.pos) < this.reach) { this.strike(e); if (!this.mean) { this.state = 'roam'; this.t = 0; } } } }
    const dx = this.goal.x - this.pos.x, dz = this.goal.z - this.pos.z, d = Math.hypot(dx, dz);
    if (sp > 0 && d > 2) { this.yaw = angLerp(this.yaw, Math.atan2(dx, dz), Math.min(1, dt * 2.6)); const nx = this.pos.x + Math.sin(this.yaw) * sp * dt, nz = this.pos.z + Math.cos(this.yaw) * sp * dt, nh = H(nx, nz);
      if (nh < 0.9 || Math.abs(nh - this.pos.y) > 2.2) { this.state = 'roam'; this.t = 0; this.yaw += 1.2; this.goal.copy(this.ctr); } /* water or a cliff: turn round */
      else { this.pos.x = nx; this.pos.z = nz; pushOut(this.pos, this.radius); this.pos.y = lerp(this.pos.y, groundY(this.pos.x, this.pos.z), Math.min(1, dt * 8)); this.gait += dt * sp * 0.55; } }
    else sp = 0;
    this.obj.position.copy(this.pos); this.obj.rotation.y = this.yaw;
    const sw = sp > 0 ? Math.sin(this.gait) * (sp > 6 ? 0.75 : 0.45) : 0; this.legs[0].rotation.x = sw; this.legs[3].rotation.x = sw; this.legs[1].rotation.x = -sw; this.legs[2].rotation.x = -sw; this.body.position.y = sp > 0 ? Math.abs(Math.sin(this.gait * 2)) * 0.12 : 0;
  }
  updFly(dt) {
    const flap = Math.sin(TIME * (this.state === 'stoop' ? 1 : 2.6) + this.gait) * (this.state === 'roam' ? 0.32 : 0.12); this.wings[0].rotation.z = -flap - (this.state === 'stoop' ? 0.9 : 0); this.wings[1].rotation.z = flap + (this.state === 'stoop' ? 0.9 : 0);
    let tx, ty, tz, sp = 17;
    if (this.state === 'roam') { this.ang += this.dirn * dt * sp / this.orb; tx = this.ctr.x + Math.cos(this.ang) * this.orb; tz = this.ctr.z + Math.sin(this.ang) * this.orb; ty = Math.max(groundY(tx, tz), 0) + this.alt;
      if ((this.stoopT -= dt) <= 0) { this.stoopT = rand(18, 40); let best = null, bd = 150; for (const e of ENTS) { if (!e.alive || e.kind !== 'soldier' || e.downed || e.mount || e.pos.y > 300 || (e.isPlayer && Math.random() < 0.5)) continue; const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z); if (d < bd && !roofOver(e.pos)) { bd = d; best = e; } }
        if (best) { this.prey = best; this.state = 'stoop'; this.t = 9; snd('laser', this.pos, 0.3); if (best.isPlayer) comms(null, 'Great eagle stooping on you. Move!', 'r'); } else if (Math.random() < 0.4) this.ctr.copy(wildSpot(false)); }
    } else if (this.state === 'stoop') { const e = this.prey; sp = 38;
      if (!e || !e.alive || this.t <= 0) { this.state = 'climb'; this.t = 5; } else { tx = e.pos.x; ty = e.pos.y + 1.5; tz = e.pos.z; if (this.cd <= 0 && this.pos.distanceTo(e.pos) < 4.5) { this.strike(e); this.state = 'climb'; this.t = 5; } }
    }
    if (this.state === 'climb') { sp = 22; tx = this.pos.x + Math.sin(this.yaw) * 40; tz = this.pos.z + Math.cos(this.yaw) * 40; ty = this.pos.y + 30; if (this.t <= 0) { this.state = 'roam'; this.ctr.set(this.pos.x, 0, this.pos.z); this.ang = Math.atan2(0, 1); this.orb = rand(60, 130); this.ang = rand(0, 6.28); } }
    const dx = tx - this.pos.x, dy = ty - this.pos.y, dz = tz - this.pos.z, d = Math.hypot(dx, dy, dz) || 1, st = Math.min(d, sp * dt);
    this.pos.x += dx / d * st; this.pos.y += dy / d * st; this.pos.z += dz / d * st; const fl = Math.max(groundY(this.pos.x, this.pos.z), 0) + 2.5; if (this.pos.y < fl) this.pos.y = fl;
    if (Math.hypot(dx, dz) > 0.5) this.yaw = angLerp(this.yaw, Math.atan2(dx, dz), Math.min(1, dt * 3));
    this.obj.position.copy(this.pos); this.obj.rotation.set(clamp(-dy / d, -0.9, 0.9), this.yaw, this.state === 'roam' ? -this.dirn * 0.35 : 0, 'YXZ');
  }
}
function roofOver(p) { return !!buildingAt(_v2.set(p.x, p.y + 6, p.z)) || !!deckAt(p.x, p.z, p.y + 40) && deckAt(p.x, p.z, p.y + 40).y > p.y + 3; }
{
  const make = () => { for (const e of WILD.list) e.remove = true; WILD.list.length = 0; for (const [sp, n] of [['moose', 4], ['bear', 4], ['eagle', 5]]) for (let i = 0; i < n; i++) WILD.list.push(addEnt(new Wild(sp))); };
  make();
  const _nw = newWar; newWar = function () { _nw.apply(this, arguments); make(); };
}
