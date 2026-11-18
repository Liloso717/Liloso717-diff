'use strict';
/* ===================== IRON MERIDIAN · action director: a battlefield that never sits still ===================== */
// Keeps the space around the Commander dense and loud without aiming it at him:
//  · fleet lasers and missile salvos land on enemy (and friendly) positions 60–350 m out, so the sky is always busy
//  · ground vehicles collide: sparks and dents at speed, wrecks and explosions when it is head-on and fast
//  · vehicles that are already burning sometimes cook off in a secondary explosion
const ACT = { t: 2, salvoT: 4, colT: 0 };
function actionTargets(pe) {
  const L = []; for (const e of ENTS) { if (!e.alive || e.isPlayer || !e.hitR || e.pos.y > 600 || e.kind === 'capital') continue; const d = e.pos.distanceTo(pe.pos); if (d > 60 && d < 350) L.push(e); } return L;
}
function fleetLaser(tgt) { // a capital-ship lance from the sky onto a position (always the far side of the fight from the Commander)
  const p = tgt.pos.clone().add(new V3(rand(-6, 6), 0, rand(-6, 6))); p.y = groundY(p.x, p.z); const shooter = tgt.team === 1 ? 2 : 1;
  beam(_v1.set(p.x + rand(-200, 200), p.y + 900, p.z + rand(-200, 200)), p, 2.4, 0.5, TEAM[shooter] ? TEAM[shooter].hex : 0xffffff);
  setTimeout(() => { fxExplosion(p, 1.6); explodeDamage(p, 6, 120, null, shooter); flashLight(p, 8, 120, 0.4, TEAM[shooter] ? TEAM[shooter].hex : 0xffffff); snd('heavy', p, 0.7); }, 120);
}
function missileSalvo(tgt) { // three to five rockets arcing in from the shooter's side of the map
  const shooter = tgt.team === 1 ? 2 : 1, n = 3 + ((Math.random() * 3) | 0), h = HQ[shooter] || HQ[2];
  const dx = h.x - tgt.pos.x, dz = h.z - tgt.pos.z, l = Math.hypot(dx, dz) || 1;
  for (let i = 0; i < n; i++) setTimeout(() => {
    if (!tgt.alive) return; const from = new V3(tgt.pos.x + dx / l * 260 + rand(-30, 30), groundY(tgt.pos.x, tgt.pos.z) + rand(60, 120), tgt.pos.z + dz / l * 260 + rand(-30, 30));
    const to = tgt.pos.clone().add(new V3(rand(-10, 10), 0, rand(-10, 10)));
    fireProj({ from, to, vel: new V3(-dx / l * 60, 30, -dz / l * 60), speed: 120, kind: 'missile', team: shooter, dmg: 140, splash: 6, w: 0.32, len: 2, color: TEAM[shooter] ? TEAM[shooter].laser : [3, 1.5, 0.5], homing: 1.4, target: tgt, maxDist: 700, fx: 1.6 });
    snd('missile', from, 0.5);
  }, i * 220);
}
const GROUND_VEH = { speeder: 1, transport: 1, tank: 3, shiftframe: 2, walker: 6 };
function vehicleCollisions() {
  const V = []; const c = camera.position;
  for (const e of ENTS) if (GROUND_VEH[e.kind] && e.alive && !e.tumble && e.pos.y < 400 && e.pos.distanceTo(c) < 600 && !(e.kind === 'shiftframe' && e.mode === 'robot' && !e.isPlayer)) V.push(e);
  for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) {
    const a = V[i], b = V[j]; if (a.parked && b.parked) continue; const R = (a.radius || 3) + (b.radius || 3) * 0.9, dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
    if (d > R || Math.abs(a.pos.y - b.pos.y) > 6 || d < 0.01) continue;
    const rel = _v1.subVectors(a.vel, b.vel).length(); const nx = dx / d, nz = dz / d, push = (R - d) * 0.6;
    const ma = GROUND_VEH[a.kind], mb = GROUND_VEH[b.kind];
    a.pos.x -= nx * push * mb / (ma + mb); a.pos.z -= nz * push * mb / (ma + mb); b.pos.x += nx * push * ma / (ma + mb); b.pos.z += nz * push * ma / (ma + mb);
    if (rel < 10) continue;
    const mid = _v2.set((a.pos.x + b.pos.x) / 2, (a.pos.y + b.pos.y) / 2 + 1, (a.pos.z + b.pos.z) / 2);
    fxSparks(mid, Math.min(40, rel), [3, 2, 0.8], 12); shake(Math.min(0.9, rel / 60), mid); snd(rel > 30 ? 'boom' : 'stomp', mid, Math.min(1, rel / 40));
    const hit = rel * rel * 0.35; if (a.team !== b.team || a.isPlayer || b.isPlayer) { a.damage(hit * mb / ma, b.isPlayer ? b : null, 'crash'); b.damage(hit * ma / mb, a.isPlayer ? a : null, 'crash'); }
    if (rel > 32) { fxExplosion(mid, 1.2); flashLight(mid, 6, 60, 0.3, 0xffa050); if (a.isPlayer || b.isPlayer) comms('Alpha Lead', pick(['Ram it! Ram it!', 'That was a hit, sir!', 'Brace!']), 'b'); }
    for (const v of [a, b]) if (v.speed !== undefined) v.speed *= -0.35; // they bounce apart
  }
}
function ensureBattles() { /* the support units follow the one battle: air wings, the battle fleet, orbital squadrons */
  const k = THEATRE.cur ? THEATRE.cur.key : 'land', airN = k === 'air' ? 6 : k === 'space' ? 0 : 3, orbN = k === 'space' ? 4 : 0, sea = k === 'sea';
  for (const t of [1, 2]) {
    let air = 0, orb = 0; const lanes = [0, 0]; for (const e of ENTS) if (e.alive && e.team === t) { if (e.kind === 'fighter') { if (e.orbital) orb++; else air++; } else if (e.kind === 'naval') lanes[e.lane || 0]++; }
    const q = ty => SPAWNER.q.some(s => s.team === t && s.type === ty);
    if (air < airN && !q('fighter')) spawnUnit('fighter', t); if (orb < orbN && !q('ofighter')) spawnUnit('ofighter', t); if (sea) for (const l of [0, 1]) if (!lanes[l] && !q('naval' + l)) spawnUnit('naval' + l, t);
  }
}
function updateAction(dt) {
  if ((ACT.battleT = (ACT.battleT || 6) - dt) <= 0) { ACT.battleT = 20; if (GAME.state === 'play') ensureBattles(); }
  const pe = PLAYER.ent; if (GAME.state !== 'play' || !pe || !pe.alive) return;
  if ((ACT.colT -= dt) <= 0) { ACT.colT = 0.1; vehicleCollisions(); }
  if ((ACT.salvoT -= dt) > 0) return; ACT.salvoT = rand(2.2, 4.5) * (LOW_END ? 1.6 : 1);
  if (pe.pos.y > 1200) return; const T0 = actionTargets(pe); if (!T0.length) return;
  const tgt = pick(T0); if (Math.random() < 0.45) fleetLaser(tgt); else missileSalvo(tgt);
  for (const e of T0) if (e.kind !== 'soldier' && e.hp < e.maxHp * 0.25 && Math.random() < 0.08) { fxExplosion(e.pos.clone().setY(e.pos.y + 1.5), 1.1); e.damage(60, null, 'splash'); break; } // cook-offs
}
