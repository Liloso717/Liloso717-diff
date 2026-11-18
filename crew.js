'use strict';
/* ===================== IRON MERIDIAN · the crew: whoever rides with you fights for the car ===================== */
// When the Commander drives (or rides in) a transport:
//  · a trooper mans the roof gun on cars with four or more seats and hammers whatever is attacking the car
//  · the roof gunner shoots incoming missiles out of the air
//  · troopers on the benches and in the trailing convoy fire on the same threats; rocket teams take on enemy vehicles
const PRO = { crewT: 0 };
function pointDefence(car) {
  if (car.cap < 4 || !car.riders.some((r, i) => i > 0 && r && !r.isPlayer)) return;
  for (const pr of PROJ) {
    if (!pr.on || pr.kind !== 'missile' || pr.pd || !isHostile(pr.team)) continue; const d = pr.p.distanceTo(car.pos); if (d > 70) continue;
    pr.pd = true; if (Math.random() > 0.6) continue;
    car.local(_tq.set(0, car.hh + 1.6, car.len / 2 - 1.2), _v1); beam(_v1, pr.p, 0.12, 0.12, 0xffd080); fxExplosion(pr.p, 0.7); pr.on = false; snd('crit', pr.p, 0.6);
    if (TIME - (PRO.sayT || 0) > 5) { PRO.sayT = TIME; comms('Roof gunner', pick(['Missile down!', 'Splashed the missile!', 'Got it! Keep driving!']), 'b'); }
  }
}
/* the crew fights back: roof gunner, bench troopers and the trailing convoy all fire on whatever threatens the car */
function proCrew(dt) {
  if ((PRO.crewT -= dt) > 0) return; PRO.crewT = 0.3;
  const pe = PLAYER.ent, car = pe && pe.mount && pe.mount.kind === 'transport' ? pe.mount : null; if (!car || !car.alive) return;
  pointDefence(car);
  /* threats: hostiles near the car, worst first (anything targeting the car or the Commander, armour, aircraft) */
  const T = []; for (const e of ENTS) { if (!e.alive || !isHostile(e.team) || !e.hitR || e.downed) continue; const d = e.pos.distanceTo(car.pos); if (d > 140 || e.pos.y - car.pos.y > 220) continue;
    const w = (e.target === car || e.target === pe ? 3 : 1) * (e.kind === 'soldier' ? 1 : e.kind === 'fighter' || e.kind === 'gunship' ? 2.5 : 3) * (1 - d / 180); T.push([e, w]); }
  if (!T.length) return; T.sort((a, b) => b[1] - a[1]); const top = T[0][0];
  /* roof gunner (cars with four or more seats) */
  if (car.cap >= 4 && car.riders.some((r, i) => i > 0 && r && !r.isPlayer)) { car.local(_tq.set(0, car.hh + 1.6, car.len / 2 - 1.2), _v1); top.aim(_v2); _v2.x += rand(-1, 1); _v2.y += rand(-0.5, 0.8); _v2.z += rand(-1, 1);
    for (let k = 0; k < 2; k++) setTimeout(() => { if (!car.alive || !top.alive) return; car.local(_tq.set(0, car.hh + 1.6, car.len / 2 - 1.2), _v3); top.aim(_v4); fireProj({ from: _v3, to: _v4.add(_v5.set(rand(-1.2, 1.2), rand(-0.5, 0.8), rand(-1.2, 1.2))), speed: 620, kind: 'bolt', team: 1, src: car, dmg: 34, splash: 2.2, w: 0.22, len: 7, color: TEAM[1].laser, fx: 0.8 }); fxMuzzle(_v3, [1.2, 2.4, 4]); snd('heavy', _v3, 0.35); }, k * 120); }
  /* bench troopers and the convoy: rifles on the threats, a rocket for armour now and then */
  const shooters = []; for (const r of car.riders) if (r && !r.isPlayer && !r.driverDuty && r.alive) shooters.push([r, car]);
  for (const c of CONVOY.cars) if (c && c.alive && c !== car && c.pos.distanceTo(car.pos) < 120) for (const r of c.riders || []) if (r && !r.isPlayer && r.alive && !r.driverDuty) shooters.push([r, c]);
  let i = 0; for (const [s, v] of shooters) {
    if (Math.random() < 0.55) continue; const t = T[Math.min(T.length - 1, i++ % 3)][0]; if (t.pos.distanceTo(s.pos) > 150) continue;
    s.target = t; s.yaw = Math.atan2(t.pos.x - s.pos.x, t.pos.z - s.pos.z); s.muzzle(_v1);
    if (t.kind !== 'soldier' && Math.random() < 0.12 && !(s.rocketT > TIME)) { s.rocketT = TIME + 6; t.aim(_v2); fireProj({ from: _v1, to: _v2, speed: 110, kind: 'missile', team: 1, src: s, dmg: 180, splash: 5, w: 0.3, len: 2, color: TEAM[1].laser, homing: 1.6, target: t, maxDist: 400, fx: 1.4 }); snd('missile', _v1, 0.5); }
    else { t.aim(_v2); fireProj({ from: _v1, to: _v2.add(_v3.set(rand(-1.5, 1.5), rand(-0.6, 0.8), rand(-1.5, 1.5))), speed: 540, kind: 'bolt', team: 1, src: s, dmg: 15, w: 0.12, len: 5, color: TEAM[1].laser, fx: 0.5 }); snd('rifle', _v1, 0.25); }
    if (v !== car && !v.proTold && Math.random() < 0.02) { v.proTold = true; comms(s.name || 'Convoy', pick(['Engaging the threat on the Commander!', 'Covering your car, sir!', 'Rear car engaging!']), 'b'); }
  }
}
function updateCrew(dt) { if (GAME.state === 'play') proCrew(dt); }
