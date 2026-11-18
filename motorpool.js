'use strict';
/* ===================== IRON MERIDIAN · the motor pool: five company drivers who keep the rides close ===================== */
// Five of your company are on driver duty. Each has a transport (16, 16, 12, 12 and 8 seats: room for the whole
// company). They are the squad's rides, not yours: nothing is ever summoned to your elbow and no driver pulls up
// beside you. They keep a long way back, and when you get ahead of your company the troopers pile in and the drivers
// bring them to you. A driver who falls is replaced by the nearest trooper; a lost vehicle is requisitioned again
// after half a minute.
const MOTOR = { cars: [null, null], caps: [16, 12], t: 0, dead: [0, 0] }; /* two trucks carry the company; more than that is a car park following you around */
/* Where the pool waits: with the company, not with you. An empty truck parks among the troops; a truck with troops
   aboard drives them to wherever you have got to. */
function motorHome() {
  let n = 0, x = 0, z = 0; for (const ft of CMD.teams) for (const s of ft.m) if (s.alive && !s.downed && !s.mount) { x += s.pos.x; z += s.pos.z; n++; }
  if (!n) return null; return { x: x / n, z: z / n, yaw: CMD.teams[0].yaw };
}
function motorAnchor(car) {
  const pe = PLAYER.ent && PLAYER.ent.mount && PLAYER.ent.mount.pos ? PLAYER.ent.mount : PLAYER.ent;
  const carrying = car && car.riders && car.riders.some((r, i) => i > 0 && r && r.cmd);
  if (carrying && pe && pe.alive && pe.pos.y - groundY(pe.pos.x, pe.pos.z) < 40) return { x: pe.pos.x, z: pe.pos.z, yaw: PLAYER.yaw + Math.PI };
  return motorHome() || (pe ? { x: pe.pos.x, z: pe.pos.z, yaw: PLAYER.yaw + Math.PI } : null);
}
function motorSlot(i, A, out) { const lat = (i - 0.5) * 14, back = 34 + i * 10, /* they sit with the company they carry, not at your heel */ fx = Math.sin(A.yaw), fz = Math.cos(A.yaw); return out.set(A.x - fx * back + Math.cos(A.yaw) * lat, 0, A.z - fz * back - Math.sin(A.yaw) * lat); }
function motorSpawn(i) {
  const A = motorAnchor(null); const p = A ? motorSlot(i, A, new V3()) : new V3(HQ[1].x + i * 12, 0, HQ[1].z - 60); const q = landNear(p.x, p.z, 25); pushOut(q, 5);
  const t = spawnTransport(MOTOR.caps[i], 1, q, A ? A.yaw : Math.PI); t.motorPool = true; t.slotI = i; t.name = `${['Mule', 'Ox'][i]} (motor pool)`; MOTOR.cars[i] = t; return t;
}
function motorDriver(car) { // the nearest free trooper in the company takes the wheel
  let best = null, bd = 70; for (const ft of CMD.teams) for (const s of ft.m) { if (!s.alive || s.downed || s.mount || s.driverDuty || s.para) continue; const d = s.pos.distanceTo(car.pos); if (d < bd) { bd = d; best = s; } }
  if (!best) return; best.driverDuty = true; car.seat(best, 0);
}
function motorPoolDrive(car, dt) { // park with the company, or run the company up to the Hero when they are aboard
  const carrying = car.riders.some((r, i) => i > 0 && r && r.cmd);
  if (!carrying && (car.pickup || 0) > TIME) return car.drive(dt, 0, 0, false); /* troopers are running to this truck: hold */
  const A = motorAnchor(car); if (!A || car.hold > TIME) return car.drive(dt, 0, 0, false); const tgt = motorSlot(car.slotI, A, _tq), dx = tgt.x - car.pos.x, dz = tgt.z - car.pos.z, d = Math.hypot(dx, dz);
  if (d < 16) { car.spdMul = car.baseSpd || TR_SPD[car.cap]; if (car.riders.some((r, i) => i > 0 && r && r.cmd)) for (let i = 1; i < car.riders.length; i++) { const r = car.riders[i]; if (r && r.cmd) { car.dismount(r); } } /* dropped off */ return car.drive(dt, 0, 0, false); }
  let want = Math.atan2(dx, dz); for (const look of [9, 20]) { _v1.set(car.pos.x + Math.sin(car.yaw) * look, car.pos.y + 1, car.pos.z + Math.cos(car.yaw) * look); if (buildingAt(_v1)) { want = car.yaw + 1.3; break; } }
  car.driven = true; car.spdMul = d > 120 ? Math.max(TR_SPD[car.cap], 1.25) : TR_SPD[car.cap];
  car.drive(dt, d > 60 ? 1 : d > 25 ? 0.6 : 0.3, clamp(angDiff(car.yaw, want) * 2, -1, 1), d > 160);
}
function updateMotorPool(dt) {
  if (GAME.state !== 'play' || (MOTOR.t -= dt) > 0) return; MOTOR.t = 1;
  for (let i = 0; i < MOTOR.cars.length; i++) {
    const c = MOTOR.cars[i];
    if (!c || !c.alive || c.remove) { if ((MOTOR.dead[i] += 1) > (c ? 30 : 2)) { MOTOR.dead[i] = 0; motorSpawn(i); if (c && GAME.clock > 20) comms('Motor Pool', `Replacement ${MOTOR.cars[i].name.split(' ')[0]} on its way to you, Commander.`, 'b'); } continue; }
    const d0 = c.riders[0]; if (d0 && d0.isPlayer) continue;
    const duty = c.riders.find(r => r && r.driverDuty); // a driver bumped to the back by the Commander takes the wheel back
    if (!d0 && duty) { c.riders[c.riders.indexOf(duty)] = null; c.riders[0] = duty; }
    if (!c.riders[0]) motorDriver(c);
    const L = CONVOY.leader; // catching up with a convoy already rolling: join it and pick up whoever is still on foot
    if (L && c !== L && !c.convoy && c.riders[0] && c.riders[0].driverDuty && c.pos.distanceTo(L.pos) < 120 && L.kind !== 'fighter' && L.kind !== 'starship') {
      c.convoy = true; c.expect = c.riders.filter(Boolean).length; c.waitT = 0; CONVOY.cars.push(c);
      for (const ft of CMD.teams) if (ft.mode === 'follow') for (const s of ft.m) { if (c.expect >= c.cap) break; if (s.alive && !s.downed && !s.mount && !s.boardTarget && s.pos.distanceTo(c.pos) < 120) { s.boardTarget = c; s.boardT = 16; c.expect++; } }
    }
  }
}
