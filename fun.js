'use strict';
/* ===================== IRON MERIDIAN · pacing, progression, atmosphere ===================== */

/* ---------- hitstop: a few frames of slow time on big hits ---------- */
const HITSTOP = { t: 0 };
const hitstop = s => { HITSTOP.t = Math.max(HITSTOP.t, s); };

/* ---------- ranks (persist across sessions) ---------- */
const RANKS = [
  { n: 'Private', at: 0, perk: 'Standard kit' },
  { n: 'Corporal', at: 3000, perk: '+1 shockwave' },
  { n: 'Sergeant', at: 9000, perk: '+2 seismic bursts' },
  { n: 'Lieutenant', at: 20000, perk: 'Meteor recharges 25% faster' },
];
const XP = { total: 0, dirty: false, saveT: 0 };
try { XP.total = +localStorage.getItem('im-xp') || 0; } catch (err) { /* storage blocked */ }
const rankOf = x => { let r = 0; RANKS.forEach((k, i) => { if (x >= k.at) r = i; }); return r; };
function addXP(n) {
  const b = rankOf(XP.total); XP.total += n; XP.dirty = true; const a = rankOf(XP.total);
  if (a > b) applyPerks(); /* promotions happen quietly now: no banner, no radio note; the perks still apply */
}
function applyPerks() {
  const r = rankOf(XP.total), P = PLAYER;
  P.maxNades = 3 + (r >= 1 ? 1 : 0); P.maxRockets = 5 + (r >= 2 ? 2 : 0); P.orbMul = r >= 3 ? 0.75 : 1;
}

/* ---------- killstreaks + multi-kills ---------- */
const STK = { n: 0, multi: 0, multiT: -9 };
const MULTI = ['', '', 'Double kill', 'Triple kill', 'Quad kill', 'Rampage'];
function onPlayerKill(v, type) {
  const big = v.kind !== 'soldier', mine = !type || myShot(PLAYER.ent, type); /* streaks and multi-kills count only what you shot yourself, not what the flying heroes or the powers killed in your name */
  if (mine) { STK.n++; STK.multi = TIME - STK.multiT < 3.5 ? STK.multi + 1 : 1; STK.multiT = TIME; }
  hitstop(big ? 0.16 : 0); /* troops: the 5-frame freeze in juice.js; machines also get a beat of slow motion */ snd('kill', null, big ? 0.7 : 0.45); shake(big ? 0.6 : 0.12);
  if (mine && STK.multi >= 2) awardPoints(50 * STK.multi, MULTI[Math.min(5, STK.multi)]);
  if (v.bounty) { awardPoints(v.bounty, `Bounty · ${v.name}`); banner('Bounty claimed', `${v.name} destroyed`, 'var(--amber)'); }
  if (big) orderEvent('vehicle'); orderEvent('kill'); dominate(v);
  const P = PLAYER; if (!mine) return;
  if (STK.n === 3) { P.orbCd = 0; banner('3 kill streak', 'Meteor recharged · press Q', 'var(--blue)'); }
  else if (STK.n === 5) { P.ammo = P.mag; P.reload = 0; P.rockets = P.maxRockets; P.nades = P.maxNades; banner('5 kill streak', 'Second wind · every power back to full', 'var(--blue)'); }
  else if (STK.n === 8) { banner('8 kill streak', 'Fleet barrage authorised', 'var(--amber)'); fleetBarrage(); }
}
function fleetBarrage() {
  const pe = PLAYER.ent; if (!pe) return;
  const r = rayCast(camera.position, camDir(_v5), 1400, pe, 1); const c = r.t < 1399 ? r.point.clone() : pe.pos.clone().add(new V3(-Math.sin(PLAYER.yaw) * 120, 0, -Math.cos(PLAYER.yaw) * 120));
  for (let i = 0; i < 3; i++) { const a = i * 2.094 + Math.random(); setTimeout(() => callOrbital(c.clone().add(new V3(Math.cos(a) * 45, 0, Math.sin(a) * 45)), 1, pe), i * 900); }
}

/* ---------- orders chain for the Commander ---------- */
const ORDERS = {
  i: 0, k: 0,
  list: [
    { t: 'Fly up to the Skyport', reach: 'skyport' },
    { t: 'Eliminate 5 hostiles', ev: 'kill', n: 5 },
    { t: 'Call a meteor (Q)', ev: 'orbital', n: 1 },
    { t: 'Destroy an enemy vehicle', ev: 'vehicle', n: 1 },
    { t: 'Capture a command post', ev: 'cap', n: 1 },
  ],
};
function orderEvent(ev) {
  const o = ORDERS.list[ORDERS.i]; if (o.ev !== ev || PLAYER.role !== 'trooper') return;
  if (++ORDERS.k >= o.n) orderDone();
}
function orderDone() {
  const o = ORDERS.list[ORDERS.i]; ORDERS.i = (ORDERS.i + 1) % ORDERS.list.length; ORDERS.k = 0;
  awardPoints(300, 'Order complete'); snd('ui', null, 0.5); comms('COMMAND', `${o.t}: done. Next: ${ORDERS.list[ORDERS.i].t.toLowerCase()}.`, 'cmd');
}
function orderHint(base) {
  const o = ORDERS.list[ORDERS.i]; return `${base}  ·  ORDER: ${o.t}${o.n > 1 ? ` (${ORDERS.k}/${o.n})` : ''}`;
}

/* ---------- front-line spawning with a drop pod ---------- */
function frontPost() {
  const mine = CPS.filter(c => c.owner === 1), foe = CPS.filter(c => c.owner !== 1);
  if (!mine.length || !foe.length) return 'hq';
  let best = null, bd = 1e9;
  for (const c of mine) { if (c.contested) continue; for (const f of foe) { const d = Math.hypot(c.x - f.x, c.z - f.z); if (d < bd) { bd = d; best = c; } } }
  return best || 'hq';
}
function podStep(e) { // called each frame while the Commander is still falling in his pod
  FXA.spawn(e.pos.x, e.pos.y + 1, e.pos.z, rand(-1, 1), 6, rand(-1, 1), 0.25, 2.2, 0.8, 3.5, 1.6, 0.5, 1.5, 0.3, 0.1, 1, 0, 0);
  FXS.spawn(e.pos.x, e.pos.y + 2, e.pos.z, rand(-1, 1), 2, rand(-1, 1), rand(2, 4), 1.5, 5, 0.3, 0.28, 0.26, 0.4, 0.38, 0.35, 0.7, 0.3, 0.2);
}
function podLand(e) {
  PLAYER.pod = false; fxExplosion(e.pos, 1.6); fxDust(e.pos, 18, 6, 12); shockRing(e.pos, 22, 0.8);
  explodeDamage(e.pos, 9, 300, e, 1); shake(1.1); snd('boom', null, 0.8);
  comms('COMMAND', 'Pod down. Commander on the line.', 'cmd');
}

/* ---------- scripted enemy walker assault (repeats through the endless war) ---------- */
const ASSAULT = { next: 150, n: 0 };
const BOSS = ['Ironjaw', 'Black Meridian', 'The Anvil', 'Gravemarch', 'Scourge of Kessa'];
function updateAssault() {
  if (GAME.state === 'menu' || GAME.state === 'showcase' || GAME.clock < ASSAULT.next) return;
  ASSAULT.next = GAME.clock + 300; const w = spawnUnit('walker', 2); if (!w) return;
  w.noRespawn = true; w.bounty = 1500; w.maxHp = w.hp = 4800; w.name = BOSS[ASSAULT.n++ % BOSS.length];
  banner(`Assault walker · ${w.name}`, 'Bounty 1500 · rockets and the orbital lance crack its armour', 'var(--red)');
  comms(null, `Heavy walker ${w.name} is breaking out of the Vanta lines. Bounty on that machine!`, 'cmd'); snd('stomp', null, 0.6);
}

/* ---------- capture ticks (player stands on a post) ---------- */
function capTick(cp, prev) {
  const pe = PLAYER.ent; if (!pe || !pe.alive || GAME.state !== 'play' || Math.hypot(pe.pos.x - cp.x, pe.pos.z - cp.z) > 28 || Math.abs(pe.pos.y - cp.pos.y) > 25) return;
  if (Math.floor(cp.prog * 10) > Math.floor(prev * 10) && cp.owner !== 1) { snd('tick', null, 0.35); awardPoints(10, 'Capturing'); }
}

/* ---------- day and night: the sun arcs across the sky, dusk, a moonlit night, dawn; plus dust squalls ---------- */
// One full day is 16 minutes of battle. The sky, fog, light colour, shadows, stars and exposure all follow the sun;
// by night the key light swaps to the big moon so the field stays readable, and city and village windows glow.
const DAY = { start: 0, len: 960, base: null, phase: '', t0: 0.06 };
const WX = { k: 0, tgt: 0, next: 90, end: 0 };
const _dc = new T.Color(), MOON_DIR = new V3(0.32, 0.4, -0.86).normalize(), _ld = new V3();
const SUN_AZ = Math.atan2(SUN_DIR.z, SUN_DIR.x);
function dayPhase() { return (((GAME.clock - DAY.start) / DAY.len + DAY.t0) % 1 + 1) % 1; }
function updateSkyMood(dt) {
  if (!DAY.base) DAY.base = { sun: sun.intensity, sunC: sun.color.clone(), hemi: hemi.intensity, hemiC: hemi.color.clone(), fog: FOG.clone(), hor: skyU.horizon.value.clone(), zen: skyU.zenith.value.clone(), ash: ASH.p.material.color.clone() };
  const B = DAY.base, p = dayPhase(), el = Math.min(0.97, Math.sin(p * Math.PI * 2) * 0.92 + 0.25), az = SUN_AZ + (p - 0.25) * Math.PI * 2 * 0.5;
  SUN_DIR.set(Math.cos(az) * Math.sqrt(Math.max(0, 1 - el * el)), el, Math.sin(az) * Math.sqrt(Math.max(0, 1 - el * el))).normalize();
  const dayK = smooth(-0.06, 0.2, el), nightK = 1 - smooth(-0.2, 0.0, el), duskK = clamp(1 - Math.abs(el - 0.05) / 0.2, 0, 1);
  // key light: the sun (never grazing so shadows stay usable), handing over to the moon at night
  _ld.copy(SUN_DIR); _ld.y = Math.max(_ld.y, 0.22); _ld.normalize(); LIGHT_DIR.copy(MOON_DIR).lerp(_ld, dayK).normalize();
  SHB.lookAt(LIGHT_DIR, _v5.set(0, 0, 0), UP); SHBi.copy(SHB).invert();
  // weather
  if (GAME.clock > WX.next && WX.tgt === 0) { WX.tgt = 1; WX.end = GAME.clock + rand(25, 40); comms('Met Section', 'Dust squall rolling in off the flats. Visibility dropping, watch your sectors.', 'cmd'); }
  if (WX.tgt === 1 && GAME.clock > WX.end) { WX.tgt = 0; WX.next = GAME.clock + rand(110, 200); comms('Met Section', 'Squall is passing. Visibility improving.', 'cmd'); }
  WX.k += (WX.tgt - WX.k) * Math.min(1, dt * 0.25);
  const wx = (1 - WX.k * 0.35) * (1 - NATURE.dark * 0.6);
  sun.intensity = (B.sun * dayK * (1 - duskK * 0.4) + 0.75 * nightK) * wx;
  sun.color.copy(B.sunC).lerp(_dc.setHex(0xff7a40), duskK * 0.85).lerp(_dc.setHex(0x9db4ff), nightK);
  hemi.intensity = B.hemi * (0.45 + 0.55 * dayK) * (1 - NATURE.dark * 0.4); hemi.color.copy(B.hemiC).lerp(_dc.setHex(0x3a4a78), nightK);
  FOG.copy(B.fog).lerp(_dc.setHex(0x4b3443), duskK * 0.8).lerp(_dc.setHex(0x0e1424), nightK * 0.9).lerp(_dc.setHex(0x8a6a48), WX.k * 0.6); scene.fog.color.copy(FOG); if (scene.background && scene.background.isColor) scene.background.copy(FOG);
  skyU.horizon.value.copy(B.hor).lerp(_dc.setHex(0x7a3c34), duskK).lerp(_dc.setHex(0x111a2c), nightK).lerp(_dc.setHex(0x8a6a48), WX.k * 0.6);
  skyU.zenith.value.copy(B.zen).lerp(_dc.setHex(0x1a1430), duskK * 0.6).lerp(_dc.setHex(0x03050c), nightK); skyU.night.value = nightK;
  const sp = SKYOBJ.userData.sun; if (sp) for (const s of sp) { s.position.copy(SUN_DIR).multiplyScalar(7400); s.visible = el > -0.12; }
  POST.exposure(1 + nightK * 0.45);
  ASH.p.material.size = 0.22 * (1 + WX.k * 1.6); ASH.p.material.color.copy(B.ash).lerp(_dc.setHex(0xc9a070), WX.k);
  const ph = nightK > 0.6 ? 'night' : el < 0.18 ? (p < 0.5 ? 'dusk' : 'dawn') : 'day';
  if (ph !== DAY.phase) { if (DAY.phase && GAME.clock > 5) comms('Met Section', ph === 'night' ? 'Nightfall. Muzzle flashes will give positions away, use the dark.' : ph === 'dusk' ? 'Sun is going down. Light is failing over the field.' : ph === 'dawn' ? 'First light on the horizon. Dawn in minutes.' : 'Full daylight. Sightlines are long again.', 'cmd'); DAY.phase = ph; }
}
function newDay() { DAY.start = GAME.clock; }

/* ---------- fire light on the nearest burning wrecks ---------- */
const FIRE_L = [0, 1].map(() => { const l = new T.PointLight(0xff7a30, 0, 40, 2); scene.add(l); return l; });
function updateFireLights() {
  const c = camera.position; const near = EMIT.filter(e => e.life >= 1e8 && e.p.distanceToSquared(c) < 62500).sort((a, b) => a.p.distanceToSquared(c) - b.p.distanceToSquared(c));
  FIRE_L.forEach((l, i) => { const e = near[i]; if (!e) { l.intensity = 0; return; } l.position.copy(e.p); l.position.y += e.size; l.intensity = (2.2 + Math.sin(TIME * 13 + i * 3) * 0.5 + Math.random() * 0.6) * Math.min(2, e.size * 0.5); });
}

/* ---------- distant battle sound bed ---------- */
const BED = { t: 2 };
function updateSoundBed(dt) {
  if (!AU.ctx) return;
  let heat = 0; for (const c of CPS) heat += c.contested ? 1 : 0;
  if (!isFinite(WX.k)) WX.k = WX.tgt || 0;
  if (AU.ambLp) { const f = 300 + heat * 90 + SHAKE.v * 600 + WX.k * 250; if (isFinite(f)) AU.ambLp.frequency.value = f; }
  if ((BED.t -= dt) > 0) return; BED.t = rand(0.5, 2.2) / (1 + heat * 0.4);
  const hot = CPS.filter(c => c.contested); const cp = hot.length ? pick(hot) : pick(CPS);
  const p = new V3(cp.x + rand(-80, 80), 5, cp.z + rand(-80, 80)); if (p.distanceTo(camera.position) < 90) return;
  if (Math.random() < 0.4) snd('boom', p, 1.6);
  else { const n = 3 + ((Math.random() * 5) | 0); for (let i = 0; i < n; i++) setTimeout(() => snd('rifle', p, 2.4), i * rand(70, 110)); }
}

/* ---------- flak bursts and AA tracers ---------- */
const FLAK = { t: 0, tr: 0 };
function flakBurst(p) {
  FXA.spawn(p.x, p.y, p.z, 0, 0, 0, 0.12, 6, 3, 4, 2.4, 1, 2, 0.6, 0.2, 1, 0, 0);
  FXS.spawn(p.x, p.y, p.z, rand(-1, 1), 0.5, rand(-1, 1), rand(5, 9), 5, 14, 0.06, 0.055, 0.05, 0.12, 0.11, 0.1, 0.9, 0.05, 0.05);
  fxSparks(p, 4, [3, 1.8, 0.6], 18);
}
function updateFlak(dt) {
  if (GAME.state === 'showcase' || !THEATRE.cur || THEATRE.cur.key !== 'air') return; /* flak belongs to the air battle */
  if ((FLAK.t -= dt) <= 0) {
    FLAK.t = rand(0.25, 0.9);
    const air = ENTS.filter(e => e.alive && (e.kind === 'fighter' || e.kind === 'gunship' || e.kind === 'dropship') && e.pos.y > 60);
    const tgt = air.length && Math.random() < 0.6 ? pick(air) : null;
    const p = tgt ? tgt.pos.clone().add(randDir(_v1).multiplyScalar(rand(18, 45))) : new V3(rand(-500, 500), rand(160, 420), rand(-500, 500));
    flakBurst(p); if (tgt) snd('boom', p, 0.5);
  }
  if ((FLAK.tr -= dt) <= 0) {
    FLAK.tr = rand(0.08, 0.3);
    const b = new V3(rand(-600, 600), 0, rand(-600, 600)); b.y = groundY(b.x, b.z) + 20;
    fireProj({ from: b, to: _v2.set(b.x + rand(-200, 200), b.y + rand(350, 600), b.z + rand(-200, 200)), speed: 420, kind: 'bullet', team: 0, dmg: 0, w: 0.5, len: 18, color: Math.random() < 0.5 ? [4, 1.6, 0.5] : [1.2, 3.5, 1.2], checkEnts: false });
  }
}

/* ---------- battle stations: repair, rearm and double XP on friendly ground ---------- */
const STATION = { on: null, t: 0 };
const STATIONS = [...CPS.map(cp => ({ cp, x: cp.x + 17, z: cp.z + 13 })), ...[1, 2].map(t => ({ team: t, x: HQ[t].x, z: HQ[t].z + (t === 1 ? -38 : 38) }))].map(s => {
  _v1.set(s.x, 0, s.z); pushOut(_v1, 7); s.x = _v1.x; s.z = _v1.z;
  const g = new T.Group(), k = bucket(); s.y = s.cp && s.cp.realm && s.cp.realm !== 'land' ? s.cp.pos.y : groundY(s.x, s.z); g.position.set(s.x, s.y, s.z); /* on the platform for the ocean, air and space posts */
  k.add('c', new T.CylinderGeometry(6, 6.6, 0.5, 28).translate(0, 0.25, 0)); k.add('g', new T.CylinderGeometry(0.25, 0.4, 4.5, 8).translate(-3.8, 2.7, -3.8));
  for (let i = 0; i < 4; i++) k.add('r', xf(new T.BoxGeometry(1.6, 1.1, 1.1), [3.4 + (i % 2) * 0.2, 1.05 + (i > 1 ? 1.1 : 0), -2 + (i % 2) * 1.3], [0, rand(-0.3, 0.3), 0]));
  bakeInto(g, k, { c: MAT_CONC, r: MAT_RUST, g: MAT_GUN });
  s.mat = basic(new T.Color(1, 1, 1), { transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false });
  s.ring = new T.Mesh(new T.TorusGeometry(5.6, 0.14, 6, 48).rotateX(Math.PI / 2), s.mat); s.ring.position.y = 0.6;
  s.cross = new T.Group(); s.cross.position.set(-3.8, 5.6, -3.8); const cm = basic(new T.Color(0.6, 3, 1)); s.cross.add(new T.Mesh(new T.BoxGeometry(0.35, 1.5, 0.35), cm), new T.Mesh(new T.BoxGeometry(1.5, 0.35, 0.35), cm));
  g.add(s.ring, s.cross); scene.add(g); return s;
});
function updateStations(dt) {
  const pe = PLAYER.ent, P = PLAYER; STATION.on = null;
  /* the heal scan is twelve stations against every soldier on the field, so it runs four times a second and heals
     for the whole interval instead of once a frame */
  const healT = (STATION.heal = (STATION.heal || 0) - dt) <= 0; if (healT) STATION.heal = 0.25;
  for (const s of STATIONS) {
    const own = s.cp ? s.cp.owner : s.team;
    if (own === 1) s.mat.color.setRGB(0.6, 1.6, 4); else if (own === 2) s.mat.color.setRGB(4, 0.7, 0.4); else if (own === 4) s.mat.color.setRGB(4, 2.4, 0.4); else if (own === 5) s.mat.color.setRGB(0.6, 3.6, 1.2); else s.mat.color.setRGB(0.5, 0.5, 0.5);
    s.ring.rotation.y += dt * 0.4; s.ring.position.y = 0.6 + Math.sin(TIME * 2 + s.x) * 0.15; s.cross.rotation.y += dt; s.cross.visible = !!own;
    if (!own) continue;
    if (healT) for (const e of ENTS) if (e.alive && e.team === own && e.kind === 'soldier' && !e.isPlayer && !e.downed && Math.abs(e.pos.x - s.x) < 9 && Math.abs(e.pos.z - s.z) < 9 && Math.abs(e.pos.y - s.y) < 6) e.hp = Math.min(e.maxHp, e.hp + 5);
    if (pe && pe.alive && GAME.state === 'play' && own === pe.team && pe.kind !== 'fighter' && pe.kind !== 'monster' && Math.hypot(pe.pos.x - s.x, pe.pos.z - s.z) < 9 + (pe.kind === 'soldier' ? 0 : pe.radius || 0) && Math.abs(pe.pos.y - s.y) < 8) STATION.on = s;
  }
  if (!STATION.on) { STATION.t = 0; return; }
  pe.hp = Math.min(pe.maxHp, pe.hp + pe.maxHp * 0.12 * dt); P.ammo = P.mag; P.reload = 0; P.orbCd = Math.max(0, P.orbCd - dt * 0.5);
  if ((STATION.t += dt) > 1.5) { STATION.t = 0; P.rockets = Math.min(P.maxRockets || 5, P.rockets + 1); P.nades = Math.min(P.maxNades || 3, P.nades + 1); P.mslAmmo = Math.min(6, (P.mslAmmo || 0) + 1); awardPoints(5, 'Holding the station'); }
  if (Math.random() < dt * 14) FXA.spawn(pe.pos.x + rand(-1.2, 1.2), pe.pos.y + rand(0, 2), pe.pos.z + rand(-1.2, 1.2), 0, 2, 0, 0.7, 0.25, 0.05, 0.6, 1.8, 3.5, 0.2, 0.6, 1.5, 1, 0, 0);
}

/* ---------- performance governor: frame-time driven LOD and dynamic resolution ---------- */
const PERF = { ema: 16, t: 0, last: 0, lod: 1, pr: 1, lodT: 0, spikes: 0, worst: 0 };
function updatePerf() {
  const now = performance.now(), d = PERF.last ? now - PERF.last : 16; PERF.last = now; if (d > 250) return; // tab was hidden
  PERF.ema += (d - PERF.ema) * 0.06;
  if (d > 34) PERF.spikes++; if (d > PERF.worst) PERF.worst = d; /* a run of long frames reads as a stutter even when the average looks fine */
  if ((PERF.t += d) < 700) return; PERF.t = 0; /* dynamic resolution first (free to change now), then detail range */
  const rough = PERF.spikes >= 3, prMin = LOW_END ? 0.72 : 0.6, /* phones may no longer drop to half resolution: the picture stays at about one screen point per pixel or better */ lodMin = LOW_END ? 0.45 : 0.55;
  if (PERF.ema > 19 || rough) { if (PERF.pr > prMin + 0.02) { PERF.pr = Math.max(prMin, PERF.pr - (PERF.ema > 28 ? 0.1 : rough ? 0.06 : 0.04)); POST.scale(PERF.pr); } else if (PERF.lod > lodMin) PERF.lod -= 0.1; }
  else if (PERF.ema < 14.5 && PERF.spikes === 0) { if (PERF.lod < 1) PERF.lod = Math.min(1, PERF.lod + 0.1); else if (PERF.pr < 1) { PERF.pr = Math.min(1, PERF.pr + 0.03); POST.scale(PERF.pr); } }
  /* still slow with resolution and detail range both at the floor: drop one graphics preset (ultra → balanced →
     performance), which sheds ambient occlusion, sun shafts, MSAA and shadow resolution. Once per four seconds at
     most, never back up on its own, and the choice is saved so the next session starts there. */
  if (PERF.ema > 22 && PERF.pr <= prMin + 0.02 && PERF.lod <= lodMin + 0.01) {
    if ((PERF.floorT = (PERF.floorT || 0) + 0.7) >= 4) {
      PERF.floorT = 0; const next = { ultra: 'balanced', balanced: 'performance' }[POST.quality];
      if (next) { POST.setQuality(next); PERF.pr = 0.85; PERF.lod = 0.85; POST.scale(0.85); if (typeof gfxSel === 'function') gfxSel(); }
    }
  } else PERF.floorT = 0;
  PERF.spikes = 0; PERF.worst = 0;
}
{ /* under load the governor also thins the particles: the worst frames in a fight are the explosion-heavy ones, and a
     fifth fewer embers is invisible next to a stutter. Only ever thins a system that is already half full. */
  const _sp = PSys.prototype.spawn;
  PSys.prototype.spawn = function (x, y, z, vx, vy, vz, life, s0, s1, r0, g0, b0, r1, g1, b1, a0, drag, grav) {
    if (PERF.pr < 0.95 && this.n > this.max * 0.5 && Math.random() > PERF.pr) return;
    return _sp.call(this, x, y, z, vx, vy, vz, life, s0, s1, r0, g0, b0, r1, g1, b1, a0, drag, grav);
  };
}
/* entity LOD: small parts (antennas, gear, pods, rivets) drop out at range; only parts LOD itself hid come back */
function updateEntLod(dt) {
  if ((PERF.lodT -= dt) > 0) return; PERF.lodT = 0.3;
  const c = camera.position, D = 170 * POST.lod * PERF.lod;
  for (const e of ENTS) {
    if (!e.obj || e.isPlayer || e.kind === 'shiftframe' || e.kind === 'monster') continue;
    if (!e._lod) {
      const ms = []; let big = 0; e.obj.updateMatrixWorld(true);
      e.obj.traverse(o => { if (o.isMesh && o.geometry && o.visible && !o.userData.lodKeep) { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); const r = o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis(); ms.push([o, r]); big = Math.max(big, r); } });
      e._lod = { small: ms.filter(m => m[1] < big * 0.3).map(m => m[0]), on: true };
    }
    const lim = D * (e.kind === 'capital' || e.kind === 'naval' ? 4 : e.kind === 'soldier' ? 0.6 : 1), on = e.pos.distanceTo(c) < lim;
    if (on === e._lod.on) continue; e._lod.on = on;
    for (const o of e._lod.small) { if (!on && o.visible) { o.visible = false; o.userData.lodHid = true; } else if (on && o.userData.lodHid) { o.visible = true; o.userData.lodHid = false; } }
  }
}

/* ---------- per-frame driver ---------- */
function updateFun(dt) {
  updatePerf(); updateEntLod(dt); updateAssault(); updateStations(dt); updateSkyMood(dt); for (const t of TURBINES) t.rotor.rotation.z += dt * t.s; updateFireLights(); updateSoundBed(dt); updateFlak(dt);
  const o = ORDERS.list[ORDERS.i], pe = PLAYER.ent;
  if (o.reach && PLAYER.role === 'trooper' && pe && pe.alive && GAME.state === 'play') { const cp = CPS.find(c => c.id === o.reach); if (cp && pe.pos.distanceTo(cp.pos) < 30) orderDone(); }
  if (XP.dirty && (XP.saveT -= dt) <= 0) { XP.saveT = 5; XP.dirty = false; try { localStorage.setItem('im-xp', String(XP.total)); } catch (err) { /* storage blocked */ } }
}

