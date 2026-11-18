'use strict';
/* ===================== IRON MERIDIAN · cover: big props in the open, trench rims, overwatch towers ===================== */
// Open ground gets clusters of large cover (containers, barriers, sandbag walls, rock outcrops, wrecks, bastions)
// so squads bound from prop to prop. Props are instanced (one draw per kind), collide like buildings and stop bullets.
const COVER = [], COVER_GRID = new Map();
const cgk = (x, z) => Math.floor(x / 40) * 1000 + Math.floor(z / 40);
function coverNear(x, z, r) { const out = []; for (let i = Math.floor((x - r) / 40); i <= Math.floor((x + r) / 40); i++) for (let j = Math.floor((z - r) / 40); j <= Math.floor((z + r) / 40); j++) { const L = COVER_GRID.get(i * 1000 + j); if (L) for (const c of L) if (Math.hypot(c.x - x, c.z - z) < r) out.push(c); } return out; }
const PROPS = (() => {
  const sb = []; for (let r = 0; r < 3; r++) for (let i = 0; i < 6 - r; i++) sb.push(xf(rbox(0.82, 0.4, 1.05, 0.16, 1), [(i - (5 - r) / 2) * 0.8, 0.2 + r * 0.38, 0]));
  const hb = []; for (let i = 0; i < 3; i++) hb.push(xf(new T.CylinderGeometry(0.72, 0.72, 1.5, 10), [(i - 1) * 1.45, 0.75, 0]));
  const jb = []; for (let i = 0; i < 3; i++) { jb.push(xf(new T.BoxGeometry(3.1, 0.5, 0.75), [(i - 1) * 3.2, 0.25, 0])); jb.push(xf(new T.BoxGeometry(3.1, 0.7, 0.32), [(i - 1) * 3.2, 0.85, 0])); }
  const ct = [xf(new T.BoxGeometry(12.2, 2.6, 2.5), [0, 1.3, 0])]; /* shipping container: corrugated long sides, framed doors, corner castings */
  for (let i = 0; i < 22; i++) for (const sz of [-1, 1]) ct.push(xf(new T.BoxGeometry(0.22, 2.3, 0.08), [-5.6 + i * 0.533, 1.3, sz * 1.27]));
  for (const sx of [-1, 1]) { ct.push(xf(new T.BoxGeometry(0.12, 2.6, 2.62), [sx * 6.12, 1.3, 0])); for (const dz of [-0.45, 0.45]) ct.push(xf(new T.BoxGeometry(0.06, 2.3, 0.07), [sx * 6.2, 1.3, dz])); }
  for (const sx of [-1, 1]) for (const sy of [0.12, 2.48]) for (const sz of [-1, 1]) ct.push(xf(new T.BoxGeometry(0.3, 0.26, 0.3), [sx * 6.0, sy, sz * 1.18]));
  const CONT_G = mergeGeos(ct);
  const wk = [xf(rbox(6.5, 1.6, 3.2, 0.3, 2), [0, 0.8, 0]), xf(rbox(3, 1.0, 2.4, 0.3, 2), [-0.5, 2, 0], [0, 0.3, 0.1]), xf(new T.CylinderGeometry(0.15, 0.15, 3.2, 6), [1.6, 2.1, 0.3], [0, 0, 1.3])];
  return {
    container: { geo: CONT_G, mat: std(0xffffff, 0.6, 0.35, { map: TEX.armor.map, normalMap: TEX.armor.normal }), w: 12.2, d: 2.5, h: 2.6, n: 70, cols: [0x8a3a24, 0x2a5a7a, 0x6a6a2a, 0x3a3a3a, 0x9a6a2a] },
    barrier: { geo: mergeGeos(jb), mat: MAT_CONC, w: 9.6, d: 0.75, h: 1.15, n: 90 },
    sandbag: { geo: mergeGeos(sb), mat: std(0x7a6a4a, 0.95, 0), w: 4.8, d: 1.05, h: 1.15, n: 420 },
    rock: { geo: new T.DodecahedronGeometry(1, 1), mat: std(0x5a5550, 0.95, 0, { normalMap: TEX.armor.normal }), w: 6, d: 6, h: 3.5, n: 70 },
    wreck: { geo: mergeGeos(wk), mat: std(0x2a2420, 0.8, 0.5, { map: TEX.armor.map }), w: 6.5, d: 3.2, h: 2.4, n: 40 },
    hesco: { geo: mergeGeos(hb), mat: std(0x8a7a5a, 0.95, 0.05, { normalMap: TEX.armor.normal }), w: 4.4, d: 1.45, h: 1.5, n: 70 },
  };
})();
for (const k in PROPS) { const P = PROPS[k]; P.im = new T.InstancedMesh(P.geo, P.mat, P.n); P.im.count = 0; P.im.castShadow = P.im.receiveShadow = true; P.im.frustumCulled = false; scene.add(P.im); }
function placeProp(kind, x, z, turn, collide = true, sc = 1) {
  const P = PROPS[kind]; if (P.im.count >= P.n) return false;
  const w = (turn ? P.d : P.w) * sc, d = (turn ? P.w : P.d) * sc, gy = Math.min(H(x - w / 2, z - d / 2), H(x + w / 2, z + d / 2), H(x, z));
  _m.compose(_v1.set(x, gy - 0.12, z), _q.setFromAxisAngle(UP, turn ? Math.PI / 2 : 0), kind === 'rock' ? _s.set(3 * sc * rand(0.8, 1.2), 1.8 * sc, 3 * sc * rand(0.8, 1.2)) : _s.set(sc, sc, sc));
  const i = P.im.count++; P.im.setMatrixAt(i, _m); if (P.cols) P.im.setColorAt(i, _c.setHex(pick(P.cols)));
  if (!collide) return true;
  const B = new Building(x, z, w, d, P.h * sc, { mesh: new T.Group(), hp: 1e9 }); B.cover = true; BUILDINGS.push(B);
  const c = { x, z, hw: w / 2, hd: d / 2, r: Math.max(w, d) / 2 }; COVER.push(c); const key = cgk(x, z); if (!COVER_GRID.has(key)) COVER_GRID.set(key, []); COVER_GRID.get(key).push(c);
  return true;
}
const coverFree = (x, z, r) => H(x, z) > 1.4 && riverD(x, z) > 30 && trenchD(x, z) > 10 && Math.abs(H(x + 4, z) - H(x - 4, z)) < 2.5 && Math.abs(H(x, z + 4) - H(x, z - 4)) < 2.5 && !BUILDINGS.some(b => Math.abs(b.x - x) < b.w / 2 + r && Math.abs(b.z - z) < b.d / 2 + r);
(function buildCover() {
  const kinds = ['container', 'container', 'barrier', 'barrier', 'sandbag', 'rock', 'wreck', 'hesco', 'hesco'];
  const cluster = (cx, cz, n, R) => { for (let i = 0, k = 0; i < n * 4 && k < n; i++) { const a = Math.random() * 6.283, r = rand(4, R), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if (coverFree(x, z, 5) && placeProp(pick(kinds), x, z, Math.random() < 0.5)) k++; } };
  for (const c of CPDEF) for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283 + 0.3, r = rand(20, 30); const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r; if (coverFree(x, z, 4)) placeProp(pick(kinds), x, z, Math.abs(Math.sin(a)) > 0.7); }
  for (let i = 0, made = 0; i < 400 && made < 42; i++) {
    const x = rand(-BOUND + 50, BOUND - 50), z = rand(-BOUND + 60, BOUND - 60);
    if (Math.hypot(x, z) < 280 || H(x, z) < 1.5 || [1, 2].some(t => Math.hypot(x - HQ[t].x, z - HQ[t].z) < 90)) continue;
    cluster(x, z, 6 + (Math.random() * 4 | 0), 28); made++;
  }
  // sandbag rims along both lips of every trench (visual; the trench itself is the cover)
  for (const L of TRENCHES) for (let i = 0; i < L.length - 1; i++) {
    const [ax, az] = L[i], [bx, bz] = L[i + 1], len = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / len, nz = (bx - ax) / len, yaw = Math.atan2(bx - ax, bz - az) + Math.PI / 2;
    for (let s = 2; s < len; s += 5) for (const side of [-1, 1]) { const x = ax + (bx - ax) * s / len + nx * side * 6.5, z = az + (bz - az) * s / len + nz * side * 6.5, P = PROPS.sandbag; if (P.im.count >= P.n) break; _m.compose(_v1.set(x, H(x, z) - 0.15, z), _q.setFromAxisAngle(UP, yaw), _s.set(1, 1, 1)); P.im.setMatrixAt(P.im.count++, _m); }
  }
  for (const k in PROPS) { PROPS[k].im.instanceMatrix.needsUpdate = true; if (PROPS[k].im.instanceColor) PROPS[k].im.instanceColor.needsUpdate = true; }
})();
// best cover spot for soldier s against threat t: the far side of a prop, preferring ones that move toward the fight
function pickCover(s, t, around = s.pos, R = 28) {
  let best = null, bs = 1e9; const tx = t.pos.x, tz = t.pos.z, myD = Math.hypot(tx - s.pos.x, tz - s.pos.z), aggr = s.pers ? s.pers.aggr : 0.5;
  for (const c of coverNear(around.x, around.z, R)) {
    const dx = c.x - tx, dz = c.z - tz, dl = Math.hypot(dx, dz) || 1; if (dl < 12) continue;
    const ux = dx / dl, uz = dz / dl, ex = Math.min(c.hw / Math.max(Math.abs(ux), 1e-3), c.hd / Math.max(Math.abs(uz), 1e-3)) + 1.1, px = c.x + ux * ex, pz = c.z + uz * ex;
    const sc = Math.hypot(px - s.pos.x, pz - s.pos.z) - (myD - dl) * aggr * 0.8 + (c.busy > TIME ? 6 : 0);
    if (sc < bs) { bs = sc; best = [px, pz, c]; }
  }
  if (!best) return null; best[2].busy = TIME + 2; return new V3(best[0], 0, best[1]);
}

/* ---------- overwatch towers: long sightlines (a vertical zipline runs up each); marksmen hold them for whoever owns the nearest post ---------- */
const TOWERS = [];
class Tower {
  constructor(x, z) {
    _v1.set(x, 0, z); pushOut(_v1, 6); x = _v1.x; z = _v1.z;
    Object.assign(this, { x, z, name: 'Overwatch tower', mk: null, mt: 10 });
    this.gy = groundY(x, z); this.top = this.gy + 30; this.deck = { x, z, y: this.top, r: 5.2 }; DECKS.push(this.deck); this.pos = new V3(x, this.gy, z);
    const b = bucket(), M = { gun: MAT_GUN, deck: std(0x4a4640, 0.8, 0.4, { normalMap: TEX.armor.normal }), roof: std(0x3a3e44, 0.6, 0.5) };
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add('gun', xf(new T.BoxGeometry(0.5, 30.5, 0.5), [sx * 2.6, 15, sz * 2.6], [sz * 0.03, 0, -sx * 0.03]));
    for (let y = 4; y < 29; y += 6) for (const [px, pz, ry] of [[0, 2.6, 0], [0, -2.6, 0], [2.6, 0, Math.PI / 2], [-2.6, 0, Math.PI / 2]]) b.add('gun', xf(new T.BoxGeometry(5.6, 0.18, 0.18), [px, y, pz], [0, ry, y % 12 ? 0.9 : -0.9]));
    b.add('deck', new T.CylinderGeometry(5.6, 5.6, 0.5, 8).translate(0, this.top - this.gy - 0.25, 0)); b.add('gun', xf(new T.TorusGeometry(5.4, 0.07, 4, 8), [0, 31.1, 0], [Math.PI / 2, Math.PI / 8, 0]));
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; b.add('gun', xf(new T.BoxGeometry(0.12, 1.1, 0.12), [Math.cos(a) * 5.4, 30.55, Math.sin(a) * 5.4])); }
    b.add('roof', new T.ConeGeometry(6.2, 2.4, 8).translate(0, 34.8, 0)); for (const [sx, sz] of [[-1, -1], [1, 1]]) b.add('gun', xf(new T.BoxGeometry(0.15, 3.6, 0.15), [sx * 4.2, 31.8, sz * 4.2]));
    b.add('gun', xf(new T.BoxGeometry(0.7, 30, 0.12), [0, 15, 2.75]));
    const g = new T.Group(); bakeInto(g, b, M); g.position.set(x, this.gy, z); scene.add(g);
    const B = new Building(x, z, 5.4, 5.4, 29, { mesh: new T.Group(), hp: 1e9 }); B.cover = true; BUILDINGS.push(B);
    TOWERS.push(this);
  }
  update(dt) {
    if ((this.mt -= dt) > 0) return; this.mt = 30;
    let cp = CPS[0], bd = 1e9; for (const c of CPS) { const d = Math.hypot(c.x - this.x, c.z - this.z); if (d < bd) { bd = d; cp = c; } }
    if (cp.owner && (!this.mk || !this.mk.alive || this.mk.remove || this.mk.team !== cp.owner) && camera.position.distanceTo(this.pos) < 900) {
      const s = new Soldier(cp.owner); s.squad = { m: [s], lead: null }; s.deck = this.deck; s.noRequeue = true; s.marksman = true; s.spawnAt(this.pos); s.pos.set(this.x, this.top, this.z); addEnt(s); this.mk = s;
    }
  }
}
for (const [x, z] of [[-300, -95], [380, -30], [DIST('rail').x + 60, DIST('rail').z + 50], [DIST('canal').x + 50, DIST('canal').z - 60], [DIST('peaks').x - 60, DIST('peaks').z + 55], [DIST('dam').x - 70, DIST('dam').z - 40], [-120, 330], [110, -330]]) new Tower(x, z);
function updateCover(dt) { for (const t of TOWERS) t.update(dt); }
