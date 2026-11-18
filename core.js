'use strict';
/* ===================== IRON MERIDIAN · core ===================== */
const T = THREE, V3 = T.Vector3;
const $c = new Map(); const $ = s => { let e = $c.get(s); if (!e || !e.isConnected) { e = document.querySelector(s); if (e) $c.set(s, e); } return e; }; // cached element lookups
const sty = (el, k, v) => { const c = el._sty || (el._sty = {}); if (c[k] !== v) { c[k] = v; el.style[k] = v; } }; // write a style only when it changes
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const pick = a => a[(Math.random() * a.length) | 0];
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const angLerp = (a, b, t) => a + angDiff(a, b) * Math.min(1, t);
const _v1 = new V3(), _v2 = new V3(), _v3 = new V3(), _v4 = new V3(), _v5 = new V3(), _v6 = new V3();
const _q = new T.Quaternion(), _q2 = new T.Quaternion(), _m = new T.Matrix4(), _s = new V3(), _c = new T.Color();
const ZAX = new V3(0, 0, 1), UP = new V3(0, 1, 0);
const randDir = (out) => { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); return out.set(r * Math.cos(a), u, r * Math.sin(a)); };

let TIME = 0;
const GAME = { state: 'menu', tickets: { 1: 600, 2: 600 }, maxTickets: 600, clock: 0 }; /* tickets = each army's strength, field + reserve (war.js) */
const TEAM = {
  1: { name: 'The Heroes', short: 'Heroes', css: 'b', hex: 0x5ccaff, laser: [0.45, 0.95, 2.4], tracer: [1.4, 1.6, 2.2] },
  0: { name: 'Wild', short: 'Wild', css: '', hex: 0xd8c49a, laser: [2, 2, 2], tracer: [2, 2, 2] },
  3: { name: 'The Titan', short: 'Titan', css: 'r', hex: 0x38d8ff, laser: [0.8, 3, 4], tracer: [1, 2, 3] },
  2: { name: 'The Villains', short: 'Villains', css: 'r', hex: 0xff5d3d, laser: [2.6, 0.45, 0.18], tracer: [2.2, 1.1, 0.35] },
  4: { name: 'Ashen Pact', short: 'Ashen', css: 'a', hex: 0xffb02e, laser: [2.6, 1.7, 0.3], tracer: [2.4, 1.8, 0.6] },
  5: { name: 'Verdant Host', short: 'Verdant', css: 'g', hex: 0x5fe08a, laser: [0.5, 2.6, 0.9], tracer: [0.9, 2.3, 1.1] },
};

/* ---------------- device tier: phones/tablets and low-core machines get a lighter default build ---------------- */
const IS_TOUCH = typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0);
const IS_MOBILE = IS_TOUCH && !!window.screen && Math.min(window.screen.width, window.screen.height) < 820;
const LOW_END = IS_MOBILE || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
/* ---------------- renderer / scene ---------------- */
const canvas = $('#game');
const renderer = new T.WebGLRenderer({ canvas, antialias: false, stencil: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LOW_END ? 1 : 1.5));
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = LOW_END ? T.PCFShadowMap : T.PCFSoftShadowMap;
const scene = new T.Scene();
const FOG = new T.Color(0x584a3c);
const FOG_D = 0.00095;
scene.fog = new T.FogExp2(FOG, FOG_D);
scene.background = FOG.clone();
const camera = new T.PerspectiveCamera(70, 1, 0.3, 12000);
camera.position.set(0, 80, 300);
/* Debug handles: inspectors and screenshot harnesses expect these three on window. */
if (typeof window !== 'undefined') { window.scene = scene; window.renderer = renderer; window.camera = camera; }

const SUN_DIR = new V3(-0.62, 0.36, 0.42).normalize(), LIGHT_DIR = SUN_DIR.clone(); /* SUN_DIR is the sun in the sky; LIGHT_DIR is the key light (sun by day, moon by night) */
const sun = new T.DirectionalLight(0xffbf85, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
{ const c = sun.shadow.camera; c.left = -150; c.right = 150; c.top = 150; c.bottom = -150; c.near = 10; c.far = 900; }
sun.shadow.bias = -0.00015; sun.shadow.normalBias = 0.08;
const SHB = new T.Matrix4().lookAt(SUN_DIR, new V3(), UP), SHBi = SHB.clone().invert();
scene.add(sun, sun.target);
const hemi = new T.HemisphereLight(0x8e9bb0, 0x3d3127, 0.8); scene.add(hemi);
const rim = new T.DirectionalLight(0x6f8cff, 0.35); rim.position.set(0.6, 0.4, -0.7); scene.add(rim);

/* ---------------- noise + heightmap ---------------- */
function hash2(x, y) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v); }
function fbm(x, y, o = 4) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); n += a; a *= 0.5; f *= 2.03; } return s / n; }

/* The districts of Aeris Island. There are no lettered posts: armies fight over named places, and where a place
   sits on the island is what makes it worth holding — the plaza under the Apex Spire, the ring of canals, the rail head
   up to the peaks, the ash fields under the volcano, the dam that holds the sea off the lowland, the wilds nobody
   rebuilt. Three of them leave the ground entirely (realms.js): the marina floats offshore, the skyport hangs over
   the plaza, the array is in orbit. `tag` is the short name the HUD, markers and map draw. */
const CPDEF = [
  { id: 'apex', tag: 'DOWNTOWN', name: 'Downtown Core', realm: 'land', x: -25, z: 55, owner: 0 },
  { id: 'canal', tag: 'STADIUM', name: 'Aeris Stadium', realm: 'land', x: -290, z: 90, owner: 1 },
  { id: 'rail', tag: 'AIRPORT', name: 'Aeris International Airport', realm: 'land', x: 60, z: -325, owner: 2 },
  { id: 'peaks', tag: 'FALLS', name: 'Waterfall Valley', realm: 'land', x: 285, z: -205, owner: 2 },
  { id: 'ash', tag: 'VOLCANO', name: 'Volcano Reaches', realm: 'land', x: -205, z: -292, owner: 2 }, /* a terrace on the volcano's flank */
  { id: 'dam', tag: 'PORT', name: 'Maritime Port', realm: 'land', x: 330, z: 290, owner: 1 },
  { id: 'wilds', tag: 'SECTOR', name: 'Annexed Sector 01', realm: 'land', x: -385, z: 20, owner: 1 },
  { id: 'marina', tag: 'MARINA', name: 'Floating Marina', realm: 'land', x: 170, z: 490, owner: 1 },
  { id: 'skyport', tag: 'SKY', name: 'Skyport', realm: 'land', x: 120, z: -60, owner: 0 },
  { id: 'orbital', tag: 'ORBIT', name: 'Orbital Array', realm: 'land', x: 240, z: -340, owner: 2 },
];
const DIST = id => CPDEF.find(c => c.id === id); /* districts by name, never by position in the list */
const HQ = { 1: { x: -70, z: 385, name: 'Hero Muster' }, 2: { x: 140, z: -425, name: 'Villain Lair' } };
const ARMIES = [1, 2]; // two sides: fifteen Heroes against fifteen Villains, fighting over the people of Aeris Island
const isHostile = t => t === 2 || t === 4 || t === 5; // hostile to the Commander
const TEAM_CSS = { 0: '#e8d9a0', 1: '#5ccaff', 2: '#ff5d3d', 3: '#b47cff', 4: '#ffb02e', 5: '#5fe08a' }; // HQs 0.8 km apart, either end of the island
/* AERIS ISLAND: about 1.17 km square of map with sea all round it. The island is a lobed disc about a kilometre
   across: the volcano's shoulder pushes out to the north-west, a bay bites into the south-west (the archipelago and
   the naval blockade), and a harbour opens to the south-east (the port). North is -z. */
const gss = v => Math.exp(-v * v);
function islandR(a) {
  let r = 492 + Math.sin(3 * a + 0.7) * 26 + Math.sin(5 * a + 2) * 14 + Math.sin(9 * a) * 7;
  r -= 105 * gss((a - 2.03) / 0.2);      /* the south-west bay */
  r -= 45 * gss((a - 0.78) / 0.12);      /* the south-east harbour */
  r += 30 * gss((a + 2.36) / 0.3);       /* the volcano's shoulder */
  return r;
}
const coastEdge = (x, z) => islandR(Math.atan2(z, x)) - Math.hypot(x, z); /* metres inside the shore (negative: at sea) */
/* the east shore at a given z: the navy's lanes, the titan's landfall, the tsunami line */
const coastX = z => { const zz = clamp(z, -430, 430); let x = 470; for (let i = 0; i < 4; i++) { const r = islandR(Math.atan2(zz, x)); x = Math.sqrt(Math.max(400, r * r - zz * zz)); } return x; };
/* small islands off the south-west coast: palms, beaches and bridges */
const ISLETS = [[-215, 505, 34], [-140, 535, 26], [-70, 520, 30], [-280, 470, 22], [10, 548, 20]];

/* the Aeris river: falls out of Waterfall Valley in the north-east, runs west under the airport and north of
   downtown, and meets the sea on the west coast past the volcano's foot */
const RIV = [[318, -248], [262, -236], [170, -246], [60, -252], [-50, -250], [-150, -236], [-240, -205], [-330, -176], [-420, -176], [-560, -182]];
const riverZ = x => { if (x >= RIV[0][0]) return RIV[0][1]; for (let i = 0; i < RIV.length - 1; i++) { const [ax, az] = RIV[i], [bx, bz] = RIV[i + 1]; if (x <= ax && x >= bx) return lerp(az, bz, (ax - x) / (ax - bx)); } return RIV[RIV.length - 1][1]; };
function riverD(x, z) { let best = 1e9; for (let i = 0; i < RIV.length - 1; i++) { const [ax, az] = RIV[i], [bx, bz] = RIV[i + 1], dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1), d = Math.hypot(x - ax - dx * t, z - az - dz * t); if (d < best) best = d; } return best; }
const BRIDGES = [-150, 40, 210].map(x => ({ x, z: riverZ(x) }));
// trench lines either side of the river: Hero lines on the south bank, Villain lines dug into the north bank
const zig = (x0, x1, zf, amp) => { const p = []; for (let x = x0, k = 0; x <= x1; x += 55, k++) p.push([x, zf(x) + (k % 2 ? amp : -amp)]); return p; };
const TRENCHES = [zig(-340, -200, x => riverZ(x) + 62, 12), zig(160, 300, x => riverZ(x) + 72, 12), zig(-215, -95, x => riverZ(x) - 58, 12), zig(210, 290, x => riverZ(x) - 55, 12)];
function trenchD(x, z) { let best = 1e9; for (const L of TRENCHES) for (let i = 0; i < L.length - 1; i++) { const [ax, az] = L[i], [bx, bz] = L[i + 1]; if (x < Math.min(ax, bx) - 20 || x > Math.max(ax, bx) + 20) continue; const dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1); best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return best; }
const VOLCANO = { x: -300, z: -305, h: 168 }, CITYC = { x: 30, z: 30 };
/* DOWNTOWN ON THE MESA: the city stands on a plateau 230 m above the island, ringed by cliffs. Two switchback roads
   are cut into the cliff faces: one down the west face toward the stadium side, one down to the north-east by the dome
   and the river bridges. `a` is the bearing around the mesa (atan2(dz, dx)): t = 0 at the top, 1 at the bottom. */
const MESA = { top: 230, r0: 200, r1: 246 };
const RAMPS = [{ a0: 1.95, a1: 3.7, r: 223, w: 10 }, { a0: -2.1, a1: -0.35, r: 223, w: 10 }]; /* south-west rim down the west face; north-west rim down to the east */
/* THE MESA BUNKER (the secure sub-surface gate): a great opening cut into the south face of the mesa, down to the
   island floor: a hall 90 m wide and 53 m deep under a fortified block that carries the mesa's surface over its roof,
   and a 14 m forecourt in front. The southern highway runs straight in. Grid-aligned so its walls come out clean;
   aeris.js builds the gate and the hall. */
const BUNKER = { x0: -15, x1: 75, back: 212, face: 250, front: 264, floor: 1.5, ceil: 104, /* tall enough for the flight gap to run straight through */
  ramp: { x0: 58, x1: 72, z0: 216, z1: 232, bottom: 1.5 },     /* the glass-tunnel station on the lower floor (the tube starts here) */
  lift: { x: -6, z: 220 } };                                    /* the way up: the lift shaft to the mesa top */
const inBunker = (x, z) => x > BUNKER.x0 && x < BUNKER.x1 && z > BUNKER.back && z < BUNKER.front;
/* THE AERIS UNDERPASS: a road tunnel under the whole mesa, at ground level, from the bunker gate in the south to a
   portal in the north face that lines up with the river bridge to the airport. Downtown sits over it like a bridge
   deck; through the bunker hall the road runs on a raised causeway with the bunker's lower floor either side. */
const UNDERPASS = { x0: 5, x1: 55, zN: -226, zS: 264, floor: 7, ceil: 100, faceN: -197 }; /* THE GAP: 50 m wide and over 90 m high, so aircraft fly right under downtown */
/* THE HIVE: a spiral road inside downtown's mesa. A round shaft cut into the east cliff holds a ramp that winds 12 and
   a half turns from the floor to the top; at the bottom a tunnel runs out east through the cliff to the island road,
   at the top a short bridge joins the Orbital Highway ring. hive.js builds it. */
const HIVE = { x: 215, z: 30, R: 22, floor: 8, Rh: 15, hw: 4, turns: 14.5, tw: 6, tx0: 228, tx1: 296, ceil: 24 }; /* all inside the rock: only the top and the tunnel mouth are open */
const inHivePit = (x, z) => Math.hypot(x - HIVE.x, z - HIVE.z) < HIVE.R + 7.5; /* cut wider than the wall, so the rough cut stays hidden behind it */
const inHiveTun = (x, z) => x > HIVE.tx0 && x < HIVE.tx1 && Math.abs(z - HIVE.z) < HIVE.tw;
const inUnderpass = (x, z) => x > UNDERPASS.x0 && x < UNDERPASS.x1 && z > UNDERPASS.zN && z < UNDERPASS.zS;
/* the surface over the underpass (for anything that crosses it on the mesa top: roads, the roof decks) */
const roofY = (x, z) => inUnderpass(x, z) && z > UNDERPASS.faceN && !inBunker(x, z) ? Math.max(UNDERPASS.ceil + 3, rawH(x, z, true)) : null; /* only where the rock covers it: the open cut at the north mouth is road level */
/* THE MESA FALLS: a waterfall pours off the mesa's south-east cliff into a plunge pool, and a stream runs from the
   pool down to the sea between the gold towers and the port. FALLS.a is the bearing around the mesa. */
const FALLS = { a: 1.08, top: 196, pool: { x: 0, z: 0 } }; FALLS.pool.x = 30 + Math.cos(FALLS.a) * 258; FALLS.pool.z = 30 + Math.sin(FALLS.a) * 258;
const STREAM = [[FALLS.pool.x, FALLS.pool.z], [178, 300], [200, 350], [224, 400], [246, 455], [262, 510]];
function streamD(x, z) { let best = 1e9; for (let i = 0; i < STREAM.length - 1; i++) { const [ax, az] = STREAM[i], [bx, bz] = STREAM[i + 1], dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1), d = Math.hypot(x - ax - dx * t, z - az - dz * t); if (d < best) best = d; } return best; }
const rampPts = (R, n = 14) => { const out = []; for (let i = 0; i <= n; i++) { const a = lerp(R.a0, R.a1, i / n); out.push({ x: CITYC.x + Math.cos(a) * R.r, z: CITYC.z + Math.sin(a) * R.r }); } return out; };
function baseH(x, z) {
  let h = 7 + fbm(x * 0.006 + 3.1, z * 0.006 - 1.7, 4) * 20 - 7 + (vnoise(x * 0.03, z * 0.03) - 0.5) * 3;
  /* the northern range, behind the airport */
  { const rz = -425 + Math.sin(x * 0.011) * 22, rr = Math.abs(z - rz); h += smooth(-170, -70, x) * smooth(480, 390, x) * smooth(115, 25, rr) * (70 + fbm(x * 0.013, z * 0.013, 3) * 75); }
  /* the east coast spur the highway tunnels through */
  h += smooth(330, 385, x) * smooth(-300, -245, z) * smooth(10, -45, z) * (48 + fbm(x * 0.02 + 5, z * 0.02, 3) * 36);
  /* Waterfall Valley: a high shelf to the north-east that drops in a cliff to the valley floor */
  { const d = Math.hypot(x - 352, z + 310); h = Math.max(h, 58 * smooth(95, 62, d) + fbm(x * 0.03, z * 0.03, 2) * 6); }
  /* the volcano: a steep cone with a crater */
  { const d = Math.hypot(x - VOLCANO.x, z - VOLCANO.z), g = 1 - Math.abs(fbm(x * 0.02 + 7, z * 0.02 - 3, 3) * 2 - 1); h += Math.pow(smooth(200, 18, d), 1.35) * VOLCANO.h * (0.93 + g * 0.12); h -= smooth(34, 12, d) * 46; }
  /* downtown on its mesa, and the two cliff roads */
  { const dx = x - CITYC.x, dz = z - CITYC.z, d = Math.hypot(dx, dz);
    if (d < MESA.r1 + 30) { const out = h; h = lerp(out, MESA.top, smooth(MESA.r1, MESA.r0, d));
      const ang = Math.atan2(dz, dx);
      for (const R of RAMPS) { let a = ang; while (a < R.a0 - 0.3) a += Math.PI * 2; while (a > R.a0 + Math.PI * 2 - 0.3) a -= Math.PI * 2; const t = (a - R.a0) / (R.a1 - R.a0); if (t < -0.06 || t > 1.08) continue;
        const m = smooth(R.w + 7, R.w, Math.abs(d - R.r)) * smooth(-0.06, 0, t); if (m <= 0) continue; const rh = lerp(MESA.top, Math.max(out, 2), clamp(t, 0, 1)); h = lerp(h, rh, m); } } }
  /* the river valley */
  { const rd = riverD(x, z); h = lerp(h, 2.2 + rd * 0.012, smooth(64, 26, rd)); h = lerp(h, -2.3, smooth(17, 7, rd)); }
  /* the falls' plunge pool and the stream to the sea, off the foot of the mesa */
  { const out = smooth(MESA.r1 - 6, MESA.r1 + 8, Math.hypot(x - CITYC.x, z - CITYC.z)), sd = streamD(x, z);
    if (sd < 40) { h = lerp(h, 1.6 + sd * 0.02, smooth(28, 10, sd) * out); h = lerp(h, -2.2, smooth(8, 3.5, sd) * out); }
    const pd = Math.hypot(x - FALLS.pool.x, z - FALLS.pool.z); if (pd < 26) h = lerp(h, -2.6, smooth(19, 9, pd)); }
  /* beaches, then the sea floor */
  const e = coastEdge(x, z);
  h = lerp(h, 1.4, smooth(60, 12, e) * smooth(70, 20, h - 1));
  h = lerp(h, -30, smooth(8, -55, e));
  for (const [ix, iz, ir] of ISLETS) { const q = ir - Math.hypot(x - ix, z - iz); if (q > -18) h = Math.max(h, lerp(-6, 3.2 + fbm(x * 0.05, z * 0.05, 2) * 2, smooth(-18, ir * 0.55, q))); }
  return h;
}
const FLATS = [];
for (const c of CPDEF) if (c.id !== 'marina' && c.id !== 'skyport' && c.id !== 'orbital') FLATS.push({ x: c.x, z: c.z, r: 62, h: Math.max(3, baseH(c.x, c.z)) });
for (const t of ARMIES) FLATS.push({ x: HQ[t].x, z: HQ[t].z, r: 82, h: Math.max(4, baseH(HQ[t].x, HQ[t].z)) });
/* the big flat sites: the runway, the base, the stadiums, the mall, the port quay, the towers on the point */
for (const [x, z, r] of [[-60, -325, 70], [60, -325, 72], [180, -325, 70], [-410, -60, 60], [-410, 80, 62], [-290, 90, 80], [330, 0, 68], [320, 140, 55], [395, 300, 60], [40, 385, 66], [-330, 190, 50], [-300, 320, 58], [-120, 300, 55]]) FLATS.push({ x, z, r, h: Math.max(3.5, Math.min(14, baseH(x, z))) });
function rawH(x, z, uncut) { /* uncut: the ground as it would be without the bunker hall (its roof follows it) */
  let h = baseH(x, z);
  for (const f of FLATS) { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r) h = lerp(h, f.h, smooth(f.r, f.r * 0.45, d)); }
  for (const b of BRIDGES) if (Math.abs(z - b.z) < 46) h = Math.max(h, lerp(h, 2.7, smooth(8, 5, Math.abs(x - b.x)) * smooth(46, 38, Math.abs(z - b.z)))); // bridge causeways
  if (h > 1) h -= 2.6 * smooth(7.5, 3, trenchD(x, z)); // trenches
  if (!uncut) { if (inUnderpass(x, z)) h = z < UNDERPASS.faceN + 15 ? lerp(3, UNDERPASS.floor, smooth(UNDERPASS.zN + 2, UNDERPASS.faceN + 15, z)) : UNDERPASS.floor; else if (inBunker(x, z)) h = BUNKER.floor; else if (inHivePit(x, z) || inHiveTun(x, z)) h = Math.min(h, HIVE.floor); } /* the underpass road (ramping down to the bridge at its north end) and the bunker's lower floor */
  const e = Math.max(Math.abs(x), Math.abs(z)); if (e > 600) h = lerp(h, -30, smooth(600, 680, e)); /* past the bounds: open sea */
  return h;
}
const WORLD = 1400, GRID = 280, CELL = WORLD / GRID, HALF = WORLD / 2, BOUND = 585; /* the map: 1.17 km square */
const bnd = y => y > 700 ? 1700 : BOUND; /* the orbital rings sit beyond the ground bounds */
const HM = new Float32Array((GRID + 1) * (GRID + 1));
for (let j = 0; j <= GRID; j++) for (let i = 0; i <= GRID; i++) HM[j * (GRID + 1) + i] = rawH(-HALF + i * CELL, -HALF + j * CELL);
(function erode() { // thermal erosion: steep slopes shed material downhill into talus aprons (posts, city, river, trenches untouched)
  const n = GRID + 1, mask = new Uint8Array(n * n), talus = CELL * 0.55;
  for (let j = 1; j < GRID; j++) for (let i = 1; i < GRID; i++) { const x = -HALF + i * CELL, z = -HALF + j * CELL; mask[j * n + i] = Math.hypot(x - CITYC.x, z - CITYC.z) > 260 && riverD(x, z) > 60 && trenchD(x, z) > 14 && !FLATS.some(f => Math.hypot(x - f.x, z - f.z) < f.r + 25) ? 1 : 0; }
  for (let it = 0; it < 8; it++) for (let j = 1; j < GRID; j++) for (let i = 1; i < GRID; i++) {
    const k = j * n + i; if (!mask[k] || HM[k] < 1.5) continue; let dm = 0, kk = -1;
    for (const o of [1, -1, n, -n]) { const d = HM[k] - HM[k + o]; if (d > dm) { dm = d; kk = k + o; } }
    if (dm > talus && mask[kk]) { const m = (dm - talus) * 0.25; HM[k] -= m; HM[kk] += m; }
  }
})();
function H(x, z) {
  let fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
  fx = clamp(fx, 0, GRID - 0.0001); fz = clamp(fz, 0, GRID - 0.0001);
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * (GRID + 1) + i;
  return lerp(lerp(HM[k], HM[k + 1], u), lerp(HM[k + GRID + 1], HM[k + GRID + 2], u), v);
}
function groundY(x, z) { return Math.max(H(x, z), 0); }
function wadeY(x, z) { const h = H(x, z); return h > 0 ? h : Math.max(h, -1.0); } // waist-deep in the shallows
const DECKS = []; // walkable platforms: orbital docks, space platforms, skybridges (capsules with x2/z2) and overwatch towers
let _dcx = 0, _dcz = 0; // scratch: nearest centre point of a deck (or its bridge spine)
function deckDist(d, x, z) {
  if (d.x2 === undefined) { _dcx = d.x; _dcz = d.z; } else { const dx = d.x2 - d.x, dz = d.z2 - d.z, t = clamp(((x - d.x) * dx + (z - d.z) * dz) / (dx * dx + dz * dz), 0, 1); _dcx = d.x + dx * t; _dcz = d.z + dz * t; }
  return Math.hypot(x - _dcx, z - _dcz);
}
function decksMinY() { if (DECKS.n !== DECKS.length) { DECKS.n = DECKS.length; DECKS.minY = Math.min(...DECKS.map(d => d.y)); deckGrid(); } return DECKS.minY; }
/* 64 m grid over the decks (each one registered in the cells its footprint + 4 m touches), so a lookup walks a
   handful of candidates instead of all ~90 decks: surfY and deckClamp run on every soldier, every frame */
const D_GRID = new Map(), NO_D = [];
function deckGrid() {
  D_GRID.clear();
  for (const d of DECKS) {
    const x0 = Math.min(d.x, d.x2 === undefined ? d.x : d.x2) - d.r - 4, x1 = Math.max(d.x, d.x2 === undefined ? d.x : d.x2) + d.r + 4;
    const z0 = Math.min(d.z, d.z2 === undefined ? d.z : d.z2) - d.r - 4, z1 = Math.max(d.z, d.z2 === undefined ? d.z : d.z2) + d.r + 4;
    for (let i = Math.floor(x0 / 64); i <= Math.floor(x1 / 64); i++) for (let j = Math.floor(z0 / 64); j <= Math.floor(z1 / 64); j++) { const k = i * 8192 + j; let L = D_GRID.get(k); if (!L) D_GRID.set(k, L = []); L.push(d); }
  }
}
function deckCell(x, z) { if (DECKS.n !== DECKS.length) decksMinY(); return D_GRID.get(Math.floor(x / 64) * 8192 + Math.floor(z / 64)) || NO_D; }
function deckAt(x, z, y) { // the highest deck under (x, y, z), if any
  if (!(y > decksMinY() - 4)) return null; let best = null;
  for (const d of deckCell(x, z)) if (y > d.y - 4 && (!best || d.y > best.y) && deckDist(d, x, z) < d.r + 3) best = d;
  return best;
}
function surfY(x, z, y) { const d = y !== undefined ? deckAt(x, z, y) : null; return d ? d.y : wadeY(x, z); }
function deckClamp(p, free) { // keep walkers on the union of decks and bridges; the player may leave through a jump gate
  if (!(p.y > decksMinY() - 4)) return; let near = null, nd = 1e9;
  for (const d of deckCell(p.x, p.z)) { if (p.y < d.y - 4 || p.y > d.y + 40) continue; const l = deckDist(d, p.x, p.z); if (l <= d.r - 1.2) return; if (l < d.r + 3 && l - d.r < nd) { nd = l - d.r; near = d; } }
  if (!near) return; const l = deckDist(near, p.x, p.z), cx = _dcx, cz = _dcz, dx = p.x - cx, dz = p.z - cz, m = near.r - 1.2;
  if (free && near.gate && Math.abs(angDiff(Math.atan2(dz, dx), near.gate.a)) < near.gate.w) return;
  if (l > 1e-6) { p.x = cx + dx / l * m; p.z = cz + dz / l * m; }
}

/* ---------------- canvas textures ---------------- */
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t; }
const grainTex = canvasTex(256, 256, (g, w, h) => {
  const id = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = 0.55 * vnoise(x * 0.08, y * 0.08) + 0.3 * vnoise(x * 0.3, y * 0.3) + 0.15 * Math.random();
    const v = 190 + n * 65; const k = (y * w + x) * 4; id.data[k] = id.data[k + 1] = id.data[k + 2] = clamp(v, 0, 255); id.data[k + 3] = 255;
  }
  g.putImageData(id, 0, 0);
});
const winSeeds = [];
function windowTex(lit) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = lit ? '#000' : '#2b2d31'; g.fillRect(0, 0, w, h);
    if (!lit) for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    for (let cy = 0; cy < 8; cy++) for (let cx = 0; cx < 8; cx++) {
      const k = cy * 8 + cx; if (winSeeds[k] === undefined) winSeeds[k] = Math.random();
      const r = winSeeds[k]; const x = cx * 32 + 6, y = cy * 32 + 9;
      let col = '#0f1317';
      if (r < 0.26) col = lit ? '#ffb15e' : '#ffcf8a'; else if (r < 0.33) col = lit ? '#7cc8ff' : '#a8dcff'; else if (lit) col = '#000';
      g.fillStyle = col; g.fillRect(x, y, 20, 13);
      if (!lit) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, y + 11, 20, 2); }
    }
  });
}
const facadeTex = windowTex(false), facadeLit = windowTex(true);
const puffTex = canvasTex(64, 64, (g, w, h) => {
  const id = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x - 31.5) / 31.5, dy = (y - 31.5) / 31.5; const d = Math.sqrt(dx * dx + dy * dy);
    const n = 0.65 + 0.35 * vnoise(x * 0.18, y * 0.18);
    const a = clamp(1 - d, 0, 1); const k = (y * w + x) * 4;
    const l = 200 + 55 * n; id.data[k] = id.data[k + 1] = id.data[k + 2] = l; id.data[k + 3] = Math.pow(a, 1.6) * 255 * n;
  }
  g.putImageData(id, 0, 0);
});
puffTex.wrapS = puffTex.wrapT = T.ClampToEdgeWrapping; puffTex.colorSpace = T.NoColorSpace;

function boxProjUV(geo, unit, roofDark) {
  geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay > ax && ay > az) { if (roofDark) { u = 0.02; v = 0.02; } else { u = p.getX(i) / unit; v = p.getZ(i) / unit; } }
    else if (ax > az) { u = p.getZ(i) / unit; v = p.getY(i) / unit; }
    else { u = p.getX(i) / unit; v = p.getY(i) / unit; }
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
}

/* ---------------- materials ---------------- */
const std = (c, r = 0.7, m = 0.25, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: m }, o));
const basic = (c, o = {}) => new T.MeshBasicMaterial(Object.assign({ color: c }, o));
const addMat = (c, op = 1, o = {}) => new T.MeshBasicMaterial(Object.assign({ color: c, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false }, o));
const MAT = {
  1: { armor: std(0x7a8794, 0.5, 0.4), dark: std(0x262c34, 0.65, 0.35), cloth: std(0x343a3f, 0.95, 0), trim: std(0xc9ccce, 0.45, 0.5), glow: basic(new T.Color(0.5, 1.6, 2.6)), add: addMat(0x3fb6ff, 0.85), hull: std(0x6c7680, 0.55, 0.45, { map: facadeTex, emissiveMap: facadeLit, emissive: 0xffffff, emissiveIntensity: 0.9 }) },
  2: { armor: std(0x5b2622, 0.5, 0.4), dark: std(0x1f1918, 0.65, 0.35), cloth: std(0x2b211f, 0.95, 0), trim: std(0x8f3c2a, 0.45, 0.5), glow: basic(new T.Color(2.8, 0.9, 0.3)), add: addMat(0xff5a2a, 0.85), hull: std(0x3d3433, 0.55, 0.45, { map: facadeTex, emissiveMap: facadeLit, emissive: 0xff8a6a, emissiveIntensity: 0.9 }) },
};
const MAT_GUN = std(0x16171a, 0.5, 0.6), MAT_GLASS = std(0x0b1016, 0.15, 0.9), MAT_CONC = std(0x56585a, 0.9, 0.05), MAT_RUST = std(0x5a4232, 0.85, 0.3);

/* ---------------- terrain ---------------- */
let terrain;
(function buildTerrain() {
  const g = new T.PlaneGeometry(WORLD, WORLD, GRID, GRID); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position; const col = new Float32Array(p.count * 3);
  const C = { grass: [0.2, 0.22, 0.12], dirt: [0.3, 0.24, 0.16], sand: [0.36, 0.25, 0.15], beach: [0.4, 0.34, 0.24], rock: [0.3, 0.28, 0.27], snow: [0.7, 0.72, 0.74], conc: [0.22, 0.22, 0.23], scorch: [0.08, 0.07, 0.06] };
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k), z = p.getZ(k), h = HM[k]; p.setY(k, h);
    const sl = Math.min(1, (Math.abs(H(x + 3, z) - H(x - 3, z)) + Math.abs(H(x, z + 3) - H(x, z - 3))) / 6);
    const n = vnoise(x * 0.03, z * 0.03), n2 = vnoise(x * 0.008 + 5, z * 0.008);
    let c = C.grass.map((v, i) => lerp(v, C.dirt[i], smooth(0.3, 0.75, n)));
    const ash = smooth(235, 110, Math.hypot(x - VOLCANO.x, z - VOLCANO.z)); /* black ash and old lava on the volcano */
    c = c.map((v, i) => lerp(v, [0.1, 0.09, 0.085][i] * (0.8 + n * 0.5), ash));
    const city = smooth(205, 190, Math.hypot(x - CITYC.x, z - CITYC.z)); /* the mesa top */
    c = c.map((v, i) => lerp(v, C.conc[i] * (0.9 + n * 0.2), city));
    c = c.map((v, i) => lerp(v, C.rock[i] * (0.8 + n * 0.4), smooth(0.45, 0.85, sl)));
    { const md = Math.hypot(x - CITYC.x, z - CITYC.z); if (md > MESA.r0 - 4 && md < MESA.r1 + 8) { const band = 0.75 + 0.35 * Math.sin(h * 0.21 + vnoise(x * 0.02, z * 0.02) * 2.5) + vnoise(x * 0.08, h * 0.12) * 0.25; c = c.map((v, i) => lerp(v, [0.42, 0.33, 0.26][i] * band, smooth(0.35, 0.7, sl))); } } /* the mesa's cliffs: banded sandstone */
    c = c.map((v, i) => lerp(v, C.beach[i], smooth(5, 1.5, h) * smooth(-3, 1, h)));
    c = c.map((v, i) => lerp(v, [0.5, 0.45, 0.33][i], smooth(0.5, -2, h))); c = c.map((v, i) => lerp(v, [0.2, 0.26, 0.24][i], smooth(-4, -22, h)));
    c = c.map((v, i) => lerp(v, C.snow[i], smooth(118, 150, h) * (1 - ash) * (1 - city) * (1 - sl * 0.6))); /* snow on the northern peaks only */
    const sc = smooth(0.72, 0.85, vnoise(x * 0.012 + 40, z * 0.012 - 7)) * (1 - smooth(60, 120, h));
    c = c.map((v, i) => lerp(v, C.scorch[i], sc * 0.75));
    for (const f of FLATS) { const d = Math.hypot(x - f.x, z - f.z); if (d < 36) { const t = smooth(36, 26, d); c = c.map((v, i) => lerp(v, 0.22 + (i === 2 ? 0.01 : 0), t * 0.8)); } }
    c = c.map(v => v * (0.92 + n2 * 0.16));
    col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
  }
  g.setAttribute('color', new T.BufferAttribute(col, 3)); g.computeVertexNormals();
  const gt = grainTex.clone(); gt.needsUpdate = true; gt.repeat.set(260, 260);
  const mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, map: gt });
  /* The ground is two thousand metres across at six-metre resolution: three hundred and twenty thousand triangles, and
     as one mesh every last one of them was submitted even when the fog hid all but a corner. The vertex buffers are
     built once and shared; only the index is cut into a grid of tiles, each with its own bounds, so the frustum throws
     away the tiles behind you. One material for all of them, so a change to the ground's look still lands everywhere. */
  const NC = 4, STEP = GRID / NC, idx = g.index.array, parts = [];
  for (let cz = 0; cz < NC; cz++) for (let cx = 0; cx < NC; cx++) {
    const arr = new Uint32Array(STEP * STEP * 6); let n = 0;
    for (let iy = cz * STEP; iy < (cz + 1) * STEP; iy++) for (let ix = cx * STEP; ix < (cx + 1) * STEP; ix++) {
      const q = (iy * GRID + ix) * 6; for (let k = 0; k < 6; k++) arr[n++] = idx[q + k];
    }
    const cg = new T.BufferGeometry();
    for (const k of ['position', 'normal', 'color']) if (g.attributes[k]) cg.setAttribute(k, g.attributes[k]);
    if (g.attributes.uv) cg.setAttribute('uv', g.attributes.uv);
    cg.setIndex(new T.BufferAttribute(arr, 1));
    const x0 = -HALF + cx * STEP * CELL, x1 = x0 + STEP * CELL, z0 = -HALF + cz * STEP * CELL, z1 = z0 + STEP * CELL;
    let y0 = 1e9, y1 = -1e9;
    for (let iy = cz * STEP; iy <= (cz + 1) * STEP; iy++) for (let ix = cx * STEP; ix <= (cx + 1) * STEP; ix++) { const h = HM[iy * (GRID + 1) + ix]; if (h < y0) y0 = h; if (h > y1) y1 = h; }
    cg.boundingBox = new T.Box3(new V3(x0, y0, z0), new V3(x1, y1, z1));
    cg.boundingSphere = new T.Sphere(new V3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2);
    const m = new T.Mesh(cg, mat); m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix(); scene.add(m); parts.push(m);
  }
  terrain = parts[0]; /* they share one material, so the post pass still dresses the whole ground through this one */
})();

/* ---------------- shader helpers ---------------- */
const GLSL_NOISE = `
float hsh(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float nse(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f); return mix(mix(hsh(i),hsh(i+vec2(1,0)),u.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),u.x),u.y); }
float fbm5(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*nse(p); p*=2.07; a*=.5; } return s; }`;
const OUT = `\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n`; // directives must start their own line

/* ---------------- sky ---------------- */
const skyU = { sunDir: { value: SUN_DIR }, horizon: { value: FOG.clone() }, zenith: { value: new T.Color(0x141b27) }, sunCol: { value: new T.Color(1.0, 0.62, 0.32) }, space: { value: 0 }, night: { value: 0 } };
const sky = new T.Mesh(new T.SphereGeometry(1, 32, 16), new T.ShaderMaterial({
  uniforms: skyU, side: T.BackSide, depthWrite: false, depthTest: false, fog: false,
  vertexShader: `varying vec3 vD; void main(){ vD=position; vec4 p=projectionMatrix*modelViewMatrix*vec4(position*8000.,1.); gl_Position=p; }`,
  fragmentShader: `uniform vec3 sunDir,horizon,zenith,sunCol; uniform float space,night; varying vec3 vD;
  float h3(vec3 p){ p=fract(p*.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  void main(){ vec3 d=normalize(vD); float y=d.y;
    vec3 col=mix(horizon,zenith,smoothstep(-0.02,0.6,y)); col=mix(col,horizon*.7,smoothstep(0.,-.3,y));
    float s=max(dot(d,sunDir),0.);
    col+=sunCol*(pow(s,6.)*.25+pow(s,48.)*.6+pow(s,900.)*14.)*smoothstep(-.12,.02,sunDir.y);
    vec3 sp=vec3(.003,.004,.009)+sunCol*pow(s,500.)*20.;
    col=mix(col,sp,space*smoothstep(-.35,.1,y));
    vec3 g=floor(d*320.); float st=step(.9972,h3(g))*(.4+.6*h3(g+3.1));
    col+=st*vec3(.9,.95,1.)*(space*1.4+(.16+night*1.5)*smoothstep(.02,.7,y))*smoothstep(-.1,.08,y);
    float bd=dot(d,normalize(vec3(.35,.75,.55))); float band=exp(-bd*bd*10.); col+=vec3(.32,.22,.5)*band*(space*.22+(.03+night*.2)*smoothstep(.1,.9,y))*(.6+.4*h3(floor(d*40.)));
    col+=vec3(.35,.55,1.)*space*exp(-abs(y+.06)*16.)*.55+vec3(1.,.5,.25)*space*exp(-abs(y+.06)*40.)*pow(max(dot(d.xz/max(length(d.xz),1e-4),normalize(sunDir.xz)),0.),3.)*.8;
    gl_FragColor=vec4(col,1.);
    ${OUT} }`
}));
sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);

/* ---------------- clouds ---------------- */
const cloudU = { fade: { value: 1 }, time: { value: 0 }, sunDir: { value: SUN_DIR }, camPos: { value: camera.position }, fogColor: { value: FOG }, fogD: { value: FOG_D } };
const clouds = new T.Mesh(new T.PlaneGeometry(14000, 14000, 80, 80).rotateX(-Math.PI / 2), new T.ShaderMaterial({
  uniforms: cloudU, transparent: true, depthWrite: false, side: T.DoubleSide, fog: false,
  vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); w.y-=max(0.,w.x*w.x+w.z*w.z-6250000.)/120000.; vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `uniform float time,fogD,fade; uniform vec3 sunDir,camPos,fogColor; varying vec3 vW; ${GLSL_NOISE}
  void main(){ vec2 uv=vW.xz*.00095+vec2(time*.004,time*.0023); float n=fbm5(uv); float n2=fbm5(uv*3.1+7.);
    float c=smoothstep(.47,.7,n*.8+n2*.25);
    float below=step(camPos.y,vW.y);
    vec3 under=mix(vec3(.05,.045,.04),vec3(.28,.22,.17),smoothstep(.55,.95,n2));
    vec3 top=vec3(1.,.74,.5)*(.55+.7*n2);
    vec3 col=mix(top,under,below);
    float d=length(vW-camPos); float f=1.-exp(-fogD*fogD*d*d*.22);
    col=mix(col,fogColor,f*below+f*.5*(1.-below));
    float a=c*(1.-smoothstep(4200.,6800.,d))*.94*fade;
    gl_FragColor=vec4(col,a); ${OUT} }`
}));
clouds.position.y = 640; clouds.frustumCulled = false; clouds.renderOrder = 2; scene.add(clouds);

/* ---------------- water ---------------- */
// heightmap baked into a texture so the sea knows how deep it is everywhere
const hmTex = (() => { const n = GRID + 1, d = new Uint8Array(n * n * 4); for (let k = 0; k < n * n; k++) { const v = clamp((HM[k] + 60) / 100, 0, 1) * 255; d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = v; d[k * 4 + 3] = 255; } const t = new T.DataTexture(d, n, n, T.RGBAFormat); t.magFilter = t.minFilter = T.LinearFilter; t.needsUpdate = true; return t; })();
const waterU = { hmTex: { value: hmTex }, time: { value: 0 }, sunDir: { value: SUN_DIR }, camPos: { value: camera.position }, fogColor: { value: FOG }, fogD: { value: FOG_D }, skyCol: { value: new T.Color(0x4f86c0) } };
const water = new T.Mesh(new T.PlaneGeometry(16000, 16000, 120, 120).rotateX(-Math.PI / 2), new T.ShaderMaterial({
  uniforms: waterU, fog: false,
  vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); w.y-=max(0.,w.x*w.x+w.z*w.z-6250000.)/120000.; vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `uniform float time,fogD; uniform vec3 sunDir,camPos,fogColor,skyCol; uniform sampler2D hmTex; varying vec3 vW; ${GLSL_NOISE}
  float wh(vec2 p){ return sin(p.x*.05+time*1.1)*.5+sin(p.y*.07-time*.9+p.x*.02)*.45+nse(p*.15+time*.3)*.8+nse(p*.6-time*.5)*.25; }
  void main(){ vec2 p=vW.xz; float e=.5; float h0=wh(p); vec3 n=normalize(vec3(h0-wh(p+vec2(e,0.)),e*1.6,h0-wh(p+vec2(0.,e))));
    vec3 V=normalize(camPos-vW); float fr=pow(1.-max(dot(n,V),0.),4.);
    vec2 huv=(vW.xz+${HALF.toFixed(1)})/${WORLD.toFixed(1)}; float inside=step(0.,huv.x)*step(huv.x,1.)*step(0.,huv.y)*step(huv.y,1.);
    float depth=mix(45.,max(0.,-(texture2D(hmTex,clamp(huv,0.,1.)).r*100.-60.)),inside)+h0*.15;
    vec3 shallow=vec3(.06,.42,.42), mid=vec3(.02,.17,.3), deep=vec3(.004,.035,.11);
    vec3 col=mix(shallow,mid,smoothstep(0.,9.,depth)); col=mix(col,deep,smoothstep(9.,38.,depth)); col*=.85+.25*h0*.3;
    col=mix(col,vec3(.0,.025,.09),smoothstep(0.,1.,fr)*smoothstep(4.,20.,depth));
    vec3 R=reflect(-V,n); float sd=max(dot(R,sunDir),0.);
    col=mix(col,skyCol,fr*.7)+vec3(1.,.8,.6)*(pow(sd,220.)*7.+pow(sd,14.)*.1);
    float cap=smoothstep(1.25,1.6,h0)*.25*smoothstep(3.,12.,depth); col+=vec3(cap);
    float n1=nse(vW.xz*.25+time*.2);
    float shore=(1.-smoothstep(0.,1.4+n1*.8,depth))*(.55+.45*n1);
    float wave=smoothstep(.72,.98,sin(depth*1.5-time*1.7+n1*2.5))*(1.-smoothstep(1.,7.,depth))*smoothstep(.2,.9,depth);
    col=mix(col,vec3(.92,.96,.97),clamp(shore+wave*.75,0.,1.));
    float d=length(vW-camPos); float f=(1.-exp(-fogD*fogD*d*d*.55))*.85;
    vec3 haze=mix(fogColor,vec3(.16,.3,.45),.55);
    float a=mix(.42,1.,smoothstep(0.,7.,depth))+shore*.5; gl_FragColor=vec4(mix(col,haze,f),clamp(a,0.,1.)); ${OUT} }`
}));
water.material.transparent = true; water.renderOrder = 1; scene.add(water);
function waveH(x, z) { return Math.sin(x * 0.05 + TIME * 1.1) * 0.5 + Math.sin(z * 0.07 - TIME * 0.9 + x * 0.02) * 0.45; }

/* ---------------- light shafts (fake volumetrics) ---------------- */
const shaftMat = new T.ShaderMaterial({
  uniforms: { time: { value: 0 }, color: { value: new T.Color(1.0, 0.7, 0.42) }, strength: { value: 0.07 }, fogColor: { value: FOG } },
  transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
  vertexShader: `varying float vY; varying float vE; varying vec3 vW; uniform float time; void main(){ vY=position.y; vec3 n=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vE=abs(dot(n,normalize(-mv.xyz))); vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform float time,strength; uniform vec3 color; varying float vY; varying float vE; varying vec3 vW; ${GLSL_NOISE}
  void main(){ float t=vY+.5; float a=pow(sin(3.14159*clamp(t,0.,1.)),1.4)*pow(vE,2.2)*strength*(0.55+.45*nse(vec2(vW.x*.02+time*.15,vW.z*.02))); gl_FragColor=vec4(color*a,1.); ${OUT} }`
});
const shaftGeo = new T.CylinderGeometry(0.42, 1, 1, 20, 1, true);
const shafts = [];
function makeShaft(x, z, len, r) {
  const m = new T.Mesh(shaftGeo, shaftMat); m.scale.set(r, len, r);
  const base = new V3(x, groundY(x, z) - 10, z); const mid = base.clone().addScaledVector(SUN_DIR, len / 2);
  m.position.copy(mid); m.quaternion.setFromUnitVectors(UP, SUN_DIR); m.renderOrder = 5; m.frustumCulled = false; scene.add(m); shafts.push(m); return m;
}
[[-150, 120], [180, -60], [-320, -260], [260, 260], [-60, -520], [60, 480], [420, -120], [-480, 60]].forEach(([x, z], i) => makeShaft(x, z, 900, 30 + (i % 3) * 18));

/* ---------------- particles ---------------- */
const PS3 = ['pos', 'col', 'vel', 'c0', 'c1'], PS1 = ['size', 'alpha', 's0', 's1', 'life', 'age', 'a0', 'drag', 'grav'], PSA = ['position', 'pcolor', 'size', 'alpha'];
/* soft particles: post.js hands the scene's depth buffer to every puff of smoke, dust and fire, so they fade out
   where they meet a surface instead of cutting into it along a hard edge. Without a depth buffer they draw as before. */
const SOFT_FB = new T.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, T.RGBAFormat); SOFT_FB.needsUpdate = true;
const SOFT = { depth: { value: SOFT_FB }, on: { value: 0 }, res: { value: new T.Vector2(1, 1) }, cn: { value: 0.1 }, cf: { value: 1000 }, uvs: { value: new T.Vector2(1, 1) }, fb: SOFT_FB };
class PSys {
  constructor(max, additive) {
    this.max = max; this.n = 0; this.add = additive;
    const F = k => new Float32Array(max * k);
    this.pos = F(3); this.col = F(3); this.size = F(1); this.alpha = F(1);
    this.vel = F(3); this.c0 = F(3); this.c1 = F(3); this.s0 = F(1); this.s1 = F(1); this.life = F(1); this.age = F(1); this.a0 = F(1); this.drag = F(1); this.grav = F(1);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(this.pos, 3).setUsage(T.DynamicDrawUsage));
    g.setAttribute('pcolor', new T.BufferAttribute(this.col, 3).setUsage(T.DynamicDrawUsage));
    g.setAttribute('size', new T.BufferAttribute(this.size, 1).setUsage(T.DynamicDrawUsage));
    g.setAttribute('alpha', new T.BufferAttribute(this.alpha, 1).setUsage(T.DynamicDrawUsage));
    g.setDrawRange(0, 0); this.geo = g;
    this.mat = new T.ShaderMaterial({
      uniforms: { tex: { value: puffTex }, scale: { value: 600 }, fogColor: { value: FOG }, fogD: { value: FOG_D }, tDepth: SOFT.depth, softOn: SOFT.on, sRes: SOFT.res, sCn: SOFT.cn, sCf: SOFT.cf },
      transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending, fog: false,
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 pcolor; uniform float scale,fogD; varying vec4 vC; varying float vF; varying float vZ;
        void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; float d=-mv.z; vZ=d; gl_PointSize=min(size*scale/max(d,.5),300.); vF=1.-exp(-fogD*fogD*d*d); vC=vec4(pcolor,alpha); }`,
      fragmentShader: `uniform sampler2D tex; uniform sampler2D tDepth; uniform vec3 fogColor; uniform float softOn,sCn,sCf; uniform vec2 sRes; varying vec4 vC; varying float vF; varying float vZ;
        void main(){ vec4 t=texture2D(tex,gl_PointCoord); float a=t.a*vC.a;
        if(softOn>.5){ float d=texture2D(tDepth,gl_FragCoord.xy/sRes).x*2.-1.; float sz=(2.*sCn*sCf)/(sCf+sCn-d*(sCf-sCn)); a*=clamp((sz-vZ)*0.55,0.,1.); } /* fade into whatever is behind */
        if(a<.003) discard;
        ${additive ? 'gl_FragColor=vec4(vC.rgb*a*(1.-vF),1.);' : 'gl_FragColor=vec4(mix(vC.rgb*(t.r*1.1),fogColor,vF),a);'} ${OUT} }`
    });
    this.points = new T.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = additive ? 8 : 6; scene.add(this.points);
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, r0, g0, b0, r1, g1, b1, a0, drag, grav) {
    if (this.n > this.max * 0.45) { const c = camera.position, dx = x - c.x, dy = y - c.y, dz = z - c.z; if (dx * dx + dy * dy + dz * dz > 170000) return; } /* crowded: spend what's left on what the player can actually see */
    let i = this.n < this.max ? this.n++ : (Math.random() * this.max) | 0;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z; this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.c0[i3] = r0; this.c0[i3 + 1] = g0; this.c0[i3 + 2] = b0; this.c1[i3] = r1; this.c1[i3 + 1] = g1; this.c1[i3 + 2] = b1;
    this.col[i3] = r0; this.col[i3 + 1] = g0; this.col[i3 + 2] = b0;
    this.s0[i] = s0; this.s1[i] = s1; this.size[i] = s0; this.life[i] = life; this.age[i] = 0; this.a0[i] = a0; this.alpha[i] = 0; this.drag[i] = drag; this.grav[i] = grav;
  }
  copy(d, s) {
    const d3 = d * 3, s3 = s * 3;
    for (const k of PS3) { const a = this[k]; a[d3] = a[s3]; a[d3 + 1] = a[s3 + 1]; a[d3 + 2] = a[s3 + 2]; }
    for (const k of PS1) this[k][d] = this[k][s];
  }
  update(dt) {
    const P = this.pos, Vv = this.vel;
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) { this.n--; if (i !== this.n) this.copy(i, this.n); i--; continue; }
      const t = this.age[i] / this.life[i], i3 = i * 3, dr = Math.max(0, 1 - this.drag[i] * dt);
      Vv[i3] *= dr; Vv[i3 + 1] = Vv[i3 + 1] * dr + this.grav[i] * dt; Vv[i3 + 2] *= dr;
      P[i3] += Vv[i3] * dt; P[i3 + 1] += Vv[i3 + 1] * dt; P[i3 + 2] += Vv[i3 + 2] * dt;
      const ct = this.add ? Math.min(1, t * 1.6) : t;
      this.col[i3] = lerp(this.c0[i3], this.c1[i3], ct); this.col[i3 + 1] = lerp(this.c0[i3 + 1], this.c1[i3 + 1], ct); this.col[i3 + 2] = lerp(this.c0[i3 + 2], this.c1[i3 + 2], ct);
      this.size[i] = lerp(this.s0[i], this.s1[i], 1 - (1 - t) * (1 - t));
      this.alpha[i] = this.a0[i] * (this.add ? Math.pow(1 - t, 1.4) : (t < 0.08 ? t / 0.08 : Math.pow(1 - (t - 0.08) / 0.92, 1.3)));
    }
    const g = this.geo; g.setDrawRange(0, this.n);
    for (const k of PSA) { const a = g.attributes[k]; a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, this.n) * a.itemSize); a.needsUpdate = true; /* r159+: update ranges */ }
  }
}
const FXA = new PSys(6400, true), FXS = new PSys(4600, false);

/* ---------------- dynamic lights pool ---------------- */
const LIGHTS = [];
for (let i = 0; i < 3; i++) { const l = new T.PointLight(0xffa050, 0, 60, 2); l.userData = { t: 0, life: 1, i0: 0 }; scene.add(l); LIGHTS.push(l); }
function flashLight(p, intensity, dist, life, color = 0xffa050) {
  let best = LIGHTS[0]; for (const l of LIGHTS) if (l.intensity < best.intensity) best = l;
  best.position.copy(p); best.color.setHex(color); best.distance = dist; best.userData.t = 0; best.userData.life = life; best.userData.i0 = intensity; best.intensity = intensity;
}

/* ---------------- shockwave rings ---------------- */
const RINGS = [];
for (let i = 0; i < 8; i++) { const m = new T.Mesh(new T.RingGeometry(0.85, 1, 64).rotateX(-Math.PI / 2), addMat(0xffc890, 0, { side: T.DoubleSide })); m.visible = false; m.userData = { t: 0, life: 1, r: 1 }; m.renderOrder = 9; scene.add(m); RINGS.push(m); }
function shockRing(p, r, life = 0.7, color = 0xffc890) { const m = RINGS.find(x => !x.visible) || RINGS[0]; m.visible = true; m.position.set(p.x, groundY(p.x, p.z) + 0.6, p.z); m.material.color.setHex(color); m.userData.t = 0; m.userData.life = life; m.userData.r = r; }

/* ---------------- beams (orbital / turbolaser) ---------------- */
const BEAMS = [];
const beamGeo = new T.CylinderGeometry(1, 1, 1, 14, 1, true).translate(0, 0.5, 0);
for (let i = 0; i < 6; i++) {
  const g = new T.Group(); const core = new T.Mesh(beamGeo, addMat(0xffffff, 1)); const halo = new T.Mesh(beamGeo, addMat(0xff5020, 0.5)); halo.scale.set(3.2, 1, 3.2);
  g.add(core, halo); g.visible = false; g.userData = { t: 0, life: 1, w: 1, core, halo }; g.renderOrder = 9; scene.add(g); BEAMS.push(g);
}
function beam(a, b, w, life, color) {
  const g = BEAMS.find(x => !x.visible) || BEAMS[0];
  g.visible = true; g.position.copy(a); _v1.subVectors(b, a); const L = _v1.length(); g.quaternion.setFromUnitVectors(UP, _v1.normalize());
  g.scale.set(w, L, w); g.userData.t = 0; g.userData.life = life; g.userData.w = w; g.userData.core.material.color.setRGB(1.5, 1.4, 1.3); g.userData.halo.material.color.set(color);
  return g;
}

/* ---------------- persistent emitters (fires, smoke columns) ---------------- */
const EMIT = [];
function addEmitter(p, size, life, follow, offset) {
  if (EMIT.length > 46) { const k = EMIT.findIndex(x => x.life < 1e8); EMIT.splice(k < 0 ? 0 : k, 1); }
  const e = { p: p.clone(), size, life, t: 0, acc: 0, follow: follow || null, off: offset ? offset.clone() : null };
  EMIT.push(e); return e;
}
function updateEmitters(dt) {
  for (let i = EMIT.length - 1; i >= 0; i--) {
    const e = EMIT[i]; e.t += dt; if (e.t > e.life) { EMIT.splice(i, 1); continue; }
    if (e.follow) { if (!e.follow.parent) { EMIT.splice(i, 1); continue; } e.follow.localToWorld(_v1.copy(e.off)); e.p.copy(_v1); }
    const fade = Math.min(1, (e.life - e.t) / 6);
    e.acc += dt * (5 + e.size * 3) * fade;
    const s = e.size;
    while (e.acc > 1) {
      e.acc -= 1;
      FXS.spawn(e.p.x + rand(-s, s), e.p.y + rand(0, s), e.p.z + rand(-s, s), rand(-1, 1) + 2.2, rand(3, 6) * (0.6 + s * 0.15), rand(-1, 1) + 1.2, rand(6, 11), s * 2, s * 9, 0.07, 0.06, 0.055, 0.2, 0.18, 0.16, 0.85, 0.1, 0.4);
      if (Math.random() < 0.8) FXA.spawn(e.p.x + rand(-s, s) * 0.6, e.p.y + rand(0, s * 0.5), e.p.z + rand(-s, s) * 0.6, rand(-0.5, 0.5), rand(2, 5), rand(-0.5, 0.5), rand(0.4, 0.9), s * 1.4, s * 0.4, 3.2, 1.3, 0.35, 1.2, 0.2, 0.05, 0.9, 0.5, 1.5);
    }
  }
}

/* ---------------- audio ---------------- */
const AU = { ctx: null, master: null, noise: null, budget: 0, amb: null, ambLp: null };
const _sa = new V3(), _sb = new V3();
function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)(); AU.ctx = ctx;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 6; comp.connect(ctx.destination);
    AU.master = ctx.createGain(); AU.master.gain.value = 0.55; AU.master.connect(comp);
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = b.getChannelData(0); let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; d[i] = w; } AU.noise = b;
    const br = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate); const e = br.getChannelData(0);
    for (let i = 0; i < e.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; e[i] = last * 3.5; }
    const src = ctx.createBufferSource(); src.buffer = br; src.loop = true; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const g = ctx.createGain(); g.gain.value = 0.22; src.connect(lp); lp.connect(g); g.connect(AU.master); src.start(); AU.amb = g; AU.ambLp = lp;
  } catch (err) { AU.ctx = null; }
}
function snd(type, pos, vol = 1) {
  const ctx = AU.ctx; if (!ctx || AU.budget > 14) return;
  const d = pos ? camera.position.distanceTo(pos) : 0;
  const fall = { roar: 1400, rifle: 45, laser: 70, heavy: 160, boom: 260, big: 700, stomp: 140, missile: 90, ui: 1e9, skid: 90, hiss: 35, zap: 45, buzz: 25, chime: 30, step: 20, clank: 20, splash: 25 }[type] || 80;
  const g0 = vol / (1 + (d / fall) * (d / fall)); if (g0 < 0.015) return;
  AU.budget++;
  const now = ctx.currentTime + (type === 'boom' || type === 'big' ? Math.min(1.6, d / 343) : 0);
  const out = ctx.createGain(); out.gain.setValueAtTime(0, now); let tail = out;
  if (pos && d > 2) { // positional: distance lowpass + stereo pan from the camera's right vector
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.max(400, 18000 / (1 + d / 60)); out.connect(lp); tail = lp;
    if (ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); _sa.subVectors(pos, camera.position).normalize(); _sb.set(1, 0, 0).applyQuaternion(camera.quaternion); pn.pan.value = clamp(_sa.dot(_sb), -1, 1) * 0.85; lp.connect(pn); tail = pn; }
  }
  tail.connect(AU.master);
  const noise = (dur, ftype, f0, f1, q = 0.8) => { const s = ctx.createBufferSource(); s.buffer = AU.noise; s.playbackRate.value = rand(0.8, 1.2); const f = ctx.createBiquadFilter(); f.type = ftype; f.Q.value = q; f.frequency.setValueAtTime(f0, now); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur); s.connect(f); f.connect(out); s.start(now, Math.random()); s.stop(now + dur + 0.05); };
  const osc = (dur, wave, f0, f1, gv = 1) => { const o = ctx.createOscillator(); o.type = wave; o.frequency.setValueAtTime(f0, now); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur); const gg = ctx.createGain(); gg.gain.value = gv; o.connect(gg); gg.connect(out); o.start(now); o.stop(now + dur + 0.05); };
  let dur = 0.1;
  switch (type) {
    case 'rifle': dur = 0.12; noise(dur, 'bandpass', 2200, 700, 0.7); osc(0.05, 'square', 180, 60, 0.3); g0 * 0.9; break;
    case 'laser': dur = 0.2; osc(dur, 'sawtooth', rand(1400, 1900), 160, 0.35); noise(0.08, 'highpass', 3000, 1500); break;
    case 'heavy': dur = 0.5; osc(dur, 'sawtooth', 420, 50, 0.6); noise(0.4, 'lowpass', 1500, 120); break;
    case 'boom': dur = 1.3; noise(dur, 'lowpass', 1000, 60, 0.5); osc(0.8, 'sine', 80, 30, 1.2); break;
    case 'big': dur = 3.2; noise(dur, 'lowpass', 800, 30, 0.4); osc(2.2, 'sine', 55, 20, 1.6); break;
    case 'stomp': dur = 0.5; osc(dur, 'sine', 55, 28, 1.4); noise(0.3, 'lowpass', 300, 60); break;
    case 'missile': dur = 0.7; noise(dur, 'bandpass', 900, 3000, 1.5); break;
    case 'roar': dur = 3.4; osc(dur, 'sawtooth', 140, 38, 1.0); osc(dur, 'square', 92, 30, 0.5); noise(dur, 'bandpass', 700, 180, 0.6); noise(dur * 0.8, 'lowpass', 300, 40, 0.5); break;
    case 'kill': dur = 0.3; osc(0.18, 'sine', 140, 45, 1.1); noise(0.12, 'highpass', 4000, 2500, 0.6); osc(0.25, 'triangle', 1760, 1100, 0.25); break;
    case 'whiz': dur = 0.16; noise(dur, 'bandpass', rand(3200, 4200), 900, 2.2); break;
    case 'crit': dur = 0.22; osc(0.12, 'square', 2400, 900, 0.25); noise(0.1, 'highpass', 5000, 3000, 0.5); break;
    case 'tick': dur = 0.12; osc(0.08, 'square', 1500, 1500, 0.12); break;
    case 'skid': dur = 0.7; noise(dur, 'bandpass', 900, 420, 4); osc(dur, 'triangle', 260, 180, 0.12); break;
    case 'hiss': dur = 1.2; noise(dur, 'highpass', 5000, 2600, 0.4); break;
    case 'zap': dur = 0.18; osc(0.06, 'square', rand(2000, 3200), 400, 0.3); noise(0.15, 'highpass', 6000, 2000, 1.2); break;
    case 'buzz': dur = 0.5; osc(dur, 'sawtooth', 120, 118, 0.25); osc(dur, 'square', 240, 238, 0.06); break;
    case 'chime': dur = 0.9; osc(0.45, 'sine', 1320, 1320, 0.3); osc(0.9, 'sine', 990, 990, 0.25); break;
    case 'step': dur = 0.12; noise(dur, 'lowpass', rand(500, 800), 120, 0.7); break;
    case 'clank': dur = 0.14; noise(0.08, 'bandpass', rand(1800, 2600), 900, 3); osc(0.1, 'triangle', rand(380, 460), 300, 0.12); break;
    case 'splash': dur = 0.25; noise(dur, 'bandpass', rand(900, 1300), 500, 1.2); break;
    case 'ui': dur = 0.25; osc(0.1, 'square', 880, 880, 0.15); osc(0.22, 'square', 1320, 1320, 0.12); break;
  }
  out.gain.linearRampToValueAtTime(g0, now + 0.004); out.gain.exponentialRampToValueAtTime(0.0008, now + dur);
  setTimeout(() => { try { out.disconnect(); } catch (e) { } }, (dur + 2) * 1000);
}

/* ---------------- camera shake ---------------- */
const SHAKE = { v: 0 };
function shake(amount, p) { const d = p ? camera.position.distanceTo(p) : 0; const add = amount / (1 + d * d / 9000); if (!isFinite(add)) return; /* one bad number here used to poison the shake for good, and the camera with it */ SHAKE.v = Math.min(2.2, SHAKE.v + add); }

/* ---------------- FX composites ---------------- */
function fxMuzzle(p, color) { FXA.spawn(p.x, p.y, p.z, 0, 0, 0, 0.06, 0.9, 0.5, color[0], color[1], color[2], color[0], color[1], color[2], 1, 0, 0); }
function fxSparks(p, n, col = [3, 2, 0.8], power = 14) {
  for (let i = 0; i < n; i++) { randDir(_v5); FXA.spawn(p.x, p.y, p.z, _v5.x * power, _v5.y * power + 3, _v5.z * power, rand(0.2, 0.6), 0.35, 0.1, col[0], col[1], col[2], 1.5, 0.4, 0.1, 1, 1.5, -18); }
}
function fxDust(p, n, size, power = 4) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283; FXS.spawn(p.x + Math.cos(a) * size * 0.3, p.y + 0.3, p.z + Math.sin(a) * size * 0.3, Math.cos(a) * power * rand(0.5, 1), rand(0.4, 1.5) * power * 0.4, Math.sin(a) * power * rand(0.5, 1), rand(1.6, 3.5), size * 0.6, size * 2.2, 0.36, 0.3, 0.23, 0.42, 0.37, 0.3, 0.55, 1.2, 0.3); }
}
function fxWaterSplash(p, scale) {
  for (let i = 0; i < 10 + scale * 8; i++) { randDir(_v5); FXS.spawn(p.x + _v5.x * scale, 0.5, p.z + _v5.z * scale, _v5.x * 4 * scale, rand(8, 20) * Math.sqrt(scale), _v5.z * 4 * scale, rand(1, 2.2), scale * 1.5, scale * 4, 0.75, 0.8, 0.82, 0.55, 0.6, 0.62, 0.8, 0.6, -14); }
  shockRing(p, scale * 10, 1.2, 0xdde8ff);
}
function fxExplosion(p, scale = 1, opts = {}) {
  const s = scale, gy = groundY(p.x, p.z), nearGround = p.y - gy < 4 + s * 2;
  const overWater = H(p.x, p.z) < 0 && p.y < 3;
  if (overWater) { fxWaterSplash(p, s * 1.4); }
  flashLight(_v5.copy(p).setY(p.y + 2 + s), 6 * s, 30 + 30 * s, 0.25 + 0.15 * s);
  FXA.spawn(p.x, p.y + s, p.z, 0, 0, 0, 0.18, 8 * s, 14 * s, 4, 3.2, 2.2, 3, 1.2, 0.4, 1, 0, 0);
  const nf = Math.min(40, 8 + s * 7);
  for (let i = 0; i < nf; i++) {
    randDir(_v5); if (nearGround) _v5.y = Math.abs(_v5.y) * 0.8 + 0.2;
    const sp = rand(3, 9) * Math.sqrt(s);
    FXA.spawn(p.x + _v5.x * s, p.y + _v5.y * s, p.z + _v5.z * s, _v5.x * sp, _v5.y * sp + 2, _v5.z * sp, rand(0.5, 1.2) * (0.7 + s * 0.12), 3.2 * s, 7 * s, 4, 2.4, 0.9, 1.1, 0.22, 0.05, 1, 2.2, 1.5);
  }
  const ns = Math.min(30, 5 + s * 5);
  for (let i = 0; i < ns; i++) {
    randDir(_v5); if (nearGround) _v5.y = Math.abs(_v5.y);
    const sp = rand(1.5, 5) * Math.sqrt(s);
    FXS.spawn(p.x + _v5.x * s, p.y + _v5.y * s * 0.6, p.z + _v5.z * s, _v5.x * sp, _v5.y * sp + 1.5, _v5.z * sp, rand(4, 9) * (0.8 + s * 0.08), 4 * s, 14 * s, 0.06, 0.05, 0.045, 0.2, 0.18, 0.15, 0.9, 0.5, 0.9);
  }
  fxSparks(p, Math.min(40, 6 + s * 8), [3, 1.8, 0.6], 10 + s * 6);
  if (nearGround && !overWater) { fxDust(_v5.set(p.x, gy, p.z), Math.min(24, 4 + s * 4), 3 * s, 4 + s * 2); }
  if (s >= 1.5 && !overWater) spawnDebris(p, Math.min(10, Math.round(s * 2)), 10 + s * 3, 0.6 + s * 0.25);
  if (s >= 2.5 && nearGround) shockRing(p, s * 9, 0.6 + s * 0.08);
  shake(0.12 * s * s, p);
  snd(s >= 4 ? 'big' : 'boom', p, Math.min(1.6, 0.35 + s * 0.25));
}

/* ---------------- projectiles ---------------- */
const PROJ_MAX = 1000;
const projGeo = new T.BoxGeometry(1, 1, 1).translate(0, 0, -0.5);
const projCore = new T.InstancedMesh(projGeo, new T.MeshBasicMaterial({ transparent: true, blending: T.AdditiveBlending, depthWrite: false }), PROJ_MAX);
const projGlow = new T.InstancedMesh(projGeo, new T.MeshBasicMaterial({ transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false }), PROJ_MAX);
for (const im of [projCore, projGlow]) { im.frustumCulled = false; im.renderOrder = 7; for (let i = 0; i < PROJ_MAX; i++) { _m.makeScale(0, 0, 0); im.setMatrixAt(i, _m); im.setColorAt(i, _c.setRGB(1, 1, 1)); } scene.add(im); }
const PROJ = []; for (let i = 0; i < PROJ_MAX; i++) PROJ.push({ on: false, i, p: new V3(), v: new V3(), prev: new V3() });
let projFree = 0;
const _fp = new V3(); // private scratch: callers often pass the shared _v1 as `from` / blast centre
function fireProj(o) {
  let pr = null;
  for (let k = 0; k < PROJ_MAX; k++) { const c = PROJ[(projFree + k) % PROJ_MAX]; if (!c.on) { pr = c; projFree = (c.i + 1) % PROJ_MAX; break; } }
  if (!pr) return null;
  pr.on = true; pr.p.copy(o.from); pr.prev.copy(o.from);
  _fp.subVectors(o.to, o.from); const dist = _fp.length() || 1; _fp.divideScalar(dist);
  pr.v.copy(o.vel || _fp.multiplyScalar(o.speed || 300));
  pr.speed = o.speed || pr.v.length();
  pr.maxDist = o.maxDist !== undefined ? o.maxDist : dist + 4; pr.trav = 0;
  pr.kind = o.kind || 'bolt'; pr.team = o.team; pr.src = o.src || null; pr.dmg = o.dmg || 0; pr.splash = o.splash || 0;
  pr.w = o.w || 0.25; pr.len = o.len || 6; pr.col = o.color || [2, 2, 2]; pr.grav = o.grav || 0; pr.homing = o.homing || 0; pr.target = o.target || null;
  pr.checkEnts = o.checkEnts !== false && pr.kind !== 'bullet'; pr.fx = o.fx || 1; pr.life = o.life || 8; pr.age = 0; pr.player = !!(o.src && o.src.isPlayer);
  projCore.setColorAt(pr.i, _c.setRGB(Math.min(4, pr.col[0] * 0.6 + 0.9), Math.min(4, pr.col[1] * 0.6 + 0.9), Math.min(4, pr.col[2] * 0.6 + 0.9)));
  projGlow.setColorAt(pr.i, _c.setRGB(pr.col[0], pr.col[1], pr.col[2]));
  projCore.instanceColor.needsUpdate = projGlow.instanceColor.needsUpdate = true;
  return pr;
}
function projImpact(pr, hitEnt, bld, water) {
  pr.on = false; _m.makeScale(0, 0, 0); projCore.setMatrixAt(pr.i, _m); projGlow.setMatrixAt(pr.i, _m);
  const p = pr.p;
  if (hitEnt && pr.dmg > 0) hitEnt.damage(pr.dmg, pr.src, pr.kind);
  if (bld && pr.dmg > 0) bld.damage(pr.dmg * (pr.splash > 0 ? 1 : 0.3), pr.src);
  if (pr.splash > 0) explodeDamage(p, pr.splash, pr.dmg * 0.75, pr.src, pr.team, hitEnt);
  if (pr.kind === 'bullet') { if (water) FXS.spawn(p.x, 0.3, p.z, 0, 4, 0, 0.6, 0.4, 1.2, 0.7, 0.75, 0.78, 0.6, 0.65, 0.68, 0.7, 1, -9); else if (Math.random() < 0.5) { FXS.spawn(p.x, p.y + 0.2, p.z, 0, 1.2, 0, 0.9, 0.4, 1.6, 0.33, 0.29, 0.22, 0.4, 0.36, 0.3, 0.6, 1, 0.2); if (Math.random() < 0.35) fxSparks(p, 2, [3, 2, 1], 6); } return; }
  const vis = pr.fx;
  if (vis < 0.9) { FXA.spawn(p.x, p.y, p.z, 0, 0, 0, 0.12, 2.5 * vis + 1, 4 * vis + 1, pr.col[0], pr.col[1], pr.col[2], pr.col[0] * 0.5, pr.col[1] * 0.5, pr.col[2] * 0.5, 1, 0, 0); fxSparks(p, 5, [pr.col[0] + 0.5, pr.col[1] + 0.5, pr.col[2] + 0.5], 9); if (water) fxWaterSplash(p, 0.6); else if (!hitEnt) fxDust(p, 2, 1.2, 2); return; }
  fxExplosion(p, vis);
}
function updateProjectiles(dt) {
  for (const pr of PROJ) {
    if (!pr.on) continue;
    pr.age += dt;
    if (pr.homing && pr.target && pr.target.alive) {
      pr.target.aim(_v1); _v1.sub(pr.p).normalize().multiplyScalar(pr.speed);
      pr.v.lerp(_v1, Math.min(1, pr.homing * dt)).setLength(pr.speed);
    }
    if (pr.grav) pr.v.y -= 9.8 * pr.grav * dt;
    pr.prev.copy(pr.p); pr.p.addScaledVector(pr.v, dt); const step = pr.v.length() * dt; pr.trav += step;
    if (pr.kind === 'missile') {
      FXS.spawn(pr.prev.x, pr.prev.y, pr.prev.z, rand(-0.5, 0.5), rand(0, 0.8), rand(-0.5, 0.5), rand(1.2, 2.4), 0.8, 3.2, 0.55, 0.52, 0.48, 0.32, 0.3, 0.28, 0.55, 0.8, 0.4);
      FXA.spawn(pr.prev.x, pr.prev.y, pr.prev.z, 0, 0, 0, 0.08, 1.4, 0.6, 3.5, 2.2, 0.8, 2, 0.6, 0.2, 1, 0, 0);
    }
    const gy = H(pr.p.x, pr.p.z);
    let done = false;
    if (pr.p.y < gy) { pr.p.y = gy + 0.3; projImpact(pr, null, null, false); done = true; }
    else if (pr.p.y < 0 && gy < 0) { pr.p.y = 0.2; projImpact(pr, null, null, true); done = true; }
    else if (pr.p.y < 230) { const b = buildingAt(pr.p); if (b) { projImpact(pr, null, b, false); done = true; } }
    if (!done && pr.checkEnts) {
      _v2.addVectors(pr.p, pr.prev).multiplyScalar(0.5);
      for (const e of ENTS) {
        if (!e.alive || e.team === pr.team || !e.hitR) continue;
        const dx = e.pos.x - pr.p.x, dz = e.pos.z - pr.p.z; if (dx * dx + dz * dz > (e.cull + 20) * (e.cull + 20)) continue;
        if (e.surfDist(pr.p) < 0 || e.surfDist(_v2) < 0) { projImpact(pr, e, null, false); done = true; break; }
      }
    }
    if (!done && (pr.trav >= pr.maxDist || pr.age > pr.life)) { projImpact(pr, null, null, false); done = true; }
    if (done) continue;
    _v1.copy(pr.v).normalize(); _q.setFromUnitVectors(ZAX, _v1);
    const len = Math.min(pr.len, pr.trav + 0.5);
    _m.compose(pr.p, _q, _s.set(pr.w, pr.w, len)); projCore.setMatrixAt(pr.i, _m);
    _m.compose(pr.p, _q, _s.set(pr.w * 3.5, pr.w * 3.5, len * 1.2)); projGlow.setMatrixAt(pr.i, _m);
  }
  projCore.instanceMatrix.needsUpdate = projGlow.instanceMatrix.needsUpdate = true;
}

/* ---------------- FX update ---------------- */
function updateFX(dt) {
  FXA.update(dt); FXS.update(dt); updateEmitters(dt);
  for (const l of LIGHTS) { if (l.intensity <= 0) continue; l.userData.t += dt; const k = 1 - l.userData.t / l.userData.life; l.intensity = k > 0 ? l.userData.i0 * k * k : 0; }
  for (const r of RINGS) { if (!r.visible) continue; const u = r.userData; u.t += dt; const k = u.t / u.life; if (k >= 1) { r.visible = false; continue; } const sc = u.r * (0.1 + 0.9 * Math.sqrt(k)); r.scale.set(sc, 1, sc); r.material.opacity = (1 - k) * 0.9; }
  for (const b of BEAMS) { if (!b.visible) continue; const u = b.userData; u.t += dt; if (u.t > u.life) { b.visible = false; continue; } const k = u.t / u.life; const fl = 0.8 + 0.4 * Math.random(); const w = u.w * fl * (k < 0.1 ? k / 0.1 : 1 - Math.max(0, (k - 0.7) / 0.3)); b.scale.x = b.scale.z = Math.max(0.01, w); }
}

/* ---------------- buildings + landmarks ---------------- */
const BUILDINGS = [];
const bldMats = [
  std(0x8a8f96, 0.85, 0.15, { map: facadeTex, emissiveMap: facadeLit, emissive: 0xffffff, emissiveIntensity: 1.1 }),
  std(0x9b8f80, 0.85, 0.1, { map: facadeTex, emissiveMap: facadeLit, emissive: 0xffffff, emissiveIntensity: 0.9 }),
  std(0x6e7a82, 0.6, 0.35, { map: facadeTex, emissiveMap: facadeLit, emissive: 0xffffff, emissiveIntensity: 1.3 }),
];
const rubbleMat = std(0x3a3632, 0.95, 0.05);
class Building {
  constructor(x, z, w, d, h, opts = {}) {
    this.x = x; this.z = z; this.w = w; this.d = d; this.h = h; this.landmark = opts.name || null; this.mode = opts.mode || 'sink'; this.generic = !opts.mesh && !opts.mat;
    this.x0 = x - w / 2; this.x1 = x + w / 2; this.z0 = z - d / 2; this.z1 = z + d / 2;
    this.gy = Math.min(H(this.x0, this.z0), H(this.x1, this.z1), H(this.x0, this.z1), H(this.x1, this.z0), H(x, z)) - 1;
    this.top = this.gy + h; this.maxHp = opts.hp || w * d * h * 0.55; this.hp = this.maxHp;
    if (opts.mesh) { this.mesh = opts.mesh; this.mesh.position.set(x, this.gy, z); }
    else {
      const g = new T.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); boxProjUV(g, 28, true);
      this.mesh = new T.Mesh(g, opts.mat || pick(bldMats)); this.mesh.position.set(x, this.gy, z);
      if (h > 50 && Math.random() < 0.5) { const cap = new T.Mesh(new T.BoxGeometry(w * 0.6, 6, d * 0.6), MAT_CONC); cap.position.y = h + 3; this.mesh.add(cap); }
      if (Math.random() < 0.5) { const ant = new T.Mesh(new T.CylinderGeometry(0.25, 0.25, 14, 5), MAT_GUN); ant.position.set(w * 0.25, h + 7, 0); this.mesh.add(ant); }
    }
    this.mesh.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(this.mesh);
    this.alive = true; this.fallT = 0; this.rubble = null; this.smoked = false; this.base = { x, z, w, d, h, opts };
    this.fallDir = new V3(rand(-1, 1), 0, rand(-1, 1)).normalize();
  }
  damage(a, src) {
    if (!this.alive) return; this.hp -= a;
    if (!this.smoked && this.hp < this.maxHp * 0.5) { this.smoked = true; addEmitter(new V3(this.x + rand(-this.w, this.w) * 0.3, this.top - this.h * 0.3, this.z + rand(-this.d, this.d) * 0.3), 1.6 + this.w / 12, 90); }
    if (this.hp <= 0) this.collapse(src);
  }
  collapse(src) {
    this.alive = false; this.fallT = 0.001;
    fxExplosion(_v1.set(this.x, this.gy + this.h * 0.4, this.z), 2.5);
    if (this.landmark) { comms(null, `${this.landmark} is coming down!`, 'cmd'); banner(`${this.landmark} destroyed`, 'Landmark lost', '#ffb547'); }
    snd('big', _v1.set(this.x, this.gy + 10, this.z), 1.2);
  }
  update(dt) {
    if (this.alive || this.fallT <= 0) return;
    this.fallT += dt; const k = this.fallT;
    if (this.mode === 'sink') {
      const dur = 5 + this.h / 40; const t = Math.min(1, k / dur);
      this.mesh.position.y = this.gy - this.h * 0.92 * t * t; this.mesh.rotation.x = this.fallDir.x * 0.07 * t; this.mesh.rotation.z = this.fallDir.z * 0.07 * t;
      if (Math.random() < 0.7) fxDust(_v1.set(this.x + rand(-this.w, this.w) / 2, this.gy + rand(0, 3), this.z + rand(-this.d, this.d) / 2), 2, 5 + this.w * 0.15, 6);
      if (Math.random() < dt * 4) fxExplosion(_v1.set(this.x + rand(-this.w, this.w) / 2, this.mesh.position.y + this.h * rand(0.3, 1), this.z + rand(-this.d, this.d) / 2), 1.2);
      shake(dt * 0.5, _v1.set(this.x, this.gy, this.z));
      if (t >= 1) this.toRubble();
    } else {
      const dur = 6; const t = Math.min(1, k / dur); const ang = t * t * (Math.PI / 2 - 0.08);
      const ax = _v1.set(this.fallDir.z, 0, -this.fallDir.x);
      this.mesh.quaternion.setFromAxisAngle(ax, ang);
      if (Math.random() < 0.8) fxDust(_v2.set(this.x, this.gy + 1, this.z), 2, 6, 7);
      if (t >= 1 && !this.landed) {
        this.landed = true; shake(1.5, _v2.set(this.x, this.gy, this.z));
        for (let i = 1; i <= 8; i++) { const r = this.h * i / 8; _v2.set(this.x + this.fallDir.x * r, 0, this.z + this.fallDir.z * r); _v2.y = groundY(_v2.x, _v2.z); fxDust(_v2, 6, 10, 10); explodeDamage(_v2, 14, 600, null, 0); if (i % 2 === 0) fxExplosion(_v2, 2); }
        snd('big', _v2, 1.4);
        setTimeout(() => this.toRubble(), 2500);
      }
    }
  }
  toRubble() {
    if (this.rubble) return; this.fallT = 0;
    scene.remove(this.mesh);
    const g = new T.DodecahedronGeometry(1, 0); const r = new T.Mesh(g, rubbleMat);
    r.scale.set(this.w * 0.6, Math.min(8, this.h * 0.1) + 2, this.d * 0.6); r.position.set(this.x, this.gy + 1, this.z); r.rotation.y = Math.random() * 3; r.receiveShadow = true; r.castShadow = true;
    scene.add(r); this.rubble = r; addEmitter(new V3(this.x, this.gy + 3, this.z), 2 + this.w / 10, 70);
  }
  restore() {
    if (this.rubble) { scene.remove(this.rubble); this.rubble = null; }
    this.mesh.position.set(this.x, this.gy, this.z); this.mesh.rotation.set(0, 0, 0); this.mesh.quaternion.identity(); scene.add(this.mesh);
    this.alive = true; this.hp = this.maxHp; this.fallT = 0; this.smoked = false; this.landed = false;
  }
}
/* static 40 m grid over BUILDINGS (padded 8 m so pushOut radii up to 8 need only one cell) */
const B_GRID = { map: new Map(), n: -1 }, NO_B = [];
function bldCell(x, z) {
  if (B_GRID.n !== BUILDINGS.length) {
    B_GRID.n = BUILDINGS.length; const m = B_GRID.map; m.clear();
    for (const b of BUILDINGS) for (let i = Math.floor((b.x0 - 8) / 40); i <= Math.floor((b.x1 + 8) / 40); i++) for (let j = Math.floor((b.z0 - 8) / 40); j <= Math.floor((b.z1 + 8) / 40); j++) { const k = i * 4096 + j; let L = m.get(k); if (!L) m.set(k, L = []); L.push(b); }
  }
  return B_GRID.map.get(Math.floor(x / 40) * 4096 + Math.floor(z / 40)) || NO_B;
}
let _bStamp = 0;
function bldNear(x, z, r, out) { // every building whose cell the blast touches, each one once
  out.length = 0; _bStamp++;
  for (let i = Math.floor((x - r) / 40); i <= Math.floor((x + r) / 40); i++) for (let j = Math.floor((z - r) / 40); j <= Math.floor((z + r) / 40); j++) {
    const L = B_GRID.map.get(i * 4096 + j); if (!L) continue;
    for (const b of L) if (b._bs !== _bStamp) { b._bs = _bStamp; out.push(b); }
  }
  return out;
}
function buildingAt(p) {
  for (const b of bldCell(p.x, p.z)) if (b.alive && p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1 && p.y < b.top && p.y > b.gy) return b;
  return null;
}
function pushOut(p, r) {
  for (const b of bldCell(p.x, p.z)) {
    if (!b.alive || p.y > b.top - 0.4 || p.y < b.gy - 0.5) continue; /* standing on the roof is not inside it; under a sky platform is not either */
    if (p.x > b.x0 - r && p.x < b.x1 + r && p.z > b.z0 - r && p.z < b.z1 + r) {
      const a = p.x - (b.x0 - r), bb = (b.x1 + r) - p.x, c = p.z - (b.z0 - r), d = (b.z1 + r) - p.z; const m = Math.min(a, bb, c, d);
      if (m === a) p.x = b.x0 - r; else if (m === bb) p.x = b.x1 + r; else if (m === c) p.z = b.z0 - r; else p.z = b.z1 + r;
    }
  }
}
(function buildCity() {
  /* downtown: inside the ring highway, avenues out to the stadium, the bridges, the dome and the towers on the point */
  const C = CITYC;
  const AVE = [[-290, 90], [BRIDGES[0].x, BRIDGES[0].z + 44], [BRIDGES[1].x, BRIDGES[1].z + 44], [330, 0], [40, 385]].map(([x, z]) => [x - C.x, z - C.z]);
  const onAve = (x, z, m) => { x -= C.x; z -= C.z; return AVE.some(([ax, az]) => { const L = Math.hypot(ax, az), t = clamp((x * ax + z * az) / (L * L), 0, 1); return Math.hypot(x - ax * t, z - az * t) < m; }); };
  const clear = (x, z, w, d) => Math.hypot(x - HIVE.x, z - HIVE.z) > HIVE.R + 14 + Math.max(w, d) / 2 && !(x + w / 2 > UNDERPASS.x0 - 10 && x - w / 2 < UNDERPASS.x1 + 10) && !(z + d / 2 > BUNKER.back - 12 && x + w / 2 > BUNKER.x0 - 12 && x - w / 2 < BUNKER.x1 + 12) && Math.abs(Math.hypot(x - C.x, z - C.z) - 176) > 12 + Math.max(w, d) / 2 && Math.hypot(x - C.x, z - C.z) + Math.max(w, d) / 2 < 192 && !onAve(x, z, 8 + Math.max(w, d) / 2) && !BUILDINGS.some(b => Math.abs(b.x - x) < (b.w + w) / 2 + 4 && Math.abs(b.z - z) < (b.d + d) / 2 + 4);
  /* the skyline: thirteen true skyscrapers you can see from anywhere (and see who holds their roofs) */
  const SKY = [];
  /* thirteen of them, in three sizes, six big to four medium to three small: [footprint from, to, height from, to] */
  const SKY_CLS = [[26, 32, 150, 195], [21, 26, 95, 128], [16, 21, 55, 82]];
  for (let k = 0; k < 600 && SKY.length < 13; k++) {
    const sc = SKY_CLS[SKY.length % 13 < 6 ? 0 : SKY.length % 13 < 10 ? 1 : 2];
    const a = Math.random() * 6.283, r = rand(40, 150), x = C.x + Math.cos(a) * r, z = C.z + Math.sin(a) * r, w = rand(sc[0], sc[1]), d = rand(sc[0], sc[1]);
    if (SKY.some(o => Math.hypot(o[0] - x, o[1] - z) < 50) || !clear(x, z, w, d) || H(x, z) < 1) continue;
    SKY.push([x, z]); BUILDINGS.push(new Building(x, z, w, d, rand(sc[2], sc[3])));
  }
  /* low blocks between them: street cover, not a maze */
  for (let i = 0; i < 300 && BUILDINGS.length < SKY.length + 38; i++) {
    const a = Math.random() * 6.283, r = rand(36, 185), x = C.x + Math.cos(a) * r, z = C.z + Math.sin(a) * r, w = rand(10, 18), d = rand(10, 18);
    if (!clear(x, z, w + 10, d + 10) || H(x, z) < 1) continue; BUILDINGS.push(new Building(x, z, w, d, rand(8, 22)));
  }
  // landmark: the Spire
  const spire = new T.Group(); const sm = std(0x9aa0a6, 0.4, 0.6, { map: facadeTex, emissiveMap: facadeLit, emissive: 0xbfe6ff, emissiveIntensity: 1.2 });
  let y = 0; [[11, 9, 40], [9, 7.5, 50], [7.5, 5.5, 50], [5.5, 3, 40], [3, 0.6, 30]].forEach(([r0, r1, h]) => { const g = new T.CylinderGeometry(r1, r0, h, 6); g.translate(0, h / 2, 0); boxProjUV(g, 20, false); const m = new T.Mesh(g, sm); m.position.y = y; spire.add(m); const band = new T.Mesh(new T.CylinderGeometry(r1 + 0.4, r1 + 0.4, 1.2, 6), basic(new T.Color(1.6, 2.4, 3))); band.position.y = y + h; spire.add(band); y += h; });
  const beacon = new T.Mesh(new T.SphereGeometry(1.4, 10, 8), basic(new T.Color(4, 0.6, 0.3))); beacon.position.y = y + 1; spire.add(beacon); spire.userData.beacon = beacon;
  for (let i = BUILDINGS.length - 1; i >= 0; i--) { const b = BUILDINGS[i]; if (Math.abs(b.x - (CITYC.x - 44)) < (b.w + 18) / 2 + 4 && Math.abs(b.z - (CITYC.z + 10)) < (b.d + 18) / 2 + 4) { scene.remove(b.mesh); BUILDINGS.splice(i, 1); } }
  BUILDINGS.push(new Building(CITYC.x - 44, CITYC.z + 10, 18, 18, y, { mesh: spire, name: 'The Aeris Spire', mode: 'topple', hp: 14000 })); /* beside the underpass's roof strip, not on it */
  // dish tower at Ridge Array
  const dish = new T.Group(); const t = new T.Mesh(new T.CylinderGeometry(1.5, 3, 34, 8).translate(0, 17, 0), MAT_CONC); dish.add(t);
  const dsh = new T.Mesh(new T.SphereGeometry(12, 20, 10, 0, Math.PI * 2, 0, 1.0), std(0xbfc2c4, 0.5, 0.5, { side: T.DoubleSide })); dsh.position.set(0, 38, 0); dsh.rotation.x = -1.1; dish.add(dsh);
  { const R = DIST('rail'); BUILDINGS.push(new Building(R.x - 95, R.z - 52, 8, 8, 46, { mesh: dish, name: 'The airport radar', mode: 'topple', hp: 5000 })); }
  // smelters under the volcano
  for (let i = 0; i < 5; i++) { const D = DIST('ash'), x = D.x + rand(-50, 50), z = D.z + rand(-50, 50); if (Math.hypot(x - D.x, z - D.z) < 28 || H(x, z) < 1) continue; BUILDINGS.push(new Building(x, z, rand(14, 22), rand(14, 26), rand(10, 22), { mat: std(0x5c4a3c, 0.9, 0.3) })); }
  const stack = new T.Group(); stack.add(new T.Mesh(new T.CylinderGeometry(3, 4.5, 60, 12).translate(0, 30, 0), MAT_RUST));
  BUILDINGS.push(new Building(DIST('ash').x + 45, DIST('ash').z + 30, 9, 9, 60, { mesh: stack, name: 'The smelter stack', mode: 'topple', hp: 4000 }));
  // HQ hangars
  for (const t of ARMIES) { const h = HQ[t], back = h.z > 0 ? 40 : -40, col = { 1: 0x56606a, 2: 0x4a3431, 4: 0x5a4a2a, 5: 0x2f4a34 }[t]; for (const off of [-50, 50]) BUILDINGS.push(new Building(h.x + off, h.z + back, 30, 22, 14, { mat: std(col, 0.7, 0.4), hp: 1e6 })); }
})();

/* ---------------- props: rocks, trees, tank traps, sandbag walls ---------------- */
let TREE_CROWNS = null;
(function buildProps() {
  const place = (im, n, fn) => { let k = 0; for (let tries = 0; tries < n * 6 && k < n; tries++) { const r = fn(); if (!r) continue; _m.compose(r.p, _q.setFromEuler(new T.Euler(r.rx || 0, r.ry || 0, r.rz || 0)), r.s); im.setMatrixAt(k++, _m); } im.count = k; im.castShadow = true; im.receiveShadow = true; scene.add(im); };
  const okSpot = (x, z) => { if (Math.hypot(x - CITYC.x, z - CITYC.z) < 235) return false; for (const f of FLATS) if (Math.hypot(x - f.x, z - f.z) < 40) return false; return true; };
  place(new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), std(0x4a4540, 0.95, 0), 500), 500, () => { const x = rand(-BOUND, BOUND), z = rand(-BOUND, BOUND); const h = H(x, z); if (h < 1.5 || !okSpot(x, z)) return null; const s = rand(0.8, 5); return { p: new V3(x, h + s * 0.2, z), s: new V3(s, s * rand(0.5, 1), s * rand(0.7, 1.3)), ry: rand(0, 6), rx: rand(-.4, .4) }; });
  const trunkG = new T.CylinderGeometry(0.25, 0.4, 4, 5).translate(0, 2, 0), crownG = new T.ConeGeometry(2.2, 8, 7).translate(0, 7, 0);
  const tr = []; for (let i = 0; i < 900 && tr.length < 340; i++) { const x = rand(-BOUND, BOUND), z = rand(-BOUND, BOUND); const h = H(x, z); if (h < 4 || h > 115 || !okSpot(x, z) || Math.hypot(x - VOLCANO.x, z - VOLCANO.z) < 200 || vnoise(x * 0.012, z * 0.012) < 0.42) continue; tr.push([x, h, z, rand(0.7, 1.6), Math.random() < 0.3]); }
  const trunks = new T.InstancedMesh(trunkG, std(0x2a2018, 0.9, 0), tr.length), crowns = new T.InstancedMesh(crownG, std(0xffffff, 0.92, 0), tr.length);
  tr.forEach((t, i) => { _m.compose(_v1.set(t[0], t[1], t[2]), _q.identity(), _s.set(t[3], t[3], t[3])); trunks.setMatrixAt(i, _m); _m.compose(_v1, _q, t[4] ? _s.set(0.001, 0.001, 0.001) : _s.set(t[3], t[3], t[3])); crowns.setMatrixAt(i, _m); { const l = rand(0.55, 1.1); crowns.setColorAt(i, _c.setRGB(0.07 * l + rand(0, 0.03), 0.13 * l, 0.06 * l)); } });
  for (const m of [trunks, crowns]) { m.castShadow = true; scene.add(m); } TREE_CROWNS = crowns; /* world.js swaps in the tiered crown once the model helpers exist */
  const beamG = new T.BoxGeometry(0.5, 0.5, 4.4);
  const traps = []; for (let i = 0; i < 400 && traps.length < 120; i++) { const L = pick(TRENCHES), q = pick(L), side = Math.random() < 0.5 ? -1 : 1, x = q[0] + rand(-30, 30), z = q[1] + side * rand(14, 30); const h = H(x, z); if (h < 0.5 || riverD(x, z) < 14) continue; /* dragon's teeth in front of the trench lines */ traps.push([x, h, z, rand(0, 3)]); }
  for (let k = 0; k < 3; k++) { const im = new T.InstancedMesh(beamG, MAT_RUST, traps.length); traps.forEach((t, i) => { const e = k === 0 ? new T.Euler(0.6, t[3], 0) : k === 1 ? new T.Euler(-0.6, t[3] + 1.0, 0) : new T.Euler(Math.PI / 2, 0, t[3]); _m.compose(_v1.set(t[0], t[1] + 1.4, t[2]), _q.setFromEuler(e), _s.set(1, 1, 1)); im.setMatrixAt(i, _m); }); im.castShadow = true; scene.add(im); }
  const wallG = new T.BoxGeometry(6, 1.3, 1.1); const walls = new T.InstancedMesh(wallG, std(0x6b5d48, 0.95, 0), 120); let wi = 0;
  for (const c of CPDEF) for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2 + rand(-0.15, 0.15); const r = rand(14, 24); const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r; if (buildingAt(_v1.set(x, H(x, z) + 1, z))) continue; _m.compose(_v1.set(x, H(x, z) + 0.6, z), _q.setFromEuler(new T.Euler(0, -a + Math.PI / 2 + rand(-0.3, 0.3), 0)), _s.set(1, 1, 1)); walls.setMatrixAt(wi++, _m); }
  walls.count = wi; walls.castShadow = true; walls.receiveShadow = true; scene.add(walls);
  // burnt-out wrecks for atmosphere
  const wreckG = new T.BoxGeometry(5, 2, 8); const wrecks = new T.InstancedMesh(wreckG, std(0x161412, 0.9, 0.3), 40); let k = 0;
  for (let i = 0; i < 120 && k < 40; i++) { const x = rand(-BOUND, BOUND), z = rand(-BOUND, BOUND); const h = H(x, z); if (h < 1 || h > 60 || buildingAt(_v1.set(x, h + 1, z))) continue; _m.compose(_v1.set(x, h + 0.6, z), _q.setFromEuler(new T.Euler(rand(-.2, .2), rand(0, 6), rand(-.4, .4))), _s.set(1, 1, 1)); wrecks.setMatrixAt(k++, _m); if (k < 12) addEmitter(new V3(x, h + 1.5, z), 1.4, 1e9); }
  wrecks.count = k; wrecks.castShadow = true; scene.add(wrecks);
})();

/* ---------------- comms + banner (DOM) ---------------- */
const commsEl = $('#comms'); let waveLevel = 0;
function comms(who, text, cls = '') {
  const d = document.createElement('div'); d.className = 'msg ' + cls;
  d.innerHTML = (who ? `<span class="who">[${who}]</span> ` : `<span class="who">[COMMAND]</span> `) + text;
  commsEl.appendChild(d); waveLevel = 1;
  const msgs = commsEl.querySelectorAll('.msg'); if (msgs.length > 7) msgs[0].remove();
  setTimeout(() => { d.style.opacity = '0'; }, 11000); setTimeout(() => d.remove(), 12200);
}
const bannerEl = $('#banner'); let bannerT = 0;
function banner(t, s, color) { bannerEl.querySelector('.t').textContent = t; bannerEl.querySelector('.t').style.color = color || ''; bannerEl.querySelector('.s').textContent = s || ''; bannerEl.classList.add('on'); bannerT = 3.2; }
const feedEl = $('#feed');
function killFeed(killer, victim, how, mine) {
  const d = document.createElement('div'); d.className = 'kf' + (mine ? ' me' : '');
  const kc = killer ? TEAM[killer.team].css : '';
  d.innerHTML = (killer ? `<span class="${kc}">${killer.name}</span>` : '<span>Environment</span>') + `<span class="w">${how}</span><span class="${TEAM[victim.team].css}">${victim.name}</span>`;
  feedEl.appendChild(d); const all = feedEl.querySelectorAll('.kf'); if (all.length > 6) all[0].remove();
  setTimeout(() => { d.style.opacity = '0'; }, 6000); setTimeout(() => d.remove(), 6900);
}
