'use strict';
/* ===================== IRON MERIDIAN · rules of the realms: one big battle at a time, the right machines for it ===================== */
//  · ONE BATTLE  · every army marches on the active theatre's objective; the themed warfare (artillery, naval guns,
//                  flak, turbolasers) and the support units (air wings, battle fleets, orbital squadrons) belong to it
//  · MACHINES    · LAND  · everything that drives or walks, plus aircraft overhead
//                  OCEAN · jets, gunships, Shiftframes and battleships. Land vehicles stop at the water's edge (no
//                          dirt bikes on the waves, no walkers, no cars, no tanks)
//                  AIR   · aircraft
//                  SPACE · starships and orbital fighters only. A shimmering barrier at the edge of space (1250 m)
//                          bounces spacecraft back up and stops jets climbing into orbit. People pass through it:
//                          bail out of a starship, or walk off the Leviathan's drop bay or Zenith's drop gate, and
//                          skydive all the way down, re-entry flames and all, steering for land or ocean
//  · BATTLESHIPS · take the helm of a friendly destroyer from the console on the Floating Marina pier: WASD to steer
//                  and throttle, LMB fires a broadside where you aim, E hands the ship back
const LAND_VEH = { transport: 1, tank: 1, walker: 1, speeder: 1 };
/* a capital hull — a battleship-class spacecraft — is big enough to come down through the barrier and park over the
   island, hull glowing with re-entry. Anything smaller bounces off it. */
const capitalHull = e => (e.radius || 0) > 30 || e.capital || e.flag;
const RR = { noteT: 0, helm: null };
function realmNote(text) { if (TIME - RR.noteT < 4) return; RR.noteT = TIME; banner('Realm rules', text, 'var(--amber)'); snd('tick', null, 0.6); }
const playerIn = e => e.isPlayer || (e.riders && e.riders[0] && e.riders[0].isPlayer);
function realmRules() {
  for (const e of ENTS) {
    if (!e.alive || e.tumble) continue;
    if (LAND_VEH[e.kind] && !e.auto) { /* land machines stay on land */
      if (e.pos.y < 300 && H(e.pos.x, e.pos.z) < -1.5) { if (e.dry) { e.pos.x = e.dry.x; e.pos.z = e.dry.z; if (e.obj) e.obj.position.copy(e.pos); } if (e.speed !== undefined) e.speed *= -0.3; if (playerIn(e)) realmNote('Land vehicles stay on land. Ocean battles take jets, gunships, Shiftframes or a battleship.'); }
      else (e.dry || (e.dry = new V3())).copy(e.pos);
    } else if (e.kind === 'starship' && e.pos.y < BARRIER_Y + 2 && !capitalHull(e)) { /* small craft stay in orbit: the barrier bounces them back up */
      e.pos.y = BARRIER_Y + 2; if (e.vel && e.vel.y < 0) { barrierHit(e, Math.min(1.6, -e.vel.y / 30)); e.vel.y = -e.vel.y * 0.45 + 4; }
      if (playerIn(e)) realmNote('Corsairs cannot break the atmosphere. Only the big hulls come down. Jump (E) and skydive.');
    } else if (e.kind === 'fighter') {
      if (!e.orbital && e.pos.y > BARRIER_Y - 12) { e.pos.y = BARRIER_Y - 12; if (e.dir && e.dir.y > 0) { barrierHit(e, 0.8); e.dir.y = -0.2; e.dir.normalize(); } if (playerIn(e)) realmNote('Jets cannot climb into orbit. Fly up yourself — the barrier does not stop a Hero.'); }
      else if (e.orbital && e.pos.y < BARRIER_Y + 4) { e.pos.y = BARRIER_Y + 4; if (e.dir && e.dir.y < 0) { barrierHit(e, 0.8); e.dir.y = 0.2; e.dir.normalize(); } }
    }
  }
}
/* ---------- the helm console on the Floating Marina pier (scenery) ---------- */
const HELM = new V3(B_X - 44, B_Y, B_Z + 8);
(function helmConsole() { const g = new T.Group(); g.position.copy(HELM); g.add(new T.Mesh(new T.BoxGeometry(1.6, 1.2, 0.8).translate(0, 0.6, 0), MAT_GUN)); g.add(new T.Mesh(new T.BoxGeometry(1.4, 0.7, 0.1).translate(0, 1.5, 0.2).rotateX(-0.4), basic(new T.Color(0.4, 2.6, 2.4)))); scene.add(g); })();
/* (the console is scenery now: there is no key to take the helm, so the warship controls that hung off it are gone) */
/* ---------- the edge of space: a barrier for machines, a doorway for skydivers ---------- */
const BARRIER_Y = 1250, BAR = { u: null, lastY: 0, flameT: 0, said: 0 };
(function barrier() {
  const u = BAR.u = { hits: { value: Array.from({ length: 6 }, () => new T.Vector4(0, 0, -99, 0)) }, time: { value: 0 }, near: { value: new T.Vector3(0, 0, 0) } };
  const m = new T.Mesh(new T.PlaneGeometry(3800, 3800).rotateX(-Math.PI / 2), new T.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
    vertexShader: `varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec4 hits[6]; uniform float time; uniform vec3 near; varying vec2 vW;
      void main(){ vec2 g = abs(fract(vW / 22.) - .5); float line = smoothstep(.45, .5, max(g.x, g.y)); float a = 0.;
        for (int i = 0; i < 6; i++) { float age = time - hits[i].z; if (age < 0. || age > 2.5) continue; float d = length(vW - hits[i].xy), f = 1. - age / 2.5;
          a += (exp(-pow((d - age * 80.) / 9., 2.)) * .9 + exp(-d / 26.) * (.3 + line)) * f * hits[i].w; }
        float dn = length(vW - near.xy); a += near.z * (line * exp(-dn / 140.) * .8 + exp(-dn / 50.) * .1);
        gl_FragColor = vec4(vec3(.45, .78, 1.7) * a * (1. - smoothstep(1500., 1900., max(abs(vW.x), abs(vW.y)))), 1.); ${OUT} }` }));
  m.position.y = BARRIER_Y; m.frustumCulled = false; m.renderOrder = 4; scene.add(m);
})();
function barrierHit(e, k) { /* a ripple across the field where something touched it */
  if ((e.barT || 0) > TIME) return; e.barT = TIME + 0.4; const p = e.pos, hs = BAR.u.hits.value, h = hs.reduce((a, b) => (a.z < b.z ? a : b)); h.set(p.x, p.z, TIME, k);
  if (camera.position.distanceTo(p) < 900) { fxSparks(_v1.set(p.x, BARRIER_Y, p.z), 26, [1.2, 2.2, 3.6], 16); snd('zap', p, 0.7); flashLight(_v1, 5, 110, 0.3, 0x7cc8ff); }
}
function skydiveFx(dt) { /* crossing the barrier, re-entry flames, the wind */
  const P = PLAYER, e = P.ent; BAR.u.time.value = TIME;
  const v = e && P.role !== 'trooper' ? e : null, vk = v && (v.kind === 'starship' || (v.kind === 'fighter' && v.orbital)) ? clamp(1 - Math.abs(v.pos.y - BARRIER_Y) / 180, 0, 1) : 0;
  BAR.u.near.value.set(v ? v.pos.x : 0, v ? v.pos.z : 0, vk);
  if (!e || P.role !== 'trooper' || !e.alive) { BAR.lastY = 0; return; }
  if (BAR.lastY > BARRIER_Y && e.pos.y <= BARRIER_Y) { barrierHit(e, 1.4); shake(0.4); if (TIME - BAR.said > 30) { BAR.said = TIME; banner('Re-entry', 'Through the edge of space · WASD to steer for land or ocean · SPACE opens the chute', 'var(--amber)'); } }
  BAR.lastY = e.pos.y;
  if (P.free && P.vy < -120 && e.pos.y < BARRIER_Y && e.pos.y > 300) { /* the air catches fire around you */
    for (let i = 0; i < 3; i++) FXA.spawn(e.pos.x + rand(-1.2, 1.2), e.pos.y - 1.5 + rand(-0.6, 0.6), e.pos.z + rand(-1.2, 1.2), rand(-3, 3), -P.vy * 0.35, rand(-3, 3), rand(0.25, 0.5), rand(1.6, 3), rand(0.4, 1), 3.4, 1.4, 0.3, 1.4, 0.3, 0.06, 1, 0.6, 0);
    if ((BAR.flameT -= dt) <= 0) { BAR.flameT = 0.5; snd('missile', null, 0.25); shake(0.12); }
  }
}
mountHint = (prev => function (pe) { /* the skydive readout */
  const P = PLAYER; if (pe.kind === 'soldier' && !pe.mount && (P.free || (!P.grounded && !P.para && pe.pos.y > 1260))) { const alt = Math.round(pe.pos.y - surfY(pe.pos.x, pe.pos.z, pe.pos.y)), sea = H(pe.pos.x, pe.pos.z) < -1;
    if (pe.pos.y > BARRIER_Y) return `In orbit · ${alt} m up · falling for the edge of space · steer with WASD`;
    if (alt > 120) return `Skydive · ${alt} m · over ${sea ? 'OCEAN' : 'LAND'} · WASD to steer · SPACE opens the chute`; }
  return prev(pe);
})(mountHint);
function updateRealmRules(dt) { realmRules(); skydiveFx(dt); }
