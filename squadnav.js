'use strict';
/* ===================== IRON MERIDIAN · the company goes to the fight =====================
   Your three fireteams no longer bunch up round you. Whatever the navigation is pointing at (the post to take or
   defend, the enemy pack, the evacuation convoy), the company makes its own way there and spreads out on arrival:
   · Alpha takes the centre, stopping a little short of the objective;
   · Bravo swings round the left flank, Charlie the right, so the objective is hit from three sides;
   · they move at squad pace along the way and fight whatever they meet; once there they clear the area; troops
     who ride the company trucks are driven to the fight (dropped short of it), not back to you;
   · if you drop below half health, Alpha (with the medic) comes back to you;
   · with nothing to fight, they form up on you as before;
   · while you ride a walker or an aircraft they escort it on the ground: Alpha behind, Bravo and Charlie ahead on
     either side, fighting whatever comes near (your six flying heroes stay up with you too);
   · a soldier who has spent 8 s on a different level from the team (the fight is up on the mesa, or down below it)
     rejoins it at its spot, out of your sight, as if by lift or cable. */
const SQN = { keep: [], on: true, dest: new V3(), dir: new V3(), v: new V3(), t: 0, prog: new Map() };
const SQN_SLOT = { Alpha: [0, 16], Bravo: [0.9, 26], Charlie: [-0.9, 26] }; /* [angle off the approach, metres short of / round the objective] */
const SQN_ESCORT = { Alpha: [Math.PI, 18], Bravo: [0.75, 20], Charlie: [-0.75, 20] }; /* round a ridden machine: [angle from its heading, metres] */
function sqnTarget() { /* exactly where the navigation points; through a short gap in it, the last place it pointed */
  const c = NAV.cur, now = c ? (c.cp ? c.cp.pos : c.p) : null; SQN.lockT = (SQN.lockT || 0) - 1 / 60;
  if (now) { SQN.ref = now; SQN.lockT = 6 * 60; return now; }
  return SQN.ref && SQN.lockT > 0 ? SQN.ref : (SQN.ref = null);
}
{
  const _uc = updateCommand;
  updateCommand = function (dt) {
    const pe = PLAYER.ent, T = SQN.on && GAME.state === 'play' && pe && pe.alive ? sqnTarget() : null, hurt = pe && pe.alive && pe.hp < pe.maxHp * 0.5;
    const keep = SQN.keep; for (let i = 0; i < CMD.teams.length; i++) (keep[i] || (keep[i] = new V3())).copy(CMD.teams[i].anchor);
    _uc(dt);
    for (let i = 0; i < CMD.teams.length; i++) {
      const ft = CMD.teams[i], s = SQN_SLOT[ft.id] || [0, 20];
      const rideV = typeof RIDE !== 'undefined' && RIDE.on && RIDE.on.alive ? RIDE.on : null;
      ft.nav = !!T && ft.mode === 'follow' && !(hurt && ft.id === 'Alpha') && !rideV;
      if (rideV && ft.mode === 'follow') { /* you are riding a walker or an aircraft: the company escorts it on the ground, spread round it */
        const R = SQN_ESCORT[ft.id] || [0, 20], yaw = rideYaw(rideV), a = yaw + R[0], r = R[1] + (rideV.kind === 'walker' ? 6 : 0);
        SQN.dest.set(rideV.pos.x + Math.sin(a) * r, 0, rideV.pos.z + Math.cos(a) * r);
        ft.anchor.copy(keep[i]); ft.anchor.lerp(SQN.dest, Math.min(1, dt * 1.5)); ft.yaw = angLerp(ft.yaw, yaw + Math.PI, Math.min(1, dt * 2));
        if (H(ft.anchor.x, ft.anchor.z) < -2.4) pushOut(ft.anchor, 2);
        continue;
      }
      if (!ft.nav) continue;
      /* the spot: approach from where the team is now, then fan out round the objective */
      ft.anchor.copy(keep[i]);
      const ax = ft.anchor.x - T.x, az = ft.anchor.z - T.z, base = Math.atan2(az, ax), a = base + s[0];
      SQN.dest.set(T.x + Math.cos(a) * s[1], 0, T.z + Math.sin(a) * s[1]);
      const dx = SQN.dest.x - ft.anchor.x, dz = SQN.dest.z - ft.anchor.z, d = Math.hypot(dx, dz);
      if (d > 1) { const st = Math.min(d, (d > 60 ? 5.2 : 3.6) * dt); ft.anchor.x += dx / d * st; ft.anchor.z += dz / d * st; }
      if (d > 4) ft.yaw = angLerp(ft.yaw, Math.atan2(-dx, -dz), Math.min(1, dt * 2)); /* face the way they go; on arrival, keep facing the objective */
      else ft.yaw = angLerp(ft.yaw, Math.atan2(ft.anchor.x - T.x, ft.anchor.z - T.z), Math.min(1, dt * 2));
      if (H(ft.anchor.x, ft.anchor.z) < -2.4) { pushOut(ft.anchor, 2); } /* don't plant the slot in deep water */
    }
  };
  /* catching up across a cliff: once a second, anyone on a different level who has stopped closing on the team */
  const _uc2 = updateCommand;
  updateCommand = function (dt) {
    _uc2(dt);
    if ((SQN.t -= dt) > 0) return; SQN.t = 1; const cam = camera.position;
    for (const ft of CMD.teams) { if (!ft.nav) continue; const ay = surfY(ft.anchor.x, ft.anchor.z, 400);
      for (const m of ft.m) { if (!m.alive || m.downed || m.mount || m.trGo || m.zipGo || m.deck) { SQN.prog.delete(m); continue; }
        const d = Math.hypot(ft.anchor.x - m.pos.x, ft.anchor.z - m.pos.z), dy = Math.abs(ay - m.pos.y); let p = SQN.prog.get(m); if (!p) SQN.prog.set(m, p = { best: d, n: 0 });
        const T = SQN.ref, toward = T && Math.hypot(ft.anchor.x - T.x, ft.anchor.z - T.z) < Math.hypot(m.pos.x - T.x, m.pos.z - T.z) - 40;
        if (d < 40 || dy < 10 || !toward) { p.n = 0; continue; } /* same level, nearly there, or it would not bring them closer to the fight */
        if (++p.n < 8 || cam.distanceTo(m.pos) < 70) continue; /* 8 s on the wrong level, out of your sight */
        for (let k = 0; k < 10; k++) { const a = Math.random() * 6.28, r = 4 + Math.random() * 8, x = ft.anchor.x + Math.cos(a) * r, z = ft.anchor.z + Math.sin(a) * r, y = surfY(x, z, ay + 2);
          if (Math.abs(y - ay) > 3 || buildingAt(SQN.v.set(x, y + 1, z)) || cam.distanceTo(SQN.v) < 50) continue;
          m.pos.set(x, y, z); if (m.obj) m.obj.position.copy(m.pos); if (m.lastPos) m.lastPos.copy(m.pos); p.best = 0; p.n = 0; break; }
      }
    }
  };
  /* the company's trucks: with troops aboard they drive to the fight, not to you, and drop them short of it */
  const _ma = motorAnchor;
  motorAnchor = function (car) {
    const carrying = car && car.riders && car.riders.some((r, i) => i > 0 && r && r.cmd), T = SQN.ref;
    if (carrying && T && CMD.teams.some(ft => ft.nav)) { const dx = T.x - car.pos.x, dz = T.z - car.pos.z; return { x: T.x, z: T.z, yaw: Math.atan2(dx, dz) }; }
    return _ma(car);
  };
  /* Alpha normally shoots round you; when it is off at the fight, it shoots round itself */
  const _ct = cmdThink;
  cmdThink = function (s) {
    _ct(s); const ft = s.cmd;
    if (ft && ft.nav && ft.id === 'Alpha' && !(s.target && s.target.alive)) s.target = cmdPickTarget(s, ft.anchor, 110);
  };
}
