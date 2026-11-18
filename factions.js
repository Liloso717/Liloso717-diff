'use strict';
/* ===================== IRON MERIDIAN · four armies, told apart by helmet colour and banners ===================== */
// The Heroes (blue, yours) and the Villains (crimson). Fifteen a side on the field.
// Every army fights every other army it meets, and all of them push for the command posts.
// Each trooper wears a painted helmet shell in army colours.
const ARMY_LOOK = {
  1: { helm: 0x0a2c9c }, 2: { helm: 0xb80f18 },
  4: { helm: 0xe08a00, armor: 0x7c6a4c, cloth: 0x3b3326, accent: 0x9a7a4a, glow: [3.2, 2.0, 0.4] },
  5: { helm: 0x1f9a3a, armor: 0x5b6a49, cloth: 0x2a3324, accent: 0xb4c29a, glow: [0.6, 3.0, 1.0] },
};
const ARMY_SHAPE = { 1: 1, 2: 2, 4: 2, 5: 1 }; // which base trooper silhouette (helmet style) each army wears
(function armyMaterials() { // teams 4 and 5: their own clones of a base material set, retinted (Meridian and Vanta keep the artist's)
  for (const t of [4, 5]) {
    const src = SMAT[ARMY_SHAPE[t]], L = ARMY_LOOK[t]; SMAT[t] = {}; for (const k in src) SMAT[t][k] = src[k].clone();
    SMAT[t].armor.color.setHex(L.armor); SMAT[t].cloth.color.setHex(L.cloth); SMAT[t].accent.color.setHex(L.accent); SMAT[t].glow.color.setRGB(L.glow[0], L.glow[1], L.glow[2]);
  }
})();
/* helmet shells as one vertex-tinted mesh per trooper */
function tintedMerge(parts) { const g = mergeGeos(parts.map(p => p[0])), col = new Float32Array(g.attributes.position.count * 3); let o = 0; for (const [p, k] of parts) { const n = p.attributes.position.count * 3; col.fill(k, o, o + n); o += n; } g.setAttribute('color', new T.BufferAttribute(col, 3)); return g; }
const HELM_G = { 1: [xf(new T.SphereGeometry(0.152, 20, 8, 0, Math.PI * 2, 0, Math.PI * 0.36), [0, 1.73, 0], [-0.2, 0, 0], [1, 1.05, 1.12]), 1], 2: [xf(rbox(0.266, 0.085, 0.296, 0.035, 2), [0, 1.818, 0]), 1] };
const ARMY_G = {}; for (const s of [1, 2]) ARMY_G[s] = { helm: tintedMerge([HELM_G[s]]) };
const ARMY_M = {}; for (const t of ARMIES) ARMY_M[t] = std(ARMY_LOOK[t].helm, 0.62, 0.02, { vertexColors: true, emissive: ARMY_LOOK[t].helm, emissiveIntensity: 0.3 });
const _buildTrooper = buildTrooperModel;
buildTrooperModel = function (team, heavy) { // every army: base geometry for its silhouette, its own materials, plus the painted helmet
  const shape = ARMY_SHAPE[team]; if (!shape) return _buildTrooper(team, heavy);
  const r = _buildTrooper(shape, heavy);
  if (shape !== team) { const src = SMAT[shape], dst = SMAT[team]; r.root.traverse(o => { if (o.isMesh) for (const k in src) if (o.material === src[k]) { o.material = dst[k]; break; } }); }
  const h = new T.Mesh(ARMY_G[shape].helm, ARMY_M[team]); h.castShadow = false; /* a painted shell: no extra shadow draw */ r.body.add(h); r.body.userData.helm = h;
  return r;
};
/* ---------- the Ashen Pact and the Verdant Host: camps, sustained strength, waves to the fronts ---------- */
const ARMY_POP = { start: 10, lo: 10, hi: 10 }, ARMY_T = { 2: 3 };
function armyCount(t) { let n = 0; for (const e of ENTS) if (e.team === t && e.kind === 'soldier' && e.alive) n++; for (const s of SPAWNER.q) if (s.team === t && s.type === 'soldier') n++; return n; }
function landNear(x, z, r) { for (let i = 0; i < 14; i++) { const px = clamp(x + rand(-r, r), 20 - BOUND, BOUND - 20), pz = clamp(z + rand(-r, r), 20 - BOUND, BOUND - 20); if (H(px, pz) > 0.8) return new V3(px, 0, pz); } return new V3(x, 0, z); }
const _queue = SPAWNER.queue;
SPAWNER.queue = function (type, team, delay) { if (type === 'soldier' && team > 3 && armyCount(team) >= ARMY_POP.hi) return; _queue.call(this, type, team, delay); }; // the new armies never outgrow their cap
function rivalFor(cp) { // the hostile army best placed to hit this post: nearest camp or held post, with some chance
  let best = 2, bs = -1;
  for (const t of [2]) { let d = Math.hypot(HQ[t].x - cp.x, HQ[t].z - cp.z); for (const c of CPS) if (c.owner === t && c !== cp) d = Math.min(d, Math.hypot(c.x - cp.x, c.z - cp.z) + 80); const s = rand(0.6, 1.4) / (d + 250); if (s > bs) { bs = s; best = t; } }
  return best;
}
function armyWave(t, cp) { // a squad or two lands on the army's side of a hot front
  const n = Math.min(6, ARMY_POP.hi - armyCount(t)); if (n <= 0) return; const h = HQ[t], dx = h.x - cp.x, dz = h.z - cp.z, l = Math.hypot(dx, dz) || 1;
  const p = landNear(cp.x + dx / l * 110, cp.z + dz / l * 110, 25); for (let i = 0; i < n; i++) { if (!warTake(t)) break; const e = spawnUnit('soldier', t); if (e) e.spawnAt(landNear(p.x, p.z, 10)); }
}
function updateArmies(dt) {
  if (GAME.state === 'end') return;
  for (const t of [2]) { if ((ARMY_T[t] -= dt) > 0) continue; ARMY_T[t] = 8; const n = ARMY_POP.lo - armyCount(t); for (let i = 0; i < Math.min(4, n); i++) SPAWNER.queue('soldier', t, rand(0, 3)); }
}
function setupArmies() {
  for (const t of [1, 2]) { for (let i = 0; i < ARMY_POP.start; i++) { const e = spawnUnit('soldier', t); if (e && i % 2) e.spawnAt(landNear(HQ[t].x, HQ[t].z, 70)); } } /* fifteen Heroes, fifteen Villains */
}
for (const t of [4, 5]) if (!MAT[t]) MAT[t] = MAT[ARMY_SHAPE[t]]; /* kept so stray references never crash */ /* safety: any non-soldier unit of the new armies borrows a base material set */

/* ===================== fifteen a side, and only the ones near you are on the field =====================
   You are one of fifteen Heroes, and each of you brought a company; the Villains are fifteen with companies of their
   own. Thirty armies would be thirty times the soldiers and a tenth of the frame rate, so only the champions whose
   fight is where yours is actually stand on the ground: two Heroes and two Villains at a time, each with a handful
   of their own people. The rest are fighting their own districts, and the net tells you how they are getting on. */
const CHAMP = {
  heroes: ['Ravenshade', 'Lumen', 'Ironvale', 'Saint Mercy', 'Blackwell', 'Halcyon', 'Pale Rider', 'Cindergirl', 'The Quiet Man', 'Ashlight', 'Verity', 'Tideborn', 'Orbit', 'Nine Lives'],
  villains: ['Executor Kael', 'Blademaster Syr', 'Warlord Cinder', 'Huntmaster Thorn', 'The Undertaker', 'Scald', 'Mother Rust', 'Grave Harrow', 'Vex', 'The Collector', 'Nightjar', 'Sawbones', 'Marrow', 'Cold Iron', 'The Pale King'],
  live: [], t: 6, sayT: 0, news: 0,
};
function champRetire(C) {
  for (const s of C.ret) if (s.alive && !s.remove) { s.remove = true; s.alive = false; }
  if (C.ent.alive && !C.ent.remove) { C.ent.remove = true; C.ent.alive = false; }
  CHAMP.live = CHAMP.live.filter(q => q !== C);
}
function champSpawn(team, name, at) {
  CHAMP.spawning = true;
  const c = spawnUnit('soldier', team); if (!c || !c.alive) { CHAMP.spawning = false; return null; }
  const p = landNear(at.x + rand(-40, 40), at.z + rand(-40, 40), 26);
  c.spawnAt(p); c.heavy = true; c.maxHp = c.hp = team === 1 ? 600 : 520; c.name = name; c.champ = true;
  if (c.obj) c.obj.scale.setScalar(1.16);
  if (team === 2) c.bounty = 500;
  const ret = [];
  for (let i = 0; i < 4; i++) { const s = spawnUnit('soldier', team); if (s && s.alive) { s.spawnAt(new V3(p.x + rand(-9, 9), 0, p.z + rand(-9, 9))); s.name = `${name}'s ${team === 1 ? 'company' : 'crew'}`; ret.push(s); } }
  CHAMP.spawning = false;
  const C = { ent: c, ret, name, team }; CHAMP.live.push(C);
  if (TIME - CHAMP.sayT > 6) { CHAMP.sayT = TIME; comms(team === 1 ? 'Hero net' : null, team === 1 ? `${name} is on the ground with you.` : `${name} is here, and not alone.`, team === 1 ? 'b' : 'cmd'); }
  return C;
}
function updateChampions(dt) {
  if (GAME.state !== 'play') return;
  for (let i = CHAMP.live.length - 1; i >= 0; i--) {
    const C = CHAMP.live[i];
    C.ret = C.ret.filter(s => s.alive && !s.remove);
    if (!C.ent.alive || C.ent.remove) {
      CHAMP.live.splice(i, 1);
      comms(C.team === 1 ? 'Hero net' : null, C.team === 1 ? `${C.name} is down. We are one short.` : `${C.name} is finished.`, C.team === 1 ? 'cmd' : 'b');
      if (C.team === 2) { /* the district he was bleeding gets its breath back */
        const near = CPS.reduce((b, q) => Math.hypot(q.x - C.ent.pos.x, q.z - C.ent.pos.z) < Math.hypot(b.x - C.ent.pos.x, b.z - C.ent.pos.z) ? q : b, CPS[0]);
        if (near && Math.hypot(near.x - C.ent.pos.x, near.z - C.ent.pos.z) < 160) {
          near.safeT = TIME + 45;
          banner(`${C.name} is down`, `${near.name} stops bleeding for forty-five seconds`, 'var(--blue)');
          if (typeof poolChip === 'function') poolChip(`${near.name} · safe for 45 s`, 'b');
        }
        awardPoints(400, `${C.name} killed`); addXP(300);
      }
      for (const s of C.ret) if (s.alive) s.champOf = null;
      continue;
    }
    const cam = camera.position; /* their fight moved on: let them go rather than leaving bodies across the island */
    if (Math.hypot(C.ent.pos.x - cam.x, C.ent.pos.z - cam.z) > 620) champRetire(C);
  }
  if ((CHAMP.t -= dt) > 0) return; CHAMP.t = 14;
  const cp = (typeof THEATRE !== 'undefined' && THEATRE.cur && THEATRE.cur.cp) || CPS[0]; if (!cp) return;
  const used = new Set(CHAMP.live.map(C => C.name));
  for (const team of [1, 2]) {
    const have = CHAMP.live.filter(C => C.team === team).length;
    if (have >= 2) continue;
    const pool = (team === 1 ? CHAMP.heroes : CHAMP.villains).filter(n => !used.has(n));
    if (!pool.length) continue;
    champSpawn(team, pick(pool), cp);
  }
  /* the rest of the roster, fighting their own districts */
  if ((CHAMP.news -= 1) <= 0) {
    CHAMP.news = 5; const other = CPS.filter(c => c !== cp && c.pop > 0);
    if (other.length && Math.random() < 0.6) {
      const c = pick(other), hero = pick(CHAMP.heroes), vil = pick(CHAMP.villains);
      comms('Hero net', Math.random() < 0.5 ? `${hero} is holding ${c.name} · ${c.pop} still in there.` : `${vil} is working ${c.name} over. ${hero} is on the way.`, 'b');
    }
  }
}
