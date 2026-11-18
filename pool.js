'use strict';
/* ===================== IRON MERIDIAN · the people of Aeris Island: the only thing worth fighting over ===================== */
// Ten thousand civilians are spread across the districts. Heroes win by getting 4,000 of them out alive; Villains win
// by killing 6,000. Nothing else ends the war.
//  · INSIDE      · every district holds its share. Sheltered people are a number, not figures, until something happens to them.
//  · BLEED       · a district the Villains hold bleeds 60 people a minute. Its people spill out into the open as a
//                  huddle you can see, and one dies with every tick until the Heroes retake it or it empties.
//  · CONVOY      · at a district the Heroes hold, muster a hundred people (hold E). They walk a lane to an evacuation
//                  gate, but only while a Hero is close and the Villains near them are outnumbered. Every figure that
//                  reaches the gate is ten people banked.
//  · DOWNED      · a shot figure has ten seconds on the ground. A Hero takes two seconds to get them up, a Villain one
//                  to finish them. Whoever is closer wins that little duel.
//  · CATASTROPHE · Villains earn a charge every few minutes and can detonate a breached district: 250 people at once,
//                  telegraphed for thirty seconds so the Heroes can run it down and defuse it.
//  · RAID        · one button (K) calls a raid on a district. A beacon goes up, both sides are warned, and everyone
//                  converges. The district worth raiding is simply the one with the most people left to save or kill.
const POOL = {
  START: 10000, WIN_E: 4000, WIN_L: 6000, PER: 10,
  evac: 0, lost: 0, esc: 1, figs: [], convoys: [], gates: [], raid: null,
  t: 0, bleedT: 0, catT: 120, focusT: 8, scanT: 0, hudT: 0, el: null, cat: null, charge: 0, chargeT: 150,
  hist: [], rateE: 0, rateL: 0, saidT: 0, mustT: 0, over: false,
};
const _pe = new T.Euler(); let POOL_SWEEP = false; /* reused rotation, and a flag so the lists are only rebuilt when something actually left */
const CIV_MAX = 70, CONVOY_MAX = 5, CONVOY_FIGS = 10, ESCORT_N = 4;
/* ---------- the figures: one instanced crowd for every civilian you can see ---------- */
const CIVM = (() => {
  const g = mergeGeos([
    new T.CylinderGeometry(0.17, 0.2, 0.78, 7).translate(0, 0.39, 0),
    new T.CylinderGeometry(0.24, 0.19, 0.72, 9).translate(0, 1.12, 0),
    new T.SphereGeometry(0.21, 10, 8).translate(0, 1.66, 0),
    new T.BoxGeometry(0.1, 0.5, 0.1).translate(-0.27, 1.15, 0.04), new T.BoxGeometry(0.1, 0.5, 0.1).translate(0.27, 1.15, 0.04),
  ]);
  const m = new T.InstancedMesh(g, std(0xffffff, 0.85, 0, { vertexColors: false }), CIV_MAX);
  m.count = 0; m.castShadow = true; m.frustumCulled = false; m.instanceColor = null; scene.add(m);
  const col = new T.InstancedBufferAttribute(new Float32Array(CIV_MAX * 3).fill(1), 3); m.instanceColor = col;
  return m;
})();
const CIV_COL = { walk: [0.92, 0.9, 0.84], cower: [0.8, 0.78, 0.72], exposed: [1.0, 0.45, 0.4], down: [1.0, 0.8, 0.25], saved: [0.5, 1.4, 2.4] };
function civFig(x, z, state, home) {
  if (POOL.figs.length >= CIV_MAX) return null;
  const f = { pos: new V3(x, groundY(x, z), z), state, hp: 100, downT: 0, slot: 0, cv: null, home, yaw: rand(0, 6.28), ph: rand(0, 6.28), fade: 0 };
  POOL.figs.push(f); return f;
}
/* ---------- evacuation gates: where a convoy is safe ---------- */
(function gates() {
  const spots = [[HQ[1].x, HQ[1].z - 70, 'South Gate'], [DIST('dam').x - 70, DIST('dam').z + 40, 'Harbour Gate'], [DIST('rail').x - 60, DIST('rail').z + 60, 'Rail Gate']];
  for (const [x, z, name] of spots) {
    const p = new V3(x, 0, z); pushOut(p, 6); p.y = groundY(p.x, p.z);
    const g = new T.Group(); g.position.copy(p); scene.add(g);
    g.add(new T.Mesh(new T.TorusGeometry(5.2, 0.22, 8, 36).rotateX(Math.PI / 2), basic(new T.Color(0.5, 1.6, 3.2))));
    for (const sx of [-1, 1]) g.add(new T.Mesh(new T.BoxGeometry(0.9, 7, 0.9).translate(sx * 5, 3.5, 0), std(0x33404c, 0.6, 0.4)));
    g.add(new T.Mesh(new T.BoxGeometry(11, 1.1, 1.1).translate(0, 7.2, 0), std(0x33404c, 0.6, 0.4)));
    const beam = new T.Mesh(new T.CylinderGeometry(4.6, 4.6, 46, 14, 1, true).translate(0, 23, 0), basic(new T.Color(0.3, 1.0, 2.2), { transparent: true, opacity: 0.12, depthWrite: false, side: T.DoubleSide }));
    beam.castShadow = false; g.add(beam);
    POOL.gates.push({ pos: p, name, g });
  }
})();
const nearestGate = p => POOL.gates.reduce((b, g) => g.pos.distanceToSquared(p) < b.pos.distanceToSquared(p) ? g : b, POOL.gates[0]);
/* ---------- the people you are here for ---------- */
// Ten thousand is a number on a bar. These are the ones you can see: residents standing in the doorways of their own
// district. They shuffle and talk while it is quiet, they crouch when shooting starts nearby, they wave you down when
// you land among them, they fall in behind a convoy that musters on their street, and when the Villains have the
// district they break and run for the nearest gate. As a district's count bleeds out, its streets empty with it.
const RES_MAX = 120, RES_SIM = 46;
const RESM = (() => {
  const m = new T.InstancedMesh(CIVM.geometry, CIVM.material, RES_MAX);
  m.count = 0; m.castShadow = true; m.frustumCulled = false;
  m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(RES_MAX * 3).fill(1), 3); scene.add(m); return m;
})();
const RES = [], RES_COL = { idle: [0.86, 0.84, 0.78], talk: [0.9, 0.88, 0.8], duck: [0.78, 0.76, 0.7], wave: [0.6, 1.2, 2.0], run: [1.0, 0.72, 0.4] };
(function seedResidents() {
  for (const cp of CPS) {
    for (let i = 0; i < 13 && RES.length < RES_MAX; i++) {
      const a = Math.random() * 6.283, r = rand(10, 52), x = cp.x + Math.cos(a) * r, z = cp.z + Math.sin(a) * r;
      if (H(x, z) < 1.2) continue;
      const p = new V3(x, 0, z); pushOut(p, 1.2); p.y = surfY(p.x, p.z, cp.pos.y + 2);
      RES.push({ pos: p, home: cp, anchor: p.clone(), yaw: rand(0, 6.283), ph: rand(0, 6.283), state: 'idle', t: rand(0, 4), gone: 0 });
    }
  }
})();
function resRun(R) { /* break for the nearest gate */
  if (R.state === 'run') return; R.state = 'run'; R.gate = nearestGate(R.pos); R.t = rand(0, 0.4);
}
function updateResidents(dt) {
  const cam = camera.position, pe = PLAYER.ent;
  RESM.count = 0; let drawn = 0, simmed = 0;
  for (let i = 0; i < RES.length; i++) {
    const R = RES[(i + (FRAMEN % 2) * 0) % RES.length];
    const d2 = cam.distanceToSquared(R.pos);
    if (R.home.pop <= 0 && R.gone < 1) R.gone = Math.min(1, R.gone + dt * 0.5); /* the street empties as the count does */
    if (R.gone >= 1 || d2 > 160000) continue;
    if (simmed < RES_SIM) { /* the near ones think; the far ones just stand */
      simmed++;
      R.t -= dt;
      /* people under Villain rule stay put and keep their heads down — that is what makes them easy to kill. They
         only break and run when something is about to go off, or when the fighting reaches their street. */
      const danger = ((POOL.cat && POOL.cat.cp === R.home) || R.home.contested) ? 1 : 0;
      const hero = pe && pe.alive ? Math.hypot(pe.pos.x - R.pos.x, pe.pos.z - R.pos.z) : 1e9;
      if (danger && R.state !== 'run' && Math.random() < dt * 0.25) resRun(R);
      if (R.state === 'run') {
        const g = R.gate || nearestGate(R.pos), dx = g.pos.x - R.pos.x, dz = g.pos.z - R.pos.z, d = Math.hypot(dx, dz) || 1;
        if (d < 7) { R.gone = 1; continue; } /* they got themselves out; the count on the bar is the convoys' work, not theirs */
        R.pos.x += dx / d * 4.4 * dt; R.pos.z += dz / d * 4.4 * dt; R.pos.y = surfY(R.pos.x, R.pos.z, R.pos.y + 1); R.yaw = Math.atan2(dx, dz);
      } else {
        const cv = POOL.convoys.find(c => c.live && c.cp === R.home && c.pos.distanceToSquared(R.pos) < 2500);
        if (cv) { /* fall in behind the convoy on their own street */
          const dx = cv.pos.x - R.pos.x, dz = cv.pos.z - R.pos.z, d = Math.hypot(dx, dz) || 1;
          if (d > 6) { R.pos.x += dx / d * 3.4 * dt; R.pos.z += dz / d * 3.4 * dt; R.pos.y = surfY(R.pos.x, R.pos.z, R.pos.y + 1); }
          R.yaw = Math.atan2(dx, dz); R.state = 'run';
        } else if (MOB.supp > 0.2 || R.home.owner === 2 || (R.home.contested && Math.random() < dt)) R.state = 'duck';
        else if (hero < 11) { R.state = 'wave'; R.yaw = Math.atan2(pe.pos.x - R.pos.x, pe.pos.z - R.pos.z); }
        else if (R.t <= 0) { R.t = rand(2.5, 7); R.state = Math.random() < 0.4 ? 'talk' : 'idle'; R.yaw += rand(-1.6, 1.6);
          const ax = R.anchor.x + rand(-2.5, 2.5), az = R.anchor.z + rand(-2.5, 2.5); R.pos.x = lerp(R.pos.x, ax, 0.5); R.pos.z = lerp(R.pos.z, az, 0.5); R.pos.y = surfY(R.pos.x, R.pos.z, R.pos.y + 1); }
      }
    }
    if (drawn >= RES_MAX) continue;
    const c = RES_COL[R.state] || RES_COL.idle, sc = 1 - R.gone;
    const bob = R.state === 'run' ? Math.abs(Math.sin(TIME * 8 + R.ph)) * 0.09 : R.state === 'wave' ? Math.abs(Math.sin(TIME * 4 + R.ph)) * 0.05 : Math.sin(TIME * 1.3 + R.ph) * 0.015;
    _q.setFromAxisAngle(UP, R.yaw);
    _m.compose(_v1.set(R.pos.x, R.pos.y + bob, R.pos.z), _q, _s.set(sc, R.state === 'duck' ? sc * 0.72 : sc, sc));
    RESM.setMatrixAt(drawn, _m); RESM.instanceColor.setXYZ(drawn, c[0], c[1], c[2]); drawn++;
  }
  RESM.count = drawn; RESM.instanceMatrix.needsUpdate = true; RESM.instanceColor.needsUpdate = true;
}
/* ---------- the districts hold the people ---------- */
function poolReset() {
  const per = Math.round(POOL.START / CPS.length / 10) * 10;
  for (const c of CPS) { c.pop = per; c.bleed = 0; c.expo = []; }
  for (const f of POOL.figs) f.state = 'gone'; POOL.figs.length = 0; POOL.convoys.length = 0;
  POOL.evac = 0; POOL.lost = 0; POOL.esc = 1; POOL.charge = 0; POOL.chargeT = 150; POOL.cat = null; POOL.raid = null; POOL.over = false; POOL.hist.length = 0; POOL.blasts = null;
  if (POOL.catM) { POOL.catM.visible = false; POOL.raidM.visible = false; }
}
poolReset();
const poolInside = () => CPS.reduce((n, c) => n + c.pop, 0) + POOL.figs.filter(f => f.state !== 'gone' && f.state !== 'saved').length * POOL.PER;
const districtHolder = c => c.owner;
const atRisk = c => c.pop * (districtHolder(c) === 2 ? 2.2 : districtHolder(c) === 1 ? 1 : 1.5);
/* ---------- mustering a convoy ---------- */
function laneTo(from, gate) { /* a short lane: a few points from the district out to the gate, nudged clear of walls */
  const pts = []; const n = 5;
  for (let i = 1; i <= n; i++) {
    const k = i / n, p = new V3(lerp(from.x, gate.pos.x, k), 0, lerp(from.z, gate.pos.z, k));
    pushOut(p, 3); p.y = groundY(p.x, p.z); pts.push(p);
  }
  return pts;
}
function muster(cp, by) {
  if (cp.pop < POOL.PER * 2 || POOL.convoys.filter(c => c.live).length >= CONVOY_MAX) return false;
  const want = Math.min(CONVOY_FIGS, Math.floor(cp.pop / POOL.PER), CIV_MAX - POOL.figs.length);
  if (want < 2) return false;
  const gate = nearestGate(cp.pos), cv = { cp, gate, lane: laneTo(cp.pos, gate), seg: 0, pos: cp.pos.clone(), figs: [], live: true, moving: false, t: 0 };
  cv.pos.y = surfY(cv.pos.x, cv.pos.z, cp.pos.y + 1);
  for (let i = 0; i < want; i++) {
    const f = civFig(cp.pos.x + rand(-4, 4), cp.pos.z + rand(-4, 4), 'walk', cp); if (!f) break;
    f.cv = cv; f.slot = i; cv.figs.push(f); cp.pop -= POOL.PER;
  }
  if (!cv.figs.length) return false;
  POOL.convoys.push(cv);
  if (by && by.isPlayer) { comms('You', `Convoy up at ${cp.name}. Walk them out to the ${gate.name}.`, 'b'); awardPoints(60, 'Convoy mustered'); }
  else if (camera.position.distanceTo(cp.pos) < 400) comms('Hero net', `Convoy mustered at ${cp.name} — ${cv.figs.length * POOL.PER} people moving to the ${gate.name}.`, 'b');
  snd('chime', cp.pos, 0.5);
  return true;
}
const SLOT = [[0, 0], [-1.4, -1.3], [1.4, -1.3], [-1.4, 1.3], [1.4, 1.3], [0, -2.6], [0, 2.6], [-2.8, 0], [2.8, 0], [0, -3.9]];
function poolConvoy(cv, dt) {
  if (!cv.live) return;
  cv.figs = cv.figs.filter(f => f.state === 'walk' || f.state === 'cower' || f.state === 'down');
  if (!cv.figs.length) { cv.live = false; for (const e of cv.esc || []) if (e.escortCv === cv) e.escortCv = null; return; }
  let h = 0, v = 0;
  for (const e of ENTS) { if (!e.alive || e.kind !== 'soldier' || e.downed) continue; const d = e.pos.distanceToSquared(cv.pos); if (d > 3600) continue; if (e.team === 1) h += e.isPlayer ? 3 : 1; else v++; }
  cv.moving = h > 0 && v <= h;
  if (cv.moving && cv.seg < cv.lane.length) {
    let step = 7 * dt;
    while (step > 0 && cv.seg < cv.lane.length) {
      const b = cv.lane[cv.seg], d = Math.hypot(b.x - cv.pos.x, b.z - cv.pos.z);
      if (d <= step) { cv.pos.copy(b); cv.seg++; step -= d; } else { cv.pos.x += (b.x - cv.pos.x) / d * step; cv.pos.z += (b.z - cv.pos.z) / d * step; step = 0; }
    }
    cv.pos.y = surfY(cv.pos.x, cv.pos.z, cv.pos.y + 1);
  }
  cv.esc = (cv.esc || []).filter(e => e.alive && !e.downed && e.escortCv === cv);
  for (let i = 0; i < cv.esc.length; i++) { /* the escort walks the lane with them, and fights from it */
    const e = cv.esc[i], a = i / cv.esc.length * 6.283;
    e.goal.set(cv.pos.x + Math.cos(a) * 5, 0, cv.pos.z + Math.sin(a) * 5); e.goalT = 3; e.goalCP = cv.cp; e.follow = false;
  }
  const yaw = cv.seg < cv.lane.length ? Math.atan2(cv.lane[cv.seg].x - cv.pos.x, cv.lane[cv.seg].z - cv.pos.z) : 0, cs = Math.cos(yaw), sn = Math.sin(yaw);
  for (const f of cv.figs) {
    if (f.state === 'down') continue;
    const [sx, sz] = SLOT[f.slot % SLOT.length], tx = cv.pos.x + sx * cs + sz * sn, tz = cv.pos.z - sx * sn + sz * cs;
    const dx = tx - f.pos.x, dz = tz - f.pos.z, d = Math.hypot(dx, dz);
    if (d > 0.1) { const sp = Math.min(d, (d > 7 ? 7 : 4.6) * dt); f.pos.x += dx / d * sp; f.pos.z += dz / d * sp; f.yaw = Math.atan2(dx, dz); }
    f.pos.y = surfY(f.pos.x, f.pos.z, f.pos.y + 1);
    f.state = cv.moving ? 'walk' : 'cower';
  }
  if (cv.seg >= cv.lane.length) { /* through the gate */
    let n = 0; for (const f of cv.figs) if (f.state !== 'down') { f.state = 'saved'; f.fade = 1; n++; }
    if (n) {
      POOL.evac += n * POOL.PER; warScore(1, n * 4, null); if (typeof contractProgress === 'function') contractProgress('evac', n * POOL.PER);
      flashLight(cv.gate.pos, 8, 60, 0.5, 0x5ccaff); snd('chime', cv.gate.pos, 0.9);
      poolChip(`+${n * POOL.PER} evacuated · ${cv.gate.name}`, 'b');
      if (camera.position.distanceTo(cv.gate.pos) < 500) comms('Hero net', `${n * POOL.PER} through the ${cv.gate.name}.`, 'b');
      awardPoints(n * 20, 'People evacuated');
    }
    cv.live = false;
  }
}
/* ---------- the bleed: a district the Villains hold loses people ---------- */
function exposedAt(cp) {
  cp.expo = (cp.expo || []).filter(f => f.state === 'exposed');
  while (cp.expo.length < 6 && cp.pop > POOL.PER && POOL.figs.length < CIV_MAX) {
    const a = rand(0, 6.28), r = rand(4, 11), f = civFig(cp.x + Math.cos(a) * r, cp.z + Math.sin(a) * r, 'exposed', cp);
    if (!f) break; if (cp.realm !== 'land') f.pos.y = cp.pos.y; cp.expo.push(f);
  }
  return cp.expo;
}
/* What the Builder Guild raises near a district becomes shelter: people whose homes are gone move into the bastion,
   and a district with standing Guild work bleeds slower. Let them build and the Villains have to work for every ten. */
function shelterAt(cp) {
  if (typeof BLD === 'undefined') return 0;
  let n = 0;
  for (const s of BLD.sites) if (s.state === 'build' && s.prog > 0.45 && Math.hypot(s.x - cp.x, s.z - cp.z) < 170) n += s.prog;
  if (typeof WS !== 'undefined') for (const k in WS.sites) { const S = WS.sites[k]; if (S && S.bastion && Math.hypot(S.x - cp.x, S.z - cp.z) < 170) n += 1; }
  return n;
}
const predatorAt = cp => { /* the named Villain who is doing the killing here */
  if (typeof CHAMP === 'undefined') return null;
  for (const C of CHAMP.live) if (C.team === 2 && C.ent && C.ent.alive && Math.hypot(C.ent.pos.x - cp.x, C.ent.pos.z - cp.z) < 130) return C;
  return null;
};
function bleed(cp) {
  if (cp.pop <= 0 || (cp.safeT || 0) > TIME) return; /* someone killed the Villain running this district */
  const pred = predatorAt(cp);
  const sh = shelterAt(cp);
  if (sh > 0 && Math.random() < Math.min(0.7, sh * 0.35)) { cp.shelterT = TIME; return; } /* they were behind a Guild wall */
  const ex = exposedAt(cp), f = ex[0];
  const take = pred ? POOL.PER * 2 : POOL.PER; /* a champion doubles what the district loses */
  cp.pop = Math.max(0, cp.pop - take); POOL.lost += take;
  if (pred && Math.random() < 0.08) poolChip(`${pred.name} is killing ${cp.name}`, 'r');
  if (f) { f.state = 'gone'; f.fade = 1; fxSparks(_v1.copy(f.pos).setY(f.pos.y + 1), 7, [2.4, 0.5, 0.4], 5); cp.expo = cp.expo.filter(q => q !== f); }
  if (TIME - POOL.saidT > 25 && camera.position.distanceTo(cp.pos) < 600) { POOL.saidT = TIME; comms('Hero net', `They are killing people in ${cp.name}. Retake it!`, 'cmd'); }
  if (cp.pop <= 0) { poolChip(`${cp.name} is empty`, 'y'); comms('COMMAND', `${cp.name} has nobody left. Nothing there to fight for now.`, 'cmd'); }
}
/* ---------- a figure goes down, and the little duel over it ---------- */
function figHit(f, dmg, src) {
  if (src && (src.isPlayer || src.team === 1)) return; /* a Hero does not shoot the people he came for */
  if (f.state !== 'walk' && f.state !== 'cower') return;
  f.hp -= dmg;
  if (f.hp <= 0) { f.state = 'down'; f.downT = 10; fxSparks(_v1.copy(f.pos).setY(f.pos.y + 1), 6, [2.4, 1.6, 0.4], 5); if (src && src.isPlayer) comms('Hero net', 'You hit a civilian!', 'cmd'); }
}
function figLost(f, how) {
  f.state = 'gone'; f.fade = 1; POOL.lost += POOL.PER;
  poolChip(`−${POOL.PER} ${how || 'civilian lost'}`, 'r');
  fxSparks(_v1.copy(f.pos).setY(f.pos.y + 0.8), 8, [2.4, 0.5, 0.4], 6); snd('stomp', f.pos, 0.3);
}
function figSave(f) { f.state = 'walk'; f.hp = 50; f.downT = 0; fxSparks(_v1.copy(f.pos).setY(f.pos.y + 1), 6, [0.5, 2.4, 1.4], 5); snd('chime', f.pos, 0.4); }
/* ---------- catastrophes ---------- */
/* the two beacons are built once and parked out of sight: arming a catastrophe or calling a raid only moves and
   recolours them, so nothing new is uploaded to the card in the middle of a fight and nothing leaks over a session. */
POOL.catM = (() => { const m = new T.Mesh(new T.CylinderGeometry(2.2, 2.2, 90, 12, 1, true).translate(0, 45, 0), basic(new T.Color(3.2, 0.5, 0.3), { transparent: true, opacity: 0.3, depthWrite: false, side: T.DoubleSide })); m.castShadow = false; m.visible = false; scene.add(m); return m; })();
POOL.raidM = (() => { const m = new T.Mesh(new T.CylinderGeometry(3.4, 3.4, 120, 14, 1, true).translate(0, 60, 0), basic(new T.Color(0.4, 1.6, 3.4), { transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide })); m.castShadow = false; m.visible = false; scene.add(m); return m; })();
function armCatastrophe(cp) {
  if (POOL.cat || POOL.charge < 1 || cp.pop < 100) return;
  POOL.charge--; POOL.cat = { cp, t: 30, pos: cp.pos.clone() };
  POOL.catM.position.copy(cp.pos); POOL.catM.visible = true; POOL.cat.m = POOL.catM;
  banner('Catastrophe armed', `${cp.name} · 30 seconds · get there and defuse it`, 'var(--red)');
  comms('Hero net', `They have armed a catastrophe at ${cp.name}! Thirty seconds!`, 'cmd'); snd('big', cp.pos, 0.8);
}
function defuseCat(by) {
  if (!POOL.cat) return; const cp = POOL.cat.cp;
  POOL.catM.visible = false; POOL.cat = null;
  banner('Catastrophe defused', `${cp.name} holds`, 'var(--blue)'); comms('Hero net', `Defused at ${cp.name}. Good work.`, 'b');
  if (by && by.isPlayer) awardPoints(400, 'Catastrophe defused'); snd('chime', cp.pos, 0.8);
}
function blowCat() {
  const C = POOL.cat, cp = C.cp; POOL.catM.visible = false; POOL.cat = null;
  const n = Math.min(cp.pop, Math.round(250 * POOL.esc / 10) * 10);
  cp.pop -= n; POOL.lost += n;
  for (const f of (cp.expo || [])) { f.state = 'gone'; f.fade = 1; } cp.expo = [];
  POOL.blasts = { at: cp.pos.clone(), n: 6, t: 0 }; /* the blasts walk out over the next second on the frame clock */
  shake(1.6, cp.pos); snd('big', cp.pos, 1.3); addEmitter(cp.pos.clone(), 3.4, 70);
  poolChip(`−${n} Catastrophe · ${cp.name}`, 'r');
  banner('Catastrophe', `${n} people lost at ${cp.name}`, 'var(--red)'); comms('COMMAND', `We lost ${n} people at ${cp.name}.`, 'cmd');
}
/* ---------- raids: one button, a beacon, both sides warned ---------- */
function raidCall(cp, team, by) {
  if (!cp || POOL.raid) return false;
  const R = POOL.raid = { cp, team, t: 15, phase: 'fill', n: team === 1 ? 1 : 3, by: by || null };
  if (team === 1) POOL.raidM.material.color.setRGB(0.4, 1.6, 3.4); else POOL.raidM.material.color.setRGB(3.4, 0.6, 0.3);
  POOL.raidM.position.copy(cp.pos); POOL.raidM.visible = true; R.m = POOL.raidM;
  const kind = team === 1 ? (cp.owner === 2 ? 'Rescue raid' : 'Escort raid') : (cp.owner === 1 ? 'Breach raid' : 'Ambush raid');
  R.kind = kind;
  if (by && by.isPlayer) { comms('You', `${kind} on ${cp.name}! All squads, on me!`, 'b'); for (const ft of CMD.teams) ft.mode = 'follow'; }
  banner(`${kind} · ${cp.name}`, team === 1 ? 'Heroes are massing — join them' : 'Villains are massing — get there', TEAM_CSS[team]);
  comms(team === 1 ? 'Hero net' : null, `${TEAM[team].name} are raiding ${cp.name}.`, team === 1 ? 'b' : 'cmd');
  snd('big', null, 0.5);
  return true;
}
function raidTick(dt) {
  const R = POOL.raid; if (!R) return;
  R.t -= dt; R.m.material.opacity = 0.16 + Math.sin(TIME * 4) * 0.08;
  if (R.phase === 'fill') {
    let n = 0; for (const e of ENTS) if (e.alive && e.kind === 'soldier' && e.team === R.team && e.pos.distanceToSquared(R.cp.pos) < 40000) n++;
    R.n = Math.min(8, n);
    if (R.t <= 0) { R.phase = 'live'; R.t = 90; focusOn(R.cp, `${R.kind} on ${R.cp.name} — ${TEAM[R.team].short} are going in.`); snd('big', null, 0.7); }
  } else if (R.t <= 0) { POOL.raidM.visible = false; POOL.raid = null; }
}
/* ---------- where the fight belongs: wherever the most people still are ---------- */
function focusPick() {
  let best = null, bs = -1;
  for (const c of CPS) { if (c.pop <= 0) continue; const s = atRisk(c); if (s > bs) { bs = s; best = c; } }
  if (!best) { const live = CPS.filter(c => c.pop > 0); best = live.length ? pick(live) : CPS[0]; }
  return best;
}
/* ---------- player actions ---------- */
function poolTarget(pe) {
  const near = f => f.state === 'down' && f.pos.distanceToSquared(pe.pos) < 9;
  const d = POOL.figs.find(near); if (d) return { kind: 'revive', f: d };
  if (POOL.cat && pe.pos.distanceTo(POOL.cat.pos) < 14) return { kind: 'defuse' };
  for (const c of CPS) if (c.owner === 1 && c.pop >= POOL.PER * 2 && pe.pos.distanceToSquared(c.pos) < 900 && Math.abs(pe.pos.y - c.pos.y) < 20) return { kind: 'muster', cp: c };
  return null;
}
{
  const _pHint = mountHint;
  mountHint = function (pe) {
    const h = _pHint(pe); if (h || pe.kind !== 'soldier' || pe.mount) return h;
    const t = poolTarget(pe); if (!t) return null;
    /* there is no E any more: standing on it does it, and the line says how far along it is */
    const pc = Math.round(Math.min(1, POOL.autoT / poolAutoNeed(t)) * 100);
    if (t.kind === 'revive') return `Stay with them · getting this civilian up ${pc}%`;
    if (t.kind === 'defuse') return `Stay on it · defusing ${pc}%`;
    return `Stay here · mustering a convoy at ${t.cp.name} (${t.cp.pop} people left) ${pc}%`;
  };
}
/* ---------- the Hero's contextual actions, now that E is gone ----------
   Land on a catastrophe, beside a downed civilian, or in a Hero-held district with people left, and stay there on foot
   for a moment: it is defused, they are back up, the convoy musters. Flying through does nothing, so it is a choice. */
const poolAutoNeed = t => t.kind === 'defuse' ? 1.6 : t.kind === 'revive' || t.kind === 'mate' ? 1.2 : 2.2;
function poolAuto(dt) {
  const pe = PLAYER.ent;
  if (GAME.state !== 'play' || !pe || !pe.alive || pe.kind !== 'soldier' || pe.mount || (typeof POW !== 'undefined' && POW.fly)) { POOL.autoT = 0; POOL.autoKey = null; return; }
  const mate = ENTS.find(x => x.downed && x.team === 1 && x.pos.distanceTo(pe.pos) < 2.8); /* a downed teammate first */
  const t = mate ? { kind: 'mate', f: mate } : poolTarget(pe); if (!t) { POOL.autoT = 0; POOL.autoKey = null; return; }
  const key = t.kind + ':' + (t.cp ? t.cp.name : '') + (t.kind === 'revive' ? POOL.figs.indexOf(t.f) : t.kind === 'mate' ? (t.f.name || 'mate') : '');
  if (key !== POOL.autoKey) { POOL.autoKey = key; POOL.autoT = 0; }
  if (t.kind === 'muster' && TIME < (POOL.musterAt || 0)) return; /* one convoy at a time from where you stand */
  POOL.autoT += dt;
  if (POOL.autoT < poolAutoNeed(t)) return;
  POOL.autoT = 0; POOL.autoKey = null;
  if (t.kind === 'mate') { if (t.f.reviver) t.f.reviver.revTgt = null; t.f.revive(pe); }
  else if (t.kind === 'revive') { figSave(t.f); awardPoints(80, 'Civilian back up'); if (typeof contractProgress === 'function') contractProgress('revive'); }
  else if (t.kind === 'defuse') defuseCat(pe);
  else if (t.kind === 'muster') { POOL.musterAt = TIME + 12; muster(t.cp, pe); }
}
/* ---------- HUD ---------- */
function poolChip(text, cls) {
  if (!POOL.el) return; const f = POOL.el.querySelector('.pfeed'); if (!f) return;
  const d = document.createElement('div'); d.className = 'pc ' + (cls || ''); d.textContent = text; f.insertBefore(d, f.firstChild);
  while (f.children.length > 3) f.lastChild.remove(); setTimeout(() => d.remove(), 4200);
}
function catLine() {
  if (!POOL.el) return '';
  if (POOL.cat) return `<div class="pcat">Catastrophe · ${POOL.cat.cp.name} · ${Math.ceil(Math.max(0, POOL.cat.t))} s · get there and hold E</div>`;
  const pred = CPS.map(predatorAt).find(Boolean);
  if (pred) { const c = CPS.find(q => Math.hypot(pred.ent.pos.x - q.x, pred.ent.pos.z - q.z) < 130); if (c) return `<div class="pcat warn">${pred.name} is working ${c.name} over · put him down</div>`; }
  return '';
}
function poolHud() {
  if (!POOL.el) { POOL.el = document.createElement('div'); POOL.el.id = 'pool'; POOL.el.innerHTML = '<div class="pbar"><u class="pe"></u><u class="pl"></u><i></i></div><div class="pn"><b class="e"></b><span class="mid"></span><b class="l"></b></div><div class="pace"></div><div class="pwarn"></div><div class="pfeed"></div>'; document.body.appendChild(POOL.el); }
  const el = POOL.el, inside = poolInside();
  el.style.display = GAME.state === 'play' || GAME.state === 'spectate' ? '' : 'none';
  el.querySelector('.pe').style.width = (POOL.evac / POOL.START * 100) + '%';
  el.querySelector('.pl').style.width = (POOL.lost / POOL.START * 100) + '%';
  el.querySelector('.e').textContent = `${POOL.evac} / ${POOL.WIN_E} out`;
  el.querySelector('.mid').textContent = `${inside} inside`;
  el.querySelector('.l').textContent = `${POOL.lost} / ${POOL.WIN_L} lost`;
  const te = POOL.rateE > 1 ? (POOL.WIN_E - POOL.evac) / POOL.rateE : 1e9, tl = POOL.rateL > 1 ? (POOL.WIN_L - POOL.lost) / POOL.rateL : 1e9;
  const p = el.querySelector('.pace'); const mm = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  if (te > 1e8 && tl > 1e8) { p.textContent = 'Nobody is moving the needle'; p.className = 'pace'; }
  else if (te < tl) { p.textContent = `On pace: HEROES — ${mm(te)}`; p.className = 'pace b'; }
  else { p.textContent = `On pace: VILLAINS — ${mm(tl)}`; p.className = 'pace r'; }
  const w = el.querySelector('.pwarn'); const wh = catLine(); if (w && w._h !== wh) { w._h = wh; w.innerHTML = wh; }
}
/* ---------- bots: heroes muster and escort, villains hunt the convoys ---------- */
function poolBots(dt) {
  if ((POOL.mustT -= dt) > 0) return; POOL.mustT = 4;
  if (POOL.convoys.filter(c => c.live).length < CONVOY_MAX) { /* the Heroes muster where the most people are waiting */
    const held = CPS.filter(c => c.owner === 1 && c.pop >= POOL.PER * 2 && !POOL.convoys.some(v => v.live && v.cp === c)).sort((a, b) => b.pop - a.pop);
    if (held.length) muster(held[0], null);
  }
  for (const cv of POOL.convoys) { /* detail the nearest free Heroes onto every convoy that still needs an escort */
    if (!cv.live) continue; cv.esc = (cv.esc || []).filter(e => e.alive && !e.downed && e.escortCv === cv);
    if (cv.esc.length >= ESCORT_N) continue;
    const free = [];
    for (const e of ENTS) if (e.alive && e.team === 1 && e.kind === 'soldier' && !e.isPlayer && !e.downed && !e.cmd && !e.escortCv) free.push(e);
    free.sort((a, b) => (a.deck ? 1e9 : 0) + a.pos.distanceToSquared(cv.pos) - ((b.deck ? 1e9 : 0) + b.pos.distanceToSquared(cv.pos)));
    for (const e of free.slice(0, ESCORT_N - cv.esc.length)) {
      e.escortCv = cv; cv.esc.push(e);
      if (e.deck || e.pos.distanceToSquared(cv.pos) > 10000) { /* Heroes fly: the escort drops in on the convoy rather than walking the island */
        const a = Math.random() * 6.283; e.deck = null; e.pos.set(cv.pos.x + Math.cos(a) * 6, 0, cv.pos.z + Math.sin(a) * 6);
        e.pos.y = surfY(e.pos.x, e.pos.z, cv.pos.y + 1); e.goal.set(e.pos.x, 0, e.pos.z); e.target = null; e.coverPt = null;
        FXA.spawn(e.pos.x, e.pos.y + 1, e.pos.z, 0, 6, 0, 1.4, 0.4, 1.0, 0.8, 2.4, 1.1, 0.4, 0.7, 1, 1, 0, 0);
      }
    }
  }
  for (const cv of POOL.convoys) { /* villains shoot at what the convoy is carrying */
    if (!cv.live) continue;
    for (const e of ENTS) {
      if (!e.alive || e.team === 1 || e.kind !== 'soldier' || e.downed) continue;
      if (e.pos.distanceToSquared(cv.pos) > 1600) continue;
      const f = cv.figs.find(q => q.state === 'walk' || q.state === 'cower');
      if (f && Math.random() < 0.5) { beam(e.muzzle(_v1), _v2.copy(f.pos).setY(f.pos.y + 1), 0.05, 0.08, TEAM[e.team].hex); figHit(f, 60, e); }
      const d = cv.figs.find(q => q.state === 'down'); if (d && d.pos.distanceToSquared(e.pos) < 9 && Math.random() < 0.5) figLost(d, 'executed');
    }
  }
  const pe = PLAYER.ent; /* heroes pick their downed up */
  for (const f of POOL.figs) {
    if (f.state !== 'down') continue;
    for (const e of ENTS) if (e.alive && e.team === 1 && e.kind === 'soldier' && !e.isPlayer && !e.downed && e.pos.distanceToSquared(f.pos) < 16 && Math.random() < 0.5) { figSave(f); break; }
    if (pe && pe.alive) continue;
  }
}
/* ---------- per frame ---------- */
function updatePool(dt) {
  if (GAME.state === 'end' || GAME.state === 'showcase') return;
  POOL.t += dt;
  if (!POOL.over && WARS.over === 0 && WARS.t <= 2 && GAME.state === 'play') { /* time up: whoever came closer to their number takes it */
    POOL.over = true; const he = POOL.evac / POOL.WIN_E, vi = POOL.lost / POOL.WIN_L;
    if (he >= vi) endWar(1, `Time. ${POOL.evac.toLocaleString()} people carried out of Aeris`);
    else endWar(2, `Time. ${POOL.lost.toLocaleString()} people left dead in the districts`);
  }
  POOL.esc = GAME.clock > 720 ? 2 : GAME.clock > 360 ? 1.5 : 1;
  /* bleed: every district the Villains hold loses people */
  if ((POOL.bleedT -= dt) <= 0) {
    POOL.bleedT = 7.5 / POOL.esc;
    for (const c of CPS) if (c.owner === 2 && c.pop > 0) bleed(c);
  }
  /* villain charges and catastrophes */
  if ((POOL.chargeT -= dt) <= 0) { POOL.chargeT = 180; if (POOL.charge < 1) { POOL.charge = 1; comms(null, 'The Villains have a catastrophe charge.', 'cmd'); } }
  if (POOL.blasts) { const B = POOL.blasts; if ((B.t -= dt) <= 0) { B.t = 0.14; B.n--; const p = _v1.copy(B.at).add(_v2.set(rand(-24, 24), rand(0, 6), rand(-24, 24))); fxExplosion(p, 2.6); fxDust(p, 12, 8, 10); if (B.n <= 0) POOL.blasts = null; } }
  if (POOL.cat) { POOL.cat.t -= dt; POOL.cat.m.material.opacity = 0.22 + Math.sin(TIME * 9) * 0.14; if (POOL.cat.t <= 0) blowCat(); }
  else if ((POOL.catT -= dt) <= 0) { POOL.catT = rand(60, 100); const t = CPS.filter(c => c.owner === 2 && c.pop >= 100); if (t.length) armCatastrophe(pick(t)); }
  /* convoys and figures */
  for (const cv of POOL.convoys) { poolConvoy(cv, dt); if (!cv.live) POOL_SWEEP = true; }
  for (const f of POOL.figs) {
    if (f.state === 'down') { f.downT -= dt; if (f.downT <= 0) figLost(f, 'bled out'); }
    else if (f.state === 'exposed') { f.pos.y = f.home && f.home.realm !== 'land' ? f.home.pos.y : groundY(f.pos.x, f.pos.z); }
    if (f.fade > 0) { f.fade -= dt * 0.6; if (f.fade <= 0) { f.fade = 0; f.state = 'gone'; POOL_SWEEP = true; } }
    else if (f.state === 'gone') POOL_SWEEP = true;
  }
  if (POOL_SWEEP) { /* one pass when someone is actually out, instead of two new arrays every frame */
    POOL_SWEEP = false;
    POOL.convoys = POOL.convoys.filter(c => c.live);
    POOL.figs = POOL.figs.filter(f => f.state !== 'gone');
  }
  poolBots(dt);
  poolAuto(dt);
  /* raids and where the fight sits */
  raidTick(dt);
  if ((POOL.focusT -= dt) <= 0) {
    POOL.focusT = 30;
    if (!POOL.raid) {
      const want = focusPick();
      if (THEATRE.cur && THEATRE.cur.cp !== want) { const t = Math.random() < 0.5 ? 2 : 1; raidCall(want, t, null); }
    }
  }
  /* rates over the last half minute, for the pace line */
  if ((POOL.histT = (POOL.histT || 0) - dt) <= 0) { POOL.histT = 0.5; POOL.hist.push({ t: POOL.t, e: POOL.evac, l: POOL.lost }); } while (POOL.hist.length && POOL.hist[0].t < POOL.t - 30) POOL.hist.shift();
  if (POOL.hist.length > 1) { const a = POOL.hist[0], span = Math.max(1, POOL.t - a.t); POOL.rateE = (POOL.evac - a.e) / span * 60; POOL.rateL = (POOL.lost - a.l) / span * 60; }
  /* the win */
  if (!POOL.over && GAME.state !== 'menu') {
    if (POOL.evac >= POOL.WIN_E) { POOL.over = true; endWar(1, `${POOL.evac} people are out alive`); }
    else if (POOL.lost >= POOL.WIN_L) { POOL.over = true; endWar(2, `${POOL.lost} people are dead`); }
  }
  /* draw the figures */
  let n = 0; const cam = camera.position;
  for (const f of POOL.figs) {
    if (n >= CIV_MAX || cam.distanceToSquared(f.pos) > 490000) continue;
    const down = f.state === 'down', c = CIV_COL[down ? 'down' : f.state === 'exposed' ? 'exposed' : f.state === 'cower' ? 'cower' : f.state === 'saved' ? 'saved' : 'walk'];
    const bob = f.state === 'walk' ? Math.abs(Math.sin(TIME * 7 + f.ph)) * 0.07 : 0, sc = f.fade > 0 ? Math.max(0.05, f.fade) : 1;
    if (down) { _pe.set(Math.PI / 2, f.yaw, 0); _q.setFromEuler(_pe); } else _q.setFromAxisAngle(UP, f.yaw);
    _m.compose(_v1.set(f.pos.x, f.pos.y + bob + (down ? 0.25 : 0), f.pos.z), _q, _s.set(sc, f.state === 'cower' ? sc * 0.78 : sc, sc));
    CIVM.setMatrixAt(n, _m); CIVM.instanceColor.setXYZ(n, c[0], c[1], c[2]); n++;
  }
  CIVM.count = n; CIVM.instanceMatrix.needsUpdate = true; CIVM.instanceColor.needsUpdate = true;
  updateResidents(dt);
  if ((POOL.hudT -= dt) <= 0) { POOL.hudT = 0.3; poolHud(); }
}
{ const _pw = newWar; newWar = function () { _pw.apply(this, arguments); poolReset(); focusOn(focusPick(), 'A new war. The people are still in there.'); }; }
