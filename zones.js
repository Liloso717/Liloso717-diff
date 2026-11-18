'use strict';
/* ===================== IRON MERIDIAN · every district its own weather, light and local rule ===================== */
// Aeris Island is one place, but no two districts fight alike. Each has its own light, air, particles and a rule:
//  Apex Plaza        · glass canyon, warm    · the island's heart, under the spire
//  Canal District    · humid, water-cooled   · the ring of canals inside the moat
//  Rail Terminal     · dust off the mountain · the rail head that climbs to the peaks
//  Mountain Villages · thin cold air, snow   · HIGH GROUND: your shots hit 20% harder up here
//  Volcano Reaches   · ash and heat haze     · ASH FALL: walls of ash; inside one, enemies past 16 m lose you
//                                              SLAG VENTS glow, erupt and burn; their steam hides you
//  Seawall Dam       · sea spray, grey surf  · SHORE BATTERY: the fleet shells the dam while it is contested
//  Forgotten Reaches · scrub nobody rebuilt  · the wild end of the island
//  Floating Marina   · ocean, sunset spray   · open water on every side
//  Skyport           · cloud, thin air       · HIGH GROUND
//  Orbital Array     · orbit, starlight      · (low gravity; turbolasers and boarding pods, see realms.js)
const ZONES = [
  { id: 'apex', title: 'Apex Plaza', vibe: 'The island\'s heart · glass and open ground', fog: 0xa9a08e, sky: 0xc9bca4, sun: 0xffe0b0, pt: 'sand', fd: 1.0 },
  { id: 'canal', title: 'Canal District', vibe: 'The ring of canals · cool water air', fog: 0x6f8f92, sky: 0x9ec0c4, sun: 0xffe8c8, pt: 'spray', fd: 1.15 },
  { id: 'rail', title: 'Rail Terminal', vibe: 'Dust off the mountain line', fog: 0xb2834e, sky: 0xd39a5c, sun: 0xffb070, pt: 'sand', fd: 1.3 },
  { id: 'peaks', title: 'Mountain Villages', vibe: 'Thin cold air · the high ground hits harder', fog: 0xc8d8e4, sky: 0xdfeaf4, sun: 0xeef4ff, pt: 'snow', fd: 1.1, dmg: 1.2 },
  { id: 'ash', title: 'Volcano Reaches', vibe: 'Ash and heat · the ash fall hides you', fog: 0x7a5a4a, sky: 0xa06a48, sun: 0xff8a50, pt: 'sand', fd: 1.5 },
  { id: 'dam', title: 'Seawall Dam', vibe: 'Sea spray · the fleet shells the dam', fog: 0x5a7a82, sky: 0x7aa0aa, sun: 0xcfe6ff, pt: 'spray', fd: 1.3 },
  { id: 'wilds', title: 'The Forgotten Reaches', vibe: 'Scrub and ruins · nobody rebuilt this end', fog: 0x8a8a62, sky: 0xaab084, sun: 0xffe2a0, pt: 'sand', fd: 1.2 },
  { id: 'marina', title: 'Floating Marina · OCEAN', vibe: 'The floating city · open water on every side', fog: 0x4a7a8a, sky: 0xff9a7a, sun: 0xffc090, pt: 'spray', fd: 1.2 },
  { id: 'skyport', title: 'Skyport · AIR', vibe: 'Thin cold air · the high ground hits harder', fog: 0x9ab8d8, sky: 0xbcd8f0, sun: 0xeef4ff, pt: 'snow', fd: 0.8, dmg: 1.2 },
  { id: 'orbital', title: 'Orbital Array · SPACE', vibe: 'Low gravity · turbolasers and boarding pods', fog: 0x1a1430, sky: 0x2a2050, sun: 0xd8c8ff, pt: 'void', fd: 0.6 },
];
const Z_DAM = ZONES.find(z => z.id === 'dam');
const ZONE = { cur: null, w: 0, seen: {}, gust: 0, gustT: 30, shellT: 10, fogMul: 1 };
for (const z of ZONES) { z.cp = CPS.find(c => c.id === z.id); z.fogC = new T.Color(z.fog); z.skyC = new T.Color(z.sky); z.sunC = new T.Color(z.sun); }
/* ---------- one camera-attached particle field that changes character with the zone ---------- */
const ZP = (() => {
  const N = 900, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pos[i * 3] = rand(-45, 45); pos[i * 3 + 1] = rand(-15, 30); pos[i * 3 + 2] = rand(-45, 45); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
  const m = new T.PointsMaterial({ size: 0.2, map: puffTex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  const p = new T.Points(g, m); p.frustumCulled = false; p.visible = false; scene.add(p); return { N, pos, g, m, p, kind: '' };
})();
const ZP_LOOK = { sand: [0xd8b080, 0.32, false], snow: [0xffffff, 0.26, false], rain: [0x9ab8ff, 0.12, true], ember: [0xff7a2a, 0.22, true], spray: [0xdff0ff, 0.38, false], void: [0xc8d8ff, 0.1, true] };
function updateZoneParticles(dt, kind, w) {
  ZP.p.visible = w > 0.02 && (camera.position.y < 400 || kind === 'void'); if (!ZP.p.visible) return;
  if (kind !== ZP.kind) { ZP.kind = kind; const L = ZP_LOOK[kind]; ZP.m.color.setHex(L[0]); ZP.m.size = L[1]; ZP.m.blending = L[2] ? T.AdditiveBlending : T.NormalBlending; ZP.m.needsUpdate = true; }
  ZP.m.opacity = w * (kind === 'rain' ? 0.9 : 0.75); ZP.p.position.copy(camera.position);
  const P = ZP.pos, t = TIME;
  for (let i = 0; i < ZP.N; i++) {
    const k = i * 3;
    if (kind === 'sand') { P[k] += (14 + (i % 5) * 3 + ZONE.gust * 25) * dt; P[k + 1] += Math.sin(t * 2 + i) * 0.8 * dt; P[k + 2] += Math.cos(t + i) * 2 * dt; }
    else if (kind === 'snow') { P[k] += (1.5 + Math.sin(t * 0.5 + i) * 1.2) * dt; P[k + 1] -= (1.6 + (i % 4) * 0.3) * dt; P[k + 2] += Math.cos(t * 0.7 + i) * 0.8 * dt; }
    else if (kind === 'rain') { P[k + 1] -= (26 + (i % 6) * 2) * dt; P[k] += 2 * dt; }
    else if (kind === 'ember') { P[k + 1] += (2 + (i % 5) * 0.6) * dt; P[k] += Math.sin(t * 2 + i) * 1.2 * dt; P[k + 2] += Math.cos(t * 1.7 + i) * 1.2 * dt; }
    else { P[k] -= (5 + (i % 4)) * dt; P[k + 1] += Math.sin(t + i) * 0.6 * dt; }
    if (P[k] > 45) P[k] -= 90; if (P[k] < -45) P[k] += 90; if (P[k + 2] > 45) P[k + 2] -= 90; if (P[k + 2] < -45) P[k + 2] += 90; if (P[k + 1] < -15) P[k + 1] += 45; if (P[k + 1] > 30) P[k + 1] -= 45;
  }
  ZP.g.attributes.position.needsUpdate = true;
}
/* ---------- D · slag vents: glow, erupt, burn, steam ---------- */
const VENTS = [];
{
  const D = CPDEF.find(c => c.id === 'ash'), glowM = new T.MeshBasicMaterial({ color: 0xff6a20, transparent: true, opacity: 0.0, blending: T.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 6; i++) {
    let x = D.x, z = D.z; for (let k = 0; k < 30; k++) { const a = rand(0, 6.283), r = rand(18, 70); x = D.x + Math.cos(a) * r; z = D.z + Math.sin(a) * r; if (H(x, z) > 1 && !buildingAt(_v1.set(x, H(x, z) + 1, z))) break; }
    const y = groundY(x, z), crust = new T.Mesh(new T.CylinderGeometry(3.2, 3.8, 0.5, 14), std(0x1a1210, 0.95, 0.1, { emissive: 0xff4a10, emissiveIntensity: 0.25 })); crust.position.set(x, y + 0.1, z); crust.receiveShadow = true; scene.add(crust);
    const glow = new T.Mesh(new T.CircleGeometry(2.6, 20).rotateX(-Math.PI / 2), glowM.clone()); glow.position.set(x, y + 0.4, z); scene.add(glow);
    VENTS.push({ x, y, z, glow, crust, t: rand(4, 14), st: 'idle' });
  }
}
function updateVents(dt, near) {
  for (const v of VENTS) {
    v.t -= dt;
    if (v.st === 'idle') { v.glow.material.opacity = 0.08 + Math.sin(TIME * 2 + v.x) * 0.04; if (v.t <= 0) { v.st = 'warn'; v.t = 2.2; } }
    else if (v.st === 'warn') { v.glow.material.opacity = 0.35 + 0.35 * Math.sin(TIME * 18); if (near && Math.random() < 0.5) fxSparks(_v1.set(v.x, v.y + 0.5, v.z), 2, [4, 1.6, 0.4], 6); if (v.t <= 0) { v.st = 'burst'; v.t = 3; if (near) { snd('boom', _v1.set(v.x, v.y, v.z), 0.5); flashLight(_v1, 6, 40, 0.5, 0xff6020); } } }
    else if (v.st === 'burst') {
      v.glow.material.opacity = 0.9;
      if (near) for (let i = 0; i < 4; i++) FXA.spawn(v.x + rand(-1, 1), v.y + 0.5, v.z + rand(-1, 1), rand(-2, 2), rand(14, 24), rand(-2, 2), rand(0.4, 0.8), rand(2.5, 4), 0.8, 4, 1.6, 0.4, 1.4, 0.3, 0.05, 1, 0.6, 4);
      for (const e of ENTS) if (e.alive && e.kind === 'soldier' && !e.mount && e.hitR !== false && Math.abs(e.pos.x - v.x) < 4.5 && Math.abs(e.pos.z - v.z) < 4.5 && e.pos.y - v.y < 6 && Math.hypot(e.pos.x - v.x, e.pos.z - v.z) < 4.5) { if (e.spawnGuard <= TIME) e.damage(40 * dt, null, 'burn'); if (typeof BURN !== 'undefined' && !BURN.list.includes(e)) { e.burnT = 2; BURN.list.push(e); } }
      if (v.t <= 0) { v.st = 'steam'; v.t = 7; }
    } else { v.glow.material.opacity = Math.max(0.08, v.glow.material.opacity - dt * 0.4); if (near && Math.random() < dt * 14) FXS.spawn(v.x + rand(-2, 2), v.y + 1, v.z + rand(-2, 2), rand(-1, 1), rand(2, 4), rand(-1, 1), rand(5, 8), 4, 16, 0.75, 0.74, 0.72, 0.6, 0.6, 0.6, 0.55, 0.3, -0.2); if (v.t <= 0) { v.st = 'idle'; v.t = rand(8, 16); } }
  }
}
const inSteam = p => VENTS.some(v => v.st === 'steam' && v.t > 1.5 && Math.hypot(p.x - v.x, p.z - v.z) < 12);
/* ---------- E · shore battery: telegraphed shells while the docks are fought over ---------- */
const SHELLS = [];
function updateShelling(dt, z, near) {
  const cp = z.cp, hot = cp.contested || (cp.nb && cp.nr);
  if (hot && near && (ZONE.shellT -= dt) <= 0) {
    ZONE.shellT = rand(9, 16); const pe = PLAYER.ent;
    for (let i = 0; i < 2; i++) { let x, zz; for (let k = 0; k < 12; k++) { x = cp.x + rand(-80, 80); zz = cp.z + rand(-80, 80); if (H(x, zz) > 0.5 && (!pe || Math.hypot(x - pe.pos.x, zz - pe.pos.z) > 12)) break; }
      const ring = new T.Mesh(new T.RingGeometry(6, 7, 32).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false })); ring.position.set(x, groundY(x, zz) + 0.3, zz); scene.add(ring);
      SHELLS.push({ ring, t: 2.4 + i * 0.6 }); }
    snd('missile', _v1.set(cp.x, 20, cp.z), 0.7); comms('Fleet Gunnery', pick(['Shot over! Rounds inbound on the docks.', 'Shore battery firing for effect, mind the red rings.', 'Splash in three!']), 'cmd');
  }
  for (let i = SHELLS.length - 1; i >= 0; i--) {
    const S = SHELLS[i]; S.t -= dt; S.ring.material.opacity = 0.45 + 0.35 * Math.sin(TIME * 20);
    if (S.t <= 0) { const p = S.ring.position.clone(); fxExplosion(p, 1.8); explodeDamage(p, 7.5, 130, null, 0); if (H(p.x, p.z) < 0.5) fxWaterSplash(p, 1.5); else fxDust(p, 10, 5, 9); shake(0.5, p); snd('boom', p, 0.9); scene.remove(S.ring); S.ring.material.dispose(); S.ring.geometry.dispose(); SHELLS.splice(i, 1); }
  }
}
/* ---------- zone rules hooked into damage and XP ---------- */
const _zoneFire = fireProj;
fireProj = function (o) { if (o && o.src && o.src.isPlayer && ZONE.cur && ZONE.cur.dmg && ZONE.w > 0.5) o.dmg = (o.dmg || 0) * ZONE.cur.dmg; return _zoneFire(o); };
const _zoneXP = addXP;
addXP = function (n) { return _zoneXP(ZONE.cur && ZONE.cur.xp && ZONE.w > 0.5 && n > 0 ? Math.round(n * ZONE.cur.xp) : n); };
/* ---------- per frame: find the zone, blend its mood over the sky cycle, run its twist ---------- */
function updateZones(dt) {
  const pe = PLAYER.ent, at = pe && pe.alive && GAME.state === 'play' ? pe.pos : camera.position;
  let best = null, bw = 0;
  for (const z of ZONES) { const r = z.cp.realm, d = r === 'air' || r === 'space' ? at.distanceTo(z.cp.pos) : Math.hypot(at.x - z.cp.x, at.z - z.cp.z), ok = r === 'space' ? at.y > 1200 : r === 'air' ? at.y > 150 && at.y < 600 : at.y < 300, w = ok ? smooth(r === 'land' ? 190 : 160, r === 'land' ? 110 : 80, d) : 0; if (w > bw) { bw = w; best = z; } }
  ZONE.w += ((best ? bw : 0) - ZONE.w) * Math.min(1, dt * 1.5); if (best) ZONE.cur = best; const z = ZONE.cur, w = ZONE.w;
  if (z && w > 0.01) {
    const night = skyU.night.value, k = w * (0.55 - night * 0.3);
    FOG.lerp(z.fogC, k); scene.fog.color.copy(FOG); skyU.horizon.value.lerp(z.skyC, k * 0.8); sun.color.lerp(z.sunC, k * 0.6); hemi.color.lerp(z.skyC, k * 0.3);
  }
  // Volcano Reaches · ash fall
  if (z && z.id === 'ash' && w > 0.4) { if ((ZONE.gustT -= dt) <= 0 && ZONE.gust === 0) { ZONE.gustT = rand(30, 50); ZONE.gustOn = 9; comms('Met Section', 'Ash fall off the volcano! You are hard to see in this, use it.', 'cmd'); } }
  if (ZONE.gustOn > 0) ZONE.gustOn -= dt; ZONE.gust += ((ZONE.gustOn > 0 && z && z.id === 'ash' ? 1 : 0) - ZONE.gust) * Math.min(1, dt * 1.2);
  ZONE.fogMul = 1 + (z && w > 0 ? (z.fd - 1) * w : 0) + ZONE.gust * 3.2; /* applied with the global fog in the frame loop */
  STEALTH.player = pe && pe.alive && ((ZONE.gust > 0.6 && z && z.id === 'ash' && w > 0.5) || inSteam(pe.pos)) ? 1 : 0;
  // the volcano's slag vents (cheap when far: no effects, still timed); the dam's shore battery
  const FD = CPDEF.find(c => c.id === 'ash'), dD = Math.hypot(at.x - FD.x, at.z - FD.z); updateVents(dt, dD < 260 && at.y < 300);
  updateShelling(dt, Z_DAM, Z_DAM.cp && Math.hypot(at.x - Z_DAM.cp.x, at.z - Z_DAM.cp.z) < 260);
  updateZoneParticles(dt, z ? z.pt : 'sand', z ? w : 0);
  // arrival card, once per zone per two minutes
  if (z && w > 0.6 && GAME.state === 'play' && (ZONE.seen[z.id] || 0) < TIME) { ZONE.seen[z.id] = TIME + 120; banner(`${z.id} · ${z.title}`, z.vibe, 'var(--amber)'); }
}
