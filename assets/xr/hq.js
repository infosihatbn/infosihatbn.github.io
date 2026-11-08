// MataUniverse high quality mode (Haziq, 2026-11-08: "Unreal Engine 5 vibes, more detailed, higher quality, high poly").
// Filmic (ACES) tone mapping, image-based lighting, bloom, a soft lens finish (vignette, grain, slight chromatic fringe),
// and every simple shape rebuilt with more segments. On by default on computers and tablets with a real GPU;
// ?hq=0 / ?hq=1 or the game setting turns it off / on (remembered in localStorage mu-hq).
import * as THREE from '/assets/three/three.module.min.js';

export function wantHQ(renderer) {
  let v = null;
  try { const q = new URLSearchParams(location.search).get('hq'); if (q === '0' || q === '1') localStorage.setItem('mu-hq', q); v = localStorage.getItem('mu-hq'); } catch (e) { }
  if (v === '0') return false; if (v === '1') return true;
  try { const gl = renderer.getContext(), x = gl.getExtension('WEBGL_debug_renderer_info'), r = x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : '';
    if (/swiftshader|llvmpipe|software|basic render/i.test(r)) return false; } catch (e) { }
  return Math.min(screen.width, screen.height) >= 600;   // phones keep the light version
}

const LensShader = {
  uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uT; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec2 c=vUv-.5; float r=dot(c,c);
      vec2 o=c*r*.012;                                              // a hint of chromatic fringe towards the edges
      vec3 col=vec3(texture2D(tDiffuse,vUv+o).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv-o).b);
      col*=1.-smoothstep(.18,.62,r)*.38;                            // soft vignette
      col+=(h(vUv*uRes+fract(uT)*91.)-.5)*.018;                     // fine film grain
      gl_FragColor=vec4(col,1.); }`
};

export async function setupHQ(renderer, camera, v = '') {
  const q = '?v=' + v;
  const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { ShaderPass }, { RoomEnvironment }] = await Promise.all([
    import('./pp/EffectComposer.js' + q), import('./pp/RenderPass.js' + q), import('./pp/UnrealBloomPass.js' + q), import('./pp/OutputPass.js' + q), import('./pp/ShaderPass.js' + q), import('./pp/RoomEnvironment.js' + q)]);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  const rp = new RenderPass(null, camera); composer.addPass(rp);
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), .38, .5, .93); composer.addPass(bloom);
  const lens = new ShaderPass(LensShader); composer.addPass(lens);
  composer.addPass(new OutputPass());
  const pm = new THREE.PMREMGenerator(renderer), env = pm.fromScene(new RoomEnvironment(renderer), .04).texture; pm.dispose();
  let t = 0;
  return {
    env,
    render(scene, dt = .016) { rp.scene = scene; t += dt; lens.uniforms.uT.value = t; composer.render(dt); },
    setSize(w, h) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); lens.uniforms.uRes.value.set(w, h); },
    bloom,
  };
}

// More segments for the simple shapes, only where a shape was never bent after it was made (checked vertex by vertex),
// and smooth shading. Objects marked userData.noHQ (the origami Mata) are left as they are.
const MORE = {
  SphereGeometry: p => [p.radius, Math.min(160, p.widthSegments * 2), Math.min(120, p.heightSegments * 2), p.phiStart, p.phiLength, p.thetaStart, p.thetaLength],
  TorusGeometry: p => [p.radius, p.tube, Math.min(48, Math.max(16, p.radialSegments * 2)), Math.min(256, p.tubularSegments * 2), p.arc],
  CylinderGeometry: p => [p.radiusTop, p.radiusBottom, p.height, Math.max(32, p.radialSegments * 3), p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength],
  ConeGeometry: p => [p.radius, p.height, Math.max(32, p.radialSegments * 3), p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength],
  RingGeometry: p => [p.innerRadius, p.outerRadius, Math.min(192, p.thetaSegments * 2), p.phiSegments, p.thetaStart, p.thetaLength],
  CircleGeometry: p => [p.radius, Math.min(96, p.segments * 2), p.thetaStart, p.thetaLength],
  LatheGeometry: p => [p.points, Math.min(192, p.segments * 2), p.phiStart, p.phiLength],
  TubeGeometry: p => [p.path, Math.min(256, p.tubularSegments * 2), p.radius, Math.max(12, p.radialSegments * 2), p.closed],
};
const SAME = {
  SphereGeometry: p => [p.radius, p.widthSegments, p.heightSegments, p.phiStart, p.phiLength, p.thetaStart, p.thetaLength],
  TorusGeometry: p => [p.radius, p.tube, p.radialSegments, p.tubularSegments, p.arc],
  CylinderGeometry: p => [p.radiusTop, p.radiusBottom, p.height, p.radialSegments, p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength],
  ConeGeometry: p => [p.radius, p.height, p.radialSegments, p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength],
  RingGeometry: p => [p.innerRadius, p.outerRadius, p.thetaSegments, p.phiSegments, p.thetaStart, p.thetaLength],
  CircleGeometry: p => [p.radius, p.segments, p.thetaStart, p.thetaLength],
  LatheGeometry: p => [p.points, p.segments, p.phiStart, p.phiLength],
  TubeGeometry: p => [p.path, p.tubularSegments, p.radius, p.radialSegments, p.closed],
};
export function upgradeScene(root, { env = null, envI = .6 } = {}) {
  const geo = new Map(), mats = new Set(); let n = 0;
  const visit = o => {
    if (o.userData && o.userData.noHQ) return;
    if (o.isMesh && !o.isInstancedMesh) {
      const g = o.geometry, T = g && g.type;
      if (MORE[T] && !(g.userData && g.userData.keep)) {
        if (!geo.has(g)) {
          let out = g;
          try { const ref = new THREE[T](...SAME[T](g.parameters)), a = ref.attributes.position.array, b = g.attributes.position.array;
            let same = a.length === b.length; for (let i = 0; same && i < a.length; i += 7) if (Math.abs(a[i] - b[i]) > 1e-4) same = false;
            ref.dispose(); if (same) { out = new THREE[T](...MORE[T](g.parameters)); n++; } } catch (e) { }
          geo.set(g, out);
        }
        o.geometry = geo.get(g);
      }
      for (const m of [].concat(o.material)) if (m && m.isMeshStandardMaterial && !mats.has(m)) { mats.add(m);
        if (m.flatShading) { m.flatShading = false; }
        if (env && !m.envMap) { m.envMap = env; m.envMapIntensity = envI; }
        m.needsUpdate = true; }
    }
    for (const c of o.children) visit(c);
  };
  visit(root);
  return n;
}
