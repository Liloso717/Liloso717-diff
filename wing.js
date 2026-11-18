'use strict';
/* ===================== IRON MERIDIAN · the wing: six flying sidekicks =====================
   The moment you take off, six caped fliers streak in from behind and form up on you: two off each wing, two below.
   While you are in the air they fight for you:
   · each one picks an enemy within 240 m of you (aircraft and armour first, then troops) and fires bursts of bolts;
   · every few seconds one of them sends a homing missile into a vehicle or an aircraft;
   · they keep their own targets apart, so up to six enemies are under fire at once.
   They cannot be shot down. Land and they peel off into the sky; take off again and they are back.
   Their kills count as yours. */
const WING = { taken: new Set(), on: false, msgT: -99, mates: [], fwd: new V3(), rgt: new V3(), tgt: new V3(), tmp: new V3(), tmp2: new V3(), q: new T.Quaternion(), m: new T.Matrix4() };
{
  const defs = [
    { name: 'Vane', col: 0x46c8ff, glow: [0.6, 1.6, 3.4], slot: [-6.5, 0.8, 1] },
    { name: 'Kestrel', col: 0xffc04a, glow: [3.2, 2.0, 0.6], slot: [6.5, 0.8, 1] },
    { name: 'Ember', col: 0xff5a4a, glow: [3.4, 0.9, 0.6], slot: [0, -3.2, 3] },
    { name: 'Talon', col: 0x5aff8a, glow: [0.7, 3.2, 1.1], slot: [-12, 2.5, 7] },
    { name: 'Nova', col: 0xb07aff, glow: [2.2, 1.0, 3.6], slot: [12, 2.5, 7] },
    { name: 'Rook', col: 0xe8ecf2, glow: [2.6, 2.8, 3.2], slot: [0, -6.5, 9] },
  ];
  /* a flier in the classic pose: body level, one fist forward, legs trailing, +z is ahead */
  const body = mergeGeos([
    new T.BoxGeometry(0.85, 0.48, 1.3),                                   /* torso */
    xf(new T.SphereGeometry(0.3, 10, 8), [0, 0.12, 0.92]),                /* head */
    xf(new T.BoxGeometry(0.22, 0.22, 1.05), [0.3, 0.05, 1.45]),           /* the fist out front */
    xf(new T.BoxGeometry(0.22, 0.22, 0.9), [-0.5, -0.05, 0.2], [0, 0, 0.3]), /* the other arm at the side */
    xf(new T.BoxGeometry(0.28, 0.28, 1.35), [0.19, -0.02, -1.25]),        /* legs */
    xf(new T.BoxGeometry(0.28, 0.28, 1.35), [-0.19, -0.02, -1.25]),
    xf(new T.BoxGeometry(1.1, 0.2, 0.5), [0, 0.3, 0.35]),                 /* shoulder armour */
  ]);
  const visor = xf(new T.BoxGeometry(0.42, 0.1, 0.08), [0, 0.16, 1.2]);
  const cape = new T.PlaneGeometry(1.2, 2.4, 1, 4); cape.translate(0, -1.2, 0); cape.rotateX(-Math.PI / 2);
  const glowM = new T.SpriteMaterial({ map: glowTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
  const N = defs.length;
  defs.forEach((d, i) => {
    const g = new T.Group(), pivot = new T.Group();
    const armor = std(0x2a2f38, 0.45, 0.6), acc = std(d.col, 0.4, 0.3, { emissive: d.col, emissiveIntensity: 0.35 });
    const b = new T.Mesh(body, armor); pivot.add(b);
    const v = new T.Mesh(visor, new T.MeshBasicMaterial({ color: new T.Color(d.glow[0], d.glow[1], d.glow[2]) })); pivot.add(v);
    const cp = new T.Mesh(cape, std(d.col, 0.8, 0.05, { side: T.DoubleSide, emissive: d.col, emissiveIntensity: 0.15 })); cp.position.set(0, 0.26, 0.5); pivot.add(cp);
    const jm = glowM.clone(); jm.color = new T.Color(d.glow[0], d.glow[1], d.glow[2]);
    const jet = new T.Sprite(jm); jet.position.set(0, 0, -2.05); jet.scale.setScalar(2.2); pivot.add(jet);
    pivot.scale.setScalar(1.35); g.add(pivot); g.visible = false; g.frustumCulled = false; scene.add(g);
    WING.mates.push({ ...d, i, g, pivot, cape: cp, jet, pos: new V3(), vel: new V3(), here: false, leave: 0, tgt: null, pickT: 0, burst: 0, shotT: 0, coolT: rand(0.3, 1), misT: 3 + i * 2.2, bank: 0, fdir: new V3(0, 0, 1) });
  });
}
const _wingL = new V3();
function wingThreats(pe, R) {
  const L = [];
  for (const e of ENTS) {
    if (!e.alive || e.downed || !e.hitR || !isHostile(e.team) || e.remove) continue;
    const d = e.pos.distanceTo(pe.pos); if (d > R) continue;
    const big = isAir(e) || e.kind === 'tank' || e.kind === 'walker' || e.kind === 'naval' || e.kind === 'monster' || e.kind === 'shiftframe' || e.kind === 'speeder';
    L.push({ e, s: d - (big ? 90 : 0) - (e.target === pe ? 60 : 0) });
  }
  return L.sort((a, b) => a.s - b.s);
}
function wingArrive(pe) {
  camDir(WING.fwd); WING.fwd.y = 0; if (WING.fwd.lengthSq() < 1e-4) WING.fwd.set(0, 0, 1); WING.fwd.normalize();
  for (const m of WING.mates) { /* streak in from behind and below */
    m.pos.copy(pe.pos).addScaledVector(WING.fwd, -90 - m.i * 15).add(WING.tmp.set(m.slot[0] * 3, -12 + m.slot[1], 0));
    m.pos.y = Math.max(m.pos.y, surfY(m.pos.x, m.pos.z, m.pos.y) + 4);
    m.vel.copy(WING.fwd).multiplyScalar(90); m.here = true; m.leave = 0; m.g.visible = true; m.tgt = null; m.pickT = 0;
  }
  if (TIME - WING.msgT > 25) { WING.msgT = TIME; comms('WING', 'Vane, Kestrel, Ember, Talon, Nova and Rook on your wing. We have your back.', 'b'); }
  snd('ui', null, 0.3);
}
function wingFire(m, pe) { /* like a trooper's rifle: roll the hit, the bolt shows it */
  const t = m.tgt.e; t.aim(WING.tgt); const from = WING.tmp2.copy(m.pos).addScaledVector(m.fdir, 2.4);
  const d = from.distanceTo(WING.tgt), soft = t.kind === 'soldier';
  if ((m.losT = (m.losT || 0) - 1) <= 0) { m.losT = 4; m.los = losClear(from, WING.tgt.clone()); } /* every few shots: no firing through a mountain */
  if (!m.los) { m.pickT = 0; return; }
  const hit = Math.random() < (soft ? 0.62 : 0.8) - d / 1200;
  if (!hit) WING.tgt.add(randDir(_wingL).multiplyScalar(1 + d * 0.025));
  fireProj({ from, to: WING.tgt, speed: 520, kind: 'bullet', team: 1, w: 0.2, len: 6, color: m.glow, checkEnts: false });
  if (hit) { t.damage(soft ? 34 : 70, pe, 'bolt'); if (!soft && Math.random() < 0.3) fxSparks(WING.tgt, 3, m.glow, 8); }
  fxMuzzle(from, m.glow);
  if (camera.position.distanceTo(from) < 120 && Math.random() < 0.5) snd('laser', from, 0.18);
}
function wingMissile(m, pe) {
  const t = m.tgt.e; t.aim(WING.tgt); const from = WING.tmp2.copy(m.pos).add(WING.tmp.set(0, -0.6, 0));
  fireProj({ from, to: WING.tgt, vel: WING.tmp.copy(m.fdir).multiplyScalar(60).add(_wingL.set(0, 12, 0)), speed: 140, kind: 'missile', team: 1, src: pe, dmg: 320, splash: 6, w: 0.3, len: 2, color: m.glow, homing: 2.4, target: t, maxDist: 600, fx: 1.5 });
  snd('missile', from, 0.4);
}
function wingTick(dt) {
  const pe = PLAYER.ent, flying = GAME.state === 'play' && pe && pe.alive && (POW.fly || (typeof RIDE !== 'undefined' && RIDE.on)) && !pe.mount && PLAYER.role === 'trooper'; /* riding a walker or an aircraft counts as up in the air */
  if (flying && !WING.on) { WING.on = true; wingArrive(pe); }
  else if (!flying && WING.on) { WING.on = false; for (const m of WING.mates) m.leave = 2.5; }
  if (!WING.mates.some(m => m.here)) return;
  const P = pe && pe.alive ? pe.pos : camera.position;
  camDir(WING.fwd); WING.fwd.y = 0; if (WING.fwd.lengthSq() < 1e-4) WING.fwd.set(0, 0, 1); WING.fwd.normalize();
  WING.rgt.set(-WING.fwd.z, 0, WING.fwd.x);
  /* who to shoot: a shared list, handed out so each takes a different enemy */
  let threats = null;
  const taken = WING.taken; taken.clear(); for (const m of WING.mates) if (m.tgt) taken.add(m.tgt.e);
  for (const m of WING.mates) {
    if (!m.here) continue;
    /* where to be */
    if (m.leave > 0) { m.leave -= dt; WING.tgt.copy(m.pos).add(WING.tmp.copy(m.vel).setY(0).normalize().multiplyScalar(60)).add(WING.tmp.set(0, 45, 0)); if (m.leave <= 0) { m.here = false; m.g.visible = false; continue; } }
    else WING.tgt.copy(P).addScaledVector(WING.rgt, m.slot[0]).addScaledVector(WING.fwd, m.slot[2]).add(WING.tmp.set(0, m.slot[1] + Math.sin(TIME * 1.3 + m.i * 2) * 0.6, 0));
    /* a spring with a speed cap: they keep up with you at full speed, settle gently when you hover */
    const toX = WING.tgt.x - m.pos.x, toY = WING.tgt.y - m.pos.y, toZ = WING.tgt.z - m.pos.z, dist = Math.hypot(toX, toY, toZ);
    const want = WING.tmp.set(toX, toY, toZ).multiplyScalar(dist > 0.01 ? Math.min(260, dist * 2.2) / dist : 0);
    m.vel.lerp(want, 1 - Math.exp(-dt * (m.leave > 0 ? 1.5 : 3.2)));
    if (dist > 400 && m.leave <= 0) { m.pos.copy(WING.tgt).addScaledVector(WING.fwd, -60); m.vel.copy(WING.fwd).multiplyScalar(80); } /* lost you (a dive, a teleport): catch up */
    m.pos.addScaledVector(m.vel, dt);
    const g = surfY(m.pos.x, m.pos.z, m.pos.y); if (m.pos.y < g + 3) { m.pos.y = g + 3; if (m.vel.y < 0) m.vel.y = 0; }
    if (m.pos.y < 230 && buildingAt(m.pos)) { m.pos.y += 40 * dt; m.vel.y = Math.max(m.vel.y, 12); }
    /* which way to face: along the flight when moving, at the target when firing, otherwise with you */
    const sp = m.vel.length();
    if (m.tgt && m.tgt.e.alive && sp < 40 && m.leave <= 0) m.tgt.e.aim(WING.tmp2), WING.tmp2.sub(m.pos).normalize(), m.fdir.lerp(WING.tmp2, 1 - Math.exp(-dt * 6));
    else if (sp > 6) m.fdir.lerp(WING.tmp2.copy(m.vel).divideScalar(sp), 1 - Math.exp(-dt * 5));
    else m.fdir.lerp(WING.fwd, 1 - Math.exp(-dt * 3));
    m.fdir.normalize();
    const turn = WING.tmp2.copy(m.vel).cross(m.fdir).y; m.bank = lerp(m.bank, clamp(-turn * 0.012, -0.9, 0.9), 1 - Math.exp(-dt * 4));
    m.g.position.copy(m.pos); WING.m.lookAt(WING.tmp.set(0, 0, 0), WING.tmp2.copy(m.fdir).negate(), UP); m.g.quaternion.setFromRotationMatrix(WING.m);
    m.pivot.rotation.z = m.bank; m.pivot.rotation.x = sp < 25 ? lerp(m.pivot.rotation.x, -0.9, 1 - Math.exp(-dt * 3)) : lerp(m.pivot.rotation.x, 0, 1 - Math.exp(-dt * 3)); /* upright when hovering */
    m.cape.rotation.x = Math.sin(TIME * 9 + m.i) * 0.12 + (sp > 40 ? 0.05 : 0.45);
    m.jet.scale.setScalar(1.6 + Math.min(2.4, sp / 60) + Math.random() * 0.3);
    if (!LOW_END && sp > 30 && Math.random() < 0.5) FXA.spawn(m.pos.x - m.fdir.x * 3, m.pos.y - m.fdir.y * 3, m.pos.z - m.fdir.z * 3, 0, 0, 0, 0.25, 0.9, 0.2, m.glow[0], m.glow[1], m.glow[2], m.glow[0] * 0.4, m.glow[1] * 0.4, m.glow[2] * 0.4, 1, 0, 0);
    if (m.leave > 0 || !pe || !pe.alive) continue;
    /* targets */
    if ((m.pickT -= dt) <= 0 || !m.tgt || !m.tgt.e.alive || m.tgt.e.downed || m.tgt.e.pos.distanceTo(P) > 280) {
      m.pickT = 1.2; threats = threats || wingThreats(pe, 240);
      taken.delete(m.tgt && m.tgt.e); m.tgt = threats.find(o => !taken.has(o.e)) || threats[0] || null; if (m.tgt) taken.add(m.tgt.e);
    }
    if (!m.tgt) continue;
    /* bursts of bolts, and now and then a missile into something armoured */
    if (m.burst > 0) { if ((m.shotT -= dt) <= 0) { m.shotT = 0.11; m.burst--; wingFire(m, pe); if (!m.burst) m.coolT = rand(0.7, 1.3); } }
    else if ((m.coolT -= dt) <= 0) m.burst = 5;
    if ((m.misT -= dt) <= 0) { m.misT = rand(5, 7); if (m.tgt.e.kind !== 'soldier') wingMissile(m, pe); }
  }
}
{ const _gt = godTick; godTick = function (dt) { _gt(dt); wingTick(dt); }; }
