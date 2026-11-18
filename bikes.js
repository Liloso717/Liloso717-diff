'use strict';
/* ===================== IRON MERIDIAN · bikes: dirtbike, quad and motorcycles (one, two and three seats) ===================== */
// Fast, light rides parked at HQ and around every post. They use the transport seating, so your squad hops on the back:
// the Talon dirtbike and Vector sportbike seat one, the Nomad tourer seats two, the Trident sidecar rig seats three and the
// Burro quad seats two. Hubless glowing wheels spin with speed, two-wheelers lean hard into turns and everything can jump.
const BIKE_DEF = {
  dirt: { name: 'Talon dirtbike', cap: 1, spd: 1.32, lean: 1.9, r: 0.62, hp: 260 },
  moto1: { name: 'Vector sportbike', cap: 1, spd: 1.48, lean: 1.7, r: 0.5, hp: 240 },
  moto2: { name: 'Nomad tourer', cap: 2, spd: 1.34, lean: 1.5, r: 0.55, hp: 320 },
  moto3: { name: 'Trident sidecar', cap: 3, spd: 1.2, lean: 0.7, r: 0.52, hp: 420 },
  quad: { name: 'Burro quad', cap: 2, spd: 1.22, lean: 0.55, r: 0.48, hp: 460 },
};
const BIKE_MAT = {
  paint: std(0x2a6aa8, 0.38, 0.55, { map: TEX.armor.map, normalMap: TEX.armor.normal }), alt: std(0xd8dcde, 0.4, 0.5, { map: TEX.armor.map }), dark: std(0x1a1c20, 0.5, 0.55, { normalMap: TEX.armor.normal }),
  seat: std(0x2a2522, 0.85, 0.05, { map: TEX.leather.map, normalMap: TEX.leather.normal }), glass: MAT_GLASS, glow: basic(new T.Color(0.6, 1.9, 3.4)), tire: std(0x111214, 0.92, 0.05, { normalMap: TEX.armor.normal }),
};
const BIKE_GEO = {};
function bikeGeo(kind) {
  if (BIKE_GEO[kind]) return BIKE_GEO[kind];
  const D = BIKE_DEF[kind], b = bucket(), y0 = -1.25, R = D.r, wheels = [], seats = [];
  const wheelAt = (x, z, r, w) => { wheels.push({ x, y: y0 + r, z, r, w }); };
  const fork = (z, h) => { for (const sx of [-0.13, 0.13]) b.add('dark', xf(new T.CylinderGeometry(0.045, 0.05, h, 6), [sx, y0 + R + h / 2 - 0.05, z - 0.12], [-0.38, 0, 0])); };
  if (kind === 'quad') {
    for (const [x, z] of [[-0.78, 1.0], [0.78, 1.0], [-0.78, -1.0], [0.78, -1.0]]) wheelAt(x, z, R, 0.36);
    b.add('paint', xf(rbox(1.3, 0.42, 2.3, 0.15, 2), [0, y0 + R + 0.42, 0])); b.add('dark', xf(rbox(1.0, 0.3, 2.6, 0.1, 1), [0, y0 + R + 0.12, 0]));
    for (const z of [1.15, -1.15]) b.add('paint', xf(rbox(1.9, 0.12, 0.7, 0.05, 1), [0, y0 + R * 2 + 0.05, z])); // fenders
    b.add('dark', xf(rbox(1.5, 0.08, 0.5, 0.03, 1), [0, y0 + R + 0.7, 1.45])); b.add('glow', xf(rbox(0.9, 0.08, 0.04, 0.02, 1), [0, y0 + R + 0.55, 1.32]));
    b.add('seat', xf(rbox(0.55, 0.16, 1.3, 0.07, 2), [0, y0 + R + 0.7, -0.35])); b.add('dark', xf(new T.CylinderGeometry(0.03, 0.03, 0.9, 6), [0, y0 + R + 0.95, 0.55], [0, 0, Math.PI / 2]));
    b.add('dark', xf(rbox(1.2, 0.08, 0.55, 0.03, 1), [0, y0 + R + 0.62, -1.4]));
    seats.push(new V3(0, y0 + R + 0.95, 0), new V3(0, y0 + R + 1.0, -0.65));
  } else {
    const wb = kind === 'dirt' ? 1.5 : kind === 'moto1' ? 1.42 : 1.55;
    wheelAt(0, wb, R, kind === 'dirt' ? 0.16 : 0.2); wheelAt(0, -wb, R + (kind === 'dirt' ? 0.04 : 0.02), kind === 'dirt' ? 0.2 : 0.26);
    if (kind === 'dirt') {
      b.add('paint', xf(rbox(0.42, 0.42, 1.4, 0.14, 2), [0, y0 + R + 0.72, 0.15], [0.08, 0, 0])); b.add('alt', xf(rbox(0.5, 0.08, 0.7, 0.04, 1), [0, y0 + R * 2 + 0.22, wb], [-0.2, 0, 0]));
      b.add('alt', xf(rbox(0.32, 0.36, 0.12, 0.05, 1), [0, y0 + R + 1.0, wb - 0.15], [-0.4, 0, 0])); b.add('dark', xf(rbox(0.3, 0.3, 0.9, 0.08, 1), [0, y0 + R + 0.4, -0.2]));
      b.add('seat', xf(rbox(0.3, 0.1, 1.0, 0.05, 2), [0, y0 + R + 0.98, -0.45])); b.add('alt', xf(rbox(0.36, 0.1, 0.8, 0.04, 1), [0, y0 + R + 1.0, -1.15], [0.18, 0, 0]));
      b.add('dark', xf(new T.CylinderGeometry(0.05, 0.05, 1.3, 6), [0.18, y0 + R + 0.25, -0.9], [Math.PI / 2 - 0.25, 0, 0])); b.add('glow', xf(new T.CylinderGeometry(0.06, 0.06, 0.06, 8), [0.18, y0 + R + 0.42, -1.55], [Math.PI / 2, 0, 0]));
      fork(wb, 1.05); b.add('dark', xf(new T.CylinderGeometry(0.03, 0.03, 0.85, 6), [0, y0 + R + 1.18, wb - 0.38], [0, 0, Math.PI / 2]));
      seats.push(new V3(0, y0 + R + 1.25, -0.35));
    } else {
      const low = kind === 'moto1' ? 0.85 : 1;
      b.add('paint', xf(rbox(0.5, 0.48 * low, 1.6, 0.18, 2), [0, y0 + R + 0.55, 0.1])); b.add('dark', xf(rbox(0.38, 0.4, 1.3, 0.12, 1), [0, y0 + R + 0.25, -0.1]));
      b.add('paint', xf(rbox(0.62, 0.55, 0.85, 0.22, 2), [0, y0 + R + 0.72 * low, wb - 0.55], [kind === 'moto1' ? -0.45 : -0.25, 0, 0])); b.add('glass', xf(rbox(0.5, 0.32, 0.06, 0.03, 1), [0, y0 + R + 1.08 * low, wb - 0.35], [-0.6, 0, 0]));
      b.add('glow', xf(rbox(0.3, 0.06, 0.04, 0.02, 1), [0, y0 + R + 0.65 * low, wb - 0.12])); b.add('alt', xf(rbox(0.4, 0.06, 0.6, 0.03, 1), [0, y0 + R * 2 + 0.1, wb]));
      fork(wb, 0.9 * low); b.add('dark', xf(new T.CylinderGeometry(0.03, 0.03, 0.8, 6), [0, y0 + R + 1.0 * low, wb - 0.6], [0, 0, Math.PI / 2]));
      b.add('seat', xf(rbox(0.36, 0.12, kind === 'moto2' || kind === 'moto3' ? 1.3 : 0.75, 0.06, 2), [0, y0 + R + 0.88 * low, kind === 'moto1' ? -0.45 : -0.6]));
      b.add('alt', xf(rbox(0.44, 0.22, 0.7, 0.08, 2), [0, y0 + R + 0.82 * low, -1.25], [0.25, 0, 0])); b.add('glow', xf(rbox(0.32, 0.05, 0.04, 0.02, 1), [0, y0 + R + 0.86 * low, -1.62]));
      for (const sx of [-0.24, 0.24]) b.add('dark', xf(new T.CylinderGeometry(0.06, 0.07, 0.9, 8), [sx, y0 + R + 0.25, -1.1], [Math.PI / 2 - 0.12, 0, 0]));
      seats.push(new V3(0, y0 + R + 1.12 * low, -0.3));
      if (kind === 'moto2' || kind === 'moto3') { seats.push(new V3(0, y0 + R + 1.18, -0.95)); b.add('alt', xf(rbox(0.5, 0.5, 0.1, 0.05, 1), [0, y0 + R + 1.25, -1.35], [-0.15, 0, 0])); }
      if (kind === 'moto3') { // sidecar pod on the right with its own wheel and seat
        wheelAt(1.2, -0.2, R * 0.9, 0.18); b.add('paint', xf(rbox(0.85, 0.55, 1.9, 0.28, 2), [1.15, y0 + R + 0.35, 0.05])); b.add('glass', xf(rbox(0.7, 0.3, 0.06, 0.03, 1), [1.15, y0 + R + 0.78, 0.65], [-0.5, 0, 0]));
        b.add('dark', xf(new T.BoxGeometry(1.0, 0.08, 0.12), [0.62, y0 + R + 0.15, 0.4])); b.add('dark', xf(new T.BoxGeometry(1.0, 0.08, 0.12), [0.62, y0 + R + 0.15, -0.6])); b.add('glow', xf(rbox(0.5, 0.05, 0.04, 0.02, 1), [1.15, y0 + R + 0.25, 1.0]));
        seats.push(new V3(1.15, y0 + R + 0.8, -0.15));
      }
    }
  }
  const geos = bakeGeos(b), wheelG = {};
  for (const w of wheels) { const k = w.r.toFixed(2) + w.w; if (!wheelG[k]) wheelG[k] = { tire: mergeGeos([new T.TorusGeometry(w.r - 0.1, 0.12 + w.w * 0.15, 8, 24).rotateY(Math.PI / 2)]), rim: mergeGeos([new T.TorusGeometry(w.r - 0.22, 0.03, 4, 24).rotateY(Math.PI / 2)]) }; w.g = wheelG[k]; }
  return (BIKE_GEO[kind] = { geos, wheels, seats, len: kind === 'quad' ? 2.8 : 3.4, wid: kind === 'quad' ? 1.9 : kind === 'moto3' ? 2.0 : 0.8, hh: 0.9 });
}
class Bike extends Transport {
  constructor(kind, team) {
    const D = BIKE_DEF[kind]; super(D.cap, team); const G = bikeGeo(kind);
    while (this.body.children.length) this.body.remove(this.body.children[0]);
    for (const k in G.geos) { const m = new T.Mesh(G.geos[k], BIKE_MAT[k]); m.castShadow = k === 'paint' || k === 'dark'; this.body.add(m); }
    this.wheels = G.wheels.map(w => { const g = new T.Group(); g.position.set(w.x, w.y, w.z); g.add(new T.Mesh(w.g.tire, BIKE_MAT.tire)); g.add(new T.Mesh(w.g.rim, BIKE_MAT.glow)); this.body.add(g); return { g, r: w.r }; });
    this.bike = kind; this.name = D.name; this.seats = G.seats; this.len = G.len; this.wid = G.wid; this.hh = G.hh; this.radius = Math.max(G.len, G.wid) * 0.5 + 0.3; this.cull = this.radius + 2;
    this.maxHp = this.hp = D.hp; this.spdMul = this.baseSpd = D.spd; this.leanMul = D.lean; this.camD = 7.5; this.camUp = 2.8; this.bulletMul = 0.4;
  }
  drive(dt, thr, steer, boost) {
    super.drive(dt, thr, steer, boost); const air = this.air;
    for (const w of this.wheels) w.g.rotation.x += this.speed * dt / w.r;
    if (this.bike === 'dirt' && air) this.body.rotation.x = lerp(this.body.rotation.x, -0.25, dt * 3); else this.body.rotation.x = lerp(this.body.rotation.x, thr > 0.9 && boost && this.speed < 30 && this.bike !== 'quad' ? -0.32 : 0, dt * 4); // wheelies off the line
  }
}
function spawnBike(kind, team, p, yaw) { const t = new Bike(kind, team); t.spawnAt(p, yaw); t.speed = 0; return addEnt(t); }
function bikeDepot(bike, x, z, yaw) { _tq.set(x, 0, z); pushOut(_tq, 4); DEPOTS.push({ bike, cap: BIKE_DEF[bike].cap, x: _tq.x, z: _tq.z, yaw, ent: null, t: 99, idle: 0 }); }
// a bike line at HQ, and two bikes at every post (the mix changes post to post)
['dirt', 'moto2'].forEach((k, i) => bikeDepot(k, HQ[1].x + 30 + i * 6, HQ[1].z - 40, Math.PI));
[['moto1', 'rail'], ['quad', 'wilds']].forEach(([k, id]) => { const c = DIST(id); bikeDepot(k, c.x + 26, c.z + 18, Math.PI / 2); });
