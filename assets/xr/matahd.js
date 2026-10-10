// Mata HD: the MataKitani mascot as a rigged, furry 3D character (procedural, no downloads).
// One skinned body (head, body, arms, legs, tufts, tail) drawn as layered "shells" for real fur depth,
// a skeleton for body language, and face controls (blink, happy eyes, wink, mouth shapes) for expressions.
// Faces +Z, feet on y = 0, about 2.2 units tall. Character's left (_L) is +X.
//
//   const m = createMataHD({ shells: 24 });  scene.add(m.object);  addMataLights(scene);
//   m.play('wave');  m.set({ headYaw: .3 });  in your loop: m.update(dt)
import * as THREE from '/assets/three/three.module.min.js';

// ---------------------------------------------------------------- shape
const HEAD = { cy: 1.4, rx: .86, ry: .73 }, BODY = { cy: .6, rx: .62, ry: .46 }, DEPTH = .88, CENTER = .95;
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25; };
const ell = (r, y, s) => (Math.hypot(r / s.rx, (y - s.cy) / s.ry) - 1) * Math.min(s.rx, s.ry);
const sdf = (r, y) => smin(ell(r, y, HEAD), ell(r, y, BODY), .1);
function profile(n = 96) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const th = i / n * Math.PI, dx = Math.sin(th), dy = -Math.cos(th);
    let lo = 0, hi = 2; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; sdf(dx * m, CENTER + dy * m) < 0 ? lo = m : hi = m; }
    pts.push(new THREE.Vector2(i === 0 || i === n ? 0 : dx * lo, CENTER + dy * lo));
  }
  return pts;
}
const PROFILE = profile();
// radius of the body at height y (front half of the head is monotonic, which is all we need for the face)
function radiusAt(y) {
  for (let i = 1; i < PROFILE.length; i++) { const a = PROFILE[i - 1], b = PROFILE[i]; if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) return a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y); }
  return 0;
}
const frontZ = (x, y) => Math.sqrt(Math.max(radiusAt(y) ** 2 - x * x, 0)) * DEPTH;
function surfNormal(x, y) {
  const e = .01, z = frontZ(x, y), dx = new THREE.Vector3(2 * e, 0, frontZ(x + e, y) - frontZ(x - e, y)), dy = new THREE.Vector3(0, 2 * e, frontZ(x, y + e) - frontZ(x, y - e));
  return new THREE.Vector3().crossVectors(dx, dy).normalize().multiplyScalar(z > 0 ? 1 : 1);
}

// ---------------------------------------------------------------- skeleton
const BONES = [
  // name, parent, bind position (world)
  ['Root', null, [0, 0, 0]], ['Hips', 'Root', [0, .45, 0]], ['Spine', 'Hips', [0, .74, 0]], ['Head', 'Spine', [0, 1.0, 0]],
  ['Tuft_C', 'Head', [.06, 2.04, -.03]], ['Tuft_L', 'Head', [.3, 1.99, -.01]], ['Tuft_R', 'Head', [-.17, 2.03, -.03]],
  ['Arm_L', 'Spine', [.45, .8, .03]], ['Hand_L', 'Arm_L', [.6, .5, .07]], ['Arm_R', 'Spine', [-.45, .8, .03]], ['Hand_R', 'Arm_R', [-.6, .5, .07]],
  ['Leg_L', 'Hips', [.23, .36, .02]], ['Leg_R', 'Hips', [-.23, .36, .02]], ['Tail', 'Hips', [0, .5, -.42]],
];
function makeSkeleton() {
  const by = {}, list = [];
  for (const [n, p, w] of BONES) { const b = new THREE.Bone(); b.name = n; b.userData.world = new THREE.Vector3(...w); by[n] = b; list.push(b); }
  for (const [n, p] of BONES) if (p) { by[p].add(by[n]); by[n].position.copy(by[n].userData.world).sub(by[p].userData.world); } else by[n].position.copy(by[n].userData.world);
  list.forEach(b => b.userData.rest = b.position.clone());
  return { by, list, index: Object.fromEntries(list.map((b, i) => [b.name, i])) };
}

// ---------------------------------------------------------------- geometry helpers
const sm = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
// a part = indexed geometry with position/normal/uv + per-vertex skin (up to 2 bones) + fur length + body flag
function part(geo, weightFn, fur, body = 0, uvs = [1, 1]) {
  const g = geo.index ? geo : geo.toNonIndexed(); const n = g.attributes.position.count;
  { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvs[0], uv.getY(i) * uvs[1]); } // UVs in world units (for exported fur)
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), af = new Float32Array(n * 2), p = new THREE.Vector3();
  for (let i = 0; i < n; i++) { p.fromBufferAttribute(g.attributes.position, i); const w = weightFn(p, i);
    for (let k = 0; k < 4; k++) { si[i * 4 + k] = w[k * 2] || 0; sw[i * 4 + k] = w[k * 2 + 1] || 0; }
    af[i * 2] = typeof fur === 'function' ? fur(p) : fur; af[i * 2 + 1] = body; }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); g.setAttribute('aFur', new THREE.Float32BufferAttribute(af, 2));
  return g;
}
function merge(parts) {
  const keys = ['position', 'normal', 'uv', 'skinIndex', 'skinWeight', 'aFur'], out = new THREE.BufferGeometry(), arr = {}, idx = []; let off = 0;
  keys.forEach(k => arr[k] = []);
  for (const g of parts) { for (const k of keys) arr[k].push(...g.attributes[k].array); for (const i of g.index.array) idx.push(i + off); off += g.attributes.position.count; }
  out.setAttribute('position', new THREE.Float32BufferAttribute(arr.position, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(arr.normal, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(arr.uv, 2)); out.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(arr.skinIndex, 4));
  out.setAttribute('skinWeight', new THREE.Float32BufferAttribute(arr.skinWeight, 4)); out.setAttribute('aFur', new THREE.Float32BufferAttribute(arr.aFur, 2)); out.setIndex(idx);
  return out;
}
// lathe along -Y from the origin, then aimed along dir and moved to `at`
function limb(prof, seg, dir, at, zScale = 1) {
  const g = new THREE.LatheGeometry(prof, seg);
  if (zScale !== 1) { g.scale(1, 1, zScale); }
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize())); g.translate(at.x, at.y, at.z); return g;
}
function fixNormalsScaled(g, s) { const n = g.attributes.normal; for (let i = 0; i < n.count; i++) { const v = new THREE.Vector3(n.getX(i) / s.x, n.getY(i) / s.y, n.getZ(i) / s.z).normalize(); n.setXYZ(i, v.x, v.y, v.z); } }

// ---------------------------------------------------------------- fur shader
const FUR_COMMON = /* glsl */`
float faceE(vec3 p){ return length(vec2(p.x / .67, (p.y - 1.28) / .45)); }
float faceMask(vec3 p){ return (1. - smoothstep(.93, 1.03, faceE(p))) * smoothstep(.2, .45, p.z); }
float hoodMask(vec3 p){ float e = faceE(p); return smoothstep(.97, 1.03, e) * (1. - smoothstep(1.05, 1.45, e)) * smoothstep(.2, .45, p.z); }`;
const FUR_VS = /* glsl */`
#include <common>
#include <skinning_pars_vertex>
attribute vec2 aFur; uniform float uH, uLen;
varying vec3 vRest, vRestN, vNw, vPw; varying float vBody;
${FUR_COMMON}
void main(){
  #include <beginnormal_vertex>
  vRestN = objectNormal;
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  vNw = normalize(mat3(modelMatrix) * objectNormal);
  #include <begin_vertex>
  vRest = position; vBody = aFur.y;
  float len = aFur.x * uLen * mix(1., .14, faceMask(position) * aFur.y) * (1. + .6 * hoodMask(position) * aFur.y);
  transformed += normalize(vRestN) * (uH * len) + vec3(0., -1., 0.) * (uH * uH * len * .3);
  #include <skinning_vertex>
  vec4 wp = modelMatrix * vec4(transformed, 1.); vPw = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const FUR_FS = /* glsl */`
uniform float uH, uDens; uniform vec3 uGreen, uCream, uBlush, uKeyDir, uKeyCol, uFillDir, uFillCol, uRimDir, uRimCol, uSky, uGround;
varying vec3 vRest, vRestN, vNw, vPw; varying float vBody;
${FUR_COMMON}
float h1(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
vec3 h3(vec3 p){ return fract(sin(vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)))) * 43758.5453); }
void main(){
  float face = faceMask(vRest) * vBody;
#ifdef SMOOTH
  // smooth plush: one soft surface, no strands (light on phones)
  vec3 base = mix(uGreen, uCream, smoothstep(.3, .7, face));
  float bl = (1. - smoothstep(.0, .11, length(vec2(abs(vRest.x) - .5, (vRest.y - 1.12) * 1.25)))) * face;
  base = mix(base, uBlush, bl * .8);
  base *= mix(1., .9, smoothstep(.55, 1., faceE(vRest)) * face);
  vec3 N = normalize(vNw), V = normalize(cameraPosition - vPw);
  float k = max(0., (dot(N, uKeyDir) + .45) / 1.45), fl = max(0., (dot(N, uFillDir) + .5) / 1.5);
  float fr = pow(1. - max(dot(N, V), 0.), 2.);
  float rim = fr * (dot(N, uRimDir) * .5 + .5);
  vec3 hemi = mix(uGround, uSky, N.y * .5 + .5);
  vec3 col = base * (hemi + uKeyCol * k + uFillCol * fl) * mix(.95, 1., face) + uRimCol * rim * .7 * base + base * fr * .12 * (1. - face);
  gl_FragColor = vec4(col, 1.);
#else
  vec3 n0 = normalize(vRestN);
  vec3 lean = h3(floor(vRest * 7.)) - .5; lean -= n0 * dot(lean, n0);
  vec3 p = (vRest - lean * uH * .05 * (1. - face)) * uDens * mix(1., 1.6, face);
  vec3 ip = floor(p), fp = fract(p); float d = 9., id = 0.;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(float(x), float(y), float(z)); vec3 r = g + h3(ip + g) - fp; float dd = dot(r, r); if (dd < d) { d = dd; id = h1(ip + g); } }
  d = sqrt(d);
  float lenR = .5 + .5 * id;
  if (uH > 0. && (uH > lenR || d > .8 * (1. - .7 * uH / lenR))) discard;
  vec3 base = mix(uGreen, uCream, step(fract(id * 13.7) * .7 + .15, face));
  float bl = (1. - smoothstep(.0, .11, length(vec2(abs(vRest.x) - .5, (vRest.y - 1.12) * 1.25)))) * face;
  base = mix(base, uBlush, bl * .8);
  base *= mix(1., .88, smoothstep(.55, 1., faceE(vRest)) * face);
  base *= mix(.9 + .2 * fract(id * 7.31), .97 + .06 * fract(id * 7.31), face);
  base = mix(base, base * 1.12 + .02, uH * uH);
  float ao = mix(mix(.42, 1., pow(uH, .7)), .93 + .07 * uH, face);
  vec3 N = normalize(vNw), V = normalize(cameraPosition - vPw);
  float k = max(0., (dot(N, uKeyDir) + .45) / 1.45), fl = max(0., (dot(N, uFillDir) + .5) / 1.5);
  float rim = pow(1. - max(dot(N, V), 0.), 2.5) * (dot(N, uRimDir) * .5 + .5);
  vec3 hemi = mix(uGround, uSky, N.y * .5 + .5);
  vec3 col = base * (hemi + uKeyCol * k + uFillCol * fl) * ao + uRimCol * rim * (.25 + uH) * base * 1.6;
  gl_FragColor = vec4(col, 1.);
#endif
  #include <colorspace_fragment>
}`;

// one set of lights for both the fur shader and normal materials
export const LIGHTS = {
  sky: 0xfff8ec, skyI: .55, ground: 0x7d8aa3, groundI: .35,
  key: [-.55, .75, .65], keyCol: 0xfff1df, keyI: .95,
  fill: [.8, .1, .55], fillCol: 0xd8ecff, fillI: .35,
  rim: [.4, .5, -.9], rimCol: 0xffffff, rimI: .9,
};
export function addMataLights(scene) {
  const L = LIGHTS, g = new THREE.Group(); g.name = 'MataLights';
  g.add(new THREE.HemisphereLight(L.sky, L.ground, 1.6));
  const k = new THREE.DirectionalLight(L.keyCol, 2.2); k.position.set(...L.key).multiplyScalar(10); g.add(k);
  const f = new THREE.DirectionalLight(L.fillCol, .8); f.position.set(...L.fill).multiplyScalar(10); g.add(f);
  const r = new THREE.DirectionalLight(L.rimCol, 1.4); r.position.set(...L.rim).multiplyScalar(10); g.add(r);
  scene.add(g); return g;
}
function furUniforms() {
  const L = LIGHTS, c = (h, i = 1) => new THREE.Color(h).multiplyScalar(i), v = a => new THREE.Vector3(...a).normalize();
  return {
    uDens: { value: 150 }, uLen: { value: 1 },
    uGreen: { value: c(0x9fc4e8) }, uCream: { value: c(0xf8e4d0) }, uBlush: { value: c(0xf3a7a2) },
    uKeyDir: { value: v(L.key) }, uKeyCol: { value: c(L.keyCol, L.keyI) }, uFillDir: { value: v(L.fill) }, uFillCol: { value: c(L.fillCol, L.fillI) },
    uRimDir: { value: v(L.rim) }, uRimCol: { value: c(L.rimCol, L.rimI) }, uSky: { value: c(L.sky, L.skyI) }, uGround: { value: c(L.ground, L.groundI) },
  };
}

// ---------------------------------------------------------------- face textures
// eye like the character sheet: white of the eye, big brown iris (moves with the gaze), dark outline, a small shine on the iris.
// mirror = the texture is seen flipped (right eye), so it is drawn flipped back and both eyes look the same way.
// how far each iris sits towards the nose (fraction of the texture); checked on renders: L (+x eye) needs -, R (mirrored) needs +
const NASAL = .09, NB = { L: -NASAL, R: NASAL };
function drawEye(g, S, gx, gy, mirror) {
  // like the sheet: a big tall iris (about 70% of the eye's width, 85% of its height), sitting towards the nose (as in the sheet), with the white showing as a crescent on the outer side
  const X = v => mirror ? S - v : v, cx = S * (.5 + (mirror ? -gx : gx) * .1 + (mirror ? NB.R : NB.L)), cy = S * (.515 - gy * .05), ri = S * .37;
  g.save(); if (mirror) { g.translate(S, 0); g.scale(-1, 1); }
  g.fillStyle = '#2a1810'; g.fillRect(0, 0, S, S);
  g.beginPath(); g.arc(S / 2, S / 2, S * .468, 0, Math.PI * 2); g.closePath(); g.save(); g.clip();
  const w = g.createRadialGradient(S * .5, S * .42, S * .1, S * .5, S * .5, S * .5); w.addColorStop(0, '#ffffff'); w.addColorStop(.8, '#fcfbf9'); w.addColorStop(1, '#ebe5df');
  g.fillStyle = w; g.fillRect(0, 0, S, S);
  const ir = g.createRadialGradient(cx, cy + ri * .25, ri * .1, cx, cy, ri); ir.addColorStop(0, '#5a3220'); ir.addColorStop(.55, '#3b2014'); ir.addColorStop(.86, '#2a160d'); ir.addColorStop(1, '#170c07');
  g.fillStyle = ir; g.beginPath(); g.ellipse(cx, cy, ri, ri * 1.2, 0, 0, Math.PI * 2); g.fill();
  const lo = g.createLinearGradient(0, cy, 0, cy + ri); lo.addColorStop(0, 'rgba(140,85,50,0)'); lo.addColorStop(1, 'rgba(150,92,55,.55)');
  g.fillStyle = lo; g.beginPath(); g.ellipse(cx, cy, ri * .92, ri * 1.08, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#120905'; g.beginPath(); g.ellipse(cx, cy + ri * .02, ri * .5, ri * .6, 0, 0, Math.PI * 2); g.fill();
  // soft shadow of the upper lid on the eye
  const sh = g.createLinearGradient(0, 0, 0, S * .32); sh.addColorStop(0, 'rgba(60,35,25,.3)'); sh.addColorStop(1, 'rgba(60,35,25,0)'); g.fillStyle = sh; g.fillRect(0, 0, S, S * .32);
  g.restore();
  g.restore();
  // shine: always upper right of the viewer's view, on the iris
  g.fillStyle = '#fff'; g.beginPath(); g.arc(X(cx + ri * .38), cy - ri * .6, S * .055, 0, Math.PI * 2); g.fill();
  g.globalAlpha = .7; g.beginPath(); g.arc(X(cx - ri * .3), cy + ri * .45, S * .025, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
}
function eyeTexture(mirror) {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  drawEye(g, S, 0, 0, mirror);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.look = (gx, gy) => { drawEye(g, S, gx, gy, mirror); t.needsUpdate = true; }; return t;
}

// ---------------------------------------------------------------- mouth (morphable strip)
const MN = 33;
function mouthCurves(shape) {
  const up = [], lo = [], tu = [], tl = [];
  for (let i = 0; i < MN; i++) {
    const t = i / (MN - 1), s = 2 * t - 1, q = 1 - s * s;
    let w, yu, yl;
    if (shape === 'open') { w = .095; yu = .012 - .012 * q; yl = .012 - .105 * Math.pow(q, .75); }
    else if (shape === 'grin') { w = .12; yu = .02 - .012 * q; yl = .02 - .135 * Math.pow(q, .7); }
    else if (shape === 'closed') { w = .085; yu = .022 - .045 * q; yl = yu - (.006 + .012 * Math.pow(q, .5)); }
    else if (shape === 'o') { const a = Math.PI * (1 - t); w = .036; yu = -.025 + Math.sin(a) * .036; yl = -.025 - Math.sin(a) * .036; up.push(new THREE.Vector2(Math.cos(a) * w, yu)); lo.push(new THREE.Vector2(Math.cos(a) * w, yl)); }
    else if (shape === 'sad') { w = .07; yu = -.035 + .03 * q; yl = yu - (.006 + .01 * Math.pow(q, .5)); }
    if (shape !== 'o') { up.push(new THREE.Vector2(s * w, yu)); lo.push(new THREE.Vector2(s * w, yl)); }
    const U = up[i], Lo = lo[i], gap = U.y - Lo.y, tTop = Math.min(U.y - .006, Lo.y + gap * .5 * (shape === 'o' ? .6 : 1) + .0);
    const tx = U.x * .82, hump = Math.max(0, gap - .012) * Math.pow(Math.max(0, 1 - Math.pow(U.x / ((shape === 'o' ? .036 : w) * .78), 2)), .5) * .55;
    tu.push(new THREE.Vector2(tx, Lo.y + .004 + hump)); tl.push(new THREE.Vector2(tx, Lo.y + .004));
  }
  return { up, lo, tu, tl };
}
function stripGeo(A, B, project) {
  const pos = [], idx = [];
  for (let i = 0; i < MN; i++) { pos.push(...project(A[i]), ...project(B[i])); }
  for (let i = 0; i < MN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}

// ---------------------------------------------------------------- build
export function createMataHD(opts = {}) {
  const shells = opts.shells ?? 0, smooth = !shells; // 0 shells = smooth plush (default: cheap enough for phones)
  const root = new THREE.Group(); root.name = 'Mata';
  const sk = makeSkeleton(), B = sk.by, I = sk.index;
  root.add(B.Root); root.updateMatrixWorld(true);

  // --- body (one lathe: big round head flowing into a small body)
  const body = new THREE.LatheGeometry(PROFILE, 112); body.scale(1, 1, DEPTH); fixNormalsScaled(body, new THREE.Vector3(1, 1, DEPTH));
  const bodyW = p => { const h = sm(.8, 1.0, p.y), s = sm(.36, .58, p.y) * (1 - h); return [I.Head, h, I.Spine, s, I.Hips, 1 - h - s]; };
  const parts = [part(body, bodyW, .075, 1, [4.4, 3.9])];
  // --- arms (stubby, slightly thicker at the paw)
  const armProf = []; for (let i = 0; i <= 24; i++) { const t = i / 24; const y = -t * .56; const r = t < .82 ? .132 + .03 * t : (.132 + .03 * .82) * Math.sqrt(Math.max(0, 1 - Math.pow((t - .82) / .18, 2))); armProf.push(new THREE.Vector2(Math.max(r, 0), y)); }
  armProf.unshift(new THREE.Vector2(0, .02)); armProf.reverse(); // bottom to top so the normals face outwards
  for (const [s, a, h] of [[1, 'Arm_L', 'Hand_L'], [-1, 'Arm_R', 'Hand_R']]) {
    const sh = B[a].userData.world, dir = new THREE.Vector3(s * .3, -.62, .08).normalize();
    const g = limb(armProf, 28, dir, sh);
    parts.push(part(g, p => { const t = p.clone().sub(sh).dot(dir) / .56, w = sm(.4, .62, t); return [I[a], 1 - w, I[h], w]; }, .065, 0, [.95, .62]));
  }
  // --- legs (short and round, little feet pointing forward)
  const legProf = []; for (let i = 0; i <= 18; i++) { const t = i / 18, y = -t * .34; const r = t < .7 ? .17 + .015 * t : .1805 * Math.sqrt(Math.max(0, 1 - Math.pow((t - .7) / .3, 2))); legProf.push(new THREE.Vector2(r, y)); }
  legProf.unshift(new THREE.Vector2(0, .05)); legProf.reverse();
  for (const [s, l] of [[1, 'Leg_L'], [-1, 'Leg_R']]) { const at = B[l].userData.world; const g = limb(legProf, 24, new THREE.Vector3(s * .05, -1, .04), at, 1.15); parts.push(part(g, () => [I[l], 1], .055, 0, [1.05, .5])); }
  // --- three leafy tufts on top
  const tuftProf = []; for (let i = 0; i <= 16; i++) { const t = i / 16; tuftProf.push(new THREE.Vector2(.2 * Math.sqrt(Math.max(0, 1 - Math.pow((t - .5) / .5, 2))), t * .5)); }
  tuftProf[tuftProf.length - 1].x = 0; tuftProf.unshift(new THREE.Vector2(0, -.02));
  for (const [n, rz, rx, sc] of [['Tuft_C', -.35, -.15, 1.1], ['Tuft_L', -.7, -.05, .7], ['Tuft_R', .1, -.15, .95]]) {
    const at = B[n].userData.world, g = new THREE.LatheGeometry(tuftProf, 20); g.scale(sc, sc, sc * .55); fixNormalsScaled(g, new THREE.Vector3(sc, sc, sc * .55)); g.rotateX(rx); g.rotateZ(rz); g.translate(at.x, at.y - .04, at.z);
    parts.push(part(g, () => [I[n], 1], .05, 0, [.85, .5]));
  }
  // --- little round tail
  { const g = new THREE.SphereGeometry(.12, 20, 14); const at = B.Tail.userData.world; g.translate(at.x, at.y, at.z); parts.push(part(g, () => [I.Tail, 1], .08, 0, [.75, .38])); }
  const geo = merge(parts); geo.computeBoundingSphere(); geo.boundingSphere.radius += .2;

  const skeleton = new THREE.Skeleton(sk.list);
  const furU = furUniforms(), furMats = [], meshes = [];
  for (let i = 0; i <= shells; i++) {
    const m = new THREE.ShaderMaterial({ uniforms: { ...furU, uH: { value: smooth ? .45 : i / shells } }, vertexShader: FUR_VS, fragmentShader: FUR_FS, defines: smooth ? { SMOOTH: 1 } : {} });
    const mesh = new THREE.SkinnedMesh(geo, m); mesh.name = i ? 'Fur_' + i : 'Body'; mesh.frustumCulled = false; mesh.renderOrder = i;
    root.add(mesh); mesh.bind(skeleton); furMats.push(m); meshes.push(mesh);
  }

  // --- face (children of the Head bone, placed on the face surface)
  const headW = B.Head.userData.world;
  const onFace = (obj, x, y, lift) => { const z = frontZ(x, y); obj.position.set(x, y, z + lift).sub(headW); const n = surfNormal(x, y); obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); B.Head.add(obj); return obj; };
  const eyeTexs = { L: eyeTexture(false), R: eyeTexture(true) }, eyeMats = {}; for (const k in eyeTexs) eyeMats[k] = new THREE.MeshPhysicalMaterial({ map: eyeTexs[k], roughness: .2, clearcoat: 1, clearcoatRoughness: .05 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x24140c, roughness: .5 });
  const eyes = {}, happy = {};
  for (const [s, k] of [[1, 'L'], [-1, 'R']]) {
    const g = new THREE.SphereGeometry(.145, 36, 24); { const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / .29 + .5, p.getY(i) / .29 + .5); }
    const eg = new THREE.Group(); eg.name = 'Eye_' + k; onFace(eg, s * .35, 1.26, .012);
    const ball = new THREE.Mesh(g, eyeMats[k]); ball.scale.set(1, 1.14, .55); ball.name = 'EyeBall_' + k; if (s < 0) ball.scale.x = -1; eg.add(ball);
    // a soft lash line along the upper outer edge
    const pts = []; for (let i = 0; i <= 16; i++) { const a = Math.PI * (.08 + .84 * i / 16); pts.push(new THREE.Vector3(Math.cos(a) * .144 * s, Math.sin(a) * .164, .012)); }
    const lash = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.reverse()), 32, .01, 8), darkMat); lash.name = 'Lash_' + k; eg.add(lash);
    eyes[k] = eg;
    // closed "happy" eye: a soft upside-down U
    const hp = []; for (let i = 0; i <= 16; i++) { const x = -.11 + .22 * i / 16; hp.push(new THREE.Vector3(x, .055 * (1 - Math.pow(x / .11, 2)) - .01, .02)); }
    const hg = new THREE.Group(); hg.name = 'EyeHappy_' + k; onFace(hg, s * .35, 1.25, .03);
    hg.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp), 24, .02, 8), darkMat)); hg.scale.setScalar(.0001); happy[k] = hg;
  }
  // mouth: an open smile by default; morph targets for grin, closed smile, "o" and sad
  const MY = 1.16, proj = v => { const x = v.x, y = MY + v.y, z = frontZ(x, y) + .03; return [x, y - headW.y, z - headW.z]; };
  const shapes = ['grin', 'closed', 'o', 'sad'], open0 = mouthCurves('open');
  const mouthG = stripGeo(open0.up, open0.lo, proj), tongueG = stripGeo(open0.tu, open0.tl, v => { const r = proj(v); r[2] += .004; return r; });
  mouthG.morphAttributes.position = []; tongueG.morphAttributes.position = [];
  for (const sh of shapes) { const c = mouthCurves(sh); mouthG.morphAttributes.position.push(stripGeo(c.up, c.lo, proj).attributes.position); tongueG.morphAttributes.position.push(stripGeo(c.tu, c.tl, v => { const r = proj(v); r[2] += .004; return r; }).attributes.position); }
  mouthG.computeVertexNormals(); tongueG.computeVertexNormals();
  const mouth = new THREE.Mesh(mouthG, new THREE.MeshStandardMaterial({ color: 0x5c1e22, roughness: .6, side: THREE.DoubleSide })); mouth.name = 'Mouth';
  const tongue = new THREE.Mesh(tongueG, new THREE.MeshStandardMaterial({ color: 0xee8790, roughness: .55, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 })); tongue.name = 'Tongue';
  for (const m of [mouth, tongue]) { m.updateMorphTargets(); m.morphTargetDictionary = Object.fromEntries(shapes.map((s, i) => [s, i])); m.frustumCulled = false; B.Head.add(m); }

  // small yellow heart on the head
  const hs = new THREE.Shape(); hs.moveTo(0, -.09); hs.bezierCurveTo(-.15, .0, -.09, .13, 0, .055); hs.bezierCurveTo(.09, .13, .15, 0, 0, -.09);
  const yellow = new THREE.MeshPhysicalMaterial({ color: 0xf39bbb, roughness: .55, sheen: 1, sheenColor: new THREE.Color(0xffe0ec), sheenRoughness: .6 });
  const heart = new THREE.Mesh(new THREE.ExtrudeGeometry(hs, { depth: .05, bevelEnabled: true, bevelThickness: .025, bevelSize: .025, bevelSegments: 4, curveSegments: 16 }), yellow);
  heart.name = 'HeadHeart'; heart.geometry.center(); heart.position.set(.5, 2.02, .12).sub(headW); heart.rotation.set(-.2, -.3, -.45); B.Head.add(heart);

  // --- yellow heart bag on a strap (rigid on the Spine)
  const spineW = B.Spine.userData.world;
  const bag = new THREE.Group(); bag.name = 'Bag';
  const rbox = (w, h, d, r) => { const g = new THREE.BoxGeometry(w, h, d, 10, 10, 10), p = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3(w / 2 - r, h / 2 - r, d / 2 - r);
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const q = new THREE.Vector3(Math.max(-c.x, Math.min(c.x, v.x)), Math.max(-c.y, Math.min(c.y, v.y)), Math.max(-c.z, Math.min(c.z, v.z))); v.sub(q).normalize().multiplyScalar(r).add(q); p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals(); return g; };
  const felt = new THREE.MeshPhysicalMaterial({ color: 0xf4a3c1, roughness: .85, sheen: 1, sheenColor: new THREE.Color(0xffe4ef), sheenRoughness: .5 });
  bag.add(new THREE.Mesh(rbox(.36, .28, .14, .07), felt));
  const flap = new THREE.Mesh(rbox(.36, .16, .035, .016), felt); flap.position.set(0, .055, .07); flap.rotation.x = -.08; bag.add(flap);
  const bh = new THREE.Mesh(new THREE.ExtrudeGeometry(hs, { depth: .01, bevelEnabled: true, bevelThickness: .008, bevelSize: .008, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ color: 0xfffaf2, roughness: .7 }));
  bh.scale.setScalar(.55); bh.position.set(0, .04, .09); bag.add(bh);
  const bagPos = new THREE.Vector3(-.3, .5, .5); bag.position.copy(bagPos).sub(spineW); bag.rotation.set(-.12, -.42, .06); B.Spine.add(bag);
  // strap: loops over Mata's left shoulder, across the chest to the bag, and round the back
  const onBody = (x, y, z, lift = .055) => { const phi = Math.atan2(x, z / DEPTH), r = radiusAt(y) + lift; return new THREE.Vector3(Math.sin(phi) * r, y, Math.cos(phi) * r * DEPTH); };
  const sp = [onBody(-.22, .57, .45), onBody(0, .72, .5), onBody(.17, .88, .42), onBody(.28, .99, .05, .03), onBody(.22, .9, -.3), onBody(.04, .72, -.45), onBody(-.3, .55, -.3), onBody(-.44, .5, .05), onBody(-.4, .51, .3)];
  const strap = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sp, true), 120, .03, 8, true), felt); strap.name = 'Strap'; strap.scale.set(1, 1, 1);
  strap.geometry.translate(-spineW.x, -spineW.y, -spineW.z); B.Spine.add(strap);

  root.updateMatrixWorld(true);

  // ------------------------------------------------------------ animation
  const D = { // the pose; every field is an animatable control
    x: 0, y: 0, turn: 0, lean: 0, sway: 0, squash: 1, bob: 0,
    headYaw: 0, headPitch: 0, headRoll: 0,
    armL: 0, armLFwd: 0, handL: 0, armR: 0, armRFwd: 0, handR: 0, legL: 0, legR: 0,
    blinkL: 0, blinkR: 0, happyL: 0, happyR: 0, eyeSize: 1, lookX: 0, lookY: 0,
    grin: 0, closed: 0, o: 0, sad: 0, tail: 0,
  };
  const pose = { ...D }, manual = {}, gaze = { x: 0, y: 0 };
  const W = (a, b, k) => a + (b - a) * k;
  const wave3 = (t, f) => Math.sin(t * Math.PI * 2 * f);
  const env = (t, dur, i = .25, o = .3) => Math.min(sm(0, i, t), 1 - sm(dur - o, dur, t));
  const CLIPS = {
    idle: { dur: 4, loop: true, f: t => ({ squash: 1 + .012 * wave3(t, .5), bob: .008 * wave3(t, .5), headRoll: .04 * wave3(t, .25), sway: .02 * wave3(t, .25), armL: .06 * wave3(t + .3, .5), armR: -.06 * wave3(t, .5), tail: .2 * wave3(t, .5) }) },
    blink: { dur: .22, hard: true, f: t => ({ blinkL: Math.sin(Math.PI * t / .22), blinkR: Math.sin(Math.PI * t / .22) }) },
    wave: { dur: 1.9, f: t => { const e = env(t, 1.9, .3, .35); return { armL: 1.05 * e, armLFwd: .3 * e, handL: e * (.85 + .4 * wave3(t, 2.2)), headRoll: -.1 * e, grin: .55 * e, sway: -.04 * e }; } },
    // companion: resting with the hand up (base loop), plus a short additive "flap" of the hand
    perch: { dur: 4, loop: true, f: t => ({ ...CLIPS.idle.f(t), armL: 1.05 + .03 * wave3(t, .5), armLFwd: .3, handL: .85 }) },
    flap: { dur: 1.1, f: t => ({ handL: .85 + .42 * wave3(t, 2.6) * env(t, 1.1, .12, .2), armL: 1.05, headRoll: -.06 * env(t, 1.1, .2, .3), grin: .5 * env(t, 1.1, .2, .3) }) },
    hello: { dur: 1.2, loop: true, f: t => ({ armL: 1.05, armLFwd: .3, handL: .85 + .4 * wave3(t, 1.6) * Math.min(1, t * 4) }) },
    happy: { dur: 1.3, f: t => { const e = env(t, 1.3, .15, .3), j = t < .7 ? Math.sin(Math.PI * t / .7) : 0; return { y: .2 * j, squash: 1 - .08 * Math.sin(Math.PI * Math.min(1, t / .18)) * (t < .18) + .04 * j, happyL: e, happyR: e, grin: e, armL: 1.25 * e, armR: 1.25 * e, handL: .5 * e, handR: .5 * e, legL: -.2 * j, legR: -.2 * j }; } },
    curious: { dur: 1.8, f: t => { const e = env(t, 1.8, .3, .4); return { headRoll: .26 * e, headPitch: -.06 * e, eyeSize: 1 + .12 * e, lookY: .5 * e, lookX: -.3 * e, o: e, lean: .05 * e, armR: .3 * e, handR: .5 * e }; } },
    wink: { dur: 1.1, f: t => { const e = env(t, 1.1, .15, .3); return { happyR: e, grin: .6 * e, headRoll: -.12 * e, armR: .7 * e }; } },
    cheerful: { dur: 2.4, loop: true, f: t => ({ happyL: 1, happyR: 1, closed: 1, sway: .1 * wave3(t, .42), headRoll: .14 * wave3(t, .42), armL: .4 + .25 * wave3(t, .84), armR: .4 - .25 * wave3(t, .84), bob: .02 * Math.abs(wave3(t, .42)) }) },
    sad: { dur: 2.2, f: t => { const e = env(t, 2.2, .4, .5); return { headPitch: .28 * e, sad: e, armL: -.1 * e, armR: -.1 * e, squash: 1 - .03 * e, lean: .06 * e }; } },
    nod: { dur: 1.2, f: t => ({ headPitch: .18 * Math.max(0, Math.sin(t * Math.PI * 2 / .6)) * env(t, 1.2, .1, .2), grin: .4 * env(t, 1.2) }) },
    lookAround: { dur: 3.2, f: t => { const e = env(t, 3.2, .4, .5); return { headYaw: .55 * Math.sin(t / 3.2 * Math.PI * 2) * e, headPitch: -.05 * e, eyeSize: 1 + .05 * e, lookX: .8 * Math.sin(t / 3.2 * Math.PI * 2 + .4) * e, lookY: .2 * e }; } },
    walk: { dur: .9, loop: true, f: t => { const c = wave3(t, 1 / .9); return { legL: .55 * c, legR: -.55 * c, armL: .25 - .3 * c, armR: .25 + .3 * c, bob: .03 * Math.abs(c), sway: .05 * c, headRoll: -.03 * c, closed: .3 }; } },
    jump: { dur: 1, f: t => { const j = t < .75 ? Math.sin(Math.PI * t / .75) : 0, pre = 1 - sm(0, .12, t) + sm(.75, .85, t) - sm(.85, 1, t); return { y: .35 * j, squash: 1 - .08 * pre * (t < .12 || t > .75) + .05 * j, armL: 1.3 * j, armR: 1.3 * j, handL: .5 * j, handR: .5 * j, legL: -.3 * j, legR: -.3 * j, happyL: j, happyR: j, grin: j }; } },
  };
  // mirrored versions (other arm / other eye): waveR, helloR, winkL
  const mirror = f => t => { const v = f(t), o = {}; for (const k in v) { const m = k.replace(/L$|R$|L(?=Fwd)|R(?=Fwd)/, c => c === 'L' ? 'R' : 'L'); o[m] = ['headRoll', 'sway', 'headYaw', 'turn', 'x'].includes(k) ? -v[k] : v[k]; } return o; };
  CLIPS.waveR = { ...CLIPS.wave, f: mirror(CLIPS.wave.f) }; CLIPS.helloR = { ...CLIPS.hello, f: mirror(CLIPS.hello.f) }; CLIPS.winkL = { ...CLIPS.wink, f: mirror(CLIPS.wink.f) };
  const layers = []; // {name, t, w}
  let base = 'idle', baseT = 0;
  const api = {
    object: root, skeleton, bones: B, meshes, furMaterials: furMats, clips: CLIPS, pose, defaults: D, eyes, happy, mouth, tongue,
    set(p) { Object.assign(manual, p); }, clear(k) { if (k) delete manual[k]; else for (const q in manual) delete manual[q]; },
    loop(name) { base = name; baseT = 0; },
    play(name) { if (!CLIPS[name]) return; const l = layers.find(x => x.name === name); if (l) l.t = 0; else layers.push({ name, t: 0 }); },
    playing(name) { return layers.some(l => l.name === name); },
    setFur({ length, density } = {}) { if (length != null) furU.uLen.value = length; if (density != null) furU.uDens.value = density; },
    // compute the pose at a time without touching state (used to bake clips)
    sample(name, t, withIdle = true) { const p = { ...D }; if (withIdle) Object.assign(p, CLIPS.idle.f(t)); const c = CLIPS[name]; if (c) { const v = c.f(c.loop ? t % c.dur : Math.min(t, c.dur)); for (const k in v) p[k] = v[k] + (k in CLIPS.idle.f(0) && withIdle && name !== 'idle' ? 0 : 0); } return p; },
    update(dt) {
      baseT += dt; Object.assign(pose, D, CLIPS[base].f(baseT % CLIPS[base].dur));
      for (let i = layers.length - 1; i >= 0; i--) { const l = layers[i], c = CLIPS[l.name]; l.t += dt; if (!c.loop && l.t >= c.dur) { layers.splice(i, 1); continue; }
        // each action eases in and out over the current pose (so nothing snaps)
        const v = c.f(c.loop ? l.t % c.dur : l.t), w = c.hard ? 1 : c.loop ? Math.min(1, l.t / .2) : Math.max(0, Math.min(1, l.t / .15, (c.dur - l.t) / .2));
        for (const k in v) pose[k] += (v[k] - pose[k]) * w; }
      for (const k in manual) pose[k] = manual[k];
      api.apply(pose);
    },
    apply(p) {
      const b = B;
      b.Root.position.set(p.x, p.y, 0); b.Root.rotation.set(0, p.turn, 0);
      b.Hips.position.copy(b.Hips.userData.rest); b.Hips.position.y += p.bob; b.Hips.rotation.set(p.lean * .5, 0, p.sway);
      b.Spine.rotation.set(p.lean, 0, p.sway * .6); b.Spine.scale.set(1 / Math.sqrt(p.squash), p.squash, 1 / Math.sqrt(p.squash));
      b.Head.rotation.set(p.headPitch, p.headYaw, p.headRoll, 'YXZ');
      b.Arm_L.rotation.set(-p.armLFwd, 0, p.armL); b.Hand_L.rotation.set(0, 0, p.handL);
      b.Arm_R.rotation.set(-p.armRFwd, 0, -p.armR); b.Hand_R.rotation.set(0, 0, -p.handR);
      b.Leg_L.rotation.set(p.legL, 0, 0); b.Leg_R.rotation.set(p.legR, 0, 0);
      b.Tail.rotation.set(0, p.tail, 0);
      // tufts trail a little behind the head's motion
      const tw = p.headRoll + p.sway; b.Tuft_C.rotation.set(-p.headPitch * .4, 0, -tw * .5); b.Tuft_L.rotation.set(0, 0, -tw * .7); b.Tuft_R.rotation.set(0, 0, -tw * .7);
      for (const k of ['L', 'R']) {
        const bl = Math.min(1, Math.max(p['blink' + k], p['happy' + k])); eyes[k].scale.set(p.eyeSize, p.eyeSize * (bl > .97 ? 1e-4 : Math.max(.04, 1 - bl)), p.eyeSize); eyes[k].visible = bl < .97;
        const h = p['happy' + k]; happy[k].scale.setScalar(Math.max(.0001, sm(.35, .9, h)));
      }
      // gaze: the iris moves inside the white of the eye (textures redrawn only when it changes)
      { const gx = Math.max(-1, Math.min(1, p.lookX)), gy = Math.max(-1, Math.min(1, p.lookY)); if (Math.abs(gx - gaze.x) > .015 || Math.abs(gy - gaze.y) > .015) { gaze.x = gx; gaze.y = gy; eyeTexs.L.userData.look(gx, gy); eyeTexs.R.userData.look(gx, gy); } }
      const mw = [p.grin, p.closed, p.o, p.sad]; for (const m of [mouth, tongue]) mw.forEach((w, i) => m.morphTargetInfluences[i] = Math.min(1, Math.max(0, w)));
    },
    dispose() { geo.dispose(); furMats.forEach(m => m.dispose()); eyeTexs.L.dispose(); eyeTexs.R.dispose(); root.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) { o.geometry.dispose(); o.material.dispose(); } }); },
  };
  api.apply(pose);
  return api;
}

// Drop-in replacement for the old mata3d.js createMata() used by the XR apps (centred on its middle, about 1.3 units tall).
export function createMata(opts = {}) {
  const m = createMataHD({ shells: opts.shells ?? 0 }), root = new THREE.Group(); m.setFur({ density: 120 });
  m.object.scale.setScalar(.58); m.object.position.y = -.66; root.add(m.object);
  let mode = 'idle';
  return {
    object: root, hd: m,
    happy() { m.play('happy'); },
    update(t, dt, o = {}) {
      if (o.reducedMotion) { if (mode !== 'still') { mode = 'still'; m.loop('idle'); m.update(0); } return; }
      const want = o.moving ? 'walk' : 'idle'; if (want !== mode) { mode = want; m.loop(want); }
      m.update(dt);
    },
  };
}
