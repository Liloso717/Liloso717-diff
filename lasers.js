'use strict';
/* ===================== IRON MERIDIAN · laser eyes: the Hero's glasses fire =====================
   Power 6 (the 6 key, the LASER pad). The lenses flare and two beams leave them for wherever you are looking, for
   a few seconds; sweep the crosshair and the beams follow. Whatever they touch burns: troops drop, armour takes a
   steady cut, walls are carved, the ground is scorched black and smoulders. Then the glasses need to cool. */
KIT.push(['E', 'Laser eyes', '6']); GOD.cd.E = 0; GOD_CD.E = 1; /* the primary weapon: hold to burn, no cooldown */
PLAY_KEYS.add('Digit6'); TAP_KEYS.add('Digit6');
KEYS.splice(KEYS.findIndex(k => k[0] === '5') + 1, 0, ['Left click / hold 6', 'LASER EYES, your main weapon · hold to fire, sweep the beams with your aim']);
{ const kl = document.getElementById('keyList'); if (kl) kl.innerHTML = KEYS.map(([k, v]) => `<kbd>${k}</kbd><span>${v}</span>`).join(''); }
const LZ = { zoom: false, hold: { touch: false, mouse: false, key: false }, on: false, t: 0, dur: 3.2, tick: 0, flashT: 0, scorchT: 0, eyes: [new V3(), new V3()], hit: new V3(), beams: [], glows: [], spot: null };
{
  const core = new T.MeshBasicMaterial({ color: new T.Color(4, 0.7, 0.35), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const halo = new T.MeshBasicMaterial({ color: new T.Color(2.2, 0.25, 0.1), transparent: true, opacity: 0.4, blending: T.AdditiveBlending, depthWrite: false });
  const g = new T.CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2); /* unit beam along +z, stretched each frame */
  for (let i = 0; i < 2; i++) { const c = new T.Mesh(g, core), h = new T.Mesh(g, halo); c.scale.set(0.05, 0.05, 1); h.scale.set(0.16, 0.16, 1); for (const m of [c, h]) { m.visible = false; m.frustumCulled = false; m.renderOrder = 8; scene.add(m); } LZ.beams.push(c, h); }
  const sm = new T.SpriteMaterial({ map: glowTex, color: new T.Color(3.4, 0.6, 0.3), transparent: true, blending: T.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 3; i++) { const s = new T.Sprite(sm); s.visible = false; s.scale.setScalar(i < 2 ? 0.35 : 4); s.renderOrder = 9; scene.add(s); LZ.glows.push(s); }
  /* the touch pad, next to the other five */
  const st = document.createElement('style');
  st.textContent = `#tP6{right:calc(172px + env(safe-area-inset-right,0px));bottom:calc(240px + env(safe-area-inset-bottom,0px));border-color:rgba(255,93,61,.6)!important}
#tP6 b{color:#ff8a6a!important}
@media (max-height:500px){#tP6{right:calc(130px + env(safe-area-inset-right,0px));bottom:calc(178px + env(safe-area-inset-bottom,0px))}}`;
  document.head.appendChild(st);
  const touch = document.getElementById('touch');
  if (touch && !document.getElementById('tP6')) { const p = document.createElement('div'); p.className = 'tb pw'; p.id = 'tP6'; p.innerHTML = '<b>&#9673;</b>LASER'; touch.appendChild(p);
    /* a tap replays the 6 key, like the other pads: one code path for touch and keyboard */
    /* hold the pad to keep the beams on */
    p.addEventListener('touchstart', e => { e.preventDefault(); LZ.hold.touch = true; }, { passive: false });
    for (const ev of ['touchend', 'touchcancel']) p.addEventListener(ev, e => { e.preventDefault(); LZ.hold.touch = false; }, { passive: false }); }
}
const _lzA = new V3(), _lzB = new V3(), _lzD = new V3();
function lzEyes(pe) { /* the two lenses, in the world: on the Hero rig they sit on the head, 1.87 m up and just ahead of the face */
  const b = pe.body || pe.obj; b.updateWorldMatrix(true, false);
  LZ.eyes[0].set(-0.044, 1.868, 0.14); LZ.eyes[1].set(0.044, 1.868, 0.14); b.localToWorld(LZ.eyes[0]); b.localToWorld(LZ.eyes[1]);
}
function lzStart() { LZ.on = true; LZ.t = 0; LZ.tick = 0; snd('missile', PLAYER.ent.pos, 0.6); shake(0.12); for (const m of LZ.beams) m.visible = true; for (const s of LZ.glows) s.visible = true; }
function lzStop() { LZ.on = false; for (const m of LZ.beams) m.visible = false; for (const s of LZ.glows) s.visible = false; }
function lzTick(dt) {
  const pe = PLAYER.ent;
  if (!pe || !pe.alive || pe.mount || GAME.state !== 'play' || PLAYER.role !== 'trooper') return lzStop();
  LZ.t += dt;
  lzEyes(pe);
  const r = rayCast(camera.position, camDir(_lzD), LZ.zoom ? 1800 : 700, pe, 1), p = LZ.hit.copy(r.point);
  for (let i = 0; i < 2; i++) { /* stretch each beam from its lens to the hit, with a flicker */
    const a = LZ.eyes[i], len = a.distanceTo(p), c = LZ.beams[i * 2], h = LZ.beams[i * 2 + 1], w = 1 + Math.sin(TIME * 60 + i * 2) * 0.25;
    for (const m of [c, h]) { m.position.copy(a); m.lookAt(p); }
    c.scale.set(0.045 * w, 0.045 * w, len); h.scale.set(0.15 * w, 0.15 * w, len);
    LZ.glows[i].position.copy(a);
  }
  LZ.glows[2].position.copy(p); LZ.glows[2].scale.setScalar(3.5 + Math.sin(TIME * 40) * 0.8);
  if ((LZ.tick -= dt) <= 0) { /* the burn, ten times a second */
    LZ.tick = 0.1;
    if (r.ent && r.ent.alive) r.ent.damage(r.ent.kind === 'soldier' ? 34 : 55, pe, 'laser');
    if (r.bld && r.bld.alive) { r.bld.damage(240, pe); if (Math.random() < 0.35) debrisBurst(p, 2, 6, 0.3, 'concrete', { hot: true }); }
    explodeDamage(p, 2.6, 16, pe, 1); /* troops standing in the burn */
    fxSparks(p, nfx(8), [4, 1.4, 0.5], 10);
    if (r.water) fxWaterSplash(p, 0.4);
  }
  if ((LZ.flashT -= dt) <= 0) { LZ.flashT = 0.16; flashLight(_lzA.copy(p).setY(p.y + 1), 3, 18, 0.15, 0xff4020); }
  if (!r.ent && !r.bld && !r.water && (LZ.scorchT -= dt) <= 0) { LZ.scorchT = 0.18; /* a black line burnt across the ground behind the sweep */
    if (typeof addCrater === 'function') addCrater(p.x, p.z, 1.2);
    if (Math.random() < 0.25) FXS.spawn(p.x, p.y + 0.3, p.z, 0, rand(1, 2.5), 0, rand(1, 2), 2.5, 7, 0.25, 0.2, 0.18, 0.1, 0.09, 0.08, 0.6, 0.6, -0.5);
    if (typeof scorchCrops === 'function') scorchCrops(p, 3, true); }
}
{
  const _gt = godTick;
  godTick = function (dt) {
    _gt(dt);
    const pe = PLAYER.ent, ok = GAME.state === 'play' && pe && pe.alive && PLAYER.role === 'trooper' && !pe.mount;
    keys.Digit6 = false; const held = LZ.hold.touch || LZ.hold.mouse || LZ.hold.key;
    if (held && ok && !LZ.on) lzStart(); else if (LZ.on && (!held || !ok)) lzStop();
    if (LZ.on) lzTick(dt);
  };
  const tp = document.getElementById('tP6'); if (tp) setInterval(() => tp.classList.toggle('on', LZ.on), 150);
}
/* hold to fire: the left mouse button and the 6 key on a keyboard */
addEventListener('keydown', e => { if (e.code === 'Digit6') LZ.hold.key = true; });
addEventListener('keyup', e => { if (e.code === 'Digit6') LZ.hold.key = false; });
canvas.addEventListener('mousedown', e => { if (e.button === 0 && !TOUCH.on && GAME.state === 'play' && document.pointerLockElement) LZ.hold.mouse = true; });
addEventListener('mouseup', e => { if (e.button === 0) LZ.hold.mouse = false; });
addEventListener('blur', () => { LZ.hold.touch = LZ.hold.mouse = LZ.hold.key = false; });
/* no sword: the energy blade and its glow are gone from the Hero's hand */
{ const _ah = animateHero; animateHero = function (H, ...a) { if (H.hilt && H.hilt.visible) H.hilt.visible = false; return _ah(H, ...a); }; }
updateBladeLight = function () { BLADE_LIGHT.intensity = 0; };
/* ---------- the scope: zoom in to find and burn enemies far off ----------
   Z on a keyboard (or hold the right mouse button on foot), the ZOOM pad on a phone. About 6x, slower aim, and the
   beams reach 1.8 km instead of 700 m. Enemy markers show much further out while you look through it. */
{
  const st = document.createElement('style');
  st.textContent = `#scope{position:fixed;inset:0;pointer-events:none;z-index:5;display:none;background:radial-gradient(circle at 50% 50%,transparent 0 31vmin,rgba(0,0,0,.55) 33vmin,rgba(0,0,0,.92) 48vmin)}
#scope.on{display:block}
#scope i{position:absolute;background:rgba(255,80,50,.85);box-shadow:0 0 3px #000}
#scope .h{left:calc(50% - 30vmin);right:calc(50% - 30vmin);top:50%;height:1px}
#scope .v{top:calc(50% - 30vmin);bottom:calc(50% - 30vmin);left:50%;width:1px}
#scope .c{left:calc(50% - 3px);top:calc(50% - 3px);width:6px;height:6px;border-radius:50%;background:transparent;border:1.5px solid #ff5a3a}
#scope b{position:absolute;left:50%;top:calc(50% + 32vmin);transform:translateX(-50%);font:700 11px var(--mono,monospace);letter-spacing:.2em;color:#ff8a6a;text-shadow:0 0 3px #000}
#tZoom{right:calc(244px + env(safe-area-inset-right,0px));bottom:calc(240px + env(safe-area-inset-bottom,0px));border-color:rgba(255,93,61,.6)!important}
#tZoom b{color:#ff8a6a!important}#tZoom.on{background:rgba(255,70,40,.35)!important}
@media (max-height:500px){#tZoom{right:calc(186px + env(safe-area-inset-right,0px));bottom:calc(180px + env(safe-area-inset-bottom,0px))}}`;
  document.head.appendChild(st);
  const sc = document.createElement('div'); sc.id = 'scope'; sc.innerHTML = '<i class="h"></i><i class="v"></i><i class="c"></i><b>LASER SCOPE · 6x · 1.8 km</b>'; document.body.appendChild(sc); LZ.scopeEl = sc;
  const touch = document.getElementById('touch');
  if (touch && !document.getElementById('tZoom')) { const p = document.createElement('div'); p.className = 'tb pw'; p.id = 'tZoom'; p.innerHTML = '<b>&#8853;</b>ZOOM'; touch.appendChild(p); LZ.zoomPad = p;
    p.addEventListener('touchstart', e => { e.preventDefault(); LZ.zoom = !LZ.zoom; }, { passive: false }); }
  addEventListener('keydown', e => { if (e.code === 'KeyZ' && !e.repeat && GAME.state === 'play') LZ.zoom = !LZ.zoom; });
  canvas.addEventListener('mousedown', e => { if (e.button === 2 && !POW.fly && GAME.state === 'play' && document.pointerLockElement) LZ.zoomHold = true; });
  addEventListener('mouseup', e => { if (e.button === 2) LZ.zoomHold = false; });
  KEYS.splice(KEYS.findIndex(k => k[0] === 'Left click / hold 6') + 1, 0, ['Z / Right click (on foot)', 'Laser scope: zoom in to find and hit enemies far away']);
  { const kl = document.getElementById('keyList'); if (kl) kl.innerHTML = KEYS.map(([k, v]) => `<kbd>${k}</kbd><span>${v}</span>`).join(''); }
  const _gt = godTick;
  godTick = function (dt) {
    _gt(dt); const pe = PLAYER.ent, ok = GAME.state === 'play' && pe && pe.alive && PLAYER.role === 'trooper' && !pe.mount;
    if (LZ.zoomHold) LZ.zoomHeld = true; else if (LZ.zoomHeld) { LZ.zoomHeld = false; LZ.zoom = false; }
    if (LZ.zoomHold && ok) LZ.zoom = true;
    if (!ok) LZ.zoom = false;
    sc.classList.toggle('on', LZ.zoom); if (LZ.zoomPad) LZ.zoomPad.classList.toggle('on', LZ.zoom);
  };
}
