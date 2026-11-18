'use strict';
/* ===================== IRON MERIDIAN · what the people of Aeris Island are, besides a number on a bar ===================== */
// Every district has a tradition of its own, and three things that carry it:
//   · A MONUMENT — a stela, an arch, a bell tower, a drum pavilion, a lantern tree, a founders' statue. It is a real
//     landmark: it can be knocked down, it announces itself when it goes, and the Guild raises it again once the
//     district is quiet and in Hero hands.
//   · A MARKET — stalls and awnings on the square. They are shuttered while the district is contested and open again
//     when it is not, which is the fastest read on the island's state there is.
//   · A FESTIVAL — hold a district, keep it quiet, and its people hold their festival: lanterns go up, the drums go,
//     and morale there climbs. A district at festival shelters its people far better, so culture is not decoration:
//     it is the difference between the Villains taking ten a tick and taking nothing. Lose it and the Villains hold
//     their own rally instead, braziers lit, and the district gives up nothing to the people living in it.
const CULT = { d: {}, t: 0, turn: 0, fests: 0 };
const CULT_DEF = [
  { id: 'apex', people: 'the Plaza families', mon: 'statue', monName: 'The Founders\' Stand', fest: 'the Lamplight' },
  { id: 'canal', people: 'the canal boatmen', mon: 'arch', monName: 'The Water Gate', fest: 'the Boat Blessing' },
  { id: 'rail', people: 'the yard crews', mon: 'bell', monName: 'The Yard Bell', fest: 'the Shift Song' },
  { id: 'peaks', people: 'the mountain villages', mon: 'stela', monName: 'The Shepherd\'s Stone', fest: 'the Snow Rite' },
  { id: 'ash', people: 'the smelter clans', mon: 'drum', monName: 'The Ash Drum', fest: 'the Quenching' },
  { id: 'dam', people: 'the seawall keepers', mon: 'stela', monName: 'The Tide Marker', fest: 'the Spillway Feast' },
  { id: 'wilds', people: 'the reaches holdouts', mon: 'lantern', monName: 'The Lantern Tree', fest: 'the Long Night' },
  { id: 'marina', people: 'the floating market', mon: 'arch', monName: 'The Harbour Arch', fest: 'the Floating Market' },
  { id: 'skyport', people: 'the skyport hands', mon: 'bell', monName: 'The Cloud Bell', fest: 'the First Flight' },
  { id: 'orbital', people: 'the array watch', mon: 'stela', monName: 'The Meridian Needle', fest: 'the Starwatch' },
];
const stoneM = std(0x9a9284, 0.92, 0.04), carveM = std(0xb8a46a, 0.55, 0.45), timberM = std(0x6b5236, 0.9, 0.05);
const clothM = std(0xc4553c, 0.85, 0, { side: T.DoubleSide }), bronzeM = std(0x8a6a34, 0.4, 0.7);
const lampM = basic(new T.Color(2.6, 1.7, 0.7));
/* ---------- the monuments ---------- */
function monMesh(kind) {
  const g = new T.Group();
  if (kind === 'stela') {
    const sh = new T.Mesh(new T.CylinderGeometry(1.0, 1.9, 22, 6).translate(0, 11, 0), stoneM); g.add(sh);
    for (let i = 0; i < 4; i++) { const r = new T.Mesh(new T.TorusGeometry(1.5 - i * 0.14, 0.16, 5, 16).rotateX(Math.PI / 2), carveM); r.position.y = 4 + i * 4.4; g.add(r); }
    const cap = new T.Mesh(new T.OctahedronGeometry(1.5, 0), carveM); cap.position.y = 23; g.add(cap);
  } else if (kind === 'arch') {
    for (const sx of [-4.2, 4.2]) { const p = new T.Mesh(new T.CylinderGeometry(1.1, 1.4, 14, 8).translate(0, 7, 0), stoneM); p.position.x = sx; g.add(p); }
    const lin = new T.Mesh(new T.BoxGeometry(11.6, 2.2, 2.4), stoneM); lin.position.y = 15; g.add(lin);
    const key = new T.Mesh(new T.BoxGeometry(2.4, 2.4, 2.8), carveM); key.position.y = 17; g.add(key);
    const ban = new T.Mesh(new T.PlaneGeometry(6, 7), clothM); ban.position.set(0, 10.2, 1.3); g.add(ban);
  } else if (kind === 'bell') {
    for (const sx of [-2.6, 2.6]) for (const sz of [-2.6, 2.6]) { const l = new T.Mesh(new T.BoxGeometry(0.7, 15, 0.7), timberM); l.position.set(sx, 7.5, sz); g.add(l); }
    const beam = new T.Mesh(new T.BoxGeometry(7, 0.7, 0.7), timberM); beam.position.y = 14.4; g.add(beam);
    const roof = new T.Mesh(new T.ConeGeometry(5.4, 3.6, 4), std(0x4a3a2c, 0.9, 0.05)); roof.position.y = 17; roof.rotation.y = 0.785; g.add(roof);
    const bell = new T.Mesh(new T.SphereGeometry(2.1, 12, 9, 0, 6.283, 0, 1.9), bronzeM); bell.position.y = 12.3; g.add(bell);
  } else if (kind === 'drum') {
    for (const sx of [-4, 4]) for (const sz of [-4, 4]) { const l = new T.Mesh(new T.CylinderGeometry(0.5, 0.6, 9, 7).translate(0, 4.5, 0), timberM); l.position.set(sx, 0, sz); g.add(l); }
    const roof = new T.Mesh(new T.ConeGeometry(8.2, 3.2, 4), std(0x3a2e24, 0.92, 0.05)); roof.position.y = 10.6; roof.rotation.y = 0.785; g.add(roof);
    const drum = new T.Mesh(new T.CylinderGeometry(3.1, 3.1, 4.4, 16), std(0x7a3c28, 0.8, 0.1)); drum.position.y = 3.4; drum.rotation.z = 1.571; g.add(drum);
    for (const sx of [-2.3, 2.3]) { const skin = new T.Mesh(new T.CircleGeometry(3.1, 16), std(0xd8c49a, 0.85, 0)); skin.position.set(sx, 3.4, 0); skin.rotation.y = sx > 0 ? 1.571 : -1.571; g.add(skin); }
  } else if (kind === 'lantern') {
    const tr = new T.Mesh(new T.CylinderGeometry(0.8, 1.8, 13, 7).translate(0, 6.5, 0), timberM); g.add(tr);
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9, r = rand(3, 5.6), y = 8 + rand(0, 4);
      const br = new T.Mesh(new T.CylinderGeometry(0.22, 0.4, r, 5), timberM); br.position.set(Math.cos(a) * r / 2, y, Math.sin(a) * r / 2); br.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1); g.add(br);
      const lm = new T.Mesh(new T.SphereGeometry(0.5, 8, 6), lampM); lm.position.set(Math.cos(a) * r, y - 0.9, Math.sin(a) * r); g.add(lm);
    }
  } else { // statue
    const pl = new T.Mesh(new T.BoxGeometry(6, 3.4, 6), stoneM); pl.position.y = 1.7; g.add(pl);
    const body = new T.Mesh(new T.CylinderGeometry(0.9, 1.3, 6, 9).translate(0, 3, 0), carveM); body.position.y = 3.4; g.add(body);
    const head = new T.Mesh(new T.SphereGeometry(0.8, 10, 8), carveM); head.position.y = 13; g.add(head);
    for (const sx of [-1, 1]) { const arm = new T.Mesh(new T.BoxGeometry(0.5, 4.4, 0.5), carveM); arm.position.set(sx * 1.2, 9.4, 0); arm.rotation.z = sx * 0.6; g.add(arm); }
    const cloak = new T.Mesh(new T.PlaneGeometry(4.4, 7), clothM); cloak.position.set(0, 8, -1.1); g.add(cloak);
  }
  return g;
}
/* a clear spot near the district centre: off the flag, on dry ground, out of a building */
function cultSpot(cp, want, r0, r1) {
  for (let i = 0; i < 40; i++) {
    const a = rand(0, 6.283), r = rand(r0, r1), x = cp.x + Math.cos(a) * r, z = cp.z + Math.sin(a) * r;
    if (H(x, z) < 1.4) continue;
    if (buildingAt(_v1.set(x, H(x, z) + 2, z))) continue;
    const sl = Math.max(Math.abs(H(x + 5, z) - H(x - 5, z)), Math.abs(H(x, z + 5) - H(x, z - 5))); if (sl > 6) continue;
    if (want && BUILDINGS.some(b => Math.abs(b.x - x) < (b.w + want) / 2 + 3 && Math.abs(b.z - z) < (b.d + want) / 2 + 3)) continue;
    return { x, z };
  }
  /* a post out at sea (the Floating Marina) keeps its market and monument on the nearest dry shore */
  for (let i = 0; i < 80; i++) { const a = rand(0, 6.283), r = rand(r0, r1 * 4), x = cp.x + Math.cos(a) * r, z = cp.z + Math.sin(a) * r; if (H(x, z) < 1.4 || buildingAt(_v1.set(x, H(x, z) + 2, z))) continue; return { x, z }; }
  return { x: cp.x + r0, z: cp.z + r0 };
}
/* ---------- the market: counters merged into one mesh, awnings into another so they can be shuttered ---------- */
function marketMesh(cp, C) {
  const counters = [], awns = [], base = groundY(cp.x, cp.z);
  const sp = cultSpot(cp, 10, 20, 38); C.mx = sp.x; C.mz = sp.z;
  for (let i = 0; i < 6; i++) {
    const a = i * 1.047 + rand(-0.12, 0.12), r = rand(6, 13);
    const x = sp.x + Math.cos(a) * r, z = sp.z + Math.sin(a) * r, y = groundY(x, z) - base;
    if (buildingAt(_v1.set(x, groundY(x, z) + 1, z))) continue;
    const yaw = Math.atan2(sp.x - x, sp.z - z);
    const C0 = new T.BoxGeometry(3.2, 1.0, 1.6).translate(0, 0.5, 0).rotateY(yaw).translate(x - cp.x, y, z - cp.z); counters.push(C0);
    const p1 = new T.BoxGeometry(0.16, 2.4, 0.16).translate(-1.5, 1.2, -0.7).rotateY(yaw).translate(x - cp.x, y, z - cp.z); counters.push(p1);
    const p2 = new T.BoxGeometry(0.16, 2.4, 0.16).translate(1.5, 1.2, -0.7).rotateY(yaw).translate(x - cp.x, y, z - cp.z); counters.push(p2);
    const aw = new T.PlaneGeometry(3.6, 2.2).rotateX(-1.1).translate(0, 2.5, 0.35).rotateY(yaw).translate(x - cp.x, y, z - cp.z); awns.push(aw);
    const cr = new T.BoxGeometry(0.9, 0.7, 0.9).translate(rand(-1.2, 1.2), 0.35, rand(0.8, 1.4)).rotateY(yaw).translate(x - cp.x, y, z - cp.z); counters.push(cr);
  }
  const g = new T.Group(); g.position.set(cp.x, base, cp.z); scene.add(g);
  if (counters.length) { const m = new T.Mesh(mergeGeos(counters), timberM); m.castShadow = true; m.receiveShadow = true; g.add(m); }
  C.awnM = clothM.clone(); C.awnM.color.setHex(pick([0xc4553c, 0xb8893a, 0x3c6a72, 0x8a4a6a]));
  if (awns.length) { const m = new T.Mesh(mergeGeos(awns), C.awnM); m.castShadow = true; C.awn = m; g.add(m); }
  /* the brazier the Villains light when the district is theirs */
  C.brazM = std(0x241a16, 0.9, 0.1, { emissive: 0xff5a1a, emissiveIntensity: 0 });
  const br = new T.Mesh(new T.CylinderGeometry(0.9, 0.6, 1.3, 9), C.brazM); br.position.set(sp.x - cp.x, groundY(sp.x, sp.z) - base + 0.65, sp.z - cp.z); g.add(br);
  C.braz = br; C.g = g;
}
/* ---------- build it all, once ---------- */
for (const D of CULT_DEF) {
  const cp = CPS.find(c => c.id === D.id); if (!cp) continue;
  const C = Object.assign({ cp, morale: cp.owner === 1 ? 0.65 : 0.3, state: 'quiet', quiet: 0, festT: 0, said: -99, reb: 0 }, D);
  const sp = cultSpot(cp, 12, 26, 44), mesh = monMesh(D.mon);
  C.b = new Building(sp.x, sp.z, D.mon === 'arch' ? 11 : 7, 7, D.mon === 'stela' ? 24 : 16, { mesh, name: D.monName, mode: 'topple', hp: 2600 });
  BUILDINGS.push(C.b);
  marketMesh(cp, C);
  CULT.d[D.id] = C;
}
/* One line in the people row, and only when it is worth a line: a catastrophe or a Villain at work still wins it,
   then empty granaries, then whichever district is holding a festival. Nothing new appears on a quiet HUD. */
{
  const _cl = catLine;
  catLine = function () {
    const base = _cl(); if (base) return base;
    if (typeof AGRI !== 'undefined' && AGRI.food < 160) return `<div class="pcat warn">Granaries down to ${Math.round(AGRI.food)} · the districts are going hungry</div>`;
    let F = null, fd = 1e9;
    for (const id in CULT.d) { const C = CULT.d[id]; if (C.state !== 'festival') continue; const d = C.cp.pos.distanceTo(camera.position); if (d < fd) { fd = d; F = C; } }
    if (F) return `<div class="pcat">${F.cp.name} is holding ${F.fest} · they are sheltering their own</div>`;
    return '';
  };
}
/* ---------- culture is shelter: a district that still has its monument, its market and its festival keeps its people ---------- */
{ const _sh = shelterAt; shelterAt = function (cp) { const C = CULT.d[cp.id]; return _sh(cp) + (C ? C.morale * 0.6 : 0); }; }
const cultHostile = (C, r) => { for (const e of ENTS) { if (!e.alive || !isHostile(e.team) || e.pos.y > 220) continue; if (Math.hypot(e.pos.x - C.cp.x, e.pos.z - C.cp.z) < r) return true; } return false; };
function cultFestival(C) {
  C.state = 'festival'; C.festT = rand(48, 70); CULT.fests++;
  comms(C.cp.name, `${C.people} are holding ${C.fest}. They are staying put.`, 'b');
  banner(`${C.cp.name}: ${C.fest}`, 'The district is holding its festival', '#ffd27a');
  snd('chime', C.cp.pos, 0.7);
}
function cultTick(C, dt) {
  const cp = C.cp, hostile = cultHostile(C, 230), held = cp.owner === 1, lost = cp.owner === 2, empty = (cp.pop || 0) <= 0;
  /* state */
  if (lost) { C.state = 'rally'; C.quiet = 0; }
  else if (C.state === 'festival') { if ((C.festT -= dt) <= 0 || hostile || empty) { C.state = 'quiet'; C.quiet = 0; if (hostile) comms(C.cp.name, 'The festival is breaking up — they are coming.', 'cmd'); } }
  else { C.quiet = hostile || empty || !held ? 0 : C.quiet + dt; if (C.quiet > 26 && !empty && agriFed()) cultFestival(C); else C.state = cp.contested ? 'contested' : 'quiet'; }
  /* morale */
  let want = 0.3;
  if (C.state === 'festival') want = 1;
  else if (C.state === 'rally') want = 0.06;
  else if (C.state === 'contested') want = 0.3;
  else want = 0.62;
  if (!C.b.alive) want -= 0.22; // the monument is down
  if (C.awn && !C.marketOk) want -= 0.08;
  if (!agriFed()) want = Math.min(want, 0.34); // nothing in the granaries: nobody is celebrating anything
  if (empty) want = 0;
  C.morale += (clamp(want, 0, 1) - C.morale) * Math.min(1, dt * 0.1); /* morale is a trend, not a switch */
  /* the stalls: open when nobody is shooting, shuttered when they are */
  const open = !hostile && !lost && !empty; C.marketOk = open;
  if (C.awn) C.awn.visible = open || C.state === 'festival';
  C.brazM.emissiveIntensity = C.state === 'rally' ? 0.6 + Math.sin(TIME * 5 + C.cp.x) * 0.25 : 0;
  C.braz.visible = C.state === 'rally';
  /* the Guild raises the monument again once the district is Hero-held and quiet */
  if (!C.b.alive && held && !cultHostile(C, 150)) { if ((C.reb += dt) > 40) { C.reb = 0; C.b.restore(); poolChip(`${C.monName} is standing again`, 'g'); comms('Builder Guild', `${C.monName} is back up. ${C.people} turned out to help.`, 'b'); } }
  else if (C.b.alive) C.reb = 0;
}
function updateCulture(dt) {
  if (GAME.state !== 'play') return;
  if ((CULT.t -= dt) <= 0) { // two districts a tick: ten districts every two and a half seconds
    const step = 0.5; CULT.t = 0.5;
    const ids = CULT_DEF;
    for (let k = 0; k < 2; k++) { const D = ids[CULT.turn = (CULT.turn + 1) % ids.length], C = CULT.d[D.id]; if (C) cultTick(C, step * ids.length / 2); }
  }
  /* festival lanterns and drums, only where you can see them */
  for (const id in CULT.d) {
    const C = CULT.d[id]; if (C.state !== 'festival') continue;
    const d = camera.position.distanceTo(C.cp.pos); if (d > 620) continue;
    if (Math.random() < dt * (d < 220 ? 7 : 2.5)) {
      const x = C.mx + rand(-14, 14), z = C.mz + rand(-14, 14), y = groundY(x, z) + rand(1, 3);
      FXS.spawn(x, y, z, rand(-0.4, 0.4), rand(2.2, 4.4), rand(-0.4, 0.4), rand(5, 8), 0.5, 1.1, 2.6, 1.7, 0.7, 1.4, 0.7, 0.2, 0.9, 0.2, 0.3);
    }
    if (d < 300 && Math.random() < dt * 0.5) snd('clank', C.cp.pos, 0.35); // the drums
  }
  /* the people come out for it: residents of a district at festival drift to the market square and stand about there,
     and go back to their own doorways when it is over */
  if ((CULT.resT = (CULT.resT || 0) - dt) <= 0) {
    CULT.resT = 2;
    for (const R of RES) {
      const C = CULT.d[R.home.id]; if (!C) continue;
      if (C.state === 'festival') {
        if (!R.anchor0) { R.anchor0 = R.anchor.clone(); const a = rand(0, 6.283), r = rand(3, 17); R.anchor.set(C.mx + Math.cos(a) * r, 0, C.mz + Math.sin(a) * r); R.anchor.y = surfY(R.anchor.x, R.anchor.z, R.home.pos.y + 2); }
      } else if (R.anchor0) { R.anchor.copy(R.anchor0); R.anchor0 = null; }
    }
  }
}
