'use strict';
/* ===================== IRON MERIDIAN · seven layers, part two: the towns =====================
   The houses, blocks, sheds and workshops out in the districts get the same seven-layer architecture as the city
   towers (layered.js). This runs last, once every district has been built. Left as they were: named landmarks, the
   army headquarters in their colours, masts, stacks, turbines and other things too thin to be a building, and all
   the invisible collision walls. */
for (const B of BUILDINGS) {
  if (B.generic || B.landmark || B.cover || B.bcall || B.maxHp >= 1e6 || !B.alive || !B.mesh || B.mesh.visible === false || (B.base && B.base.opts && B.base.opts.mat)) continue;
  if (B.w < 7 || B.d < 7 || B.h < 4.5 || B.mode === 'topple') continue;
  let has = false; B.mesh.traverse(o => { if (o.isMesh) has = true; }); if (!has) continue;
  scene.remove(B.mesh); B.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  B.mesh = layeredTower(B); B.mesh.position.set(B.x, B.gy, B.z); scene.add(B.mesh);
}
BLD_LOD.n = -1;
