'use strict';
/* ===================== IRON MERIDIAN · the Hive: a spiral road inside downtown's mesa =====================
   Two openings. LOW: a tunnel portal at the foot of the east cliff, joined to the island road by a short spur.
   HIGH: the top of a round shaft on the mesa's east rim, bridged straight onto the Orbital Highway ring.
   Between them a ramp winds round a central column, twelve and a half turns, floor to top, lit as it climbs.
   Walkable all the way (one deck per segment), with traffic running both ways. Kept light: one mesh for the ramp,
   one for the shaft wall, one for the tunnel. */
(function hive() {
  const Hv = HIVE, P = new V3(Hv.x, 0, Hv.z), top = MESA.top, f = Hv.floor, TH = Hv.turns * Math.PI * 2;
  const M = { rock: std(0x5a4636, 0.95, 0.05, { normalMap: TEX.armor.normal }), conc: std(0x6c6e70, 0.85, 0.1), steel: std(0x2c3034, 0.5, 0.75),
    lit: basic(new T.Color(3.2, 2.4, 1.1)), haz: std(0xd8a01a, 0.6, 0.2), sign: basic(new T.Color(3, 1.6, 0.4)),
    road: new T.MeshStandardMaterial({ map: roadTex, roughness: 0.85, metalness: 0.05, side: T.DoubleSide }) };
  const G = new T.Group(); G.name = 'hive'; scene.add(G);
  const yAt = th => f + 0.3 + (top - f - 0.3) * th / TH, pAt = (th, r) => [P.x + Math.cos(th) * r, P.z + Math.sin(th) * r];
  /* the ramp: a ribbon with a curb on the outside edge */
  { const n = Math.ceil(Hv.turns * 40), pos = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) { const th = i / n * TH, y = yAt(th) + 0.1;
      for (const r of [Hv.Rh - Hv.hw, Hv.Rh + Hv.hw]) { const [x, z] = pAt(th, r); pos.push(x, y, z); uv.push(r < Hv.Rh ? 0 : 1, th * Hv.Rh / 24); }
      if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new T.Mesh(g, M.road); m.receiveShadow = true; G.add(m);
    /* the slab under it and the curb, one merged mesh */
    const b = bucket(), seg = Math.ceil(Hv.turns * 20);
    for (let i = 0; i < seg; i++) { const th = (i + 0.5) / seg * TH, y = yAt(th), dth = TH / seg, len = (Hv.Rh + Hv.hw) * dth + 0.4, [x, z] = pAt(th, Hv.Rh), [cx, cz] = pAt(th, Hv.Rh + Hv.hw - 0.2), rot = -th, tilt = Math.atan((top - f) / TH / Hv.Rh);
      const q = new T.Quaternion().setFromEuler(new T.Euler(-tilt, rot, 0, 'YXZ'));
      b.add('conc', xfq(new T.BoxGeometry(Hv.hw * 2, 0.8, len), new V3(x, y - 0.95, z), q)); /* kept under the road surface so its straight ends never poke through */
      b.add('steel', xfq(new T.BoxGeometry(0.4, 1.1, len), new V3(cx, y + 0.55, cz), q)); }
    const gg = new T.Group(); bakeInto(gg, b, M, ['conc']); G.add(gg); }
  /* walking it: one deck per segment, ten a turn, and a bridge at the top onto the ring */
  { const per = 10, n = Math.round(Hv.turns * per);
    for (let i = 0; i < n; i++) { const a = i / n * TH, c = (i + 1) / n * TH, [x, z] = pAt(a, Hv.Rh), [x2, z2] = pAt(c, Hv.Rh); DECKS.push({ x, z, x2, z2, y: yAt((a + c) / 2), r: Hv.hw, hive: true }); }
    const [ex, ez] = pAt(TH, Hv.Rh); DECKS.push({ x: ex, z: ez, x2: P.x - Hv.R - 6, z2: P.z, y: top, r: Hv.hw }); }
  /* the shaft wall: rock from the floor to the cliff as it stands, colliders round it, the column in the middle */
  { const N = 48, pos = [], idx = [], R = Hv.R + 0.4;
    for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2, x = P.x + Math.cos(a) * R, z = P.z + Math.sin(a) * R, t = Math.max(f + 4, rawH(x, z, true)); pos.push(x, f - 1, z, x, t, z); if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new T.Mesh(g, new T.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.95, metalness: 0.05, normalMap: TEX.armor.normal, side: T.DoubleSide })); m.receiveShadow = true; G.add(m);
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.3) continue; /* the gap for the tunnel */
      const x = P.x + Math.cos(a) * (Hv.R + 2.6), z = P.z + Math.sin(a) * (Hv.R + 2.6), t = rawH(x, z, true); if (t < f + 3) continue;
      const W = new Building(x, z, 6.6, 6.6, t - f + 1, { mesh: new T.Group(), hp: 1e9 }); W.cover = true; W.gy = f - 1; W.top = Math.min(t, top - 0.5); BUILDINGS.push(W); }
    /* the rim: a stone collar over the rough edge of the cut, walkable */
    const rim = new T.Mesh(new T.RingGeometry(Hv.R + 0.2, Hv.R + 15, 48, 1).rotateX(-Math.PI / 2).translate(P.x, top + 0.06, P.z), M.conc); rim.receiveShadow = true; G.add(rim);
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; DECKS.push({ x: P.x + Math.cos(a) * (Hv.R + 8), z: P.z + Math.sin(a) * (Hv.R + 8), y: top, r: 7.5 }); }
    const col = new T.Mesh(new T.CylinderGeometry(Hv.Rh - Hv.hw - 2.5, Hv.Rh - Hv.hw - 1.5, top - f + 6, 20).translate(P.x, (top + f) / 2 + 3, P.z), M.conc); col.castShadow = true; col.receiveShadow = true; G.add(col);
    const C = new Building(P.x, P.z, 12, 12, top - f + 6, { mesh: new T.Group(), hp: 1e9 }); C.cover = true; C.gy = f - 1; C.top = top + 6; BUILDINGS.push(C);
    /* lamps up the column, a ring of light at the top, and the name */
    const b = bucket(); for (let k = 0; k < Hv.turns; k += 1) { const y = yAt(k * Math.PI * 2) + 5; for (let j = 0; j < 4; j++) { const a = j * Math.PI / 2 + k; b.add('lit', xf(new T.BoxGeometry(0.4, 0.4, 2.4), [P.x + Math.cos(a) * (Hv.Rh - Hv.hw - 1.4), y, P.z + Math.sin(a) * (Hv.Rh - Hv.hw - 1.4)], [0, -a, 0])); } }
    b.add('lit', new T.TorusGeometry(Hv.Rh - Hv.hw - 1.4, 0.25, 6, 40).rotateX(Math.PI / 2).translate(P.x, top + 6, P.z));
    const gg = new T.Group(); bakeInto(gg, b, M, []); G.add(gg);
    for (const y of [f + 14, (f + top) / 2, top - 20]) addLight(P.x, y, P.z, 3.2, 2.4, 1.2, 22);
    const sign = new T.Mesh(new T.PlaneGeometry(14, 2.6), new T.MeshBasicMaterial({ side: T.DoubleSide, map: canvasTex(256, 46, (c, w, h) => { c.fillStyle = '#1a0e04'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd08a'; c.font = '800 28px sans-serif'; c.textAlign = 'center'; c.fillText('THE HIVE', w / 2, 33); }) }));
    sign.position.set(P.x - Hv.R - 2, top + 6, P.z); sign.rotation.y = -Math.PI / 2; G.add(sign);
    for (const s of [-1, 1]) { const pz = P.z + s * (Hv.hw + 1.2), px = P.x - Hv.R - 2; G.add(new T.Mesh(new T.CylinderGeometry(0.3, 0.4, 7, 6).translate(px, top + 3.5, pz), M.steel)); } }
  /* the low tunnel: out east through the cliff, a rock roof over it, a lit portal */
  { const z0 = P.z - Hv.tw, z1 = P.z + Hv.tw, xa = P.x + Hv.R - 2; let xb = xa; for (let x = xa; x < Hv.tx1; x += 2) { if (rawH(x, P.z, true) < Hv.ceil + 3) break; xb = x; } xb += 2;
    const NX = Math.max(2, Math.round((xb - xa) / 4)), NZ = 3, pos = [], idx = [], v = (x, y, z) => (pos.push(x, y, z), pos.length / 3 - 1), quad = (a, b2, c, d) => idx.push(a, b2, c, a, c, d), T0 = [];
    const topY = (x, z) => Math.max(Hv.ceil + 3, rawH(x, z, true));
    for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const x = xa + (xb - xa) * i / NX, z = z0 + (z1 - z0) * j / NZ; T0.push(v(x, topY(x, z), z)); }
    const t = (i, j) => T0[j * (NX + 1) + i];
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) quad(t(i, j), t(i, j + 1), t(i + 1, j + 1), t(i + 1, j));
    for (let j = 0; j < NZ; j++) { const z = z0 + (z1 - z0) * j / NZ, z2 = z0 + (z1 - z0) * (j + 1) / NZ; quad(v(xb, Hv.ceil, z), v(xb, Hv.ceil, z2), t(NX, j + 1), t(NX, j)); } /* the face over the portal */
    for (const [jj, zz] of [[0, z0], [NZ, z1]]) for (let i = 0; i < NX; i++) { const x = xa + (xb - xa) * i / NX, x2 = xa + (xb - xa) * (i + 1) / NX; quad(v(x, f - 1, zz), v(x2, f - 1, zz), t(i + 1, jj), t(i, jj)); } /* the side walls */
    quad(v(xa, Hv.ceil, z0), v(xb, Hv.ceil, z0), v(xb, Hv.ceil, z1), v(xa, Hv.ceil, z1)); /* the ceiling */
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new T.Mesh(g, new T.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.95, metalness: 0.05, normalMap: TEX.armor.normal, side: T.DoubleSide })); m.castShadow = true; m.receiveShadow = true; G.add(m);
    let mt = Hv.ceil + 3; for (let x = xa; x <= xb; x += 2) mt = Math.max(mt, topY(x, P.z));
    const R0 = new Building((xa + xb) / 2, P.z, xb - xa, z1 - z0, mt - Hv.ceil, { mesh: new T.Group(), hp: 1e9 }); R0.cover = true; R0.gy = Hv.ceil; R0.top = mt; BUILDINGS.push(R0);
    for (const zz of [z0 - 0.6, z1 + 0.6]) { const Wl = new Building((xa + Hv.tx1) / 2, zz, Hv.tx1 - xa, 1.2, Hv.ceil - f + 2, { mesh: new T.Group(), hp: 1e9 }); Wl.cover = true; Wl.gy = f - 1; Wl.top = Hv.ceil + 1; BUILDINGS.push(Wl); }
    const b = bucket(), h = Hv.ceil - f;
    for (const s of [-1, 1]) { b.add('conc', new T.BoxGeometry(xb - xa, h, 0.6).translate((xa + xb) / 2, f + h / 2, P.z + s * (Hv.tw - 0.3))); b.add('steel', new T.BoxGeometry(2.4, h + 2, 2.4).translate(xb + 0.5, f + h / 2, P.z + s * (Hv.tw + 0.6))); }
    b.add('steel', new T.BoxGeometry(2.4, 2.4, Hv.tw * 2 + 4).translate(xb + 0.5, Hv.ceil + 0.6, P.z));
    for (let x = xa + 3; x < xb; x += 8) b.add('lit', new T.BoxGeometry(1.4, 0.25, 8).translate(x, Hv.ceil - 0.3, P.z));
    for (let i = 0; i < 8; i++) b.add(i % 2 ? 'steel' : 'haz', new T.BoxGeometry(0.4, 1.2, (Hv.tw * 2) / 8).translate(xb + 1.9, Hv.ceil - 1.2, P.z - Hv.tw + (Hv.tw * 2) / 8 * (i + 0.5)));
    const gg = new T.Group(); bakeInto(gg, b, M, ['steel']); G.add(gg);
    const sign = new T.Mesh(new T.PlaneGeometry(10, 2), new T.MeshBasicMaterial({ side: T.DoubleSide, map: canvasTex(256, 52, (c, w, hh) => { c.fillStyle = '#1a0e04'; c.fillRect(0, 0, w, hh); c.fillStyle = '#ffd08a'; c.font = '800 30px sans-serif'; c.textAlign = 'center'; c.fillText('THE HIVE', w / 2, 37); }) }));
    sign.position.set(xb + 2.2, Hv.ceil + 2.6, P.z); sign.rotation.y = Math.PI / 2; G.add(sign);
    addLight(xb + 6, Hv.ceil, P.z, 3.2, 2.4, 1.2, 12); addLight((xa + xb) / 2, Hv.ceil - 3, P.z, 3, 2.2, 1.1, 12);
    HIVE.portal = new V3(xb, f, P.z); }
  /* the roads: tunnel floor out to the island road, the bridge onto the ring */
  const lowPts = [new V3(330, 0, 62), new V3(300, 0, 52), new V3(Hv.tx1 - 10, 0, P.z + 2), new V3(P.x + Hv.R, 0, P.z), new V3(P.x + Hv.Rh, 0, P.z)];
  const ribbon = (pts, yf) => { const pos = [], uv = [], idx = []; let L = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)], dx = c.x - a.x, dz = c.z - a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l; if (i) L += pts[i].distanceTo(pts[i - 1]);
      for (const s of [-1, 1]) { const x = pts[i].x + nx * 4 * s, z = pts[i].z + nz * 4 * s; pos.push(x, yf(pts[i].x, pts[i].z, x, z) + 0.12, z); uv.push(s < 0 ? 0 : 1, L / 24); }
      if (i < pts.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new T.Mesh(g, M.road); m.receiveShadow = true; G.add(m); };
  const dense = pts => { const o = []; for (let i = 0; i < pts.length - 1; i++) { const n = Math.max(1, Math.ceil(pts[i].distanceTo(pts[i + 1]) / 5)); for (let k = 0; k < n; k++) o.push(new V3().lerpVectors(pts[i], pts[i + 1], k / n)); } o.push(pts[pts.length - 1]); return o; };
  ribbon(dense(lowPts), (px, pz, x, z) => inHiveTun(px, pz) || inHivePit(px, pz) ? f : Math.max(H(x, z), H(px, pz), 0.3));
  const ringA = Math.atan2(P.z - CITYC.z, P.x - CITYC.x), hiPts = [new V3(P.x - Hv.Rh, 0, P.z), new V3(P.x - Hv.R - 6, 0, P.z), new V3(CITYC.x + Math.cos(ringA) * 155, 0, CITYC.z + Math.sin(ringA) * 155)];
  ribbon(dense(hiPts), () => top);
  /* the bridge from the ramp's last turn over the rim */
  G.add(new T.Mesh(new T.BoxGeometry(Hv.R - Hv.Rh + 8, 1.2, Hv.hw * 2 + 1).translate(P.x - (Hv.Rh + Hv.R + 6) / 2, top - 0.5, P.z), M.conc));
  /* traffic up and down the spiral */
  const path = [...dense(lowPts).map(p => new V3(p.x, inHiveTun(p.x, p.z) || inHivePit(p.x, p.z) ? f : Math.max(H(p.x, p.z), 0.3), p.z))];
  for (let i = 0; i <= Hv.turns * 16; i++) { const th = i / (Hv.turns * 16) * TH, [x, z] = pAt(th, Hv.Rh); path.push(new V3(x, yAt(th), z)); }
  for (const p of dense(hiPts).slice(1)) path.push(new V3(p.x, top, p.z));
  const curve = new T.CatmullRomCurve3(path), L = curve.getLength();
  const carG = mergeGeos([new T.BoxGeometry(2, 1.1, 4.4).translate(0, 0.75, 0), new T.BoxGeometry(1.7, 0.7, 2.2).translate(0, 1.6, -0.2)]), cols = [0xc23a2a, 0xe8e6df, 0x2a4a7a, 0xd8a01a];
  const headM = basic(new T.Color(3, 2.8, 2.2)), tailM = basic(new T.Color(3, 0.3, 0.2)), hg = new T.BoxGeometry(1.6, 0.25, 0.1);
  HIVE.cars = []; for (let i = 0; i < (LOW_END ? 3 : 5); i++) { const m = new T.Mesh(carG, std(cols[i % cols.length], 0.35, 0.6)); const a = new T.Mesh(hg, headM); a.position.set(0, 0.8, 2.25); m.add(a); const b2 = new T.Mesh(hg, tailM); b2.position.set(0, 0.85, -2.25); m.add(b2); G.add(m); HIVE.cars.push({ m, u: i / (LOW_END ? 3 : 5), dir: i % 2 ? 1 : -1, sp: rand(11, 15) }); }
  HIVE.curve = curve; HIVE.L = L;
})();
const _hvP = new V3(), _hvT = new V3();
function updateHive(dt) {
  if (camera.position.distanceTo(_hvP.set(HIVE.x, camera.position.y, HIVE.z)) > 700) return;
  for (const c of HIVE.cars) { c.u = (c.u + c.dir * c.sp * dt / HIVE.L + 1) % 1; HIVE.curve.getPointAt(c.u, _hvP); HIVE.curve.getTangentAt(c.u, _hvT); if (c.dir < 0) _hvT.negate();
    const side = 2.1; c.m.position.set(_hvP.x - _hvT.z * side / Math.hypot(_hvT.x, _hvT.z), _hvP.y + 0.1, _hvP.z + _hvT.x * side / Math.hypot(_hvT.x, _hvT.z)); c.m.rotation.y = Math.atan2(_hvT.x, _hvT.z); }
}
{ const _uw = updateWorld; updateWorld = function (dt) { _uw(dt); updateHive(dt); }; }
