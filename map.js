'use strict';
/* ===================== IRON MERIDIAN · the theatre map: where every point really is ===================== */
// MINIMAP (bottom right): terrain with depth-shaded sea and hill shading, the city blocks and trench lines; every post
//   drawn as its realm (LAND square, OCEAN circle, AIR triangle, SPACE diamond) filled with its owner's colour; the
//   active battle pulses; the causeway and the sky-base ziplines are marked. Units are shown for
//   the layer you are in (ground, sky or orbit). An altitude ladder on the left edge shows where each post sits
//   (land and sea level, 260 m sky base, orbit) and where you are.
// FULL MAP (hold Tab, or tap the minimap): the same at 640 px with names, owners, distances, every zipline, the routes
//   to the ocean, air and space posts, both HQs, the builder sites and the countdown of the active battle.
const MAPV = { open: false, t: 0, bg: {}, el: null, cv: null, ctx: null, hdr: null };
const W2M = x => (x / (BOUND * 2.2) + 0.5) * 170;
const mapXY = (x, size) => (x / (BOUND * 2.2) + 0.5) * size;
const REALM_OF = c => REALM[c.realm || 'land'];
const band = y => y > 900 ? 2 : y > 150 ? 1 : 0;
function mapBg(size) { /* terrain once per size: depth-shaded water, hill-shaded land, buildings, trenches */
  if (MAPV.bg[size]) return MAPV.bg[size];
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d'), id = g.createImageData(size, size), w = BOUND * 2.2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const wx = (x / size - 0.5) * w, wz = (y / size - 0.5) * w, h = H(wx, wz), k = (y * size + x) * 4; let c;
    if (h < 0) { const d = clamp(-h / 40, 0, 1); c = [18 - d * 8, 52 - d * 26, 66 - d * 22]; }
    else { const sl = (H(wx + 6, wz - 6) - H(wx - 6, wz + 6)) * 2.2, v = clamp(70 + h * 0.5 + sl, 30, 170); c = h < 1.2 ? [150, 138, 104] : [v * 0.78, v * 0.74, v * 0.58]; }
    id.data[k] = c[0]; id.data[k + 1] = c[1]; id.data[k + 2] = c[2]; id.data[k + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  g.fillStyle = 'rgba(40,42,48,0.9)'; for (const b of BUILDINGS) { if (b.realmBlock || (b.cover && b.w * b.d < 30)) continue; g.fillRect(mapXY(b.x0, size), mapXY(b.z0, size), Math.max(1, b.w / w * size), Math.max(1, b.d / w * size)); }
  g.strokeStyle = 'rgba(90,60,30,0.9)'; g.lineWidth = Math.max(1, size / 220); for (const L of TRENCHES) { g.beginPath(); L.forEach(([x, z], i) => i ? g.lineTo(mapXY(x, size), mapXY(z, size)) : g.moveTo(mapXY(x, size), mapXY(z, size))); g.stroke(); }
  return (MAPV.bg[size] = cv);
}
function drawPoint(ctx, c, X, Y, s, label) { /* realm shape, owner fill, realm outline, letter */
  const R = REALM_OF(c), cur = THEATRE.cur && THEATRE.cur.cp === c;
  if (cur) { ctx.strokeStyle = `rgba(255,181,71,${0.55 + Math.sin(TIME * 5) * 0.4})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, s * 1.9 + Math.sin(TIME * 3) * 2, 0, 6.283); ctx.stroke(); }
  ctx.beginPath();
  if (c.realm === 'sea') ctx.arc(X, Y, s, 0, 6.283);
  else if (c.realm === 'air') { ctx.moveTo(X, Y - s * 1.15); ctx.lineTo(X + s * 1.1, Y + s * 0.8); ctx.lineTo(X - s * 1.1, Y + s * 0.8); ctx.closePath(); }
  else if (c.realm === 'space') { ctx.moveTo(X, Y - s * 1.2); ctx.lineTo(X + s * 1.1, Y); ctx.lineTo(X, Y + s * 1.2); ctx.lineTo(X - s * 1.1, Y); ctx.closePath(); }
  else ctx.rect(X - s, Y - s, s * 2, s * 2);
  ctx.fillStyle = c.owner ? TEAM_CSS[c.owner] : 'rgba(30,32,36,0.9)'; ctx.fill(); ctx.strokeStyle = R.col; ctx.lineWidth = Math.max(1.5, s / 4); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(s * 0.82)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.tag.slice(0, 3), X, Y + (c.realm === 'air' ? s * 0.2 : 0));
  if (label) { ctx.textBaseline = 'top'; ctx.font = '700 11px sans-serif'; ctx.fillStyle = R.col; ctx.fillText(`${R.label}${c.realm === 'air' ? ' · 260 m' : c.realm === 'space' ? ' · ORBIT' : ''}`, X, Y + s * 1.5); ctx.fillStyle = '#f2ece0'; ctx.font = '600 12px sans-serif'; ctx.fillText(c.name, X, Y + s * 1.5 + 13); if (label.dist) { ctx.fillStyle = 'rgba(242,236,224,0.7)'; ctx.font = '11px monospace'; ctx.fillText(label.dist, X, Y + s * 1.5 + 28); } }
}
function drawRoutes(ctx, size, full) { /* the causeway and the sky-base ziplines */
  const M = x => mapXY(x, size);
  if (RLM.causeway) { ctx.strokeStyle = REALM.sea.col; ctx.lineWidth = full ? 4 : 2; ctx.beginPath(); ctx.moveTo(M(RLM.causeway.x), M(RLM.causeway.z)); ctx.lineTo(M(RLM.causeway.x2), M(RLM.causeway.z2)); ctx.stroke(); }
  ctx.fillStyle = REALM.air.col; for (const L of RLM.czips) { ctx.beginPath(); ctx.arc(M(L.la.x), M(L.la.z), full ? 3.5 : 1.6, 0, 6.283); ctx.fill(); }
  ctx.strokeStyle = REALM.space.col; ctx.lineWidth = full ? 1.5 : 1; if (ctx.setLineDash) ctx.setLineDash([3, 3]);
  if (ctx.setLineDash) ctx.setLineDash([]);
  if (full) {
    ctx.strokeStyle = 'rgba(120,220,255,0.35)'; ctx.lineWidth = 1; for (const L of ZIPS.lines) { if (L.kind !== 'h' || !L.on || L.a.y > 1200) continue; ctx.beginPath(); ctx.moveTo(M(L.a.x), M(L.a.z)); ctx.lineTo(M(L.b.x), M(L.b.z)); ctx.stroke(); }
    ctx.fillStyle = REALM.sea.col; ctx.font = '600 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('Causeway', M((RLM.causeway.x + RLM.causeway.x2) / 2), M(RLM.causeway.z) - 6);
  }
}
function drawUnits(ctx, size, layer) {
  const M = x => mapXY(x, size), k = size / 170;
  for (const e of ENTS) {
    if (!e.alive || e.kind === 'shieldgen' || e.kind === 'capital') continue; if (layer !== null && band(e.pos.y) !== layer) continue;
    if (e.team === 0 && e.kind !== 'bird') continue; const x = M(e.pos.x), y = M(e.pos.z); if (x < 0 || y < 0 || x > size || y > size) continue;
    const sz = ({ monster: 10, shiftframe: 4, speeder: 3, soldier: 2, tank: 3.5, walker: 5, gunship: 3.5, fighter: 3, dropship: 3.5, naval: 6, starship: 4 }[e.kind] || 2) * Math.min(1.6, k);
    ctx.fillStyle = TEAM_CSS[e.team] || '#e8d9a0'; ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
  }
}
function drawPlayerArrow(ctx, size, s) {
  const pe = PLAYER.ent, vp = pe && pe.alive && GAME.state === 'play' ? pe.pos : camera.position, x = mapXY(vp.x, size), y = mapXY(vp.z, size); camDir(_v1); const a = Math.atan2(_v1.x, -_v1.z);
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = '#ffb547'; ctx.strokeStyle = '#1a1307'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -7 * s); ctx.lineTo(5 * s, 5 * s); ctx.lineTo(0, 2 * s); ctx.lineTo(-5 * s, 5 * s); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
/* the altitude ladder: ground and sea · sky base · orbit, with the posts on it and you */
const altK = y => y < 60 ? 0.12 * Math.max(0, y) / 60 : y < 400 ? 0.12 + 0.38 * (y - 60) / 340 : Math.min(1, 0.5 + 0.5 * Math.log(y / 400) / Math.log(2200 / 400));
function drawLadder(ctx, x0, y0, h) {
  ctx.fillStyle = 'rgba(8,10,14,0.75)'; ctx.fillRect(x0, y0, 14, h);
  const seg = [[0, 0.12, REALM.land.col], [0.12, 0.5, REALM.air.col], [0.5, 1, REALM.space.col]];
  for (const [a, b, col] of seg) { ctx.fillStyle = col; ctx.globalAlpha = 0.25; ctx.fillRect(x0, y0 + h * (1 - b), 14, h * (b - a)); ctx.globalAlpha = 1; }
  ctx.font = '700 8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const c of CPS) { const yy = y0 + h * (1 - altK(c.pos.y)) - (c.realm === 'land' ? 6 + (CPS.indexOf(c) % 3) * 7 : 0); ctx.fillStyle = REALM_OF(c).col; ctx.fillText(c.tag.slice(0, 3), x0 + 7, clamp(yy, y0 + 5, y0 + h - 4)); }
  const pe = PLAYER.ent, py = pe && pe.alive ? pe.pos.y : camera.position.y, yy = y0 + h * (1 - altK(py)); ctx.fillStyle = '#ffb547'; ctx.beginPath(); ctx.moveTo(x0 + 14, yy); ctx.lineTo(x0 + 19, yy - 3.5); ctx.lineTo(x0 + 19, yy + 3.5); ctx.closePath(); ctx.fill();
}
/* ---------- minimap (called from the HUD each tenth of a second) ---------- */
function drawMinimap(ctx) {
  ctx.drawImage(mapBg(170), 0, 0);
  const pe = PLAYER.ent, layer = band(pe && pe.alive ? pe.pos.y : camera.position.y);
  drawRoutes(ctx, 170, false);
  for (const s of STATIONS) { const own = s.cp ? s.cp.owner : s.team; if (own !== 1) continue; const x = W2M(s.x), y = W2M(s.z); ctx.fillStyle = '#6dff9a'; ctx.fillRect(x - 0.8, y - 3, 1.6, 6); ctx.fillRect(x - 3, y - 0.8, 6, 1.6); }
  drawUnits(ctx, 170, layer); drawBuildSites(ctx, W2M);
  for (const c of CPS) drawPoint(ctx, c, W2M(c.x), W2M(c.z), 6, null);
  for (const s of STRIKES) { ctx.strokeStyle = s.team === 1 ? '#5ccaff' : '#ff5d3d'; ctx.beginPath(); ctx.arc(W2M(s.p.x), W2M(s.p.z), 5 + Math.sin(TIME * 12) * 2, 0, 7); ctx.stroke(); }
  drawPlayerArrow(ctx, 170, 1); drawLadder(ctx, 2, 8, 154);
  ctx.fillStyle = 'rgba(242,236,224,0.6)'; ctx.font = '700 8px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText(['GROUND', 'SKY', 'ORBIT'][layer], 166, 3);
}
/* ---------- full theatre map ---------- */
function mapInit() {
  const el = document.createElement('div'); el.id = 'bigmap'; el.innerHTML = '<div class="bm-h"></div><canvas width="640" height="640"></canvas><div class="bm-l"><span><i class="sq"></i>LAND</span><span><i class="ci"></i>OCEAN</span><span><i class="tr"></i>AIR · 260 m</span><span><i class="di"></i>SPACE · orbit</span><span><i class="ln"></i>zipline</span><span><i class="dl"></i>elevator → station</span></div><div class="bm-k">Hold Tab · tap to close</div>';
  document.body.appendChild(el); MAPV.el = el; MAPV.cv = el.querySelector('canvas'); MAPV.ctx = MAPV.cv.getContext('2d'); MAPV.hdr = el.querySelector('.bm-h');
  el.addEventListener('click', () => mapShow(false));
  const mini = document.querySelector('#mini'); if (mini) mini.addEventListener('click', () => mapShow(!MAPV.open));
  for (const c of CPS) { const R = REALM_OF(c); if (c.chip) { c.chip.innerHTML = `${c.tag}<i style="color:${R.col}">${R.label}</i><b></b>`; c.chip.title = `${c.name} · ${R.label}`; } if (c.mk) { c.mk.innerHTML = `${c.name}<i style="color:${R.col}">${R.label}</i><small></small>`; } }
}
function mapShow(on) { MAPV.open = on; if (MAPV.el) MAPV.el.classList.toggle('on', on); if (on) MAPV.t = 0; }
/* the full map opens from the minimap (tap or click it); Tab no longer does, to keep the keys to the kit */
function drawBigMap() {
  const ctx = MAPV.ctx, S = 640, M = x => mapXY(x, S), pe = PLAYER.ent; ctx.drawImage(mapBg(S), 0, 0);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; for (let v = -800; v <= 800; v += 200) { ctx.beginPath(); ctx.moveTo(M(v), 0); ctx.lineTo(M(v), S); ctx.moveTo(0, M(v)); ctx.lineTo(S, M(v)); ctx.stroke(); }
  drawRoutes(ctx, S, true); drawUnits(ctx, S, null); drawBuildSites(ctx, M);
  for (const t of [1, 2]) { const h = HQ[t]; if (!h) continue; ctx.fillStyle = TEAM_CSS[t]; ctx.font = '800 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${TEAM[t].short} HQ`, M(h.x), M(h.z)); }
  for (const c of CPS) drawPoint(ctx, c, M(c.x), M(c.z), 11, { dist: pe && pe.alive ? `${Math.round(pe.pos.distanceTo(c.pos))} m` : '' });
  drawPlayerArrow(ctx, S, 1.6);
  ctx.fillStyle = '#f2ece0'; ctx.font = '800 14px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('N ↑', 10, 8);
  const T0 = THEATRE.cur, R = T0 && T0.cp ? REALM_OF(T0.cp) : null, m = Math.max(0, Math.floor(THEATRE.t / 60)), s = Math.max(0, Math.floor(THEATRE.t % 60));
  const html = T0 ? `<b style="color:${R ? R.col : '#ffb547'}">ACTIVE BATTLE · ${T0.title.toUpperCase()}</b> ${m}:${String(s).padStart(2, '0')} left · ${T0.cp ? routeText(T0.cp, pe || { pos: camera.position }) : ''}` : 'Theatre map'; if (MAPV.hdr.innerHTML !== html) MAPV.hdr.innerHTML = html;
}
function updateMap(dt) {
  if (!MAPV.el) mapInit();
  if (!MAPV.open) return; if (GAME.state !== 'play') { mapShow(false); return; }
  if ((MAPV.t -= dt) > 0) return; MAPV.t = 0.15; drawBigMap();
}
