'use strict';
/* ===================== IRON MERIDIAN · evacuation convoy =====================
   A mission that comes round every couple of minutes:
   1 · RESCUE   civilians are trapped at a district with enemy troops closing on them. Get there, clear every hostile
                within 45 m and hold the spot for three seconds.
   2 · BOARD    three armoured evacuation buses pull in and the civilians run aboard.
   3 · ESCORT   the convoy drives to the nearest evacuation gate. It only moves while you are within 150 m (it waits
                for its escort) and stops dead when hostiles block the road ahead, until you clear them. Ambushes
                hit it on the way; anything hostile within 120 m shoots at the buses.
                A bus that is destroyed takes its passengers with it.
   4 · ARRIVE   everyone who reaches the gate counts as evacuated (toward the 4,000 that win the war), with points.
   Shown on the top strip under the navigation, in the navigation itself (where to go) and on the minimap. */
const EVAC = { state: 'idle', t: 35, cp: null, pick: new V3(), gate: null, path: [], cum: [], len: 0, s: 0, buses: [], people: 0, civ: [], foes: [], amb: [], secure: 0, lead: new V3(), wait: false, el: null, failT: 0, msgT: 0, v: new V3(), v2: new V3() };
const BUS_HP = 1400, BUS_GAP = 14, BUS_SPEED = 9;
/* ---------- the bus: armoured, white and blue, roof light bar ---------- */
const BUS_GEO = (() => {
  const body = mergeGeos([new T.BoxGeometry(3, 2.5, 9.6).translate(0, 1.95, 0), new T.BoxGeometry(2.8, 0.5, 2.4).translate(0, 3.45, 3.2)]);
  const dark = mergeGeos([new T.BoxGeometry(3.04, 0.75, 7.4).translate(0, 2.45, -0.6), new T.BoxGeometry(2.6, 1.0, 0.1).translate(0, 2.4, 4.82), new T.BoxGeometry(3.1, 0.55, 9.7).translate(0, 0.72, 0)]);
  const stripe = new T.BoxGeometry(3.06, 0.28, 9.66).translate(0, 1.55, 0);
  const wheel = new T.CylinderGeometry(0.62, 0.62, 0.5, 12).rotateZ(Math.PI / 2);
  return { body, dark, stripe, wheel };
})();
const BUS_M = { body: std(0xd9dcd8, 0.55, 0.25), dark: std(0x15181c, 0.35, 0.5), stripe: std(0x2c7fd8, 0.5, 0.2, { emissive: 0x0a2a55, emissiveIntensity: 0.6 }), wheel: std(0x111111, 0.9, 0.1), red: basic(new T.Color(3, 0.4, 0.3)), blue: basic(new T.Color(0.4, 1.2, 3.2)), lamp: basic(new T.Color(2.4, 2.3, 1.9)) };
function makeBus() {
  const g = new T.Group(), b = new T.Mesh(BUS_GEO.body, BUS_M.body); b.castShadow = true; g.add(b, new T.Mesh(BUS_GEO.dark, BUS_M.dark), new T.Mesh(BUS_GEO.stripe, BUS_M.stripe));
  const wheels = []; for (const [x, z] of [[-1.45, 3.1], [1.45, 3.1], [-1.45, -3.1], [1.45, -3.1]]) { const w = new T.Mesh(BUS_GEO.wheel, BUS_M.wheel); w.position.set(x, 0.62, z); g.add(w); wheels.push(w); }
  const lr = new T.Mesh(new T.BoxGeometry(0.7, 0.22, 0.4), BUS_M.red), lb = new T.Mesh(new T.BoxGeometry(0.7, 0.22, 0.4), BUS_M.blue); lr.position.set(-0.45, 3.32, 1.2); lb.position.set(0.45, 3.32, 1.2); g.add(lr, lb);
  for (const x of [-1.1, 1.1]) { const l = new T.Mesh(new T.BoxGeometry(0.45, 0.25, 0.08), BUS_M.lamp); l.position.set(x, 1.15, 4.84); g.add(l); }
  g.visible = false; scene.add(g);
  return { g, wheels, lr, lb, hp: BUS_HP, alive: true, people: 0, pos: new V3(), yaw: 0, s: 0, smoke: 0 };
}
/* ---------- the civilians: their own little crowd ---------- */
const EVAC_CIV_N = 24;
const EVAC_CM = (() => { const m = new T.InstancedMesh(CIVM.geometry, CIVM.material, EVAC_CIV_N); m.count = 0; m.frustumCulled = false; m.castShadow = false; scene.add(m); for (let i = 0; i < EVAC_CIV_N; i++) m.setColorAt(i, new T.Color(0.92, 0.9, 0.84)); return m; })();
/* ---------- the route: straight out to the gate in 10 m steps, nudged off walls; the driest district wins ---------- */
function evacRoute(from, gate) {
  const pts = [from.clone()], d = gate.pos.distanceTo(from), n = Math.max(2, Math.round(d / 10)); let bad = 0, prevH = H(from.x, from.z);
  for (let i = 1; i <= n; i++) { const k = i / n, p = new V3(lerp(from.x, gate.pos.x, k), 0, lerp(from.z, gate.pos.z, k)); if (i < n) pushOut(p, 3.5);
    const h = H(p.x, p.z); if (h < 0.3) bad += 2; if (Math.abs(h - prevH) > 6) bad++; prevH = h; pts.push(p); }
  return { pts, bad };
}
function evacStart() {
  if (!POOL.gates.length) return false;
  let best = null, bs = 1e9; const pe = PLAYER.ent;
  for (const cp of CPS) { if (cp.realm !== 'land' || cp.pop < 60 || cp.owner === 2 && Math.random() < 0.5) continue;
    const gate = nearestGate(cp.pos), from = landNear(cp.x + (gate.pos.x - cp.x) * 0.06, cp.z + (gate.pos.z - cp.z) * 0.06, 6), R = evacRoute(from, gate), L = from.distanceTo(gate.pos);
    if (L < 160 || L > 600 || (pe && pe.pos.distanceTo(from) > 450)) continue; /* near you, and a short run to the gate */
    const sc = R.bad * 40 + Math.abs(L - 350) * 0.2 + (pe ? pe.pos.distanceTo(from) * 0.6 : 0) + Math.random() * 30; if (sc < bs) { bs = sc; best = { cp, gate, from, R }; } }
  if (!best) return false;
  const { cp, gate, from, R } = best;
  EVAC.cp = cp; EVAC.gate = gate; EVAC.pick.copy(from); EVAC.pick.y = surfY(from.x, from.z, 400); EVAC.path = R.pts; EVAC.cum = [0];
  for (let i = 1; i < R.pts.length; i++) EVAC.cum.push(EVAC.cum[i - 1] + R.pts[i].distanceTo(R.pts[i - 1]));
  EVAC.len = EVAC.cum[EVAC.cum.length - 1]; EVAC.s = 0; EVAC.secure = 0; EVAC.failT = 200; EVAC.amb = [0.32, 0.66];
  EVAC.people = Math.min(240, Math.floor(cp.pop / 10) * 10); cp.pop -= EVAC.people;
  /* the civilians, huddled */
  EVAC.civ = []; for (let i = 0; i < EVAC_CIV_N; i++) { const a = rand(0, 6.28), r = rand(1, 5); EVAC.civ.push({ p: new V3(from.x + Math.cos(a) * r, 0, from.z + Math.sin(a) * r), yaw: rand(0, 6.28), st: 'cower', bus: null, ph: rand(0, 6) }); }
  /* the enemies closing on them */
  EVAC.foes = []; for (let i = 0; i < 6; i++) evacFoe(from, 28, 46, 'soldier');
  EVAC.state = 'rescue';
  banner('Civilians trapped', `${EVAC.people} people pinned down at ${cp.name}. Clear the area.`, 'var(--amber)');
  comms('COMMAND', `${EVAC.people} civilians trapped near ${cp.name}. Clear the hostiles off them and we will send buses.`, 'cmd'); snd('chime', null, 0.5);
  return true;
}
function evacFoe(at, r0, r1, kind) { /* a hostile placed round a point, sent at it */
  const C = typeof CHAMP !== 'undefined' ? CHAMP : null, was = C && C.spawning; if (C) C.spawning = true; /* mission enemies are over and above the army's field strength */
  const e = spawnUnit(kind, 2); if (C) C.spawning = was; if (!e || !e.alive) return null; const a = rand(0, 6.28), r = rand(r0, r1), p = landNear(at.x + Math.cos(a) * r, at.z + Math.sin(a) * r, 6);
  e.pos.set(p.x, surfY(p.x, p.z, p.y + 2), p.z); if (e.lastPos) e.lastPos.copy(e.pos); if (e.obj) e.obj.position.copy(e.pos); if (e.goal) { e.goal.set(at.x, 0, at.z); e.goalT = 8; } e.evac = true;
  EVAC.foes.push(e); return e;
}
/* where a distance along the route is, and which way it faces */
function evacAt(s, out) {
  const P = EVAC.path, C = EVAC.cum; if (s <= 0) { const d = EVAC.v2.subVectors(P[1], P[0]).normalize(); out.copy(P[0]).addScaledVector(d, s); return Math.atan2(d.x, d.z); }
  let i = 1; while (i < C.length - 1 && C[i] < s) i++; const k = clamp((s - C[i - 1]) / Math.max(0.01, C[i] - C[i - 1]), 0, 1);
  out.lerpVectors(P[i - 1], P[i], k); const d = EVAC.v2.subVectors(P[Math.min(P.length - 1, i + 1)], P[i - 1]); return Math.atan2(d.x, d.z);
}
function evacPlace(b, s, dt) {
  const yaw = evacAt(s, b.pos); b.pos.y = surfY(b.pos.x, b.pos.z, b.pos.y + 3);
  b.yaw = angLerp(b.yaw, yaw, Math.min(1, dt * 3)); b.g.position.copy(b.pos); b.g.rotation.set(0, b.yaw, 0);
  const ds = s - b.s; b.s = s; for (const w of b.wheels) w.rotation.x += ds / 0.62;
}
function evacBoard() {
  EVAC.buses = [0, 1, 2].map(i => { const b = makeBus(); b.s = -i * BUS_GAP; b.yaw = evacAt(b.s, b.pos); b.g.visible = true; evacPlace(b, b.s, 1); fxDust(b.pos, 8, 4, 6); return b; });
  const per = Math.ceil(EVAC.people / 3 / 10) * 10; let left = EVAC.people; for (const b of EVAC.buses) { b.people = Math.min(per, left); left -= b.people; }
  EVAC.civ.forEach((c, i) => { c.st = 'run'; c.bus = EVAC.buses[i % 3]; });
  EVAC.state = 'board'; EVAC.t = 7;
  comms('Evac', 'Buses on site. Get them aboard!', 'b'); banner('Area secure', 'The buses are in. Civilians boarding.', 'var(--blue)'); snd('chime', null, 0.5); awardPoints(150, 'Civilians rescued');
}
function evacLoseBus(b) {
  b.alive = false; b.hp = 0; fxExplosion(EVAC.v.copy(b.pos).setY(b.pos.y + 2), 3); if (typeof addEmitter === 'function') addEmitter(b.pos.clone().setY(b.pos.y + 2.5), 1.6, 30);
  b.g.traverse(o => { if (o.isMesh && o.material !== BUS_M.wheel) o.material = MAT_GUN; });
  POOL.lost += b.people; comms('Evac', `A bus is down. ${b.people} people lost.`, 'r'); banner('Bus destroyed', `${b.people} civilians lost`, 'var(--red)'); b.people = 0;
}
function evacEnd(ok) {
  const saved = EVAC.buses.reduce((n, b) => n + (b.alive ? b.people : 0), 0);
  if (ok && saved > 0) { POOL.evac += saved; banner('Convoy through', `${saved} civilians evacuated`, 'var(--blue)'); comms('Evac', `Convoy at the ${EVAC.gate.name}. ${saved} people safe. Good work.`, 'b'); awardPoints(Math.round(saved * 2.5), 'Civilians evacuated'); if (typeof addXP === 'function') addXP(Math.round(saved / 2)); snd('chime', null, 0.6); }
  else banner('Convoy lost', 'The evacuation failed', 'var(--red)');
  EVAC.state = 'done'; EVAC.t = 6;
}
function evacClear() {
  for (const b of EVAC.buses) scene.remove(b.g); EVAC.buses = []; EVAC.civ = []; EVAC_CM.count = 0;
  for (const e of EVAC.foes) e.evac = false; EVAC.foes = []; EVAC.state = 'idle'; EVAC.t = rand(100, 140);
}
/* ---------- the enemy shoots at the buses ---------- */
const EVAC_DPS = { soldier: 11, tank: 75, walker: 95, gunship: 45, shiftframe: 40, speeder: 14 };
function evacFire(dt) {
  const live = EVAC.buses.filter(b => b.alive); if (!live.length) return; let shots = 0;
  for (const e of ENTS) {
    if (!e.alive || e.downed || !isHostile(e.team) || !EVAC_DPS[e.kind] || e.pos.y > 400) continue;
    let tb = null, td = 120; for (const b of live) { const d = e.pos.distanceTo(b.pos); if (d < td) { td = d; tb = b; } } if (!tb) continue;
    if (e.evac && e.goal) { e.goal.set(tb.pos.x, 0, tb.pos.z); e.goalT = 2; } /* the ambushers run at the convoy */
    tb.hp -= EVAC_DPS[e.kind] * dt;
    if (shots < 4 && Math.random() < dt * 2.5) { shots++; const from = e.aim ? e.aim(EVAC.v) : EVAC.v.copy(e.pos); fireProj({ from, to: EVAC.v2.copy(tb.pos).add(new V3(rand(-1.4, 1.4), rand(1, 3), rand(-1.4, 1.4))), speed: 420, kind: 'bullet', team: e.team, w: 0.08, len: 6, color: TEAM[e.team] ? TEAM[e.team].tracer : [2, 1, 0.6], checkEnts: false }); if (Math.random() < 0.3) fxSparks(EVAC.v2, 3, [3, 2, 1], 6); }
  }
  for (const b of live) if (b.hp <= 0) evacLoseBus(b);
}
/* ---------- the mission, every frame ---------- */
function updateEvac(dt) {
  const pe = PLAYER.ent, playing = GAME.state === 'play' || GAME.state === 'spectate';
  if (!playing) return;
  if (EVAC.state === 'idle') { if (pe && pe.alive && GAME.state === 'play' && (EVAC.t -= dt) <= 0) { if (!evacStart()) EVAC.t = 30; } evacHud(); return; }
  if ((EVAC.sweepT = (EVAC.sweepT || 0) - dt) <= 0) { EVAC.sweepT = 1; EVAC.foes = EVAC.foes.filter(e => e.alive); }
  if (EVAC.state === 'rescue') {
    let n = 0; for (const e of ENTS) if (e.alive && !e.downed && isHostile(e.team) && e.hitR && e.pos.y < 400 && Math.hypot(e.pos.x - EVAC.pick.x, e.pos.z - EVAC.pick.z) < 45) n++;
    EVAC.near = n; const close = pe && pe.alive && Math.hypot(pe.pos.x - EVAC.pick.x, pe.pos.z - EVAC.pick.z) < 40;
    EVAC.secure = n === 0 && close ? EVAC.secure + dt : Math.max(0, EVAC.secure - dt * 2);
    if (EVAC.secure >= 3) evacBoard();
    else if ((EVAC.failT -= dt) <= 0) { const lost = Math.round(EVAC.people / 2 / 10) * 10; POOL.lost += lost; EVAC.cp.pop += EVAC.people - lost; banner('Too late', `${lost} of the trapped civilians were lost`, 'var(--red)'); EVAC.buses = []; evacEnd(false); }
  } else if (EVAC.state === 'board') {
    for (const b of EVAC.buses) evacPlace(b, b.s, dt);
    if ((EVAC.t -= dt) <= 0 || EVAC.civ.every(c => c.st === 'in')) { EVAC.state = 'move'; comms('Evac', `Rolling out to the ${EVAC.gate.name}. Stay close, we wait for you.`, 'b'); }
  } else if (EVAC.state === 'move') {
    const live = EVAC.buses.filter(b => b.alive); if (!live.length) { evacEnd(false); evacHud(); return; }
    const lead = live[0]; EVAC.lead.copy(lead.pos);
    const escort = pe && pe.alive && live.some(b => b.pos.distanceTo(pe.pos) < 150); EVAC.wait = !escort;
    if (EVAC.wait && (EVAC.msgT -= dt) <= 0) { EVAC.msgT = 12; comms('Evac', 'Convoy holding. We need you back with us.', 'b'); }
    /* the road ahead blocked: hostiles within 45 m in front of the lead bus stop the column until they are cleared */
    const fx = Math.sin(lead.yaw), fz = Math.cos(lead.yaw); EVAC.block = 0;
    for (const e of ENTS) if (e.alive && !e.downed && isHostile(e.team) && e.hitR && e.pos.y < 400 && (e.kind === 'soldier' || isGroundVeh(e))) { const dx = e.pos.x - lead.pos.x, dz = e.pos.z - lead.pos.z, d = Math.hypot(dx, dz); if (d < 45 && dx * fx + dz * fz > -4) EVAC.block++; }
    if (EVAC.block && (EVAC.blockMsgT = (EVAC.blockMsgT || 0) - dt) <= 0) { EVAC.blockMsgT = 15; comms('Evac', 'Road blocked! Clear them out so we can move!', 'r'); }
    EVAC.s = Math.min(EVAC.len, EVAC.s + (escort && !EVAC.block ? BUS_SPEED : 0) * dt);
    live.forEach((b, i) => evacPlace(b, Math.min(EVAC.s - i * BUS_GAP, EVAC.len - i * 3), dt));
    for (const b of EVAC.buses) if (!b.alive) b.g.position.y = b.pos.y; /* wrecks stay where they died */
    /* ambushes ahead of the column */
    if (EVAC.amb.length && EVAC.s / EVAC.len > EVAC.amb[0]) { EVAC.amb.shift(); const ahead = EVAC.v; evacAt(Math.min(EVAC.len, EVAC.s + 70), ahead);
      for (let i = 0; i < 6; i++) evacFoe(ahead, 35, 60, 'soldier'); if (Math.random() < 0.8) evacFoe(ahead, 70, 100, 'tank');
      comms('Evac', 'Ambush ahead! Contacts on the road!', 'r'); banner('Ambush', 'Protect the buses', 'var(--red)'); }
    evacFire(dt);
    /* lights flash */
    const on = Math.sin(TIME * 12) > 0; for (const b of live) { b.lr.visible = on; b.lb.visible = !on; }
    if (EVAC.s >= EVAC.len - 0.5) evacEnd(true);
  } else if (EVAC.state === 'done') { if ((EVAC.t -= dt) <= 0) evacClear(); }
  evacCiv(dt); evacHud();
}
function evacCiv(dt) { /* the crowd: huddled, then running for the bus doors, then gone */
  const M = EVAC_CM, m = _m; let n = 0;
  for (const c of EVAC.civ) {
    if (c.st === 'in') continue;
    if (c.st === 'run' && c.bus) { const door = EVAC.v.set(c.bus.pos.x + Math.cos(c.bus.yaw) * 1.8, 0, c.bus.pos.z - Math.sin(c.bus.yaw) * 1.8); const dx = door.x - c.p.x, dz = door.z - c.p.z, d = Math.hypot(dx, dz);
      if (d < 0.8) { c.st = 'in'; continue; } c.p.x += dx / d * 4.2 * dt; c.p.z += dz / d * 4.2 * dt; c.yaw = Math.atan2(dx, dz); c.ph += dt * 12; }
    else c.ph += dt * 2;
    c.p.y = surfY(c.p.x, c.p.z, EVAC.pick.y + 2);
    const bob = c.st === 'run' ? Math.abs(Math.sin(c.ph)) * 0.08 : 0, crouch = c.st === 'cower' ? 0.72 : 1;
    m.compose(EVAC.v2.set(c.p.x, c.p.y + bob, c.p.z), _q.setFromAxisAngle(UP, c.yaw), _s.set(1, crouch, 1)); M.setMatrixAt(n++, m);
  }
  M.count = n; M.instanceMatrix.needsUpdate = true;
}
/* ---------- the strip under the navigation ---------- */
{
  const st = document.createElement('style');
  st.textContent = `#evacTag{position:fixed;left:50%;top:calc(40px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:6;pointer-events:none;display:none;align-items:center;gap:8px;padding:3px 10px;border:1px solid rgba(92,202,255,.5);border-left:4px solid #5ccaff;background:rgba(10,10,12,.62);color:#fff;font:600 11px var(--body,sans-serif);white-space:nowrap;max-width:92vw}
#evacTag.on{display:flex}#evacTag b{font:800 10px var(--display,sans-serif);letter-spacing:.14em;color:#5ccaff}#evacTag.warn{border-left-color:#ff5d3d}#evacTag.warn b{color:#ff5d3d}
#evacTag i{display:inline-block;width:26px;height:5px;background:rgba(255,255,255,.18);margin-left:2px;vertical-align:middle}#evacTag i u{display:block;height:100%;background:#9be37a}
@media (max-height:500px){#evacTag{top:calc(34px + env(safe-area-inset-top,0px));font-size:10px}}`;
  document.head.appendChild(st); const el = document.createElement('div'); el.id = 'evacTag'; document.body.appendChild(el); EVAC.el = el;
}
function evacHud() {
  if (EVAC.state === EVAC.hudS && TIME - (EVAC.hudT || 0) < 0.2) return; EVAC.hudT = TIME; EVAC.hudS = EVAC.state; /* five times a second, and at once when the stage changes */
  const el = EVAC.el, s = EVAC.state, pe = PLAYER.ent, show = GAME.state === 'play' && s !== 'idle';
  el.classList.toggle('on', show); if (!show) return; let warn = false, h = '';
  if (s === 'rescue') { h = `${EVAC.people} civilians · ${EVAC.near ? `${EVAC.near} hostiles close` : EVAC.secure > 0 ? `securing ${Math.min(3, EVAC.secure).toFixed(1)}/3 s` : 'get within 40 m'} · ${Math.round(EVAC.failT)} s`; warn = EVAC.near > 0; }
  else if (s === 'board') h = `<b>BOARDING</b> ${EVAC.civ.filter(c => c.st === 'in').length}/${EVAC.civ.length} aboard`;
  else if (s === 'move') { const live = EVAC.buses.filter(b => b.alive), aboard = live.reduce((n, b) => n + b.people, 0); warn = EVAC.wait || EVAC.block > 0 || live.some(b => b.hp < BUS_HP * 0.35);
    h = `<b>${EVAC.wait ? 'CONVOY WAITING FOR YOU' : EVAC.block ? `ROAD BLOCKED · ${EVAC.block} hostiles` : 'ESCORT CONVOY'}</b> ${aboard} aboard · ${Math.round(EVAC.len - EVAC.s)} m to the gate ${EVAC.buses.map(b => `<i><u style="width:${Math.max(0, b.hp / BUS_HP) * 100}%;${b.hp < BUS_HP * 0.35 ? 'background:#ff5d3d' : ''}"></u></i>`).join('')}`; }
  else h = `<b>EVAC</b> ${EVAC.buses.some(b => b.alive) ? 'complete' : 'over'}`;
  if (el.__h !== h) { el.innerHTML = h; el.__h = h; } el.classList.toggle('warn', warn);
}
/* ---------- navigation and minimap: the mission comes first ---------- */
{
  const _np = navPick;
  navPick = function (pe) {
    if (EVAC.state === 'rescue' || EVAC.state === 'board') return { kind: 'RESCUE', name: `Civilians · ${EVAC.cp.name}`, p: EVAC.pick, evac: 1 };
    if (EVAC.state === 'move') return { kind: EVAC.wait ? 'CATCH UP' : 'ESCORT', name: 'Evac convoy', p: EVAC.lead, evac: 1 };
    return _np(pe);
  };
  const _du = drawUnits;
  drawUnits = function (ctx, size, layer) {
    _du(ctx, size, layer); if (EVAC.state !== 'move' && EVAC.state !== 'board') return; const M = x => mapXY(x, size), k = Math.min(1.6, size / 170);
    ctx.save(); ctx.strokeStyle = 'rgba(92,202,255,.75)'; ctx.lineWidth = 1.4 * k; ctx.beginPath(); EVAC.path.forEach((p, i) => i ? ctx.lineTo(M(p.x), M(p.z)) : ctx.moveTo(M(p.x), M(p.z))); ctx.stroke();
    for (const b of EVAC.buses) { ctx.fillStyle = b.alive ? '#9be37a' : '#555'; ctx.fillRect(M(b.pos.x) - 2.5 * k, M(b.pos.z) - 2.5 * k, 5 * k, 5 * k); } ctx.restore();
  };
}
{ const _uw = updateWorld; updateWorld = function (dt) { _uw(dt); updateEvac(dt); }; }
