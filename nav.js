'use strict';
/* ===================== IRON MERIDIAN · where to fight =====================
   One objective at a time, picked for you: the nearest post being fought over, an enemy-held post, a post of ours
   under attack, or a pack of enemy troops in the open. Shown four ways:
   · a strip at the top of the screen: what to do, where, how many metres, and an arrow that turns to point at it;
   · a gold marker over the spot in the world, with the distance under it;
   · on the minimap, a gold ring on the spot and a line from you to it;
   · the nearest enemy's distance, when one is close.
   Only fights within about 450 m are offered (if none, the closest one), chosen mostly by distance. A target is kept
   at least 12 s, and after that only dropped for something clearly closer or when that fight is over. */
const NAV = { t: 0, cur: null, el: null, tag: null, arrow: null, dist: null, foe: null, spr: null, lbl: null, v: new V3(), v2: new V3() };
{
  const st = document.createElement('style');
  st.textContent = `#navTag{position:fixed;left:50%;top:calc(8px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:6;pointer-events:none;display:none;align-items:center;gap:8px;padding:4px 12px 4px 8px;border:1px solid rgba(255,196,80,.55);border-left:4px solid #ffc450;background:rgba(10,10,12,.62);color:#fff;font:600 12px var(--body,sans-serif);letter-spacing:.03em;white-space:nowrap;max-width:92vw}
#navTag.on{display:flex}
#navTag i{display:block;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:16px solid #ffc450;filter:drop-shadow(0 0 2px #000);flex:none}
#navTag b{font:800 11px var(--display,sans-serif);letter-spacing:.14em;color:#ffc450}
#navTag em{font:800 13px var(--mono,monospace);font-style:normal;color:#fff}
#navTag small{font:700 10px var(--mono,monospace);color:#ff7a5a;margin-left:4px}
#navTag.here{border-left-color:#ff5a3a}#navTag.here b{color:#ff5a3a}
#navLbl{position:fixed;left:0;top:0;z-index:5;pointer-events:none;display:none;transform:translate(-50%,0);font:800 12px var(--mono,monospace);color:#ffc450;text-shadow:0 0 3px #000,0 0 6px #000;white-space:nowrap}
@media (max-height:500px){#navTag{font-size:11px;padding:3px 10px 3px 6px}#navTag em{font-size:12px}}`;
  document.head.appendChild(st);
  const el = document.createElement('div'); el.id = 'navTag'; el.innerHTML = '<i></i><b></b><span></span><em></em><small></small>'; document.body.appendChild(el);
  NAV.el = el; NAV.arrow = el.querySelector('i'); NAV.tag = el.querySelector('b'); NAV.name = el.querySelector('span'); NAV.dist = el.querySelector('em'); NAV.foe = el.querySelector('small');
  const lb = document.createElement('div'); lb.id = 'navLbl'; document.body.appendChild(lb); NAV.lbl = lb;
  const tex = canvasTex(64, 64, c => { c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 6; c.fillStyle = '#ffc450'; c.beginPath(); c.moveTo(32, 6); c.lineTo(56, 32); c.lineTo(32, 58); c.lineTo(8, 32); c.closePath(); c.stroke(); c.fill(); c.fillStyle = '#1a1206'; c.beginPath(); c.moveTo(32, 20); c.lineTo(44, 32); c.lineTo(32, 44); c.lineTo(20, 32); c.closePath(); c.fill(); });
  NAV.spr = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true, sizeAttenuation: false, fog: false }));
  NAV.spr.scale.set(0.045, 0.045, 1); NAV.spr.renderOrder = 21; NAV.spr.visible = false; scene.add(NAV.spr);
}
const navReach = cp => !(cp.pos.y > 1200) && cp.realm !== 'space';
const NAV_R = 450; /* only fights near you: no running across the island */
function navOpts(pe) {
  const P = pe.pos, opts = [];
  for (const cp of CPS) { if (!navReach(cp)) continue; const d = Math.hypot(cp.x - P.x, cp.z - P.z), mine = cp.owner === 1;
    if (mine && !cp.contested) continue;
    const kind = mine ? 'DEFEND' : cp.contested ? 'FIGHT FOR' : 'CAPTURE';
    opts.push({ kind, name: cp.name, p: cp.pos, cp, d, s: d - (cp.contested ? 100 : 0) - (mine ? 60 : 0) }); }
  /* packs of enemy troops in the open, in 80 m cells */
  const cells = new Map();
  for (const e of ENTS) { if (!e.alive || e.downed || e.kind !== 'soldier' || !isHostile(e.team) || e.pos.y > 1200) continue; const k = Math.floor(e.pos.x / 80) * 1000 + Math.floor(e.pos.z / 80); let c = cells.get(k); if (!c) cells.set(k, c = { n: 0, x: 0, y: 0, z: 0 }); c.n++; c.x += e.pos.x; c.y += e.pos.y; c.z += e.pos.z; }
  for (const c of cells.values()) if (c.n >= 4) { const p = new V3(c.x / c.n, c.y / c.n, c.z / c.n), d = Math.hypot(p.x - P.x, p.z - P.z); opts.push({ kind: 'ENEMY SQUAD', name: `${c.n} troops`, p, d, s: d - c.n * 6 }); }
  return opts;
}
function navPick(pe) {
  const opts = navOpts(pe); if (!opts.length) return null;
  /* near you first; if nothing is near, simply the closest fight */
  const near = opts.filter(o => o.d <= NAV_R), L = near.length ? near : opts.slice().sort((a, b) => a.d - b.d).slice(0, 1);
  L.sort((a, b) => a.s - b.s); const best = L[0];
  /* stay on the same job for at least 12 s, and after that only switch for something clearly closer or when it is over */
  if (NAV.cur) { const same = opts.find(o => (o.cp && o.cp === NAV.cur.cp) || (!o.cp && !NAV.cur.cp && o.p.distanceTo(NAV.cur.p) < 60));
    if (same && (NAV.holdT > 0 || same.s < best.s + 120) && same.d <= Math.max(NAV_R, best.d) + 100) return same; }
  NAV.holdT = 12; return best;
}
function updateNav(dt) {
  const pe = PLAYER.ent, play = GAME.state === 'play' && pe && pe.alive;
  if (!play) { NAV.el.classList.remove('on'); NAV.spr.visible = false; NAV.lbl.style.display = 'none'; return; }
  NAV.holdT = (NAV.holdT || 0) - dt;
  if ((NAV.t -= dt) <= 0) { NAV.t = 1.5; NAV.cur = navPick(pe); }
  const c = NAV.cur; if (!c) { NAV.el.classList.remove('on'); NAV.spr.visible = false; NAV.lbl.style.display = 'none'; return; }
  const p = c.cp ? c.cp.pos : c.p, d = Math.hypot(p.x - pe.pos.x, p.z - pe.pos.z), here = d < (c.cp ? 40 : 30);
  NAV.el.classList.add('on'); NAV.el.classList.toggle('here', here);
  setText(NAV.tag, here ? 'YOU ARE HERE · FIGHT' : c.kind); setText(NAV.name, c.name); setText(NAV.dist, here ? '' : d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m'); /* only touch the page when the text changes */
  /* the arrow: which way it is from where you are looking */
  NAV.v.copy(p).applyMatrix4(camera.matrixWorldInverse); const ang = Math.atan2(NAV.v.x, -NAV.v.z); NAV.arrow.style.transform = `rotate(${ang}rad)`; NAV.arrow.style.visibility = here ? 'hidden' : 'visible';
  /* nearest enemy, when close */
  if ((NAV.foeT = (NAV.foeT || 0) - dt) <= 0) { NAV.foeT = 0.25; /* four times a second is plenty */
    let nd = 1e9; for (const e of ENTS) if (e.alive && !e.downed && e.hitR && isHostile(e.team) && (e.kind === 'soldier' || isGroundVeh(e) || isAir(e))) { const q = e.pos.distanceTo(pe.pos); if (q < nd) nd = q; }
    setText(NAV.foe, nd < 400 ? `· nearest enemy ${Math.round(nd)} m` : ''); }
  /* the marker in the world, with its distance */
  const my = (c.cp ? p.y + 14 : p.y + 6); NAV.spr.position.set(p.x, my, p.z); NAV.spr.visible = !here;
  NAV.v2.set(p.x, my, p.z).project(camera);
  if (!here && NAV.v2.z < 1 && Math.abs(NAV.v2.x) < 1 && Math.abs(NAV.v2.y) < 1) { NAV.lbl.style.display = 'block'; NAV.lbl.style.left = ((NAV.v2.x + 1) / 2 * innerWidth) + 'px'; NAV.lbl.style.top = ((1 - NAV.v2.y) / 2 * innerHeight + 16) + 'px'; setText(NAV.lbl, NAV.dist.textContent); }
  else NAV.lbl.style.display = 'none';
}
/* the minimap: a gold ring on the spot and a line to it */
{
  const _du = drawUnits;
  drawUnits = function (ctx, size, layer) {
    _du(ctx, size, layer); const pe = PLAYER.ent, c = NAV.cur; if (!c || !pe || !pe.alive || GAME.state !== 'play') return;
    const p = c.cp ? c.cp.pos : c.p, M = x => mapXY(x, size), k = Math.min(1.6, size / 170);
    ctx.save(); ctx.strokeStyle = '#ffc450'; ctx.lineWidth = 1.5 * k; ctx.setLineDash([4 * k, 3 * k]); ctx.beginPath(); ctx.moveTo(M(pe.pos.x), M(pe.pos.z)); ctx.lineTo(M(p.x), M(p.z)); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 2.2 * k; ctx.beginPath(); ctx.arc(M(p.x), M(p.z), (5 + Math.sin(TIME * 5) * 1.2) * k, 0, 6.283); ctx.stroke(); ctx.restore();
  };
}
{ const _uw = updateWorld; updateWorld = function (dt) { _uw(dt); updateNav(dt); }; }
/* one place to go, said once: the old district marker (the war's focus, anywhere on the island) is taken off the
   screen, and the hint line under the crosshair repeats the navigation instead of naming a far-off district */
if (typeof FOCUS_MK !== 'undefined' && FOCUS_MK.parentNode) FOCUS_MK.parentNode.removeChild(FOCUS_MK);
{
  const _st = setText;
  setText = function (id, v) {
    if (id === '#hint' && typeof v === 'string' && /people left/.test(v) && NAV.cur && PLAYER.ent) {
      const c = NAV.cur, p = c.cp ? c.cp.pos : c.p, d = Math.hypot(p.x - PLAYER.ent.pos.x, p.z - PLAYER.ent.pos.z);
      v = ''; /* the bar at the top already says where to go: this line no longer repeats it */
    }
    return _st(id, v);
  };
}
/* the war's warnings under the people bar (a catastrophe, a villain working a district over) only show when the place
   is within 450 m: far-off ones were a second set of orders pulling you across the island */
{
  const _cl = catLine;
  catLine = function () {
    const pe = PLAYER.ent, h = _cl(); if (!h || !pe) return h;
    const cp = CPS.find(c => h.includes(c.name)); return cp && Math.hypot(cp.x - pe.pos.x, cp.z - pe.pos.z) > NAV_R ? '' : h;
  };
}
