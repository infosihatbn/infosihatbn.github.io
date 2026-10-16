// Origami inside of the eye for MataUniverse (Haziq, 2026-10-16), used only with ?models=new.
// Refolds the game world after the pupil in paper, to match the origami eyeball and ship:
//  - retina wall: big flat paper panels; disc, cup, macula, fovea and the zigzag ora serrata are paper cut-outs
//  - every other lit surface (vessels, disc rim, fovea pit, lens, ciliary processes, cornea, angle, floaters, tear):
//    fewer facets, flat shading, and a slight shade change per fold so each facet reads as its own piece of paper
//  - iris (seen from inside): an accordion-pleated paper fan instead of the painted texture
// Mata, the ship, markers, light beams and particles are left as they are.
import * as THREE from '/assets/three/three.module.min.js';

const wallVS = `attribute float aTone; varying float vTone; varying vec3 vW; varying vec3 vD; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW=w.xyz; vD=normalize(position); vTone=aTone; gl_Position=projectionMatrix*viewMatrix*w; }`;
const wallFS = `
uniform vec3 uDisc; uniform vec3 uFog; uniform float uDen; uniform vec3 uPlayer; uniform float uT;
varying vec3 vW; varying vec3 vD; varying float vTone;
float h1(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
void main(){
  vec3 d = normalize(vD);
  vec3 N = normalize(cross(dFdx(vW), dFdy(vW)));
  float k = vTone;                                                           // one tone per paper triangle
  float back = dot(d, vec3(0., 0., -1.)), a = acos(clamp(back, -1., 1.));
  vec3 col = mix(vec3(.84, .43, .2), vec3(.93, .54, .27), k);                // orange fundus paper (teaching-model colours)
  col = mix(vec3(.5, .21, .14), col, .35 + .65 * smoothstep(-.35, .25, back));
  col = mix(col, vec3(.66, .28, .12), step(a, .27));                         // macula: layered paper discs
  col = mix(col, vec3(.48, .19, .08), step(a, .15));
  col = mix(col, vec3(.26, .08, .05), step(a, .06));                         // fovea
  col = mix(col, vec3(1., .95, .76), step(a, .013) * .9);                    // foveal reflex
  col += vec3(.7, .85, 1.) * step(abs(a - .27), .005) * (.3 + .12 * sin(uT * 1.4));
  float ad = acos(clamp(dot(d, uDisc), -1., 1.));
  col = mix(col, vec3(.97, .8, .55), step(ad, .085));                        // optic disc
  col = mix(col, vec3(1., .95, .86), step(ad, .036));                        // cup
  float ph = atan(d.y, d.x), zz = .53 + .035 * abs(fract(ph * 7.639) - .5) * 2.;
  col = mix(col, vec3(.5, .25, .26), step(zz, d.z));                         // pars plana, zigzag ora serrata
  vec3 L = normalize(uPlayer - vW);
  vec3 key = normalize(vec3(.35, .7, .6));
  col *= (.72 + .2 * abs(dot(N, L)) + .22 * dot(N, key)) * (.94 + .1 * k);    // fold shading: each triangle faces its own way
  float lp = length(vW - uPlayer); col *= .6 + .85 / (1. + lp * lp / 500.);
  float dist = length(vW - cameraPosition); float f = 1. - exp(-pow(dist * uDen, 2.));
  gl_FragColor = vec4(mix(col, uFog, f * .82), 1.);
  #include <colorspace_fragment>
}`;

// paper tone per facet, from the object-space face normal (stable as the camera moves)
function paperize(mat) {
  if (mat.userData.paper) return mat;
  mat.flatShading = true; if ('roughness' in mat) mat.roughness = Math.max(mat.roughness ?? .8, .8); if ('metalness' in mat) mat.metalness = 0;
  if ('clearcoat' in mat) mat.clearcoat = 0;
  mat.onBeforeCompile = sh => {
    sh.vertexShader = 'varying vec3 vOP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vOP = position;');
    sh.fragmentShader = 'varying vec3 vOP;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  { vec3 fn = normalize(cross(dFdx(vOP), dFdy(vOP)));
    diffuseColor.rgb *= .93 + .12 * fract(sin(dot(floor(fn * 9.), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }`);
  };
  mat.customProgramCacheKey = () => 'paper';
  mat.userData.paper = true; mat.needsUpdate = true; return mat;
}

// fewer facets: rebuild the geometry from its parameters when that reproduces it exactly
function fewerFacets(g) {
  const p = g.parameters; if (!p || g.userData.keep) return null;   // keep: shaped after it was made (tapered vessels)
  const T = g.type, d = n => Math.max(4, Math.round(n / 3));
  try {
    let n = null;
    if (T === 'TubeGeometry') n = new THREE.TubeGeometry(p.path, Math.max(6, Math.round(p.tubularSegments / 2)), p.radius, 4, p.closed);
    else if (T === 'SphereGeometry') n = new THREE.SphereGeometry(p.radius, Math.max(6, d(p.widthSegments)), Math.max(4, d(p.heightSegments)), p.phiStart, p.phiLength, p.thetaStart, p.thetaLength);
    else if (T === 'TorusGeometry') n = new THREE.TorusGeometry(p.radius, p.tube, 4, Math.max(8, d(p.tubularSegments)), p.arc);
    else if (T === 'LatheGeometry') n = new THREE.LatheGeometry(p.points, Math.max(8, d(p.segments)), p.phiStart, p.phiLength);
    else if (T === 'CircleGeometry') n = new THREE.CircleGeometry(p.radius, Math.max(6, d(p.segments)), p.thetaStart, p.thetaLength);
    else if (T === 'RingGeometry') n = new THREE.RingGeometry(p.innerRadius, p.outerRadius, Math.max(8, d(p.thetaSegments)), p.phiSegments);
    if (!n) return null;
    // geometry that was moved or turned after it was made (no record of that in .parameters): keep the original
    g.computeBoundingBox(); n.computeBoundingBox();
    const a = g.boundingBox, b = n.boundingBox, s = a.getSize(new THREE.Vector3()).length() || 1;
    if (a.min.distanceTo(b.min) > s * .03 || a.max.distanceTo(b.max) > s * .03) { n.dispose(); return null; }
    return n;
  } catch (e) { return null; }
}

// accordion-pleated paper iris, same size and place as the painted ring it replaces
function pleatedIris(inner, outer, amp) {
  const pos = [], col = [], NP = 48, rings = [inner, inner + (outer - inner) * .22, inner + (outer - inner) * .6, outer];
  const P = (ri, j) => { const a = j / NP * Math.PI * 2, r = rings[ri], f = ri === 0 || ri === 3 ? 0 : (j % 2 ? amp : -amp * .7) * (ri === 1 ? .6 : 1);
    return [r * Math.cos(a), r * Math.sin(a), f]; };
  const C = [new THREE.Color(0x4a2a16), new THREE.Color(0x8a5a34), new THREE.Color(0x7a4c2a)];
  let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let ri = 0; ri < 3; ri++) for (let j = 0; j < NP; j++) {
    const q = [P(ri, j), P(ri + 1, j), P(ri + 1, j + 1), P(ri, j + 1)], c = C[ri].clone().multiplyScalar(.9 + .18 * rnd());
    for (const t of [[0, 1, 2], [0, 2, 3]]) for (const i of t) { pos.push(...q[i]); col.push(c.r, c.g, c.b); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85, side: THREE.DoubleSide }));
}

export function foldInside({ scene, wall, keep = [] }) {
  // 1. retina wall: same sphere, far fewer panels, paper shader
  if (wall) {
    const p = wall.geometry.parameters;
    wall.geometry.dispose();
    // crumple: every shared corner is pushed in or out a little, so each triangle is a real fold that catches light
    const g = new THREE.SphereGeometry(p.radius, 40, 24, 0, Math.PI * 2, p.thetaStart, p.thetaLength).rotateX(Math.PI / 2);
    const P = g.attributes.position, v = new THREE.Vector3(), hash = (x, y, z) => { const t = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return t - Math.floor(t); };
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); const h = hash(Math.round(v.x * 10) / 10, Math.round(v.y * 10) / 10, Math.round(v.z * 10) / 10);
      v.multiplyScalar(1 + (h - .5) * .018); P.setXYZ(i, v.x, v.y, v.z); }
    const ng = g.toNonIndexed(); g.dispose();
    const tone = new Float32Array(ng.attributes.position.count); for (let i = 0; i < tone.length; i += 3) tone[i] = tone[i + 1] = tone[i + 2] = Math.random();
    ng.setAttribute('aTone', new THREE.BufferAttribute(tone, 1));
    wall.geometry = ng;
    const m = wall.material;
    wall.material = new THREE.ShaderMaterial({ uniforms: m.uniforms, vertexShader: wallVS, fragmentShader: wallFS, side: THREE.BackSide });
    m.dispose();
  }
  // 2. everything else that is lit
  const skip = new Set(); keep.forEach(k => k && k.traverse(o => skip.add(o)));
  const todo = []; scene.traverse(o => { if (o.isMesh && !skip.has(o) && o !== wall) todo.push(o); });
  let folded = 0, iris = 0;
  for (const o of todo) {
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.every(m => m && (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial))) continue;
    // painted iris ring -> pleated paper fan
    if (o.geometry.type === 'RingGeometry' && mats[0].map && o.geometry.parameters.outerRadius > 10) {
      const gp = o.geometry.parameters, f = pleatedIris(gp.innerRadius, gp.outerRadius, .55);
      f.position.copy(o.position); f.rotation.copy(o.rotation); f.position.z += .08; o.parent.add(f); o.visible = false; iris++; continue;
    }
    const n = fewerFacets(o.geometry); if (n) { o.geometry.dispose(); o.geometry = n; }
    mats.forEach(m => { if (m.map && o.geometry.type !== 'TorusGeometry') { m.map = null; } paperize(m); });
    folded++;
  }
  return { folded, iris };
}
