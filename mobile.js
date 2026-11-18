'use strict';
/* ===================== IRON MERIDIAN · phone budget: draw what is near, not what is on the island ===================== */
// Measured on the phone tier, one frame in the middle of the island was ~900 draw calls and ~1.5 million triangles,
// more than half of them things you cannot see: every sandbag, trench board, wire coil, tree and rock on the whole map
// (each set is one instanced mesh drawn in full wherever you stand, most of them into the shadow map as well), and
// hundreds of buildings, depots and vehicles a kilometre off in the fog. A phone GPU spends its frame on those.
//
// Two passes, phones and low-end machines only (LOW_END), both run on a slow timer rather than every frame:
//   1. Static instanced sets keep only the copies within reach of the camera. The full set is kept aside; anything
//      that later writes an instance (a prop knocked over) writes into the kept copy, so nothing is lost.
//   2. Static objects past their draw distance stop being rendered (camera and shadow pass both) by turning off render
//      layer 0 on their meshes. Nothing else in the game uses layers, so this never fights another system's
//      `visible` flag. Distance grows with an object's size, so the skyline stays and the clutter goes.
//   3. Static landmark complexes (Skyport, the Volcano works, the Seawall, the Marina, the Orbital Array, the flag post
//      at every district) were dozens of separate meshes each. Once a group has stood still for a few seconds, the
//      pieces that never moved are baked into one mesh per material, parented to the group so it can still move as a
//      whole. Anything that spun, blinked or moved in that time is left as it was.
// Flying high pulls everything back in: from altitude the island is the view.
const MOB_BUDGET = { on: typeof LOW_END !== 'undefined' && LOW_END, sets: [], objs: [], t: 0, scanT: 0, seen: new WeakSet(), last: new V3(1e9, 0, 0), merged: 0, mergedFrom: 0 };
{
  const _p = new V3(), _c = new V3();
  /* ---------- 1 · static instanced sets ---------- */
  function adoptSet(im) {
    const n = Math.min(im.count, (im.instanceMatrix.array.length / 16) | 0); if (n < 24) return;
    const src = new Float32Array(im.instanceMatrix.array.subarray(0, n * 16));
    /* a colour buffer can be shorter than the matrix buffer: only carry colours when it covers every instance */
    const col = im.instanceColor && im.instanceColor.array.length >= n * 3 ? new Float32Array(im.instanceColor.array.subarray(0, n * 3)) : null;
    const S = { im, n, src, col, pos: new Float32Array(n * 3), dirty: true };
    const fill = () => { for (let i = 0; i < S.n; i++) { S.pos[i * 3] = S.src[i * 16 + 12]; S.pos[i * 3 + 1] = S.src[i * 16 + 13]; S.pos[i * 3 + 2] = S.src[i * 16 + 14]; } };
    fill();
    /* later writes land in the kept copy, by their original index */
    im.setMatrixAt = function (i, m) { if (i < S.n) { m.toArray(S.src, i * 16); S.pos[i * 3] = S.src[i * 16 + 12]; S.pos[i * 3 + 1] = S.src[i * 16 + 13]; S.pos[i * 3 + 2] = S.src[i * 16 + 14]; S.dirty = true; } };
    im.getMatrixAt = function (i, m) { return m.fromArray(S.src, i * 16); };
    if (col) { im.setColorAt = function (i, c) { if (i < S.n) { c.toArray(S.col, i * 3); S.dirty = true; } }; }
    MOB_BUDGET.sets.push(S);
  }
  function cullSet(S, cx, cy, cz, R) {
    const R2 = R * R, live = S.im.instanceMatrix.array, lc = S.col && S.im.instanceColor ? S.im.instanceColor.array : null; let k = 0;
    for (let i = 0; i < S.n; i++) {
      const dx = S.pos[i * 3] - cx, dz = S.pos[i * 3 + 2] - cz; if (dx * dx + dz * dz > R2) continue;
      live.set(S.src.subarray(i * 16, i * 16 + 16), k * 16); if (lc) lc.set(S.col.subarray(i * 3, i * 3 + 3), k * 3); k++;
    }
    S.im.count = k; S.im.instanceMatrix.needsUpdate = true; if (lc) S.im.instanceColor.needsUpdate = true; S.dirty = false;
  }
  /* ---------- 2 · static objects by distance ---------- */
  function adoptObj(o, r, cx, cz, noCull) {
    const meshes = []; o.traverse(q => { if (q.isMesh || q.isLine || q.isPoints) meshes.push(q); }); if (!meshes.length) return;
    /* remember where it was built and where its middle sits relative to that, so a group parked at the origin with its
       pieces out in the world is measured from its pieces */
    const E = { o, meshes, r, px: o.position.x, pz: o.position.z, ox: cx - o.position.x, oz: cz - o.position.z, on: true, noCull };
    /* landmark complexes, not things that live: troops, vehicles and buildings (which fall down) keep their pieces */
    if (meshes.length >= 6 && !ENTS.some(e => e.obj === o) && !BUILDINGS.some(b => b.mesh === o)) snapshot(E);
    MOB_BUDGET.objs.push(E);
  }
  /* ---------- 3 · bake still pieces of a static group ---------- */
  const _inv = new T.Matrix4(), _mm = new T.Matrix4();
  function mergeable(q) {
    if (!q.isMesh || q.isInstancedMesh || q.isSkinnedMesh || !q.geometry || !q.geometry.attributes.position) return false;
    const m = q.material; if (!m || Array.isArray(m) || m.transparent || m.vertexColors || q.geometry.attributes.color) return false;
    if (q.geometry.morphAttributes && Object.keys(q.geometry.morphAttributes).length) return false;
    return true;
  }
  function snapshot(E) { E.snap = E.meshes.map(q => { q.updateWorldMatrix(true, false); return [q, q.matrixWorld.elements.slice(12, 15).concat(q.matrixWorld.elements.slice(0, 3)), q.visible]; }); E.stillK = 0; }
  function stillCheck(E) {
    E.snap = E.snap.filter(([q, el, v]) => { q.updateWorldMatrix(true, false); const w = q.matrixWorld.elements; const now = [w[12], w[13], w[14], w[0], w[1], w[2]];
      for (let i = 0; i < 6; i++) if (Math.abs(now[i] - el[i]) > 1e-4) return false; return q.visible === v && q.visible; });
    return ++E.stillK >= 3;
  }
  /* Pieces are grouped by what their material looks like, not by which material object it is: the landmarks build a
     fresh material for nearly every piece, so identical grey steel would never merge. Anything that glows is matched
     only to its own material, so a pulsing beacon can never hand its pulse to the wall next to it. */
  const hex = c => c ? c.getHexString() : '-', uid = x => x ? x.uuid : '-';
  function matKey(m) {
    if (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.001 && (m.emissiveIntensity || 0) > 0) return 'own:' + m.uuid;
    if (m.onBeforeCompile && m.onBeforeCompile.toString().length > 30) return 'own:' + m.uuid; /* custom shader hooks (rim light) */
    return [m.type, hex(m.color), m.roughness, m.metalness, uid(m.map), uid(m.normalMap), uid(m.roughnessMap), uid(m.emissiveMap), m.side, m.flatShading, m.opacity, m.fog, m.envMapIntensity].join('|');
  }
  function bake(E) {
    const g = E.o; g.updateWorldMatrix(true, true); _inv.copy(g.matrixWorld).invert();
    const groups = new Map();
    for (const [q] of E.snap) { if (!mergeable(q) || !q.parent) continue; const key = matKey(q.material) + (q.castShadow ? 's' : '') + (q.receiveShadow ? 'r' : ''); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(q); }
    let made = 0, from = 0;
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const geos = list.map(q => q.geometry.clone().applyMatrix4(_mm.multiplyMatrices(_inv, q.matrixWorld)));
      const m = new T.Mesh(mergeGeos(geos), list[0].material); m.castShadow = list[0].castShadow; m.receiveShadow = list[0].receiveShadow; m.userData.lodKeep = true; m.userData.mobMerged = true;
      g.add(m); m.updateMatrix();
      for (const q of list) { q.layers.disable(0); q.userData.mobHidden = true; }
      for (const gg of geos) gg.dispose();
      made++; from += list.length;
    }
    if (made) { E.meshes = []; g.traverse(q => { if ((q.isMesh || q.isLine || q.isPoints) && !q.userData.mobHidden) E.meshes.push(q); }); if (!E.on) for (const q of E.meshes) q.layers.disable(0); }
    MOB_BUDGET.merged += made; MOB_BUDGET.mergedFrom += from; E.snap = null; E.baked = true;
  }
  function setOn(E, on) { if (on === E.on) return; E.on = on; for (const q of E.meshes) { if (on) q.layers.enable(0); else q.layers.disable(0); } }
  /* what to leave alone: the sky, sea, clouds and terrain, anything huge, every per-frame instanced system, and the player */
  let NEVER = null;
  function skip(o) {
    if (!NEVER) { NEVER = new Set(); for (const k of ['sky', 'water', 'clouds', 'CIVM', 'CARS', 'HANDM', 'projCore', 'projGlow', 'orbDebris', 'casings', 'craters', 'DEB2.im', 'JETS[0]', 'JETS[1]']) { try { const v = eval(k); if (v) NEVER.add(v); } catch (e) { /* not in this build */ } } }
    if (!o || o === camera || o.isLight || o.isCamera || NEVER.has(o)) return true;
    if (PLAYER && PLAYER.ent && PLAYER.ent.obj === o) return true;
    return false;
  }
  /* Instanced meshes are only adopted once their matrices have stood still for a while, so anything that rewrites its
     instances every frame (crowds, projectiles, debris, the farm belts) is never touched. */
  const watch = new Map();
  /* units are never measured with a bounding box (each new one used to cost a walk of its geometry): soldiers already
     have the game's own distance culling, and vehicles get a size from their radius */
  function scan() {
    const entOf = new Map(); for (const e of ENTS) if (e.obj) entOf.set(e.obj, e);
    let budget = GAME.state === 'play' ? 30 : 120; const t0 = performance.now(), cap = GAME.state === 'play' ? 4 : 20; /* a few objects per pass and never more than ~6 ms, so the first look at a thousand objects is spread over a few seconds */
    for (const o of scene.children) {
      if (MOB_BUDGET.seen.has(o) || skip(o)) continue;
      if (!o.isInstancedMesh && (budget-- <= 0 || performance.now() - t0 > cap)) { MOB_BUDGET.scanT = 0.3; break; }
      if (o.isInstancedMesh) {
        const a = o.instanceMatrix.array, n = Math.min(o.count, 64) * 16; let h = o.count * 7.31; for (let i = 0; i < n; i += 5) h = (h * 31 + a[i] * 1000) % 1e9;
        const w = watch.get(o);
        if (!w) { watch.set(o, { h, k: 0 }); continue; }
        if (w.h !== h) { w.h = h; w.k = 0; continue; }
        if (++w.k >= 3 && o.count >= 24) { MOB_BUDGET.seen.add(o); watch.delete(o); adoptSet(o); }
        continue;
      }
      if (o.isPoints) { MOB_BUDGET.seen.add(o); continue; }
      { const e = entOf.get(o); if (e) { MOB_BUDGET.seen.add(o); if (e.kind !== 'soldier' && !e.isPlayer && e.kind !== 'capital') adoptObj(o, (e.radius || 3) * 1.6, o.position.x, o.position.z, false); continue; } }
      if (!o.children.length && !o.isMesh) { MOB_BUDGET.seen.add(o); budget++; continue; } /* empty placeholders (every cover prop leaves one): nothing to draw */
      const box = new T.Box3().setFromObject(o); if (box.isEmpty()) { MOB_BUDGET.seen.add(o); continue; }
      box.getCenter(_c); const r = box.getSize(_p).length() / 2;
      MOB_BUDGET.seen.add(o);
      adoptObj(o, r, _c.x, _c.z, r > 260); /* terrain, sea, the barrier, the big complexes: always drawn, but still merged */
    }
  }
  function updateMobileBudget(dt) {
    if (!MOB_BUDGET.on) return;
    if ((MOB_BUDGET.scanT -= dt) <= 0) { MOB_BUDGET.scanT = 2.5; scan(); /* Merging is the one costly step, so it never runs while you are fighting: only on the menu, the death screen or
       while spectating, which always come first. A few big groups per pass there, inside ~30 ms. */
    if (GAME.state !== 'play') { const t1 = performance.now(); let pend = false;
      for (const E of MOB_BUDGET.objs) { if (!E.snap || !E.o.parent) continue; if (performance.now() - t1 > 30) { pend = true; break; } if (stillCheck(E)) bake(E); else pend = true; }
      if (pend) MOB_BUDGET.scanT = Math.min(MOB_BUDGET.scanT, 0.5); } }
    if ((MOB_BUDGET.t -= dt) > 0) return; MOB_BUDGET.t = 0.4;
    const c = camera.position, alt = Math.max(0, c.y - groundY(c.x, c.z)), lod = (typeof PERF !== 'undefined' ? PERF.lod : 1);
    const reach = alt > 400 ? 99999 : (1 + alt / 120); /* from the air you see the island: everything comes back */
    const moved = MOB_BUDGET.last.distanceToSquared(c) > 144;
    if (moved) MOB_BUDGET.last.copy(c);
    for (const S of MOB_BUDGET.sets) if (moved || S.dirty) cullSet(S, c.x, c.y, c.z, Math.min(1e5, 230 * reach * lod));
    for (const E of MOB_BUDGET.objs) {
      if (!E.o.parent || E.noCull) continue;
      const p = E.o.position, x = p.x + E.ox, z = p.z + E.oz; /* moving things (vehicles, troops) carry their middle with them */
      const R = (520 + E.r * 9) * reach * lod;
      setOn(E, (x - c.x) * (x - c.x) + (z - c.z) * (z - c.z) < R * R);
    }
  }
  window.updateMobileBudget = updateMobileBudget;
  /* ride on the frame loop without touching main.js: the HUD update runs once a frame */
  if (MOB_BUDGET.on && typeof updateDamageUI === 'function') {
    const _ud = updateDamageUI; updateDamageUI = function (dt) { try { updateMobileBudget(dt); } catch (e) { /* the budget must never break the game */ } return _ud(dt); };
  }
}
