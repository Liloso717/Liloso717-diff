'use strict';
/* ===================== IRON MERIDIAN · ragdolls: the dead fall the way they were hit ===================== */
// A trooper who dies is thrown by whatever killed him: a rifle round knocks him back a step, a blade spins him, a
// grenade, rocket, shell or crash launches him tumbling through the air. The body flips and spins with real momentum,
// bounces and skids when it lands, the legs flail in the air and go limp on the ground, and it settles on its back or
// face down. Low gravity in orbit sends the dead drifting; bodies thrown off a platform fall all the way down.
const RAG = { blast: null };
{ /* remember where the last explosion was, so splash deaths fly away from it */
  const _ed = explodeDamage;
  explodeDamage = function (p, radius, dmg, src, team, skip) { RAG.blast = { p: p.clone(), dmg, t: TIME }; return _ed(p, radius, dmg, src, team, skip); };
  const _sdmg = Soldier.prototype.damage;
  Soldier.prototype.damage = function (a, src, type) { this.lastHit = { src, type, a, t: TIME }; return _sdmg.call(this, a, src, type); };
  const _die = Soldier.prototype.die;
  Soldier.prototype.die = function (src) { _die.call(this, src); ragStart(this); };
}
function ragStart(s) {
  if (s.imp || camera.position.distanceTo(s.pos) > 260) return; /* far away: the cheap fall is fine */
  const h = s.lastHit || {}, type = h.type || 'bullet', v = new V3(), src = h.src && h.src.pos ? h.src.pos : null;
  let from = null, power = 3;
  if ((type === 'splash' || type === 'burn') && RAG.blast && TIME - RAG.blast.t < 0.2) { from = RAG.blast.p; power = clamp(RAG.blast.dmg / 14, 6, 18); }
  else if (type === 'crash' || type === 'ram') { from = src; power = 12; }
  else if (type === 'blade' || type === 'melee') { from = src; power = 5; }
  else { from = src; power = h.a > 60 ? 4.5 : 2.6; }
  if (from) { v.set(s.pos.x - from.x, 0, s.pos.z - from.z); const l = v.length() || 1; v.multiplyScalar(power / l); } else v.set(rand(-1, 1), 0, rand(-1, 1)).multiplyScalar(power * 0.5);
  v.y = power > 5 ? power * rand(0.55, 0.9) : rand(0.5, 1.8);
  const back = from ? Math.cos(Math.atan2(v.x, v.z) - s.yaw) < 0 : Math.random() < 0.5; /* thrown backwards → lands on his back */
  s.rag = { v, rx: 0, rz: 0, ax: (back ? -1 : 1) * (power > 5 ? rand(4, 9) : rand(2, 3.5)), az: rand(-1, 1) * (power > 5 ? 6 : 1.5), ay: rand(-1, 1) * (type === 'blade' ? 6 : power > 5 ? 3 : 0.6), ground: false, bounces: 0, rest: back ? -1.5 : 1.45, legs: [rand(0, 6), rand(0, 6)], t: 0 };
  s.obj.rotation.order = 'YXZ';
}
{
  const _upd = Soldier.prototype.update;
  Soldier.prototype.update = function (dt) {
    const R = this.rag; if (this.alive || !R) return _upd.call(this, dt);
    this.deadT += dt; R.t += dt; const g = this.pos.y > 1200 ? 5.5 : 22;
    if (!R.ground) {
      R.v.y -= g * dt; this.pos.addScaledVector(R.v, dt); R.rx += R.ax * dt; R.rz += R.az * dt; this.yaw += R.ay * dt;
      const fy = Math.max(surfY(this.pos.x, this.pos.z, this.pos.y + 0.5), typeof roofUnder === 'function' ? roofUnder(this.pos) : -1e9);
      pushOut(this.pos, 0.4);
      if (this.pos.y <= fy) {
        this.pos.y = fy; R.bounces++;
        if (R.v.y < -6 && R.bounces < 3) { R.v.y = -R.v.y * 0.28; R.v.x *= 0.55; R.v.z *= 0.55; R.ax *= 0.5; R.az *= 0.5; fxDust(_v1.copy(this.pos), 4, 2, 4); if (camera.position.distanceTo(this.pos) < 60) snd('stomp', this.pos, 0.25); }
        else { R.ground = true; R.v.y = 0; }
      }
    } else { /* skid to a stop, settle flat */
      const fr = Math.exp(-dt * 6); R.v.x *= fr; R.v.z *= fr; this.pos.x += R.v.x * dt; this.pos.z += R.v.z * dt; pushOut(this.pos, 0.4); this.pos.y = Math.max(surfY(this.pos.x, this.pos.z, this.pos.y + 0.5), typeof roofUnder === 'function' ? roofUnder(this.pos) : -1e9);
      const k = Math.min(1, dt * 7); R.rx = lerp(R.rx, R.rest + Math.round((R.rx - R.rest) / (Math.PI * 2)) * Math.PI * 2, k); R.rz = lerp(R.rz, Math.round(R.rz / Math.PI) * Math.PI * 0 + rand(-0.15, 0.15) * 0.1, k);
    }
    if (this.pos.y < -1.2 && H(this.pos.x, this.pos.z) < 0) { this.pos.y = Math.max(this.pos.y, -1.2); R.ground = true; } /* floats at the surface */
    this.obj.position.copy(this.pos); this.obj.position.y += R.ground ? 0.15 : 0.6; this.obj.rotation.set(R.rx, this.yaw, R.rz, 'YXZ'); if (this.body) this.body.position.y = 0;
    if (this.legs) { const air = !R.ground; for (let i = 0; i < 2; i++) { const L = this.legs[i]; R.legs[i] += dt * (air ? 14 : 0); L.th.rotation.x = air ? Math.sin(R.legs[i]) * 0.9 : lerp(L.th.rotation.x, i ? 0.35 : -0.15, Math.min(1, dt * 5)); L.th.rotation.z = air ? Math.cos(R.legs[i] * 0.7) * 0.4 : lerp(L.th.rotation.z, (i ? 1 : -1) * 0.25, Math.min(1, dt * 5)); L.sh.rotation.x = air ? 0.4 + Math.sin(R.legs[i] + 1) * 0.6 : lerp(L.sh.rotation.x, 0.25, Math.min(1, dt * 5)); } }
    if (this.deadT > 7) this.obj.position.y -= (this.deadT - 7) * 0.8; if (this.deadT > 9) this.remove = true; /* sink away and go */
  };
}
