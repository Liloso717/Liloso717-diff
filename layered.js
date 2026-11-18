'use strict';
/* ===================== IRON MERIDIAN · every building in seven layers, no two alike =====================
   All the city's own buildings are modern architecture in seven layers, foundation to roof, each layer floating a
   hand's breadth above the last on a deep shadow gap: 1 the dark foundation plinth, 2 to 6 five layers of floor slab
   over recessed glass, 7 the roof. Within that, seven different designs, picked per building (the same building is
   always the same design), in twelve bright tycoon palettes (white with a red, blue, green or orange accent; yellow, blue, red, purple, green slabs):
     slab     oversailing floor slabs on corner and bay piers, all opening between
     step     every layer smaller than the one below: a ziggurat of terraces
     stack    boxes shoved out of line, each layer cantilevered a different way
     fins     no piers: a glass tower behind tall vertical blades
     podium   two broad layers of base, a slim tower rising from one corner of it
     garden   the middle layer left open to the wind: columns, a core, and planting
     punched  solid walls with a ribbon of window openings cut through each layer
     drum     a round tower: glass drum, ring slabs, a colonnade, a glass dome and a needle on top
   Detail, so nothing reads as a stack of plain boxes: round columns with caps, mullions and transoms on all the
   glass, a railing on posts round every slab, a profiled lip on each slab edge, a stepped plinth, an entrance canopy
   on columns; small buildings get pitched roofs (tile or slate, gable or mono-pitch) with a chimney or flue; towers
   get a penthouse under a sloping roof, a tapering spire or a roof garden with trees, plus a water tank and chiller.
   Crowns differ too: a set-back penthouse, a mast, a roof garden, or a clean slab.
   The skyline's thirteen skyscrapers come in three sizes, six big to four medium to three small (core.js).
   Ground floors are rooms you can walk into, as before (interiors.js). Past about 250 m the piers, fins and shadow
   gaps drop out and only slabs and glass are drawn. */
ARCH_MAT.paper = std(0xa9a59c, 0.88, 0.04); ARCH_MAT.pier = ARCH_MAT.paper; ARCH_MAT.timber = std(0x8f6238, 0.8, 0.05); ARCH_MAT.gap = std(0x14161a, 0.9, 0.1); ARCH_MAT.charcoal = std(0x33373d, 0.7, 0.35);
/* tycoon colours: every plot has its own bright accent */
ARCH_MAT.tred = std(0xd4483a, 0.7, 0.08); ARCH_MAT.tblue = std(0x3a78d4, 0.7, 0.08); ARCH_MAT.tyellow = std(0xe6b632, 0.7, 0.08); ARCH_MAT.tgreen = std(0x44a653, 0.7, 0.08); ARCH_MAT.torange = std(0xe57f2e, 0.7, 0.08); ARCH_MAT.tpurple = std(0x8a55c9, 0.7, 0.08);
for (const m of ['paper', 'trim', 'charcoal', 'copper', 'timber', 'tred', 'tblue', 'tyellow', 'tgreen', 'torange', 'tpurple']) ARCH_MAT['s_' + m] = ARCH_MAT[m]; /* the same materials under a second name, so slabs and piers bake into separate meshes */
const LAY_DESIGNS = ['slab', 'step', 'stack', 'fins', 'podium', 'garden', 'punched', 'drum'];
ARCH_MAT.mull = std(0x24272b, 0.5, 0.7); ARCH_MAT.rtile = std(0x9a4a34, 0.85, 0.02, { side: T.DoubleSide }); ARCH_MAT.rslate = std(0x3d444c, 0.7, 0.15, { side: T.DoubleSide });
const LAY_PAL = [['paper', 'tred', 'pier'], ['paper', 'tblue', 'tblue'], ['tyellow', 'charcoal', 'pier'], ['paper', 'tgreen', 'timber'], ['tblue', 'pier', 'tyellow'], ['tred', 'pier', 'charcoal'], ['paper', 'torange', 'torange'], ['tpurple', 'pier', 'tyellow'], ['torange', 'charcoal', 'pier'], ['tgreen', 'pier', 'timber'], ['timber', 'pier', 'tred'], ['charcoal', 'tyellow', 'pier']]; /* slab, piers on even layers, piers on odd */
function layHash(B, n) { const v = Math.sin(B.x * 12.9898 + B.z * 78.233 + n * 37.719) * 43758.5453; return v - Math.floor(v); }
/* pitched roof: two slopes and two gable ends, ridge along the longer side (real triangles, not a box) */
function layGable(w, d, rise, y, ox, oz, mono) {
  const alongX = w >= d, a = alongX ? w / 2 : d / 2, b = alongX ? d / 2 : w / 2, P = [], v = (l, h, s) => alongX ? [ox + l, y + h, oz + s] : [ox + s, y + h, oz + l], tri = (p, q, r) => P.push(...p, ...q, ...r);
  const A = v(-a, 0, -b), Bq = v(a, 0, -b), C = v(a, 0, b), D = v(-a, 0, b), rs = mono ? b : 0, R1 = v(-a, rise, rs), R2 = v(a, rise, rs);
  tri(A, Bq, R2); tri(A, R2, R1); tri(C, D, R1); tri(C, R1, R2); tri(Bq, C, R2); tri(D, A, R1);
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); return g;
}
function layeredTower(B) {
  B.lay = true; const w = B.w, d = B.d, h = B.h, b = bucket(), g = new T.Group(), bx = (ww, hh, dd, x, y, z) => new T.BoxGeometry(ww, hh, dd).translate(x, y + hh / 2, z); /* y is the underside */
  const cyl = (r, hh, x, y, z, seg = 10, r2) => new T.CylinderGeometry(r2 === undefined ? r : r2, r, hh, seg).translate(x, y + hh / 2, z), tube = (r, hh, x, y, z, r2) => new T.CylinderGeometry(r2 === undefined ? r : r2, r, hh, 8, 1, true).translate(x, y + hh / 2, z); /* tube: no end caps, for columns whose ends are buried */
  const pool = h >= 40 ? LAY_DESIGNS : ['punched', 'stack', 'slab', 'step']; let design = pool[(layHash(B, 1) * pool.length) | 0];
  const pal = LAY_PAL[(layHash(B, 3) * LAY_PAL.length) | 0], slabKey = 's_' + pal[0];
  const F = Math.min(2.2, h * 0.22), R = Math.min(0.9, 0.3 + h * 0.02), fh = (h - F - R) / 5, m = Math.min(w, d), drum = design === 'drum', rad = m / 2;
  let cw = w, cd = d, ox = 0, oz = 0;
  if (drum) b.add('s_charcoal', cyl(rad + 0.5, F, 0, 0, 0, 28)); else { b.add('s_charcoal', bx(w + 0.8, F, d + 0.8, 0, 0, 0)); b.add('s_charcoal', bx(w + 1.3, F * 0.45, d + 1.3, 0, 0, 0)); } /* a stepped plinth */
  for (let k = 0; k < 5; k++) {
    let s = 1; ox = 0; oz = 0;
    if (design === 'step') s = 1 - k * 0.085;
    else if (design === 'stack') { s = 0.84; const q = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]][k]; ox = q[0] * w * 0.08; oz = q[1] * d * 0.08; }
    else if (design === 'podium' && k >= 2) { s = 0.58; ox = -w * 0.2 * (layHash(B, 4) < 0.5 ? 1 : -1); oz = d * 0.2 * (layHash(B, 5) < 0.5 ? 1 : -1); }
    else if (drum) s = k === 4 ? 0.86 : 1;
    cw = w * s; cd = d * s; const mm = Math.min(cw, cd), inset = Math.min(0.5, mm * 0.06), p = clamp(mm * 0.07, 0.35, 1.5);
    const y0 = F + k * fh, gap = Math.min(0.6, fh * 0.14), slab = Math.min(1.2, fh * 0.2) * (design === 'fins' ? 0.5 : 1), ph = fh - gap - slab, pk = k & 1 ? pal[2] : pal[1], yT = y0 + fh, railH = Math.min(1.1, fh * 0.2);
    if (drum) { /* a round tower: a glass drum, ring slabs, a colonnade */
      const r = rad * s, n = Math.max(8, Math.round(r * 1.1));
      b.add('gap', cyl(r - inset * 2, gap, 0, y0, 0, 20)); const gl = cyl(r - inset, fh - gap, 0, y0 + gap, 0, 28); boxProjUV(gl, 24, true); b.add('glass', gl);
      for (let i = 0; i < n; i++) { const a = i / n * 6.2832; b.add(pk, cyl(p * 0.45, ph, Math.cos(a) * (r - p * 0.4), y0 + gap, Math.sin(a) * (r - p * 0.4), 8)); }
      for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * 6.2832; b.add('mull', bx(0.1, ph, 0.1, Math.cos(a) * (r - inset + 0.05), y0 + gap, Math.sin(a) * (r - inset + 0.05))); }
      b.add(slabKey, cyl(r + 0.4, slab, 0, yT - slab, 0, 32)); b.add(slabKey, cyl(r + 0.7, slab * 0.35, 0, yT - slab * 0.35, 0, 32)); b.add('mull', new T.TorusGeometry(r + 0.6, 0.05, 4, 32).rotateX(Math.PI / 2).translate(0, yT + railH, 0));
      continue;
    }
    b.add('gap', bx(cw - inset * 4, gap, cd - inset * 4, ox, y0, oz)); /* the air under the layer */
    const open = design === 'garden' && k === 2;
    if (open) { /* the open layer: a round core, planting, columns */
      b.add('s_charcoal', cyl(mm * 0.2, fh - gap, ox, y0 + gap, oz, 16)); const pl = Math.min(1.4, ph * 0.12);
      for (const e of [-1, 1]) { b.add('green', bx(cw * 0.8, pl, 1.2, ox, y0 + gap, oz + e * (cd / 2 - 1))); b.add('green', bx(1.2, pl, cd * 0.6, ox + e * (cw / 2 - 1), y0 + gap, oz)); }
      for (let i = 0; i < 6; i++) { const a = i * 1.047; b.add('green', new T.IcosahedronGeometry(Math.min(2.2, ph * 0.22), 1).translate(ox + Math.cos(a) * cw * 0.3, y0 + gap + pl + ph * 0.25, oz + Math.sin(a) * cd * 0.3)); }
    } else { const gl = bx(cw - inset * 2, fh - gap, cd - inset * 2, ox, y0 + gap, oz); boxProjUV(gl, 24, true); b.add('glass', gl); /* the glass, set back, and its mullions */
      const gx = cw / 2 - inset + 0.06, gz = cd / 2 - inset + 0.06, mh = fh - gap - slab;
      for (let i = 1, n = Math.max(2, Math.round(cw / 4)); i < n; i++) for (const e of [-1, 1]) b.add('mull', bx(0.1, mh, 0.14, ox - cw / 2 + cw * i / n, y0 + gap, oz + e * gz));
      for (let i = 1, n = Math.max(2, Math.round(cd / 4)); i < n; i++) for (const e of [-1, 1]) b.add('mull', bx(0.14, mh, 0.1, ox + e * gx, y0 + gap, oz - cd / 2 + cd * i / n));
      if (mh > 5) for (const e of [-1, 1]) { b.add('mull', bx(cw - inset * 2, 0.1, 0.12, ox, y0 + gap + mh * 0.5, oz + e * gz)); b.add('mull', bx(0.12, 0.1, cd - inset * 2, ox + e * gx, y0 + gap + mh * 0.5, oz)); } } /* a transom across tall glass */
    if (design === 'punched') { const lo = ph * 0.3, hi = ph * 0.22; b.add(slabKey, bx(cw, lo, cd, ox, y0 + gap, oz)); b.add(slabKey, bx(cw, hi, cd, ox, y0 + gap + ph - hi, oz)); } /* wall below and above the ribbon of openings */
    if (design === 'fins') { /* tapering blades standing off the glass on all four faces */
      for (let i = 0, n = Math.max(2, Math.floor(cw / 3.2)); i <= n; i++) for (const e of [-1, 1]) b.add(pk, bx(0.28, ph + slab, 1, ox - cw / 2 + cw * i / n, y0 + gap, oz + e * (cd / 2 - 0.15)));
      for (let i = 1, n = Math.max(2, Math.floor(cd / 3.2)); i < n; i++) for (const e of [-1, 1]) b.add(pk, bx(1, ph + slab, 0.28, ox + e * (cw / 2 - 0.15), y0 + gap, oz - cd / 2 + cd * i / n));
    } else { /* columns: the corners, then along each side; round, with a cap, except in the punched walls */
      const sq = design === 'punched', bay = sq ? 5 : 9, pw = sq ? p * 1.5 : p, xs = [-(cw - pw) / 2, (cw - pw) / 2], zs = [-(cd - pw) / 2, (cd - pw) / 2];
      for (let i = 1, n = Math.floor(cw / bay); i < n; i++) xs.push(-cw / 2 + cw * i / n); for (let i = 1, n = Math.floor(cd / bay); i < n; i++) zs.push(-cd / 2 + cd * i / n);
      const col = (x, z) => { if (sq) b.add(pk, bx(pw, ph, pw, ox + x, y0 + gap, oz + z)); else if (ph < 4) b.add(pk, tube(pw * 0.5, ph, ox + x, y0 + gap, oz + z, pw * 0.42)); else { const ch = Math.min(0.5, ph * 0.06); b.add(pk, tube(pw * 0.5, ph - ch, ox + x, y0 + gap, oz + z, pw * 0.42)); b.add(pk, tube(pw * 0.42, ch, ox + x, y0 + gap + ph - ch, oz + z, pw * 0.7)); } }; /* tall columns get a flared cap */
      for (const x of xs) for (const z of [zs[0], zs[1]]) col(x, z);
      for (let i = 2; i < zs.length; i++) for (const x of [xs[0], xs[1]]) col(x, zs[i]);
    }
    b.add(slabKey, bx(cw + 0.5, slab, cd + 0.5, ox, yT - slab, oz)); b.add(slabKey, bx(cw + 0.9, slab * 0.35, cd + 0.9, ox, yT - slab * 0.35, oz)); /* the floor slab over it, with a thin projecting lip */
    if (fh > 5 || k === 4 || (k & 1)) for (const e of [-1, 1]) { b.add('mull', bx(cw + 0.8, 0.07, 0.07, ox, yT + railH, oz + e * (cd / 2 + 0.4))); b.add('mull', bx(0.07, 0.07, cd + 0.8, ox + e * (cw / 2 + 0.4), yT + railH, oz)); /* a balcony rail round every slab, on posts */
      for (const f2 of [-1, 0, 1]) b.add('mull', bx(0.06, railH, 0.06, ox + f2 * (cw / 2 + 0.4), yT, oz + e * (cd / 2 + 0.4))); b.add('mull', bx(0.06, railH, 0.06, ox + e * (cw / 2 + 0.4), yT, oz)); }
    if (design === 'step' && k < 4) b.add('green', bx(cw - 0.6, 0.35, cd - 0.6, ox, yT, oz)); /* planted terraces on the steps */
  }
  /* 7: the roof, and what stands on it */
  const crown = (layHash(B, 6) * 4) | 0, mt = Math.min(cw, cd);
  if (drum) { b.add(slabKey, cyl(rad * 0.86 + 0.9, R, 0, h - R, 0, 32)); b.add('glass', (() => { const q = new T.SphereGeometry(rad * 0.6, 20, 8, 0, 6.2832, 0, Math.PI / 2).translate(0, h, 0); boxProjUV(q, 24, false); return q; })()); b.add('charcoal', cyl(0.25, h * 0.1, 0, h + rad * 0.6, 0, 6, 0.04)); } /* a glass dome and a needle */
  else if (h < 24 && design !== 'step') { const pitch = layHash(B, 7), rise = Math.min(4, mt * (0.22 + pitch * 0.2)); /* small buildings: a pitched roof, tiles or slate, a chimney or a flue */
    b.add(slabKey, bx(cw + 1.4, R * 0.6, cd + 1.4, ox, h - R, oz)); b.add(pitch < 0.5 ? 'rtile' : 'rslate', layGable(cw + 1.8, cd + 1.8, rise, h - R * 0.4, ox, oz, layHash(B, 8) < 0.3));
    if (crown < 2) b.add('charcoal', bx(0.9, rise * 0.9 + 1, 0.9, ox + cw * 0.25, h - R * 0.4, oz + cd * 0.15)); else b.add('charcoal', cyl(0.25, rise + 1.2, ox - cw * 0.25, h - R * 0.4, oz - cd * 0.1, 8));
  } else { b.add(slabKey, bx(cw + 1.4, R, cd + 1.4, ox, h - R, oz)); b.add(slabKey, bx(cw + 1.9, R * 0.35, cd + 1.9, ox, h - R * 0.35, oz));
    for (const e of [-1, 1]) { b.add('mull', bx(cw + 1.2, 0.08, 0.08, ox, h + 1.1, oz + e * (cd / 2 + 0.6))); b.add('mull', bx(0.08, 0.08, cd + 1.2, ox + e * (cw / 2 + 0.6), h + 1.1, oz)); for (const f of [-1, 1]) b.add('mull', bx(0.08, 1.1, 0.08, ox + f * (cw / 2 + 0.6), h, oz + e * (cd / 2 + 0.6))); }
    if (crown === 0 && mt > 8) { const ph2 = Math.min(3.2, 1 + h * 0.04); b.add('charcoal', bx(cw * 0.42, ph2, cd * 0.42, ox + cw * 0.12, h, oz)); b.add('pier', layGable(cw * 0.42 + 0.6, cd * 0.42 + 0.6, ph2 * 0.5, h + ph2, ox + cw * 0.12, oz, true)); } /* a penthouse under a mono-pitch */
    else if (crown === 1 && h > 30) { b.add('charcoal', cyl(mt * 0.12, 2, ox, h, oz, 12)); b.add('charcoal', cyl(mt * 0.05, h * 0.16, ox, h + 2, oz, 8, 0.05)); } /* a tapering spire */
    else if (crown === 2 && mt > 8) { b.add('green', bx(cw * 0.7, 0.5, cd * 0.7, ox, h, oz)); for (let i = 0; i < 4; i++) b.add('green', new T.IcosahedronGeometry(1 + layHash(B, 9 + i), 1).translate(ox + (i % 2 ? 1 : -1) * cw * 0.22, h + 1.6, oz + (i < 2 ? 1 : -1) * cd * 0.22)); } /* a roof garden with trees */
    if (mt > 10) { b.add('pier', cyl(Math.min(1.6, mt * 0.07), 2.4, ox - cw * 0.3, h, oz - cd * 0.3, 12)); b.add('pier', new T.ConeGeometry(Math.min(1.7, mt * 0.075), 0.9, 12).translate(ox - cw * 0.3, h + 2.85, oz - cd * 0.3)); /* a water tank with a conical lid */
      b.add('mull', bx(1.6, 1, 1.2, ox + cw * 0.3, h, oz - cd * 0.32)); b.add('mull', cyl(0.4, 0.2, ox + cw * 0.3, h + 1, oz - cd * 0.32, 10)); } /* a chiller with its fan */
  }
  /* the way in: a canopy on two round columns over the front door */
  if (!drum && m > 8) { const cz = d / 2 + 1.6, cy2 = Math.min(F + 3.2, F + fh * 0.6); b.add(slabKey, bx(5, 0.18, 3.2, 0, cy2, cz)); for (const e of [-1, 1]) b.add('mull', cyl(0.12, cy2 - 0.6, e * 2.2, 0.6, cz + 1.3, 8)); b.add('mull', bx(2.4, 0.1, 0.5, 0, 0.75, cz + 0.6)); }
  for (const k of Object.keys(b)) { if (k === 'add' || !b[k].length) continue; const keep = k === 'glass' || k.startsWith('s_') || k[0] === 'r', mesh = new T.Mesh(mergeGeos(b[k]), ARCH_MAT[k]); mesh.castShadow = keep; mesh.receiveShadow = true; mesh.userData.keep = keep; g.add(mesh); }
  return g;
}
for (const B of BUILDINGS) {
  if (!B.generic) continue;
  scene.remove(B.mesh); B.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  B.mesh = layeredTower(B); B.mesh.position.set(B.x, B.gy, B.z); scene.add(B.mesh);
}
BLD_LOD.n = -1;
