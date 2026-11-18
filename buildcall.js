'use strict';
/* ===================== IRON MERIDIAN · BUILD: a house on call, raised layer by layer =====================
   The Builder Guild no longer wanders the map raising things on its own. It comes when you call it.
   BUILD (the button left of JUMP, or the B key): a heavy truck towing a flatbed drives in from behind you with a crew
   of twenty. It pulls up at your back, the crew pile off and ring the site, and the building goes up round you the
   way all your buildings do: LAYER BY LAYER, seven of them, foundation to roof. Each layer is a whole course of the
   building; it floats in overhead, hangs a moment, and settles onto the one below.
     1 foundation slab and front step          2 walls to sill height, and the furniture
     3 the window course: piers, glass, frames  4 lintels over every door and window, and the lights
     5 the roof deck                            6 parapet, glass balustrade, stair core, roof garden
     7 the canopy on its steel columns, and the mast
   What you get is a modern flat-roofed house, 20 m by 14 m: white walls, dark steel, timber inside, big windows.
   · three rooms: a living room across the front, a bunk room and a command room behind, with doorways between;
   · every opening is real: walk through the doors (front and back), vault or shoot through the windows; the walls,
     the roof deck and the canopy stop bullets and bodies; the sills are cover for troops of either side;
   · props: sofa, rug, dining table and chairs, kitchen counter, bunks, lockers, a desk with screens, a map table,
     pendant lights, planters; on the roof, solar panels, loungers and planters. They are for show: you walk through;
   · the roof is a terrace you can land on or fly up to;
   · it faces the way you are looking when you call it (squared off to the map); about eleven seconds, call to roof;
   · two houses can stand at once; a third takes the oldest down;
   · 40 s between calls; it needs open dry ground under you (not at sea, on a ship, on a roof, or high in the air). */
const BC = { state: 'idle', cd: 0, t: 0, built: [], S: null, truck: null, trailer: null, W: [], N: 20, v: new V3(), q: new T.Quaternion(), s: new V3(1, 1, 1), req: 0, el: null, lbl: '' };
const BC_M = { wood: std(0x9a7446, 0.85, 0.05), steel: std(0x3a3f45, 0.6, 0.7), haz: std(0xd9a91e, 0.55, 0.4), cab: std(0xb5451c, 0.5, 0.5), tyre: std(0x16171a, 0.9, 0.1), vest: std(0xff7a1a, 0.7, 0.1), hat: std(0xf2d21e, 0.5, 0.2), glass: std(0x1c2a36, 0.2, 0.8), stone: std(0x77726a, 0.92, 0.04), paint: std(0xffffff, 0.82, 0.06, { vertexColors: true }), glassPane: std(0x9fd6e8, 0.08, 0.6, { transparent: true, opacity: 0.3, depthWrite: false }), light: basic(0xffffff, { vertexColors: true }) };
function bcBox(w, h, d, m, x, y, z, parent) { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; }
/* ---- the house, in the site's own frame: x across (-10..10), z deep (-7..7), front is +z ---- */
const BC_C = { wall: 0xe9e6df, dark: 0x55585c, steel: 0x24272b, timber: 0x9a6b3f, fabric: 0x5d6470, green: 0x3f7d3a, rug: 0x2f6f73, linen: 0xd8d2c4, solar: 0x1a2d52, pot: 0xb9b2a4 };
const BC_T = 0.4, BC_H = [1.0, 2.2, 3.0]; /* wall thickness; sill height, door-and-window head height, ceiling */
/* a wall: which way it runs, where it stands, from, to, its openings [from, to, door or window], inside wall? */
const BC_PLAN = [
  { ax: 'x', c: 7, a: -10, b: 10, ops: [[-8.5, -4.5, 'w'], [-1.2, 1.2, 'd'], [3.5, 8.5, 'w']] },   /* front: picture windows and the door */
  { ax: 'x', c: -7, a: -10, b: 10, ops: [[-8, -5, 'w'], [-2.5, -0.8, 'w'], [5, 6.8, 'd']] },       /* back */
  { ax: 'z', c: -10, a: -6.8, b: 6.8, ops: [[-4.5, -2, 'w'], [2, 5, 'w']] },                        /* left */
  { ax: 'z', c: 10, a: -6.8, b: 6.8, ops: [[-4.8, -2.2, 'w'], [1.5, 5, 'w']] },                     /* right */
  { ax: 'x', c: -1, a: -9.8, b: 9.8, ops: [[-6, -4.5, 'd'], [3, 4.5, 'd']], inner: true },          /* living room | the two back rooms */
  { ax: 'z', c: 0, a: -6.8, b: -1.2, ops: [[-4.6, -3.1, 'd']], inner: true }];                      /* bunk room | command room */
function bcRuns(W, kind) { /* the solid stretches of a wall in one band: 'low' has gaps at doors, 'mid' at doors and windows, 'top' none */
  if (kind === 'top') return [[W.a, W.b]]; const R = []; let at = W.a;
  for (const [s, e, t] of W.ops) { if (kind === 'low' && t === 'w') continue; if (s > at) R.push([at, s]); at = e; }
  if (W.b > at) R.push([at, W.b]); return R;
}
const bcRunBox = (W, s, e) => W.ax === 'x' ? [(s + e) / 2, W.c, e - s, BC_T] : [W.c, (s + e) / 2, BC_T, e - s]; /* [x, z, across, deep] */
function bcGeo(list) { /* boxes [w, h, d, x, y, z, colour] → one geometry with a colour on every corner */
  const P = [], N = [], C = [], col = new T.Color();
  for (const [w, h, d, x, y, z, c] of list) { const g = new T.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed(), p = g.attributes.position.array, n = g.attributes.normal.array; col.setHex(c);
    for (let i = 0; i < p.length; i += 3) { P.push(p[i], p[i + 1], p[i + 2]); N.push(n[i], n[i + 1], n[i + 2]); C.push(col.r, col.g, col.b); } g.dispose(); }
  const G = new T.BufferGeometry(); G.setAttribute('position', new T.Float32BufferAttribute(P, 3)); G.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); G.setAttribute('color', new T.Float32BufferAttribute(C, 3)); return G;
}
function bcLayer(i) { /* layer i as up to three meshes: the solid parts (walls, slabs, props), the glass, the lights */
  const S = [], G = [], L = [], c = BC_C, [h1, h2, h3] = BC_H, box = (w, h, d, x, y, z, col) => S.push([w, h, d, x, y + h / 2, z, col]); /* y is the underside */
  const walls = (kind, y0, y1) => { for (const W of BC_PLAN) for (const [s, e] of bcRuns(W, kind)) { const [x, z, w, d] = bcRunBox(W, s, e); box(w, y1 - y0, d, x, y0, z, W.inner ? c.timber : c.wall); } };
  if (i === 0) { box(21, 0.42, 15, 0, -0.18, 0, c.dark); box(4, 0.16, 1.6, 0, -0.1, 8.2, c.dark); box(3, 0.16, 1.4, 5.9, -0.1, -8.1, c.dark); }
  else if (i === 1) { walls('low', 0.14, h1);
    box(4.2, 0.03, 3, -5.6, 0.15, 3.9, c.rug); box(3.2, 0.45, 1, -5.6, 0.15, 2.2, c.fabric); box(3.2, 0.5, 0.26, -5.6, 0.6, 1.75, c.fabric); box(1, 0.45, 2, -7.7, 0.15, 3.2, c.fabric); box(1.5, 0.36, 0.8, -5.4, 0.15, 4.2, c.timber); /* living room: rug, corner sofa, low table */
    box(2.4, 0.08, 1.1, 5.6, 0.72, 3.4, c.timber); for (const sx of [-0.9, 0.9]) for (const sz of [-0.4, 0.4]) box(0.08, 0.6, 0.08, 5.6 + sx * 1.15, 0.15, 3.4 + sz, c.steel); /* dining table */
    for (const cx of [4.9, 6.3]) for (const cz of [2.5, 4.3]) { box(0.46, 0.46, 0.46, cx, 0.15, cz, c.fabric); box(0.46, 0.5, 0.08, cx, 0.6, cz + (cz < 3 ? -0.2 : 0.2), c.fabric); }
    box(4.4, 0.9, 0.7, 7.2, 0.15, -0.4, c.steel); box(4.5, 0.06, 0.76, 7.2, 1.05, -0.4, c.wall); /* kitchen counter against the inner wall */
    for (const bz of [-5.8, -2.9]) { box(1.1, 0.3, 2.1, -9.1, 0.4, bz, c.steel); box(1, 0.16, 2, -9.1, 0.7, bz, c.linen); box(1.1, 0.08, 2.1, -9.1, 1.7, bz, c.steel); box(1, 0.16, 2, -9.1, 1.78, bz, c.linen); for (const e of [-1, 1]) box(0.08, 1.9, 0.08, -8.6, 0.15, bz + e, c.steel); } /* two bunks */
    for (let k = 0; k < 3; k++) box(0.62, 1.9, 0.5, -3.4 + k * 0.68, 0.15, -6.5, c.dark); /* lockers */
    box(2.8, 0.08, 0.9, 5.6, 0.74, -6.2, c.timber); for (const e of [-1.3, 1.3]) box(0.08, 0.6, 0.8, 5.6 + e, 0.15, -6.2, c.steel); box(0.5, 0.5, 0.5, 5.6, 0.15, -5.2, c.fabric); /* desk and stool */
    box(1.8, 0.8, 1.8, 3.2, 0.15, -3.4, c.dark); L.push([1.6, 0.04, 1.6, 3.2, 0.98, -3.4, 0x62f2de]); /* the map table, lit */
    for (const e of [-1, 1]) { box(0.8, 0.6, 0.8, e * 2.4, 0.15, 7.9, c.pot); box(0.66, 0.5, 0.66, e * 2.4, 0.75, 7.9, c.green); } /* planters by the door */
  } else if (i === 2) { walls('mid', h1, h2);
    for (const W of BC_PLAN) for (const [s, e, t] of W.ops) { if (t !== 'w') continue; const [x, z, w, d] = bcRunBox(W, s, e), lx = W.ax === 'x'; G.push([lx ? w : 0.06, h2 - h1, lx ? 0.06 : d, x, (h1 + h2) / 2, z]); /* a pane, a sill bar, a mullion every 1.5 m or so */
      box(lx ? w : 0.16, 0.07, lx ? 0.16 : d, x, h1, z, c.steel); const n = Math.round((e - s) / 1.5); for (let k = 1; k < n; k++) { const m = s + (e - s) * k / n; box(lx ? 0.07 : 0.14, h2 - h1, lx ? 0.14 : 0.07, lx ? m : x, h1, lx ? z : m, c.steel); } }
    for (const e of [-0.5, 0.5]) { box(0.9, 0.56, 0.05, 5.6 + e * 2, 1.05, -6.5, c.steel); L.push([0.8, 0.46, 0.02, 5.6 + e * 2, 1.33, -6.46, 0x62f2de]); } /* two screens on the desk */
  } else if (i === 3) { walls('top', h2, h3);
    for (const W of BC_PLAN) if (!W.inner) { const [x, z, w, d] = bcRunBox(W, W.a, W.b); box(w + 0.1, 0.1, d + 0.1, x, h2 - 0.05, z, c.steel); } /* a dark line over the openings */
    for (const [x, z] of [[-5.6, 3.6], [5.6, 3.4], [-5, -4], [5, -4]]) { box(0.03, 0.5, 0.03, x, h3 - 0.5, z, c.steel); L.push([0.34, 0.16, 0.34, x, h3 - 0.58, z, 0xfff0c2]); } /* pendant lights */
  } else if (i === 4) { box(21.2, 0.3, 15.2, 0, h3, 0, c.wall); box(21.4, 0.1, 15.4, 0, h3 + 0.2, 0, c.steel); }
  else if (i === 5) { const y = h3 + 0.3;
    box(20.8, 0.8, 0.3, 0, y, -7.3, c.wall); for (const e of [-1, 1]) box(0.3, 0.8, 14.3, e * 10.25, y, 0, c.wall); G.push([20.8, 0.9, 0.06, 0, y + 0.45, 7.35]); box(20.8, 0.06, 0.12, 0, y + 0.9, 7.35, c.steel); /* parapet on three sides, glass along the front */
    box(2.6, 2.4, 2.6, -8.4, y, -5.6, c.timber); box(0.06, 1.9, 1, -7.08, y, -5.6, c.steel); /* the stair core, timber clad, with its door */
    for (let k = 0; k < 3; k++) { box(1.9, 0.08, 1.1, -3.6 + k * 2.2, y + 0.35, -5.6, c.solar); box(0.1, 0.35, 0.1, -3.6 + k * 2.2, y, -5.6, c.steel); } /* solar panels */
    for (const x of [-8.5, -4.5, 0.5]) { box(1.8, 0.5, 0.6, x, y, 6.6, c.pot); box(1.6, 0.4, 0.46, x, y + 0.5, 6.6, c.green); } /* planters along the glass */
    for (const x of [5.2, 7.2]) { box(0.7, 0.28, 1.9, x, y, 3.4, c.timber); box(0.7, 0.4, 0.12, x, y + 0.28, 2.5, c.timber); } /* two loungers under the canopy */
  } else { const y = h3 + 0.3;
    for (const x of [2.2, 9.4]) for (const z of [0.4, 6.4]) box(0.16, 2.5, 0.16, x, y, z, c.steel);
    box(8.2, 0.22, 7, 5.8, y + 2.5, 3.4, c.wall); box(8, 0.06, 6.8, 5.8, y + 2.44, 3.4, c.timber); /* the canopy: white above, timber below */
    box(0.08, 2.6, 0.08, -8.4, y + 2.4, -5.6, c.steel); L.push([0.16, 0.16, 0.16, -8.4, y + 5.05, -5.6, 0xff5540]); /* the mast and its lamp */
  }
  const g = new T.Group(), m = new T.Mesh(bcGeo(S), BC_M.paint); m.castShadow = true; m.receiveShadow = true; g.add(m);
  if (G.length) g.add(new T.Mesh(bcGeo(G.map(b => [...b, 0xffffff])), BC_M.glassPane)); if (L.length) g.add(new T.Mesh(bcGeo(L), BC_M.light));
  return g;
}
function bcSolid(S, i) { /* layer i has landed: its walls and slabs become real, each from its own underside to its own top */
  const [h1, h2, h3] = BC_H, turn = Math.abs(S.sn) > 0.5, y = h3 + 0.3;
  const add = (lx, lz, w, d, y0, y1) => { bcW(S, lx, lz, BC.v); const B = new Building(BC.v.x, BC.v.z, turn ? d : w, turn ? w : d, y1 - y0, { mesh: new T.Group(), hp: 1e9 }); B.gy = S.gy + y0; B.top = S.gy + y1; B.bcall = S; BUILDINGS.push(B); S.B.push(B); };
  if (i === 1) for (const W of BC_PLAN) for (const [s, e] of bcRuns(W, 'low')) { const [x, z, w, d] = bcRunBox(W, s, e), n = COVER.length, B = fortRect(S, x, z, w, d, h1); B.fort = null; B.bcall = S; S.B.push(B); for (let k = n; k < COVER.length; k++) S.cv.push(COVER[k]); } /* sills: also cover */
  else if (i === 2) for (const W of BC_PLAN) for (const [s, e] of bcRuns(W, 'mid')) { const [x, z, w, d] = bcRunBox(W, s, e); add(x, z, w, d, h1, h2); }
  else if (i === 3) for (const W of BC_PLAN) { const [x, z, w, d] = bcRunBox(W, W.a, W.b); add(x, z, w, d, h2, h3); }
  else if (i === 4) add(0, 0, 21.2, 15.2, h3, y);
  else if (i === 5) { add(0, -7.3, 20.8, 0.3, y, y + 0.8); add(0, 7.35, 20.8, 0.3, y, y + 0.9); for (const e of [-1, 1]) add(e * 10.25, 0, 0.3, 14.3, y, y + 0.8); add(-8.4, -5.6, 2.6, 2.6, y, y + 2.4); }
  else if (i === 6) add(5.8, 3.4, 8.2, 7, y + 2.5, y + 2.72);
  B_GRID.n = -1;
}
function bcTruckModels() {
  if (BC.truck) return;
  const t = new T.Group(), part = (geo, m, x, y, z, par) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; par.add(o); return o; }; /* the tractor: nose toward +z. Rounded panels, round tanks, stacks and wheels: no bare boxes */
  const wheel = (par, x, z, r) => { part(new T.CylinderGeometry(r, r, 0.5, 18).rotateZ(Math.PI / 2), BC_M.tyre, x, r, z, par); part(new T.CylinderGeometry(r * 0.5, r * 0.5, 0.54, 12).rotateZ(Math.PI / 2), BC_M.steel, x, r, z, par); part(new T.TorusGeometry(r * 1.08, 0.07, 5, 14, Math.PI).rotateY(Math.PI / 2), BC_M.steel, x, r + 0.05, z, par); };
  part(rbox(2.7, 2.5, 2.6, 0.32), BC_M.cab, 0, 2.15, 1.2, t); part(rbox(2.5, 1.0, 0.12, 0.05), BC_M.glass, 0, 2.75, 2.5, t); part(rbox(2.6, 1.15, 1.7, 0.3), BC_M.cab, 0, 1.45, 3.2, t); part(rbox(2.8, 0.5, 5.6, 0.1), BC_M.steel, 0, 0.85, 0.4, t);
  for (const e of [-1, 1]) { part(new T.CylinderGeometry(0.13, 0.13, 2.8, 10), BC_M.steel, e * 1.15, 3.0, -0.3, t); part(new T.CylinderGeometry(0.17, 0.13, 0.5, 10), BC_M.steel, e * 1.15, 4.5, -0.3, t); /* exhaust stacks */
    part(new T.CylinderGeometry(0.42, 0.42, 1.5, 14).rotateX(Math.PI / 2), BC_M.steel, e * 1.25, 0.95, 1.0, t); part(new T.SphereGeometry(0.2, 10, 8), BC_M.haz, e * 1.0, 1.5, 4.08, t); } /* fuel tanks, headlamps */
  part(rbox(2.9, 0.34, 0.45, 0.12), BC_M.haz, 0, 0.75, 4.05, t); part(new T.CylinderGeometry(0.9, 0.9, 0.12, 20), BC_M.steel, 0, 1.16, -1.4, t); /* bumper, fifth wheel */
  for (const z of [3.0, -0.9, -2.0]) for (const x of [-1.35, 1.35]) wheel(t, x, z, 0.62);
  const r = new T.Group(); /* the flatbed it tows: hitch at +z end */
  part(rbox(3.0, 0.4, 11, 0.08), BC_M.steel, 0, 1.25, -5.5, r); part(rbox(3.1, 0.14, 11.1, 0.05), BC_M.haz, 0, 1.02, -5.5, r); part(new T.CylinderGeometry(0.12, 0.12, 1.6, 8).rotateX(Math.PI / 2), BC_M.steel, 0, 1.1, 0.6, r);
  for (const z of [-0.4, -5.5, -10.6]) for (const e of [-1, 1]) part(new T.CylinderGeometry(0.06, 0.06, 0.9, 6), BC_M.steel, e * 1.45, 1.9, z, r); /* stake posts */
  for (const z of [-7.6, -8.8, -10]) for (const x of [-1.4, 1.4]) wheel(r, x, z, 0.58);
  BC.pack = new T.Group(); for (let i = 0; i < 7; i++) bcBox(2.6, 0.3, 4.6, i === 0 ? BC_M.stone : i & 1 ? BC_M.wood : BC_M.steel, 0, 1.6 + i * 0.31, -8.2, BC.pack); /* the seven layers, flat-packed */ r.add(BC.pack); /* the flat-packed walls at the tail */
  scene.add(t); scene.add(r); BC.truck = t; BC.trailer = r; t.visible = r.visible = false;
  /* the crew: rounded people, not box men. A capsule torso, tapered limbs, a head, a domed hard hat with a brim */
  const lim = (rt, rb, h, x, y, z, rx) => { const q = new T.CylinderGeometry(rt, rb, h, 8); if (rx) q.rotateX(rx); return q.translate(x, y, z); };
  const body = mergeGeos([new T.CapsuleGeometry(0.27, 0.42, 4, 10).scale(1.1, 1, 0.78).translate(0, 1.25, 0), lim(0.13, 0.1, 0.85, -0.16, 0.43, 0), lim(0.13, 0.1, 0.85, 0.16, 0.43, 0), lim(0.09, 0.075, 0.62, -0.4, 1.22, 0.14, -0.45), lim(0.09, 0.075, 0.62, 0.4, 1.22, 0.14, -0.45), new T.SphereGeometry(0.11, 8, 6).scale(1, 0.6, 1.5).translate(-0.16, 0.05, 0.06), new T.SphereGeometry(0.11, 8, 6).scale(1, 0.6, 1.5).translate(0.16, 0.05, 0.06)]);
  const hat = mergeGeos([new T.SphereGeometry(0.17, 12, 9).translate(0, 1.76, 0), new T.SphereGeometry(0.21, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.82, 0), new T.CylinderGeometry(0.27, 0.28, 0.035, 14).translate(0, 1.83, 0.03)]);
  BC.mb = new T.InstancedMesh(body, BC_M.vest, BC.N); BC.mh = new T.InstancedMesh(hat, BC_M.hat, BC.N); for (const m of [BC.mb, BC.mh]) { m.frustumCulled = false; m.castShadow = true; m.visible = false; scene.add(m); }
  for (let i = 0; i < BC.N; i++) BC.W.push({ pos: new V3(), tgt: new V3(), yaw: 0, ph: Math.random() * 6, on: true, });
}
const bcW = (S, lx, lz, out) => out.set(S.x + lx * S.c + lz * S.sn, S.gy, S.z - lx * S.sn + lz * S.c);
function bcTear(S) { /* take a position down */
  for (const B of S.B) { const i = BUILDINGS.indexOf(B); if (i >= 0) BUILDINGS.splice(i, 1); }
  for (const cv of S.cv) { const L = COVER_GRID.get(cgk(cv.x, cv.z)); if (L) { const j = L.indexOf(cv); if (j >= 0) L.splice(j, 1); } const j = COVER.indexOf(cv); if (j >= 0) COVER.splice(j, 1); }
  scene.remove(S.g); B_GRID.n = -1; fxDust(new V3(S.x, S.gy + 1, S.z), 14, 6, 6);
}
function bcCall() {
  const pe = PLAYER.ent; if (BC.state !== 'idle' || BC.cd > 0 || GAME.state !== 'play' || !pe || !pe.alive || PLAYER.pod) return;
  const g0 = groundY(pe.pos.x, pe.pos.z);
  if (H(pe.pos.x, pe.pos.z) < -0.6 || pe.pos.y - g0 > 25 || deckAt(pe.pos.x, pe.pos.z, pe.pos.y + 1) || buildingAt(BC.v.set(pe.pos.x, g0 + 1, pe.pos.z))) { /* at sea, high up, on a deck, or on or in a building */ banner('Builders can\'t reach you here', 'They need open dry ground under you', 'var(--amber)'); BC.cd = 2; return; }
  bcTruckModels();
  const yaw = Math.round((PLAYER.yaw + Math.PI) / (Math.PI / 2)) * (Math.PI / 2), S = BC.S = { x: pe.pos.x, z: pe.pos.z, gy: groundY(pe.pos.x, pe.pos.z), yaw, c: Math.cos(yaw), sn: Math.sin(yaw), B: [], cv: [], walls: [], g: new T.Group(), up: 0 };
  S.g.position.set(S.x, S.gy, S.z); S.g.rotation.y = yaw; scene.add(S.g);
  S.lay = []; for (let i = 0; i < 7; i++) { const m = bcLayer(i); m.visible = false; S.g.add(m); S.lay.push({ m, k: 0 }); }
  /* the truck comes in from behind you and parks at the open back, nose out along your left */
  bcW(S, 0, -16, BC.v); S.park = BC.v.clone(); S.parkYaw = yaw + Math.PI / 2;
  let from = null; for (const d of [120, 90, 150]) { const fx = S.x - S.sn * d, fz = S.z - S.c * d; if (H(fx, fz) > 0.3) { from = new V3(fx, 0, fz); break; } }
  if (!from) { const L = landNear(S.x - S.sn * 100, S.z - S.c * 100, 60); from = new V3(L.x, 0, L.z); }
  const T0 = BC.truck; T0.position.set(from.x, groundY(from.x, from.z), from.z); BC.tyaw = Math.atan2(S.park.x - from.x, S.park.z - from.z); BC.ryaw = BC.tyaw; BC.spd = 0;
  BC.trailer.position.copy(T0.position); T0.visible = BC.trailer.visible = BC.pack.visible = true; BC.mb.visible = BC.mh.visible = true;
  for (const w of BC.W) w.on = true;
  BC.state = 'drive'; BC.t = 0; BC.cd = 40;
  comms('Builder Guild', 'Crew of twenty and a fighting position, rolling to you now.', 'cmd'); snd('clank', null, 0.5);
}
function bcDrive(dt, to, toYaw, top) { /* straight there, easing in; the flatbed swings along behind on its hitch */
  const T0 = BC.truck, R = BC.trailer, dx = to.x - T0.position.x, dz = to.z - T0.position.z, d = Math.hypot(dx, dz);
  BC.spd += (Math.min(top, Math.max(2.5, d * 1.3)) - BC.spd) * Math.min(1, dt * 2.5);
  if (d > 0.4) { const st = Math.min(d, BC.spd * dt); T0.position.x += dx / d * st; T0.position.z += dz / d * st; BC.tyaw = angLerp(BC.tyaw, d > 9 || toYaw === null ? Math.atan2(dx, dz) : toYaw, Math.min(1, dt * 2.2)); }
  T0.position.y += (groundY(T0.position.x, T0.position.z) - T0.position.y) * Math.min(1, dt * 8); T0.rotation.y = BC.tyaw;
  const hx = T0.position.x - Math.sin(BC.tyaw) * 2.6, hz = T0.position.z - Math.cos(BC.tyaw) * 2.6; /* the hitch */
  BC.ryaw = angLerp(BC.ryaw, BC.tyaw, Math.min(1, dt * (0.6 + BC.spd * 0.12))); R.position.set(hx - Math.sin(BC.ryaw) * 1.4, T0.position.y, hz - Math.cos(BC.ryaw) * 1.4); R.rotation.y = BC.ryaw;
  if (BC.spd > 4 && (FRAMEN & 3) === 0) fxDust(BC.v.set(R.position.x - Math.sin(BC.ryaw) * 9, R.position.y + 0.3, R.position.z - Math.cos(BC.ryaw) * 9), 1, 2.5, 3);
  return d;
}
function bcBed(i, out) { /* a worker's place on the flatbed: two files of ten */
  const R = BC.trailer, lx = (i & 1 ? 0.75 : -0.75), lz = -0.6 - (i >> 1) * 0.72, c = Math.cos(BC.ryaw), s = Math.sin(BC.ryaw);
  return out.set(R.position.x + lx * c + lz * s, R.position.y + 1.45, R.position.z - lx * s + lz * c);
}
function bcCrew(dt, run) {
  for (let i = 0; i < BC.N; i++) { const w = BC.W[i]; let bob = 0, lean = 0;
    if (w.on) { bcBed(i, w.pos); w.yaw = BC.ryaw; }
    else { const dx = w.tgt.x - w.pos.x, dz = w.tgt.z - w.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.25) { const st = Math.min(d, 9.5 * dt); w.pos.x += dx / d * st; w.pos.z += dz / d * st; w.yaw = Math.atan2(dx, dz); bob = Math.abs(Math.sin(TIME * 14 + w.ph)) * 0.16; }
      else if (run === 'home') { w.on = true; }
      else { w.yaw = angLerp(w.yaw, w.face, Math.min(1, dt * 10)); bob = Math.abs(Math.sin(TIME * 11 + w.ph)) * 0.1; lean = 0.35; } /* at the wall: heaving */
      w.pos.y += (groundY(w.pos.x, w.pos.z) - w.pos.y) * Math.min(1, dt * 12); }
    BC.q.setFromEuler(BC_E.set(lean, w.yaw, 0, 'YXZ')); _m.compose(BC.v.set(w.pos.x, w.pos.y + bob, w.pos.z), BC.q, BC.s); BC.mb.setMatrixAt(i, _m); BC.mh.setMatrixAt(i, _m); }
  BC.mb.instanceMatrix.needsUpdate = BC.mh.instanceMatrix.needsUpdate = true;
}
const BC_E = new T.Euler();
function bcTick(dt) {
  if (BC.cd > 0) BC.cd -= dt;
  if (BC.req > 0) { BC.req = 0; bcCall(); }
  if (BC.el) { const l = BC.state !== 'idle' ? 'BUILDING' : BC.cd > 0 ? Math.ceil(BC.cd) + ' s' : 'BUILD'; if (l !== BC.lbl) { BC.lbl = l; BC.el.textContent = l; BC.el.style.opacity = l === 'BUILD' ? '' : '0.45'; } }
  const S = BC.S; if (BC.state === 'idle' || !S) return; BC.t += dt;
  if (BC.state === 'drive') {
    const d = bcDrive(dt, S.park, S.parkYaw, 30); bcCrew(dt);
    if (d < 0.6 || BC.t > 14) { BC.state = 'unload'; BC.t = 0; BC.pack.visible = false; snd('clank', BC.truck.position, 0.8);
      for (let i = 0; i < BC.N; i++) { const w = BC.W[i], a = (i + 0.5) / BC.N * 6.2832, cx = Math.sin(a), cz = Math.cos(a), k = Math.min(11.8 / Math.abs(cx || 1e-6), 8.8 / Math.abs(cz || 1e-6)); w.on = false; /* a ring of hands round the outside, facing in */
        bcW(S, cx * k, cz * k, w.tgt); w.face = Math.atan2(S.x - w.tgt.x, S.z - w.tgt.z); }
    }
  } else if (BC.state === 'unload') { bcCrew(dt); if (BC.t > 1.5) { BC.state = 'raise'; BC.t = 0; }
  } else if (BC.state === 'raise') {
    bcCrew(dt);
    for (let i = 0; i < 7; i++) { const L = S.lay[i], k = clamp((BC.t - i * 0.5) / 0.95, 0, 1); if (k === L.k) continue; const was = L.k; L.k = k; /* a layer floats in 7 m overhead, hangs, and settles */
      const e = k < 0.35 ? 0 : 1 - Math.pow(1 - (k - 0.35) / 0.65, 2.4); L.m.visible = true; L.m.position.y = (1 - e) * 7 + Math.sin(TIME * 9 + i) * 0.06 * (1 - e);
      if ((FRAMEN & 7) === 0) snd('clank', S.g.position, 0.35);
      if (k >= 1 && was < 1) { L.m.position.y = 0; snd(i === 4 ? 'big' : 'stomp', S.g.position, 0.7); bcSolid(S, i); BC.v.set(S.x, S.gy + [0.2, 0.6, 1.6, 2.6, 3.2, 3.8, 5.8][i], S.z); fxDust(BC.v, 10, 9, 5); } }
    if (BC.t > 6 * 0.5 + 1.15) { BC.state = 'leave'; BC.t = 0; BC.built.push(S); if (BC.built.length > 2) bcTear(BC.built.shift());
      for (let i = 0; i < BC.N; i++) bcBed(i, BC.W[i].tgt);
      banner('House built', 'Seven layers, foundation to roof · three rooms · doors front and back · roof terrace', 'var(--amber)'); comms('Builder Guild', 'Position\'s up. Keep your head down. We\'re gone.', 'cmd');
      const a = S.parkYaw; S.out = new V3(S.park.x + Math.sin(a) * 160, 0, S.park.z + Math.cos(a) * 160); }
  } else if (BC.state === 'leave') {
    for (let i = 0; i < BC.N; i++) if (!BC.W[i].on) bcBed(i, BC.W[i].tgt); /* the bed is where they are running to, wherever it is */
    const aboard = BC.W.every(w => w.on) || BC.t > 4; if (aboard) for (const w of BC.W) w.on = true;
    const d = aboard ? bcDrive(dt, S.out, null, 26) : (bcDrive(dt, S.park, S.parkYaw, 0), 99); bcCrew(dt, 'home');
    if (aboard && (BC.t > 9 || d < 5 || camera.position.distanceTo(BC.truck.position) > 170)) { BC.truck.visible = BC.trailer.visible = BC.mb.visible = BC.mh.visible = false; BC.state = 'idle'; BC.S = null; }
  }
}
{
  BC.el = document.getElementById('tBuild');
  if (BC.el) BC.el.addEventListener('touchstart', e => { e.preventDefault(); BC.req = 1; }, { passive: false });
  window.addEventListener('keydown', e => { if (e.code === 'KeyB' && !e.repeat) BC.req = 1; });
  /* the Guild's own wandering crews, fortress sites and battle works are stood down: nothing is built unless you call it */
  for (const m of [ROBO.mb, ROBO.mg]) m.visible = false;
  updateBuilders = function () {}; updateWorks = function () {};
  const _uw = updateWorld; updateWorld = function (dt) { _uw(dt); bcTick(dt); };
  const _nw = newWar; newWar = function () { _nw.apply(this, arguments); while (BC.built.length) bcTear(BC.built.pop()); };
}
