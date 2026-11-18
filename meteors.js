'use strict';
/* ===================== IRON MERIDIAN · meteor shower =====================
   Power 7 (the 7 key, the METEOR pad). Where you look, the sky opens: for a few seconds a rain of small burning
   rocks comes down at a slant over a 26 m circle. Each one bursts on impact: troops thrown, armour hurt, walls
   chipped, a crater and smoke left behind. Your own people are spared. */
KIT.push(['M', 'Meteor shower', '7']); GOD.cd.M = 0; GOD_CD.M = 16;
PLAY_KEYS.add('Digit7'); TAP_KEYS.add('Digit7');
KEYS.splice(KEYS.findIndex(k => k[0] === '5') + 1, 0, ['7', 'Meteor shower · a rain of burning rocks where you look']);
{ const kl = document.getElementById('keyList'); if (kl) kl.innerHTML = KEYS.map(([k, v]) => `<kbd>${k}</kbd><span>${v}</span>`).join(''); }
const MET = { on: false, t: 0, dur: 4.5, spawnT: 0, c: new V3(), rocks: [], N: LOW_END ? 10 : 16 };
{
  const g = new T.DodecahedronGeometry(1, 0);
  const rm = new T.MeshStandardMaterial({ color: 0x2a221c, roughness: 0.9, metalness: 0.05, emissive: 0xff5a1a, emissiveIntensity: 1.4 });
  const sm = new T.SpriteMaterial({ map: glowTex, color: new T.Color(3.2, 1.2, 0.35), transparent: true, blending: T.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < MET.N; i++) {
    const m = new T.Mesh(g, rm), s = new T.Sprite(sm); m.visible = s.visible = false; m.castShadow = false; m.frustumCulled = false; s.renderOrder = 9; scene.add(m); scene.add(s);
    MET.rocks.push({ m, s, p: new V3(), v: new V3(), live: false, sz: 1, spin: new V3() });
  }
  /* the touch pad */
  const st = document.createElement('style');
  st.textContent = `#tP7{right:calc(244px + env(safe-area-inset-right,0px));bottom:calc(170px + env(safe-area-inset-bottom,0px));border-color:rgba(255,150,60,.6)!important}
#tP7 b{color:#ffb070!important}
@media (max-height:500px){#tP7{right:calc(186px + env(safe-area-inset-right,0px));bottom:calc(124px + env(safe-area-inset-bottom,0px))}}`;
  document.head.appendChild(st);
  const touch = document.getElementById('touch');
  if (touch && !document.getElementById('tP7')) { const p = document.createElement('div'); p.className = 'tb pw'; p.id = 'tP7'; p.innerHTML = '<b>7</b>METEOR'; touch.appendChild(p);
    p.addEventListener('touchstart', e => { e.preventDefault(); dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit7' })); setTimeout(() => dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit7' })), 140); }, { passive: false }); }
}
const _mtA = new V3(), _mtD = new V3();
function metCast() {
  const pe = PLAYER.ent, r = rayCast(camera.position, camDir(_mtD), 600, pe, 1);
  MET.c.copy(r.point); MET.on = true; MET.t = 0; MET.spawnT = 0;
  snd('big', MET.c, 0.5); comms(null, 'Meteor shower incoming.', 'b');
}
function metSpawn() {
  const R = MET.rocks.find(r => !r.live); if (!R) return;
  const a = rand(0, 6.283), d = Math.sqrt(Math.random()) * 26, tx = MET.c.x + Math.cos(a) * d, tz = MET.c.z + Math.sin(a) * d, ty = surfY(tx, tz, MET.c.y + 20);
  const T0 = rand(1.1, 1.6); R.sz = rand(0.7, 1.5); R.live = true;
  R.p.set(tx - 90 + rand(-25, 25), ty + rand(200, 260), tz - 50 + rand(-25, 25)); /* in from high on a slant */
  R.v.set((tx - R.p.x) / T0, (ty - R.p.y) / T0, (tz - R.p.z) / T0);
  R.spin.set(rand(-6, 6), rand(-6, 6), rand(-6, 6));
  R.m.scale.setScalar(R.sz); R.s.scale.setScalar(R.sz * 7); R.m.visible = R.s.visible = true;
}
function metImpact(R) {
  const pe = PLAYER.ent, p = R.p, s = R.sz;
  R.live = false; R.m.visible = R.s.visible = false;
  fxExplosion(p, 0.7 + s * 0.5);
  explodeDamage(p, 6 + s * 3, 90 + s * 60, pe, 1);
  const b = buildingAt(_mtA.set(p.x, p.y + 0.5, p.z)); if (b && b.alive) b.damage(700 * s, pe);
  if (H(p.x, p.z) < 0) fxWaterSplash(p, 1 + s);
  else { if (typeof addCrater === 'function') addCrater(p.x, p.z, 1.8 + s); if (typeof debrisBurst === 'function') debrisBurst(p, LOW_END ? 3 : 6, 9, 0.4, 'concrete', { hot: true }); }
  if (camera.position.distanceTo(p) < 400) snd('boom', p, 0.5);
}
function metTick(dt) {
  if (MET.on) { MET.t += dt; if (MET.t > MET.dur) MET.on = false;
    else if ((MET.spawnT -= dt) <= 0) { MET.spawnT = MET.dur / (MET.N * 1.6); metSpawn(); } }
  for (const R of MET.rocks) { if (!R.live) continue;
    R.p.addScaledVector(R.v, dt); R.m.position.copy(R.p); R.s.position.copy(R.p);
    R.m.rotation.x += R.spin.x * dt; R.m.rotation.y += R.spin.y * dt; R.m.rotation.z += R.spin.z * dt;
    if (Math.random() < 0.7) FXA.spawn(R.p.x, R.p.y, R.p.z, -R.v.x * 0.05, -R.v.y * 0.05 + 2, -R.v.z * 0.05, 0.5, 1.4 * R.sz, 0.4, 4, 2, 0.5, 1.5, 0.4, 0.1, 1, 0.4, 0); /* the fiery trail */
    const g = surfY(R.p.x, R.p.z, R.p.y);
    if (R.p.y <= g + 0.4 || buildingAt(R.p)) { if (R.p.y < g) R.p.y = g; metImpact(R); } }
}
{
  const _gt = godTick;
  godTick = function (dt) {
    _gt(dt);
    const pe = PLAYER.ent, ok = GAME.state === 'play' && pe && pe.alive && PLAYER.role === 'trooper' && !pe.mount;
    if (keys.Digit7) { keys.Digit7 = false; if (ok && !MET.on && GOD.cd.M <= 0) { GOD.cd.M = GOD_CD.M; metCast(); } }
    metTick(dt);
  };
}
