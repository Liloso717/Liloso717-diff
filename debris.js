'use strict';
/* ===================== IRON MERIDIAN · debris: what breaks stays broken for a moment ===================== */
// Every blast, crash and collapse throws real pieces of whatever broke: concrete and glass off a tower, steel plate and
// glass off a vehicle, clods of earth out of a field, timber out of a hut. Pieces fly, spin, bounce, skid to a stop, lie
// there a few seconds and sink away. Hot ones trail smoke and embers; ones that land in water splash and go under.
//
// One instanced mesh, one draw call, every piece in flat typed arrays: nothing is allocated per piece and nothing is
// drawn when nothing is in the air. Phones get a smaller pool and shorter linger. The old spawnDebris(p, n, power, size)
// keeps its signature, so every existing caller in the game is upgraded at once.
const DEB2 = (() => {
  const low = typeof LOW_END !== 'undefined' && LOW_END;
  const N = low ? 150 : 300;
  const geo = new T.DodecahedronGeometry(1, 0); geo.computeVertexNormals();
  const mat = std(0xffffff, 0.86, 0.15, { flatShading: true });
  const im = new T.InstancedMesh(geo, mat, N); im.castShadow = !low; im.receiveShadow = false; im.frustumCulled = false;
  im.instanceColor = new T.InstancedBufferAttribute(new Float32Array(N * 3).fill(1), 3); im.count = 0; scene.add(im);
  return {
    N, low, im, next: 0, live: 0, top: 0,
    p: new Float32Array(N * 3), v: new Float32Array(N * 3), r: new Float32Array(N * 3), w: new Float32Array(N * 3), s: new Float32Array(N * 3),
    life: new Float32Array(N), rest: new Float32Array(N), flags: new Uint8Array(N), /* 1 alive · 2 hot · 4 settled · 8 sinking */
    linger: low ? 3.5 : 7,
  };
})();
/* what each material looks like: [r, g, b] ranges and the shape of a piece (x, y, z scale ratios) */
const DEB_KIND = {
  concrete: { cols: [[0.62, 0.6, 0.56], [0.48, 0.47, 0.45], [0.72, 0.7, 0.66]], shape: [1, 0.75, 0.9] },
  glass: { cols: [[0.62, 0.78, 0.88], [0.78, 0.88, 0.95]], shape: [1, 0.12, 0.8] },
  metal: { cols: [[0.22, 0.23, 0.25], [0.32, 0.33, 0.36], [0.15, 0.15, 0.16]], shape: [1.2, 0.18, 0.9] },
  dirt: { cols: [[0.36, 0.28, 0.2], [0.44, 0.35, 0.25], [0.3, 0.24, 0.17]], shape: [1, 0.8, 1] },
  rock: { cols: [[0.4, 0.38, 0.36], [0.3, 0.29, 0.28]], shape: [1, 0.85, 1] },
  wood: { cols: [[0.45, 0.33, 0.2], [0.36, 0.26, 0.16]], shape: [1.8, 0.25, 0.35] },
  sand: { cols: [[0.55, 0.48, 0.34], [0.48, 0.42, 0.3]], shape: [1, 0.6, 0.8] },
  char: { cols: [[0.08, 0.07, 0.07], [0.14, 0.12, 0.11]], shape: [1, 0.6, 0.9] },
};
const _dbv = new V3();
/* the one call: a burst of n pieces of a material at p. dir (optional) biases the throw, hot makes them smoke */
function debrisBurst(p, n, power, size, kind = 'concrete', o = {}) {
  const D = DEB2, c = camera.position, dx = p.x - c.x, dz = p.z - c.z;
  if (dx * dx + dz * dz > (D.low ? 380 * 380 : 650 * 650)) return; /* nobody would see them */
  const K = DEB_KIND[kind] || DEB_KIND.concrete, cnt = Math.max(1, Math.round(n * (D.low ? 0.6 : 1)));
  for (let k = 0; k < cnt; k++) {
    const i = D.next; D.next = (D.next + 1) % D.N; const i3 = i * 3;
    let vx = rand(-1, 1), vy = rand(0.35, 1.2) + (o.up || 0), vz = rand(-1, 1);
    if (o.dir) { vx = vx * (o.spread || 0.6) + o.dir.x; vy += o.dir.y || 0; vz = vz * (o.spread || 0.6) + o.dir.z; }
    const l = Math.hypot(vx, vy, vz) || 1, sp = power * rand(0.45, 1.05) / l;
    D.p[i3] = p.x + rand(-0.4, 0.4) * size; D.p[i3 + 1] = p.y + rand(0, 0.5) * size; D.p[i3 + 2] = p.z + rand(-0.4, 0.4) * size;
    D.v[i3] = vx * sp; D.v[i3 + 1] = vy * sp; D.v[i3 + 2] = vz * sp;
    D.r[i3] = rand(0, 6.28); D.r[i3 + 1] = rand(0, 6.28); D.r[i3 + 2] = rand(0, 6.28);
    D.w[i3] = rand(-9, 9); D.w[i3 + 1] = rand(-9, 9); D.w[i3 + 2] = rand(-9, 9);
    const sc = size * rand(0.35, 1.15); D.s[i3] = sc * K.shape[0]; D.s[i3 + 1] = sc * K.shape[1]; D.s[i3 + 2] = sc * K.shape[2];
    D.life[i] = 0; D.rest[i] = 0; D.flags[i] = 1 | (o.hot && Math.random() < 0.6 ? 2 : 0);
    const col = pick(K.cols), j = rand(0.88, 1.08), dark = o.hot ? 0.7 : 1; D.im.instanceColor.setXYZ(i, col[0] * j * dark, col[1] * j * dark, col[2] * j * dark);
    if (i >= D.top) D.top = i + 1;
  }
  D.im.instanceColor.needsUpdate = true;
}
/* the old call, upgraded: picks the material from what is under the blast */
function spawnDebris(p, n, power, size) {
  const s = typeof surfaceAt === 'function' ? surfaceAt(p.x, p.z) : 'ground';
  if (s === 'water' && p.y < 2) return; /* the splash already says it */
  if (s === 'city') { debrisBurst(p, Math.ceil(n * 0.75), power, size, 'concrete', { hot: true }); debrisBurst(p, Math.ceil(n * 0.35), power * 1.1, size * 0.8, 'glass'); }
  else if (s === 'crops') debrisBurst(p, n, power, size, 'dirt');
  else { debrisBurst(p, Math.ceil(n * 0.7), power, size, 'dirt'); debrisBurst(p, Math.ceil(n * 0.4), power, size, 'rock', { hot: true }); }
}
const _dq = new T.Quaternion(), _de = new T.Euler(), _dm = new T.Matrix4(), _dp = new V3(), _ds = new V3();
function updateDebris2(dt) {
  const D = DEB2; if (!D.top) return;
  const G = 24, drag = Math.pow(0.6, dt); let live = 0, top = 0;
  for (let i = 0; i < D.top; i++) {
    const f = D.flags[i]; if (!(f & 1)) { if (D.im.count > i) { _dm.makeScale(0, 0, 0); D.im.setMatrixAt(i, _dm); } continue; }
    live++; top = i + 1; const i3 = i * 3; D.life[i] += dt;
    let fade = 1;
    if (f & 4) { /* settled: lie there, then sink away */
      D.rest[i] += dt; if (D.rest[i] > D.linger) { fade = 1 - (D.rest[i] - D.linger) / 0.8; if (fade <= 0) { D.flags[i] = 0; _dm.makeScale(0, 0, 0); D.im.setMatrixAt(i, _dm); continue; } }
    } else if (f & 8) { /* went into the water: sink and go */
      D.p[i3 + 1] -= 3 * dt; fade = Math.max(0, 1 - D.rest[i]); D.rest[i] += dt; if (fade <= 0) { D.flags[i] = 0; _dm.makeScale(0, 0, 0); D.im.setMatrixAt(i, _dm); continue; }
    } else {
      D.v[i3 + 1] -= G * dt; D.v[i3] *= drag; D.v[i3 + 2] *= drag;
      D.p[i3] += D.v[i3] * dt; D.p[i3 + 1] += D.v[i3 + 1] * dt; D.p[i3 + 2] += D.v[i3 + 2] * dt;
      D.r[i3] += D.w[i3] * dt; D.r[i3 + 1] += D.w[i3 + 1] * dt; D.r[i3 + 2] += D.w[i3 + 2] * dt;
      if ((f & 2) && D.life[i] < 2.2 && Math.random() < dt * 14) { /* hot pieces trail smoke and the odd ember */
        FXS.spawn(D.p[i3], D.p[i3 + 1], D.p[i3 + 2], 0, 0.6, 0, rand(0.8, 1.4), D.s[i3] * 0.9, D.s[i3] * 3, 0.1, 0.09, 0.08, 0.3, 0.28, 0.26, 0.6, 0.6, 0.4);
        if (Math.random() < 0.35) FXA.spawn(D.p[i3], D.p[i3 + 1], D.p[i3 + 2], rand(-1, 1), rand(0, 2), rand(-1, 1), rand(0.3, 0.6), 0.35, 0.1, 3, 1.4, 0.4, 1.4, 0.3, 0.05, 1, 1, -6);
      }
      const x = D.p[i3], z = D.p[i3 + 2], g = groundY(x, z), half = D.s[i3 + 1] * 0.6;
      if (D.p[i3 + 1] - half <= g) {
        if (H(x, z) < 0) { D.flags[i] = (f | 8) & ~2; D.rest[i] = 0; if (Math.abs(D.v[i3 + 1]) > 6 && D.s[i3] > 0.5) FXS.spawn(x, 0.4, z, 0, rand(3, 6), 0, 0.8, D.s[i3], D.s[i3] * 3, 0.85, 0.9, 0.94, 0.7, 0.75, 0.8, 0.6, 0.6, -10); }
        else {
          D.p[i3 + 1] = g + half;
          const vy = -D.v[i3 + 1];
          if (vy > 3.2) { /* bounce, lose most of it to the ground, kick a little dust on the hard ones */
            D.v[i3 + 1] = vy * 0.32; D.v[i3] *= 0.55; D.v[i3 + 2] *= 0.55; D.w[i3] *= 0.6; D.w[i3 + 1] *= 0.6; D.w[i3 + 2] *= 0.6;
            if (vy > 9 && D.s[i3] > 0.6 && Math.random() < 0.5) FXS.spawn(x, g + 0.2, z, 0, 0.6, 0, rand(0.6, 1.1), D.s[i3] * 1.2, D.s[i3] * 3.5, 0.38, 0.32, 0.26, 0.42, 0.37, 0.3, 0.5, 1, 0.2);
          } else { /* skid to a stop and lie flat-ish */
            D.v[i3] = D.v[i3 + 1] = D.v[i3 + 2] = 0; D.w[i3] = D.w[i3 + 1] = D.w[i3 + 2] = 0; D.flags[i] = (f | 4) & ~2; D.rest[i] = 0;
            D.r[i3] = Math.round(D.r[i3] / Math.PI) * Math.PI * 0.9 + D.r[i3] * 0.1; D.r[i3 + 2] = Math.round(D.r[i3 + 2] / Math.PI) * Math.PI * 0.9 + D.r[i3 + 2] * 0.1;
          }
        }
      }
      if (D.life[i] > 14) D.flags[i] |= 4; /* anything still airborne this long has left the island: let it go */
    }
    _de.set(D.r[i3], D.r[i3 + 1], D.r[i3 + 2]); _dq.setFromEuler(_de);
    _dm.compose(_dp.set(D.p[i3], D.p[i3 + 1], D.p[i3 + 2]), _dq, _ds.set(D.s[i3] * fade, D.s[i3 + 1] * fade, D.s[i3 + 2] * fade));
    D.im.setMatrixAt(i, _dm);
  }
  D.top = top; D.im.count = top; D.live = live; D.im.instanceMatrix.needsUpdate = true;
}
/* ride on the frame without touching main.js: the FX update runs once a frame */
{ const _uf = updateFX; updateFX = function (dt) { _uf(dt); try { updateDebris2(dt); } catch (e) { /* debris must never break the game */ } }; }

/* ---------- hooks: explosions, collisions, destruction ---------- */
/* small blasts on the ground throw clods too (big ones already go through spawnDebris) */
{ const _fe = fxExplosion; fxExplosion = function (p, scale = 1, opts = {}) {
  const r = _fe(p, scale, opts);
  if (scale >= 0.8 && scale < 1.5 && p.y - groundY(p.x, p.z) < 3 && H(p.x, p.z) > 0 && camera.position.distanceToSquared(p) < 62500) debrisBurst(p, 1 + Math.round(scale * 2), 8 + scale * 4, 0.3 + scale * 0.2, (typeof surfaceAt === 'function' && surfaceAt(p.x, p.z) === 'city') ? 'concrete' : 'dirt');
  return r;
}; }
/* a vehicle or warship destroyed comes apart in plate and glass, hot */
{ const _k = Ent.prototype.killed; Ent.prototype.killed = function (src, type) {
  const r = _k.call(this, src, type);
  if (this.kind !== 'soldier' && this.pos && this.kind !== 'capital') {
    const sz = clamp((this.radius || 3) * 0.22, 0.35, 2.2), p = _dbv.copy(this.pos); p.y += 1;
    debrisBurst(p, 7 + Math.round(sz * 4), 12 + sz * 4, sz, 'metal', { hot: true, up: 0.3 });
    debrisBurst(p, 4, 10, sz * 0.6, 'glass');
  }
  return r;
}; }
/* a tower coming down sheds its face as it goes: glass and concrete off the top while it falls, a wall of it when it lands */
{ const BP = Building.prototype, _col = BP.collapse, _up = BP.update;
  BP.collapse = function (src) {
    const r = _col.call(this, src);
    if (!this.cover) { const big = clamp(this.w / 8, 0.6, 2.4); for (let i = 0; i < 3; i++) { const p = _dbv.set(this.x + rand(-this.w, this.w) * 0.4, this.gy + this.h * rand(0.25, 0.85), this.z + rand(-this.d, this.d) * 0.4); debrisBurst(p, 8, 16, big, 'concrete', { hot: true }); debrisBurst(p, 6, 18, big * 0.7, 'glass'); } }
    return r;
  };
  BP.update = function (dt) {
    const was = this.landed, r = _up.call(this, dt);
    if (!this.alive && this.fallT > 0 && !this.cover) {
      const big = clamp(this.w / 10, 0.5, 2);
      if (Math.random() < dt * 2.2) { /* pieces breaking off the falling face */
        const top = this.mesh ? this.mesh.position.y + this.h * rand(0.4, 1) : this.gy + this.h * 0.6;
        const p = _dbv.set(this.x + rand(-this.w, this.w) * 0.5, Math.max(this.gy + 2, top), this.z + rand(-this.d, this.d) * 0.5);
        debrisBurst(p, 2, 8, big, Math.random() < 0.3 ? 'glass' : 'concrete', { up: -0.4 });
      }
      if (!was && this.landed && this.fallDir) for (let i = 1; i <= 6; i++) { /* the length of it hitting the street */
        const d = this.h * i / 7, p = _dbv.set(this.x + this.fallDir.x * d, 0, this.z + this.fallDir.z * d); p.y = groundY(p.x, p.z) + 1;
        debrisBurst(p, 6, 14, big * 1.1, 'concrete', { hot: i % 2 === 0, up: 0.2 });
      }
    }
    return r;
  };
  const _tr = BP.toRubble; BP.toRubble = function () { const had = this.rubble; const r = _tr.call(this); if (!had && this.rubble && !this.cover) debrisBurst(_dbv.set(this.x, this.gy + 2, this.z), 10, 9, clamp(this.w / 10, 0.6, 2), 'concrete'); return r; };
}
/* ground vehicles hitting each other at speed throw an orange spark shower (action.js): the hook below turns it into plate too */
{ const _sp = fxSparks; fxSparks = function (p, n, col, power) { /* a shower of sparks from a crash is a piece of the crash too */
  _sp(p, n, col, power);
  const hotSparks = !col || col[2] < 1.5; /* crash and impact sparks are orange; lightning's are blue and leave no plate */
  if (hotSparks && n >= 12 && (power || 14) >= 10 && p.y - groundY(p.x, p.z) < 6 && Math.random() < 0.3 && camera.position.distanceToSquared(p) < 40000) debrisBurst(p, 2 + (n / 12 | 0), power * 0.5, 0.25, 'metal');
}; }
/* a thrown car arriving: body panels and glass where it lands */
if (typeof carImpact === 'function') { const _ci = carImpact; carImpact = function (c) { const p = _dbv.copy(c.pos); p.y += 0.8; const sp = c.vel.length(); _ci(c); debrisBurst(p, 6, 10 + sp * 0.15, 0.45, 'metal', { up: 0.4 }); debrisBurst(p, 5, 11, 0.35, 'glass'); }; }
