'use strict';
/* ===================== IRON MERIDIAN · trench works: duckboards, revetments, wire, nests, ladders ===================== */
// The trench lines get dressed like real fieldworks: slatted duckboards down the floor, plank revetments and posts lining
// both walls, ladders up to the fire step, barbed-wire coils out front on both sides, machine-gun nests at the corners,
// dugout doors and oil drums. Everything is instanced (a handful of draw calls for the whole trench system).
(function trenchWorks() {
  const wood = std(0x5a4430, 0.92, 0.02, { normalMap: TEX.cloth.normal }), dark = std(0x2a2622, 0.7, 0.5, { normalMap: TEX.armor.normal }), bag = std(0x7a6a4a, 0.95, 0), wire = std(0x55524c, 0.45, 0.8), drum = std(0x6a3a22, 0.6, 0.5, { normalMap: TEX.armor.normal });
  const slats = mergeGeos([0, 1, 2, 3, 4, 5].map(i => xf(new T.BoxGeometry(1.25, 0.06, 0.28), [0, 0.06, -1 + i * 0.4])).concat([xf(new T.BoxGeometry(0.1, 0.08, 2.3), [-0.5, 0, 0]), xf(new T.BoxGeometry(0.1, 0.08, 2.3), [0.5, 0, 0])]));
  const panel = mergeGeos([0, 1, 2, 3].map(i => xf(new T.BoxGeometry(0.08, 2.5, 0.56), [0, 1.25, -0.84 + i * 0.58], [0, 0, rand(-0.02, 0.02)])).concat([xf(new T.BoxGeometry(0.2, 2.9, 0.2), [0.12, 1.45, 1.15])]));
  const coil = mergeGeos([0, 1, 2, 3, 4].map(i => xf(new T.TorusGeometry(0.45, 0.025, 3, 18), [0, 0.5, -1.2 + i * 0.6], [0, 0.35, 0])).concat([xf(new T.BoxGeometry(0.06, 1.2, 0.06), [0, 0.55, -1.5], [0, 0, 0.5]), xf(new T.BoxGeometry(0.06, 1.2, 0.06), [0, 0.55, -1.5], [0, 0, -0.5]), xf(new T.BoxGeometry(0.06, 1.2, 0.06), [0, 0.55, 1.5], [0, 0, 0.5]), xf(new T.BoxGeometry(0.06, 1.2, 0.06), [0, 0.55, 1.5], [0, 0, -0.5])]));
  const ladder = mergeGeos([xf(new T.BoxGeometry(0.08, 3.2, 0.08), [-0.25, 1.6, 0]), xf(new T.BoxGeometry(0.08, 3.2, 0.08), [0.25, 1.6, 0])].concat([0, 1, 2, 3, 4, 5, 6].map(i => xf(new T.BoxGeometry(0.5, 0.05, 0.06), [0, 0.3 + i * 0.42, 0]))));
  const nestBags = mergeGeos([...Array(9)].map((_, i) => { const a = (i / 8 - 0.5) * Math.PI * 1.1; return xf(rbox(1.2, 0.45, 0.5, 0.15, 1), [Math.sin(a) * 2.2, 0.25 + (i % 2) * 0.42, Math.cos(a) * 2.2], [0, a, 0]); }).concat([...Array(7)].map((_, i) => { const a = (i / 6 - 0.5) * Math.PI; return xf(rbox(1.2, 0.45, 0.5, 0.15, 1), [Math.sin(a) * 2.2, 0.92, Math.cos(a) * 2.2], [0, a, 0]); })));
  const mg = mergeGeos([xf(new T.CylinderGeometry(0.05, 0.05, 1.5, 6), [0, 1.35, 1.0], [Math.PI / 2, 0, 0]), xf(new T.BoxGeometry(0.22, 0.24, 0.6), [0, 1.35, 0.3]), xf(new T.CylinderGeometry(0.03, 0.03, 1.1, 5), [0.3, 0.6, 0.1], [0, 0, 0.4]), xf(new T.CylinderGeometry(0.03, 0.03, 1.1, 5), [-0.3, 0.6, 0.1], [0, 0, -0.4]), xf(new T.CylinderGeometry(0.03, 0.03, 1.1, 5), [0, 0.6, -0.3], [0.4, 0, 0]), xf(new T.BoxGeometry(0.5, 0.4, 0.04), [0, 1.45, 0.75])]);
  const door = mergeGeos([xf(new T.BoxGeometry(0.22, 2.2, 0.22), [-0.8, 1.1, 0]), xf(new T.BoxGeometry(0.22, 2.2, 0.22), [0.8, 1.1, 0]), xf(new T.BoxGeometry(2, 0.25, 0.3), [0, 2.25, 0])]), hole = new T.BoxGeometry(1.4, 2, 0.1).translate(0, 1, -0.12);
  const drumG = new T.CylinderGeometry(0.32, 0.32, 0.95, 12).translate(0, 0.47, 0);
  const L = { slats: [], panel: [], coil: [], ladder: [], nest: [], mg: [], door: [], hole: [], drum: [] };
  for (const P of TRENCHES) {
    let along = 0;
    for (let i = 0; i < P.length - 1; i++) {
      const [ax, az] = P[i], [bx, bz] = P[i + 1], len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len, nx = -uz, nz = ux, yaw = Math.atan2(ux, uz);
      for (let s = 1.2; s < len; s += 2.4, along += 2.4) {
        const x = ax + ux * s, z = az + uz * s, fy = H(x, z);
        L.slats.push([x, fy + 0.02, z, yaw]);
        for (const sd of [-1, 1]) {
          L.panel.push([x + nx * sd * 3.3, fy - 0.1, z + nz * sd * 3.3, yaw + (sd > 0 ? Math.PI / 2 : -Math.PI / 2)]);
          const wx = x + nx * sd * 11.5, wz = z + nz * sd * 11.5; if (((along / 2.4) | 0) % 2 === 0 && H(wx, wz) > 1) L.coil.push([wx, H(wx, wz) - 0.1, wz, yaw]);
        }
        const k = (along / 2.4) | 0;
        if (k % 12 === 5) { const sd = k % 24 < 12 ? 1 : -1; L.ladder.push([x + nx * sd * 3.0, fy, z + nz * sd * 3.0, yaw + (sd > 0 ? -Math.PI / 2 : Math.PI / 2)]); }
        if (k % 31 === 17) { const sd = k % 2 ? 1 : -1; L.door.push([x + nx * sd * 3.2, fy, z + nz * sd * 3.2, yaw + (sd > 0 ? -Math.PI / 2 : Math.PI / 2)]); L.hole.push(L.door[L.door.length - 1]); }
        if (k % 7 === 3 && Math.random() < 0.6) L.drum.push([x + rand(-1, 1) * 1.2, fy, z + rand(-1, 1) * 1.2, rand(0, 6)]);
      }
      if (i % 2 === 1) for (const sd of [-1, 1]) { const x = bx + nx * sd * 7.6, z = bz + nz * sd * 7.6; if (H(x, z) > 1) { const r = [x, H(x, z) - 0.15, z, yaw + (sd > 0 ? Math.PI / 2 : -Math.PI / 2)]; L.nest.push(r); L.mg.push(r); } } // a machine-gun nest at every other corner
    }
  }
  const mk = (geo, mat, list, shadow) => { if (!list.length) return; const im = new T.InstancedMesh(geo, mat, list.length); list.forEach((r, i) => { _m.compose(_v1.set(r[0], r[1], r[2]), _q.setFromAxisAngle(UP, r[3]), _s.set(1, 1, 1)); im.setMatrixAt(i, _m); }); im.castShadow = shadow; im.receiveShadow = true; scene.add(im); };
  mk(slats, wood, L.slats, false); mk(panel, wood, L.panel, true); mk(coil, wire, L.coil, false); mk(ladder, wood, L.ladder, true); mk(nestBags, bag, L.nest, true); mk(mg, dark, L.mg, true); mk(door, wood, L.door, true); mk(hole, basic(new T.Color(0.02, 0.02, 0.02)), L.hole, false); mk(drumG, drum, L.drum, true);
})();
