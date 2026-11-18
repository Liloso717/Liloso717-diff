'use strict';
/* ===================== IRON MERIDIAN · spectator camera angles =====================
   While you spectate, a small bar bottom-right picks the camera:
   · AUTO      the battle director cuts between the biggest moments (as before)
   · CHASE     behind the unit you are following
   · ORBIT     a slow circle round it
   · HELMET    through its eyes, looking at what it is shooting at
   · GROUND    a fixed spot on the ground nearby, like a war photographer
   · DRONE     high and behind, the whole fight below
   · TACTICAL  straight down from above, the battlefield as a map
   ◀ ▶ (or C / X) change the angle, NEXT (or N) jumps to another fight, PLAY drops you back in.
   The camera stays on one unit; when it falls, it moves on to the nearest fighter. */
const SPC = { mode: 0, subj: null, lost: 0, last: new V3(), ang: 0, anchor: new V3(), pos: new V3(), look: new V3(), snap: true, seen: [], el: null, lbl: null, on: false, v: new V3(), u: new V3(), f: new V3(), w: new V3(), l: new V3() };
const SPC_MODES = ['AUTO', 'CHASE', 'ORBIT', 'HELMET', 'GROUND', 'DRONE', 'TACTICAL'];
const SPC_SZ = { monster: 30, shiftframe: 4, speeder: 3, soldier: 1, tank: 4, walker: 12, gunship: 7, fighter: 6, dropship: 8, naval: 40 };
const SPC_W = { soldier: 1, tank: 2.2, walker: 3, fighter: 1.6, gunship: 2, speeder: 1.4, shiftframe: 2, monster: 4, naval: 1.6, dropship: 1 };
{
  const st = document.createElement('style');
  st.textContent = `#specCam{position:fixed;right:max(14px,env(safe-area-inset-right,0px));bottom:calc(9vh + 12px);z-index:7;display:none;gap:6px;align-items:center;pointer-events:auto;user-select:none;-webkit-user-select:none;touch-action:manipulation}
#specCam.on{display:flex}
#specCam button{font:800 11px var(--display,sans-serif);letter-spacing:.12em;color:#fff;background:rgba(10,10,12,.7);border:1px solid rgba(255,196,80,.5);padding:0 12px;height:36px;min-width:36px;cursor:pointer;-webkit-tap-highlight-color:transparent}
#specCam button:active{background:rgba(255,196,80,.3)}
#specCam .lbl{min-width:118px;color:#ffc450;border-left:3px solid #ffc450}
#specCam .lbl small{display:block;font:600 8px var(--mono,monospace);letter-spacing:.1em;color:rgba(255,255,255,.55);margin-bottom:1px}
#specCam .play{border-color:rgba(120,220,140,.6);color:#9ef0ae}
@media (max-height:500px){#specCam{bottom:calc(9vh + 6px);gap:4px}#specCam button{height:32px;padding:0 9px;font-size:10px}#specCam .lbl{min-width:96px}}`;
  document.head.appendChild(st);
  const el = document.createElement('div'); el.id = 'specCam';
  el.innerHTML = '<button data-a="prev" aria-label="Previous camera">◀</button><button class="lbl" data-a="next"><small>CAMERA</small><span>AUTO</span></button><button data-a="next" aria-label="Next camera">▶</button><button data-a="unit">NEXT FIGHT</button><button class="play" data-a="play">PLAY ▸</button>';
  document.body.appendChild(el); SPC.el = el; SPC.lbl = el.querySelector('.lbl span');
  const act = a => { if (a === 'prev') spcMode(-1); else if (a === 'next') spcMode(1); else if (a === 'unit') spcNextUnit(); else if (a === 'play' && PLAYER.ent && PLAYER.ent.alive) toggleSpectate(); };
  for (const b of el.querySelectorAll('button')) {
    const fire = e => { e.preventDefault(); e.stopPropagation(); audioInit(); act(b.dataset.a); };
    b.addEventListener('touchstart', fire, { passive: false });
    b.addEventListener('mousedown', fire);
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
  }
}
function spcMode(d) {
  const was = SPC.mode; SPC.mode = (SPC.mode + d + SPC_MODES.length) % SPC_MODES.length; SPC.lbl.textContent = SPC_MODES[SPC.mode]; SPC.snap = true; SPC.ang = Math.atan2(camera.position.z - CINE.look.z, camera.position.x - CINE.look.x);
  if (SPC.mode === 0) { DIR.shot = null; CINE.subj = null; cinePick(); return; }
  if (was === 0 || !spcLive(SPC.subj)) { /* carry on with whoever the director was showing */
    const S = DIR.shot, cand = S && (S.s || S.subj) || CINE.subj;
    SPC.subj = spcLive(cand) && SPC_W[cand.kind] ? cand : null; if (!SPC.subj) spcPick(null);
    else spcCap();
  }
}
const spcLive = e => e && e.alive && !e.remove && !e.isPlayer && e.pos && e.pos.y < 1200;
function spcScore(e) {
  let s = SPC_W[e.kind] || 0; if (!s) return 0;
  if (e.target && e.target.alive) s += 3;
  if (e.hurtT && TIME - e.hurtT < 4) s += 1.5;
  if (CPS.some(c => c.contested && Math.abs(c.x - e.pos.x) < 60 && Math.abs(c.z - e.pos.z) < 60)) s += 2;
  return s;
}
function spcPick(near) { /* the best fight; near a point when following on from a fallen unit */
  let best = null, bs = 0;
  for (const e of ENTS) { if (!spcLive(e) || e.downed || SPC.seen.includes(e)) continue; let s = spcScore(e); if (!s) continue;
    if (near) s -= Math.hypot(e.pos.x - near.x, e.pos.z - near.z) / 25; else s += Math.random() * 1.5;
    if (s > bs) { bs = s; best = e; } }
  if (!best && SPC.seen.length) { SPC.seen.length = 0; return spcPick(near); }
  SPC.subj = best; SPC.lost = 0; SPC.snap = !near; if (best) { SPC.seen.push(best); if (SPC.seen.length > 8) SPC.seen.shift(); spcCap(); }
}
function spcNextUnit() { if (SPC.mode === 0) { DIR.shot = null; CINE.subj = null; cinePick(); return; } SPC.anchorSet = false; spcPick(null); }
function spcCap() {
  const s = SPC.subj; if (!s) return;
  const kn = { soldier: 'Infantry', tank: 'Hover tank', walker: 'Assault walker', fighter: 'Starfighter', gunship: 'Gunship', speeder: 'Speeder', shiftframe: 'Shiftframe', monster: 'Bio-titan', naval: 'Destroyer', dropship: 'Dropship' }[s.kind] || s.kind;
  setCap(`${TEAM[s.team] ? TEAM[s.team].name : 'Wild'} · ${kn}`, s.name || nameOf(s));
}
function spcFwd(e, out) {
  if (e.kind === 'soldier') { const y = e.yaw || 0; return out.set(Math.sin(y), 0, Math.cos(y)); }
  fwdOf(e, out); if (!isAir(e)) out.y = 0; if (out.lengthSq() < 1e-4) out.set(0, 0, 1); return out.normalize();
}
function spcShot(dt) {
  let s = SPC.subj;
  if (!spcLive(s) || s.downed) { /* it fell: hold on the spot a moment, then the nearest fighter */
    if (s && s.pos) SPC.last.copy(s.pos);
    SPC.lost += dt; if (SPC.lost > 1.4 || !s) spcPick(SPC.last.lengthSq() > 0 ? SPC.last : null); s = SPC.subj;
    if (!s) return false;
  }
  const R = SPC_SZ[s.kind] || 5, c = s.aim(SPC.v), f = spcFwd(s, SPC.f), want = SPC.w, look = SPC.l.copy(c), m = SPC_MODES[SPC.mode];
  let fov = 62, k = 1 - Math.exp(-dt * 3), clampG = true;
  if (!spcLive(SPC.subj) || SPC.subj.downed) look.copy(SPC.last);
  switch (m) {
    case 'CHASE': want.copy(c).addScaledVector(f, -(R * 3.2 + 5)).add(SPC.u.set(0, R * 0.9 + 1.8, 0)); look.addScaledVector(f, R * 4 + 6); k = 1 - Math.exp(-dt * 6); break;
    case 'ORBIT': SPC.ang += dt * 0.22; want.set(c.x + Math.cos(SPC.ang) * (R * 4.5 + 7), c.y + R * 1.1 + 3.5, c.z + Math.sin(SPC.ang) * (R * 4.5 + 7)); break;
    case 'HELMET': {
      const t = s.target && s.target.alive && s.target.pos ? s.target : null;
      if (s.kind === 'soldier') want.set(s.pos.x + f.x * 0.55, s.pos.y + 1.68, s.pos.z + f.z * 0.55);
      else want.copy(c).addScaledVector(f, R * 0.7).add(SPC.u.set(0, R * 0.55, 0));
      if (t) t.aim(look); else look.copy(want).addScaledVector(f, 40);
      fov = 76; k = 1 - Math.exp(-dt * 14); clampG = false; break;
    }
    case 'GROUND': {
      if (SPC.snap || !SPC.anchorSet || SPC.anchor.distanceTo(c) > R * 14 + 45) { /* set up ahead of it, off to one side */
        const a = Math.atan2(f.z, f.x) + (Math.random() < 0.5 ? 1 : -1) * rand(0.5, 0.9), d = R * 5 + 20;
        const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d; SPC.anchor.set(x, surfY(x, z, c.y + 2) + 1.7, z); SPC.anchorSet = true; SPC.snap = true; }
      want.copy(SPC.anchor); fov = 48; k = 1; break;
    }
    case 'DRONE': want.copy(c).addScaledVector(f, -(R * 4 + 55)).add(SPC.u.set(0, R * 2 + 50, 0)); fov = 58; k = 1 - Math.exp(-dt * 1.8); break;
    case 'TACTICAL': want.set(c.x, c.y + R * 3 + 150, c.z + 18); fov = 50; k = 1 - Math.exp(-dt * 2); break;
  }
  if (clampG) want.y = Math.max(want.y, surfY(want.x, want.z, want.y) + 1.2);
  if (SPC.snap) { SPC.pos.copy(want); SPC.look.copy(look); SPC.snap = false; }
  SPC.pos.lerp(want, k); SPC.look.lerp(look, 1 - Math.exp(-dt * (m === 'HELMET' ? 10 : 5)));
  if (s.kind === 'soldier' && s.obj) s.obj.visible = m !== 'HELMET'; /* no head in the lens */
  if (SPC.hid && SPC.hid !== s && SPC.hid.obj) SPC.hid.obj.visible = true; SPC.hid = m === 'HELMET' ? s : null;
  CINE.pos.copy(SPC.pos); CINE.look.copy(SPC.look);
  camera.position.copy(SPC.pos); camera.up.set(0, 1, 0); camera.lookAt(SPC.look);
  camera.fov = lerp(camera.fov, fov, Math.min(1, dt * 4)); camera.updateProjectionMatrix();
  return true;
}
{
  const _ss = spectateShot;
  spectateShot = function (dt) {
    if (GAME.state === 'spectate' && SPC.mode !== 0) { DIR.shot = null; if (spcShot(dt)) return true; }
    if (SPC.hid && SPC.hid.obj) { SPC.hid.obj.visible = true; SPC.hid = null; }
    return _ss(dt);
  };
  const _uw = updateWorld;
  updateWorld = function (dt) {
    _uw(dt);
    const show = GAME.state === 'spectate' && $('#menu').classList.contains('hidden');
    if (show !== SPC.on) { SPC.on = show; SPC.el.classList.toggle('on', show); }
    if (show) SPC.el.querySelector('.play').style.display = PLAYER.ent && PLAYER.ent.alive ? '' : 'none';
    if (!show && SPC.hid && SPC.hid.obj) { SPC.hid.obj.visible = true; SPC.hid = null; }
  };
  addEventListener('keydown', e => {
    if (GAME.state !== 'spectate') return;
    if (e.code === 'KeyC') spcMode(1); else if (e.code === 'KeyX') spcMode(-1); else if (e.code === 'KeyN') spcNextUnit();
    else if (/^Digit[0-4]$/.test(e.code) && SPC.mode !== 0) { SPC.mode = 0; SPC.lbl.textContent = 'AUTO'; } /* the director's own channels */
  });
  const _dt = dirTick;
  dirTick = function (sub, label) { _dt(sub, label); const i = DIR.el && DIR.el.querySelector('i'); if (i) i.textContent = 'C / X camera angle · N next fight · 0–4 director channels · P back to battle'; };
}
