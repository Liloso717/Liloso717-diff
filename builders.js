'use strict';
/* ===================== IRON MERIDIAN · the Builder Guild: robot crews that raise fortresses in the middle of the war ===================== */
// Neutral robot pedestrians walk the battlefield in crews of four. They belong to no army and nobody shoots them on purpose.
//  · BUILD   · crews raise a fortress beside each post, village, landmark and trench line: foundation, rising walls,
//              four gun towers and a central keep, with scaffolding and a crane while it goes up.
//  · WEATHER · calm sun is the fastest building weather; rain and snow slow them; at night they work by lamp light.
//  · STRIP   · when a disaster hits near a site, the crew deconstructs the unfinished top course and huddles, then
//              surges back to work once it has passed. After every disaster a crew also clears the rubble of a fallen
//              building nearby (deconstruction) and raises it again, stronger than before.
//  · RAZE    · explosions (anyone's: rockets, grenades, shells, crashes) damage a site under construction and kill
//              robots. Raze it and it is gone for the rest of the war: one less place to fight.
//  · FORTRESS · leave them alone and the site finishes as a near-indestructible fortress: parapet walls to fight behind,
//              four towers (ziplines up) and a keep. Disasters and shells can't touch it, and any army can use it.
//  · WORKS   · in the active battle itself the Guild runs a live worksite on your squad's side (worksite.js).
const BLD = { sites: [], jobs: [], W: [], rebT: 90, sendT: 25, lastEv: null, surge: 0, stripSaid: 0 };
const FORT = { S: 36 }; /* fortress footprint (metres) */
const FORT_M = { conc: std(0x6a6c68, 0.9, 0.08, { normalMap: TEX.armor.normal }), dark: MAT_GUN, hazard: std(0xd9a91e, 0.55, 0.45), glow: basic(new T.Color(3.2, 2.1, 0.5)), scaf: std(0x8a7a5a, 0.7, 0.6) };
/* ---------- fortress geometry (one merged model, scaled up from the ground while it is built) ---------- */
const FORT_GEO = (() => {
  const b = bucket(), h = FORT.S / 2;
  b.add('conc', new T.BoxGeometry(FORT.S + 2, 2.6, FORT.S + 2).translate(0, -1.0, 0)); /* foundation slab, sunk into the ground */
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { /* corner gun towers */
    b.add('conc', new T.BoxGeometry(6, 9, 6).translate(sx * (h - 3), 4.5, sz * (h - 3)));
    for (const q of [-2.2, 0, 2.2]) for (const s of [-1, 1]) { b.add('conc', new T.BoxGeometry(1, 1, 0.6).translate(sx * (h - 3) + q, 9.5, sz * (h - 3) + s * 2.7)); b.add('conc', new T.BoxGeometry(0.6, 1, 1).translate(sx * (h - 3) + s * 2.7, 9.5, sz * (h - 3) + q)); } /* merlons */
    b.add('hazard', new T.BoxGeometry(6.1, 0.5, 6.1).translate(sx * (h - 3), 7.6, sz * (h - 3)));
    b.add('glow', new T.BoxGeometry(0.4, 0.4, 0.4).translate(sx * (h - 0.2), 8.2, sz * (h - 0.2)));
    b.add('dark', new T.BoxGeometry(0.5, 9.2, 0.18).translate(sx * (h - 3) - sx * 0.4, 4.6, sz * (h - 3) - sz * 3.05)); /* ladder rail facing in */
  }
  for (const side of [0, 1, 2, 3]) for (const half of [-1, 1]) { /* parapet walls between the towers, gate gap in the middle of every side */
    const a = side * Math.PI / 2, len = 9, mid = half * 7.5, g = new T.BoxGeometry(len, 1.6, 1.6).translate(mid, 0.8, h - 0.8); g.rotateY(a); b.add('conc', g);
    const cap = new T.BoxGeometry(len, 0.2, 1.8).translate(mid, 1.7, h - 0.8); cap.rotateY(a); b.add('dark', cap);
    for (let k = 0; k < 3; k++) { const m = new T.BoxGeometry(1.2, 0.6, 1.4).translate(mid + (k - 1) * 3.2, 2.1, h - 0.8); m.rotateY(a); b.add('conc', m); }
    const post = new T.BoxGeometry(0.8, 5.5, 0.8).translate(half * 3.4, 2.75, h - 0.8); post.rotateY(a); b.add('dark', post);
  }
  for (const side of [0, 1, 2, 3]) { const l = new T.BoxGeometry(7.6, 0.8, 1).translate(0, 5.6, h - 0.8); l.rotateY(side * Math.PI / 2); b.add('hazard', l); }
  b.add('conc', new T.BoxGeometry(10, 6, 10).translate(0, 3, 0)); b.add('dark', new T.BoxGeometry(10.4, 0.4, 10.4).translate(0, 6.1, 0)); /* the keep */
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; b.add('conc', new T.BoxGeometry(1.4, 0.9, 0.5).translate(Math.cos(a) * 4.6, 6.7, Math.sin(a) * 4.6)); }
  b.add('dark', new T.BoxGeometry(2.4, 3.2, 0.3).translate(0, 1.6, 5.05)); b.add('glow', new T.BoxGeometry(2, 0.2, 0.2).translate(0, 3.5, 5.2));
  b.add('dark', new T.CylinderGeometry(0.12, 0.12, 6, 5).translate(0, 9.6, 0)); b.add('glow', new T.SphereGeometry(0.35, 8, 6).translate(0, 12.7, 0));
  return b;
})();
const SCAF_GEO = (() => { /* scaffold poles and planks around the rising walls */
  const L = [], h = FORT.S / 2 + 1.2;
  for (let i = -3; i <= 3; i++) for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = sx ? sx * h : i * 5.6, z = sz ? sz * h : i * 5.6; L.push(new T.BoxGeometry(0.16, 11, 0.16).translate(x, 5.5, z)); }
  for (const y of [2.5, 5.5, 8.5]) for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) L.push(new T.BoxGeometry(sx ? 0.6 : FORT.S + 2.4, 0.12, sz ? 0.6 : FORT.S + 2.4).translate(sx * h, y, sz * h));
  return mergeGeos(L);
})();
const CRANE_GEO = { mast: mergeGeos([new T.BoxGeometry(1.1, 30, 1.1).translate(0, 15, 0), new T.BoxGeometry(2.6, 1.6, 2.6).translate(0, 30, 0)]), jib: mergeGeos([new T.BoxGeometry(26, 0.9, 0.9).translate(7, 0, 0), new T.BoxGeometry(3, 2, 2).translate(-6.5, -0.6, 0), new T.CylinderGeometry(0.04, 0.04, 14, 4).translate(16, -7, 0)]) };
/* ---------- the robots (instanced: two draw calls for every worker on the map) ---------- */
const ROBO_N = 36; /* the Builder Guild's whole workforce: fortress crews, rebuild crews and the battle works (worksite.js) */
const ROBO = (() => {
  const body = mergeGeos([xf(rbox(0.75, 0.9, 0.5, 0.12, 2), [0, 1.35, 0]), new T.BoxGeometry(0.5, 0.42, 0.45).translate(0, 2.05, 0), new T.BoxGeometry(0.22, 0.85, 0.24).translate(-0.2, 0.45, 0), new T.BoxGeometry(0.22, 0.85, 0.24).translate(0.2, 0.45, 0),
    new T.BoxGeometry(0.16, 0.75, 0.16).translate(-0.5, 1.3, 0.12), new T.BoxGeometry(0.16, 0.75, 0.16).translate(0.5, 1.3, 0.12), new T.BoxGeometry(0.55, 0.6, 0.3).translate(0, 1.45, -0.38), new T.CylinderGeometry(0.03, 0.03, 0.5, 4).translate(0.16, 2.5, -0.1)]);
  const glow = mergeGeos([new T.BoxGeometry(0.38, 0.1, 0.06).translate(0, 2.1, 0.24), new T.BoxGeometry(0.1, 0.1, 0.1).translate(0.16, 2.78, -0.1), new T.BoxGeometry(0.18, 0.08, 0.32).translate(0.5, 0.92, 0.2)]);
  const mb = new T.InstancedMesh(body, std(0xc89c22, 0.5, 0.55, { normalMap: TEX.armor.normal }), ROBO_N), mg = new T.InstancedMesh(glow, basic(new T.Color(3.2, 2.4, 0.6)), ROBO_N);
  mb.castShadow = true; mb.frustumCulled = false; mg.frustumCulled = false; _m.makeScale(0, 0, 0); for (let i = 0; i < ROBO_N; i++) { mb.setMatrixAt(i, _m); mg.setMatrixAt(i, _m); }
  scene.add(mb); scene.add(mg); return { mb, mg };
})();
/* ---------- sites: next to every post, village, landmark and trench line ---------- */
function siteSpot(x, z, r0) {
  for (let i = 0; i < 90; i++) {
    const r = r0 + i * 2.2, a = i * 2.4 + x * 0.01, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, h = FORT.S / 2 + 3;
    if (Math.abs(px) > BOUND - 40 || Math.abs(pz) > BOUND - 40 || Math.hypot(px, pz) < 120) continue;
    if (!coverFree(px, pz, h) || trenchD(px, pz) < h + 8 || riverD(px, pz) < h + 14) continue;
    const c = [H(px - h, pz - h), H(px + h, pz - h), H(px - h, pz + h), H(px + h, pz + h), H(px, pz)]; if (Math.min(...c) < 1.6 || Math.max(...c) - Math.min(...c) > 3.2) continue;
    if (CPS.some(p => Math.hypot(p.x - px, p.z - pz) < h + 12) || BLD.sites.some(s => Math.hypot(s.x - px, s.z - pz) < 70) || TOWERS.some(t => Math.hypot(t.x - px, t.z - pz) < h + 8)) continue;
    return { x: px, z: pz, gy: Math.min(...c) - 0.2 };
  }
  return null;
}
function addSite(name, kind, x, z, r0) { const same = BLD.sites.filter(q => q.name.startsWith(name)).length; if (same) name += ['', ' north', ' south', ' east'][same] || ` ${same + 1}`; const p = siteSpot(x, z, r0); if (!p) return; BLD.sites.push({ name, kind, x: p.x, z: p.z, gy: p.gy, state: 'idle', prog: 0, hp: 2600, crew: [], g: null, razedM: null, yaw: (Math.round(Math.random() * 4)) * Math.PI / 2 }); }
(function planSites() {
  for (const c of CPS) if (!c.realm || c.realm === 'land') addSite(c.name, 'post', c.x, c.z, 34);
  VILLAGES.forEach((v, i) => addSite(i === 0 ? 'Hollow Creek' : `${nearestPostName(v)} ${v.farm ? 'farmstead' : 'village'}`, 'village', v.x, v.z, 40));
  for (const b of BUILDINGS) if (b.landmark && BLD.sites.length < 15) addSite(b.landmark.replace(/^(The|A) /, ''), 'landmark', b.x, b.z, Math.max(b.w, b.d) / 2 + 26);
  for (const P of TRENCHES) { const m = P[(P.length / 2) | 0]; if (m) addSite(`${nearestPostName({ x: m[0], z: m[1] })} trench line`, 'battleground', m[0], m[1], 30); }
})();
/* ---------- site visuals ---------- */
function siteModel(s) {
  const g = new T.Group(); g.position.set(s.x, s.gy, s.z); g.rotation.y = s.yaw;
  const shell = new T.Group(); bakeInto(shell, FORT_GEO, FORT_M, ['conc']); g.add(shell); s.shell = shell; shell.scale.y = 0.02;
  s.scaf = new T.Mesh(SCAF_GEO, FORT_M.scaf); g.add(s.scaf);
  const crane = new T.Group(); crane.position.set(FORT.S / 2 + 5, 0, -FORT.S / 2 + 2); const mast = new T.Mesh(CRANE_GEO.mast, FORT_M.hazard); mast.castShadow = true; crane.add(mast);
  s.jib = new T.Mesh(CRANE_GEO.jib, FORT_M.hazard); s.jib.position.y = 29; crane.add(s.jib); g.add(crane); s.crane = crane;
  scene.add(g); s.g = g;
}
function siteVisual(s) {
  if (!s.g) siteModel(s);
  const k = s.prog, rise = clamp((k - 0.08) / 0.92, 0, 1); s.shell.scale.y = Math.max(0.03, k < 0.08 ? k / 0.08 * 0.15 : 0.15 + rise * 0.85); s.shell.position.y = 0;
  s.scaf.scale.y = clamp(0.3 + rise * 0.8, 0.3, 1);
}
/* ---------- completed fortress: real walls, towers you can climb, cover for every army ---------- */
function fortTower(x, z, cx, cz, gy) { /* a gun tower: a deck on top and a vertical zipline from the courtyard (zips.js) */
  const top = gy + 9, deck = { x: cx, z: cz, y: top, r: 3.2 }; DECKS.push(deck);
  zipVertical(new V3(x, groundY(x, z), z), new V3(x, top + 2.6, z), new V3(cx, top, cz), null);
}
function fortRect(s, lx, lz, w, d, h) { /* local (yawed) box → world AABB Building + a cover point */
  const c = Math.cos(s.yaw), sn = Math.sin(s.yaw), x = s.x + lx * c + lz * sn, z = s.z - lx * sn + lz * c, turn = Math.abs(sn) > 0.5, W = turn ? d : w, D = turn ? w : d;
  const B = new Building(x, z, W, D, h, { mesh: new T.Group(), hp: 1e9 }); B.cover = true; B.fort = s; B.gy = s.gy - 0.6; B.top = s.gy + h; BUILDINGS.push(B);
  if (h < 3) { const cv = { x, z, hw: W / 2, hd: D / 2, r: Math.max(W, D) / 2 }; COVER.push(cv); const key = cgk(x, z); if (!COVER_GRID.has(key)) COVER_GRID.set(key, []); COVER_GRID.get(key).push(cv); }
  return B;
}
function completeFort(s) {
  s.state = 'done'; s.prog = 1; siteVisual(s); s.shell.scale.y = 1; s.g.remove(s.scaf); s.g.remove(s.crane); s.scaf = s.crane = null;
  const h = FORT.S / 2, c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { fortRect(s, sx * (h - 3), sz * (h - 3), 6, 6, 9); const lx = sx * (h - 3) - sx * 3.9, lz = sz * (h - 3) - sz * 3.9; const tx = sx * (h - 3), tz = sz * (h - 3); fortTower(s.x + lx * c + lz * sn, s.z - lx * sn + lz * c, s.x + tx * c + tz * sn, s.z - tx * sn + tz * c, s.gy); }
  for (let side = 0; side < 4; side++) for (const half of [-1, 1]) { const a = side * Math.PI / 2, mid = half * 7.5, lx0 = mid, lz0 = h - 0.8, lx = lx0 * Math.cos(a) + lz0 * Math.sin(a), lz = -lx0 * Math.sin(a) + lz0 * Math.cos(a); fortRect(s, lx, lz, side % 2 ? 1.6 : 9, side % 2 ? 9 : 1.6, 1.7); }
  fortRect(s, 0, 0, 10, 10, 6);
  B_GRID.n = -1; for (const w of s.crew) w.state = 'leave';
  const p = new V3(s.x, s.gy + 6, s.z); fxDust(p, 30, 14, 14); flashLight(p, 14, 140, 0.8, 0xffc040); snd('big', p, 0.8);
  banner(`Fortress complete · ${s.name}`, 'Walls to fight behind, gun towers with ziplines. Nearly indestructible, open to every army.', 'var(--amber)');
  comms('Builder Guild', `Fortress at ${s.name} is finished. It belongs to whoever holds it.`, 'cmd');
}
function razeSite(s, src) {
  s.state = 'razed'; const p = new V3(s.x, s.gy + 2, s.z);
  for (let i = 0; i < 5; i++) setTimeout(() => { const q = p.clone().add(new V3(rand(-14, 14), rand(0, 5), rand(-14, 14))); fxExplosion(q, 1.6); fxDust(q, 10, 8, 8); }, i * 160);
  shake(0.8, p); snd('big', p, 1); spawnDebris(p, 10, 14, 1.2);
  if (s.g) { scene.remove(s.g); s.g = null; }
  const r = new T.Mesh(new T.DodecahedronGeometry(1, 0), rubbleMat); r.scale.set(FORT.S * 0.42, 3 + s.prog * 4, FORT.S * 0.42); r.position.set(s.x, s.gy + 0.6, s.z); r.receiveShadow = true; r.castShadow = true; scene.add(r); s.razedM = r; addEmitter(p, 3.2, 60);
  for (const w of s.crew) if (w.state !== 'dead') w.state = 'leave';
  const left = BLD.sites.filter(q => q.state !== 'razed').length, who = src && src.isPlayer ? 'You razed' : 'Shelling razed';
  banner(`${s.name} construction razed`, `${who} the Builder Guild's fortress · one less place to fight · ${left} sites left this war`, '#ff6a4a');
  comms('Builder Guild', `Our ${s.name} site is gone. We will not build there again this war.`, 'cmd');
}
/* ---------- crews ---------- */
function newRobot(site, from) { const i = BLD.W.findIndex(w => !w || w.state === 'gone'); if (i < 0 && BLD.W.length >= ROBO_N) return null; const w = { i: i < 0 ? BLD.W.length : i, pos: from.clone(), yaw: 0, state: 'walk', site, slot: Math.random() * 6.283, t: rand(0, 1), beamT: rand(0, 1), ph: Math.random() * 6 }; BLD.W[w.i] = w; return w; }
function sendCrew(target, n) { /* a crew of robots walks in from 70 m out */
  const a = Math.random() * 6.283, from = landNear(target.x + Math.cos(a) * 70, target.z + Math.sin(a) * 70, 10); const crew = [];
  for (let k = 0; k < n; k++) { const w = newRobot(target, from.clone().add(new V3(rand(-4, 4), 0, rand(-4, 4)))); if (w) crew.push(w); }
  return crew;
}
function startSite(s, why) {
  if (s.state === 'idle') { s.state = 'build'; siteVisual(s); }
  const need = 4 - s.crew.filter(w => w.state !== 'dead' && w.state !== 'gone' && w.state !== 'leave').length; if (need > 0) s.crew.push(...sendCrew(s, need));
  if (why) comms('Builder Guild', why, 'cmd');
}
function rebuildJob(ev) { /* clear the rubble of a fallen building near the disaster (deconstruction), then raise it again, stronger */
  const p = ev && ev.p ? ev.p : (PLAYER.ent ? PLAYER.ent.pos : camera.position); let best = null, bd = 520;
  for (const b of BUILDINGS) if (!b.alive && b.rubble && !b.cover && !b.fort && !BLD.jobs.some(j => j.b === b)) { const d = Math.hypot(b.x - p.x, b.z - p.z); if (d < bd) { bd = d; best = b; } }
  if (!best) return; const j = { b: best, x: best.x, z: best.z, phase: 'clear', t: 0, rs: best.rubble.scale.clone(), crew: [] }; j.crew = sendCrew(j, 3); BLD.jobs.push(j);
  comms('Builder Guild', `Crew clearing the ruins of ${best.landmark || 'a fallen block near ' + nearestPostName(best)} to raise it again.`, 'cmd');
}
function crewAt(list, x, z, r) { let n = 0; for (const w of list) if (w.state === 'work' && Math.hypot(w.pos.x - x, w.pos.z - z) < r) n++; return n; }
/* ---------- explosions hurt sites and robots ---------- */
const _bldExplode = explodeDamage;
explodeDamage = function (p, radius, dmg, src, team, skip) {
  _bldExplode(p, radius, dmg, src, team, skip);
  /* The Guild are people, and the Hero does not kill people. His blasts go through their sites and their crews
     without touching either; the Villains are under no such rule. */
  const heroBlast = src && (src.isPlayer || src.team === 1);
  if (heroBlast) return;
  for (const s of BLD.sites) {
    if (s.state !== 'build' || s.prog < 0.02 || Math.abs(p.y - s.gy) > 40) continue; const d = Math.hypot(p.x - s.x, p.z - s.z) - FORT.S / 2; if (d > radius + 2) continue;
    const k = Math.min(1, 1 - Math.max(0, d) / (radius + 2)); s.hp -= dmg * k * 1.4; s.prog = Math.max(0.02, s.prog - 0.006 * k * dmg / 100); s.hurtT = 1;
    if (src && src.isPlayer && TIME - (s.warnT || 0) > 20) { s.warnT = TIME; comms('Builder Guild', `Commander, you are hitting our ${s.name} site. Keep that up and there will be nothing left to fight over.`, 'cmd'); }
    if (s.hp <= 0) razeSite(s, src);
  }
  for (const w of BLD.W) if (w && (w.state === 'walk' || w.state === 'work' || w.state === 'huddle' || w.state === 'leave') && Math.hypot(w.pos.x - p.x, w.pos.z - p.z) < radius + 0.8 && Math.abs(w.pos.y + 1 - p.y) < radius + 2) {
    w.state = 'dead'; w.t = 0; fxSparks(_v3.set(w.pos.x, w.pos.y + 1.4, w.pos.z), 24, [3, 2.2, 0.6], 14); spawnDebris(w.pos, 3, 5, 0.25);
    if (typeof POOL !== 'undefined') { POOL.lost += 10; if (typeof poolChip === 'function') poolChip('−10 Guild crew killed', 'r'); } /* the Guild are people too */
  }
};
/* ---------- the near-site hint ---------- */
const _bldHint = mountHint;
mountHint = function (pe) {
  const h = _bldHint(pe); if (pe.kind !== 'soldier' || pe.mount) return h;
  if (h) return h;
  for (const s of BLD.sites) { const d = Math.hypot(pe.pos.x - s.x, pe.pos.z - s.z); if (d > FORT.S / 2 + 18) continue;
    if (s.state === 'build') return `Builder Guild site · ${s.name} fortress ${Math.round(s.prog * 100)}% · leave it be and it becomes a fortress for everyone · explosives will raze it`;
    if (s.state === 'razed') return `${s.name} · razed construction site`; }
  return null;
};
/* ---------- war resets: razed ground is cleared for the next war (finished fortresses stand) ---------- */
const _bldNewWar = newWar;
newWar = function () {
  _bldNewWar.apply(this, arguments);
  for (const s of BLD.sites) if (s.state === 'razed') { if (s.razedM) { scene.remove(s.razedM); s.razedM = null; } s.state = 'idle'; s.prog = 0; s.hp = 2600; s.crew = []; }
  BLD.sendT = 15;
};
/* ---------- minimap ---------- */
function drawBuildSites(ctx, W2M) {
  for (const s of BLD.sites) {
    if (s.state === 'idle') continue; const x = W2M(s.x), y = W2M(s.z);
    if (s.state === 'done') { ctx.fillStyle = '#d9a91e'; ctx.fillRect(x - 4, y - 4, 8, 8); ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x - 2, y - 2, 4, 4); }
    else if (s.state === 'build') { ctx.strokeStyle = '#d9a91e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 4.5, -Math.PI / 2, -Math.PI / 2 + s.prog * 6.283); ctx.stroke(); }
    else { ctx.strokeStyle = '#ff6a4a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 3, y + 3); ctx.moveTo(x + 3, y - 3); ctx.lineTo(x - 3, y + 3); ctx.stroke(); }
  }
}
/* ---------- per frame ---------- */
const _rq = new T.Quaternion(), _rp = new V3(), _rs = new V3();
function stormNear(x, z) { const e = NATURE.ev; if (!e) return false; if (!e.p) return ['hurricane', 'blizzard', 'storm'].includes(e.key); return Math.hypot(e.p.x - x, e.p.z - z) < 300; }
function updateBuilders(dt) {
  if (GAME.state === 'end' || GAME.state === 'showcase') return;
  const ev = NATURE.ev; /* a disaster just passed: crews surge back to work, a rebuild crew heads for the ruins */
  if (BLD.lastEv && !ev) { const p = BLD.lastEv.p; BLD.surge = 60; rebuildJob(BLD.lastEv);
    let best = null, bd = 1e9; for (const s of BLD.sites) if (s.state === 'idle' || s.state === 'build') { const d = p ? Math.hypot(s.x - p.x, s.z - p.z) : Math.random() * 500; if (d < bd) { bd = d; best = s; } }
    if (best) startSite(best, `Storm's passed. Crews moving on ${best.name}, building double time.`); }
  BLD.lastEv = ev;
  if ((BLD.rebT -= dt) <= 0) { BLD.rebT = rand(70, 110); if (BLD.jobs.length < 2) rebuildJob(null); } /* crews also tour the ruins between storms */
  const wx = WEATHER.state === 'snow' ? 0.6 : WEATHER.state === 'rain' ? 0.75 : 1.15, night = skyU.night && skyU.night.value > 0.5 ? 0.85 : 1, surge = BLD.surge > 0 ? 1.6 : 1; BLD.surge -= dt;
  /* Dispatch. The Guild are not fools: they do not raise a fortress on a street that is still standing, and they do
     not walk into a firefight. A site has to be wrecked enough to be worth rebuilding and quiet enough to work in. */
  if ((BLD.sendT -= dt) <= 0) {
    BLD.sendT = rand(40, 65); const act = BLD.sites.filter(s => s.state === 'build').length;
    if (act < 3) {
      const c = PLAYER.ent ? PLAYER.ent.pos : camera.position;
      const ruined = s => { let n = 0, dead = 0; for (const b of bldNear(s.x, s.z, 90, [])) { if (b.cover || b.hp > 1e8) continue; n++; if (!b.alive || b.hp < b.maxHp * 0.55) dead++; } return n ? dead / n : 0; };
      const quiet = s => { for (const e of ENTS) if (e.alive && e.team === 2 && e.kind === 'soldier' && Math.hypot(e.pos.x - s.x, e.pos.z - s.z) < 70) return false; return true; };
      const idle = BLD.sites.filter(s => s.state === 'idle' && quiet(s) && ruined(s) > 0.34)
        .sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z));
      if (idle.length) startSite(idle[Math.random() < 0.7 ? 0 : (Math.random() * idle.length) | 0], null);
    }
  }
  /* sites */
  for (const s of BLD.sites) {
    if (s.state !== 'build') continue;
    s.crew = s.crew.filter(w => w.state !== 'gone'); const live = s.crew.filter(w => w.state !== 'dead' && w.state !== 'leave');
    if (live.length < 2 && !(s.reqT > TIME)) { s.reqT = TIME + 20; s.crew.push(...sendCrew(s, 4 - live.length)); }
    const storm = stormNear(s.x, s.z), n = crewAt(s.crew, s.x, s.z, FORT.S);
    if (storm) { /* strip the unfinished course and huddle */
      const floor = Math.floor(s.prog * 5) / 5; if (n) s.prog = Math.max(floor, s.prog - dt * 0.004 * n);
      if (TIME - BLD.stripSaid > 40 && n && camera.position.distanceTo(_v1.set(s.x, s.gy, s.z)) < 700) { BLD.stripSaid = TIME; comms('Builder Guild', `Weather's turning. Crews stripping the scaffold at ${s.name} and taking shelter.`, 'cmd'); }
    } else { s.prog += dt * n / 4 / 170 * wx * night * surge; s.hp = Math.min(2600, s.hp + dt * 6 * n); }
    if (s.jib) s.jib.rotation.y += dt * (storm ? 0 : 0.18);
    if (s.hp < 1300 && Math.random() < dt * 0.6) addEmitter(new V3(s.x + rand(-12, 12), s.gy + 3, s.z + rand(-12, 12)), 1.4, 8);
    siteVisual(s); if (s.prog >= 1) completeFort(s);
  }
  /* rebuild jobs: deconstruct the rubble, then raise the building back out of the ground */
  for (let i = BLD.jobs.length - 1; i >= 0; i--) {
    const j = BLD.jobs[i], b = j.b; j.crew = j.crew.filter(w => w.state !== 'gone');
    if (b.alive || !j.crew.some(w => w.state !== 'dead')) { if (!b.alive && j.phase === 'raise') { scene.remove(b.mesh); } for (const w of j.crew) if (w.state !== 'dead') w.state = 'leave'; BLD.jobs.splice(i, 1); continue; }
    const n = crewAt(j.crew, j.x, j.z, Math.max(b.w, b.d) / 2 + 14); if (!n) continue; j.t += dt * n / 3 * wx;
    if (j.phase === 'clear') { const k = Math.max(0.05, 1 - j.t / 16); if (b.rubble) b.rubble.scale.set(j.rs.x * k, j.rs.y * k, j.rs.z * k); if (j.t >= 16) { if (b.rubble) scene.remove(b.rubble); b.rubble = null; j.phase = 'raise'; j.t = 0; b.mesh.quaternion.identity(); b.mesh.rotation.set(0, 0, 0); scene.add(b.mesh); } }
    else { const k = Math.min(1, j.t / 30); b.mesh.position.set(b.x, b.gy - b.h * (1 - k), b.z); if (k >= 1) { b.maxHp *= 1.5; b.restore(); for (const w of j.crew) if (w.state !== 'dead') w.state = 'leave'; comms('Builder Guild', `${b.landmark || 'The block near ' + nearestPostName(b)} is back up, reinforced.`, 'cmd'); BLD.jobs.splice(i, 1); } }
  }
  /* robots: walk in, work the perimeter, huddle in storms, leave when done; render through the instanced meshes */
  const cam = camera.position; let dirty = false;
  for (const w of BLD.W) {
    if (!w || w.state === 'gone') continue; dirty = true; if (w.ws) continue; /* battle-works robots run in worksite.js */
    const S = w.site; w.t += dt;
    if (w.state === 'dead') { if (w.t > 2.5) w.state = 'gone'; }
    else if (w.state === 'leave') { const dx = w.pos.x - S.x, dz = w.pos.z - S.z, l = Math.hypot(dx, dz) || 1; w.pos.x += dx / l * 4.5 * dt; w.pos.z += dz / l * 4.5 * dt; w.yaw = Math.atan2(dx, dz); if (l > 80) w.state = 'gone'; }
    else {
      const fort = S.kind !== undefined, R = fort ? FORT.S / 2 + 2.5 : Math.max(S.b.w, S.b.d) / 2 + 3, storm = fort && stormNear(S.x, S.z);
      const tx = storm ? S.x + Math.cos(w.slot) * 6 : S.x + Math.cos(w.slot) * R, tz = storm ? S.z + Math.sin(w.slot) * 6 : S.z + Math.sin(w.slot) * R, dx = tx - w.pos.x, dz = tz - w.pos.z, d = Math.hypot(dx, dz);
      if (d > 1.2) { const sp = w.state === 'walk' ? 5 : 2.4; w.pos.x += dx / d * Math.min(d, sp * dt); w.pos.z += dz / d * Math.min(d, sp * dt); w.yaw = Math.atan2(dx, dz); if (d > 6) w.state = 'walk'; }
      else { w.state = storm ? 'huddle' : 'work'; w.yaw = Math.atan2(S.x - w.pos.x, S.z - w.pos.z); if (!storm && (w.slotT = (w.slotT || rand(5, 10)) - dt) <= 0) { w.slotT = rand(5, 10); w.slot += rand(-0.7, 0.7); } }
      if (w.state === 'work' && (w.beamT -= dt) <= 0) { w.beamT = rand(0.5, 1.1); /* welding beams and sparks while they build */
        if (cam.distanceTo(w.pos) < 320) { const ht = fort ? 0.5 + (S.prog || 0) * 7 : rand(1, 6), q = _v2.set(w.pos.x + Math.sin(w.yaw) * 2.2, w.pos.y + ht, w.pos.z + Math.cos(w.yaw) * 2.2); beam(_v3.set(w.pos.x + Math.sin(w.yaw) * 0.5, w.pos.y + 1, w.pos.z + Math.cos(w.yaw) * 0.5), q, 0.08, 0.18, 0xffc040); fxSparks(q, 6, [3, 2.2, 0.7], 6); if (Math.random() < 0.3) snd('stomp', q, 0.15); } }
    }
    if (w.state !== 'dead') w.pos.y = groundY(w.pos.x, w.pos.z);
  }
  if (!dirty) return;
  for (let i = 0; i < ROBO_N; i++) {
    const w = BLD.W[i];
    if (!w || w.state === 'gone' || cam.distanceTo(w.pos) > 700) { _m.makeScale(0, 0, 0); }
    else {
      const walk = w.state === 'walk' || w.state === 'leave', bob = w.state === 'dead' ? -Math.min(1, w.t) * 1.2 : walk ? Math.abs(Math.sin(w.t * 9 + w.ph)) * 0.12 : w.state === 'work' ? Math.abs(Math.sin(w.t * 5 + w.ph)) * 0.06 : 0;
      _rq.setFromAxisAngle(UP, w.yaw + (w.state === 'work' ? Math.sin(w.t * 2 + w.ph) * 0.25 : 0)); const sc = w.state === 'huddle' ? 0.85 : 1;
      _m.compose(_rp.set(w.pos.x, w.pos.y + bob, w.pos.z), _rq, _rs.set(sc, w.state === 'dead' ? Math.max(0.2, 1 - w.t * 0.5) : sc, sc));
    }
    ROBO.mb.setMatrixAt(i, _m); ROBO.mg.setMatrixAt(i, _m);
  }
  ROBO.mb.instanceMatrix.needsUpdate = true; ROBO.mg.instanceMatrix.needsUpdate = true;
}
