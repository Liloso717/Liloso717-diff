'use strict';
/* ===================== IRON MERIDIAN · crowd rendering: 300 soldiers on the field without the frame rate dying ===================== */
// Soldiers within ~75 m are drawn with their full models and animation. Further out they become one instanced
// silhouette per army (body in army armour, helmet in army colour): four draw calls for every distant soldier on the map,
// and their skeletal animation is skipped (a little bob keeps them alive).
const CROWD = (() => {
  const parts = [[new T.BoxGeometry(0.15, 0.85, 0.17), [-0.1, 0.43, 0], 'd'], [new T.BoxGeometry(0.15, 0.85, 0.17), [0.1, 0.43, 0], 'd'], [new T.BoxGeometry(0.44, 0.56, 0.27), [0, 1.15, 0], 'b'], [new T.BoxGeometry(0.32, 0.36, 0.16), [0, 1.2, -0.21], 'd'],
    [new T.SphereGeometry(0.15, 8, 6), [0, 1.6, 0], 'h'], [new T.BoxGeometry(0.07, 0.09, 0.75), [0.16, 1.24, 0.34], 'd'], [new T.BoxGeometry(0.12, 0.42, 0.12), [0.24, 1.12, 0.12], 'b'], [new T.BoxGeometry(0.12, 0.42, 0.12), [-0.24, 1.12, 0.1], 'b']];
  const M = {}, N = 200;
  for (const t of ARMIES) {
    const body = new T.Color(SMAT[t] && SMAT[t].armor ? SMAT[t].armor.color : 0x888888), helm = new T.Color(ARMY_LOOK[t].helm), dark = new T.Color(0x23262b);
    const geos = parts.map(([g, p]) => xf(g, p)), g = mergeGeos(geos), col = new Float32Array(g.attributes.position.count * 3); let o = 0;
    geos.forEach((gg, i) => { const c = parts[i][2] === 'h' ? helm : parts[i][2] === 'b' ? body : dark, n = gg.attributes.position.count; for (let k = 0; k < n; k++) { col[o++] = c.r; col[o++] = c.g; col[o++] = c.b; } });
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    const im = new T.InstancedMesh(g, std(0xffffff, 0.7, 0.2, { vertexColors: true }), N); im.count = 0; im.frustumCulled = false; im.castShadow = false; im.receiveShadow = false; scene.add(im); M[t] = im;
  }
  return { M, N, near: 75 };
})();
function updateCrowd() {
  const cp = camera.position, near = CROWD.near * POST.lod * (PERF.lod > 0.8 ? 1 : PERF.lod + 0.2), n2 = near * near, cnt = { 1: 0, 2: 0, 4: 0, 5: 0 };
  for (const e of ENTS) {
    if (e.kind !== 'soldier' || !e.obj || e.isPlayer) continue;
    const dx = e.pos.x - cp.x, dz = e.pos.z - cp.z, d2 = dx * dx + dz * dz, im = CROWD.M[e.team];
    const far = d2 > n2 && e.alive && im && e.obj.visible; // main loop already culled the truly distant and the hidden riders
    if (!far) { if (e.imp) { e.imp = false; } continue; }
    e.imp = true; e.obj.visible = false; const k = cnt[e.team]; if (k >= CROWD.N) continue; cnt[e.team]++;
    const bob = e.moveSpeed > 0.5 ? Math.abs(Math.sin(TIME * 9 + e.pos.x)) * 0.08 : 0, sc = e.crouch ? 0.82 : 1;
    _m.compose(_v1.set(e.pos.x, e.pos.y + bob, e.pos.z), _q.setFromAxisAngle(UP, e.yaw || 0), _s.set(1, sc, 1)); im.setMatrixAt(k, _m);
  }
  for (const t in CROWD.M) { const im = CROWD.M[t]; im.count = cnt[t]; im.instanceMatrix.needsUpdate = true; }
}
