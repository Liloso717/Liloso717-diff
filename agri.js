'use strict';
/* ===================== IRON MERIDIAN · the farm belts, and the food that keeps the districts standing ===================== */
// Ten thousand people do not eat out of nowhere. Five belts of worked land ring the city — river bottom, harbour
// terraces, west pans, rail flats, and the grim rows under the ash — and they are the island's larder.
//   · Crops grow on their own clock, and the clock runs at the speed of whatever weather cell is standing over that
//     belt (microwx.js): rain doubles it, a heat spell ripens it fast, dust and snow nearly stop it.
//   · When a belt comes ripe it is harvested into the island's food reserve. While there is food in the granaries
//     every district shelters its people better — the reserve is a direct, visible brake on the civilian bleed.
//   · Fire, blast and a Villain champion standing in the rows burn the crop. A Hero who drops an orbital strike on a
//     wheat belt is feeding the enemy's side of the ledger, which is the point: the powers have a bill.
//   · Farmhands work the rows. They are civilians, they are killable, and each one lost is ten off the count.
const AGRI = {
  belts: [], food: 900, foodMax: 1800, t: 0, slow: 0, turn: 0, hands: [], harvests: 0, burnt: 0, dryT: -99, scorchT: 0,
};
/* Five anchors, spread so that one weather cell can never be standing over all of them: south-west river bottom,
   the harbour side, the west pans, the south commons and the grim rows under the ash. Each one was picked off a sweep
   of the heightmap for land that is dry, flat and clear of the city. */
const AGRI_SPOTS = [
  { x: -40, z: -292, name: 'the airport fields', w: 100, d: 26 },
  { x: 125, z: 335, name: 'the point meadows', w: 60, d: 44 },
  { x: -165, z: 235, name: 'the south commons', w: 80, d: 60 },
  { x: -440, z: 270, name: 'the west pans', w: 70, d: 60 },
  { x: 365, z: -80, name: 'the ridge terraces', w: 60, d: 50 },
];
const CROP_COL = { // young green → ripe gold, and black where it burned
  young: [0.26, 0.46, 0.18], half: [0.52, 0.62, 0.2], ripe: [0.82, 0.68, 0.22], burnt: [0.1, 0.09, 0.08],
};
/* ---------- the clump: two coarse sheaves, instanced per plot ---------- */
/* A plot is a stand of crop, not one stalk: four short wide sheaves spread over a couple of metres, so neighbouring
   plots overlap into continuous field instead of reading as scattered cones. Open-ended cones, 8 triangles each. */
const CROP_G = mergeGeos([
  new T.CylinderGeometry(0.06, 0.52, 1.2, 4, 1, true).translate(0, 0.62, 0),
  new T.CylinderGeometry(0.06, 0.46, 1.0, 4, 1, true).translate(0.78, 0.5, 0.34),
  new T.CylinderGeometry(0.06, 0.48, 1.08, 4, 1, true).translate(-0.56, 0.55, 0.62),
  new T.CylinderGeometry(0.06, 0.44, 0.95, 4, 1, true).translate(0.2, 0.47, -0.74),
]);
const CROP_M = std(0xffffff, 0.92, 0, { flatShading: true, side: T.DoubleSide });
const SOIL_BASE = 0x4a3a2a, soilM = std(SOIL_BASE, 0.98, 0.02), ditchM = std(0x2a3a3c, 0.6, 0.1), postM = std(0x6a5a44, 0.9, 0.05);
function agriBelt(S) {
  /* conform a tilled patch to the ground it sits on, and skip any plot in the water, on a slope or under a building */
  const segs = 10, soil = new T.Mesh(new T.PlaneGeometry(S.w, S.d, segs, segs).rotateX(-Math.PI / 2), soilM.clone());
  { const p = soil.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, groundY(S.x + p.getX(i), S.z + p.getZ(i)) - groundY(S.x, S.z) + 0.06); soil.geometry.computeVertexNormals(); }
  soil.position.set(S.x, groundY(S.x, S.z), S.z); soil.receiveShadow = true; scene.add(soil);
  const B = { ...S, soil, plots: [], grow: 0.15, burn: 0, ripe: 0, hands: [], yield: 230, dirty: true, lastT: 0 };
  const cols = 26, rows = 22, gx = S.w / cols, gz = S.d / rows; /* ~5 m rows: close enough that the stands meet */
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = S.x - S.w / 2 + (i + 0.5) * gx + rand(-0.6, 0.6), z = S.z - S.d / 2 + (j + 0.5) * gz + rand(-0.6, 0.6);
    const h = H(x, z); if (h < 1.4) continue;
    const slope = Math.max(Math.abs(H(x + 4, z) - H(x - 4, z)), Math.abs(H(x, z + 4) - H(x, z - 4))); if (slope > 5) continue;
    if (buildingAt(_v1.set(x, h + 1, z))) continue;
    B.plots.push({ x, z, y: h, g: rand(0.05, 0.25), b: 0, s: rand(0.85, 1.12), yaw: rand(0, 6.283) });
  }
  B.m = new T.InstancedMesh(CROP_G, CROP_M, Math.max(1, B.plots.length));
  B.m.count = B.plots.length; B.m.castShadow = false; B.m.receiveShadow = true;
  /* An InstancedMesh is frustum-tested against its BASE geometry's bounding sphere — one clump at the world origin —
     so three culls the whole belt the moment the origin leaves the view. The distance check in updateAgri is the
     real culling here. */
  B.m.frustumCulled = false;
  B.m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(Math.max(1, B.plots.length) * 3).fill(1), 3);
  scene.add(B.m);
  /* an irrigation ditch down the middle and a few posts, so a belt reads as worked land from the air */
  const ditch = new T.Mesh(new T.BoxGeometry(S.w * 0.96, 0.5, 2.2), ditchM); ditch.position.set(S.x, groundY(S.x, S.z) + 0.1, S.z); ditch.receiveShadow = true; scene.add(ditch);
  for (let i = 0; i < 6; i++) { const px = S.x - S.w / 2 + (i / 5) * S.w, pz = S.z + (i % 2 ? -1 : 1) * S.d * 0.5; const po = new T.Mesh(new T.BoxGeometry(0.3, 2.2, 0.3), postM); po.position.set(px, groundY(px, pz) + 1.1, pz); po.castShadow = true; scene.add(po); }
  AGRI.belts.push(B); return B;
}
AGRI_SPOTS.forEach(agriBelt);
/* Write every belt's instance matrices once, here: until a belt has had its turn in the round-robin the mesh holds
   identity matrices, which would stack a thousand crop clumps on the world origin in the middle of Apex Plaza. */
for (const B of AGRI.belts) agriDraw(B);
/* ---------- the farmhands: three to a belt, walking the rows ---------- */
const HAND_MAX = 16;
const HANDM = (() => {
  const m = new T.InstancedMesh(CIVM.geometry, CIVM.material, HAND_MAX);
  m.count = 0; m.castShadow = true; m.frustumCulled = false;
  m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(HAND_MAX * 3).fill(1), 3); scene.add(m); return m;
})();
const HAND_COL = { work: [0.74, 0.66, 0.44], walk: [0.8, 0.74, 0.52], flee: [1.0, 0.72, 0.4] };
for (const B of AGRI.belts) {
  for (let i = 0; i < 3 && AGRI.hands.length < HAND_MAX; i++) {
    if (!B.plots.length) break;
    const p = pick(B.plots), h = { belt: B, pos: new V3(p.x, p.y, p.z), tgt: null, yaw: rand(0, 6.283), ph: rand(0, 6.283), state: 'work', t: rand(0, 3), alive: true };
    AGRI.hands.push(h); B.hands.push(h);
  }
}
/* ---------- fire, blast and the Villain in the rows ---------- */
function agriScorch(p, r, hard) {
  if (AGRI.scorchT > TIME && !hard) return; AGRI.scorchT = TIME + 0.08;
  const R = r * 1.7;
  for (const B of AGRI.belts) {
    if (Math.abs(B.x - p.x) > B.w / 2 + R || Math.abs(B.z - p.z) > B.d / 2 + R) continue;
    let hit = 0;
    for (const q of B.plots) { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d > R || q.b > 0.95) continue; q.b = Math.min(1, q.b + (1 - d / R) * (hard ? 1 : 0.8)); hit++; }
    if (hit) { B.dirty = true; AGRI.burnt += hit; if (hit > 14 && TIME - (B.saidT || -99) > 20) { B.saidT = TIME; poolChip(`Crop burning in ${B.name}`, 'y'); } }
    for (const h of B.hands) if (h.alive && Math.hypot(h.pos.x - p.x, h.pos.z - p.z) < r * 1.1) agriHandDown(h);
  }
}
function agriHandDown(h) {
  if (!h.alive) return; h.alive = false; POOL.lost += POOL.PER;
  fxSparks(_v1.copy(h.pos).setY(h.pos.y + 1), 7, [2.4, 0.6, 0.4], 6); poolChip(`−${POOL.PER} farmhand killed`, 'r');
  h.respawn = TIME + 70; // the belt sends out another once the shooting stops
}
{ const _ed = explodeDamage; explodeDamage = function (p, radius, dmg, src, team, skip) { if (radius >= 6 && dmg > 40) agriScorch(p, radius, radius > 40); return _ed(p, radius, dmg, src, team, skip); }; }
/* ---------- food in the granaries makes every district harder to empty ---------- */
{ const _sh = shelterAt; shelterAt = function (cp) { return _sh(cp) + Math.min(0.7, AGRI.food / 2200); /* a full reserve is worth a Guild bastion; an empty one nothing */ }; }
const agriFed = () => AGRI.food > 60;
/* ---------- the belt clock ---------- */
function agriTick(B, dt) {
  const wx = mwxCrop(B.x, B.z);
  let g = 0, b = 0, n = 0;
  const heat = mwxAt(B.x, B.z), cook = heat && heat.K.heat ? heat.k : 0, wet = mwxWet(B.x, B.z);
  const tended = B.hands.some(h => h.alive);
  for (const q of B.plots) {
    if (q.b > 0.02) q.b = Math.max(0, q.b - dt * (tended ? 0.005 : 0.0015) * (1 + wet)); // replanted, or the rain brings it back slowly
    else if (q.g < 1) q.g = Math.min(1, q.g + dt * 0.0054 * wx * (1 - q.b)); /* ~3 minutes to ripen in plain weather, half that under rain */
    if (cook > 0.5 && q.g > 0.9 && Math.random() < dt * 0.01 * cook) q.b = Math.min(1, q.b + 0.25); // left too long under a heat spell
    g += q.g; b += q.b; n++;
  }
  if (!n) return;
  B.grow = g / n; B.burn = b / n;
  /* tilled earth → crop green → stubble gold, and black where it burned */
  const sc = B.soil.material.color, tgt = _c.setHex(B.burn > 0.3 ? 0x1c1613 : SOIL_BASE);
  if (B.burn <= 0.3) tgt.lerp(_dc.setHex(B.grow > 0.7 ? 0x9c8824 : 0x37571d), Math.min(1, B.grow * 1.25));
  sc.lerp(tgt, 0.5);
  /* a Villain champion standing in the rows is burning them on purpose */
  if (typeof CHAMP !== 'undefined') for (const C of CHAMP.live) {
    if (C.team !== 2 || !C.ent || !C.ent.alive) continue;
    if (Math.abs(C.ent.pos.x - B.x) > B.w / 2 + 50 || Math.abs(C.ent.pos.z - B.z) > B.d / 2 + 50) continue;
    agriScorch(C.ent.pos, 26, false);
    if (TIME - (B.champT || -99) > 30) { B.champT = TIME; comms('Hero net', `${C.name} is burning ${B.name}. That is our food.`, 'cmd'); }
  }
  if (B.grow >= 0.985 && TIME - B.lastT > 25) { // harvest
    B.lastT = TIME; AGRI.harvests++;
    const take = Math.round(B.yield * (1 - B.burn));
    AGRI.food = Math.min(AGRI.foodMax, AGRI.food + take);
    for (const q of B.plots) q.g = rand(0.04, 0.14);
    B.dirty = true;
    poolChip(`Harvest in from ${B.name}`, 'g');
    comms('Guild Granary', `${take} in from ${B.name}. The districts eat${B.burn > 0.3 ? ', what is left of it' : ''}.`, 'b');
    for (const h of B.hands) if (h.alive) { fxSparks(_v1.copy(h.pos).setY(h.pos.y + 1.4), 5, [1.4, 1.2, 0.3], 4); }
  }
}
function agriDraw(B) { // instance matrices and colours for one belt, on its turn
  const col = B.m.instanceColor.array;
  for (let i = 0; i < B.plots.length; i++) {
    const q = B.plots[i], gr = q.g, s = (0.5 + gr * 0.62) * q.s; /* a ripe stand stands about chest high, not three metres */
    _pe.set(0, q.yaw, 0); _m.compose(_v1.set(q.x, q.y, q.z), _q.setFromEuler(_pe), _v2.set(s, s * (0.5 + gr * 0.9), s));
    B.m.setMatrixAt(i, _m);
    let c; if (q.b > 0.25) c = CROP_COL.burnt; else c = gr > 0.74 ? CROP_COL.ripe : gr > 0.4 ? CROP_COL.half : CROP_COL.young;
    const f = q.b > 0.25 ? 1 : 1 - q.b * 0.8;
    col[i * 3] = c[0] * f; col[i * 3 + 1] = c[1] * f; col[i * 3 + 2] = c[2] * f;
  }
  B.m.instanceMatrix.needsUpdate = true; B.m.instanceColor.needsUpdate = true; B.dirty = false;
}
function agriHands(dt) {
  HANDM.count = 0; let drawn = 0;
  for (const h of AGRI.hands) {
    if (!h.alive) { if (h.respawn && TIME > h.respawn && !h.belt.hot) { h.alive = true; h.respawn = 0; const p = pick(h.belt.plots); if (p) h.pos.set(p.x, p.y, p.z); } continue; }
    h.t -= dt;
    const danger = h.belt.hot;
    if (danger && h.state !== 'flee') { h.state = 'flee'; h.t = 0; }
    if (h.t <= 0) {
      if (h.state === 'flee') { const g = nearestGate(h.pos); h.tgt = g ? g.pos : null; h.t = 2; if (!danger) { h.state = 'work'; h.tgt = null; } }
      else if (h.state === 'work') { h.state = 'walk'; const p = pick(h.belt.plots); h.tgt = p ? _v1.set(p.x, p.y, p.z).clone() : null; h.t = rand(3, 7); }
      else { h.state = 'work'; h.tgt = null; h.t = rand(4, 9); }
    }
    if (h.tgt) {
      const dx = h.tgt.x - h.pos.x, dz = h.tgt.z - h.pos.z, d = Math.hypot(dx, dz);
      if (d > 1) { const sp = (h.state === 'flee' ? 5.4 : 1.5) * dt / d; h.pos.x += dx * sp; h.pos.z += dz * sp; h.yaw = Math.atan2(dx, dz); }
      else if (h.state !== 'flee') { h.state = 'work'; h.tgt = null; h.t = rand(4, 9); }
      h.pos.y = groundY(h.pos.x, h.pos.z);
    }
    if (drawn >= HAND_MAX) continue;
    const bob = h.state === 'work' ? Math.abs(Math.sin(TIME * 2.2 + h.ph)) * 0.22 : 0; // bent over the rows
    _pe.set(bob * 1.5, h.yaw, 0); _m.compose(_v1.set(h.pos.x, h.pos.y - bob * 0.3, h.pos.z), _q.setFromEuler(_pe), _v2.set(1, 1, 1));
    HANDM.setMatrixAt(drawn, _m);
    const c = HAND_COL[h.state] || HAND_COL.work; HANDM.instanceColor.setXYZ(drawn, c[0], c[1], c[2]); drawn++;
  }
  HANDM.count = drawn; HANDM.instanceMatrix.needsUpdate = true; HANDM.instanceColor.needsUpdate = true;
}
/* One sweep of the entity list a frame marks every belt that has hostiles standing in or near it, instead of each
   farmhand asking the question for itself. */
function agriThreat() {
  for (const B of AGRI.belts) B.hot = false;
  for (const e of ENTS) {
    if (!e.alive || !isHostile(e.team) || e.pos.y > 200) continue;
    for (const B of AGRI.belts) if (!B.hot && Math.abs(e.pos.x - B.x) < B.w / 2 + 120 && Math.abs(e.pos.z - B.z) < B.d / 2 + 120) B.hot = true;
  }
}
function updateAgri(dt) {
  if (GAME.state !== 'play') return;
  /* the reserve is eaten: the more people still alive out there, the faster it goes down */
  let pop = 0; for (const cp of CPS) pop += cp.pop || 0;
  AGRI.food = Math.max(0, AGRI.food - dt * (0.45 + (pop / POOL.START) * 4.2));
  if (AGRI.food < 60 && TIME - AGRI.dryT > 90) { AGRI.dryT = TIME; comms('Guild Granary', 'Granaries are dry. The districts have nothing to hand out — they will not hold.', 'cmd'); }
  agriThreat();
  agriHands(dt);
  if ((AGRI.slow -= dt) <= 0) {
    const step = Math.min(4, 1.6 - AGRI.slow); AGRI.slow = 1.6; /* the real elapsed time, overshoot included */
    for (const B of AGRI.belts) agriTick(B, step);
    const B = AGRI.belts[AGRI.turn = (AGRI.turn + 1) % AGRI.belts.length]; if (B) agriDraw(B); // one belt redrawn a tick: every belt every eight seconds
    for (const C of AGRI.belts) if (C.dirty && C !== B) { agriDraw(C); break; } // unless something just burned
  }
  /* the Hero flies, so the patchwork has to read from altitude: crops out to 1.2 km, the tilled ground to 1.8 */
  for (const B of AGRI.belts) { const d = camera.position.distanceTo(_v1.set(B.x, groundY(B.x, B.z), B.z)); B.m.visible = d < 1200; B.soil.visible = d < 1800; }
}
