'use strict';
/* ===================== IRON MERIDIAN · tycoon scenery =====================
   The island dressed like a tycoon game's map: every building stands on its own neat plot.
   · a flat pastel plot pad under it, edged with a bright kerb in the plot's own colour;
   · clipped hedges along the front and back, with a gap for the path to the door;
   · round lollipop trees at the corners, each a slightly different green;
   · a pair of lamp posts by the front, lit warm;
   · flower beds either side of the door: red, yellow, pink, violet, orange.
   (The buildings themselves get bright accent colours in layered.js.)
   All of it is seven instanced meshes for the whole island, set out once at load: nothing runs per frame. It is
   scenery only: you walk and shoot through it. Left bare: landmarks, headquarters, anything at the water's edge. */
(function tycoonScenery() {
  const level = b => { const h = H(b.x, b.z), ex = b.w / 2 + 3, ez = b.d / 2 + 3; for (const [a, c] of [[-ex, -ez], [ex, -ez], [-ex, ez], [ex, ez]]) { const q = H(b.x + a, b.z + c); if (Math.abs(q - h) > 1.3 || q < 0.8) return false; } return true; }; /* a plot needs level ground: none on hillsides or at the shore */
  const L = BUILDINGS.filter(b => b.lay && b.alive && H(b.x, b.z) > 1.2 && level(b)), n = L.length; if (!n) return;
  const rnd = (b, k) => layHash(b, 20 + k), col = new T.Color(), q = new T.Quaternion(), s = new V3(), p = new V3(), M = new T.Matrix4(), E = new T.Euler();
  const mk = (geo, mat, count, shadow) => { const m = new T.InstancedMesh(geo, mat, count); m.count = 0; m.frustumCulled = false; m.castShadow = !!shadow; m.receiveShadow = true; scene.add(m); return m; };
  const box = new T.BoxGeometry(1, 1, 1), hbox = rbox(1, 1, 1, 0.3, 3); /* hedges and beds have rounded shoulders */
  const pad = mk(box, std(0x7c7c7c, 0.95, 0), n), kerb = mk(box, basic(0xbdbdbd), n * 4), hedge = mk(hbox, std(0x8a8a8a, 0.9, 0), n * 4, true), bed = mk(hbox, std(0x9a9a9a, 0.85, 0), n * 2); /* greys: they scale the colours down so the sun does not bleach them */
  const lump = (() => { const q = new T.IcosahedronGeometry(1, 2), p = q.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453, k = 1 + (v - Math.floor(v) - 0.5) * 0.3 + Math.sin(x * 4) * Math.sin(z * 4) * 0.1; p.setXYZ(i, x * k, y * k * 0.9, z * k); } return q; })(); /* a clipped but living crown, not a ball */
  const trunk = mk(new T.CylinderGeometry(0.1, 0.24, 1, 8), std(0x6b4a2c, 0.9, 0), n * 4, true), crown = mk(lump, std(0x8a8a8a, 0.85, 0), n * 4, true);
  const pole = mk(new T.CylinderGeometry(0.07, 0.09, 1, 6), std(0x2a2d31, 0.6, 0.6), n * 2), bulb = mk(new T.SphereGeometry(0.26, 8, 6), basic(new T.Color(2.6, 2.1, 1.3)), n * 2);
  const put = (m, x, y, z, sx, sy, sz, hex, ry) => { q.setFromEuler(E.set(0, ry || 0, 0)); M.compose(p.set(x, y, z), q, s.set(sx, sy, sz)); m.setMatrixAt(m.count, M); if (hex !== undefined) m.setColorAt(m.count, col.setHex(hex)); m.count++; };
  const PADS = [0xbfe3b4, 0xb9dcef, 0xf1e2b6, 0xf3c9d2, 0xd6cdf0, 0xc8ecd9], KERB = [0xff5a4a, 0x3d9bff, 0xffc93a, 0x45d06a, 0xff8a2e, 0xa96bff], FLOWERS = [0xe8473f, 0xf2c230, 0xf08ab8, 0x9a62d8, 0xf28a2e], GREENS = [0x4fae4a, 0x3f9a45, 0x62bf52, 0x2f8a4a];
  for (const b of L) {
    const g = H(b.x, b.z), mg = 3, w = b.w + mg * 2, d = b.d + mg * 2, k = (rnd(b, 0) * 6) | 0, x0 = b.x - w / 2, x1 = b.x + w / 2, z0 = b.z - d / 2, z1 = b.z + d / 2;
    put(pad, b.x, g + 0.07, b.z, w, 0.14, d, PADS[(rnd(b, 1) * 6) | 0]);
    put(kerb, b.x, g + 0.16, z0, w + 0.3, 0.2, 0.3, KERB[k]); put(kerb, b.x, g + 0.16, z1, w + 0.3, 0.2, 0.3, KERB[k]); put(kerb, x0, g + 0.16, b.z, 0.3, 0.2, d, KERB[k]); put(kerb, x1, g + 0.16, b.z, 0.3, 0.2, d, KERB[k]);
    const hw = (w - 5) / 2 - 1.2; /* hedges: front and back, a 5 m gap in the middle for the path */
    if (hw > 1.5) for (const z of [z0 + 0.9, z1 - 0.9]) for (const e of [-1, 1]) put(hedge, b.x + e * (2.5 + hw / 2), g + 0.55, z, hw, 0.9, 0.8, 0x2f7d3a);
    for (const e of [-1, 1]) put(bed, b.x + e * 2.2, g + 0.3, z1 - 2, 1.6, 0.36, 1.1, FLOWERS[(rnd(b, 2 + e) * 5) | 0]);
    let t = 0; for (const [cx, cz] of [[x0 + 1.1, z0 + 1.1], [x1 - 1.1, z0 + 1.1], [x0 + 1.1, z1 - 1.1], [x1 - 1.1, z1 - 1.1]]) { const r = 1.1 + rnd(b, 6 + t) * 0.7, th = 1.6 + rnd(b, 10 + t) * 1.2; t++;
      put(trunk, cx, g + th / 2, cz, 1, th, 1); put(crown, cx, g + th + r * 0.7, cz, r, r, r, GREENS[(rnd(b, 14 + t) * 4) | 0], rnd(b, 18 + t) * 6); }
    for (const e of [-1, 1]) { put(pole, b.x + e * 3.4, g + 1.7, z1 + 0.1, 1, 3.4, 1); put(bulb, b.x + e * 3.4, g + 3.5, z1 + 0.1, 1, 1, 1); }
  }
  for (const m of [pad, kerb, hedge, bed, trunk, crown, pole, bulb]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
})();

/* ===================== tycoon scenery, part two: the land between the plots =====================
   Five rules of a good tycoon map, applied to the whole island:
   1 BREAK UP FLAT TERRAIN   low grassy mounds and rock outcrops wherever the ground runs level
   2 LAYER THE VEGETATION    every grove is three storeys: grass tufts, then bushes, then trees (round and conifer,
                             each with a two-part crown); meadows are tufts and flowers; scrub is bushes and stone
   3 MIX SURFACE TEXTURES    irregular patches of dirt, gravel, sand, lush and meadow green laid over the grass, so no
                             stretch of ground is one colour; which patch goes where follows broad bands, not dice
   4 DETAIL THE PATHS        the roads get edging stones both sides, and benches, bins and planters along the verges
   5 FILL DEAD SPACE         every 16 m square of open land that has no building, road, deck or cliff in it gets
                             something: a grove, a meadow, a scrub patch or a bare outcrop with a fallen log
   Everything is baked at load into sixteen static meshes (a 4 by 4 grid of map tiles, vertex-coloured, one draw call
   each), drawn only when the tile is on screen and within 520 m. Nothing runs per frame but that check, twice a
   second. It is scenery: you walk and shoot through it. */
const SCN = { tiles: [], t: 0, N: 4 };
(function tycoonLand() {
  const N = SCN.N, TS = BOUND * 2 / N, acc = []; for (let i = 0; i < N * N; i++) acc.push({ P: [], Nn: [], C: [], I: [] });
  const tmpl = g => { const gi = g.index ? g : g; if (!gi.attributes.normal) gi.computeVertexNormals(); return { p: gi.attributes.position.array, n: gi.attributes.normal.array, i: gi.index ? gi.index.array : null, c: gi.attributes.position.count }; };
  /* shapes with triangles in them, not boxes: foliage is a smooth-shaded, lumpy ball (every one pushed out of round differently); rocks are faceted and knocked out of true; grass is blades; trunks taper; conifers droop */
  const blades = (() => { const P = []; for (let k = 0; k < 6; k++) { const a = k * 1.05 + 0.3, r = 0.12 + (k % 3) * 0.1, bx = Math.cos(a) * r, bz = Math.sin(a) * r, w = 0.07, lean = 0.25 + (k % 2) * 0.2, hgt = 0.7 + (k % 3) * 0.15; P.push(bx - Math.sin(a) * w, 0, bz + Math.cos(a) * w, bx + Math.sin(a) * w, 0, bz - Math.cos(a) * w, bx + Math.cos(a) * lean, hgt, bz + Math.sin(a) * lean); }
    const q = new T.BufferGeometry(); q.setAttribute('position', new T.Float32BufferAttribute(P, 3)); const Nn = []; for (let k = 0; k < P.length / 3; k++) Nn.push(0, 1, 0); q.setAttribute('normal', new T.Float32BufferAttribute(Nn, 3)); return q; })();
  const soft = g => { const t = tmpl(g); t.n = new Float32Array(t.p.length); for (let i = 0; i < t.p.length; i += 3) { const l = Math.hypot(t.p[i], t.p[i + 1], t.p[i + 2]) || 1; t.n[i] = t.p[i] / l; t.n[i + 1] = t.p[i + 1] / l; t.n[i + 2] = t.p[i + 2] / l; } t.jit = 0.42; return t; };
  const droop = (() => { const q = new T.ConeGeometry(1, 1, 8, 1, true).translate(0, 0.5, 0), p = q.attributes.position; for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getZ(i)); if (r > 0.9) p.setY(i, p.getY(i) - 0.16 * ((i % 2) ? 1 : 0.3)); } q.computeVertexNormals(); return q; })();
  const G = { disc: tmpl(new T.CircleGeometry(1, 12).rotateX(-Math.PI / 2)), mound: tmpl(new T.SphereGeometry(1, 10, 3, 0, Math.PI * 2, 0, Math.PI / 2)), tuft: tmpl(blades), cube: tmpl(new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)),
    blob: soft(new T.IcosahedronGeometry(1, 1)), puff: soft(new T.IcosahedronGeometry(1, 0)), rock: Object.assign(tmpl(new T.IcosahedronGeometry(1, 0)), { jit: 0.5 }), trunk: tmpl(new T.CylinderGeometry(0.32, 0.7, 1, 8).translate(0, 0.5, 0)), cone: tmpl(droop), log: tmpl(new T.CylinderGeometry(0.5, 0.5, 1, 9).rotateZ(Math.PI / 2)) };
  let inst = 0;
  const col = new T.Color(), cy = Math.cos, sy = Math.sin;
  const add = (g, x, y, z, sx, sh, sz, hex, ry = 0, shade = 0) => { /* a template, scaled, turned about the vertical, coloured, into its tile */
    const ti = clamp(((x + BOUND) / TS) | 0, 0, N - 1) + clamp(((z + BOUND) / TS) | 0, 0, N - 1) * N, A = acc[ti], base = A.P.length / 3, c = cy(ry), s = sy(ry); col.setHex(hex).multiplyScalar(0.38 * (1 + shade)); /* halved: the sun and the grade bring them back up to the brightness of the ground round them */
    inst++;
    for (let i = 0; i < g.p.length; i += 3) { let k = 1; if (g.jit) { const v = Math.sin(g.p[i] * 12.9898 + g.p[i + 1] * 78.233 + g.p[i + 2] * 37.719 + inst * 3.17) * 43758.5453; k = 1 + (v - Math.floor(v) - 0.5) * g.jit; } /* the same corner always moves the same way, so the surface stays closed */
      const px = g.p[i] * sx * k, py = g.p[i + 1] * sh * k, pz = g.p[i + 2] * sz * k, nx = g.n[i] / sx, ny = g.n[i + 1] / sh, nz = g.n[i + 2] / sz, nl = Math.hypot(nx, ny, nz) || 1;
      A.P.push(x + px * c + pz * s, y + py, z - px * s + pz * c); A.Nn.push((nx * c + nz * s) / nl, ny / nl, (-nx * s + nz * c) / nl); A.C.push(col.r, col.g, col.b); }
    if (g.i) for (let i = 0; i < g.i.length; i++) A.I.push(base + g.i[i]); else for (let i = 0; i < g.c; i++) A.I.push(base + i);
  };
  let seed = 9173; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }, rr = (a, b) => a + rnd() * (b - a), pk = L => L[(rnd() * L.length) | 0];
  /* where not to put things: in or beside a building, on or beside a road, under a deck or platform, on water or a steep slope */
  const RC = 8, road = new Set(), rk = (x, z) => Math.round(x / RC) * 4096 + Math.round(z / RC);
  for (const r of ROADS) for (const p of r.pts) for (let a = -1; a <= 1; a++) for (let b2 = -1; b2 <= 1; b2++) road.add(rk(p.x + a * RC, p.z + b2 * RC));
  const BL = BUILDINGS.filter(b => b.alive && !b.realmBlock), inB = (x, z, m) => { for (const b of BL) if (x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m) return true; return false; };
  const ok = (x, z, m) => { const h = H(x, z); if (h < 1.6 || Math.abs(H(x + 3, z) - h) > 1.1 || Math.abs(H(x, z + 3) - h) > 1.1) return false; if (road.has(rk(x, z)) || inB(x, z, m)) return false; if (deckAt(x, z, h + 40) || surfY(x, z, h + 30) > h + 0.6) return false; for (const t of ARMIES) if (Math.hypot(x - HQ[t].x, z - HQ[t].z) < 45) return false; return true; };
  const band = (x, z) => Math.sin(x * 0.011 + 1.3) + Math.sin(z * 0.013 - 0.7) + Math.sin((x + z) * 0.007) * 0.8; /* broad bands across the island decide what grows where */
  const GRASS = [0x5aa84a, 0x4c9a45, 0x68b552, 0x3f8c44], LEAF = [0x3f9a45, 0x2f8a4a, 0x4fae4a, 0x5cb85a, 0x2c7a40], PINE = [0x2a6e45, 0x256540, 0x33784a], STONE = [0x8d8f93, 0x7a7c80, 0xa0a09a], BLOOM = [0xe8473f, 0xf2c230, 0xf08ab8, 0x9a62d8, 0xffffff, 0xf28a2e];
  const tree = (x, y, z) => { const conifer = band(x * 1.7, z * 1.7) > 0.4 ? rnd() < 0.75 : rnd() < 0.2, th = rr(1.6, 3), ry = rnd() * 6;
    add(G.trunk, x, y, z, 0.42, th, 0.42, 0x6b4a2c, ry);
    if (conifer) { const r = rr(1.5, 2.2), c = pk(PINE); add(G.cone, x, y + th * 0.6, z, r, r * 1.3, r, c, ry); add(G.cone, x, y + th * 0.6 + r * 0.85, z, r * 0.74, r * 1.25, r * 0.74, c, ry + 0.5, 0.08); add(G.cone, x, y + th * 0.6 + r * 1.65, z, r * 0.46, r * 1.2, r * 0.46, c, ry + 1.1, 0.16); } /* three drooping tiers */
    else { const r = rr(1.5, 2.4), c = pk(LEAF); add(G.blob, x, y + th + r * 0.6, z, r, r * 0.85, r, c, ry); add(G.puff, x + r * 0.5, y + th + r * 1.1, z - r * 0.3, r * 0.62, r * 0.55, r * 0.62, c, ry + 1, 0.14); add(G.puff, x - r * 0.55, y + th + r * 0.75, z + r * 0.35, r * 0.6, r * 0.5, r * 0.6, c, ry + 2, -0.1);
      add(G.trunk, x + 0.2, y + th * 0.8, z, 0.14, r * 0.9, 0.14, 0x6b4a2c, ry, 0); } }; /* a canopy of three masses and a limb showing between them */
  const bush = (x, y, z) => { const r = rr(0.6, 1.1); add(G.puff, x, y + r * 0.45, z, r, r * 0.7, r, pk(LEAF), rnd() * 6, -0.08); };
  const tuft = (x, y, z) => add(G.tuft, x, y, z, rr(1, 1.7), rr(0.8, 1.5), rr(1, 1.7), pk(GRASS), rnd() * 6, 0.1);
  const rock = (x, y, z, k = 1) => { const r = rr(0.5, 1.2) * k; add(G.rock, x, y + r * 0.25, z, r, r * rr(0.5, 0.8), r * rr(0.7, 1.1), pk(STONE), rnd() * 6); };
  const flower = (x, y, z) => { add(G.cube, x, y, z, 0.06, 0.4, 0.06, 0x3f8c44); add(G.cube, x, y + 0.36, z, 0.26, 0.16, 0.26, pk(BLOOM), rnd() * 3); };
  const near = (x, z, r, f, n) => { for (let i = 0; i < n; i++) { const a = rnd() * 6.283, q = Math.sqrt(rnd()) * r, px = x + cy(a) * q, pz = z + sy(a) * q, h = H(px, pz); if (h > 1.4) f(px, h, pz); } };
  const CS = 16;
  for (let gz = -BOUND + CS; gz < BOUND - CS; gz += CS) for (let gx = -BOUND + CS; gx < BOUND - CS; gx += CS) {
    const x = gx + rr(-5, 5), z = gz + rr(-5, 5); if (rnd() < 0.3 || !ok(x, z, 7)) continue;
    const y = H(x, z), bd = band(x, z) + rr(-0.5, 0.5), r = rr(4, 7.5), flat = Math.abs(H(x + 6, z) - y) < 0.5 && Math.abs(H(x, z + 6) - y) < 0.5, ry = rnd() * 6, sq = rr(0.6, 1);
    if (bd > 0.9) { /* grove: three layers */ add(G.disc, x, y + 0.09, z, r, 1, r * sq, 0x3a8540, ry); near(x, z, r * 0.55, tree, rnd() < 0.5 ? 2 : 1); near(x, z, r * 0.8, bush, 2); near(x, z, r, tuft, 4); if (rnd() < 0.3) { const h = H(x + 2, z + 2); add(G.log, x + 2, h + 0.3, z + 2, rr(1.6, 2.6), 0.55, 0.55, 0x7a5632, rnd() * 3); } }
    else if (bd > 0.1) { /* meadow */ add(G.disc, x, y + 0.09, z, r, 1, r * sq, pk([0x74bd5a, 0x86c764, 0x6ab455]), ry); near(x, z, r * 0.9, tuft, 5); near(x, z, r * 0.8, flower, 5); if (rnd() < 0.35) near(x, z, r * 0.5, bush, 1); }
    else if (bd > -0.8) { /* scrub on gravel or dirt */ add(G.disc, x, y + 0.09, z, r, 1, r * sq, pk([0x9b9a92, 0x8a6f4a, 0x97815c]), ry); near(x, z, r * 0.7, bush, 2); near(x, z, r * 0.8, rock, 2); near(x, z, r, tuft, 3); }
    else { /* bare outcrop on sand or dirt */ add(G.disc, x, y + 0.09, z, r, 1, r * sq, pk([0xd6c389, 0x8a6f4a, 0xc2ad78]), ry); near(x, z, r * 0.4, (a, h, c) => rock(a, h, c, 1.7), 1); near(x, z, r * 0.8, rock, 2); near(x, z, r, tuft, 2); }
    if (flat && rnd() < 0.45) { const mx = x + rr(-6, 6), mz = z + rr(-6, 6), mr = rr(3.5, 6.5); if (ok(mx, mz, 9)) { add(G.mound, mx, H(mx, mz) - 0.05, mz, mr, rr(0.35, 0.6), mr * rr(0.7, 1), pk(GRASS), rnd() * 6, -0.06); near(mx, mz, mr * 0.5, tuft, 2); if (rnd() < 0.5) near(mx, mz, mr * 0.3, rock, 1); } }
  }
  /* the roads: edging stones both sides, and something on the verge every so often */
  for (const R of ROADS) { let run = 0, kerb = 0, n = 0;
    for (let i = 1; i < R.pts.length; i++) { const a = R.pts[i - 1], b = R.pts[i], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L, ya = Math.atan2(dx, dz); run += L; kerb += L;
      if (kerb >= 5) { kerb = 0; for (const s of [-1, 1]) { const x = b.x + nx * 4.5 * s, z = b.z + nz * 4.5 * s, h = H(x, z); if (h > 1.2 && Math.abs(h - b.y) < 1 && !inB(x, z, 0.5)) add(G.cube, x, h, z, 0.34, 0.22, 1.5, 0xcfcac0, ya); } }
      if (run >= 34) { run = 0; n++; const s = n & 1 ? 1 : -1, x = b.x + nx * 6.3 * s, z = b.z + nz * 6.3 * s, h = H(x, z); if (h < 1.4 || Math.abs(h - b.y) > 1 || inB(x, z, 1.5)) continue;
        if (n % 3 === 0) { add(G.cube, x, h + 0.42, z, 0.55, 0.1, 2, 0x9a6b3f, ya); add(G.cube, x - nx * 0.3 * s * -1, h + 0.5, z - nz * 0.3 * s * -1, 0.1, 0.5, 2, 0x9a6b3f, ya); for (const e of [-0.8, 0.8]) add(G.cube, x + sy(ya) * e, h, z + cy(ya) * e, 0.5, 0.42, 0.1, 0x2a2d31, ya); } /* a bench facing the road */
        else if (n % 3 === 1) { add(G.cube, x, h, z, 1.5, 0.55, 1.5, 0xb9b2a4, ya); add(G.puff, x, h + 0.95, z, 0.8, 0.6, 0.8, pk(LEAF), ya); for (let k = 0; k < 3; k++) flower(x + rr(-0.5, 0.5), h + 0.55, z + rr(-0.5, 0.5)); } /* a planter */
        else { add(G.cube, x, h, z, 0.5, 0.9, 0.5, 0x2f6f73, ya); add(G.cube, x, h + 0.9, z, 0.56, 0.08, 0.56, 0x24272b, ya); tuft(x + 1, H(x + 1, z), z); } } } } /* a bin */
  const mat = std(0xffffff, 0.9, 0.02, { vertexColors: true, side: T.DoubleSide }); let tris = 0; /* double-sided for the grass blades */
  for (let i = 0; i < N * N; i++) { const A = acc[i]; if (!A.P.length) continue; const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(A.P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(A.Nn, 3)); g.setAttribute('color', new T.Float32BufferAttribute(A.C, 3)); g.setIndex(A.I); g.computeBoundingSphere();
    const m = new T.Mesh(g, mat); m.receiveShadow = true; scene.add(m); SCN.tiles.push({ m, c: g.boundingSphere.center.clone(), r: g.boundingSphere.radius }); tris += A.I.length / 3; }
  SCN.tris = tris;
  const _uw = updateWorld; updateWorld = function (dt) { _uw(dt); if ((SCN.t -= dt) > 0) return; SCN.t = 0.5; const c = camera.position; for (const t of SCN.tiles) t.m.visible = c.distanceTo(t.c) < t.r + 520; };
})();
