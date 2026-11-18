'use strict';
/* ===================== IRON MERIDIAN · Guild Works: live robot construction in the middle of the battle ===================== */
// Wherever the one big battle is, the Builder Guild opens a live worksite on your squad's side of it, themed to the
// realm, and raises cover while the fight goes on around it:
//  · LAND  · HESCO lines, T-walls, sandbag bunkers and gun towers; tower crane and cement mixer in the yard
//  · OCEAN · steel bulwarks, riveted plate walls, casemates and mast towers on the marina deck; crane swinging
//  · AIR   · composite barriers, emitter walls, radar bunkers and AA towers on the Aerie deck; lift drones
//  · SPACE · hull-armour blocks, bulkheads, pressure pods and antenna towers on Zenith Station; cargo pods
// The site is a small economy you can watch: drones fly materials to the yard, haulers carry them to the piece being
// built, welders raise it inside a holographic blueprint, the foreman runs the board and the crane swings loads.
// Cause and effect:
//  · your squad close by → faster building, and the towers only go up while you cover them
//  · the enemy close and your squad not → the crew goes to ground behind what it has built and stops
//  · enemies near the works shoot at the drones, the robots and the half-built pieces; your troops turn on them
//  · shells landing near → hasty mode (front walls first), robots dive for cover, some die; the foreman calls in
//    replacements while the crew budget lasts; a drone shot down loses its load; an empty yard stops the work
//  · storms: they shelter; night: floodlights
//  · a piece destroyed by anyone leaves scorched ground that is never rebuilt this war: less cover to fight from.
//    Tear three down yourself and the Guild abandons the site for the rest of the war.
//  · let them finish every piece and the works become a BASTION: indestructible, it patches up your troops inside,
//    its towers carry ziplines, and it stands for the rest of the war, ready when the battle comes back.
const WS = { sites: {}, cur: null, cargo: null, trash: [] };
const WS_R = {
  land: { title: 'Trench works', main: 0x8a7a5a, trim: 0x33363a, glow: [3.0, 1.8, 0.45], hex: 0xffb347, hpK: 1, rate: 1.15, cargo: 'cargo drone', crane: true },
  sea: { title: 'Marina works', main: 0x5b6872, trim: 0x262c32, glow: [0.35, 2.6, 2.3], hex: 0x3fe0d0, hpK: 1.2, rate: 1, cargo: 'cargo drone', crane: true },
  air: { title: 'Aerie works', main: 0x9aa4ae, trim: 0x55606c, glow: [0.6, 1.8, 3.3], hex: 0x7cc8ff, hpK: 1, rate: 0.9, cargo: 'lift drone', crane: false },
  space: { title: 'Zenith works', main: 0x3c3748, trim: 0x17151d, glow: [2.3, 0.9, 3.4], hex: 0xc79bff, hpK: 1.5, rate: 0.85, cargo: 'cargo pod', crane: false },
};
const WS_T = [null, /* the tiers a slot climbs through: size in local metres (w across, d toward the fight) */
  { n: 'barricade', w: 6, d: 1.4, h: 1.35, hp: 260, cost: 2 },
  { n: 'wall', w: 7, d: 1.6, h: 3.1, hp: 520, cost: 4 },
  { n: 'bunker', w: 6.5, d: 6, h: 3.2, hp: 900, cost: 6 },
  { n: 'tower', w: 4.6, d: 4.6, h: 9.15, hp: 1300, cost: 8 }];
const WS_LAYOUT = [ /* lx (across), lz (toward the fight), path of tiers, core (the bastion) or expansion (built once it stands) */
  [-16, 10, [1, 2], 1], [-8, 11, [1, 2], 1], [0, 11.5, [1, 2], 1], [8, 11, [1, 2], 1], [16, 10, [1, 2], 1],
  [-11, 1, [1, 2, 3], 1], [11, 1, [1, 2, 3], 1], [-19, -8, [1, 2, 4], 1], [19, -8, [1, 2, 4], 1],
  [-25, 3, [1, 2], 0], [25, 3, [1, 2], 0], [-5, 19, [1], 0], [5, 19, [1], 0], [-27, -12, [1, 2, 4], 0], [27, -12, [1, 2, 4], 0], [0, -3, [1, 2, 3], 0]];
const wsTurn = (w, a, dt, k = 9) => { let d = a - w.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); w.yaw += d * Math.min(1, dt * k); }; /* eased turning, never a snap */
const WS_RUB = new T.DodecahedronGeometry(1, 0);
function wsPct(S) { /* the readout is clamped and finite whatever the site does: a part-built piece that gets razed used to be able to make this NaN */
  const live = S.slots.filter(s => !s.dead), all = live.reduce((n, s) => n + s.path.length, 0);
  if (!all) return 0;
  const done = live.reduce((n, s) => n + (s.i || 0) + (s === S.cur && isFinite(s.prog) ? s.prog : 0), 0);
  const p = Math.round(done / all * 100); return isFinite(p) ? clamp(p, 0, 100) : 0; }
const WS_STEP = 4.5, WS_CREW = 6, WS_YARD = [0, -13];
/* ---------- materials and geometry, cached per realm ---------- */
const WS_M = {}, WS_G = {};
function wsMats(r) {
  if (WS_M[r]) return WS_M[r]; const R = WS_R[r], g = R.glow;
  return (WS_M[r] = { main: std(R.main, r === 'air' ? 0.35 : 0.85, r === 'land' ? 0.05 : 0.6, { normalMap: TEX.armor.normal }), trim: std(R.trim, 0.55, 0.7), glow: basic(new T.Color(g[0], g[1], g[2])), bag: std(0x7a6a4a, 0.95, 0),
    holo: addMat(new T.Color(g[0] * 0.035, g[1] * 0.035, g[2] * 0.035), 1, { side: T.DoubleSide }), edge: new T.LineBasicMaterial({ color: new T.Color(g[0] * 0.4, g[1] * 0.4, g[2] * 0.4), transparent: true, blending: T.AdditiveBlending, depthWrite: false }) });
}
function wsGeo(r, k) {
  const key = r + k; if (WS_G[key]) return WS_G[key];
  const b = bucket(), B = (w, h, d, x, y, z, m = 'main') => b.add(m, new T.BoxGeometry(w, h, d).translate(x, y, z)), bags = (n, x0, dx, y, z) => { for (let i = 0; i < n; i++) b.add('bag', xf(rbox(1.0, 0.3, 0.6, 0.12, 1), [x0 + i * dx, y, z], [0, rand(-0.1, 0.1), 0])); };
  if (k === 1) {
    if (r === 'land') { for (let i = 0; i < 4; i++) { b.add('main', new T.CylinderGeometry(0.72, 0.72, 1.35, 10).translate(-2.25 + i * 1.5, 0.675, 0)); b.add('trim', new T.CylinderGeometry(0.74, 0.74, 0.05, 10, 1, true).translate(-2.25 + i * 1.5, 1.0, 0)); } bags(5, -2.4, 1.2, 1.5, 0); }
    else if (r === 'sea') { B(6, 1.3, 0.35, 0, 0.65, 0.3); B(6, 0.22, 1.4, 0, 0.11, 0, 'trim'); for (const x of [-2.4, 0, 2.4]) B(0.25, 1.2, 0.9, x, 0.6, -0.25, 'trim'); for (const x of [-1.8, -0.6, 0.6, 1.8]) b.add('glow', new T.CylinderGeometry(0.13, 0.13, 0.06, 10).rotateX(Math.PI / 2).translate(x, 0.85, 0.5)); }
    else if (r === 'air') { b.add('main', xf(rbox(6, 1.1, 1.2, 0.3, 2), [0, 0.55, 0])); B(5.8, 0.08, 0.1, 0, 1.12, 0.5, 'glow'); for (const x of [-2.8, 2.8]) { B(0.35, 1.5, 0.35, x, 0.75, 0, 'trim'); B(0.3, 0.12, 0.3, x, 1.56, 0, 'glow'); } }
    else { b.add('main', xf(rbox(6, 1.3, 1.4, 0.3, 2), [0, 0.65, 0])); for (const x of [-2, 0, 2]) B(1.2, 0.08, 0.06, x, 0.9, 0.71, 'glow'); B(6.1, 0.12, 1.5, 0, 1.3, 0, 'trim'); }
  } else if (k === 2) {
    B(7, 0.5, 1.6, 0, 0.25, 0, 'trim'); /* footer */
    if (r === 'land') { for (const x of [-2.35, 0, 2.35]) B(2.28, 2.6, 0.7, x, 1.8, 0); bags(6, -2.9, 1.16, 3.25, 0); for (const x of [-2.35, 2.35]) B(1.4, 0.25, 0.74, x, 2.35, 0, 'trim'); }
    else {
      B(7, 2.6, 0.8, 0, 1.8, 0); B(7.1, 0.2, 1.0, 0, 3.1, 0, 'trim'); for (const x of [-2.4, 2.4]) B(1.5, 0.22, 0.84, x, 2.3, 0, 'trim'); /* firing slits */
      if (r === 'sea') { for (let i = 0; i < 6; i++) B(0.18, 2.5, 0.12, -3 + i * 1.2, 1.8, 0.44, 'trim'); B(6.6, 0.1, 0.1, 0, 0.75, 0.46, 'glow'); }
      if (r === 'air') { B(6.8, 0.12, 0.12, 0, 3.0, 0.45, 'glow'); for (const x of [-3.3, 3.3]) { B(0.4, 3.4, 0.6, x, 1.7, 0, 'trim'); B(0.3, 0.3, 0.3, x, 3.55, 0, 'glow'); } }
      if (r === 'space') { for (let i = 0; i < 4; i++) b.add('glow', new T.BoxGeometry(1.1, 0.1, 0.06).rotateZ(i % 2 ? 0.5 : -0.5).translate(-2.6 + i * 1.75, 1.4, 0.43)); B(7, 0.35, 0.3, 0, 0.75, 0.45, 'trim'); }
    }
    for (const x of [-2.6, 2.6]) B(0.6, 2.2, 0.7, x, 1.4, -0.75); /* buttresses on the friendly side */
  } else if (k === 3) {
    b.add('main', xf(rbox(6.5, 2.75, 6, 0.3, 2), [0, 1.375, 0])); B(6.9, 0.3, 6.4, 0, 2.9, 0, 'trim');
    for (const [w, d, x, z] of [[6.9, 0.35, 0, 3.0], [6.9, 0.35, 0, -3.0], [0.35, 6.4, 3.3, 0], [0.35, 6.4, -3.3, 0]]) B(w, 0.55, d, x, 3.3, z); /* roof parapet */
    B(4.2, 0.3, 0.12, 0, 2.0, 3.02, 'trim'); B(1.4, 2.0, 0.12, 0, 1.0, -3.02, 'trim'); B(0.5, 0.16, 0.1, 0, 2.15, -3.08, 'glow'); /* slit, door, door lamp */
    if (r === 'land') { bags(6, -2.9, 1.16, 0.15, 3.4); bags(5, -2.3, 1.16, 0.45, 3.4); }
    if (r === 'sea') { b.add('trim', new T.CylinderGeometry(0.2, 0.24, 2.6, 8).rotateX(Math.PI / 2).translate(1.6, 2.0, 4.1)); B(6.6, 0.12, 0.1, 0, 1.0, 3.04, 'glow'); }
    if (r === 'air') { b.add('trim', new T.CylinderGeometry(0.12, 0.2, 1.4, 6).translate(2, 3.9, -1.8)); b.add('trim', new T.SphereGeometry(1.0, 10, 6, 0, Math.PI * 2, 0, 1.1).rotateX(-0.6).translate(2, 4.7, -1.8)); B(0.2, 0.2, 0.2, 2, 5.1, -1.3, 'glow'); }
    if (r === 'space') { b.add('trim', new T.SphereGeometry(1.6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 3.05, 0)); b.add('glow', new T.TorusGeometry(1.65, 0.07, 6, 24).rotateX(Math.PI / 2).translate(0, 3.1, 0)); }
  } else {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(0.6, 9, 0.6, sx * 2, 4.5, sz * 2);
    B(4.0, 3.6, 4.0, 0, 1.8, 0);
    for (const y of [4.6, 6.0]) { for (const s of [-1, 1]) { B(4.0, 0.18, 0.18, 0, y, s * 2, 'trim'); B(0.18, 0.18, 4.0, s * 2, y, 0, 'trim'); } }
    B(4.6, 0.3, 4.6, 0, 7.0, 0, 'trim'); for (const [w, d, x, z] of [[4.6, 0.3, 0, 2.15], [4.6, 0.3, 0, -2.15], [0.3, 4.6, 2.15, 0], [0.3, 4.6, -2.15, 0]]) B(w, 1.1, d, x, 7.7, z);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(0.3, 0.9, 0.3, sx * 2.15, 8.6, sz * 2.15, 'trim');
    B(5.0, 0.3, 5.0, 0, 9.0, 0, 'trim');
    b.add('trim', new T.CylinderGeometry(0.06, 0.06, 2.4, 4).translate(-2.1, 10.3, -2.1)); b.add('glow', new T.SphereGeometry(0.22, 8, 6).translate(-2.1, 11.6, -2.1));
    b.add('trim', new T.CylinderGeometry(0.35, 0.45, 0.6, 10).rotateX(Math.PI / 2).translate(1.6, 9.55, 1.6)); b.add('glow', new T.CircleGeometry(0.32, 10).translate(1.6, 9.55, 1.92));
    if (r === 'land') bags(4, -1.8, 1.2, 7.0, 2.6);
    if (r === 'sea') for (const s of [-1, 1]) { b.add('trim', new T.BoxGeometry(0.14, 5.4, 0.14).rotateZ(s * 0.62).translate(0, 4.5, 2.05)); b.add('trim', new T.BoxGeometry(0.14, 5.4, 0.14).rotateZ(s * 0.62).translate(0, 4.5, -2.05)); }
    if (r === 'air') for (const s of [-0.35, 0.35]) b.add('trim', new T.CylinderGeometry(0.1, 0.1, 2.6, 6).rotateX(-1.1).translate(s, 10.0, 0.6));
    if (r === 'space') { b.add('trim', new T.CylinderGeometry(0.08, 0.14, 5, 6).translate(0.6, 11.6, -0.6)); for (const y of [10.4, 11.6, 12.8]) b.add('glow', new T.TorusGeometry(0.35, 0.04, 4, 14).rotateX(Math.PI / 2).translate(0.6, y, -0.6)); }
  }
  const out = {}; for (const m of Object.keys(b)) if (m !== 'add' && b[m].length) out[m] = mergeGeos(b[m]); return (WS_G[key] = out);
}
function wsMesh(r, k) { const g = new T.Group(), G = wsGeo(r, k), M = wsMats(r); for (const m in G) { const o = new T.Mesh(G[m], M[m]); o.castShadow = m === 'main' || m === 'trim'; o.receiveShadow = true; g.add(o); } return g; }
const WS_CRANE = { mast: mergeGeos([new T.BoxGeometry(1.0, 22, 1.0).translate(0, 11, 0), new T.BoxGeometry(2.2, 1.4, 2.2).translate(0, 22.4, 0)]), jib: mergeGeos([new T.BoxGeometry(22, 0.7, 0.7).translate(6, 0, 0), new T.BoxGeometry(2.6, 1.8, 1.8).translate(-4.6, -0.6, 0)]),
  cab: new T.BoxGeometry(1.6, 1.4, 1.6).translate(0.6, -1.2, 1.3), load: new T.BoxGeometry(2.4, 0.9, 1.2), cable: new T.CylinderGeometry(0.04, 0.04, 1, 4).translate(0, 0.5, 0) };
/* ---------- drones, carried crates ---------- */
const WS_DRONE = (() => {
  const body = mergeGeos([xf(rbox(1.6, 0.5, 1.6, 0.15, 2), [0, 0, 0]), new T.BoxGeometry(3.4, 0.14, 0.2).rotateY(0.785), new T.BoxGeometry(3.4, 0.14, 0.2).rotateY(-0.785), new T.CylinderGeometry(0.03, 0.03, 2.2, 4).translate(0, -1.3, 0)]);
  return { body, blade: new T.BoxGeometry(1.5, 0.04, 0.14), lamp: new T.SphereGeometry(0.12, 6, 5), crate: new T.BoxGeometry(1.4, 1.1, 1.4).translate(0, -2.9, 0), bladeM: std(0x1a1a1a, 0.5, 0.6) };
})();
function wsDroneMesh(S) {
  const g = new T.Group(), b = new T.Mesh(WS_DRONE.body, S.M.trim); b.castShadow = true; g.add(b); g.blades = [];
  for (const [x, z] of [[1.2, 1.2], [-1.2, 1.2], [1.2, -1.2], [-1.2, -1.2]]) { const bl = new T.Mesh(WS_DRONE.blade, WS_DRONE.bladeM); bl.position.set(x, 0.32, z); g.add(bl); g.blades.push(bl); }
  for (const [x, z, c] of [[0.85, 0.85, [3, 0.4, 0.3]], [-0.85, 0.85, [0.4, 3, 0.6]]]) { const l = new T.Mesh(WS_DRONE.lamp, basic(new T.Color(c[0], c[1], c[2]))); l.position.set(x, -0.2, z); g.add(l); }
  g.crate = new T.Mesh(WS_DRONE.crate, S.M.main); g.crate.castShadow = true; g.add(g.crate); g.visible = false; scene.add(g); return g;
}
WS.cargo = (() => { const m = new T.InstancedMesh(new T.BoxGeometry(0.7, 0.5, 0.55), std(0x9a8a5a, 0.8, 0.2), ROBO_N); m.frustumCulled = false; _m.makeScale(0, 0, 0); for (let i = 0; i < ROBO_N; i++) m.setMatrixAt(i, _m); scene.add(m); return m; })();
/* ---------- where a realm's works go: on your side of the fight, the arrangement where the most pieces fit ---------- */
const wsDeck = key => key === 'sea' ? RDECK.B : key === 'air' ? null : key === 'space' ? RDECK.D : null;
function wsBox(k, fx) { const S = WS_T[k]; return fx ? [S.d, S.w] : [S.w, S.d]; }
function wsFits(s, deck, c, fx) {
  let W = 0, D = 0; for (const k of s.path) { const [w, d] = wsBox(k, fx); W = Math.max(W, w); D = Math.max(D, d); }
  const hw = W / 2 + 0.6, hd = D / 2 + 0.6, pts = [[0, 0], [-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd], [0, -hd], [0, hd], [-hw, 0], [hw, 0]];
  let y;
  if (deck) {
    if (Math.hypot(s.x - c.x, s.z - c.z) < 9) return false; /* the post itself stays open */
    for (const [ox, oz] of pts) if (Math.hypot(s.x + ox - deck.x, s.z + oz - deck.z) > deck.r - 2.5) return false;
    if (deck.gate) { let da = Math.atan2(s.z - deck.z, s.x - deck.x) - deck.gate.a; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) < deck.gate.w + 0.2) return false; }
    y = deck.y;
  } else {
    const hs = pts.map(([ox, oz]) => H(s.x + ox, s.z + oz)); if (Math.min(...hs) < 1.2 || Math.max(...hs) - Math.min(...hs) > 2.6) return false;
    if (trenchD(s.x, s.z) < Math.max(hw, hd) + 3 || riverD(s.x, s.z) < 16 || CPS.some(p => Math.hypot(p.x - s.x, p.z - s.z) < 10)) return false;
    y = Math.min(...hs) - 0.1;
  }
  for (const [ox, oz] of pts) for (const dy of [0.6, 2.5]) if (buildingAt(_v1.set(s.x + ox, y + dy, s.z + oz))) return false;
  for (const L of ZIPS.lines) for (const e of [L.la, L.lb]) if (Math.abs(e.y - y) < 6 && Math.abs(e.x - s.x) < hw + 2 && Math.abs(e.z - s.z) < hd + 2) return false; /* never bury a zipline landing */
  s.gy = y; return true;
}
function wsPlace(key) {
  const T0 = THEATRES.find(t => t.key === key), deck = wsDeck(key), c = deck || (T0.at ? T0.at() : T0.cp), hq = HQ[1];
  const base = key === 'sea' ? Math.atan2(RLM.head.z - c.z, RLM.head.x - c.x) : key === 'air' ? 0 : Math.atan2(hq.z - c.z, hq.x - c.x);
  let best = null;
  for (let i = 0; i < 18; i++) {
    const a = base + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.35, R = deck ? Math.min(22, deck.r * 0.46) : 46 + (i >> 2) * 8, x = c.x + Math.cos(a) * R, z = c.z + Math.sin(a) * R;
    let fx = c.x - x, fz = c.z - z; if (Math.abs(fx) > Math.abs(fz)) { fx = Math.sign(fx); fz = 0; } else { fz = Math.sign(fz); fx = 0; } /* face the fight, on the grid: every piece is a true box */
    const slots = WS_LAYOUT.map(([lx, lz, path, core]) => ({ lx, lz, path, core, x: x + fz * lx + fx * lz, z: z - fx * lx + fz * lz })).filter(s => wsFits(s, deck, c, fx)), sc = slots.reduce((n, s) => n + (s.core ? 10 : 1), 0);
    if (!best || sc > best.sc) best = { x, z, fx, fz, slots, deck, sc };
    if (slots.length === WS_LAYOUT.length) break;
  }
  return best;
}
const wsW = (S, lx, lz, out) => out.set(S.x + S.fz * lx + S.fx * lz, S.y, S.z - S.fx * lx + S.fz * lz);
function wsSite(key) {
  if (WS.sites[key] !== undefined) return WS.sites[key];
  const P = wsPlace(key); if (!P || P.slots.filter(s => s.core).length < 5) return (WS.sites[key] = null);
  const deck = P.deck, y = deck ? deck.y : groundY(P.x, P.z);
  const S = { key, R: WS_R[key], M: wsMats(key), x: P.x, z: P.z, y, fx: P.fx, fz: P.fz, deck, yaw: Math.atan2(P.fx, P.fz), state: 'idle', bastion: false, mat: 30, crew: [], budget: 16, heat: 0, hits: 0, friends: 0, foes: 0, foeList: [], pinned: false, cur: null, pickT: 0, scanT: 0, harassT: 4, healT: 0, signT: 0, dropT: 0, startT: 0, t: 0,
    slots: P.slots.map(s => Object.assign(s, { i: 0, tier: 0, prog: 0, got: 0, b: null, mesh: null, rise: null, riseK: 0, cv: null, deck: null, zip: null, dead: false, scorch: null })) };
  wsProps(S); return (WS.sites[key] = S);
}
/* ---------- the yard: materials, generator, floodlights, sign, mixer, crane, blueprint hologram ---------- */
function wsProps(S) {
  const g = new T.Group(); g.position.set(S.x, S.y, S.z); g.rotation.y = S.yaw; scene.add(g); S.g = g;
  const M = S.M, [yx, yz] = WS_YARD, add = (geo, mat, x, y, z, sh = true) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = sh; m.receiveShadow = true; g.add(m); return m; };
  const ly = (lx, lz) => S.deck ? 0 : H(S.x + S.fz * lx + S.fx * lz, S.z - S.fx * lx + S.fz * lz) - S.y; /* ground under a local point */
  /* pallets and the material stack (its height is the yard's stock) */
  S.stack = new T.Group(); S.stack.position.set(yx, ly(yx, yz), yz); g.add(S.stack);
  for (const x of [-3, 0, 3]) { const p = new T.Mesh(new T.BoxGeometry(2.4, 0.18, 1.6), FORT_M.scaf); p.position.set(x, 0.09, 0); p.receiveShadow = true; S.stack.add(p); const blk = new T.Mesh(new T.BoxGeometry(2.2, 1, 1.4).translate(0, 0.5, 0), M.main); blk.position.set(x, 0.18, 0); blk.castShadow = true; S.stack.add(blk); }
  for (let i = 0; i < 4; i++) add(new T.BoxGeometry(6, 0.3, 0.3), M.trim, yx - 7, ly(yx - 7, yz) + 0.15 + i * 0.32, yz + (i % 2) * 0.35 - 0.2); /* beam bundle */
  add(new T.BoxGeometry(2.2, 1.4, 1.2), M.trim, yx + 7, ly(yx + 7, yz) + 0.7, yz); S.genLamp = add(new T.SphereGeometry(0.14, 6, 5), basic(new T.Color(0.4, 3, 0.6)), yx + 7.8, ly(yx + 7, yz) + 1.55, yz, false);
  /* floodlights: cones show at night */
  S.cones = []; const coneM = addMat(new T.Color(1, 0.92, 0.7), 0.05, { side: T.DoubleSide });
  for (const sx of [-1, 1]) { const x = sx * 10, z = yz - 2, y0 = ly(x, z); add(new T.CylinderGeometry(0.12, 0.16, 8, 6).translate(0, 4, 0), M.trim, x, y0, z); const head = add(new T.BoxGeometry(1.4, 0.6, 0.5), M.trim, x, y0 + 8.1, z); head.rotation.x = 0.5;
    add(new T.PlaneGeometry(1.2, 0.45), basic(new T.Color(4, 3.6, 2.6)), x, y0 + 8.05, z + 0.27, false).rotation.x = 0.5;
    const cone = new T.Mesh(new T.ConeGeometry(7, 12, 16, 1, true).translate(0, -6, 0), coneM); cone.position.set(x, y0 + 8, z + 0.3); cone.rotation.x = -0.6; cone.rotation.z = sx * 0.2; g.add(cone); S.cones.push(cone); }
  S.coneM = coneM;
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, x = yx + Math.cos(a) * 6.5, z = yz + Math.sin(a) * 4.2; if (z > yz + 3.5) continue; add(new T.CylinderGeometry(0.09, 0.12, 1.0, 6).translate(0, 0.5, 0), FORT_M.hazard, x, ly(x, z), z); }
  if (S.key === 'land') { const x = yx - 5, z = yz - 4; S.drum = add(new T.CylinderGeometry(0.8, 1.1, 2.2, 10).rotateZ(1.2), FORT_M.hazard, x, ly(x, z) + 1.6, z); add(new T.BoxGeometry(1.6, 0.9, 2.6), M.trim, x, ly(x, z) + 0.45, z); }
  /* the sign over the yard */
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 112; S.signCtx = cv.getContext('2d'); S.signTex = new T.CanvasTexture(cv);
  S.sign = new T.Sprite(new T.SpriteMaterial({ map: S.signTex, transparent: true, depthWrite: false })); S.sign.scale.set(9, 3.9, 1); S.sign.position.set(yx, ly(yx, yz) + 6.5, yz); g.add(S.sign);
  /* tower crane on land and sea */
  S.crane = null;
  if (S.R.crane) for (const cx of [-26, 26]) {
    const wx = S.x + S.fz * cx + S.fx * -3, wz = S.z - S.fx * cx + S.fz * -3;
    if (S.deck ? Math.hypot(wx - S.deck.x, wz - S.deck.z) > S.deck.r - 3 : (H(wx, wz) < 1.2 || trenchD(wx, wz) < 4)) continue;
    if (buildingAt(_v1.set(wx, S.y + 2, wz))) continue;
    const cr = new T.Group(); cr.position.set(cx, ly(cx, -3), -3); g.add(cr); const mast = new T.Mesh(WS_CRANE.mast, FORT_M.hazard); mast.castShadow = true; cr.add(mast);
    const jib = new T.Group(); jib.position.y = 23.2; cr.add(jib); const jm = new T.Mesh(WS_CRANE.jib, FORT_M.hazard); jm.castShadow = true; jib.add(jm); jib.add(new T.Mesh(WS_CRANE.cab, M.trim));
    const hook = new T.Group(); jib.add(hook); const cab = new T.Mesh(WS_CRANE.cable, M.trim); hook.add(cab); const load = new T.Mesh(WS_CRANE.load, M.main); load.castShadow = true; hook.add(load);
    const lamp = new T.Mesh(WS_DRONE.lamp, basic(new T.Color(3.5, 0.3, 0.2))); lamp.position.set(17, 0.6, 0); jib.add(lamp);
    S.crane = { cr, jib, hook, cab, load, lamp, cx, cz: -3, a: 0, tr: 8, L: 8, ph: Math.random() * 6, lastPh: 0 }; break;
  }
  /* blueprint hologram over the piece being built */
  const hb = new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  S.holo = new T.Group(); S.holo.add(new T.Mesh(hb, M.holo)); S.holo.add(new T.LineSegments(new T.EdgesGeometry(hb), M.edge)); S.holo.visible = false; g.add(S.holo);
  S.scan = new T.Mesh(new T.BoxGeometry(1, 0.06, 1), M.glow); S.scan.visible = false; g.add(S.scan);
  S.flare = new T.Mesh(new T.SphereGeometry(0.45, 8, 6), addMat(new T.Color(S.R.glow[0] * 0.5 + 1, S.R.glow[1] * 0.5 + 0.8, S.R.glow[2] * 0.5 + 0.4), 1)); S.flare.visible = false; scene.add(S.flare); S.flareT = 0; /* weld glow */
  S.ringM = addMat(new T.Color(S.R.glow[0] * 0.5, S.R.glow[1] * 0.5, S.R.glow[2] * 0.5), 1, { side: T.DoubleSide }); S.ring = new T.Mesh(new T.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2), S.ringM); S.ring.visible = false; g.add(S.ring); S.ringT = 0; /* completion shockwave */
  S.drones = [0, 1].map(() => ({ g: wsDroneMesh(S), state: 'idle', pos: new V3(), vel: new V3(), t: 0, hp: 60 }));
}
function wsSign(S) {
  const c = S.signCtx, pct = wsPct(S), crew = S.crew.filter(w => w.state !== 'dead' && w.state !== 'gone' && w.state !== 'leave').length, st = wsStatus(S), key = `${pct}|${Math.round(S.mat)}|${crew}|${st}|${S.pinned}`;
  if (key === S.signKey) return; S.signKey = key; /* only re-upload the texture when something on it changed */
  c.clearRect(0, 0, 256, 112); c.fillStyle = 'rgba(12,14,18,0.78)'; c.fillRect(0, 0, 256, 112); c.fillStyle = '#' + S.R.hex.toString(16).padStart(6, '0'); c.fillRect(0, 0, 256, 6);
  c.font = 'bold 19px monospace'; c.fillText('BUILDER GUILD', 12, 30); c.fillStyle = '#e8e4d8'; c.font = '15px monospace'; c.fillText(S.R.title.toUpperCase(), 12, 50);
  c.fillStyle = '#333'; c.fillRect(12, 60, 232, 12); c.fillStyle = S.bastion ? '#ffd24a' : '#' + S.R.hex.toString(16).padStart(6, '0'); c.fillRect(12, 60, 232 * pct / 100, 12);
  c.fillStyle = '#e8e4d8'; c.font = '13px monospace'; c.fillText(`${pct}%  MAT ${Math.round(S.mat)}  CREW ${crew}`, 12, 90);
  c.fillStyle = S.pinned ? '#ff6a4a' : S.bastion ? '#ffd24a' : '#9ad'; c.fillText(st.toUpperCase(), 12, 106); S.signTex.needsUpdate = true;
}
function wsStatus(S) { return S.state === 'bastion' ? 'Bastion · indestructible' : S.bastion ? 'Bastion · expanding' : S.state === 'abandoned' ? 'Abandoned' : S.state === 'idle' ? 'Waiting for the battle' : S.pinned ? 'Pinned · clear the enemy' : S.mat < 2 ? 'Out of materials' : S.heat > 2 ? 'Hasty · front walls first' : 'Building'; }
/* ---------- pieces ---------- */
function wsDropB(s, defer) { /* defer: collapses happen inside loops over BUILDINGS, so they are swept out next frame */
  const B = s.b; if (!B) return; if (defer) WS.trash.push(B); else { const i = BUILDINGS.indexOf(B); if (i >= 0) BUILDINGS.splice(i, 1); } scene.remove(B.mesh); s.b = null;
  if (s.deck) { const j = DECKS.indexOf(s.deck); if (j >= 0) DECKS.splice(j, 1); s.deck = null; }
  if (s.zip) { s.zip.wsFree = true; s.zip = null; }
}
function wsCoverOff(s) { if (!s.cv) return; const L = COVER_GRID.get(cgk(s.cv.x, s.cv.z)); if (L) { const j = L.indexOf(s.cv); if (j >= 0) L.splice(j, 1); } const j = COVER.indexOf(s.cv); if (j >= 0) COVER.splice(j, 1); s.cv = null; }
function wsZip(foot, top, land, B) { /* recycle a freed tower cable before laying a new one */
  const L = ZIPS.lines.find(q => q.wsFree); if (!L) return zipVertical(foot, top, land, B);
  L.a.copy(foot).y += 0.6; L.b.copy(top); L.la.copy(foot); L.lb.copy(land); L.len = L.a.distanceTo(L.b); L.blds = [B]; L.wsFree = false; L.on = true; zipDraw(L, true); return L;
}
function wsTierUp(S, s) {
  const k = s.path[s.i]; S.stock = (S.stock || 0) + Math.max(0, s.got - WS_T[k].cost); s.i++; s.tier = k; s.prog = 0; s.got = 0; /* leftover materials stay on site for the next piece */
  if (s.mesh) S.g.remove(s.mesh); s.mesh = s.rise; s.rise = null; s.disp = 0; if (s.mesh) { s.mesh.scale.y = 1; s.pop = 0.4; } S.ringT = 0.7; S.ring.position.set(s.lx, s.gy - S.y + 0.15, s.lz); /* the piece settles with a pulse */
  const [W, D] = wsBox(k, S.fx), T0 = WS_T[k]; wsDropB(s);
  const B = new Building(s.x, s.z, W, D, T0.h, { mesh: new T.Group(), hp: T0.hp * S.R.hpK }); B.gy = s.gy; B.top = s.gy + T0.h; B.h = T0.h; B.cover = true; B.works = s; B.ws = S; B.collapse = wsCollapse;
  if (S.bastion) B.hp = B.maxHp = 1e9; BUILDINGS.push(B); s.b = B;
  if (k <= 3) { if (!s.cv) { s.cv = { x: s.x, z: s.z, hw: W / 2, hd: D / 2, r: Math.max(W, D) / 2 }; COVER.push(s.cv); const key = cgk(s.x, s.z); if (!COVER_GRID.has(key)) COVER_GRID.set(key, []); COVER_GRID.get(key).push(s.cv); } else { s.cv.hw = W / 2; s.cv.hd = D / 2; s.cv.r = Math.max(W, D) / 2; } }
  else { wsCoverOff(s); s.deck = { x: s.x, z: s.z, y: B.top, r: 2.4 }; DECKS.push(s.deck);
    const off = T0.d / 2 + 0.7, fx = s.x - S.fx * off, fz = s.z - S.fz * off, fy = S.deck ? S.y : groundY(fx, fz); /* foot on the friendly side */
    s.zip = wsZip(new V3(fx, fy, fz), new V3(fx, B.top + 2.6, fz), new V3(s.x, B.top, s.z), B); }
  const p = new V3(s.x, s.gy + T0.h, s.z); if (camera.position.distanceTo(p) < 300) { fxDust(p, 8, 5, 6); fxSparks(p, 14, S.R.glow, 8); snd('clank', p, 0.6); snd('chime', p, 0.25); }
  if (k >= 3 && TIME - (S.saidT || 0) > 14) { S.saidT = TIME; comms('Builder Guild', `${k === 4 ? 'Tower' : 'Bunker'} up at the ${S.R.title}${k === 4 ? ', zipline on the back' : ''}.`, 'cmd'); }
  wsCheckBastion(S);
}
function wsCollapse(src) { /* replaces Building.collapse for works pieces: the slot burns out and stays scorched this war */
  this.alive = false; const s = this.works, S = this.ws, k = s.tier, T0 = WS_T[k], p = new V3(s.x, s.gy + T0.h * 0.5, s.z);
  s.dead = true; if (s.mesh) S.g.remove(s.mesh); if (s.rise) S.g.remove(s.rise); s.mesh = s.rise = null; wsCoverOff(s); wsDropB(s, true); if (S.cur === s) S.cur = null;
  const [W, D] = wsBox(k, S.fx), r = new T.Mesh(WS_RUB, rubbleMat); r.scale.set(W * 0.5, 0.6 + k * 0.35, D * 0.5 + 0.4); r.position.set(s.x, s.gy + 0.2, s.z); r.rotation.y = Math.random() * 3; r.castShadow = r.receiveShadow = true; scene.add(r); s.scorch = r;
  fxExplosion(p, 1 + k * 0.3); spawnDebris(p, 4 + k * 2, 10, 0.5); fxSparks(p, 20, S.R.glow, 12); snd('boom', p, 0.8); addEmitter(p.clone().setY(s.gy + 1), 1.2, 35); S.heat += 2;
  if (typeof heat === 'function') heat(p, 3 + k, 'boom', `A Guild ${T0.n} at the ${S.R.title} goes down`, 'Works');
  if (src && src.isPlayer) { S.hits++;
    if (S.hits >= 3 && S.state !== 'abandoned' && !S.bastion) wsAbandon(S, `You tore down our ${S.R.title}. The Guild won't build here again this war.`);
    else if (S.hits === 1) comms('Builder Guild', `Commander, that was our ${T0.n}. Every piece you knock down is cover nobody gets back this war.`, 'cmd'); }
  else if (TIME - (S.lossT || 0) > 12) { S.lossT = TIME; comms('Builder Guild', `Lost a ${T0.n} at the ${S.R.title}. That ground stays open now.`, 'cmd'); }
}
function wsCheckBastion(S) {
  if (S.state !== 'build') return;
  if (S.bastion) { if (S.slots.every(s => s.dead || s.i >= s.path.length)) wsSettle(S, `The ${S.R.title} are built out. Crews moving off.`); return; } /* expansion finished */
  const core = S.slots.filter(s => s.core && !s.dead);
  if (core.length < 5 || !core.every(s => s.i >= s.path.length)) return;
  S.bastion = true; S.cur = null; for (const w of S.crew) if (w.state !== 'dead' && w.state !== 'gone' && w.state !== 'leave') w.cheerT = TIME + 2.5;
  for (const s of S.slots) if (s.b) s.b.hp = s.b.maxHp = 1e9;
  const pil = new T.Mesh(new T.CylinderGeometry(0.8, 0.8, 160, 10, 1, true).translate(0, 80, 0), addMat(new T.Color(S.R.glow[0] * 0.1, S.R.glow[1] * 0.1, S.R.glow[2] * 0.1), 1, { side: T.DoubleSide })); pil.position.set(0, 0, -20); S.g.add(pil);
  const ring = new T.Mesh(new T.RingGeometry(24, 25, 64).rotateX(-Math.PI / 2), addMat(new T.Color(S.R.glow[0] * 0.3, S.R.glow[1] * 0.3, S.R.glow[2] * 0.3), 1, { side: T.DoubleSide })); ring.position.y = 0.3; S.g.add(ring); S.bastionFx = [pil, ring];
  const p = new V3(S.x, S.y + 6, S.z); fxDust(p, 20, 12, 12); flashLight(p, 12, 120, 0.8, S.R.hex); snd('big', p, 0.7); snd('chime', p, 0.8);
  banner(`Bastion complete · ${S.R.title}`, 'You let the Guild finish: indestructible cover, ziplines up the towers, it patches up your troops inside, and the crews keep expanding it', 'var(--amber)');
  comms('Builder Guild', `The ${S.R.title} core is finished. Nothing short of the end of the war takes it down. Expanding the walls while you hold here.`, 'cmd');
  if (typeof warScore === 'function') warScore(1, 25, 'Guild bastion stands');
  if (typeof heat === 'function') heat(p, 9, 'boom', `The ${S.R.title} stand complete`, 'Bastion');
  if (S.slots.every(s => s.dead || s.i >= s.path.length)) wsSettle(S, `The ${S.R.title} stand complete. Crews moving off.`);
}
function wsSettle(S, msg) { /* nothing left to build: the bastion stands, crews go home */
  S.state = 'bastion'; S.cur = null; S.holo.visible = S.scan.visible = false;
  for (const w of S.crew) if (w.state !== 'dead' && w.state !== 'gone') w.state = 'leave';
  for (const d of S.drones) if (d.state === 'in' || d.state === 'drop') d.state = 'out';
  comms('Builder Guild', msg, 'cmd');
}
function wsAbandon(S, msg) {
  S.state = 'abandoned'; S.cur = null; S.holo.visible = S.scan.visible = false;
  for (const w of S.crew) if (w.state !== 'dead' && w.state !== 'gone') w.state = 'leave';
  for (const d of S.drones) if (d.state === 'in' || d.state === 'drop') d.state = 'out';
  banner(`Guild works abandoned · ${S.R.title}`, msg, '#ff6a4a'); comms('Builder Guild', msg, 'cmd');
}
/* ---------- start, pause, reset ---------- */
function wsRobot(S, role) {
  if (S.budget <= 0) return null; let from;
  if (S.deck) { const dx = S.x - S.deck.x, dz = S.z - S.deck.z, l = Math.hypot(dx, dz) || 1; from = new V3(S.deck.x + dx / l * (S.deck.r - 4) + rand(-4, 4), S.y, S.deck.z + dz / l * (S.deck.r - 4) + rand(-4, 4)); }
  else { from = landNear(S.x - S.fx * 55 + rand(-12, 12), S.z - S.fz * 55 + rand(-12, 12), 8); from.y = groundY(from.x, from.z); }
  const w = newRobot(S, from); if (!w) return null; S.budget--;
  Object.assign(w, { ws: S, role, carry: false, loadT: 0, fearT: 0, hop: rand(-1.8, 1.8), state: 'walk' }); S.crew.push(w);
  if (S.deck && camera.position.distanceTo(from) < 200) { fxDust(from, 6, 3, 4); flashLight(from, 3, 20, 0.2, S.R.hex); }
  return w;
}
function wsStart(S) {
  S.state = 'build'; S.budget = Math.max(S.budget, 16); S.crew = S.crew.filter(w => w.state !== 'gone');
  const roles = ['haul', 'weld', 'haul', 'weld', 'boss', 'haul']; for (let i = 0; i < WS_CREW; i++) wsRobot(S, roles[i]);
  const T0 = THEATRE.cur; comms('Builder Guild', `Crews setting up the ${S.R.title} on your side of ${T0 && T0.cp ? T0.cp.name : 'the fight'}. Cover them and they fortify the line; let them finish and it never falls.`, 'cmd');
}
function wsPause(S) {
  if (S.state === 'build') S.state = 'idle'; S.holo.visible = S.scan.visible = false;
  for (const w of S.crew) if (w.state !== 'dead' && w.state !== 'gone') w.state = 'leave';
  for (const d of S.drones) if (d.state === 'in' || d.state === 'drop') d.state = 'out';
}
function wsReset(S) { /* a new war clears everything but a finished bastion */
  wsPause(S); if (S.bastion) return;
  for (const s of S.slots) { if (s.b) s.b.alive = false; wsDropB(s); wsCoverOff(s); if (s.mesh) S.g.remove(s.mesh); if (s.rise) S.g.remove(s.rise); if (s.scorch) scene.remove(s.scorch); Object.assign(s, { i: 0, tier: 0, prog: 0, got: 0, mesh: null, rise: null, dead: false, scorch: null }); }
  Object.assign(S, { state: 'idle', mat: 30, hits: 0, budget: 16, heat: 0, cur: null });
}
{ const _wsNewWar = newWar; newWar = function () { _wsNewWar.apply(this, arguments); for (const k in WS.sites) if (WS.sites[k]) wsReset(WS.sites[k]); WS.cur = null; }; }
/* ---------- explosions: pieces take it (Building.damage), robots dive, drones fall, half-built work is knocked back ---------- */
{
  const _wsBoom = explodeDamage;
  explodeDamage = function (p, radius, dmg, src, team, skip) {
    _wsBoom(p, radius, dmg, src, team, skip); const S = WS.cur; if (!S || S.state !== 'build') return;
    const dx = p.x - S.x, dy = p.y - S.y, dz = p.z - S.z; if (dx * dx + dz * dz > 3600 || Math.abs(dy) > 40) return;
    S.heat += dmg / 120;
    for (const w of S.crew) if (w.state !== 'dead' && w.state !== 'gone' && w.pos.distanceTo(p) < radius + 9) w.fearT = TIME + rand(2.5, 4.5);
    for (const s of S.slots) if (s.rise && s.prog > 0) { const d = Math.hypot(p.x - s.x, p.z - s.z); if (d < radius + 4) s.prog = Math.max(0, s.prog - 0.18 * (1 - d / (radius + 4))); }
    for (const d of S.drones) if ((d.state === 'in' || d.state === 'drop' || d.state === 'out') && d.pos.distanceTo(p) < radius + 3) wsDroneHit(S, d, dmg, src);
  };
}
function wsDroneHit(S, d, dmg, src) {
  d.hp -= dmg; if (d.hp > 0 || d.state === 'down') return;
  const lost = d.state !== 'out'; d.state = 'down'; d.t = 0; d.vel.set(rand(-4, 4), 3, rand(-4, 4)); fxExplosion(d.pos, 0.8); fxSparks(d.pos, 18, S.R.glow, 10); S.dropT = TIME + 12;
  if (typeof heat === 'function') heat(d.pos, 3, 'kill', `A Guild ${S.R.cargo} is shot down`, 'Works');
  if (lost) comms('Builder Guild', src && src.isPlayer ? `Commander, you just shot down our ${S.R.cargo}. That was a full load.` : `${S.R.cargo[0].toUpperCase() + S.R.cargo.slice(1)} down over the ${S.R.title}. Load lost; next one in a few.`, 'cmd');
}
/* ---------- the hint when you walk up ---------- */
{
  const _wsHint = mountHint;
  mountHint = function (pe) {
    const h = _wsHint(pe); if (h || pe.kind !== 'soldier' || pe.mount) return h; const S = WS.cur; if (!S) return h;
    if (Math.hypot(pe.pos.x - S.x, pe.pos.z - S.z) > 34 || Math.abs(pe.pos.y - S.y) > 14) return null;
    if (S.bastion) return `${S.R.title} · bastion · indestructible · heals your troops · tower ziplines`;
    if (S.state === 'abandoned') return `${S.R.title} · abandoned by the Guild`;
    return `${S.R.title} · ${wsStatus(S)} · stay close and they build faster · let them finish: bastion`;
  };
}
/* ---------- minimap ---------- */
{
  const _wsMap = drawBuildSites;
  drawBuildSites = function (ctx, W2M) {
    _wsMap(ctx, W2M); const S = WS.cur; if (!S) return; const x = W2M(S.x), y = W2M(S.z), col = '#' + S.R.hex.toString(16).padStart(6, '0');
    const live = S.slots.filter(s => !s.dead), k = live.reduce((n, s) => n + s.i, 0) / Math.max(1, live.reduce((n, s) => n + s.path.length, 0));
    ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = S.bastion ? col : 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; ctx.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5); } ctx.closePath(); ctx.fill(); ctx.stroke();
    if (S.state === 'build') { ctx.beginPath(); ctx.arc(x, y, 7.5, -Math.PI / 2, -Math.PI / 2 + k * 6.283); ctx.stroke(); }
    ctx.restore();
  };
}
/* ---------- per frame ---------- */
function wsPick(S) { /* barricades everywhere first, then up; front first under fire; towers only with your squad covering */
  let best = null, bs = -1e9;
  for (const s of S.slots) {
    if (s.dead || s.i >= s.path.length) continue; const k = s.path[s.i]; if (k === 4 && S.friends < 1) continue;
    const sc = (s.core ? 1000 : 0) - k * 100 + s.lz * (S.heat > 2 ? 6 : 1) + (s.prog > 0 ? 60 : 0) - Math.hypot(s.lx - WS_YARD[0], s.lz - WS_YARD[1]) * 0.3; if (sc > bs) { bs = sc; best = s; }
  }
  if (best !== S.cur) { S.cur = best; if (best && S.stock) { best.got += S.stock; S.stock = 0; } if (best && !best.rise) { best.rise = wsMesh(S.key, best.path[best.i]); best.rise.position.set(best.lx, best.gy - S.y, best.lz); best.rise.scale.y = 0.02; S.g.add(best.rise); } }
}
function wsSpot(S, s, w) { /* where a robot stands to work a slot: its friendly side, spread across */
  const D = WS_T[s.path[Math.min(s.i, s.path.length - 1)]].d; return wsW(S, s.lx + w.hop, s.lz - D / 2 - 1.3, _v2);
}
function wsHide(S, w) { /* behind the nearest finished piece */
  let best = null, bd = 1e9; for (const s of S.slots) { if (!s.b || s.dead) continue; const d = Math.hypot(s.x - w.pos.x, s.z - w.pos.z); if (d < bd) { bd = d; best = s; } }
  if (!best) return wsW(S, WS_YARD[0] + w.hop, WS_YARD[1] - 3, _v2);
  return wsW(S, best.lx + w.hop * 0.6, best.lz - WS_T[best.tier].d / 2 - 0.9, _v2);
}
function wsRobots(S, dt) {
  const cam = camera.position, yard = wsW(S, WS_YARD[0], WS_YARD[1] + 1.5, new V3()), cur = S.cur, storm = !S.deck && typeof stormNear === 'function' && stormNear(S.x, S.z);
  let welders = 0;
  for (const w of S.crew) {
    if (w.state === 'gone') continue; w.t += dt;
    if (w.state === 'dead') { if (!w.counted) { w.counted = true; for (const o of S.crew) if (o !== w) o.fearT = Math.max(o.fearT, TIME + 2); if (TIME - (S.deathT || 0) > 15 && S.state === 'build') { S.deathT = TIME; comms('Builder Guild', `Robot down at the ${S.R.title}.${S.budget > 0 ? ' Sending another.' : ' No more crews to send.'}`, 'cmd'); } } if (w.t > 2.5) w.state = 'gone'; continue; }
    if (w.cheerT > TIME) { w.state = 'walk'; wsTurn(w, Math.atan2(S.x - w.pos.x, S.z - w.pos.z), dt, 5); w.pos.y = S.deck ? S.y : groundY(w.pos.x, w.pos.z); continue; } /* bastion done: the crew celebrates on the spot */
    if (w.state === 'leave') {
      const dx = w.pos.x - S.x, dz = w.pos.z - S.z, l = Math.hypot(dx, dz) || 1; w.spd = lerp(w.spd || 0, 4.5, Math.min(1, dt * 4)); w.pos.x += dx / l * w.spd * dt; w.pos.z += dz / l * w.spd * dt; wsTurn(w, Math.atan2(dx, dz), dt); w.carry = false;
      if (S.deck) { w.pos.y = S.y; if (Math.hypot(w.pos.x - S.deck.x, w.pos.z - S.deck.z) > S.deck.r - 3) { w.state = 'gone'; if (cam.distanceTo(w.pos) < 200) fxDust(w.pos, 4, 3, 3); } }
      else { w.pos.y = groundY(w.pos.x, w.pos.z); if (l > 70) w.state = 'gone'; }
      continue;
    }
    let tgt, act = 'work';
    if (S.pinned || w.fearT > TIME || storm) { tgt = wsHide(S, w); act = 'huddle'; }
    else if (w.role === 'haul') { if (w.carry && cur) tgt = wsSpot(S, cur, w); else { tgt = _v2.copy(yard); tgt.x += w.hop; } }
    else if (w.role === 'weld') { tgt = cur ? wsSpot(S, cur, w) : _v2.copy(yard); }
    else { const out = cur && Math.sin(w.t * 0.4 + w.ph) > 0.4; tgt = out ? wsSpot(S, cur, w) : _v2.set(yard.x - S.fx * 2, yard.y, yard.z - S.fz * 2); }
    const dx = tgt.x - w.pos.x, dz = tgt.z - w.pos.z, d = Math.hypot(dx, dz);
    if (d > 1.0) { const want = (act === 'huddle' ? 6 : w.carry ? 4.4 : 5.2) * Math.min(1, d / 2.5 + 0.35); w.spd = lerp(w.spd || 0, want, Math.min(1, dt * 6)); const sp = w.spd * dt; w.pos.x += dx / d * Math.min(d, sp); w.pos.z += dz / d * Math.min(d, sp); wsTurn(w, Math.atan2(dx, dz), dt); if (d > 2) w.state = 'walk'; } /* ease in and out of every walk */
    else {
      w.state = act; w.spd = 0;
      if (act === 'work') {
        if (cur) wsTurn(w, Math.atan2(cur.x - w.pos.x, cur.z - w.pos.z), dt, 6);
        if (w.role === 'haul') {
          if (!w.carry && Math.hypot(w.pos.x - yard.x, w.pos.z - yard.z) < 3 && S.mat >= 5 && cur && cur.got < WS_T[cur.path[cur.i]].cost + 8) { /* keep a running stock at the front */ if ((w.loadT += dt) > 1.0) { w.loadT = 0; w.carry = true; S.mat -= 5; if (cam.distanceTo(w.pos) < 60) snd('clank', w.pos, 0.3); } }
          else if (w.carry && cur) { if ((w.loadT += dt) > 0.6) { w.loadT = 0; w.carry = false; cur.got += 5; if (cam.distanceTo(w.pos) < 120) fxDust(w.pos, 2, 1.5, 2); } }
        } else if (w.role === 'weld' && cur) {
          welders++;
          if ((w.beamT -= dt) <= 0) { w.beamT = rand(0.35, 0.8); if (cam.distanceTo(w.pos) < 260) { const T0 = WS_T[cur.path[cur.i]], q = _v3.set(cur.x + rand(-T0.w, T0.w) * 0.3 * (S.fz ? 1 : 0.2), cur.gy + Math.max(0.3, T0.h * cur.prog), cur.z + rand(-T0.w, T0.w) * 0.3 * (S.fx ? 1 : 0.2)); beam(_v4.set(w.pos.x + Math.sin(w.yaw) * 0.5, w.pos.y + 1.1, w.pos.z + Math.cos(w.yaw) * 0.5), q, 0.07, 0.16, S.R.hex); S.flare.position.copy(q); S.flareT = 0.14; fxSparks(q, 6, [3, 2.2, 0.7], 6); if (Math.random() < 0.35) snd('zap', q, 0.18); } }
        } else if (w.role === 'boss' && cur) welders += 0.5;
      }
    }
    for (const o of S.crew) { if (o === w || o.state === 'gone' || o.state === 'dead') continue; const ox = w.pos.x - o.pos.x, oz = w.pos.z - o.pos.z, od = ox * ox + oz * oz; if (od < 0.81 && od > 1e-6) { const k = (0.9 - Math.sqrt(od)) * 0.5 / Math.sqrt(od); w.pos.x += ox * k; w.pos.z += oz * k; } } /* robots shoulder past each other instead of stacking */
    if (S.deck) w.pos.y = S.y; else { pushOut(w.pos, 0.5); w.pos.y = groundY(w.pos.x, w.pos.z); }
  }
  return welders;
}
function wsDrones(S, dt) {
  const cam = camera.position, yard = wsW(S, WS_YARD[0], WS_YARD[1], new V3()), busy = S.drones.some(d => d.state === 'in' || d.state === 'drop');
  if (S.state === 'build' && !busy && S.mat < 26 && TIME > S.dropT) { const d = S.drones.find(q => q.state === 'idle');
    if (d) { const lat = rand(-40, 40); d.pos.set(S.x - S.fx * 120 + S.fz * lat, S.y + 45, S.z - S.fz * 120 - S.fx * lat); d.state = 'in'; d.hp = 60; d.t = 0; d.g.visible = true; d.g.crate.visible = true; S.dropT = TIME + 8; } }
  for (const d of S.drones) {
    if (d.state === 'idle') continue; d.t += dt; const g = d.g;
    if (d.state === 'in') { const tx = yard.x, ty = S.y + 16, tz = yard.z; _v1.set(tx - d.pos.x, ty - d.pos.y, tz - d.pos.z); const l = _v1.length(); if (l < 1.5) { d.state = 'drop'; d.t = 0; } else { _v1.multiplyScalar(Math.min(24, l * 1.2) / l); d.vel.lerp(_v1, Math.min(1, dt * 2.5)); d.pos.addScaledVector(d.vel, dt); } }
    else if (d.state === 'drop') { d.pos.y = lerp(d.pos.y, S.y + 5.2, Math.min(1, dt * 2)); d.vel.multiplyScalar(Math.max(0, 1 - dt * 5)); if (Math.random() < dt * 6 && cam.distanceTo(d.pos) < 150) fxDust(_v1.set(d.pos.x, S.y + 0.2, d.pos.z), 1, 2.5, 3); /* rotor wash */
      if (d.t > 1.8) { d.state = 'out'; d.t = 0; g.crate.visible = false; S.mat += 15; if (cam.distanceTo(d.pos) < 200) { fxDust(_v1.set(d.pos.x, S.y, d.pos.z), 8, 4, 5); snd('clank', d.pos, 0.8); snd('stomp', d.pos, 0.4); } } }
    else if (d.state === 'out') { d.vel.lerp(_v1.set(S.fx * -18, 9, S.fz * -18), Math.min(1, dt * 1.5)); d.pos.addScaledVector(d.vel, dt); if (d.t > 9) { d.state = 'idle'; g.visible = false; } }
    else if (d.state === 'down') { d.vel.y -= (S.key === 'space' ? 6 : 18) * dt; d.pos.addScaledVector(d.vel, dt); g.rotation.z += dt * 5; g.rotation.x += dt * 3; if (Math.random() < 0.6) fxDust(d.pos, 1, 1, 2);
      const fy = S.deck && Math.hypot(d.pos.x - S.deck.x, d.pos.z - S.deck.z) < S.deck.r ? S.y : groundY(d.pos.x, d.pos.z);
      if (d.pos.y <= fy + 0.5 || d.t > 8) { fxExplosion(d.pos, 1.0); explodeDamage(d.pos, 5, 90, null, 0); d.state = 'idle'; g.visible = false; g.rotation.set(0, 0, 0); continue; } }
    g.position.copy(d.pos); if (d.state !== 'down') { const sp = Math.hypot(d.vel.x, d.vel.z); if (sp > 0.5) { let da = Math.atan2(d.vel.x, d.vel.z) - g.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); g.rotation.y += da * Math.min(1, dt * 3); g.rotation.z = lerp(g.rotation.z, -da * 0.6, Math.min(1, dt * 4)); } g.rotation.x = lerp(g.rotation.x, Math.min(0.28, sp * 0.012), Math.min(1, dt * 3)); g.crate.rotation.z = Math.sin(d.t * 2.2) * 0.08; } /* eased heading, banked turns, a swinging load */
    for (const b of g.blades) b.rotation.y += dt * 40;
    if (cam.distanceTo(d.pos) < 90 && (d.sfx = (d.sfx || 0) - dt) <= 0) { d.sfx = 0.5; snd('buzz', d.pos, 0.3); }
  }
}
function wsScan(S) { /* who is around the works: your squad builds them up, the enemy pins them down */
  let f = 0, h = 0; S.foeList.length = 0;
  for (const e of ENTS) {
    if (!e.alive || e.kind !== 'soldier' || e.mount) continue; const dx = e.pos.x - S.x, dz = e.pos.z - S.z; if (dx * dx + dz * dz > 2500 || Math.abs(e.pos.y - S.y) > 20) continue;
    if (e.team === 1) f += e.isPlayer ? 3 : 1; else if (isHostile(e.team)) { h++; if (S.foeList.length < 8) S.foeList.push(e); }
  }
  if (S.pinned !== (h >= 3 && h > f + 1)) { S.pinned = !S.pinned; if (S.pinned && TIME - (S.pinT || 0) > 25) { S.pinT = TIME; comms('Builder Guild', `We're pinned at the ${S.R.title}! Clear them off and we get back to work.`, 'cmd'); } }
  S.friends = f; S.foes = h;
}
function wsHarass(S) { /* enemies near the works shoot at what the Guild is building, and your troops turn on them */
  const e = S.foeList.filter(q => q.alive)[(Math.random() * S.foeList.length) | 0]; if (!e) return;
  const from = e.muzzle(new V3()), r = Math.random(); let to = null, hit = null;
  const dr = S.drones.find(d => (d.state === 'in' || d.state === 'drop') && d.pos.distanceTo(e.pos) < 80);
  if (dr && r < 0.4) { to = dr.pos.clone(); hit = () => wsDroneHit(S, dr, 22, e); }
  else if (r < 0.7) { const w = S.crew.find(q => (q.state === 'work' || q.state === 'walk') && q.pos.distanceTo(e.pos) < 60); if (w) { to = _v1.set(w.pos.x, w.pos.y + 1.4, w.pos.z).clone(); hit = () => { if (Math.random() < 0.3 && w.state !== 'dead') { w.state = 'dead'; w.t = 0; fxSparks(to, 18, [3, 2.2, 0.6], 10); spawnDebris(w.pos, 2, 4, 0.2); } }; } }
  if (!to && S.cur) { const s = S.cur, T0 = WS_T[s.path[s.i]]; to = new V3(s.x, s.gy + Math.max(0.5, T0.h * s.prog * 0.6), s.z); hit = () => { s.prog = Math.max(0, s.prog - 0.06); if (s.b) s.b.damage(40, e); }; }
  if (!to || !losClear(from, to)) return;
  const col = TEAM[e.team] ? TEAM[e.team].hex : 0xff6a4a; for (let k = 0; k < 3; k++) setTimeout(() => { if (!e.alive) return; beam(e.muzzle(_v5), to, 0.06, 0.07, col); fxSparks(to, 3, [3, 1.6, 0.6], 6); }, k * 110);
  snd('laser', e.pos, 0.35); e.yaw = Math.atan2(to.x - e.pos.x, to.z - e.pos.z); hit();
  let n = 0; for (const f of ENTS) if (n < 3 && f.alive && f.team === 1 && f.kind === 'soldier' && !f.isPlayer && !f.mount && f.pos.distanceTo(e.pos) < 70) { f.target = e; f.think = 1.2; n++; } /* your troops cover the builders */
  if (TIME - (S.fireT || 0) > 30) { S.fireT = TIME; comms('Builder Guild', `Taking fire at the ${S.R.title}! Somebody cover us.`, 'cmd'); }
}
function wsCrane(S, dt) {
  const C = S.crane; if (!C) return; const s = S.cur, idle = !s || S.state !== 'build' || S.pinned;
  const tx = s ? s.lx : WS_YARD[0], tz = s ? s.lz : WS_YARD[1], ph = (TIME * 0.12 + C.ph) % 1, toYard = ph < 0.5; /* swing loads from the yard to the piece and back */
  const gx = (idle ? WS_YARD[0] : toYard ? WS_YARD[0] : tx) - C.cx, gz = (idle ? WS_YARD[1] : toYard ? WS_YARD[1] : tz) - C.cz;
  let want = Math.atan2(-gz, gx), da = want - C.a; da = Math.atan2(Math.sin(da), Math.cos(da)); C.a += clamp(da, -dt * 0.5, dt * 0.5); C.jib.rotation.y = C.a;
  C.tr = lerp(C.tr, clamp(Math.hypot(gx, gz), 4, 16), Math.min(1, dt * 0.8)); const k = Math.abs(Math.sin(ph * Math.PI * 2)); C.L = lerp(C.L, idle ? 6 : 6 + k * 13, Math.min(1, dt));
  C.hook.position.set(C.tr, -C.L, 0); C.cab.scale.y = C.L; C.load.position.y = -0.6; C.load.visible = !idle && !toYard;
  C.lamp.visible = Math.sin(TIME * 4) > 0;
  if (ph < C.lastPh && !idle && S.mat >= 3) { S.mat -= 3; s.got += 3; if (camera.position.distanceTo(_v1.set(s.x, s.gy, s.z)) < 150) { fxDust(_v1, 3, 2, 3); snd('clank', _v1, 0.4); } } /* each swing sets a load down on the piece */
  C.lastPh = ph;
}
function wsHud(S) { /* a small panel when you are at the works: realm, progress, what the crew is doing */
  let el = WS.hud; if (!el) { el = WS.hud = document.createElement('div'); el.id = 'works'; document.body.appendChild(el); }
  const pe = PLAYER.ent, near = pe && pe.alive && GAME.state === 'play' && Math.hypot(pe.pos.x - S.x, pe.pos.z - S.z) < 150 && Math.abs(pe.pos.y - S.y) < 60;
  if (!near) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
  const col = '#' + S.R.hex.toString(16).padStart(6, '0'), pct = wsPct(S), st = wsStatus(S), key = `${S.key}|${pct}|${st}|${S.pinned}`;
  el.style.display = 'block'; if (key === el.dataset.k) return; el.dataset.k = key; el.style.borderColor = col;
  el.innerHTML = `<b style="color:${col}">Guild · ${S.R.title}</b><i><u style="width:${pct}%;background:${S.bastion ? '#ffd24a' : col}"></u></i><span style="color:${S.pinned ? '#ff6a4a' : S.bastion ? '#ffd24a' : ''}">${pct}% · ${st}</span>`;
}
function updateWorks(dt) {
  if (GAME.state === 'end' || GAME.state === 'showcase') return;
  const key = THEATRE.cur ? THEATRE.cur.key : null;
  if ((WS.cur ? WS.cur.key : null) !== key) { if (WS.cur) wsPause(WS.cur); WS.cur = key ? wsSite(key) : null; if (WS.cur) WS.cur.startT = TIME + 8; }
  while (WS.trash.length) { const i = BUILDINGS.indexOf(WS.trash.pop()); if (i >= 0) BUILDINGS.splice(i, 1); }
  const S = WS.cur; if (!S) { if (WS.hud) WS.hud.style.display = 'none'; return; } S.t += dt; if (S.crew.length > 24) S.crew = S.crew.filter(w => w.state !== 'gone');
  if (S.state === 'idle' && TIME > S.startT) wsStart(S);
  if ((S.scanT -= dt) <= 0) { S.scanT = 0.5; wsScan(S); }
  S.heat *= Math.exp(-dt / 12);
  const welders = wsRobots(S, dt); wsDrones(S, dt); wsCrane(S, dt);
  if (S.state === 'build') {
    const live = S.crew.filter(w => w.state !== 'dead' && w.state !== 'gone' && w.state !== 'leave').length;
    if (live < WS_CREW && TIME > (S.reqT || 0)) { S.reqT = TIME + 7; const roles = S.crew.filter(w => w.state !== 'dead' && w.state !== 'gone' && w.state !== 'leave').map(w => w.role); wsRobot(S, roles.filter(r => r === 'weld').length < 2 ? 'weld' : roles.includes('boss') ? 'haul' : 'boss'); }
    if (!live && S.budget <= 0) wsAbandon(S, `Every crew sent to the ${S.R.title} has been killed. The Guild is pulling out.`);
    if ((S.pickT -= dt) <= 0 || !S.cur || S.cur.dead || S.cur.i >= S.cur.path.length) { S.pickT = 8; wsPick(S); }
    const s = S.cur;
    if (s && !S.pinned) {
      const night = skyU.night ? skyU.night.value : 0, wx = S.deck ? 1 : WEATHER.state === 'snow' ? 0.6 : WEATHER.state === 'rain' ? 0.8 : 1;
      const rate = S.R.rate * (1 + Math.min(S.friends, 8) * 0.08) * (S.heat > 2 ? 1.2 : 1) * (1 - night * 0.1) * wx * Math.min(1, welders / 2) / WS_STEP;
      const T1 = WS_T[s.path[s.i]]; /* a slot that has run out of tiers is finished with, not a division by nothing */
      if (!T1) { S.cur = null; S.pickT = 0; }
      else {
        const cap = T1.cost > 0 ? s.got / T1.cost : 1; s.prog = Math.min(cap, (isFinite(s.prog) ? s.prog : 0) + rate * dt);
        if (s.prog >= 1) { wsTierUp(S, s); S.cur = null; S.pickT = 0; }
      }
    }
    if ((S.harassT -= dt) <= 0) { S.harassT = rand(1.2, 2.6); if (S.foes) wsHarass(S); }
  }
  /* visuals */
  for (const s of S.slots) {
    if (s.rise) { s.disp = lerp(s.disp || 0, s.prog, Math.min(1, dt * 5)); s.rise.scale.y = Math.max(0.02, s.disp); } /* rises smoothly, sinks back smoothly when knocked */
    if (s.pop > 0 && s.mesh) { s.pop -= dt; const k = Math.max(0, s.pop / 0.4); s.mesh.scale.set(1 + k * 0.05, 1 + Math.sin(k * Math.PI) * 0.04, 1 + k * 0.05); if (s.pop <= 0) s.mesh.scale.set(1, 1, 1); }
  }
  if (S.ringT > 0) { S.ringT -= dt; const k = 1 - S.ringT / 0.7; S.ring.visible = S.ringT > 0; S.ring.scale.setScalar(2 + k * 9); S.ringM.opacity = (1 - k) * 0.9; }
  if (S.flareT > 0) { S.flareT -= dt; S.flare.visible = S.flareT > 0; S.flare.scale.setScalar(rand(0.6, 1.3)); } else S.flare.visible = false;
  const s = S.state === 'build' ? S.cur : null; S.holo.visible = S.scan.visible = !!s;
  if (s) { const T0 = WS_T[s.path[s.i]]; S.holo.position.set(s.lx, s.gy - S.y, s.lz); S.holo.scale.set(T0.w + 0.3, T0.h + 0.2, T0.d + 0.3); S.scan.position.set(s.lx, s.gy - S.y + T0.h * (s.disp || 0) + 0.05, s.lz); S.scan.scale.set(T0.w + 0.4, 1, T0.d + 0.4); S.M.holo.color.setRGB(S.R.glow[0] * 0.035 * (0.8 + Math.sin(TIME * 4) * 0.2), S.R.glow[1] * 0.035, S.R.glow[2] * 0.035); }
  const night = skyU.night ? skyU.night.value : 0; S.coneM.opacity = S.state === 'build' ? 0.03 + night * 0.16 : 0;
  S.stack.scale.y = clamp(S.mat / 36, 0.06, 1.5); if (S.drum) S.drum.rotation.y += dt * (S.state === 'build' ? 2 : 0); S.genLamp.visible = S.state === 'build' && Math.sin(TIME * 6) > -0.3;
  if (S.bastionFx) S.bastionFx[0].material.opacity = 0.7 + Math.sin(TIME * 2) * 0.3;
  if ((S.signT -= dt) <= 0) { S.signT = 1; if (camera.position.distanceTo(_v1.set(S.x, S.y, S.z)) < 300) wsSign(S); }
  if (S.bastion && (S.healT -= dt) <= 0) { S.healT = 1; /* the bastion patches up your troops inside */
    for (const e of ENTS) if (e.alive && e.team === 1 && e.kind === 'soldier' && e.hp < e.maxHp && Math.hypot(e.pos.x - S.x, e.pos.z - S.z) < 26 && Math.abs(e.pos.y - S.y) < 14) { e.hp = Math.min(e.maxHp, e.hp + 6); if (Math.random() < 0.3 && camera.position.distanceTo(e.pos) < 80) fxSparks(_v1.set(e.pos.x, e.pos.y + 1.2, e.pos.z), 4, [0.5, 3, 1], 3); } }
  if ((S.hudT = (S.hudT || 0) - dt) <= 0) { S.hudT = 0.25; wsHud(S); for (const K in WS.sites) { const Q = WS.sites[K]; if (Q) Q.g.visible = camera.position.distanceTo(_v1.set(Q.x, Q.y, Q.z)) < 1400; } } /* far worksites stop drawing */
  /* carried crates */
  const C = WS.cargo; for (let i = 0; i < ROBO_N; i++) { const w = BLD.W[i];
    if (w && w.ws && w.carry && w.state !== 'dead' && w.state !== 'gone') { _rq.setFromAxisAngle(UP, w.yaw); _m.compose(_rp.set(w.pos.x + Math.sin(w.yaw) * 0.55, w.pos.y + 1.35 + Math.abs(Math.sin(w.t * 9)) * 0.08, w.pos.z + Math.cos(w.yaw) * 0.55), _rq, _rs.set(1, 1, 1)); } else _m.makeScale(0, 0, 0);
    C.setMatrixAt(i, _m); }
  C.instanceMatrix.needsUpdate = true;
}
