'use strict';
/* ===================== IRON MERIDIAN · seeing the enemy =====================
   Who is shooting at you, and where:
   · MARKERS: a red chevron over every enemy near you (troops, armour, aircraft, boats). Whoever has hit you in the
     last few seconds gets a big pulsing one, visible much further off; whoever is aiming at you gets an orange one.
   · ARROWS: when an attacker is off screen (beside you, behind you, above you) a big red arrow at the edge of the
     screen points at him, and stays while he keeps hitting you.
   · MINIMAP: enemies near you drawn larger and outlined; attackers flash with a ring.
   All of it shows in the minimal HUD. Markers keep a fixed size on screen so they read on a phone. */
const ENEMY = { atk: new Map(), list: [], t: 0, sprites: [], arrows: [], N: LOW_END ? 18 : 30 };
{
  const chev = (r, g, b) => canvasTex(64, 64, c => { c.fillStyle = `rgb(${r},${g},${b})`; c.strokeStyle = 'rgba(0,0,0,.85)'; c.lineWidth = 5; c.beginPath(); c.moveTo(8, 14); c.lineTo(32, 50); c.lineTo(56, 14); c.lineTo(32, 26); c.closePath(); c.stroke(); c.fill(); });
  const tex = { foe: chev(255, 70, 50), aim: chev(255, 170, 40), atk: chev(255, 30, 30) };
  const mats = {}; for (const k in tex) mats[k] = new T.SpriteMaterial({ map: tex[k], depthTest: false, depthWrite: false, transparent: true, sizeAttenuation: false, fog: false });
  ENEMY.mats = mats;
  for (let i = 0; i < ENEMY.N; i++) { const s = new T.Sprite(mats.foe); s.visible = false; s.renderOrder = 20; s.center.set(0.5, 0); scene.add(s); ENEMY.sprites.push(s); }
  /* edge arrows */
  const st = document.createElement('style');
  st.textContent = `#enArrows{position:fixed;inset:0;pointer-events:none;z-index:6}
#enArrows i{position:absolute;left:50%;top:50%;width:0;height:0;margin:-22px 0 0 -16px;border-left:16px solid transparent;border-right:16px solid transparent;border-bottom:44px solid rgba(255,40,25,.92);filter:drop-shadow(0 0 6px rgba(255,30,0,.9)) drop-shadow(0 0 2px #000);opacity:0;transition:opacity .25s}
#enArrows i.on{opacity:1}
@media (max-height:500px){#enArrows i{margin:-16px 0 0 -12px;border-left-width:12px;border-right-width:12px;border-bottom-width:32px}}`;
  document.head.appendChild(st);
  const box = document.createElement('div'); box.id = 'enArrows'; document.body.appendChild(box);
  for (let i = 0; i < 4; i++) { const a = document.createElement('i'); box.appendChild(a); ENEMY.arrows.push(a); }
}
/* who hit you, and when */
{ const _h = onPlayerHurt; onPlayerHurt = function (a, src) { _h(a, src); const s = src && src.alive !== undefined ? src : null; if (s && s !== PLAYER.ent && s.pos) ENEMY.atk.set(s, TIME); }; }
const enemyKind = e => e.kind === 'soldier' || isGroundVeh(e) || isAir(e) || e.kind === 'naval';
const _en1 = new V3(), _en2 = new V3();
function updateEnemies(dt) {
  const pe = PLAYER.ent, play = GAME.state === 'play' && pe && pe.alive;
  for (const [s, t] of ENEMY.atk) if (!s.alive || TIME - t > 6) ENEMY.atk.delete(s);
  /* the marked list, a few times a second: attackers first, then those aiming at you, then the nearest */
  if ((ENEMY.t -= dt) <= 0) { ENEMY.t = 0.15; const L = ENEMY.list; L.length = 0;
    if (play) { const c = camera.position;
      for (const e of ENTS) { if (!e.alive || e.downed || !e.hitR || !isHostile(e.team) || !enemyKind(e) || e.mount && e.mount.hideRiders) continue;
        const d = e.pos.distanceTo(c), atk = ENEMY.atk.has(e), aim = e.target === pe; if (d > (atk ? 450 : aim ? 260 : 170) * (LZ.zoom ? 6 : 1)) continue; /* through the scope you see them far off */
        L.push({ e, d, k: atk ? 0 : aim ? 1 : 2 }); }
      L.sort((a, b) => a.k - b.k || a.d - b.d); if (L.length > ENEMY.N) L.length = ENEMY.N; } }
  /* chevrons over them */
  const S = ENEMY.sprites, L = ENEMY.list, pulse = 1 + Math.sin(TIME * 9) * 0.18;
  for (let i = 0; i < S.length; i++) { const s = S[i], m = L[i];
    if (!play || !m || !m.e.alive) { s.visible = false; continue; }
    const e = m.e, up = e.kind === 'soldier' ? 2.4 : (e.radius || 3) + 1.6; s.position.set(e.pos.x, e.pos.y + up, e.pos.z); s.visible = true;
    s.material = m.k === 0 ? ENEMY.mats.atk : m.k === 1 ? ENEMY.mats.aim : ENEMY.mats.foe;
    const sz = m.k === 0 ? 0.05 * pulse : m.k === 1 ? 0.036 : 0.026; s.scale.set(sz, sz, 1); }
  /* arrows to attackers off screen */
  const A = ENEMY.arrows, atks = play ? [...ENEMY.atk.keys()].filter(s => s.alive).sort((a, b) => ENEMY.atk.get(b) - ENEMY.atk.get(a)).slice(0, A.length) : [];
  const R = Math.min(innerWidth, innerHeight) * 0.36;
  for (let i = 0; i < A.length; i++) { const el = A[i], s = atks[i]; if (!s) { el.classList.remove('on'); continue; }
    _en1.copy(s.pos).setY(s.pos.y + 1.5).project(camera); const onScr = _en1.z < 1 && Math.abs(_en1.x) < 0.85 && Math.abs(_en1.y) < 0.85;
    if (onScr) { el.classList.remove('on'); continue; }
    _en2.copy(s.pos).applyMatrix4(camera.matrixWorldInverse); const ang = Math.atan2(_en2.x, -_en2.z); /* 0 = dead ahead, the arrow at the top */
    el.style.transform = `translate(${Math.sin(ang) * R}px,${-Math.cos(ang) * R}px) rotate(${ang}rad)`; el.classList.add('on'); }
}
/* the minimap: enemies near you larger and outlined, attackers flashing */
{
  const _du = drawUnits;
  drawUnits = function (ctx, size, layer) {
    _du(ctx, size, layer); const pe = PLAYER.ent; if (!pe || !pe.alive || GAME.state !== 'play') return;
    const M = x => mapXY(x, size), k = Math.min(1.6, size / 170), flash = Math.sin(TIME * 10) > 0;
    for (const e of ENTS) { if (!e.alive || e.downed || !isHostile(e.team) || !enemyKind(e)) continue; const d = Math.hypot(e.pos.x - pe.pos.x, e.pos.z - pe.pos.z); const atk = ENEMY.atk.has(e); if (d > 260 && !atk) continue;
      const x = M(e.pos.x), y = M(e.pos.z), r = (e.kind === 'soldier' ? 2.2 : 3.4) * k * (atk ? 1.5 : 1);
      ctx.fillStyle = atk ? '#ff2a1a' : '#ff6a4a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); ctx.stroke();
      if (atk && flash) { ctx.strokeStyle = '#ff3a2a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r + 4 * k, 0, 6.283); ctx.stroke(); } }
  };
}
{ const _uw = updateWorld; updateWorld = function (dt) { _uw(dt); updateEnemies(dt); }; }
