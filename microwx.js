'use strict';
/* ===================== IRON MERIDIAN · weather that stands over one part of the island, not all of it ===================== */
// Aeris Island is 1.6 km across and the sky over it is not one thing. Three weather cells drift across the map on the
// wind, each with its own character, its own cloud deck and its own curtain of fall you can see from the far shore:
//   Rain         · a grey deck and a shaft of rain · the crops drink it
//   Thunderhead  · darker, heavier, and it throws lightning inside its own footprint
//   Snow squall  · a white cap over the high ground
//   Dust storm   · a tan wall off the volcano flats · it strips the fields and blinds the fight inside it
//   Heat spell   · no cloud at all, just hard clean light · it ripens a field fast and then starts to cook it
// Stand under one and the field-wide weather in weather.js becomes that cell's weather; walk out from under it and the
// sky clears behind you. The farm belts in agri.js read the cell standing over each belt, so the harvest you get
// depends on where the rain went this time.
const MWX_KINDS = {
  rain: { title: 'Rain', wx: 'rain', cloud: 0x515d6b, shaft: 0x7f93b4, op: 0.17, dark: 0.3, crop: 2.1, say: 'Rain cell moving over' },
  storm: { title: 'Thunderhead', wx: 'rain', cloud: 0x2b313c, shaft: 0x5a6a86, op: 0.24, dark: 0.55, crop: 1.5, bolt: true, say: 'Thunderhead building over' },
  snow: { title: 'Snow squall', wx: 'snow', cloud: 0x8e99a7, shaft: 0xdfe8f2, op: 0.15, dark: 0.22, crop: 0.35, say: 'Snow squall closing on' },
  dust: { title: 'Dust storm', wx: 'sunny', cloud: 0x8e6e44, shaft: 0xb08b55, op: 0.26, dark: 0.42, crop: 0.1, grit: true, say: 'Dust storm rolling over' },
  heat: { title: 'Heat spell', wx: 'sunny', cloud: 0, shaft: 0, op: 0, dark: 0, crop: 1.35, heat: true, say: 'Heat settling on' },
};
const MWX_ROLL = ['rain', 'rain', 'storm', 'snow', 'dust', 'heat', 'heat'];
const MWX = { cells: [], here: null, hereK: 0, said: null, saidT: -99, boltT: 0 };
/* Where a cell is said to be, for the one line of comms it gets: the nearest district to its centre. */
function mwxWhere(c) { let b = CPS[0], bd = 1e9; for (const cp of CPS) { const d = Math.hypot(cp.x - c.x, cp.z - c.z); if (d < bd) { bd = d; b = cp; } } return b.name; }
/* ---------- three cell rigs, built once and only ever re-coloured and re-scaled ---------- */
const MWX_N = 3;
{
  const puffG = new T.SphereGeometry(1, 9, 6), shaftG = new T.CylinderGeometry(1, 0.84, 1, 18, 1, true);
  for (let i = 0; i < MWX_N; i++) {
    const g = new T.Group(); g.visible = false; scene.add(g);
    const deck = new T.Group(); g.add(deck);
    const cm = std(0x515d6b, 1, 0, { transparent: true, opacity: 0, depthWrite: false, fog: false });
    for (let k = 0; k < 9; k++) { // a ragged cloud deck: nine flattened puffs on a disc
      const a = k * 0.698 + rand(-0.2, 0.2), r = k === 0 ? 0 : rand(0.3, 0.92);
      const p = new T.Mesh(puffG, cm); p.position.set(Math.cos(a) * r, rand(-0.06, 0.1), Math.sin(a) * r); p.scale.set(rand(0.4, 0.62), rand(0.1, 0.17), rand(0.4, 0.62)); p.castShadow = false; deck.add(p);
    }
    const sm = basic(new T.Color(0x7f93b4), { transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide, fog: false });
    const shaft = new T.Mesh(shaftG, sm); shaft.castShadow = false; g.add(shaft);
    MWX.cells.push({ g, deck, cm, sm, shaft, kind: 'rain', K: MWX_KINDS.rain, x: 0, z: 0, r: 180, vx: 0, vz: 0, k: 0, t: 0, life: 1, seeded: false });
  }
}
function mwxSeed(c, first) {
  c.kind = pick(MWX_ROLL); c.K = MWX_KINDS[c.kind];
  c.r = rand(150, 290); c.life = rand(95, 190); c.t = first ? rand(0, 40) : 0; c.k = 0;
  const a = rand(0, 6.283), sp = rand(4.5, 11); c.vx = Math.cos(a) * sp; c.vz = Math.sin(a) * sp;
  c.x = rand(-BOUND + 80, BOUND - 80); c.z = rand(-BOUND + 80, BOUND - 80);
  if (first) { c.seeded = true; return; }
  for (let i = 0; i < 20; i++) { // come in off an edge, upwind, so a cell is seen arriving rather than appearing overhead
    c.x = clamp(c.x - c.vx * 42, -BOUND - 120, BOUND + 120); c.z = clamp(c.z - c.vz * 42, -BOUND - 120, BOUND + 120);
    if (Math.abs(c.x) > BOUND * 0.55 || Math.abs(c.z) > BOUND * 0.55) break;
  }
  c.cm.color.setHex(c.K.cloud || 0x515d6b); c.sm.color.setHex(c.K.shaft || 0x7f93b4);
  if (GAME.state === 'play' && c.K.cloud) comms('Met Section', `${c.K.say} ${mwxWhere(c)}.`, 'cmd');
}
MWX.cells.forEach(c => mwxSeed(c, true));
MWX.cells.forEach(c => { c.cm.color.setHex(c.K.cloud || 0x515d6b); c.sm.color.setHex(c.K.shaft || 0x7f93b4); });
/* The cell standing over a point, and how hard it is coming down there. Three cells, so this is cheap enough to call
   from the farm belts, the fire spread and the fight. */
function mwxAt(x, z, out) {
  let best = null, bk = 0;
  for (const c of MWX.cells) { if (c.k < 0.04) continue; const d = Math.hypot(c.x - x, c.z - z); if (d > c.r) continue; const k = c.k * smooth(c.r, c.r * 0.55, d); if (k > bk) { bk = k; best = c; } }
  if (out) { out.kind = best ? best.kind : 'clear'; out.k = bk; out.K = best ? best.K : null; }
  return best;
}
const mwxCrop = (x, z) => { const c = mwxAt(x, z); return c ? 1 + (c.K.crop - 1) * c.k : 1; }; /* growth multiplier under whatever is overhead */
const mwxWet = (x, z) => { const c = mwxAt(x, z); return c && (c.kind === 'rain' || c.kind === 'storm') ? c.k : 0 }; /* rain puts fires out */
function updateMicroWx(dt) {
  if (GAME.state === 'menu' && GAME.clock < 10) return;
  const pe = PLAYER.ent && PLAYER.ent.alive ? PLAYER.ent.pos : camera.position;
  for (const c of MWX.cells) {
    c.t += dt;
    if (c.t > c.life) { mwxSeed(c, false); continue; }
    c.x += c.vx * dt; c.z += c.vz * dt;
    if (Math.abs(c.x) > BOUND + 200 || Math.abs(c.z) > BOUND + 200) { mwxSeed(c, false); continue; }
    c.k = smooth(0, 18, c.t) * (1 - smooth(c.life - 22, c.life, c.t)); // fades up as it arrives, out as it breaks up
    const K = c.K, show = c.k > 0.03 && K.cloud && camera.position.y < 2000;
    c.g.visible = show;
    if (show) {
      const y = 170 + c.r * 0.22;
      c.g.position.set(c.x, y, c.z); c.deck.scale.setScalar(c.r * 1.18); c.deck.scale.y = c.r * 0.5;
      c.cm.opacity = c.k * 0.74;
      c.shaft.position.y = -y * 0.52; c.shaft.scale.set(c.r * 0.92, y * 1.04, c.r * 0.92);
      c.sm.opacity = c.k * K.op * (camera.position.y > 600 ? 0.5 : 1);
    }
    if (K.bolt && c.k > 0.4 && (MWX.boltT -= dt) <= 0) { // a thunderhead throws lightning inside its own footprint only
      MWX.boltT = rand(1.4, 4.5);
      const a = rand(0, 6.283), r = Math.sqrt(Math.random()) * c.r * 0.9;
      const p = new V3(clamp(c.x + Math.cos(a) * r, -BOUND, BOUND), 0, clamp(c.z + Math.sin(a) * r, -BOUND, BOUND)); p.y = groundY(p.x, p.z);
      const far = p.distanceTo(camera.position);
      if (far < 1400) {
        beam(_v1.set(p.x + rand(-26, 26), p.y + 260, p.z + rand(-26, 26)), p, 0.6, 0.2, 0xbfd8ff); flashLight(p, 6, 150, 0.24, 0xcfe0ff);
        if (far < 700) { explodeDamage(p, 5, 110, null, 0); fxSparks(p, 10, [2, 2.6, 4], 10); }
        setTimeout(() => snd('big', p, 0.75), Math.min(2600, far / 0.343));
      }
    }
  }
  /* What is standing over the Commander becomes the field weather, so weather.js keeps doing the fall, the fog and the
     light — it just does it where the cell is. */
  const over = mwxAt(pe.x, pe.z); MWX.here = over; MWX.hereK = over ? over.k : 0;
  WEATHER.next = 1e9; // the field-wide cycle is retired: the cells are the weather now
  const want = over && over.k > 0.3 ? over.K.wx : 'sunny';
  if (WEATHER.state !== want) WEATHER.state = want;
  if (over && over.K.grit) ZONE.gust = Math.max(ZONE.gust, 0.5 + over.k * 0.5);
  if (over && over.K.cloud) NATURE.dark = Math.max(NATURE.dark, over.K.dark * over.k);
  const id = over ? over.kind : null;
  if (id !== MWX.said && TIME - MWX.saidT > 10) { // one quiet line when you walk in or out of one
    MWX.said = id; MWX.saidT = TIME;
    if (over && over.k > 0.3 && GAME.state === 'play') banner(over.K.title, 'Overhead', over.kind === 'dust' ? '#c9a05a' : over.kind === 'heat' ? '#ffd27a' : '#9ab8e8');
  }
}
