'use strict';
/* ===================== IRON MERIDIAN · ziplines: up the towers, across the skyline, out to the third spaces ===================== */
// No buttons: walk into the glowing foot of a cable (or its top anchor) and it takes you. Jump at a cable in mid-air to
// grab it anywhere along its length. Space (or E) lets go: drop onto a roof below, or fall and let the chute open.
//  · VERTICAL   · up the side of every skyscraper, every overwatch tower, every fortress gun tower and every pylon
//  · HORIZONTAL · roof to roof across the skyline, and long lines over the outskirts linking hilltop pylons, overwatch
//                 towers and the city edge, so the villages, posts and building sites are a fast ride apart
// Cables on a building that collapses go dark until the Builder Guild raises it again.
const ZIPS = { lines: [], rides: [], segs: null, segN: 0, hintT: 0, sfxT: 0 };
const ZIP_SEG = 14, ZIP_MAX = 2000, ZIP_UP = 22, ZIP_ACROSS = 38;
const ZIP_GLOW = basic(new T.Color(0.5, 1.9, 2.8)), ZIP_ANCHOR = basic(new T.Color(1.6, 1.1, 0.35));
const zipPoint = (L, t, out) => { out.lerpVectors(L.a, L.b, t); out.y -= L.sag * Math.sin(t * Math.PI); return out; };
function zipMesh() { if (ZIPS.segs) return; ZIPS.segs = new T.InstancedMesh(new T.CylinderGeometry(0.07, 0.07, 1, 5, 1, true), ZIP_GLOW, ZIP_MAX); ZIPS.segs.count = 0; ZIPS.segs.frustumCulled = false; scene.add(ZIPS.segs);
  ZIPS.anchors = new T.InstancedMesh(new T.SphereGeometry(0.3, 10, 8), ZIP_ANCHOR, 600); ZIPS.anchors.count = 0; ZIPS.anchors.frustumCulled = false; scene.add(ZIPS.anchors); }
function zipDraw(L, on) { /* (re)write this cable's segments into the instanced mesh */
  const p = new V3(), q = new V3(), d = new V3();
  for (let k = 0; k < L.n; k++) { zipPoint(L, k / L.n, p); zipPoint(L, (k + 1) / L.n, q); d.subVectors(q, p); const len = d.length(); _q.setFromUnitVectors(UP, d.divideScalar(len || 1)); _m.compose(p.lerp(q, 0.5), _q, on ? _s.set(1, len, 1) : _s.set(0, 0, 0)); ZIPS.segs.setMatrixAt(L.i0 + k, _m); }
  for (const [k, e] of [[0, L.a], [1, L.b]]) { _m.compose(e, _q.identity(), on ? _s.set(1, 1, 1) : _s.set(0, 0, 0)); ZIPS.anchors.setMatrixAt(L.j0 + k, _m); }
  ZIPS.segs.instanceMatrix.needsUpdate = true; ZIPS.anchors.instanceMatrix.needsUpdate = true;
}
/* a cable from a to b; la / lb are where a rider is set down at each end; blds go dark when they fall */
function zipLine(a, b, la, lb, blds, kind) {
  zipMesh(); const n = kind === 'v' ? 2 : ZIP_SEG; if (ZIPS.segN + n > ZIP_MAX || ZIPS.anchors.count + 2 > 600) return null;
  const L = { a: a.clone(), b: b.clone(), la: la.clone(), lb: lb.clone(), blds: (blds || []).filter(Boolean), kind, len: a.distanceTo(b), on: true, n, i0: ZIPS.segN, j0: ZIPS.anchors.count };
  L.sag = kind === 'v' ? 0 : Math.min(9, L.len * 0.03); ZIPS.segN += n; ZIPS.segs.count = ZIPS.segN; ZIPS.anchors.count += 2; ZIPS.lines.push(L); zipDraw(L, true); return L;
}
function zipVertical(foot, top, land, b) { /* foot on the ground, top above the roof edge, land on the roof */ return zipLine(foot.clone().setY(foot.y + 0.6), top, foot.clone(), land, b ? [b] : [], 'v'); }
/* ---------- riding ---------- */
class ZipRide {
  constructor(s, L, from, done) { Object.assign(this, { kind: 'zip', name: 'Zipline', s, L, t: from, dir: from < 0.5 ? 1 : -1, alive: true, hideRiders: false, camD: 7.5, camUp: 2.6, riders: [s], pos: new V3(), done, speed: L.kind === 'v' ? ZIP_UP : ZIP_ACROSS }); }
  saddle(out) { zipPoint(this.L, this.t, out); out.y -= this.L.kind === 'v' ? 1.2 : 2.2; if (this.p0 && this.blend < 1) { const k = this.blend * this.blend * (3 - 2 * this.blend); out.set(lerp(this.p0.x, out.x, k), lerp(this.p0.y, out.y, k) + Math.sin(k * Math.PI) * 0.9, lerp(this.p0.z, out.z, k)); } this.pos.copy(out); return out; }
  /* riders face along the cable; on a vertical one they face the wall they are climbing */
  get yaw() { const L = this.L, s = L.kind === 'v' ? 1 : this.dir, A = L.kind === 'v' ? L.la : L.a, B = L.kind === 'v' ? L.lb : L.b; return Math.atan2((B.x - A.x) * s, (B.z - A.z) * s); }
  dismount(who) { if (who !== this.s) return; this.alive = false; who.mount = null; this.riders = []; if (who.isPlayer) { PLAYER.vy = 0; PLAYER.grounded = false; PLAYER.camInit = false; } who.zipCool = TIME + 0.8; }
}
function zipRide(s, L, from, done) {
  if (s.mount) s.mount.dismount(s); const r = new ZipRide(s, L, from, done); s.mount = r; s.target = null; r.saddle(s.pos); ZIPS.rides.push(r);
  if (s.isPlayer) { PLAYER.vy = 0; PLAYER.free = false; PLAYER.para = false; showCanopy(s, false); snd('skid', s.pos, 0.45); } return r;
}
function zipArrive(r) {
  const s = r.s, L = r.L, end = r.dir > 0 ? L.lb : L.la; r.alive = false; s.mount = null; s.pos.copy(end); s.zipLock = end; s.zipCool = TIME + 0.6;
  if (s.isPlayer) { PLAYER.vy = 0; PLAYER.grounded = true; PLAYER.camInit = false; snd('stomp', s.pos, 0.35); }
  if (r.done) r.done(s);
}
/* nearest point of a cable to p (coarse search over the segments, then refine) */
function zipNearest(L, p) { let bt = 0, bd = 1e9; for (let k = 0; k <= 24; k++) { const t = k / 24; zipPoint(L, t, _v6); const d = _v6.distanceToSquared(p); if (d < bd) { bd = d; bt = t; } }
  for (let k = -4; k <= 4; k++) { const t = clamp(bt + k / 96, 0, 1); zipPoint(L, t, _v6); const d = _v6.distanceToSquared(p); if (d < bd) { bd = d; bt = t; } } return [bt, Math.sqrt(bd)]; }
function updateZips(dt) {
  /* cables on fallen buildings go dark (and drop their riders) */
  if ((ZIPS.chkT = (ZIPS.chkT || 0) - dt) <= 0) { ZIPS.chkT = 0.5; for (const L of ZIPS.lines) { const on = L.blds.every(b => b.alive); if (on !== L.on) { L.on = on; zipDraw(L, on); } } }
  for (let i = ZIPS.rides.length - 1; i >= 0; i--) {
    const r = ZIPS.rides[i], s = r.s; if (!r.alive || !s.alive || s.mount !== r) { if (s.mount === r) s.mount = null; ZIPS.rides.splice(i, 1); continue; }
    if (!r.L.on) { r.dismount(s); ZIPS.rides.splice(i, 1); continue; }
    if (s.isPlayer && keys.Space) { keys.Space = false; r.dismount(s); ZIPS.rides.splice(i, 1); continue; } /* let go */
    if (r.p0 && r.blend < 1) r.blend = Math.min(1, r.blend + dt * 3.2); /* a soldier jumping up to grab the trolley */
    else r.t = clamp(r.t + r.dir * r.speed * dt / Math.max(1, r.L.len), 0, 1);
    r.saddle(s.pos);
    if (s.isPlayer && (ZIPS.sfxT -= dt) <= 0) { ZIPS.sfxT = 0.45; snd('skid', s.pos, 0.18); if (Math.random() < 0.7) fxSparks(_v1.copy(s.pos).setY(s.pos.y + (r.L.kind === 'v' ? 1.2 : 2.2)), 4, [3, 2.2, 1], 5); }
    if ((r.dir > 0 && r.t >= 1) || (r.dir < 0 && r.t <= 0)) { zipArrive(r); ZIPS.rides.splice(i, 1); }
  }
  /* The cables are the soldiers' way up to the rooftops. A Hero flies, so he walks past them and is never told about
     them: one fewer thing on the HUD, and no catching a cable by accident on the way past. */
  ZIPS.hint = null;
}
/* hints */
const _zipHint = mountHint;
mountHint = function (pe) {
  if (pe.mount && pe.mount.kind === 'zip') return `Zipline · ${pe.mount.L.kind === 'v' ? (pe.mount.dir > 0 ? 'going up' : 'going down') : 'across'} · Space to let go`;
  return _zipHint(pe);
};
/* ---------- build the network ---------- */
const PYLON_H = 26;
(function zipNetwork() {
  const tops = []; /* anchors for horizontal lines: { p: cable point, land, b: building or null } */
  /* skyscrapers: a vertical line up one clear face; the roof becomes an anchor */
  for (const R of CITY.roofs) {
    const b = R.b; let spot = null;
    for (let k = 0; k < 8 && !spot; k++) { const fx = k % 2 === 0, s = k % 4 < 2 ? 1 : -1, x = fx ? b.x + s * (b.w / 2 + 1.1) : b.x + rand(-0.3, 0.3) * b.w, z = fx ? b.z + rand(-0.3, 0.3) * b.d : b.z + s * (b.d / 2 + 1.1);
      if (H(x, z) > 1 && !buildingAt(_v1.set(x, H(x, z) + 1.5, z)) && !buildingAt(_v1.set(x + (fx ? s * 1.6 : 0), H(x, z) + 1.5, z + (fx ? 0 : s * 1.6)))) spot = { x, z, ix: fx ? -s : 0, iz: fx ? 0 : -s }; }
    if (spot) { const g = groundY(spot.x, spot.z), dx = spot.x - b.x, dz = spot.z - b.z, dl = Math.hypot(dx, dz) || 1, rr = R.deck.r - 2.5; R.vzip = zipVertical(new V3(spot.x - spot.ix * 1.2, g, spot.z - spot.iz * 1.2), new V3(spot.x, b.top + 2.4, spot.z), new V3(b.x + dx / dl * rr, b.top, b.z + dz / dl * rr), b); } /* land inside the roof deck */
    tops.push({ x: b.x, z: b.z, y: b.top, r: Math.min(b.w, b.d) / 2 - 2, b, city: true });
  }
  /* overwatch towers: vertical line up the side, the deck is an anchor */
  for (const t of TOWERS) { zipVertical(new V3(t.x, groundY(t.x, t.z + 5), t.z + 5), new V3(t.x, t.top + 2.4, t.z + 3.4), new V3(t.x, t.top, t.z + 1.2), null); tops.push({ x: t.x, z: t.z, y: t.top, r: 3.5, b: null }); }
  /* pylons on the high ground of the outskirts, near the villages, posts and building sites */
  const pylG = mergeGeos([...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => xf(new T.CylinderGeometry(0.16, 0.24, PYLON_H, 5), [sx * 2.2, PYLON_H / 2, sz * 2.2], [sz * 0.06, 0, -sx * 0.06])),
    ...[5, 11, 17, 23].flatMap(y => [0, 1, 2, 3].map(i => xf(new T.BoxGeometry(4.4, 0.12, 0.12), [i % 2 ? 0 : (i ? 2.2 : -2.2), y, i % 2 ? (i === 1 ? 2.2 : -2.2) : 0], [0, i % 2 ? 0 : Math.PI / 2, y % 12 ? 0.6 : -0.6]))),
    new T.CylinderGeometry(4.6, 4.6, 0.5, 12).translate(0, PYLON_H, 0), ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => new T.BoxGeometry(0.1, 1.1, 0.1).translate(Math.cos(i * 0.785) * 4.4, PYLON_H + 0.8, Math.sin(i * 0.785) * 4.4))]);
  const POI = [...VILLAGES.map(v => ({ x: v.x, z: v.z })), ...CPS.map(c => ({ x: c.x, z: c.z })), ...BLD.sites.map(s => ({ x: s.x, z: s.z }))].filter(p => Math.hypot(p.x, p.z) > 300), pyl = [];
  for (const p of POI) {
    if (pyl.length >= 12) break; let best = null, bh = -1e9;
    for (let k = 0; k < 40; k++) { const a = Math.random() * 6.283, r = rand(40, 130), x = clamp(p.x + Math.cos(a) * r, -BOUND + 30, BOUND - 30), z = clamp(p.z + Math.sin(a) * r, -BOUND + 30, BOUND - 30), h = H(x, z); if (h < 2 || trenchD(x, z) < 14 || riverD(x, z) < 20 || buildingAt(_v1.set(x, h + 2, z))) continue; if (h > bh) { bh = h; best = { x, z, y: h }; } }
    if (!best || pyl.some(q => Math.hypot(q.x - best.x, q.z - best.z) < 160) || TOWERS.some(t => Math.hypot(t.x - best.x, t.z - best.z) < 60)) continue; pyl.push(best);
  }
  if (pyl.length) {
    const im = new T.InstancedMesh(pylG, MAT_GUN, pyl.length); im.castShadow = true;
    pyl.forEach((p, i) => { _m.compose(_v1.set(p.x, p.y - 0.3, p.z), _q.identity(), _s.set(1, 1, 1)); im.setMatrixAt(i, _m); DECKS.push({ x: p.x, z: p.z, y: p.y + PYLON_H + 0.25, r: 4.3 });
      zipVertical(new V3(p.x + 3.6, groundY(p.x + 3.6, p.z), p.z), new V3(p.x + 3.2, p.y + PYLON_H + 2.4, p.z), new V3(p.x + 1.2, p.y + PYLON_H + 0.25, p.z), null);
      const B = new Building(p.x, p.z, 4.4, 4.4, PYLON_H, { mesh: new T.Group(), hp: 1e9 }); B.cover = true; BUILDINGS.push(B);
      tops.push({ x: p.x, z: p.z, y: p.y + PYLON_H + 0.25, r: 3.2, b: null }); });
    scene.add(im);
  }
  /* horizontal lines: each anchor to its nearest neighbours, if the cable clears the ground and the buildings */
  const linked = new Set(), key = (i, j) => i < j ? i + ':' + j : j + ':' + i, clearRun = (A, B) => { for (let k = 1; k < 16; k++) { const t = k / 16, x = lerp(A.x, B.x, t), z = lerp(A.z, B.z, t), y = lerp(A.y, B.y, t) + 3 - Math.sin(t * Math.PI) * Math.min(9, Math.hypot(B.x - A.x, B.z - A.z) * 0.03); if (y < H(x, z) + 5 || buildingAt(_v1.set(x, y, z))) return false; } return true; };
  tops.forEach((A, i) => {
    const cand = tops.map((B, j) => [B, j, Math.hypot(B.x - A.x, B.z - A.z)]).filter(([B, j, d]) => j !== i && d > 40 && d < (A.city && B.city ? 150 : 460) && Math.abs(B.y - A.y) < Math.max(70, d * 0.35)).sort((p, q) => p[2] - q[2]);
    let n = 0; for (const [B, j, d] of cand) {
      if (n >= (A.city ? 2 : 3) || linked.has(key(i, j))) continue; const ux = (B.x - A.x) / d, uz = (B.z - A.z) / d;
      const a = new V3(A.x + ux * A.r, A.y + 3, A.z + uz * A.r), b = new V3(B.x - ux * B.r, B.y + 3, B.z - uz * B.r); if (!clearRun(a, b)) continue;
      if (zipLine(a, b, new V3(a.x - ux * 1.2, A.y, a.z - uz * 1.2), new V3(b.x + ux * 1.2, B.y, b.z + uz * 1.2), [A.b, B.b], 'h')) { linked.add(key(i, j)); n++; }
    }
  });
  /* the fortress towers get theirs as they are finished (builders.js calls zipVertical) */
})();
