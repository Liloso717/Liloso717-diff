'use strict';
/* ===================== IRON MERIDIAN · Aeris Island landmarks =====================
   The places on the Aeris map, built to match it: the open-roofed stadium and the glowing dome either side of
   downtown, the shopping mall, the airport under the northern range, the Annexed Sector military base on the west
   coast, the construction site and the south-west towers, the gold towers on the south point, the maritime port
   with its cranes and freighters, the beach archipelago with its bridges and the glass subway tunnel, the waterfalls
   of Waterfall Valley, the tunnel portal and the border checkpoint, the naval blockade and a cruise ship offshore,
   and smoke over the volcano.
   Each landmark is a handful of merged meshes (one per material) so a phone draws it in a few calls. Walls that
   matter to movement are Buildings; the stadium and dome shells cannot be knocked down. */
const AERIS = { falls: [], spray: [], domeT: 0, beacons: [] };
(function buildAeris() {
  const M = {
    conc: std(0x8a8c8e, 0.85, 0.08), dark: std(0x2a2c30, 0.7, 0.3), steel: std(0x9aa0a6, 0.45, 0.6),
    white: std(0xe2e2dc, 0.6, 0.1), glass: std(0x6f8faa, 0.15, 0.85, { map: facadeTex, emissiveMap: facadeLit, emissive: 0xcfe8ff, emissiveIntensity: 1 }),
    gold: std(0xd9a23a, 0.25, 0.95, { map: facadeTex, emissiveMap: facadeLit, emissive: 0xffd28a, emissiveIntensity: 0.7 }),
    seat: std(0x3a4a6a, 0.8, 0.1), pitch: std(0x2f6a2a, 0.95, 0), track: std(0x9a4a32, 0.95, 0),
    rib: basic(new T.Color(1.2, 1.6, 3.4)), purple: std(0x6a2aa8, 0.3, 0.2, { emissive: 0x7a2cff, emissiveIntensity: 0.9, transparent: true, opacity: 0.88 }),
    pglow: basic(new T.Color(2.4, 0.9, 3.6)), red: std(0x9a1f1a, 0.8, 0.05, { side: T.DoubleSide }), olive: std(0x4a5236, 0.85, 0.2),
    tarmac: std(0x2a2b2d, 0.95, 0.02), stripe: basic(new T.Color(1.6, 1.6, 1.4)), orange: std(0xc77d2a, 0.6, 0.5), rust: std(0x7a4a30, 0.85, 0.3),
    wood: std(0x7a5a3a, 0.9, 0), palm: std(0x2e6a2a, 0.9, 0, { side: T.DoubleSide }), sand: std(0xcab48a, 0.98, 0),
    tube: std(0x7fe0ff, 0.1, 0.6, { emissive: 0x2a9ac8, emissiveIntensity: 0.8, transparent: true, opacity: 0.55 }),
    lamp: basic(new T.Color(3, 2.4, 1.4)), hull: std(0x2a3036, 0.6, 0.5), cruise: std(0xf2f2ee, 0.5, 0.15), deck: std(0x5a6066, 0.7, 0.4),
  };
  const G = new T.Group(); G.name = 'aeris'; scene.add(G);
  const solid = (x, z, w, d, h, o = {}) => { const B = new Building(x, z, w, d, h, Object.assign({ mesh: new T.Group(), hp: 1e9 }, o)); B.cover = true; BUILDINGS.push(B); return B; };
  const lm = (x, z, w, d, h, mesh, o = {}) => { const B = new Building(x, z, w, d, h, Object.assign({ mesh, hp: 8000 }, o)); BUILDINGS.push(B); return B; };
  /* clear houses and blocks out of a landmark's footprint (villages and the city were laid out before this) */
  const clearArea = (x, z, w, d) => { for (let i = BUILDINGS.length - 1; i >= 0; i--) { const b = BUILDINGS[i]; if (b.landmark || b.maxHp >= 1e6 || b.cover) continue; if (Math.abs(b.x - x) < (b.w + w) / 2 && Math.abs(b.z - z) < (b.d + d) / 2) { scene.remove(b.mesh); BUILDINGS.splice(i, 1); } } };
  const gy = (x, z) => Math.max(0, H(x, z));
  const bake = (b, shadows) => { const g = new T.Group(); bakeInto(g, b, M, shadows); G.add(g); return g; };

  /* ---------- the multi-use stadium (open dome), west of downtown ---------- */
  { const S = DIST('canal'), x = S.x, z = S.z, y = gy(x, z), b = bucket(); clearArea(x, z, 120, 120);
    const prof = [[52, 0], [52, 18], [50, 21], [36, 9], [34, 1.2]]; /* outer wall up to the rim, seating down to the pitch */
    b.add('conc', lathe([[52, 0], [52, 18], [50.5, 18.5]], 40).translate(x, y, z)); b.add('seat', lathe([[50, 18.5], [36, 8], [34, 1.2]], 40).translate(x, y, z));
    b.add('pitch', new T.CircleGeometry(34, 32).rotateX(-Math.PI / 2).translate(x, y + 0.8, z)); b.add('track', new T.RingGeometry(26, 33.5, 32).rotateX(-Math.PI / 2).translate(x, y + 0.85, z));
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; b.add('rib', new T.TorusGeometry(46, 0.5, 4, 24, Math.PI * 0.62).rotateZ(Math.PI * 0.19).rotateY(a).translate(x, y + 18, z)); } /* the open roof: lit ribs over the bowl */
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4, px = x + Math.cos(a) * 56, pz = z + Math.sin(a) * 56; b.add('steel', new T.CylinderGeometry(0.5, 0.7, 34, 6).translate(px, y + 17, pz)); b.add('lamp', new T.BoxGeometry(5, 2, 1).translate(px, y + 34, pz)); }
    bake(b, ['conc', 'seat']);
    /* walls as twelve indestructible segments with two gaps: armies fight on the pitch */
    for (let i = 0; i < 14; i++) { if (i === 3 || i === 10) continue; const a = (i + 0.5) / 14 * Math.PI * 2, r = 51, sx = x + Math.cos(a) * r, sz = z + Math.sin(a) * r; solid(sx, sz, 16, 16, 18); }
    addLight(x, y + 30, z, 3, 3, 2.6, 18); }

  /* ---------- the football stadium & social club: the glowing geodesic dome, east of downtown ---------- */
  { const D = { x: 330, z: 0 }, y = gy(D.x, D.z), b = bucket(); clearArea(D.x, D.z, 96, 96);
    const dome = new T.IcosahedronGeometry(40, 2); { const p = dome.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, 0); } dome.computeVertexNormals();
    b.add('purple', dome.translate(D.x, y + 2, D.z));
    b.add('conc', new T.CylinderGeometry(42, 43, 3, 40).translate(D.x, y + 1.5, D.z));
    bake(b, []);
    const edges = new T.LineSegments(new T.EdgesGeometry(new T.IcosahedronGeometry(40.3, 2), 1), new T.LineBasicMaterial({ color: new T.Color(2.8, 1.2, 4), transparent: true, opacity: 0.85 }));
    edges.position.set(D.x, y + 2, D.z); edges.scale.y = 1; G.add(edges); AERIS.dome = edges;
    solid(D.x, D.z, 62, 62, 38, { name: 'The Aeris Dome' });
    addLight(D.x, y + 44, D.z, 2.6, 1, 3.6, 30); }

  /* ---------- the shopping mall ---------- */
  { const x = 320, z = 140, y = gy(x, z), g = new T.Group(), b = bucket(); clearArea(x, z, 80, 50);
    b.add('conc', new T.BoxGeometry(72, 12, 40).translate(0, 6, 0)); b.add('glass', new T.BoxGeometry(60, 9, 1).translate(0, 5, -20.4)); b.add('white', new T.BoxGeometry(74, 1.2, 42).translate(0, 12.6, 0));
    b.add('glass', new T.CylinderGeometry(9, 9, 16, 16).translate(-26, 8, -12)); bakeInto(g, b, M);
    const sign = new T.Mesh(new T.PlaneGeometry(26, 4), new T.MeshBasicMaterial({ map: canvasTex(256, 40, (c, w, h) => { c.fillStyle = '#120a1e'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd6f4'; c.font = '800 26px sans-serif'; c.textAlign = 'center'; c.fillText('AERIS MALL', w / 2, 30); }) }));
    sign.position.set(8, 10.5, -20.6); sign.rotation.y = Math.PI; g.add(sign);
    lm(x, z, 72, 40, 13, g, { name: 'The Aeris Mall', hp: 9000 });
    const lot = new T.Mesh(new T.PlaneGeometry(70, 26).rotateX(-Math.PI / 2), M.tarmac); lot.position.set(x, y + 0.15, z - 36); G.add(lot); }

  /* ---------- Aeris International Airport ---------- */
  { const A = DIST('rail'), x0 = -80, x1 = 200, z = A.z, b = bucket();
    for (let x = x0; x < x1; x += 10) { const y = gy(x + 5, z); b.add('tarmac', new T.BoxGeometry(10.2, 0.3, 30).translate(x + 5, y + 0.15, z)); if ((x / 10) % 2 === 0) b.add('stripe', new T.BoxGeometry(5, 0.05, 0.8).translate(x + 5, y + 0.33, z)); }
    for (const s of [-1, 1]) for (let x = x0; x < x1; x += 20) b.add('lamp', new T.BoxGeometry(0.6, 0.4, 0.6).translate(x, gy(x, z + s * 15) + 0.5, z + s * 15.5));
    bake(b, []);
    const T0 = { x: 60, z: z - 50 }, tg = new T.Group(), tb = bucket(); clearArea(T0.x, T0.z, 120, 34);
    tb.add('glass', new T.BoxGeometry(110, 12, 24).translate(0, 6, 0)); tb.add('white', new T.BoxGeometry(116, 1.4, 30).translate(0, 12.7, 0));
    for (let i = -2; i <= 2; i++) tb.add('steel', new T.BoxGeometry(3, 4, 16).translate(i * 22, 5, 18)); bakeInto(tg, tb, M);
    lm(T0.x, T0.z, 110, 24, 14, tg, { name: 'The airport terminal', hp: 12000 });
    const tw = new T.Group(), twb = bucket(); twb.add('conc', new T.CylinderGeometry(2.6, 3.4, 34, 10).translate(0, 17, 0)); twb.add('glass', new T.CylinderGeometry(6, 4.5, 6, 10).translate(0, 37, 0)); twb.add('dark', new T.CylinderGeometry(6.6, 6.6, 1, 10).translate(0, 40.5, 0)); bakeInto(tw, twb, M);
    lm(140, z - 52, 9, 9, 41, tw, { name: 'The control tower', mode: 'topple', hp: 5000 });
    /* jets on the apron */
    const jet = mergeGeos([new T.CylinderGeometry(1.6, 1.4, 26, 10).rotateX(Math.PI / 2), new T.ConeGeometry(1.6, 5, 10).rotateX(Math.PI / 2).translate(0, 0, 15.5), new T.BoxGeometry(28, 0.5, 5).translate(0, -0.4, 1), new T.BoxGeometry(9, 0.4, 3).translate(0, 0.6, -11), new T.BoxGeometry(0.4, 5, 3.5).translate(0, 3, -11.5)]);
    for (const [jx, jz, r] of [[10, z - 26, 0.3], [95, z - 25, -0.2], [180, z - 24, 1.4]]) { const m = new T.Mesh(jet, M.white); m.position.set(jx, gy(jx, jz) + 2.2, jz); m.rotation.y = r; m.castShadow = true; G.add(m); } }

  /* ---------- Annexed Sector 01: the military base on the west coast ---------- */
  { const S = DIST('wilds'), x = -432, b = bucket();
    for (let zz = -110; zz < 130; zz += 10) { const y = gy(x, zz + 5); b.add('tarmac', new T.BoxGeometry(22, 0.3, 10.2).translate(x, y + 0.15, zz + 5)); if ((zz / 10) % 2 === 0) b.add('stripe', new T.BoxGeometry(0.7, 0.05, 5).translate(x, y + 0.33, zz + 5)); }
    bake(b, []);
    for (const hz of [-70, -15, 40]) { const hx = -372, g = new T.Group(), hb = bucket(); clearArea(hx, hz, 30, 40);
      hb.add('olive', new T.CylinderGeometry(13, 13, 34, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(0, 0, 0)); hb.add('dark', new T.BoxGeometry(24, 11, 0.6).translate(0, 5.5, -17)); bakeInto(g, hb, M);
      lm(hx, hz, 26, 34, 13, g, { name: 'A hangar', hp: 7000 }); }
    { const g = new T.Group(), hb = bucket(); hb.add('conc', new T.BoxGeometry(28, 10, 16).translate(0, 5, 0)); hb.add('dark', new T.BoxGeometry(30, 1, 18).translate(0, 10.5, 0)); bakeInto(g, hb, M); clearArea(-360, 95, 30, 18); lm(-360, 95, 28, 16, 11, g, { name: 'Sector command', hp: 9000 }); }
    /* red banners and the perimeter fence */
    const fb = bucket(); for (let i = 0; i < 4; i++) { const bx = -395 + i * 12, bz = 120, y = gy(bx, bz); fb.add('steel', new T.CylinderGeometry(0.15, 0.15, 12, 5).translate(bx, y + 6, bz)); fb.add('red', new T.PlaneGeometry(3.2, 7).translate(bx + 1.7, y + 8, bz)); }
    for (let k = 0; k < 64; k++) { const a = k / 64 * Math.PI * 2, fx = -420 + Math.cos(a) * 68, fz = 10 + Math.sin(a) * 140; if (H(fx, fz) < 1) continue; fb.add('steel', new T.BoxGeometry(0.2, 3, 0.2).translate(fx, gy(fx, fz) + 1.5, fz)); }
    bake(fb, []);
    for (const [wx, wz] of [[-330, -95], [-330, 120]]) { const g = new T.Group(), wb = bucket(); for (const [lx, lz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) wb.add('steel', new T.BoxGeometry(0.5, 14, 0.5).translate(lx, 7, lz)); wb.add('olive', new T.BoxGeometry(6, 3, 6).translate(0, 15.5, 0)); bakeInto(g, wb, M); lm(wx, wz, 6, 6, 17, g, { name: 'A watchtower', mode: 'topple', hp: 2000 }); }
    const sign = new T.Mesh(new T.PlaneGeometry(20, 3.2), new T.MeshBasicMaterial({ side: T.DoubleSide, map: canvasTex(256, 40, (c, w, h) => { c.fillStyle = '#2a0a08'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffcfbf'; c.font = '800 22px sans-serif'; c.textAlign = 'center'; c.fillText('ANNEXED SECTOR 01', w / 2, 28); }) }));
    sign.position.set(-330, gy(-330, 15) + 6, 15); sign.rotation.y = Math.PI / 2; G.add(sign); }

  /* ---------- the construction site and the south-west towers ---------- */
  { const cx = -330, cz = 190, y = gy(cx, cz), b = bucket(); clearArea(cx, cz, 60, 50);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) for (const [ox, oz] of [[0, 0], [10, 0], [0, 10], [10, 10]]) b.add('orange', new T.BoxGeometry(0.4, 4, 0.4).translate(cx - 15 + i * 10 + ox * 0 + (ox ? 9.6 : 0), y + 2 + j * 4, cz - 10 + (oz ? 9.6 : 0)));
    for (let j = 1; j <= 4; j++) b.add('conc', new T.BoxGeometry(31, 0.4, 11).translate(cx, y + j * 4, cz - 5));
    bake(b, []);
    const cr = new T.Group(), cb = bucket(); cb.add('orange', new T.BoxGeometry(1.4, 48, 1.4).translate(0, 24, 0)); cb.add('orange', new T.BoxGeometry(40, 1.4, 1.4).translate(10, 48, 0)); cb.add('conc', new T.BoxGeometry(4, 3, 4).translate(-8, 46, 0)); bakeInto(cr, cb, M);
    lm(cx + 22, cz + 14, 4, 4, 50, cr, { name: 'The site crane', mode: 'topple', hp: 2500 });
    for (let k = 0, n = 0; k < 60 && n < 7; k++) { const tx = -300 + rand(-50, 50), tz = 320 + rand(-45, 45), w = rand(14, 20), d = rand(14, 20); if (H(tx, tz) < 2 || BUILDINGS.some(o => Math.abs(o.x - tx) < (o.w + w) / 2 + 8 && Math.abs(o.z - tz) < (o.d + d) / 2 + 8)) continue; BUILDINGS.push(new Building(tx, tz, w, d, rand(40, 85))); n++; } }

  /* ---------- the gold towers on the south point ---------- */
  { const P = { x: 40, z: 385 };
    [[0, 0, 150, 9], [-26, 14, 118, 7.5], [24, 18, 104, 7], [-10, 34, 86, 6.5], [30, -14, 92, 6]].forEach(([ox, oz, h, r], i) => {
      const x = P.x + ox, z = P.z + oz; clearArea(x, z, r * 2.4, r * 2.4); const g = new T.Group(), b = bucket();
      const geo = new T.CylinderGeometry(r * 0.35, r, h, 8, 12); { const p = geo.attributes.position; for (let k = 0; k < p.count; k++) { const yy = p.getY(k) / h + 0.5, a = yy * (1.4 + i * 0.2), c = Math.cos(a), s = Math.sin(a), px = p.getX(k), pz = p.getZ(k); p.setX(k, px * c - pz * s); p.setZ(k, px * s + pz * c); } geo.computeVertexNormals(); }
      boxProjUV(geo, 18, false); b.add('gold', geo.translate(0, h / 2, 0)); b.add('lamp', new T.SphereGeometry(0.9, 8, 6).translate(0, h + 1, 0)); bakeInto(g, b, M);
      lm(x, z, r * 1.8, r * 1.8, h, g, { name: i ? 'A gold tower' : 'The Aeris Crown', mode: 'topple', hp: 9000 + h * 40 }); }); }

  /* ---------- the maritime port: quay, gantry cranes, container stacks, freighters ---------- */
  { const P = DIST('dam'), dirs = [0.62, 0.95, 1.25], quay = [];
    for (const a of dirs) { let r = 0; while (r < 160 && H(P.x + Math.cos(a) * r, P.z + Math.sin(a) * r) > 0.6) r += 2; quay.push({ x: P.x + Math.cos(a) * (r - 4), z: P.z + Math.sin(a) * (r - 4), a }); }
    for (const q of quay) { const cr = new T.Group(), cb = bucket();
      for (const [lx, lz] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) cb.add('orange', new T.BoxGeometry(1.2, 30, 1.2).translate(lx, 15, lz));
      cb.add('orange', new T.BoxGeometry(3, 3, 52).translate(0, 31, 14)); cb.add('conc', new T.BoxGeometry(5, 4, 6).translate(0, 34, -2)); bakeInto(cr, cb, M); cr.rotation.y = Math.PI / 2 - q.a;
      clearArea(q.x, q.z, 12, 12); lm(q.x, q.z, 11, 11, 34, cr, { name: 'A port crane', mode: 'topple', hp: 3500 }); }
    /* containers on the quay apron */
    const cols = [0xa0402a, 0x2a6a7a, 0xc9a040, 0x3a7a3a, 0x7a2a6a, 0x5a6a7a], box = new T.BoxGeometry(12, 2.6, 2.6), im = new T.InstancedMesh(box, std(0xffffff, 0.8, 0.3), 90); let n = 0;
    for (let k = 0; k < 400 && n < 90; k++) { const x = P.x + rand(-30, 40), z = P.z + rand(-40, 30), h = H(x, z); if (h < 1 || buildingAt(_v1.set(x, h + 1, z)) || Math.hypot(x - P.x, z - P.z) < 14) continue; const st = 1 + (Math.random() * 3 | 0);
      for (let s = 0; s < st && n < 90; s++) { _m.compose(_v1.set(x, h + 1.3 + s * 2.65, z), _q.setFromAxisAngle(UP, 0.7), _s.set(1, 1, 1)); im.setMatrixAt(n, _m); im.setColorAt(n, _c.set(pick(cols))); n++; } }
    im.count = n; im.castShadow = true; G.add(im);
    /* freighters at the berths */
    const ship = mergeGeos([new T.BoxGeometry(14, 7, 80).translate(0, 1, 0), new T.BoxGeometry(12, 10, 12).translate(0, 9, -30), new T.BoxGeometry(2, 6, 2).translate(0, 17, -32)]);
    for (const q of quay.slice(0, 2)) { const m = new T.Mesh(ship, M.hull), off = 18; m.position.set(q.x + Math.cos(q.a) * off, 0, q.z + Math.sin(q.a) * off); m.rotation.y = Math.PI / 2 - q.a + Math.PI / 2; m.castShadow = true; G.add(m); } }

  /* ---------- the beach archipelago: palms, huts, bridges, and the glass subway tunnel ---------- */
  { const pb = bucket(), leaf = new T.ConeGeometry(4, 1.2, 6);
    for (const [ix, iz, ir] of ISLETS) for (let k = 0; k < Math.round(ir / 5); k++) { const a = rand(0, 6.28), r = rand(0, ir * 0.55), x = ix + Math.cos(a) * r, z = iz + Math.sin(a) * r, y = H(x, z); if (y < 0.8) continue; const h = rand(7, 11), lean = rand(-0.25, 0.25);
      pb.add('wood', new T.CylinderGeometry(0.25, 0.4, h, 5).rotateZ(lean).translate(x, y + h / 2, z)); pb.add('palm', leaf.clone().translate(x - Math.sin(lean) * h, y + h, z)); }
    for (const [ix, iz] of ISLETS.slice(0, 3)) { const y = H(ix, iz); if (y > 1) { pb.add('wood', new T.BoxGeometry(6, 3, 5).translate(ix + 6, y + 1.5, iz)); pb.add('palm', new T.ConeGeometry(4.6, 2.4, 4).rotateY(0.78).translate(ix + 6, y + 4, iz)); } }
    /* bridges: a chain from the south shore out along the islands (walkable decks) */
    const shore = (() => { let z = 380; while (z < 520 && H(-195, z) > 0.8) z += 2; return [-195, z - 6]; })(), chain = [shore, ...ISLETS.slice(0, 3).map(i => [i[0], i[1]]).sort((p, q) => p[0] - q[0])];
    const link = (A, B) => { const dx = B[0] - A[0], dz = B[1] - A[1], L = Math.hypot(dx, dz), ya = Math.atan2(dx, dz); pb.add('deck', new T.BoxGeometry(6, 0.6, L).rotateY(ya).translate((A[0] + B[0]) / 2, 2.9, (A[1] + B[1]) / 2)); for (let t = 0.15; t < 1; t += 0.2) pb.add('conc', new T.BoxGeometry(1.2, 6, 1.2).translate(A[0] + dx * t, -0.2, A[1] + dz * t)); DECKS.push({ x: A[0], z: A[1], x2: B[0], z2: B[1], y: 3.2, r: 3 }); };
    link(chain[0], [ISLETS[0][0], ISLETS[0][1]]); link([ISLETS[0][0], ISLETS[0][1]], [ISLETS[1][0], ISLETS[1][1]]); link([ISLETS[1][0], ISLETS[1][1]], [ISLETS[2][0], ISLETS[2][1]]);
    bake(pb, ['wood', 'palm']);
  }

  /* ---------- Waterfall Valley: three falls off the cliff into the river's head ---------- */
  { const fallTex = canvasTex(32, 128, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(220,240,255,.95)'); gr.addColorStop(1, 'rgba(200,230,255,.55)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(Math.random() * w, Math.random() * h, 1.5, 12 + Math.random() * 20); } });
    fallTex.wrapT = T.RepeatWrapping; const fm = new T.MeshBasicMaterial({ map: fallTex, transparent: true, opacity: 0.85, depthWrite: false, side: T.DoubleSide });
    for (const a of [3.65, 3.95, 4.25]) { /* find the cliff edge on a ray from the shelf's centre toward the valley */
      let r = 40; while (r < 110 && H(352 + Math.cos(a) * r, -310 + Math.sin(a) * r) > 40) r += 2; const x = 352 + Math.cos(a) * r, z = -310 + Math.sin(a) * r, top = H(352 + Math.cos(a) * (r - 4), -310 + Math.sin(a) * (r - 4)), bot = Math.max(1, H(352 + Math.cos(a) * (r + 22), -310 + Math.sin(a) * (r + 22)));
      const hgt = Math.max(10, top - bot), m = new T.Mesh(new T.PlaneGeometry(9, hgt), fm); m.position.set(x, bot + hgt / 2, z); m.rotation.y = -a + Math.PI / 2; G.add(m); AERIS.falls.push(m); AERIS.spray.push(new V3(x + Math.cos(a) * 8, bot + 1, z + Math.sin(a) * 8)); }
    AERIS.fallTex = fallTex; }

  /* ---------- the mountain tunnel portal and the border checkpoint on the east road ---------- */
  { const px = 418, pz = -18, y = gy(px, pz), b = bucket(); b.add('conc', new T.BoxGeometry(20, 14, 4).translate(px, y + 7, pz)); b.add('dark', new T.CylinderGeometry(6, 6, 4.2, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(px, y + 4, pz - 0.1));
    const cx = 432, cz = 70, cy = gy(cx, cz);
    for (const s of [-1, 1]) { b.add('white', new T.BoxGeometry(3, 3, 3).translate(cx + s * 7, cy + 1.5, cz)); b.add('red', new T.BoxGeometry(6, 0.4, 0.4).translate(cx + s * 3, cy + 1.6, cz)); }
    b.add('steel', new T.BoxGeometry(18, 0.6, 6).translate(cx, cy + 6, cz)); for (const s of [-1, 1]) b.add('steel', new T.BoxGeometry(0.6, 6, 0.6).translate(cx + s * 8.6, cy + 3, cz));
    bake(b, ['conc']); }

  /* ---------- offshore: the naval blockade in the south-west, a cruise ship, and the volcano's plume ---------- */
  { for (const [x, z, yaw, t] of [[-445, 420, 0.6, 2], [-390, 495, 1.1, 2], [-520, 330, 0.2, 1]].slice(0, LOW_END ? 2 : 3)) { if (H(x, z) > -4) continue; const NM = buildNavalModel(t, (t === 1 ? 'MCS ' : 'VDS ') + (30 + ((Math.random() * 50) | 0))); NM.obj.position.set(x, 0, z); NM.obj.rotation.y = yaw; G.add(NM.obj); }
    const cs = mergeGeos([new T.BoxGeometry(22, 8, 110).translate(0, 2, 0), new T.BoxGeometry(18, 10, 80).translate(0, 11, -6), new T.BoxGeometry(14, 6, 50).translate(0, 19, -8), new T.CylinderGeometry(2.5, 3, 8, 10).translate(0, 26, -18)]);
    const cm = new T.Mesh(cs, M.cruise); cm.position.set(-500, 0, 210); cm.rotation.y = 0.4; G.add(cm);
    const lit = new T.Mesh(new T.BoxGeometry(18.2, 1, 80.2), M.lamp); lit.position.set(0, 13, -6); cm.add(lit);
    addEmitter(new V3(VOLCANO.x, VOLC_TOP(), VOLCANO.z), 3.2, 1e9); }
})();

/* ---------- the great mountain on the horizon: a Mauna Kea out to the north-east ----------
   In the game's own scale: downtown's mesa stands 230 m, and the mountain stands to it as Mauna Kea's 33,000 ft
   stands to a 7,000 ft city, about 1,080 m, under the edge of space. Three and a half kilometres out, it rises over
   the island from everywhere without ever being in the way.
   It is scenery: the fog that hides the far sea would hide it too, so it carries its own haze, tinted each frame
   toward the sky's colour as the day turns. */
(function greatMountain() {
  const PK = 1080, R = 2500, prof = [];
  for (let i = 0; i <= 28; i++) { const t = i / 28, r = R * (1 - t) + 70 * t, y = -60 + (PK + 60) * (1 - Math.pow(1 - t, 1.9)); /* a shield: broad gentle flanks, steepening under a rounded summit */ prof.push(new T.Vector2(r, y)); }
  prof.push(new T.Vector2(0, PK));
  const g = new T.LatheGeometry(prof, 72), p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z), a = Math.atan2(z, x);
    const ridge = (1 - Math.abs(vnoise(a * 6, y * 0.0055) * 2 - 1)) * 0.06 + vnoise(x * 0.004, z * 0.004) * 0.05; /* lava ridges running down the flanks */
    const k = 1 + ridge * Math.min(1, (PK - y) / 320); p.setX(i, x * k); p.setZ(i, z * k);
    const snow = smooth(730, 840, y + vnoise(a * 9, 3) * 90), rock = smooth(215, 540, y);
    const c = [0.2 + rock * 0.1, 0.21 + rock * 0.02, 0.2 + rock * 0.02]; /* green-brown lower slopes, red-brown cinder above */
    for (let j = 0; j < 3; j++) col[i * 3 + j] = lerp(c[j], 0.92, snow);
  }
  g.setAttribute('color', new T.BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = new T.MeshLambertMaterial({ vertexColors: true, fog: false, color: 0xffffff });
  const mt = new T.Mesh(g, m); mt.position.set(2600, 0, -2620); mt.renderOrder = -4; scene.add(mt);
  /* cinder cones on the summit plateau, and the observatories  */
  const top = new T.Group(); top.position.set(2600, 0, -2620); scene.add(top);
  const cone = new T.ConeGeometry(55, 42, 10), dome = new T.SphereGeometry(13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const coneM = new T.MeshLambertMaterial({ color: 0x8a4a34, fog: false }), domeM = new T.MeshLambertMaterial({ color: 0xf4f4f0, emissive: 0x303030, fog: false });
  for (let i = 0; i < 6; i++) { const a = i * 1.1 + 0.3, r = 60 + (i % 3) * 55, x = Math.cos(a) * r, z = Math.sin(a) * r, y = PK - 8 - r * 0.55; const c2 = new T.Mesh(cone, coneM); c2.position.set(x, y + 14, z); top.add(c2); }
  for (let i = 0; i < 5; i++) { const a = -0.6 + i * 0.32, x = Math.cos(a) * 40, z = Math.sin(a) * 40; const d = new T.Mesh(dome, domeM); d.position.set(x, PK - 4, z); top.add(d); }
  AERIS.mtn = { m, top: [coneM, domeM], base: new T.Color(1, 1, 1) };
})();

/* ---------- THE MESA BUNKER: the secure sub-surface gate in the south face of downtown's mesa ----------
   A chamfered steel gate frame set in raw cliff rock, the blast doors run back into the walls, a hall lit yellow with
   armour parked inside, barrier booms and floodlights at the mouth, and the southern highway running straight in.
   Over the hall a fortified block carries the mesa's surface on as a walkable roof. */
(function mesaBunker() {
  const B = BUNKER, W = B.x1 - B.x0, cx = (B.x0 + B.x1) / 2, D = B.face - B.back, cz = (B.back + B.face) / 2, f = B.floor, top = MESA.top, ch = B.ceil - f;
  const M = {
    rock: std(0x5a4636, 0.95, 0.05, { normalMap: TEX.armor.normal }), conc: std(0x6c6e70, 0.85, 0.1), steel: std(0x2c3034, 0.5, 0.75), dark: std(0x15171a, 0.7, 0.4),
    lit: basic(new T.Color(3.2, 2.4, 1.1)), haz: std(0xd8a01a, 0.6, 0.2), red: basic(new T.Color(3.4, 0.4, 0.25)), olive: std(0x4a5236, 0.8, 0.3), floor: std(0x3a3b3d, 0.9, 0.05), crate: std(0x5a4a30, 0.85, 0.1),
    screen: basic(new T.Color(0.4, 1.6, 3)),
  };
  const G = new T.Group(); G.name = 'bunker'; scene.add(G);
  /* the rock over the hall: a shell whose top is the cliff as it was (so the gate sits in the face, not in a tower),
     closed below by the hall's ceiling */
  { const NX = 18, NZ = 12, P = [], I = [], ox = B.x0 - 1, oz = B.back, sx = (W + 2) / NX, sz = (B.face - B.back) / NZ;
    const topY = (x, z) => Math.max(B.ceil + 3, rawH(x, z, true));
    const v = (x, y, z) => (P.push(x, y, z), P.length / 3 - 1), quad = (a2, b2, c2, d2) => I.push(a2, b2, c2, a2, c2, d2);
    const T0 = []; for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const x = ox + i * sx, z = oz + j * sz; T0.push(v(x, topY(x, z) + (j === NZ ? 0 : 0), z)); }
    const t = (i, j) => T0[j * (NX + 1) + i];
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) quad(t(i, j), t(i, j + 1), t(i + 1, j + 1), t(i + 1, j));
    for (let i = 0; i < NX; i++) { /* the face over the gate */ const x0 = ox + i * sx, x1 = x0 + sx, z = B.face, a2 = v(x0, B.ceil, z), b2 = v(x1, B.ceil, z); quad(a2, b2, t(i + 1, NZ), t(i, NZ)); }
    for (const [ii, flip] of [[0, true], [NX, false]]) for (let j = 0; j < NZ; j++) { const x = ox + ii * sx, z0 = oz + j * sz, z1 = z0 + sz, a2 = v(x, B.ceil, z0), b2 = v(x, B.ceil, z1); if (flip) quad(a2, b2, t(ii, j + 1), t(ii, j)); else quad(b2, a2, t(ii, j), t(ii, j + 1)); }
    { const a2 = v(ox, B.ceil, oz), b2 = v(ox + W + 2, B.ceil, oz), c2 = v(ox + W + 2, B.ceil, B.face), d2 = v(ox, B.ceil, B.face); quad(a2, d2, c2, b2); } /* the hall's ceiling */
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
    const mesh = new T.Mesh(g, M.rock); mesh.castShadow = true; mesh.receiveShadow = true; G.add(mesh);
    const R = new Building(cx, cz, W + 2, D, top - B.ceil, { mesh: new T.Group(), hp: 1e9, name: 'The Mesa Bunker' }); R.cover = true; R.gy = B.ceil; R.top = top; R.h = top - B.ceil; BUILDINGS.push(R);
    DECKS.push({ x: B.x0 + 9, z: B.back + 8, x2: B.x1 - 9, z2: B.back + 8, y: top, r: 10 }); /* the mesa top runs on over the back of the roof */ }
  /* the gate: chamfered steel frame, hazard sill, the doors run back into the walls */
  { const b = bucket(), zf = B.face + 0.5, ow = W - 14, oh = ch - 4, c = 7; /* opening, chamfer */
    for (const s of [-1, 1]) {
      b.add('steel', new T.BoxGeometry(6, oh - c, 3).translate(cx + s * (ow / 2 + 3), f + (oh - c) / 2, zf));
      b.add('steel', new T.BoxGeometry(c * 1.5, 4, 3).rotateZ(s * Math.PI / 4).translate(cx + s * (ow / 2 - c / 2 + 1), f + oh - c / 2 + 1, zf));
      b.add('dark', new T.BoxGeometry(2, oh, 1).translate(cx + s * (ow / 2 + 0.5), f + oh / 2, zf - 1.5));
      b.add('steel', new T.BoxGeometry(ow / 2 * 0.28, oh, 2.4).translate(cx + s * (ow / 2 - ow * 0.07), f + oh / 2, zf - 4)); /* a door leaf, run back */
      b.add('lit', new T.BoxGeometry(1.2, 1.2, 0.6).translate(cx + s * (ow / 2 + 3), f + oh + 2, zf + 1.6));
    }
    b.add('steel', new T.BoxGeometry(ow - c * 2 + 4, 6, 3).translate(cx, f + oh + 1, zf));
    b.add('steel', new T.BoxGeometry(W + 2, ch - oh + 1, 2).translate(cx, f + oh + (ch - oh) / 2 + 2, zf - 0.8)); /* the lintel plate up to the rock */
    for (let i = 0; i < 12; i++) b.add(i % 2 ? 'dark' : 'haz', new T.BoxGeometry(ow / 12, 0.3, 2).translate(cx - ow / 2 + ow / 12 * (i + 0.5), f + 0.2, zf + 1));
    /* the mouth: barrier booms, floodlight masts, guard posts */
    for (const s of [-1, 1]) { const bx = cx + s * 14, bz = B.front - 3, y = Math.max(f, H(bx, bz));
      b.add('conc', new T.BoxGeometry(3, 3, 3).translate(cx + s * (ow / 2 - 1), y + 1.5, bz)); b.add('haz', new T.BoxGeometry(22, 0.6, 0.6).translate(bx - s * 2, y + 2.6, bz));
      const mx = cx + s * (W / 2 + 6), mz = B.front + 4, my = Math.max(0, H(mx, mz)); b.add('steel', new T.CylinderGeometry(0.4, 0.6, 16, 6).translate(mx, my + 8, mz)); b.add('lit', new T.BoxGeometry(3, 1.6, 1).translate(mx, my + 16, mz - 0.5)); }
    const g = new T.Group(); bakeInto(g, b, M, ['steel', 'rock']); G.add(g);
    for (const s of [-1, 1]) { const P = new Building(cx + s * (ow / 2 + 3), zf, 6, 3, oh, { mesh: new T.Group(), hp: 1e9 }); P.cover = true; BUILDINGS.push(P); }
    const sign = new T.Mesh(new T.PlaneGeometry(30, 3.4), new T.MeshBasicMaterial({ map: canvasTex(320, 36, (c2, w, h) => { c2.fillStyle = '#1a0806'; c2.fillRect(0, 0, w, h); c2.fillStyle = '#ffd2b8'; c2.font = '800 20px sans-serif'; c2.textAlign = 'center'; c2.fillText('MESA BUNKER · SECURE GATE', w / 2, 25); }) }));
    sign.position.set(cx, f + oh + 7, zf + 1.6); G.add(sign); }
  /* the hall: floor, walls that hide the cut, ceiling lights, columns, armour, crates, the command wall */
  { const b = bucket();
    { const U = UNDERPASS, zA = B.back, zB = B.front, rf = U.floor; /* the lower floor either side; the road crosses on a raised causeway */
      b.add('floor', new T.BoxGeometry(U.x0 - B.x0, 0.4, zB - zA).translate((B.x0 + U.x0) / 2, f + 0.05, (zA + zB) / 2));
      b.add('floor', new T.BoxGeometry(B.x1 - U.x1, 0.4, zB - zA).translate((U.x1 + B.x1) / 2, f + 0.05, (zA + zB) / 2));
      for (const xx of [U.x0, U.x1]) { const s = xx === U.x0 ? -1 : 1; /* the causeway's flanks: a bridge, piers and arches, railings on top */
        b.add('conc', new T.BoxGeometry(0.9, rf - f, zB - zA).translate(xx + s * 0.45, (rf + f) / 2, (zA + zB) / 2));
        for (let z = zA + 4; z < zB - 2; z += 9) { b.add('conc', new T.BoxGeometry(1.6, rf - f, 1.8).translate(xx + s * 1.2, (rf + f) / 2, z)); b.add('dark', new T.BoxGeometry(0.2, (rf - f) * 0.55, 6).translate(xx + s * 0.95, f + (rf - f) * 0.35, z + 4.5)); }
        b.add('steel', new T.BoxGeometry(0.25, 1.1, zB - zA).translate(xx + s * 0.2, rf + 1.1, (zA + zB) / 2)); for (let z = zA + 2; z < zB; z += 4) b.add('steel', new T.BoxGeometry(0.15, 1.1, 0.15).translate(xx + s * 0.2, rf + 0.55, z));
        for (let z = zA + 10; z < zB; z += 18) { b.add('steel', new T.CylinderGeometry(0.15, 0.2, 7, 5).translate(xx + s * 0.6, rf + 3.5, z)); b.add('lit', new T.BoxGeometry(1.4, 0.3, 0.6).translate(xx - s * 0.2, rf + 7, z)); } }
      const rp = B.ramp; b.add('conc', new T.BoxGeometry(rp.x1 - rp.x0, 0.6, rp.z1 - rp.z0).translate((rp.x0 + rp.x1) / 2, f + 0.3, (rp.z0 + rp.z1) / 2)); /* the tunnel station platform */
      b.add('lit', new T.BoxGeometry(rp.x1 - rp.x0, 0.15, 0.4).translate((rp.x0 + rp.x1) / 2, f + 0.65, rp.z1));
      b.add('screen', new T.BoxGeometry(12, 1.6, 0.3).translate((rp.x0 + rp.x1) / 2, f + 9, B.back + 1.8)); }
    for (const s of [-1, 1]) b.add('conc', new T.BoxGeometry(1.5, ch, D).translate(cx + s * (W / 2 - 0.75), f + ch / 2, cz));
    for (const [xa, xb] of [[B.x0, UNDERPASS.x0], [UNDERPASS.x1, B.x1]]) b.add('conc', new T.BoxGeometry(xb - xa, ch, 1.5).translate((xa + xb) / 2, f + ch / 2, B.back + 0.75)); /* the back wall, open where the road goes on under downtown */
    b.add('conc', new T.BoxGeometry(UNDERPASS.x1 - UNDERPASS.x0, B.ceil - UNDERPASS.ceil, 1.5).translate((UNDERPASS.x0 + UNDERPASS.x1) / 2, (B.ceil + UNDERPASS.ceil) / 2, B.back + 0.75)); /* over the underpass mouth */
    b.add('lit', new T.BoxGeometry(UNDERPASS.x1 - UNDERPASS.x0, 0.4, 0.5).translate((UNDERPASS.x0 + UNDERPASS.x1) / 2, UNDERPASS.ceil + 0.4, B.back + 1.6));
    for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) b.add('lit', new T.BoxGeometry(14, 0.3, 1.2).translate(cx - 26 + k * 26, B.ceil - 0.4, B.back + 8 + r * 12));
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) b.add('lit', new T.BoxGeometry(0.4, 2.2, 6).translate(cx + s * (W / 2 - 1.6), f + 9, B.back + 10 + k * 15));
    for (let i = 0; i < 3; i++) b.add('haz', new T.BoxGeometry(0.4, 0.06, 40).translate(-6 + i * 6, f + 0.3, cz + 4));
    /* the command wall at the back: screens and a gallery */
    for (const xs of [-9, 0, 60, 69]) b.add('screen', new T.BoxGeometry(9, 5.5, 0.3).translate(xs, f + 22, B.back + 1.8));
    for (const [xa, xb] of [[B.x0 + 3, UNDERPASS.x0 - 1], [UNDERPASS.x1 + 1, B.x1 - 3]]) { const gw = xb - xa, gx = (xa + xb) / 2; /* the gallery either side of the gap */
      b.add('steel', new T.BoxGeometry(gw, 0.8, 6).translate(gx, f + 15, B.back + 4.5)); b.add('steel', new T.BoxGeometry(gw, 1.2, 0.3).translate(gx, f + 16, B.back + 7.4)); b.add('red', new T.BoxGeometry(gw, 0.4, 0.4).translate(gx, f + 30, B.back + 1.6)); }
    /* crates along the walls */
    for (let i = 0; i < 12; i++) { const x = B.x0 + 6 + (i % 3) * 3.2, z = B.back + 14 + (i / 3 | 0) * 3.4 + 8, h = 1.6 + (i % 3) * 0.5; b.add('crate', new T.BoxGeometry(3, h, 3).translate(x, f + h / 2, z)); }
    /* armour parked in the hall and one rolling out of the gate */
    const tank = mergeGeos([new T.BoxGeometry(5, 1.6, 8).translate(0, 1.2, 0), new T.BoxGeometry(3.4, 1.2, 3.8).translate(0, 2.6, -0.4), new T.CylinderGeometry(0.22, 0.22, 5, 6).rotateX(Math.PI / 2).translate(0, 2.7, 3.6)]);
    for (const [x, z, r] of [[8, B.back + 26, 0.05], [8, B.back + 42, -0.04], [70, B.back + 48, 0.1], [24, B.face - 4, 0.02]]) b.add('olive', xf(tank, [x, Math.max(f, H(x, z)), z], [0, r, 0])); /* one rolling in along the causeway */
    const g = new T.Group(); bakeInto(g, b, M, ['conc', 'olive', 'crate']); G.add(g);
    for (const s of [-1, 1]) { const Wl = new Building(cx + s * (W / 2 - 0.75), cz, 1.5, D, ch, { mesh: new T.Group(), hp: 1e9 }); Wl.cover = true; BUILDINGS.push(Wl); }
    for (const [xa, xb] of [[B.x0, UNDERPASS.x0], [UNDERPASS.x1, B.x1]]) { const Bk = new Building((xa + xb) / 2, B.back + 0.75, xb - xa, 1.5, ch, { mesh: new T.Group(), hp: 1e9 }); Bk.cover = true; BUILDINGS.push(Bk); }
    for (const [x, z] of [[cx - 22, cz], [cx, cz], [cx + 22, cz]]) addLight(x, f + 20, z, 3, 2.2, 1, 10);
    for (const s of [-1, 1]) addLight(cx + s * (W / 2 + 6), f + 18, B.front + 3, 3.2, 2.6, 1.6, 12); }
  /* the lift: a glass shaft from the hall up through the rock to a lift house on the mesa top, a cab riding it */
  { const L = B.lift, b = bucket(), hgt = top + 8 - f;
    b.add('steel', new T.CylinderGeometry(4.4, 4.4, 0.8, 16).translate(L.x, f + 0.4, L.z)); for (let k = 0; k < 4; k++) { const a2 = k * Math.PI / 2 + 0.78; b.add('steel', new T.BoxGeometry(0.5, hgt, 0.5).translate(L.x + Math.cos(a2) * 4.2, f + hgt / 2, L.z + Math.sin(a2) * 4.2)); }
    b.add('steel', new T.BoxGeometry(10, 0.6, 10).translate(L.x, top + 9, L.z)); b.add('lit', new T.BoxGeometry(10.2, 0.3, 10.2).translate(L.x, top + 8.6, L.z));
    const g = new T.Group(); bakeInto(g, b, M, ['steel']); G.add(g);
    const glass = new T.Mesh(new T.CylinderGeometry(4, 4, hgt, 16, 1, true), new T.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.1, metalness: 0.5, transparent: true, opacity: 0.28, side: T.DoubleSide, depthWrite: false }));
    glass.position.set(L.x, f + hgt / 2, L.z); G.add(glass);
    const cab = new T.Mesh(new T.BoxGeometry(5, 4, 5), M.lit); cab.position.set(L.x, f + 2, L.z); G.add(cab); AERIS.liftCab = cab;
    const LS = new Building(L.x, L.z, 9, 9, hgt + 2, { mesh: new T.Group(), hp: 1e9 }); LS.cover = true; BUILDINGS.push(LS);
    addLight(L.x, top + 10, L.z, 2.6, 2.6, 3.2, 8); }
  AERIS.bunker = G;
})();

/* ---------- THE AERIS UNDERPASS: the road tunnel under downtown, from the bunker hall to the north portal ----------
   A rock shell over the cut carries the mesa's surface (and a walkable roof strip) over the road; inside, clad walls,
   strip lights, and traffic running both ways. */
(function underpass() {
  const U = UNDERPASS, zA = U.faceN, zB = BUNKER.back, W = U.x1 - U.x0, M = { rock: std(0x5a4636, 0.95, 0.05, { normalMap: TEX.armor.normal }), conc: std(0x77797c, 0.85, 0.08), lit: basic(new T.Color(3, 2.6, 1.8)), steel: std(0x2c3034, 0.5, 0.75), sign: basic(new T.Color(0.4, 1.8, 3)) };
  const G = new T.Group(); G.name = 'underpass'; scene.add(G);
  { const NX = 6, NZ = Math.round((zB - zA) / 5), P = [], I = [], sx = W / NX, sz = (zB - zA) / NZ;
    const topY = (x, z) => Math.max(U.ceil + 3, rawH(x, z, true));
    const v = (x, y, z) => (P.push(x, y, z), P.length / 3 - 1), quad = (a2, b2, c2, d2) => I.push(a2, b2, c2, a2, c2, d2), T0 = [];
    for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const x = U.x0 + i * sx, z = zA + j * sz; T0.push(v(x, topY(x, z), z)); }
    const t = (i, j) => T0[j * (NX + 1) + i];
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) quad(t(i, j), t(i, j + 1), t(i + 1, j + 1), t(i + 1, j));
    for (let i = 0; i < NX; i++) { const x0 = U.x0 + i * sx, a2 = v(x0, U.ceil, zA), b2 = v(x0 + sx, U.ceil, zA); quad(b2, a2, t(i, 0), t(i + 1, 0)); } /* the north face over the portal */
    { const a2 = v(U.x0, U.ceil, zA), b2 = v(U.x1, U.ceil, zA), c2 = v(U.x1, U.ceil, zB), d2 = v(U.x0, U.ceil, zB); quad(a2, b2, c2, d2); } /* the tunnel's ceiling */
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
    const mesh = new T.Mesh(g, M.rock); mesh.receiveShadow = true; mesh.castShadow = true; G.add(mesh);
    for (let z = zA; z < zB; z += 40) { const z1 = Math.min(zB, z + 40); let top = U.ceil + 3; for (let q = z; q <= z1; q += 5) top = Math.max(top, topY(U.x0 + W / 2, q)); const R0 = new Building(U.x0 + W / 2, (z + z1) / 2, W, z1 - z, top - U.ceil, { mesh: new T.Group(), hp: 1e9 }); R0.cover = true; R0.gy = U.ceil; R0.top = top; R0.h = top - U.ceil; BUILDINGS.push(R0); }
    DECKS.push({ x: U.x0 + W / 2, z: zA + 42, x2: U.x0 + W / 2, z2: zB - 12, y: MESA.top, r: W / 2 + 1 }); /* downtown's surface runs on over the roof */ }
  { const b = bucket(), f = U.floor, h = U.ceil - f;
    for (const s of [-1, 1]) { /* solid side walls in front of the rough terrain cut, so nothing walks or drives up into it */
      const xi = s < 0 ? U.x0 : U.x1 - 5.6; for (let z = U.zN; z < zB; z += 40) { const z1 = Math.min(zB, z + 40); let tp = U.ceil + 1; if (z < zA + 4) for (let q = z; q <= z1; q += 4) tp = Math.max(tp, rawH(xi + 2.8, q, true)); const Wc = new Building(xi + 2.8, (z + z1) / 2, 5.6, z1 - z, tp - f + 1, { mesh: new T.Group(), hp: 1e9 }); Wc.cover = true; Wc.gy = f - 1; Wc.top = tp; BUILDINGS.push(Wc); }
      const x = s < 0 ? U.x0 + 5.4 : U.x1 - 5.4; b.add('conc', new T.BoxGeometry(0.8, h, zB - zA).translate(x, f + h / 2, (zA + zB) / 2)); for (let z = zA + 6; z < zB; z += 12) b.add('lit', new T.BoxGeometry(0.3, 0.5, 4).translate(x - s * 0.5, f + 4, z)); }
    for (let z = zA + 4; z < zB; z += 10) b.add('lit', new T.BoxGeometry(10, 0.25, 1.2).translate(U.x0 + W / 2, U.ceil - 0.3, z));
    /* the north portal: frame, lamps and the name */
    const zf = zA - 0.5; for (const s of [-1, 1]) { b.add('steel', new T.BoxGeometry(3, h + 2, 3).translate(U.x0 + W / 2 + s * (W / 2 + 1), f + h / 2, zf)); b.add('lit', new T.BoxGeometry(1, 1, 0.6).translate(U.x0 + W / 2 + s * (W / 2 + 1), U.ceil + 2, zf - 1.6)); }
    b.add('steel', new T.BoxGeometry(W + 6, 3, 3).translate(U.x0 + W / 2, U.ceil + 0.5, zf));
    const g = new T.Group(); bakeInto(g, b, M, ['steel']); G.add(g);
    const sign = new T.Mesh(new T.PlaneGeometry(20, 2.6), new T.MeshBasicMaterial({ side: T.DoubleSide, map: canvasTex(256, 34, (c, w, h2) => { c.fillStyle = '#06121c'; c.fillRect(0, 0, w, h2); c.fillStyle = '#bfe8ff'; c.font = '800 20px sans-serif'; c.textAlign = 'center'; c.fillText('AERIS UNDERPASS', w / 2, 24); }) }));
    sign.position.set(U.x0 + W / 2, U.ceil + 0.6, zf - 1.6); sign.rotation.y = Math.PI; G.add(sign); }
  /* traffic: cars both ways along the highway through the mesa */
  const path = new T.CatmullRomCurve3([[30, 345], [30, 300], [30, 230], [30, 100], [30, -60], [31, -180], [36, -224], [40, -260], [40, -310]].map(([x, z]) => new V3(x, 0, z)));
  const carG = mergeGeos([new T.BoxGeometry(2, 1.1, 4.4).translate(0, 0.75, 0), new T.BoxGeometry(1.7, 0.7, 2.2).translate(0, 1.6, -0.2)]), cols = [0xc23a2a, 0xe8e6df, 0x2a4a7a, 0x1a1c20, 0xd8a01a, 0x3a6a3a];
  const head = new T.BoxGeometry(1.6, 0.25, 0.1), headM = basic(new T.Color(3, 2.8, 2.2)), tailM = basic(new T.Color(3, 0.3, 0.2));
  AERIS.traffic = { path, L: path.getLength(), cars: [] };
  for (let i = 0; i < (LOW_END ? 6 : 10); i++) { const m = new T.Mesh(carG, std(cols[i % cols.length], 0.35, 0.6)); const hl = new T.Mesh(head, headM); hl.position.set(0, 0.8, 2.25); m.add(hl); const tl = new T.Mesh(head, tailM); tl.position.set(0, 0.85, -2.25); m.add(tl); m.castShadow = true; G.add(m);
    AERIS.traffic.cars.push({ m, u: i / (LOW_END ? 6 : 10), dir: i % 2 ? 1 : -1, sp: rand(15, 21) }); }
})();

/* ---------- the underwater glass tunnels: subway, water lane and walkway, from the bunker under the sea ----------
   From the bottom of the bunker's ramp a glass tube runs south under the forecourt and the shore, out under the sea,
   and splits: east to a station on the shore by the Floating Marina's causeway, west to a station on the
   archipelago. Inside each tube: twin rails with a shuttle train, a water lane with boats, and a walkway down the
   middle. transit.js puts troops on the trains. */
(function glassTunnels() {
  const rp = BUNKER.ramp, P0 = new V3((rp.x0 + rp.x1) / 2, BUNKER.floor + 4.7, rp.z0 + 2);
  const shore = (x, z) => new V3(x, Math.max(0.5, H(x, z)) + 4, z);
  const J = new V3(100, -6, 438), Ms = shore(258, 408), Is = shore(-70, 520);
  const trunk = [P0, new V3(60, BUNKER.floor + 4.5, 262), new V3(60, -7, 296), new V3(58, -13, 340), new V3(80, -12, 400), J]; /* across the bunker's lower floor in plain sight, then deep under the forecourt and the towers' point */
  const east = [J, new V3(160, -4.6, 464), new V3(222, -4.6, 454), new V3(250, -3, 430), Ms]; /* just under the sea: the glass top breaks the surface */
  const west = [J, new V3(40, -4.6, 472), new V3(-18, -4.6, 506), new V3(-56, -3, 517), Is];
  const C1 = new T.CatmullRomCurve3([...trunk, ...east.slice(1)]), C2 = new T.CatmullRomCurve3([...trunk, ...west.slice(1)]);
  const glassM = new T.MeshStandardMaterial({ color: 0x8fe6ff, emissive: 0x1a6a8a, emissiveIntensity: 0.6, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.32, side: T.DoubleSide, depthWrite: false });
  const ribM = basic(new T.Color(0.6, 2.2, 3)), railM = std(0x3a3e44, 0.4, 0.8), walkM = std(0x6a7078, 0.8, 0.2);
  const waterTex = canvasTex(32, 64, (c, w, h) => { c.fillStyle = '#1c6a8c'; c.fillRect(0, 0, w, h); for (let i = 0; i < 24; i++) { c.fillStyle = 'rgba(180,240,255,.5)'; c.fillRect(Math.random() * w, Math.random() * h, 2, 6 + Math.random() * 10); } }); waterTex.wrapT = T.RepeatWrapping;
  const waterM = new T.MeshBasicMaterial({ map: waterTex, color: new T.Color(0.7, 1.4, 1.8) });
  const G = new T.Group(); G.name = 'tunnels'; scene.add(G);
  const frame = (curve, u, out, lat) => { curve.getPointAt(u, out); const tg = curve.getTangentAt(u); lat.set(tg.z, 0, -tg.x).normalize(); return tg; };
  const _p = new V3(), _l = new V3();
  const ribbon = (curve, off, w, dy, n) => { const pos = [], uv = [], idx = []; let dist = 0, prev = null;
    for (let i = 0; i <= n; i++) { const u = i / n; frame(curve, u, _p, _l); if (prev) dist += _p.distanceTo(prev); prev = _p.clone();
      for (const s of [-1, 1]) { pos.push(_p.x + _l.x * (off + s * w / 2), _p.y + dy, _p.z + _l.z * (off + s * w / 2)); uv.push(s < 0 ? 0 : 1, dist / 8); }
      if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; };
  const segs = [new T.CatmullRomCurve3(trunk), new T.CatmullRomCurve3(east), new T.CatmullRomCurve3(west)];
  for (const c of segs) { const n = Math.ceil(c.getLength() / 6);
    const tube = new T.Mesh(new T.TubeGeometry(c, n, 6.5, 12, false), glassM); tube.renderOrder = 3; G.add(tube);
    for (const off of [-6.2, 6.2]) G.add(new T.Mesh(ribbon(c, off, 0.35, 1.5, n), ribM)); /* light strips along the walls */
    G.add(new T.Mesh(ribbon(c, -2.6, 3.4, -4.6, n), walkM.clone())); /* the trackbed */
    for (const off of [-3.6, -1.6]) G.add(new T.Mesh(ribbon(c, off, 0.25, -4.3, n), railM));
    G.add(new T.Mesh(ribbon(c, 0.8, 2.2, -4.5, n), walkM)); /* the walkway */
    G.add(new T.Mesh(ribbon(c, 3.6, 3, -4.7, n), waterM)); } /* the water lane */
  /* stations: a glass pavilion at each shore end */
  const st = bucket(); for (const S of [Ms, Is]) { st.add('steel', new T.BoxGeometry(16, 0.6, 12).translate(S.x, S.y - 4, S.z)); st.add('steel', new T.BoxGeometry(16, 0.5, 12).translate(S.x, S.y + 3.5, S.z)); for (const [dx, dz] of [[-7.5, -5.5], [7.5, -5.5], [-7.5, 5.5], [7.5, 5.5]]) st.add('steel', new T.BoxGeometry(0.5, 7.5, 0.5).translate(S.x + dx, S.y - 0.2, S.z + dz)); st.add('screen', new T.BoxGeometry(16.2, 0.25, 0.4).translate(S.x, S.y + 3.2, S.z + 6)); }
  { const g = new T.Group(); bakeInto(g, st, { steel: std(0x3a3e44, 0.4, 0.7), screen: ribM }); G.add(g); }
  /* the shuttles and the boats */
  const carG = mergeGeos([new T.BoxGeometry(2.6, 2.8, 11).translate(0, 1.4, 0), new T.BoxGeometry(2.7, 0.7, 10.6).translate(0, 2, 0)]), carM = std(0xdfe4ea, 0.4, 0.5, { emissive: 0x2a5a7a, emissiveIntensity: 0.5 });
  const boatG = mergeGeos([new T.BoxGeometry(1.8, 0.8, 5.5).translate(0, 0.4, 0), new T.BoxGeometry(1.2, 0.9, 1.6).translate(0, 1.2, -0.6)]), boatM = std(0x3a4a5a, 0.6, 0.4);
  const trains = [C1, C2].map((curve, k) => ({ curve, L: curve.getLength(), u: k * 0.5, dir: 1, wait: 0, cars: [0, 1, 2].map(() => { const m = new T.Mesh(carG, carM); G.add(m); return m; }) }));
  const boats = [0, 0.33, 0.66].map(u0 => ({ curve: u0 < 0.5 ? C1 : C2, L: (u0 < 0.5 ? C1 : C2).getLength(), u: u0, m: (() => { const m = new T.Mesh(boatG, boatM); G.add(m); return m; })() }));
  AERIS.tun = { C1, C2, P0, Ms, Is, J, trains, boats, waterTex, frame };
})();

/* ---------- THE MESA FALLS: water over the south-east cliff of downtown's mesa ----------
   A spillway across the mesa top, a curtain of water draped down the cliff face into the plunge pool, mist at the
   foot. The stream to the sea is cut in the terrain (core.js). */
(function mesaFalls() {
  const a = FALLS.a, ux = Math.cos(a), uz = Math.sin(a), tx = -uz, tz = ux, wTop = 13, N = 40, pos = [], uv = [], idx = [];
  let dist = 0, prev = null;
  for (let i = 0; i <= N; i++) { /* from the lip (a spillway on the mesa top) down the cliff to the pool */
    const r = lerp(178, 258, i / N), cx2 = CITYC.x + ux * r, cz2 = CITYC.z + uz * r, w = wTop * (1 + Math.max(0, (r - FALLS.top) / 60) * 0.5);
    const y = r < FALLS.top ? MESA.top + 0.4 : Math.max(0.3, H(cx2, cz2) + 1.1 + Math.min(4, (r - FALLS.top) * 0.08));
    const p = new V3(cx2, y, cz2); if (prev) dist += p.distanceTo(prev); prev = p;
    for (const s of [-1, 1]) { pos.push(cx2 + tx * w * s, y, cz2 + tz * w * s); uv.push(s < 0 ? 0 : 1, dist / 14); }
    if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const tex = AERIS.fallTex.clone(); tex.needsUpdate = true; tex.wrapT = T.RepeatWrapping; AERIS.mesaFallTex = tex;
  const m = new T.Mesh(g, new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.88, depthWrite: false, side: T.DoubleSide })); m.renderOrder = 2; scene.add(m);
  AERIS.spray.push(new V3(FALLS.pool.x, 0.5, FALLS.pool.z), new V3(FALLS.pool.x - ux * 8, 0.5, FALLS.pool.z - uz * 8));
  addLight(FALLS.pool.x, 6, FALLS.pool.z, 1.4, 2.2, 3, 8);
})();
function VOLC_TOP() { return H(VOLCANO.x + 22, VOLCANO.z) + 6; }
const _atP = new V3(), _atL = new V3();
function updateAeris(dt) {
  if (AERIS.fallTex) AERIS.fallTex.offset.y -= dt * 1.4;
  if (AERIS.mesaFallTex) AERIS.mesaFallTex.offset.y -= dt * 1.8;
  if ((AERIS.sprayT = (AERIS.sprayT || 0) - dt) <= 0) { AERIS.sprayT = 0.12; for (const p of AERIS.spray) if (camera.position.distanceToSquared(p) < 90000) FXS.spawn(p.x + rand(-3, 3), p.y, p.z + rand(-3, 3), rand(-2, 2), rand(3, 7), rand(-2, 2), rand(2, 4), 2, 6, 0.9, 0.95, 1, 0.85, 0.9, 0.95, 0.5, 0.6, -2); }
  if (AERIS.mtn) { /* haze: the mountain takes on the sky's colour, more by night and in weather */
    const k = 0.58 + (typeof WX !== 'undefined' ? WX.k * 0.3 : 0); AERIS.mtn.m.color.copy(AERIS.mtn.base).lerp(FOG, k); }
  if (AERIS.traffic) { const T0 = AERIS.traffic, p = _atP, l = _atL;
    for (const c of T0.cars) { c.u = (c.u + c.dir * c.sp * dt / T0.L + 1) % 1; T0.path.getPointAt(c.u, p); const tg = T0.path.getTangentAt(c.u); l.set(tg.z, 0, -tg.x).normalize();
      const x = p.x + l.x * 2.6 * c.dir, z = p.z + l.z * 2.6 * c.dir, y = inUnderpass(x, z) ? UNDERPASS.floor : Math.max(0.3, H(x, z));
      c.m.position.set(x, y + 0.1, z); c.m.lookAt(x + tg.x * c.dir, y + 0.1, z + tg.z * c.dir); } }
  if (AERIS.liftCab) { const k = (Math.sin(TIME * 0.21) + 1) / 2; AERIS.liftCab.position.y = lerp(BUNKER.floor + 2, MESA.top + 2, k * k * (3 - 2 * k)); }
  if (AERIS.tun) { const T0 = AERIS.tun, p = _atP, l = _atL; T0.waterTex.offset.y -= dt * 0.8;
    for (const tr of T0.trains) { /* shuttle back and forth at 30 m/s, a few seconds at each end */
      if (tr.wait > 0) tr.wait -= dt; else { tr.u += tr.dir * 30 * dt / tr.L; if (tr.u >= 1 || tr.u <= 0) { tr.u = clamp(tr.u, 0, 1); tr.dir *= -1; tr.wait = 5; } }
      tr.cars.forEach((m, i) => { const u = clamp(tr.u - tr.dir * i * 11.5 / tr.L, 0, 1); const tg = T0.frame(tr.curve, u, p, l); m.position.set(p.x - l.x * 2.6, p.y - 4.4, p.z - l.z * 2.6); m.lookAt(m.position.x + tg.x, m.position.y + tg.y, m.position.z + tg.z); }); }
    for (const bt of T0.boats) { bt.u = (bt.u + 9 * dt / bt.L) % 1; const tg = T0.frame(bt.curve, bt.u, p, l); bt.m.position.set(p.x + l.x * 3.6, p.y - 4.6, p.z + l.z * 3.6); bt.m.lookAt(bt.m.position.x + tg.x, bt.m.position.y + tg.y, bt.m.position.z + tg.z); } }
  if (AERIS.dome) { AERIS.domeT += dt; AERIS.dome.material.opacity = 0.65 + Math.sin(AERIS.domeT * 1.7) * 0.2; }
}
{ const _uw = updateWorld; updateWorld = function (dt) { _uw(dt); updateAeris(dt); }; }
