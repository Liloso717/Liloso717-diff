'use strict';
/* ===================== IRON MERIDIAN · the bunker as a transit hub: up to downtown, down to the glass tunnels =====================
   Troops of both armies use the Mesa Bunker on their own:
   · THE LIFT: a soldier coming from the south for downtown walks in through the gate and rides the shaft up to the
     mesa top; one leaving downtown for the south rides it down and walks out through the gate.
   · THE SUBWAY: a soldier at the bunker bound for the Floating Marina goes down the ramp and boards the shuttle;
     it comes up at the station by the marina causeway. The other way too: from the marina shore to downtown, the
     shuttle to the bunker and then the lift.
   Riders are out of the fight while they ride (in the tube they are hidden aboard the train). Budgets are small on
   phones, and the scan is spread over half-second ticks. */
const TR = { lift: null, t: 0, n: 0, MAX: LOW_END ? 8 : 16, gate: new V3(30, 0, BUNKER.front + 6) };
(function () {
  const L = BUNKER.lift;
  TR.lift = zipVertical(new V3(L.x, BUNKER.floor, L.z + 7), new V3(L.x, MESA.top + 3, L.z + 5.2), new V3(L.x, MESA.top, L.z - 9), null);
  if (TR.lift) TR.lift.speed = 26;
})();
/* free to travel: not riding, not busy; a fight far off does not stop him (one close by does) */
const trOk = s => s.kind === 'soldier' && s.alive && !s.remove && !s.isPlayer && !s.hero && !s.mount && !s.downed && !s.deck && !s.para && !s.driverDuty && !s.marine && !s.marksman && !s.warBoard && !s.zipGo && !s.zipTrip && !s.revTgt && !s.boardTarget && !s.finLock && !s.finGo && !(s.target && s.target.alive && s.target.pos.distanceTo(s.pos) < 45);
const trDist = (a, x, z) => Math.hypot(a.x - x, a.z - z);
const onMesa = p => Math.hypot(p.x - CITYC.x, p.z - CITYC.z) < MESA.r0 - 6;
const trMarinaCP = () => CPS.find(c => c.id === 'marina');

/* ---------- a seat on the shuttle: a mount that carries its rider along the tube, hidden aboard ---------- */
class TunRide {
  constructor(s, curve, dir, done) { Object.assign(this, { kind: 'tunnel', name: 'Subway', s, curve, dir, u: dir > 0 ? 0 : 1, L: curve.getLength(), alive: true, hideRiders: true, riders: [s], pos: new V3(), done, yaw: 0 }); }
  saddle(out) { this.curve.getPointAt(this.u, out); out.y -= 4; this.pos.copy(out); return out; }
  dismount(who) { if (who !== this.s) return; this.alive = false; who.mount = null; who.hitR = true; this.riders = []; }
}
const TUN_RIDES = [];
function tunBoard(s, dir) {
  const T0 = AERIS.tun; if (!T0) return;
  if (s.mount) s.mount.dismount(s); const r = new TunRide(s, T0.C1, dir, () => {}); s.mount = r; s.target = null; s.hitR = false; r.saddle(s.pos); TUN_RIDES.push(r);
}
function tunArrive(r) {
  const s = r.s, T0 = AERIS.tun; r.alive = false; s.mount = null; s.hitR = true;
  if (r.dir > 0) { const M = T0.Ms; s.pos.set(M.x + rand(-5, 5), 0, M.z + rand(-5, 5)); s.pos.y = surfY(s.pos.x, s.pos.z, s.pos.y + 30); } /* up the stairs at the marina station */
  else { const rp = BUNKER.ramp; s.pos.set((rp.x0 + rp.x1) / 2 + rand(-3, 3), 0, rp.z1 - 12); s.pos.y = surfY(s.pos.x, s.pos.z, BUNKER.floor + 2); } /* off at the bunker platform */
  s.trCool = TIME + 20; s.goalT = 0; s.think = 0;
}
function updateTunRides(dt) {
  for (let i = TUN_RIDES.length - 1; i >= 0; i--) {
    const r = TUN_RIDES[i], s = r.s;
    if (!r.alive || !s.alive || s.mount !== r) { if (s.mount === r) { s.mount = null; s.hitR = true; } TUN_RIDES.splice(i, 1); continue; }
    r.u = clamp(r.u + r.dir * 30 * dt / r.L, 0, 1); r.saddle(s.pos);
    if ((r.dir > 0 && r.u >= 1) || (r.dir < 0 && r.u <= 0)) { tunArrive(r); TUN_RIDES.splice(i, 1); }
  }
}

/* ---------- who goes where ---------- */
function trPlan(s) {
  const dest = wlDest(s); if (!dest) return null; const T0 = AERIS.tun, L = BUNKER.lift, low = s.pos.y < 40, mar = trMarinaCP();
  const gateD = trDist(TR.gate, s.pos.x, s.pos.z), inHall = inBunker(s.pos.x, s.pos.z) && low;
  if (low && onMesa(dest) && (inHall || (gateD < 150 && s.pos.z > CITYC.z + 120))) return { kind: 'liftUp', x: L.x, z: L.z + 7 };            /* in by the gate, up the shaft */
  if (s.pos.y > MESA.top - 30 && trDist({ x: L.x, z: L.z - 9 }, s.pos.x, s.pos.z) < 70 && !onMesa(dest) && dest.z > CITYC.z + 150) return { kind: 'liftDown', x: L.x, z: L.z - 9 }; /* down the shaft, out of the gate */
  if (T0 && low && (inHall || gateD < 90) && dest === mar) { const rp = BUNKER.ramp; return { kind: 'subOut', x: (rp.x0 + rp.x1) / 2, z: rp.z1 - 10 }; }  /* down the ramp, the shuttle to the marina */
  if (T0 && trDist(T0.Ms, s.pos.x, s.pos.z) < 70 && (onMesa(dest) || trDist(TR.gate, dest.x, dest.z) < 120)) return { kind: 'subIn', x: T0.Ms.x, z: T0.Ms.z }; /* the shuttle home to the bunker */
  return null;
}
function trScan() {
  let n = TUN_RIDES.length + (typeof NET_RIDES !== 'undefined' ? NET_RIDES.length : 0); for (const e of ENTS) if (e.kind === 'soldier' && e.alive && (e.trGo || (e.mount && e.mount.L === TR.lift))) n++;
  TR.n = n; if (n >= TR.MAX) return;
  for (const s of ENTS) {
    if (n >= TR.MAX) break; if (!trOk(s) || s.trGo || (s.trCool || 0) > TIME || s.hurtT > 0) continue;
    const P = trPlan(s); if (!P) continue; s.trGo = P; s.trGoT = 30; n++;
  }
}
{
  const _upd = Soldier.prototype.update;
  Soldier.prototype.update = function (dt) {
    const P = this.trGo;
    if (P && this.alive && !this.downed && !this.mount) {
      if ((this.trGoT -= dt) <= 0 || this.finLock || (this.target && this.target.alive && this.target.pos.distanceTo(this.pos) < 25)) { this.trGo = null; this.trCool = TIME + 25; }
      else if (Math.hypot(P.x - this.pos.x, P.z - this.pos.z) < 3.6) {
        this.trGo = null; this.trCool = TIME + 25;
        if (P.kind === 'liftUp' && TR.lift && TR.lift.on) zipHop(this, TR.lift, 0, s => { s.goalT = 0; s.think = 0; });
        else if (P.kind === 'liftDown' && TR.lift && TR.lift.on) zipHop(this, TR.lift, 1, s => { s.goal.set(TR.gate.x, 0, TR.gate.z + 20); s.goalT = 6; });
        else if (P.kind === 'subOut') tunBoard(this, 1);
        else if (P.kind === 'subIn') tunBoard(this, -1);
        else if (P.kind === 'net' && typeof netBoard === 'function') netBoard(this, P); /* the island network (network.js) */
      } else { this.goal.set(P.x, 0, P.z); this.goalT = 3; this.target = null; if (this.think < 0.25) this.think = 0.25; }
    }
    return _upd.call(this, dt);
  };
  const _uz = updateZips;
  updateZips = function (dt) { _uz(dt); if (GAME.state !== 'play') return; updateTunRides(dt); if ((TR.t -= dt) <= 0) { TR.t = 0.5; trScan(); } };
}
