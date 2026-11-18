'use strict';
/* ===================== IRON MERIDIAN · the Aeris network: the bunker is the hub of the whole island =====================
   Three systems meet in the Mesa Bunker and between them reach every district:
   · THE SKYRAIL: an elevated railway on a viaduct, a loop round the island with a station at every district, its
     hub station over the highway at the bunker gate. Trains run both ways round it.
   · THE SEWERS: storm-drain portals in every district, all draining to the bunker's sewer gate on its lower floor;
     big outfall pipes empty into the river.
   · THE GLASS TUNNELS (aeris.js): from the bunker's lower floor under the sea to the marina and the archipelago.
   Troops of both armies use it: a soldier with a long way to go, standing by a station, a drain or a tunnel stop,
   rides to the stop nearest his objective (through the hub) and walks on from there. While riding he is out of the
   fight. The bunker's command wall shows the network map. The minimap draws it. */
const NET = { nodes: [], rail: null, railPts: [], trains: [], stations: [], sewers: [], hubs: {} };
(function buildNetwork() {
  const G = new T.Group(); G.name = 'network'; scene.add(G);
  const M = { conc: std(0x7a7c7e, 0.85, 0.08), steel: std(0x3a3e44, 0.45, 0.7), rail: std(0x2a2c30, 0.4, 0.85), lit: basic(new T.Color(3, 2.4, 1.3)), sign: basic(new T.Color(3.2, 1.4, 0.4)), drain: std(0x4a4640, 0.95, 0.05), dark: std(0x0c0d0e, 0.9, 0.1), water: basic(new T.Color(0.5, 1.2, 1.5)) };
  /* ---------- the skyrail: stations and the loop through them ---------- */
  const ST = [['Bunker Hub', 30, 318], ['Hero Muster', -120, 330], ['Southwest', -240, 250], ['Stadium', -228, 158], ['Annexed Sector', -320, -40], ['River West', -180, -120], ['Volcano Foot', -112, -300], ['Airport', 60, -292], ['Waterfall Valley', 250, -180], ['Dome & Mall', 392, 60], ['Maritime Port', 286, 248], ['Gold Towers', 168, 305]];
  const ctrl = ST.map(([n, x, z]) => new V3(x, 0, z));
  const flat = new T.CatmullRomCurve3(ctrl, true, 'centripetal'), L = flat.getLength(), N = Math.ceil(L / 5), ys = new Float32Array(N + 1), pts = [];
  for (let i = 0; i <= N; i++) { const p = flat.getPointAt(i / N); pts.push(p); ys[i] = Math.max(0, H(p.x, p.z)); }
  const yy = new Float32Array(N + 1); for (let i = 0; i <= N; i++) { let m = 0; for (let k = -6; k <= 6; k++) m = Math.max(m, ys[(i + k + N) % N]); yy[i] = m + 13; } /* clear the ground and the river with room under the deck */
  for (let pass = 0; pass < 6; pass++) for (let i = 0; i <= N; i++) yy[i] = (yy[(i - 1 + N) % N] + yy[i] * 2 + yy[(i + 1) % N]) / 4;
  for (let i = 0; i <= N; i++) pts[i].y = yy[i];
  const rail = new T.CatmullRomCurve3(pts.slice(0, N), true); NET.rail = rail; NET.railL = rail.getLength(); NET.railPts = pts;
  { const b = bucket(), lat = new V3();
    const ribbon = (off, w, dy, key) => { const pos = [], idx = []; for (let i = 0; i <= N; i++) { const u = i / N, p = rail.getPointAt(u % 1), tg = rail.getTangentAt(u % 1); lat.set(tg.z, 0, -tg.x).normalize(); for (const s of [-1, 1]) pos.push(p.x + lat.x * (off + s * w / 2), p.y + dy, p.z + lat.z * (off + s * w / 2)); if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } } const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; };
    b.add('conc', ribbon(0, 7, -0.6, 'conc')); b.add('conc', ribbon(0, 7.4, -1.6, 'conc'));
    for (const off of [-2.4, -0.9, 0.9, 2.4]) b.add('rail', ribbon(off, 0.22, -0.4));
    for (const off of [-3.6, 3.6]) b.add('steel', ribbon(off, 0.2, 0.5));
    /* piers every 22 m, down to the ground or the river bed */
    for (let d = 0; d < NET.railL; d += 22) { const u = d / NET.railL, p = rail.getPointAt(u), g0 = H(p.x, p.z), base = Math.min(g0, 0) - 2, hgt = p.y - 1.6 - base; if (hgt < 2) continue; b.add('conc', new T.CylinderGeometry(1.1, 1.4, hgt, 8).translate(p.x, base + hgt / 2, p.z)); b.add('conc', new T.BoxGeometry(5, 1, 2).translate(p.x, p.y - 2, p.z)); }
    /* stations: platform, canopy, lamp, sign */
    for (const [name, x, z] of ST) { let bu = 0, bd = 1e9; for (let i = 0; i < N; i++) { const q = pts[i], dd = (q.x - x) ** 2 + (q.z - z) ** 2; if (dd < bd) { bd = dd; bu = i / N; } }
      const p = rail.getPointAt(bu), tg = rail.getTangentAt(bu), ya = Math.atan2(tg.x, tg.z); lat.set(tg.z, 0, -tg.x).normalize();
      for (const s of [-1, 1]) { const px = p.x + lat.x * 5.5 * s, pz = p.z + lat.z * 5.5 * s; b.add('conc', new T.BoxGeometry(4, 0.8, 26).rotateY(ya).translate(px, p.y - 0.4, pz)); b.add('steel', new T.BoxGeometry(4.6, 0.3, 24).rotateY(ya).translate(px, p.y + 4.4, pz)); b.add('lit', new T.BoxGeometry(0.4, 0.2, 22).rotateY(ya).translate(px - lat.x * 2 * s, p.y + 4.2, pz - lat.z * 2 * s)); }
      b.add('steel', new T.CylinderGeometry(0.6, 0.8, p.y, 8).translate(p.x + lat.x * 9, p.y / 2, p.z + lat.z * 9)); /* the stair tower */
      NET.stations.push({ name, x: p.x + lat.x * 9, z: p.z + lat.z * 9, u: bu, y: p.y }); addLight(p.x, p.y + 4, p.z, 3, 2.4, 1.3, 6); }
    const g = new T.Group(); bakeInto(g, b, M, ['conc']); G.add(g); }
  /* the trains: four cars each, both ways round, a pause at every station */
  { const carG = mergeGeos([new T.BoxGeometry(2.8, 3, 13).translate(0, 1.5, 0), new T.BoxGeometry(2.9, 0.8, 12.4).translate(0, 2.2, 0)]), carM = [std(0xe8e8e2, 0.35, 0.4, { emissive: 0x3a2a10, emissiveIntensity: 0.4 }), std(0xd8a01a, 0.4, 0.5)];
    for (let k = 0; k < 2; k++) NET.trains.push({ u: k * 0.5, dir: k ? -1 : 1, wait: 0, last: -1, cars: [0, 1, 2, 3].map(i => { const m = new T.Mesh(carG, carM[i === 0 ? 1 : 0]); m.castShadow = true; G.add(m); return m; }) }); }
  /* ---------- the sewers: drain portals in every district, the gate in the bunker, outfalls into the river ---------- */
  { const b = bucket(), DR = [['Stadium drain', -262, 150, 2.3], ['Sector drain', -330, 72, 1.6], ['Volcano drain', -150, -208, 0.1], ['Airport drain', 120, -298, 3.0], ['Falls drain', 238, -232, 0.4], ['Dome drain', 300, -50, 2.8], ['Port drain', 290, 330, 1.2], ['Towers drain', 96, 352, 0.5], ['Muster drain', -126, 368, -0.6], ['Southwest drain', -250, 300, 0.8]];
    const portal = (x, z, ya) => { const y = Math.max(0.3, H(x, z)); const g = mergeGeos([new T.BoxGeometry(9, 5, 2).translate(0, 2.2, 0)]); b.add('drain', xf(g, [x, y, z], [0, ya, 0])); b.add('dark', xf(new T.CylinderGeometry(2.1, 2.1, 2.2, 14).rotateX(Math.PI / 2), [x, y + 2.1, z], [0, ya, 0]));
      for (let k = -2; k <= 2; k++) b.add('steel', xf(new T.BoxGeometry(0.18, 4.2, 0.18), [x + Math.cos(ya) * k * 0.8 + Math.sin(ya) * 1.15, y + 2.1, z - Math.sin(ya) * k * 0.8 + Math.cos(ya) * 1.15], [0, ya, 0])); };
    for (const [name, x, z, ya] of DR) { portal(x, z, ya); NET.sewers.push({ name, x: x + Math.sin(ya) * 3, z: z + Math.cos(ya) * 3 }); }
    const gate = { x: -6, z: BUNKER.back + 30 }; portal(gate.x - 7.5, gate.z, Math.PI / 2); NET.hubs.sewer = { x: gate.x - 3, z: gate.z }; /* in the bunker's lower floor, west wall */
    for (const [x, z] of [[-60, -226], [150, -228]]) { const y = 1.5; b.add('drain', new T.CylinderGeometry(2.6, 2.6, 10, 14).rotateX(Math.PI / 2).translate(x, y + 1.5, z)); NET.outfalls = (NET.outfalls || []).concat([new V3(x, y + 1.5, z - 5)]); }
    const g = new T.Group(); bakeInto(g, b, M, ['drain']); G.add(g); }
  NET.hubs.rail = NET.stations[0]; NET.hubs.tube = AERIS.tun ? { x: AERIS.tun.P0.x, z: AERIS.tun.P0.z + 4 } : null;
  /* every stop, by system; all of them reach the hub */
  for (const s of NET.stations.slice(1)) NET.nodes.push({ kind: 'rail', name: s.name, x: s.x, z: s.z, sp: 26 });
  NET.nodes.push({ kind: 'rail', name: 'Bunker Hub', x: NET.stations[0].x, z: NET.stations[0].z, sp: 26, hub: true });
  for (const s of NET.sewers) NET.nodes.push({ kind: 'sewer', name: s.name, x: s.x, z: s.z, sp: 11 });
  NET.nodes.push({ kind: 'sewer', name: 'Bunker sewer gate', x: NET.hubs.sewer.x, z: NET.hubs.sewer.z, sp: 11, hub: true });
  if (AERIS.tun) { NET.nodes.push({ kind: 'tube', name: 'Marina station', x: AERIS.tun.Ms.x, z: AERIS.tun.Ms.z, sp: 30 }, { kind: 'tube', name: 'Archipelago station', x: AERIS.tun.Is.x, z: AERIS.tun.Is.z, sp: 30 }, { kind: 'tube', name: 'Bunker platform', x: NET.hubs.tube.x, z: NET.hubs.tube.z, sp: 30, hub: true }); }
  /* ---------- the network map on the bunker's command wall ---------- */
  { const S = 256, tex = canvasTex(S, S, (c) => { const m = v => (v + BOUND) / (2 * BOUND) * S;
      c.fillStyle = '#04101a'; c.fillRect(0, 0, S, S); c.fillStyle = 'rgba(60,110,90,.55)'; for (let j = 0; j < S; j += 4) for (let i = 0; i < S; i += 4) { const x = i / S * 2 * BOUND - BOUND, z = j / S * 2 * BOUND - BOUND; if (H(x, z) > 0.5) c.fillRect(i, j, 4, 4); }
      c.strokeStyle = '#ffb340'; c.lineWidth = 3; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(m(p.x), m(p.z)) : c.moveTo(m(p.x), m(p.z))); c.closePath(); c.stroke();
      c.strokeStyle = '#7fe6ff'; c.lineWidth = 2.5; if (AERIS.tun) for (const curve of [AERIS.tun.C1, AERIS.tun.C2]) { c.beginPath(); curve.getPoints(30).forEach((p, i) => i ? c.lineTo(m(p.x), m(p.z)) : c.moveTo(m(p.x), m(p.z))); c.stroke(); }
      c.strokeStyle = 'rgba(190,150,110,.85)'; c.lineWidth = 1.5; if (c.setLineDash) c.setLineDash([3, 3]); for (const s of NET.sewers) { c.beginPath(); c.moveTo(m(s.x), m(s.z)); c.lineTo(m(NET.hubs.sewer.x), m(NET.hubs.sewer.z)); c.stroke(); } if (c.setLineDash) c.setLineDash([]);
      c.fillStyle = '#fff'; for (const s of NET.stations) { c.beginPath(); c.arc(m(s.x), m(s.z), 3.5, 0, 6.3); c.fill(); }
      c.fillStyle = '#ff5a3a'; c.beginPath(); c.arc(m(30), m(BUNKER.back + 30), 6, 0, 6.3); c.fill(); c.font = '700 12px sans-serif'; c.fillText('HUB', m(30) + 8, m(BUNKER.back + 30) + 4); });
    const board = new T.Mesh(new T.PlaneGeometry(17, 17), new T.MeshBasicMaterial({ map: tex })); board.position.set(65, BUNKER.floor + 40, BUNKER.back + 1.7); G.add(board); }
})();

/* ---------- riding the network: hidden aboard, along stop → hub → stop ---------- */
class NetRide {
  constructor(s, path, sp) { let L = 0; for (let i = 1; i < path.length; i++) L += path[i].distanceTo(path[i - 1]); Object.assign(this, { kind: 'network', name: 'Network', s, path, L, d: 0, sp, alive: true, hideRiders: true, riders: [s], pos: new V3(), yaw: 0 }); }
  saddle(out) { let d = this.d; for (let i = 1; i < this.path.length; i++) { const a = this.path[i - 1], b = this.path[i], l = a.distanceTo(b); if (d <= l || i === this.path.length - 1) { out.lerpVectors(a, b, l ? Math.min(1, d / l) : 1); break; } d -= l; } this.pos.copy(out); return out; }
  dismount(who) { if (who !== this.s) return; this.alive = false; who.mount = null; who.hitR = true; this.riders = []; }
}
const NET_RIDES = [];
function netHeight(kind, x, z) { return kind === 'rail' ? Math.max(0, H(x, z)) + 14 : kind === 'sewer' ? Math.max(0, H(x, z)) - 6 : -8; }
function netBoard(s, P) {
  const A = P.A, B = P.B, hub = NET.nodes.find(n => n.hub && n.kind === A.kind) || A;
  const path = [new V3(A.x, netHeight(A.kind, A.x, A.z), A.z), new V3(hub.x, netHeight(A.kind, hub.x, hub.z), hub.z)];
  if (B.kind !== A.kind) { const hb = NET.nodes.find(n => n.hub && n.kind === B.kind) || B; path.push(new V3(hb.x, netHeight(B.kind, hb.x, hb.z), hb.z)); } /* change lines at the bunker */
  path.push(new V3(B.x, netHeight(B.kind, B.x, B.z), B.z));
  if (s.mount) s.mount.dismount(s); const r = new NetRide(s, path, Math.min(A.sp, B.sp)); r.B = B; s.mount = r; s.target = null; s.hitR = false; r.saddle(s.pos); NET_RIDES.push(r);
}
function updateNetRides(dt) {
  for (let i = NET_RIDES.length - 1; i >= 0; i--) {
    const r = NET_RIDES[i], s = r.s;
    if (!r.alive || !s.alive || s.mount !== r) { if (s.mount === r) { s.mount = null; s.hitR = true; } NET_RIDES.splice(i, 1); continue; }
    r.d += r.sp * dt; r.saddle(s.pos);
    if (r.d >= r.L) { r.alive = false; s.mount = null; s.hitR = true; const B = r.B; s.pos.set(B.x + rand(-4, 4), 0, B.z + rand(-4, 4)); s.pos.y = surfY(s.pos.x, s.pos.z, Math.max(0, H(s.pos.x, s.pos.z)) + 2); s.trCool = TIME + 25; s.goalT = 0; s.think = 0; NET_RIDES.splice(i, 1); }
  }
}
/* a long way to go, a stop at hand, and a stop near where he is going: take the network */
function netPlan(s) {
  const dest = wlDest(s); if (!dest || onMesa(s.pos)) return null; /* downtown has the lift */ const d0 = Math.hypot(dest.x - s.pos.x, dest.z - s.pos.z); if (d0 < 260) return null;
  let A = null, ad = 70; for (const n of NET.nodes) { const d = Math.hypot(n.x - s.pos.x, n.z - s.pos.z); if (d < ad) { ad = d; A = n; } } if (!A) return null;
  let B = null, bd = d0 - 200; for (const n of NET.nodes) { if (n === A) continue; const d = Math.hypot(n.x - dest.x, n.z - dest.z); if (d < bd) { bd = d; B = n; } } if (!B) return null;
  return { kind: 'net', x: A.x, z: A.z, A, B };
}
{
  const _tp = trPlan; trPlan = function (s) { return _tp(s) || netPlan(s); };
  const _uz = updateZips; updateZips = function (dt) { _uz(dt); if (GAME.state === 'play') updateNetRides(dt); };
  /* the minimap and the full map draw the network */
  const _dr = drawRoutes;
  drawRoutes = function (ctx, size, full) {
    _dr(ctx, size, full); const M = x => mapXY(x, size);
    ctx.strokeStyle = 'rgba(255,179,64,.85)'; ctx.lineWidth = full ? 2.5 : 1.2; ctx.beginPath(); for (let i = 0; i < NET.railPts.length; i += 3) { const p = NET.railPts[i]; i ? ctx.lineTo(M(p.x), M(p.z)) : ctx.moveTo(M(p.x), M(p.z)); } ctx.closePath(); ctx.stroke();
    if (AERIS.tun) { ctx.strokeStyle = 'rgba(127,230,255,.8)'; ctx.lineWidth = full ? 2 : 1; for (const c of [AERIS.tun.C1, AERIS.tun.C2]) { ctx.beginPath(); c.getPoints(16).forEach((p, i) => i ? ctx.lineTo(M(p.x), M(p.z)) : ctx.moveTo(M(p.x), M(p.z))); ctx.stroke(); } }
    if (full) { ctx.fillStyle = '#fff'; for (const s of NET.stations) { ctx.beginPath(); ctx.arc(M(s.x), M(s.z), 3, 0, 6.3); ctx.fill(); } ctx.fillStyle = 'rgba(200,160,110,.9)'; for (const s of NET.sewers) ctx.fillRect(M(s.x) - 2, M(s.z) - 2, 4, 4); }
  };
}
/* the trains and the outfalls */
const _ntP = new V3();
function updateNetwork(dt) {
  if (!NET.rail) return; const L = NET.railL;
  for (const tr of NET.trains) {
    if (tr.wait > 0) tr.wait -= dt;
    else { tr.u = (tr.u + tr.dir * 26 * dt / L + 1) % 1; for (let k = 0; k < NET.stations.length; k++) { const st = NET.stations[k]; let du = Math.abs(tr.u - st.u); du = Math.min(du, 1 - du); if (du * L < 1.5 && tr.last !== k) { tr.last = k; tr.wait = 5; break; } } }
    tr.cars.forEach((m, i) => { const u = (tr.u - tr.dir * i * 13.5 / L + 1) % 1; NET.rail.getPointAt(u, _ntP); const tg = NET.rail.getTangentAt(u); m.position.set(_ntP.x, _ntP.y, _ntP.z); m.lookAt(_ntP.x + tg.x * tr.dir, _ntP.y + tg.y * tr.dir, _ntP.z + tg.z * tr.dir); });
  }
  if (NET.outfalls && (NET.ofT = (NET.ofT || 0) - dt) <= 0) { NET.ofT = 0.15; for (const p of NET.outfalls) if (camera.position.distanceToSquared(p) < 90000) FXS.spawn(p.x + rand(-1, 1), p.y, p.z, rand(-1, 1), rand(-1, 1), -rand(3, 6), rand(1.5, 3), 1.5, 5, 0.5, 0.6, 0.55, 0.45, 0.5, 0.45, 0.5, 0.5, 4); }
}
{ const _uw = updateWorld; updateWorld = function (dt) { _uw(dt); updateNetwork(dt); }; }
