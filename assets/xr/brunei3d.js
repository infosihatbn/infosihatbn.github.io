// The world outside the eye in 3D (Haziq, 2026-11-10: "more detailed, realistic, more 3d, like Unreal Engine 5, more dynamic, more lively").
// Seen through the cornea: a sunlit lagoon with moving waves, sun glitter and reflections, a golden-domed mosque (inspired by Brunei,
// not an exact building), Kampong Ayer stilt villages on boardwalks, swaying palms, water taxis with wakes, birds, drifting clouds
// and layered rainforest hills. The painted sky dome (brunei.js) stays behind it all as the far sky.
// Everything sits outside the eye (the eye's radius is 60, centred on the origin, looking out along +Z), so the eye wall hides it
// except through the clear cornea. Static parts are merged into one mesh with baked colours; one small shader lights it all.
import * as THREE from '/assets/three/three.module.min.js';
import { bruneiDome } from './brunei.js?v=3';

const WY = -22;                                                         // the water level
const SUN = new THREE.Vector3(-.63, .48, .61).normalize();              // same sun as the painted sky
const lin = h => new THREE.Color(h);

// ---------- one lit shader for buildings, trees and boats ----------
const LIT_VS = `attribute vec3 color; attribute vec2 aM; uniform float uT, uRefl, uWY;
varying vec3 vC, vN, vW; varying float vMe;
void main(){
  vec3 p = position;
  if (aM.y > 0.) { float s = sin(uT * 1.3 + position.x * .09 + position.z * .05) + .4 * sin(uT * 3.1 + position.y * .6);
    p.x += s * aM.y * .55; p.z += cos(uT * 1.1 + position.x * .07) * aM.y * .4; p.y += sin(uT * 2.3 + position.z * .2) * aM.y * .18; }
  vec4 w = modelMatrix * vec4(p, 1.);
  vec3 n = normalize(mat3(modelMatrix) * normal);
  if (uRefl > .5) { w.y = 2. * uWY - w.y; n.y = -n.y; w.x += sin(uT * 1.7 + w.y * .9 + w.z * .3) * .35 * clamp((uWY - w.y) * .15, 0., 1.); }
  vW = w.xyz; vN = n; vC = color; vMe = aM.x;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const LIT_FS = `uniform vec3 uSun, uSunC, uSky, uGnd, uHaze; uniform float uWY, uRefl, uFog;
varying vec3 vC, vN, vW; varying float vMe;
void main(){
  if (uRefl > .5 && vW.y > uWY + .05) discard;
  if (length(vW) < 61.5 || length(vW - vec3(0., 0., 30.)) < 39.5) discard;
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(cameraPosition - vW);
  float dif = max(dot(n, uSun), 0.);
  vec3 amb = mix(uGnd, uSky, n.y * .5 + .5);
  float ao = .5 + .5 * smoothstep(0., 5., abs(vW.y - uWY));                 // darker where things meet the water
  vec3 col = vC * (amb * .62 * ao + uSunC * dif * 1.05);
  float wrap = pow(max(dot(-v, uSun), 0.), 4.) * max(dot(n, -uSun) * .5 + .5, 0.); col += vC * uSunC * wrap * .25 * (1. - vMe); // light through leaves and cloth
  vec3 h = normalize(uSun + v); float nh = max(dot(n, h), 0.);
  vec3 r = reflect(-v, n); vec3 env = mix(uGnd * 1.1, uSky * 1.35, smoothstep(-.25, .5, r.y));
  vec3 genv = mix(vec3(.55, .42, .25), vec3(1.15, 1.05, .9), smoothstep(-.3, .6, r.y));                 // warm surroundings in the gold
  vec3 gold = vC * (genv * (.55 + dif * .7) + uSunC * pow(nh, 60.) * 5.) + uSunC * pow(nh, 400.) * 3.;
  col = mix(col + uSunC * pow(nh, 30.) * .05, gold, vMe);
  float d = length(vW - cameraPosition);
  col = mix(col, uHaze, clamp(1. - exp(-d * d * uFog), 0., .9));           // aerial perspective
  if (uRefl > .5) col = mix(col * .62, vec3(.16, .36, .44), .3);
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;
const litU = () => ({ uT: { value: 0 }, uRefl: { value: 0 }, uWY: { value: WY }, uSun: { value: SUN.clone() }, uSunC: { value: lin(0xfff0d6) }, uSky: { value: lin(0x9cc7ec) }, uGnd: { value: lin(0x6f8f88) }, uHaze: { value: lin(0xd7e3ea) }, uFog: { value: .0000075 } });

// ---------- a little geometry kit: transform, colour, merge ----------
function Kit() {
  const P = [], N = [], C = [], A = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), c = new THREE.Color();
  const add = (geo, { p = [0, 0, 0], r = [0, 0, 0], sc = [1, 1, 1], col = 0xffffff, metal = 0, sway = 0, shade = null } = {}) => {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (!g.attributes.normal) g.computeVertexNormals();
    m4.compose(new THREE.Vector3(...p), q.setFromEuler(e.set(...r)), s.set(...(typeof sc === 'number' ? [sc, sc, sc] : sc))); g.applyMatrix4(m4);
    const pa = g.attributes.position.array, na = g.attributes.normal.array; c.set(col);
    for (let i = 0; i < pa.length; i += 3) {
      P.push(pa[i], pa[i + 1], pa[i + 2]); N.push(na[i], na[i + 1], na[i + 2]);
      const k = shade ? shade(pa[i], pa[i + 1], pa[i + 2]) : 1; C.push(c.r * k, c.g * k, c.b * k);
      A.push(metal, typeof sway === 'function' ? sway(pa[i], pa[i + 1], pa[i + 2]) : sway);
    }
    g.dispose();
  };
  const build = () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('aM', new THREE.Float32BufferAttribute(A, 2)); g.computeBoundingSphere(); return g; };
  return { add, build };
}
const prism = () => { // a gable roof: ridge along X, 1 x 1 x 1
  const g = new THREE.BufferGeometry(), v = [-.5, 0, -.5, .5, 0, -.5, 0, .5, 0, 0, .5, 0, -.5, 0, .5, .5, 0, .5];
  const P = [[-.5, 0, -.5], [.5, 0, -.5], [.5, .5, 0], [-.5, .5, 0], [-.5, 0, .5], [.5, 0, .5]];
  const T = [[0, 3, 2], [0, 2, 1], [4, 5, 2], [4, 2, 3], [0, 4, 3], [1, 2, 5]], pos = [];
  T.forEach(t => t.forEach(i => pos.push(...P[i]))); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
};
const onion = (k = 1) => new THREE.LatheGeometry([[0, 0], [9, 0], [10.6, 2], [11.3, 5], [10.7, 8.6], [8.6, 12], [5.2, 15.5], [2.2, 18.6], [.7, 20.6], [0, 21.6]].map(([r, y]) => new THREE.Vector2(r * k, y * k)), 40);

export function bruneiWorld({ px = 4096, touch = false, hq = false } = {}) {
  const world = new THREE.Group(); world.name = 'brunei-outside';
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const dome = bruneiDome(190, px, { sky: true }); dome.renderOrder = -10; world.add(dome);

  const U = litU();
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: LIT_VS, fragmentShader: LIT_FS, side: THREE.DoubleSide });
  const UR = { ...U, uRefl: { value: 1 } };
  const matR = new THREE.ShaderMaterial({ uniforms: UR, vertexShader: LIT_VS, fragmentShader: LIT_FS, side: THREE.DoubleSide });
  const K = Kit(), KR = Kit();                                          // KR: things near the water that show in its reflection
  const both = (g, o) => { K.add(g, o); KR.add(g, o); };

  // ---------- the mosque on its lagoon ----------
  const MZ = 158, B = WY;
  const box = new THREE.BoxGeometry(1, 1, 1), cyl = (r1, r2, h, n = 24) => new THREE.CylinderGeometry(r1, r2, h, n);
  const WHT = 0xf4efe6, CRM = 0xe6dccb, GOLD = 0xf0b83c, SLATE = 0x6d8296;
  both(box, { p: [0, B + 1, MZ], sc: [74, 2, 36], col: 0xd8cfbf });                                   // stone platform
  both(box, { p: [0, B + 8, MZ], sc: [56, 12, 24], col: WHT });                                       // prayer hall
  both(box, { p: [0, B + 14.4, MZ], sc: [58, 1, 26], col: CRM });                                     // cornice
  for (let i = -6; i <= 6; i++) {                                                                     // arched windows on the front
    both(box, { p: [i * 4, B + 6.6, MZ - 12.05], sc: [2.4, 6, .3], col: SLATE });
    both(cyl(1.2, 1.2, .3, 16), { p: [i * 4, B + 9.6, MZ - 12.05], r: [Math.PI / 2, 0, 0], col: SLATE });
  }
  for (let i = -7; i <= 7; i++) both(cyl(.55, .55, 11, 10), { p: [i * 3.7, B + 7.5, MZ - 15.2], col: WHT }); // colonnade
  both(box, { p: [0, B + 13.2, MZ - 14.6], sc: [56, 1.2, 6], col: CRM });
  both(cyl(9.6, 9.6, 7, 40), { p: [0, B + 18.5, MZ], col: WHT });                                    // drum
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; both(box, { p: [Math.sin(a) * 9.62, B + 18.6, MZ + Math.cos(a) * 9.62], r: [0, a, 0], sc: [1.1, 3.6, .2], col: SLATE }); }
  both(cyl(10.2, 10.2, .7, 40), { p: [0, B + 22.2, MZ], col: GOLD, metal: 1 });
  both(onion(), { p: [0, B + 22, MZ], col: GOLD, metal: 1 });                                       // the golden onion dome
  both(cyl(.25, .25, 5, 8), { p: [0, B + 45.5, MZ], col: GOLD, metal: 1 });
  both(new THREE.SphereGeometry(.75, 16, 12), { p: [0, B + 44, MZ], col: GOLD, metal: 1 });
  both(new THREE.TorusGeometry(1, .2, 8, 24, Math.PI * 1.35), { p: [0, B + 49, MZ], r: [0, 0, -Math.PI * .17], col: GOLD, metal: 1 }); // crescent
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {                                     // corner kiosks with small domes
    both(cyl(2.6, 2.6, 4, 16), { p: [sx * 24, B + 16.4, MZ + sz * 9], col: WHT });
    both(onion(.26), { p: [sx * 24, B + 18.4, MZ + sz * 9], col: GOLD, metal: 1 });
  }
  { const mx = 40, mz = MZ + 4;                                                                       // minaret
    both(cyl(2, 2.3, 50, 8), { p: [mx, B + 25, mz], col: WHT });
    for (const y of [16, 29, 41]) { both(cyl(3, 3, .7, 8), { p: [mx, B + y, mz], col: CRM }); both(cyl(3, 3, 1.4, 8), { p: [mx, B + y + 1, mz], col: WHT }); }
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; both(box, { p: [mx + Math.sin(a) * 2.05, B + 35, mz + Math.cos(a) * 2.05], r: [0, a, 0], sc: [.6, 2.4, .12], col: SLATE }); }
    both(onion(.18), { p: [mx, B + 50, mz], col: GOLD, metal: 1 });
    both(cyl(.12, .12, 2.5, 6), { p: [mx, B + 54.5, mz], col: GOLD, metal: 1 }); }
  both(box, { p: [0, B + .8, MZ - 36], sc: [4, .6, 38], col: 0xcfc4b0 });                            // causeway to the shore
  for (let z = -54; z <= -18; z += 4) for (const sx of [-1, 1]) both(cyl(.12, .12, 1.4, 6), { p: [sx * 2, B + 1.8, MZ + z], col: 0xbfb39d });
  // the stone royal barge in the lagoon
  { const bx = -34, bz = MZ - 22;
    both(new THREE.CylinderGeometry(3, 1.6, 24, 12, 1).rotateZ(Math.PI / 2).scale(1, .55, 1), { p: [bx, B + .9, bz], col: 0xeee4d2 });
    both(box, { p: [bx, B + 2.3, bz], sc: [20, .35, 4.6], col: GOLD, metal: .8 });
    both(box, { p: [bx + 3, B + 4.2, bz], sc: [7, 3.6, 3.6], col: WHT });
    both(onion(.16), { p: [bx + 3, B + 6, bz], col: GOLD, metal: 1 }); }

  // ---------- Kampong Ayer: stilt houses on boardwalks ----------
  const WALL = [0xf4c7c3, 0xc9e2e6, 0xf6e3b4, 0xd8e8c8, 0xe9d3ec, 0xfbfaf6, 0xf2d1b3, 0xbcd6ea, 0xa8d5c2], ROOF = [0x8b3a32, 0x3f5f73, 0x5b4636, 0xa3523f, 0x2f4858, 0x6a7b52];
  const village = (x0, x1, z, sc, face = 0) => {
    const fy = B + 2.6 * sc; both(box, { p: [(x0 + x1) / 2, fy - .2 * sc, z - 6 * sc], sc: [x1 - x0, .35 * sc, 2.2 * sc], col: 0x7a6650 });  // boardwalk
    for (let x = x0; x < x1; x += 4 * sc) K.add(cyl(.14 * sc, .14 * sc, 3 * sc, 5), { p: [x, B + 1.2 * sc, z - 6 * sc], col: 0x4a3c30 });
    for (let x = x0; x < x1 - 3 * sc;) {
      const w = (5 + rnd() * 4) * sc, h = (3.4 + rnd() * 1.6) * sc, d = (5 + rnd() * 3) * sc, cx = x + w / 2, cz = z + (rnd() - .5) * 2 * sc, wc = WALL[(rnd() * WALL.length) | 0], rc = ROOF[(rnd() * ROOF.length) | 0];
      for (const [ox, oz] of [[-.42, -.42], [.42, -.42], [-.42, .42], [.42, .42], [0, 0]]) K.add(cyl(.16 * sc, .16 * sc, 3 * sc, 5), { p: [cx + ox * w, B + 1.2 * sc, cz + oz * d], col: 0x3d3229 });
      both(box, { p: [cx, fy + h / 2, cz], r: [0, face, 0], sc: [w, h, d], col: wc });
      both(box, { p: [cx, fy - .15 * sc, cz], r: [0, face, 0], sc: [w + .6 * sc, .3 * sc, d + .6 * sc], col: 0x8a7258 });
      both(prism(), { p: [cx, fy + h, cz], r: [0, face, 0], sc: [w + 1.2 * sc, (2 + rnd() * 1.4) * sc, d + 1.4 * sc], col: rc });
      K.add(box, { p: [cx - w * .22, fy + h * .55, cz - d / 2 - .03], sc: [w * .2, h * .38, .1], col: 0x34424e });
      K.add(box, { p: [cx + w * .22, fy + h * .55, cz - d / 2 - .03], sc: [w * .2, h * .38, .1], col: 0x34424e });
      if (rnd() < .5) K.add(box, { p: [cx, fy + h * .4, cz - d / 2 - .03], sc: [w * .16, h * .7, .1], col: 0x5b4636 });
      if (rnd() < .25) K.add(box, { p: [cx + w * .6, fy + h * .9, cz - d / 2 - .4], sc: [.08, 1.2 * sc, .9 * sc], col: [0xe8505b, 0xffc93c, 0x3d8bfd][(rnd() * 3) | 0], sway: .5 }); // washing on a line
      x += w + (1 + rnd() * 3) * sc;
    }
  };
  village(-150, -52, 128, 1); village(54, 150, 126, 1);
  village(-170, -64, 150, 1.1); village(70, 172, 150, 1.1);
  village(-118, -46, 108, .9); village(48, 120, 106, .9);
  village(-190, -96, 176, 1.2); village(100, 192, 178, 1.2);

  // ---------- rainforest hills: three layers, the near one with tree crowns ----------
  for (const [rad, hgt, col, top, n] of [[230, 34, 0x9fb9a0, 0xc1d2bf, 0], [205, 24, 0x6f9572, 0x8fb28b, 0], [186, 15, 0x4f7b52, 0x7aa36f, 1]]) {
    const pos = [], A0 = -1.95, A1 = 1.95, S = 160;
    const ht = a => hgt * (.45 + .35 * Math.sin(a * 5.3 + rad) * Math.sin(a * 2.1 + 1.7) + .2 * Math.sin(a * 13 + rad * .3));
    for (let i = 0; i < S; i++) { const a = A0 + (A1 - A0) * i / S, b = A0 + (A1 - A0) * (i + 1) / S;
      const P = (an, y) => [Math.sin(an) * -rad, y, Math.cos(an) * rad];
      const p1 = P(a, B - 1), p2 = P(b, B - 1), p3 = P(b, B + ht(b)), p4 = P(a, B + ht(a)); pos.push(...p1, ...p2, ...p3, ...p1, ...p3, ...p4);
      if (n && i % 1 === 0) for (let k = 0; k < 3; k++) { const an = a + (b - a) * rnd(), y = B + ht(an) * (.55 + rnd() * .5), rr = rad - rnd() * 4;
        K.add(new THREE.IcosahedronGeometry(2.2 + rnd() * 2.2, 0), { p: [Math.sin(an) * -rr, y, Math.cos(an) * rr], sc: [1, .8, 1], col: [0x3f7d4f, 0x4f8a55, 0x5d9a5c, 0x36704a][(rnd() * 4) | 0] }); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    K.add(g, { col: 0xffffff, shade: (x, y) => 1 }); // colour set below by height
  }

  // ---------- palms on the near banks (fronds sway in the breeze) ----------
  const palm = (x, z, h, lean, ry) => {
    const top = new THREE.Vector3(x + lean, B + h, z);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, B - .5, z), new THREE.Vector3(x + lean * .2, B + h * .55, z), top);
    both(new THREE.TubeGeometry(curve, 16, .55, 8), { col: 0x7a6249, shade: (px, py) => .8 + .25 * Math.sin(py * 3.2) });
    for (let k = 0; k < 11; k++) {
      const a = k / 11 * Math.PI * 2 + ry, L = h * (.42 + .1 * Math.sin(k * 2.3)), pos = [], NS = 10;
      const pt = (f, side) => { const droop = Math.sin(f * Math.PI * .9) * L * .3 - f * f * L * .55, w = Math.sin(f * Math.PI) * L * .1 * side;
        return [top.x + Math.cos(a) * f * L - Math.sin(a) * w, top.y + droop + (side ? -Math.abs(w) * .3 : 0), top.z + Math.sin(a) * f * L + Math.cos(a) * w]; };
      for (let i = 0; i < NS; i++) { const f0 = i / NS, f1 = (i + 1) / NS;
        const a0 = pt(f0, 0), b0 = pt(f0, 1), c0 = pt(f0, -1), a1 = pt(f1, 0), b1 = pt(f1, 1), c1 = pt(f1, -1);
        pos.push(...a0, ...b0, ...b1, ...a0, ...b1, ...a1, ...a0, ...a1, ...c1, ...a0, ...c1, ...c0); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      const sw = (px, py, pz) => Math.min(1, Math.hypot(px - top.x, pz - top.z) / L) * 1.1;
      both(g, { col: k % 2 ? 0x3f7d4f : 0x4c8c52, sway: sw, shade: (px, py, pz) => .75 + .4 * Math.min(1, Math.hypot(px - top.x, pz - top.z) / L) });
    }
    for (let k = 0; k < 4; k++) both(new THREE.SphereGeometry(.55, 10, 8), { p: [top.x + Math.cos(k * 1.7) * .7, top.y - .8, top.z + Math.sin(k * 1.7) * .7], col: 0x6b5a2a });
  };
  palm(-44, 98, 17, -3, .2); palm(-38, 94, 13, 2.5, 1.1); palm(-58, 102, 19, -4, 2); palm(44, 96, 18, 3.5, .7); palm(52, 100, 14, -2, 1.6); palm(62, 104, 20, 4, 2.6);
  palm(-30, 182, 15, -2, .4); palm(26, 184, 16, 2.4, 1.3); palm(-78, 112, 16, -3, 2.2); palm(82, 112, 17, 3, .9);
  // sandy banks the palms stand on
  for (const [x, z, w] of [[-48, 99, 26], [53, 100, 26], [-80, 112, 12], [82, 112, 12], [0, 184, 70]]) both(new THREE.SphereGeometry(1, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), { p: [x, B - .6, z], sc: [w * .5, 2.2, 7], col: 0xd9c9a3 });

  // finish the hills' height colouring (light ridge tops, darker feet)
  const geo = K.build();
  { const pa = geo.attributes.position.array, ca = geo.attributes.color.array;
    for (let i = 0; i < pa.length; i += 3) { const r = Math.hypot(pa[i], pa[i + 2]); if (r < 180 || pa[i + 1] < B - 2) continue; const ring = r > 222 ? [0x9fb9a0, 0xc8d8c4, 34] : r > 198 ? [0x6f9572, 0x93b48f, 24] : null;
      if (!ring || ca[i] !== 1 || ca[i + 1] !== 1) continue; const f = Math.max(0, Math.min(1, (pa[i + 1] - B) / ring[2])); const c = lin(ring[0]).lerp(lin(ring[1]), f); ca[i] = c.r; ca[i + 1] = c.g; ca[i + 2] = c.b; }
    for (let i = 0; i < pa.length; i += 3) if (ca[i] === 1 && ca[i + 1] === 1 && ca[i + 2] === 1) { const f = Math.max(0, Math.min(1, (pa[i + 1] - B) / 15)); const c = lin(0x4f7b52).lerp(lin(0x7aa36f), f); ca[i] = c.r; ca[i + 1] = c.g; ca[i + 2] = c.b; } }
  const statics = new THREE.Mesh(geo, mat); statics.frustumCulled = false; world.add(statics);
  const refl = new THREE.Mesh(KR.build(), matR); refl.frustumCulled = false; refl.renderOrder = -5; world.add(refl);

  // ---------- the water: rolling waves, fresnel sky reflection, sun glitter, foam near the stilts ----------
  const wgeo = new THREE.PlaneGeometry(720, 300, touch ? 60 : 110, touch ? 26 : 48).rotateX(-Math.PI / 2).translate(0, WY, 220);
  const WU = { uT: { value: 0 }, uSun: U.uSun, uSunC: U.uSunC, uHaze: U.uHaze, uFog: U.uFog };
  const water = new THREE.Mesh(wgeo, new THREE.ShaderMaterial({ uniforms: WU, transparent: true, depthWrite: true,
    vertexShader: `uniform float uT; varying vec3 vW;
      float wv(vec2 p){ return sin(dot(p, vec2(.12,.05)) + uT*1.1)*.35 + sin(dot(p, vec2(-.07,.13)) + uT*.8)*.28 + sin(dot(p, vec2(.31,-.22)) + uT*2.1)*.08; }
      void main(){ vec3 p = position; p.y += wv(p.xz); vec4 w = modelMatrix*vec4(p,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uT, uFog; uniform vec3 uSun, uSunC, uHaze; varying vec3 vW;
      float h(vec2 p){ return sin(dot(p, vec2(.12,.05)) + uT*1.1)*.35 + sin(dot(p, vec2(-.07,.13)) + uT*.8)*.28 + sin(dot(p, vec2(.31,-.22)) + uT*2.1)*.08
        + sin(dot(p, vec2(1.3,.7)) + uT*3.3)*.025 + sin(dot(p, vec2(-.9,1.6)) + uT*2.7)*.02 + sin(dot(p, vec2(2.7,-1.9)) + uT*4.6)*.008; }
      void main(){
        if (length(vW) < 61.5 || length(vW - vec3(0., 0., 30.)) < 39.5) discard;   // never inside the eye or under the cornea (Haziq, 2026-11-10)
        vec2 p = vW.xz; float e = .15; vec3 n = normalize(vec3(h(p - vec2(e,0.)) - h(p + vec2(e,0.)), 2.*e, h(p - vec2(0.,e)) - h(p + vec2(0.,e))));
        vec3 v = normalize(cameraPosition - vW); float d = length(cameraPosition - vW);
        n = normalize(mix(n, vec3(0.,1.,0.), smoothstep(80., 300., d)));
        float fr = .03 + .97 * pow(1. - max(dot(n, v), 0.), 5.);
        vec3 r = reflect(-v, n);
        vec3 sky = mix(vec3(1., .89, .76), vec3(.43, .66, .87), smoothstep(0., .45, r.y));
        vec3 deep = mix(vec3(.05, .27, .33), vec3(.13, .42, .47), smoothstep(-.2, .9, n.x*.5 + .5));
        vec3 col = mix(deep, sky, clamp(fr*1.25, 0., 1.));
        float sp = pow(max(dot(r, uSun), 0.), 380.); float gl = pow(max(dot(r, uSun), 0.), 40.);
        col += uSunC * (sp * 9. + gl * .35);
        float sparkle = step(.985, fract(sin(dot(floor(p*2.5), vec2(12.9898, 78.233)) + floor(uT*6.)) * 43758.5453)) * gl * 3.;
        col += uSunC * sparkle;
        col = mix(col, uHaze, clamp(1. - exp(-d*d*uFog*1.2), 0., .9));
        float a = mix(.97, .42, clamp(fr*1.6, 0., 1.)) ; a = max(a, smoothstep(140., 300., d));
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }` }));
  water.frustumCulled = false; water.renderOrder = -4; world.add(water);

  // ---------- clouds: a drifting layer above the painted sky ----------
  const CU = { uT: { value: 0 }, uSun: U.uSun };
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(240, 48, 24, 0, Math.PI * 2, 0, Math.PI * .52), new THREE.ShaderMaterial({ uniforms: CU, side: THREE.BackSide, transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float uT; uniform vec3 uSun; varying vec3 vD;
      float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float no(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(hs(i), hs(i+vec2(1,0)), f.x), mix(hs(i+vec2(0,1)), hs(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a*no(p); p = p*2.03 + 1.7; a *= .5; } return s; }
      void main(){ vec3 d = normalize(vD); if (d.y < .015) discard;
        vec2 uv = d.xz / (d.y + .18) * 1.6 + vec2(uT*.012, uT*.004);
        float c = fbm(uv), c2 = fbm(uv + uSun.xz*.06);
        float cov = smoothstep(.5, .78, c) * smoothstep(.015, .16, d.y);
        float lit = clamp(.65 + (c - c2) * 3.5, .35, 1.25);
        vec3 col = mix(vec3(.74, .78, .86), vec3(1., .97, .92), lit) + vec3(1., .85, .7) * pow(max(dot(d, uSun), 0.), 12.) * .5;
        gl_FragColor = vec4(col, cov * .85);
        #include <colorspace_fragment>
      }` }));
  clouds.renderOrder = -9; world.add(clouds);

  // ---------- water taxis zipping across the lagoon, with foamy wakes ----------
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const boats = [];
  for (const [z, sp, col, x0] of [[112, 13, 0x2f6d8c, -40], [133, -9, 0xc0392b, 60], [143, 11, 0x1f8a70, -120], [120, -15, 0xf2b134, 140]]) {
    const k = Kit(); k.add(new THREE.CylinderGeometry(1, .5, 9, 10).rotateZ(Math.PI / 2).scale(1, .6, .9), { p: [0, .3, 0], col }); // hull
    k.add(new THREE.BoxGeometry(1, 1, 1), { p: [-.6, 1.1, 0], sc: [4.6, 1.1, 1.8], col: 0xf3efe6 });
    k.add(new THREE.BoxGeometry(1, 1, 1), { p: [-.6, 1.8, 0], sc: [5, .2, 2.1], col });
    k.add(new THREE.SphereGeometry(.3, 8, 6), { p: [.9, 2.1, 0], col: 0xffd9b0 });   // the boatman
    const m = new THREE.Mesh(k.build(), mat); m.frustumCulled = false; m.position.set(x0, WY + .2, z); m.rotation.y = sp > 0 ? 0 : Math.PI; world.add(m);
    const NW = 46, wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NW * 3).fill(-999), 3)); wg.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(NW), 1));
    const wake = new THREE.Points(wg, new THREE.ShaderMaterial({ uniforms: { uTex: { value: dot } }, transparent: true, depthWrite: false,
      vertexShader: 'attribute float aA; varying float vA; void main(){ vA = aA; vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = (2.5 + (1.-aA)*7.) * 300. / -mv.z; gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform sampler2D uTex; varying float vA; void main(){ gl_FragColor = vec4(vec3(1.), texture2D(uTex, gl_PointCoord).a * vA * .55); }' }));
    wake.frustumCulled = false; world.add(wake);
    boats.push({ m, sp, z, wake, i: 0, acc: 0 });
  }

  // ---------- birds circling over the lagoon ----------
  const birds = [], bM = new THREE.MeshBasicMaterial({ color: 0x2b3440, side: THREE.DoubleSide, fog: false });
  const wingG = new THREE.BufferGeometry(); wingG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -.35, 0, 0, .35, 1.6, .05, 0], 3));
  for (let i = 0; i < (touch ? 9 : 16); i++) {
    const b = new THREE.Group(), l = new THREE.Mesh(wingG, bM), r = new THREE.Mesh(wingG, bM); r.scale.x = -1; b.add(l, r);
    b.add(new THREE.Mesh(new THREE.ConeGeometry(.16, 1, 5).rotateX(Math.PI / 2), bM));
    b.userData = { l, r, c: new THREE.Vector3((rnd() - .5) * 140, WY + 22 + rnd() * 26, 120 + rnd() * 60), rad: 10 + rnd() * 22, w: (.18 + rnd() * .2) * (rnd() < .5 ? -1 : 1), o: rnd() * 6.3, f: 6 + rnd() * 4 };
    b.scale.setScalar(1.1 + rnd() * .6); world.add(b); birds.push(b);
  }

  const tv = new THREE.Vector3();
  const update = (t, dt = 1 / 60, cam) => {
    U.uT.value = t; WU.uT.value = t; CU.uT.value = t;
    for (const B2 of boats) {
      const m = B2.m; m.position.x += B2.sp * dt; if (m.position.x > 230) m.position.x = -230; if (m.position.x < -230) m.position.x = 230;
      const px = m.position.x, pz = m.position.z;
      m.position.y = WY + .25 + Math.sin(t * 2.4 + px * .1) * .18 + Math.sin(.12 * px + .05 * pz + t * 1.1) * .3;
      m.rotation.z = Math.sin(t * 2 + px * .2) * .05 * Math.sign(B2.sp); m.rotation.x = Math.sin(t * 1.7 + px * .1) * .04;
      B2.acc += dt; const pa = B2.wake.geometry.attributes.position.array, aa = B2.wake.geometry.attributes.aA.array;
      if (B2.acc > .07) { B2.acc = 0; const i = B2.i++ % (pa.length / 3); pa[i * 3] = px - Math.sign(B2.sp) * 4.2; pa[i * 3 + 1] = WY + .35; pa[i * 3 + 2] = pz + (Math.random() - .5) * 1.4; aa[i] = 1; }
      for (let i = 0; i < aa.length; i++) { aa[i] = Math.max(0, aa[i] - dt * .45); pa[i * 3 + 2] += (pa[i * 3 + 2] > pz ? 1 : -1) * dt * 1.4; }
      B2.wake.geometry.attributes.position.needsUpdate = true; B2.wake.geometry.attributes.aA.needsUpdate = true;
    }
    for (const b of birds) { const u = b.userData, a = t * u.w + u.o;
      b.position.set(u.c.x + Math.cos(a) * u.rad, u.c.y + Math.sin(t * .7 + u.o) * 2, u.c.z + Math.sin(a) * u.rad * .6);
      tv.set(-Math.sin(a) * u.rad * u.w, 0, Math.cos(a) * u.rad * .6 * u.w); b.lookAt(tv.add(b.position));
      const fl = Math.sin(t * u.f + u.o) * (Math.sin(t * .5 + u.o) > .2 ? .7 : .12); u.l.rotation.z = fl; u.r.rotation.z = -fl; }
  };
  return { group: world, update };
}
