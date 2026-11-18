'use strict';
/* ===================== IRON MERIDIAN · jump, and riding the convoy =====================
   JUMP (the button left of BOOST, or the J key): a hero's leap, nearly 4 m straight up, carrying whatever speed you
   have. High enough to land on the roof of an evacuation bus, a parked truck's height of wall, or a low ledge.
   The evacuation buses now have roofs you can stand on, like the walkers: jump (or drop) onto one and it carries you
   down the road; you can walk about up there and shoot from it. Jump or fly to get off. Riding a bus counts as
   escorting it, so the convoy keeps rolling, your flying heroes stay with you and the company escorts on the ground. */
const JUMP = { req: 0, V: 13, cd: 0 };
window.addEventListener('keydown', e => { if (e.code === 'KeyJ' && !e.repeat) JUMP.req = 0.2; });
{
  const el = document.getElementById('tJump');
  if (el) el.addEventListener('touchstart', e => { e.preventDefault(); JUMP.req = 0.25; el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 160); }, { passive: false });
  const _up = updatePlayer;
  updatePlayer = function (dt) {
    const P = PLAYER, pe = P.ent; JUMP.cd -= dt;
    if (JUMP.req > 0) { JUMP.req -= dt;
      if (JUMP.cd <= 0 && GAME.state === 'play' && pe && pe.alive && pe.kind === 'soldier' && !pe.mount && P.grounded && !P.pod && !POW.fly && !MOB.mantle) {
        JUMP.req = 0; JUMP.cd = 0.35; P.vy = JUMP.V; P.grounded = false; pe.pos.y += 0.05; if (MOB.slide > 0) MOB.slide = 0;
        fxDust(pe.pos, 4, 1.5, 3); snd('stomp', null, 0.25);
      } }
    _up(dt);
  };
  /* the buses join the machines you can stand on */
  const _uw = updateWorld;
  updateWorld = function (dt) {
    _uw(dt); const pe = PLAYER.ent; if (!pe || !pe.alive || typeof EVAC === 'undefined') return;
    for (const b of EVAC.buses) { if (!b.alive || !b.g.visible) continue;
      if (!b.obj) { b.obj = b.g; b.kind = 'bus'; RIDE.box.set(b, { top: 3.2, hx: 1.4, hz: 4.6, cx: 0, cz: 0 }); }
      if (Math.abs(b.pos.x - pe.pos.x) < 80 && Math.abs(b.pos.z - pe.pos.z) < 80) RIDE.cand.push(b); }
  };
}
