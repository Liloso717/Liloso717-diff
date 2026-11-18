'use strict';
/* ===================== IRON MERIDIAN · next-gen rendering: HDR, bloom, sun shafts, flares, grading, height fog ===================== */
// Engine-grade post in the browser: eye adaptation (exposure follows the scene's average brightness on the GPU, so
// stepping from orbit into the Leviathan's hangar or out into desert noon reads like a real camera), per-realm colour
// grading volumes that blend as you travel, lens dirt lit by bloom, anisotropic texture filtering, and dynamic
// resolution that scales inside fixed render targets: the frame-rate governor never reallocates, so it never hitches.
// On WebGL2 the scene also writes a depth buffer, which pays for three things engines take for granted:
//  · AMBIENT OCCLUSION · contact shadows in every crease, under every crate, where walls meet floors
//  · SOFT PARTICLES    · smoke and dust fade into the surfaces they touch instead of slicing through them
//  · EDGE ANTIALIASING · a luma-gradient blend along silhouettes, in place of the MSAA that a depth target rules out
// and the sky itself is prefiltered into an environment map every few seconds, so metal, glass and water reflect the
// actual sky overhead: desert noon, dusk, the void in orbit.
const POST = (() => {
  const gl2 = renderer.capabilities.isWebGL2 !== false; /* r163+: WebGL 2 only */
  // render everything in linear HDR; tone mapping + grading happen in the final composite
  renderer.toneMapping = T.NoToneMapping; renderer.outputColorSpace = T.LinearSRGBColorSpace;
  // height fog: haze pools in low ground and thins with altitude (patched into every built-in material)
  T.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n varying float fogDepth; varying float vFogY;\n#endif';
  T.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n fogDepth = - mvPosition.z; vFogY = cameraPosition.y + dot( viewMatrix[1].xyz, mvPosition.xyz );\n#endif';
  T.ShaderChunk.fog_pars_fragment = '#ifdef USE_FOG\n uniform vec3 fogColor; varying float fogDepth; varying float vFogY;\n #ifdef FOG_EXP2\n uniform float fogDensity;\n #else\n uniform float fogNear; uniform float fogFar;\n #endif\n#endif';
  T.ShaderChunk.fog_fragment = `#ifdef USE_FOG
  #ifdef FOG_EXP2
    float hf = exp( - max( vFogY - 4.0, 0.0 ) / 140.0 );
    float fogFactor = min( 1.0 - exp( - fogDensity * fogDensity * fogDepth * fogDepth * ( 0.5 + 1.7 * hf ) ), 0.985 );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, fogDepth );
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;
  // fine ground detail
  try {
    const tn = bakeTex(256, (S, col, hgt) => { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const k = y * S + x; hgt[k] = vnoise(x * 0.06, y * 0.06) * 0.6 + vnoise(x * 0.25, y * 0.25) * 0.3 + Math.random() * 0.12; col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = 1; } }, 2.4, 1);
    tn.normal.repeat.set(260, 260); terrain.material.normalMap = tn.normal; terrain.material.normalScale = new T.Vector2(0.9, 0.9); terrain.material.roughness = 0.92; terrain.material.needsUpdate = true;
  } catch (e) { /* optional */ }

  const Q = { ultra: { pr: Math.min(window.devicePixelRatio || 1, 2), shadow: 4096, rays: true, msaa: true, sb: 190, lod: 1.35, ao: 16, env: 128 }, balanced: { pr: Math.min(window.devicePixelRatio || 1, 1.25), shadow: 2048, rays: true, msaa: true, sb: 160, lod: 1, ao: 8, env: 96 }, performance: { pr: Math.min(window.devicePixelRatio || 1, 1.4) /* was 0.85: under one screen point per pixel, which is what made phones look blocky */, shadow: 1024, rays: false, msaa: true /* edge smoothing on phones too: stair-stepped edges were a large part of the blocky look */, sb: 130, lod: 0.7, ao: 0, env: 64 } };
  let prMul = 1; // dynamic resolution from the frame-time governor
  let quality = LOW_END ? 'performance' : 'balanced'; try { quality = localStorage.getItem('im-gfx') || quality; } catch (e) { /* storage blocked */ }
  if (!Q[quality]) quality = 'balanced';
  let type = gl2 ? T.HalfFloatType : T.UnsignedByteType; let safe = false;
  const mkRT = (w, h) => new T.WebGLRenderTarget(w, h, { type, format: T.RGBAFormat, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false });
  let sceneRT = null, mips = [], ups = [], raysRT = null, W = 1, Hh = 1, aoRT = null, aoBlurRT = null, depthTex = null;
  const quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1); const quadScene = new T.Scene(); const quad = new T.Mesh(new T.PlaneGeometry(2, 2), null); quad.frustumCulled = false; quadScene.add(quad);
  const VS = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }';
  const mat = (fs, uniforms) => new T.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
  const brightM = mat(`uniform sampler2D tDiffuse; uniform float thr; uniform vec2 uvs; varying vec2 vUv; void main(){ vec3 c=texture2D(tDiffuse,vUv*uvs).rgb; float l=max(c.r,max(c.g,c.b)); float k=smoothstep(thr,thr*1.8,l); gl_FragColor=vec4(min(c*k,vec3(40.)),1.); }`, { tDiffuse: { value: null }, thr: { value: gl2 ? 1.0 : 0.82 }, uvs: { value: new T.Vector2(1, 1) } });
  const downM = mat(`uniform sampler2D tDiffuse; uniform vec2 px; varying vec2 vUv; void main(){ vec3 s=texture2D(tDiffuse,vUv).rgb*4.; s+=texture2D(tDiffuse,vUv+px*vec2(-1.,-1.)).rgb; s+=texture2D(tDiffuse,vUv+px*vec2(1.,-1.)).rgb; s+=texture2D(tDiffuse,vUv+px*vec2(-1.,1.)).rgb; s+=texture2D(tDiffuse,vUv+px*vec2(1.,1.)).rgb; gl_FragColor=vec4(s/8.,1.); }`, { tDiffuse: { value: null }, px: { value: new T.Vector2() } });
  const upM = mat(`uniform sampler2D tDiffuse; uniform sampler2D tAdd; uniform vec2 px; varying vec2 vUv; void main(){ vec3 s=vec3(0.); s+=texture2D(tDiffuse,vUv+px*vec2(-2.,0.)).rgb; s+=texture2D(tDiffuse,vUv+px*vec2(2.,0.)).rgb; s+=texture2D(tDiffuse,vUv+px*vec2(0.,-2.)).rgb; s+=texture2D(tDiffuse,vUv+px*vec2(0.,2.)).rgb; s+=texture2D(tDiffuse,vUv+px*vec2(-1.,-1.)).rgb*2.; s+=texture2D(tDiffuse,vUv+px*vec2(1.,-1.)).rgb*2.; s+=texture2D(tDiffuse,vUv+px*vec2(-1.,1.)).rgb*2.; s+=texture2D(tDiffuse,vUv+px*vec2(1.,1.)).rgb*2.; gl_FragColor=vec4(s/12.+texture2D(tAdd,vUv).rgb,1.); }`, { tDiffuse: { value: null }, tAdd: { value: null }, px: { value: new T.Vector2() } });
  const raysM = mat(`uniform sampler2D tDiffuse; uniform vec2 sun; uniform float on; varying vec2 vUv; void main(){ vec2 d=(vUv-sun)/48.*.9; vec2 uv=vUv; float w=1.; vec3 s=vec3(0.); for(int i=0;i<48;i++){ uv-=d; vec3 c=texture2D(tDiffuse,uv).rgb; s+=c*w; w*=.955; } gl_FragColor=vec4(s/48.*on,1.); }`, { tDiffuse: { value: null }, sun: { value: new T.Vector2(0.5, 0.5) }, on: { value: 0 } });
  const compM = mat(`uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tRays; uniform sampler2D tAdapt; uniform sampler2D tDirt; uniform sampler2D tAO; uniform float aoK; uniform vec2 uvs; uniform vec3 gTint; uniform vec2 gSC; uniform vec2 sun; uniform float sunOn; uniform float time; uniform vec2 res; uniform float exposure; uniform float hurt; uniform float rays; varying vec2 vUv;
    vec3 RRTAndODTFit(vec3 v){ vec3 a=v*(v+0.0245786)-0.000090537; vec3 b=v*(0.983729*v+0.4329510)+0.238081; return a/b; }
    vec3 aces(vec3 c){ const mat3 I=mat3(vec3(0.59719,0.07600,0.02840),vec3(0.35458,0.90834,0.13383),vec3(0.04823,0.01566,0.83777)); const mat3 O=mat3(vec3(1.60475,-0.10208,-0.00327),vec3(-0.53108,1.10813,-0.07276),vec3(-0.07367,-0.00605,1.07602)); c*=exposure/0.6; c=I*c; c=RRTAndODTFit(c); c=O*c; return clamp(c,0.,1.); }
    float h12(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    vec3 toSRGB(vec3 c){ return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c)); }
    void main(){
      vec2 cuv=vUv-.5; float r2=dot(cuv,cuv);
      vec2 ca=cuv*r2*.012;
      vec3 c=vec3(texture2D(tScene,(vUv-ca)*uvs).r,texture2D(tScene,vUv*uvs).g,texture2D(tScene,(vUv+ca)*uvs).b);
      vec2 px=1./res, su=vUv*uvs;
      vec3 nL=texture2D(tScene,su-vec2(px.x,0.)).rgb, nR=texture2D(tScene,su+vec2(px.x,0.)).rgb, nD=texture2D(tScene,su-vec2(0.,px.y)).rgb, nU=texture2D(tScene,su+vec2(0.,px.y)).rgb;
      vec3 nb=(nL+nR+nD+nU)*.25;
      /* edge antialiasing: blur along a silhouette, sharpen everywhere else (a depth target rules MSAA out) */
      vec3 LW=vec3(.2126,.7152,.0722); float lC=dot(c,LW), lL=dot(nL,LW), lR=dot(nR,LW), lD=dot(nD,LW), lU=dot(nU,LW);
      float gx=lR-lL, gy=lU-lD, gm=length(vec2(gx,gy)), edge=smoothstep(.10,.45,gm/max(lC+.2,.2));
      if (edge > .001) { vec2 dir=normalize(vec2(-gy,gx)+1e-5)*px*1.1; c=mix(c+(c-nb)*.35, (texture2D(tScene,su+dir*uvs).rgb+texture2D(tScene,su-dir*uvs).rgb+c)/3., edge); }
      else c+=(c-nb)*.35;
      c=max(c,0.);
      float ao=texture2D(tAO,vUv).r; c*=mix(1.,ao,aoK);                  /* contact darkening */
      vec3 bl=texture2D(tBloom,vUv).rgb; c+=bl*(.22+texture2D(tDirt,vUv).r*.5); /* lens dirt catches the bloom */
      vec3 ry=texture2D(tRays,vUv).rgb; c+=ry*rays*vec3(1.,.82,.6)*1.4;
      // lens flare ghosts from the sun, faded when the sun is hidden
      float occ=clamp(dot(texture2D(tScene,sun*uvs).rgb,vec3(.33))*.6,0.,1.)*sunOn;
      vec2 axis=vec2(.5)-sun; vec3 fl=vec3(0.);
      for(int i=0;i<5;i++){ float fi=float(i); vec2 g=sun+axis*(.45+fi*.38); float d=length((vUv-g)*vec2(res.x/res.y,1.)); float s=.025+fi*.018; fl+=vec3(.5+fi*.1,.6,1.-fi*.12)*smoothstep(s,s*.4,d)*.08; }
      float halo=length((vUv-.5-(sun-.5)*-.6)*vec2(res.x/res.y,1.)); fl+=vec3(1.,.6,.3)*smoothstep(.02,0.,abs(halo-.32))*.06;
      c+=fl*occ;
      float La=exp2(texture2D(tAdapt,vec2(.5)).r*14.-10.); c*=clamp(pow(.32/max(La,1e-4),.55),.6,1.9); /* eye adaptation */
      vec3 t=aces(c);
      float l=dot(t,vec3(.2126,.7152,.0722)); t=mix(vec3(l),t,1.14);
      t+=mix(vec3(-.012,.004,.02),vec3(.03,.012,-.02),smoothstep(.1,.8,l));
      t*=gTint; float l2=dot(t,vec3(.2126,.7152,.0722)); t=mix(vec3(l2),t,gSC.x); t=(t-.18)*gSC.y+.18; /* the realm's grading volume */
      t=clamp(t,0.,1.);
      vec3 s=toSRGB(t); s=(s-.5)*1.05+.5;
      float v=smoothstep(.95,.25,length(cuv*vec2(1.,.85))); s*=mix(.62,1.,v);
      s=mix(s,s*vec3(1.,.55,.5),hurt*smoothstep(.15,.6,r2*2.));
      s+=(h12(vUv*res+fract(time)*100.)-.5)*.035;
      gl_FragColor=vec4(clamp(s,0.,1.),1.);
    }`, { tScene: { value: null }, tBloom: { value: null }, tRays: { value: null }, tAO: { value: null }, aoK: { value: 0 }, sun: { value: new T.Vector2() }, sunOn: { value: 0 }, time: { value: 0 }, res: { value: new T.Vector2(1, 1) }, exposure: { value: 1.0 }, hurt: { value: 0 }, rays: { value: 1 }, tAdapt: { value: null }, tDirt: { value: null }, mblur: { value: new T.Vector2() }, uvs: { value: new T.Vector2(1, 1) }, gTint: { value: new T.Vector3(1, 1, 1) }, gSC: { value: new T.Vector2(1, 1) } });
  /* ambient occlusion: positions and normals rebuilt from the depth buffer, a rotating disk of taps per pixel at half
     resolution, then a depth-aware blur so the darkening hugs surfaces instead of bleeding across edges */
  const AO_TAPS = 16;
  const ssaoM = mat(`uniform sampler2D tDepth; uniform vec2 uvs; uniform vec2 res; uniform float P00, P11, cn, cf, radius, strength; uniform int taps; varying vec2 vUv;
    float vz(vec2 uv){ float d = texture2D(tDepth, uv * uvs).x * 2. - 1.; return (2. * cn * cf) / (cf + cn - d * (cf - cn)); }
    vec3 vpos(vec2 uv, float z){ return vec3((uv.x * 2. - 1.) * z / P00, (uv.y * 2. - 1.) * z / P11, -z); }
    void main(){
      float z = vz(vUv);
      if (z > cf * 0.92) { gl_FragColor = vec4(1.); return; }               /* sky and the far plane stay open */
      vec3 P = vpos(vUv, z), Px = vpos(vUv + vec2(1. / res.x, 0.), vz(vUv + vec2(1. / res.x, 0.))), Py = vpos(vUv + vec2(0., 1. / res.y), vz(vUv + vec2(0., 1. / res.y)));
      vec3 N = normalize(cross(Px - P, Py - P));
      float ang = fract(sin(dot(vUv * res, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831, ca = cos(ang), sa = sin(ang);
      float occ = 0., rp = radius * P11 * 0.5 / max(z, 0.5);                /* a metre of world shrinks with distance */
      for (int i = 0; i < AO_TAPS; i++) {
        if (i >= taps) break;
        float fi = (float(i) + 0.5) / float(taps), a = fi * 12.9 + ang, r = rp * sqrt(fi);
        vec2 o = vec2(cos(a) * ca - sin(a) * sa, cos(a) * sa + sin(a) * ca) * r;
        vec2 uv = vUv + o; if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) continue;
        vec3 S = vpos(uv, vz(uv)); vec3 d = S - P; float len = length(d);
        float ndv = max(dot(N, d / max(len, 1e-4)) - 0.035, 0.);
        occ += ndv * smoothstep(radius * 2.2, radius * 0.35, len);          /* only near geometry occludes */
      }
      gl_FragColor = vec4(vec4(clamp(1. - occ / float(taps) * strength, 0., 1.)).rgb, 1.);
    }`.replace(/AO_TAPS/g, String(AO_TAPS)), { tDepth: { value: null }, uvs: { value: new T.Vector2(1, 1) }, res: { value: new T.Vector2(1, 1) }, P00: { value: 1 }, P11: { value: 1 }, cn: { value: 0.1 }, cf: { value: 1000 }, radius: { value: 0.9 }, strength: { value: 1.25 }, taps: { value: 8 } });
  /* the occlusion blur is separable: two 1D depth-aware passes of five taps, where one 5x5 pass would cost fifty
     texture fetches a pixel for the same picture */
  const aoBlurM = mat(`uniform sampler2D tAO; uniform sampler2D tDepth; uniform vec2 px; uniform vec2 dir; uniform vec2 uvs; uniform float cn, cf; varying vec2 vUv;
    float vz(vec2 uv){ float d = texture2D(tDepth, uv * uvs).x * 2. - 1.; return (2. * cn * cf) / (cf + cn - d * (cf - cn)); }
    void main(){ float z0 = vz(vUv), s = 0., w = 0.;
      for (int i = -2; i <= 2; i++) { vec2 uv = vUv + dir * px * float(i);
        float wz = exp(-abs(vz(uv) - z0) * 1.6); s += texture2D(tAO, uv).r * wz; w += wz; }
      gl_FragColor = vec4(vec3(s / max(w, 1e-4)), 1.); }`, { tAO: { value: null }, tDepth: { value: null }, px: { value: new T.Vector2() }, dir: { value: new T.Vector2(1, 0) }, uvs: { value: new T.Vector2(1, 1) }, cn: { value: 0.1 }, cf: { value: 1000 } });
  /* eye adaptation: 8x8 log-luminance probe of the frame → 1x1, then a ping-pong that eases toward it */
  const lumM = mat(`uniform sampler2D tDiffuse; uniform vec2 uvs; varying vec2 vUv; void main(){ float s=0.; for(int y=0;y<8;y++) for(int x=0;x<8;x++){ vec2 u=(vec2(float(x),float(y))+.5)/8.; u=mix(vec2(.15),vec2(.85),u); vec3 c=texture2D(tDiffuse,u*uvs).rgb; s+=log2(max(dot(c,vec3(.2126,.7152,.0722)),1e-3)); } gl_FragColor=vec4(clamp((s/64.+10.)/14.,0.,1.),0.,0.,1.); }`, { tDiffuse: { value: null }, uvs: { value: new T.Vector2(1, 1) } });
  const adaptM = mat(`uniform sampler2D tCur; uniform sampler2D tPrev; uniform float k; varying vec2 vUv; void main(){ float c=texture2D(tCur,vec2(.5)).r, p=texture2D(tPrev,vec2(.5)).r; gl_FragColor=vec4(mix(p,c,k),0.,0.,1.); }`, { tCur: { value: null }, tPrev: { value: null }, k: { value: 1 } });
  let lumRT = null, adRT = [], adI = 0, adFirst = true;
  const dirtTex = canvasTex(256, 128, (g, w, h) => { if (!g.createRadialGradient) return; g.fillStyle = '#000'; g.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { const x = Math.random() * w, y = Math.random() * h, r = 3 + Math.random() * (i < 10 ? 40 : 14), gr = g.createRadialGradient(x, y, 0, x, y, r), a = (i < 10 ? 0.25 : 0.5) * Math.random(); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.7, `rgba(255,255,255,${a * 0.4})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); } });
  compM.uniforms.tDirt.value = dirtTex;
  const blackRT = mkRT(1, 1);
  function build() {
    const q = Q[quality]; renderer.setPixelRatio(q.pr); renderer.setSize(innerWidth, innerHeight); /* targets stay this size; dynamic resolution renders into a corner of them */
    const v = renderer.getDrawingBufferSize(new T.Vector2()); W = Math.max(2, v.x); Hh = Math.max(2, v.y);
    if (sceneRT) sceneRT.dispose(); for (const r of mips.concat(ups)) r.dispose(); if (raysRT) raysRT.dispose();
    if (aoRT) { aoRT.dispose(); aoBlurRT.dispose(); aoRT = aoBlurRT = null; }
    if (depthTex) { depthTex.dispose(); depthTex = null; }
    const wantAO = gl2 && !safe && q.ao > 0;
    if (wantAO) { /* a depth texture rules out MSAA, and buys occlusion, soft particles and depth-aware AA instead */
      sceneRT = new T.WebGLRenderTarget(W, Hh, { type, format: T.RGBAFormat });
      depthTex = new T.DepthTexture(W, Hh); depthTex.type = T.UnsignedIntType; depthTex.format = T.DepthFormat; depthTex.minFilter = T.NearestFilter; depthTex.magFilter = T.NearestFilter; sceneRT.depthTexture = depthTex;
      aoRT = mkRT(Math.max(1, W >> 1), Math.max(1, Hh >> 1)); aoBlurRT = mkRT(Math.max(1, W >> 1), Math.max(1, Hh >> 1));
    } else sceneRT = gl2 && q.msaa && !safe ? new T.WebGLRenderTarget(W, Hh, { type, format: T.RGBAFormat, samples: 4 }) : new T.WebGLRenderTarget(W, Hh, { type, format: T.RGBAFormat });
    mips = []; ups = []; let w = W >> 1, h = Hh >> 1; for (let i = 0; i < 6; i++) { mips.push(mkRT(Math.max(1, w), Math.max(1, h))); ups.push(mkRT(Math.max(1, w), Math.max(1, h))); w >>= 1; h >>= 1; }
    raysRT = mkRT(Math.max(1, W >> 2), Math.max(1, Hh >> 2));
    if (lumRT) { lumRT.dispose(); for (const r of adRT) r.dispose(); } lumRT = mkRT(1, 1); adRT = [mkRT(1, 1), mkRT(1, 1)]; adFirst = true; /* re-made with the targets so a format fallback covers them too */
    compM.uniforms.res.value.set(W, Hh); compM.uniforms.aoK.value = wantAO ? 0.85 : 0;
    ssaoM.uniforms.taps.value = q.ao || 8; ssaoM.uniforms.res.value.set(Math.max(1, W >> 1), Math.max(1, Hh >> 1));
    aoBlurM.uniforms.px.value.set(2 / Math.max(1, W), 2 / Math.max(1, Hh)); /* one step in half-resolution pixels */
    SOFT.depth.value = wantAO ? depthTex : SOFT.fb; SOFT.on.value = wantAO ? 1 : 0; SOFT.res.value.set(W, Hh);
    if (sun.shadow.mapSize.x !== q.shadow) { sun.shadow.mapSize.set(q.shadow, q.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    const c = sun.shadow.camera; c.left = c.bottom = -q.sb; c.right = c.top = q.sb; c.updateProjectionMatrix();
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    // if this GPU cannot render to HDR targets, fall back to a compatible format instead of a black screen
    try { const gl = renderer.getContext(); renderer.setRenderTarget(sceneRT); const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; renderer.setRenderTarget(mips[0]); const ok2 = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; renderer.setRenderTarget(null);
      if ((!ok || !ok2) && !safe) { safe = true; type = T.UnsignedByteType; brightM.uniforms.thr.value = 0.82; build(); } } catch (e) { /* keep going */ }
  }
  function pass(m, out) { quad.material = m; renderer.setRenderTarget(out); renderer.render(quadScene, quadCam); }
  const _sv = new V3();
  const POST_MB = { prev: new V3(), pq: new T.Quaternion(), init: false };
  const _mbA = new V3(), _mbB = new V3(), _mbC = new V3(), _mbD = new V3();
  function render(dt) {
    const sw = Math.max(2, Math.round(W * prMul)), sh = Math.max(2, Math.round(Hh * prMul)), ux = sw / W, uy = sh / Hh; if (sceneRT.viewport) { sceneRT.viewport.set(0, 0, sw, sh); sceneRT.scissor.set(0, 0, sw, sh); sceneRT.scissorTest = prMul < 0.999; }
    renderer.setRenderTarget(sceneRT); renderer.render(scene, camera);
    brightM.uniforms.uvs.value.set(ux, uy); lumM.uniforms.uvs.value.set(ux, uy); compM.uniforms.uvs.value.set(ux, uy);
    if (aoRT && depthTex) { /* occlusion at half resolution, then a depth-aware blur */
      const u = ssaoM.uniforms; u.tDepth.value = depthTex; u.uvs.value.set(ux, uy); u.P00.value = camera.projectionMatrix.elements[0]; u.P11.value = camera.projectionMatrix.elements[5]; u.cn.value = camera.near; u.cf.value = camera.far;
      u.radius.value = camera.position.y > 1200 ? 1.6 : 0.95;
      u.taps.value = prMul < 0.75 ? Math.max(4, (Q[quality].ao >> 1)) : Q[quality].ao; /* already scraping: fewer taps before fewer pixels */
      pass(ssaoM, aoRT);
      const b = aoBlurM.uniforms; b.tDepth.value = depthTex; b.uvs.value.set(ux, uy); b.cn.value = camera.near; b.cf.value = camera.far;
      b.tAO.value = aoRT.texture; b.dir.value.set(1, 0); pass(aoBlurM, aoBlurRT);
      b.tAO.value = aoBlurRT.texture; b.dir.value.set(0, 1); pass(aoBlurM, aoRT);
      compM.uniforms.tAO.value = aoRT.texture;
    } else compM.uniforms.tAO.value = null;
    SOFT.cn.value = camera.near; SOFT.cf.value = camera.far;
    lumM.uniforms.tDiffuse.value = sceneRT.texture; pass(lumM, lumRT); /* eye adaptation */
    adaptM.uniforms.tCur.value = lumRT.texture; adaptM.uniforms.tPrev.value = adRT[adI].texture; adaptM.uniforms.k.value = adFirst ? 1 : 1 - Math.exp(-(dt || 0.016) * 1.6); adFirst = false; adI ^= 1; pass(adaptM, adRT[adI]); compM.uniforms.tAdapt.value = adRT[adI].texture;
    brightM.uniforms.tDiffuse.value = sceneRT.texture; pass(brightM, mips[0]);
    const nm = prMul < 0.8 ? 4 : mips.length; /* the post chain is fixed-size, so under load it loses passes instead of pixels */
    for (let i = 1; i < nm; i++) { downM.uniforms.tDiffuse.value = mips[i - 1].texture; downM.uniforms.px.value.set(1 / mips[i - 1].width, 1 / mips[i - 1].height); pass(downM, mips[i]); }
    let src = mips[nm - 1];
    for (let i = nm - 2; i >= 0; i--) { upM.uniforms.tDiffuse.value = src.texture; upM.uniforms.tAdd.value = mips[i].texture; upM.uniforms.px.value.set(1 / src.width, 1 / src.height); pass(upM, ups[i]); src = ups[i]; }
    _sv.copy(SUN_DIR).multiplyScalar(1000).add(camera.position).project(camera);
    const onScreen = _sv.z < 1 && Math.abs(_sv.x) < 1.3 && Math.abs(_sv.y) < 1.3; const sx = _sv.x * 0.5 + 0.5, sy = _sv.y * 0.5 + 0.5;
    const edge = onScreen ? clamp(1.3 - Math.max(Math.abs(_sv.x), Math.abs(_sv.y)), 0, 1) : 0;
    let raysTex = blackRT.texture;
    if (Q[quality].rays && edge > 0 && prMul > 0.82) { /* sun shafts are the first luxury to go when frames get long */ raysM.uniforms.tDiffuse.value = mips[0].texture; raysM.uniforms.sun.value.set(sx, sy); raysM.uniforms.on.value = edge; pass(raysM, raysRT); raysTex = raysRT.texture; }
    { /* motion blur vector: project the camera's own movement and turn into screen space */
      const M = POST_MB; const nowP = camera.position, d = dt || 0.016;
      if (!M.init) { M.prev.copy(nowP); M.pq.copy(camera.quaternion); M.init = true; }
      _mbA.copy(nowP).sub(M.prev).multiplyScalar(1 / Math.max(d, 1e-3));      /* world velocity */
      _mbB.copy(nowP).addScaledVector(_mbA, d * 2.2).project(camera);          /* where that lands on screen */
      _mbC.copy(nowP).addScaledVector(camera.getWorldDirection(_mbD), 0.001).project(camera);
      let mx = (_mbB.x - _mbC.x) * 0.5, my = (_mbB.y - _mbC.y) * 0.5;
      const q = camera.quaternion, dq = Math.abs(q.x - M.pq.x) + Math.abs(q.y - M.pq.y) + Math.abs(q.z - M.pq.z) + Math.abs(q.w - M.pq.w);
      const turn = Math.min(0.02, dq * 0.9); mx += turn * (q.y - M.pq.y > 0 ? 1 : -1) * 0.6;
      const len = Math.hypot(mx, my), cap = 0.018;
      if (len > cap) { mx = mx / len * cap; my = my / len * cap; }
      if (!isFinite(mx) || !isFinite(my)) { mx = 0; my = 0; }
      compM.uniforms.mblur.value.set(mx, my);
      M.prev.copy(nowP); M.pq.copy(q);
    }
    const u = compM.uniforms; u.tScene.value = sceneRT.texture; u.tBloom.value = ups[0].texture; u.tRays.value = raysTex; u.sun.value.set(clamp(sx, 0, 1), clamp(sy, 0, 1)); u.sunOn.value = edge; u.time.value = TIME; u.rays.value = Q[quality].rays ? 1 : 0;
    u.hurt.value = GAME.state === 'play' ? Math.min(1, PLAYER.hurt * 1.4) : 0;
    pass(compM, null);
  }
  /* image-based lighting: the live sky baked into a prefiltered environment map, so every metal, glass and wet
     surface reflects the sky it is actually standing under. Rebuilt on a slow timer, and whenever the light changes. */
  const ENV = { pm: null, rt: null, sc: null, t: 0, key: '' };
  function envUpdate(force) {
    if (!sky || !sky.material) return;
    const k = `${skyU.zenith.value.getHex()}|${skyU.horizon.value.getHex()}|${skyU.sunCol.value.getHex()}|${Math.round(skyU.space.value * 4)}|${Math.round(SUN_DIR.y * 8)}`;
    if (!force && k === ENV.key) return; ENV.key = k;
    try {
      if (!ENV.pm) { ENV.pm = new T.PMREMGenerator(renderer); ENV.pm.compileEquirectangularShader(); ENV.sc = new T.Scene(); ENV.sc.add(new T.Mesh(sky.geometry, sky.material)); }
      const old = ENV.rt; ENV.rt = ENV.pm.fromScene(ENV.sc, 0, 1, 20000); scene.environment = ENV.rt.texture; if (old) old.dispose();
    } catch (e) { ENV.pm = null; /* no IBL on this driver */ }
  }
  function setQuality(q) { if (!Q[q]) return; quality = q; try { localStorage.setItem('im-gfx', q); } catch (e) { /* storage blocked */ } build(); }
  /* grading volumes: each realm (and the Leviathan's interior) has its own look; the camera blends between them */
  const GRADE = { land: [1.02, 1.0, 0.99, 1.3, 1.14], sea: [1.0, 1.0, 1.02, 1.25, 1.12], /* the painted look (gothic.js): rich colour, a harder curve */ /* overcast realism: cooler, less saturated, a little harder (style.js) */ air: [0.99, 1.0, 1.03, 1.0, 1.06], space: [0.95, 0.98, 1.06, 0.95, 1.1], interior: [0.97, 0.99, 1.05, 0.9, 1.12] }, gNow = GRADE.land.slice();
  function envTick(dt) { if ((ENV.t -= dt) > 0) return; ENV.t = 6; envUpdate(false); }
  function grade(dt) {
    const c = camera.position; let k = 'land';
    if (typeof levRoom === 'function' && levRoom(c) >= 0) k = 'interior'; else if (c.y > 1250) k = 'space'; else if (typeof RDECK !== 'undefined' && c.y > 150 && Math.hypot(c.x - RDECK.C.x, c.z - RDECK.C.z) < 160) k = 'air'; else if (typeof RDECK !== 'undefined' && c.y < 120 && Math.hypot(c.x - RDECK.B.x, c.z - RDECK.B.z) < 260) k = 'sea';
    const g = GRADE[k], f = 1 - Math.exp(-dt * 1.5); for (let i = 0; i < 5; i++) gNow[i] += (g[i] - gNow[i]) * f;
    compM.uniforms.gTint.value.set(gNow[0], gNow[1], gNow[2]); compM.uniforms.gSC.value.set(gNow[3], gNow[4]);
  }
  function aniso() { /* sharp textures at grazing angles, the way engines ship by default */
    const a = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1); if (a <= 1) return; const seen = new Set();
    scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) { if (m.isMeshStandardMaterial) m.envMapIntensity = 0.55; for (const k of ['map', 'normalMap', 'roughnessMap', 'emissiveMap']) { const t = m[k]; if (t && !seen.has(t)) { seen.add(t); t.anisotropy = a; t.needsUpdate = true; } } } });
    envUpdate(true);
  }
  build();
  return { render(dt) { grade(dt || 0.016); envTick(dt || 0.016); render(dt); }, build, setQuality, aniso, env: envUpdate, setAO(v) { compM.uniforms.aoK.value = v; }, get aoOn() { return !!aoRT; }, exposure(v) { compM.uniforms.exposure.value = v; }, scale(m) { prMul = clamp(m, 0.5, 1); }, get scaleNow() { return prMul; }, get quality() { return quality; }, get lod() { return Q[quality].lod; } };
})();
