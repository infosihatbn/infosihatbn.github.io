// MataUniverse: shrink down with Mata and float through the vitreous to the retina.
// World units: the eye's inner radius is 60 (a real eye is about 24 mm across, so this is hugely enlarged).
// Front of the eye is +Z, nasal side is -X (left eye), matching eyemodel.js.
import * as THREE from '/assets/three/three.module.min.js';
import { createMata } from './mata3d.js';
import { createEye, DISC_DIR } from './eyemodel.js';

const R = 60, IRIS_Z = 52, PUPIL = 7.5, LENS_Z = 42, LENS_R = 19, LENS_T = 7, CORNEA_C = 30, CORNEA_R = 38; // the front: iris plane, lens, corneal dome
const BACK = ['vitreous', 'floaters', 'retina', 'vessels', 'macula', 'fovea', 'disc', 'nerve'];
const FRONTK = ['lens', 'ciliary', 'iris', 'aqueous', 'cornea', 'angle'];
const KEYS = BACK.concat(FRONTK);
const BADGES = [['first', null], ['vit', ['vitreous', 'floaters']], ['ret', ['retina', 'vessels']], ['mac', ['macula', 'fovea']], ['nerve', ['disc', 'nerve']], ['front', FRONTK], ['flow', ['aqueous', 'angle']], ['light', null], ['all', KEYS]];
const LS = { get(k) { try { return JSON.parse(localStorage.getItem(k)) } catch (e) { return null } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) { } } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const onWall = (x, y, r = R) => new THREE.Vector3(x, y, -1).normalize().multiplyScalar(r); // tangent coords around the back pole
const DX = DISC_DIR.x / -DISC_DIR.z; // disc position in tangent coords (about -0.38)

function softDot() { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }

// ---------------- retina wall shader ----------------
const wallVS = `varying vec3 vW; varying vec3 vD; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW=w.xyz; vD=normalize(position); gl_Position=projectionMatrix*viewMatrix*w; }`;
const wallFS = `
uniform vec3 uDisc; uniform vec3 uFog; uniform float uDen; uniform vec3 uPlayer; uniform float uT;
varying vec3 vW; varying vec3 vD;
float h(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453); }
float n3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
void main(){
  vec3 d = normalize(vD);
  float back = dot(d, vec3(0.,0.,-1.));
  float nz = n3(d*14.)*.6 + n3(d*31.)*.4;
  vec3 col = mix(vec3(.62,.25,.18), vec3(.86,.42,.28), nz);           // fundus orange-red with a choroidal pattern
  col = mix(vec3(.38,.15,.13), col, smoothstep(-.35,.25,back));       // darker towards the periphery
  float a = acos(clamp(back,-1.,1.));
  col = mix(col, vec3(.50,.20,.14), smoothstep(.24,.06,a));            // macula
  col = mix(col, vec3(.33,.11,.08), smoothstep(.05,.0,a));             // fovea
  col += vec3(.9,.85,.7)*smoothstep(.008,.0,a)*.8;                     // foveal light reflex
  float ad = acos(clamp(dot(d,uDisc),-1.,1.));
  col = mix(col, vec3(.98,.80,.58), smoothstep(.085,.065,ad));         // optic disc
  col = mix(col, vec3(1.,.95,.86), smoothstep(.04,.028,ad));          // cup
  float fz = d.z;
  col = mix(col, vec3(.24,.11,.12), smoothstep(.5,.68,fz));           // pars plana and ciliary body: dark and pigmented
  float lp = length(vW-uPlayer); col *= .55 + .9/(1.+lp*lp/500.);      // Mata's glow lights up nearby retina
  float dist = length(vW-cameraPosition); float f = 1.-exp(-pow(dist*uDen,2.));
  gl_FragColor = vec4(mix(col, uFog, f*.82), 1.);
  #include <colorspace_fragment>
}`;
const beamFS = `uniform float uT; uniform vec3 uCol; varying vec2 vUv; void main(){ float a = (1.-vUv.y)*.9+.1; a *= .07+.03*sin(uT*.7+vUv.x*12.); gl_FragColor=vec4(uCol*a, a); }`;
const beamVS = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const partVS = `uniform float uT; uniform float uS; attribute float aR; varying float vA;
void main(){ vec3 p = position; p.x += sin(uT*.15+aR*20.)*1.4; p.y += cos(uT*.12+aR*13.)*1.2; p.z += sin(uT*.1+aR*7.)*1.0;
 vec4 mv = modelViewMatrix*vec4(p,1.); gl_PointSize = uS*(.6+aR)*(300./-mv.z); vA = clamp(1.-(-mv.z)/90.,0.,1.)*(.35+.65*aR); gl_Position = projectionMatrix*mv; }`;
const partFS = `uniform sampler2D uTex; varying float vA; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vec3(.85,.92,1.)*t.a*vA, t.a*vA); }`;

export function mount(el, D) {
  const U = D.ui, M = D.marks;
  const touch = matchMedia('(pointer:coarse)').matches;
  const saved = LS.get('mu-settings') || {};
  const S = { sens: saved.sens ?? 1, reduced: saved.reduced ?? matchMedia('(prefers-reduced-motion: reduce)').matches, assisted: saved.assisted ?? true, tilt: false };
  const prog = Object.assign({ found: [], badges: [] }, LS.get('mu-progress') || {});
  const found = new Set(prog.found.filter(k => KEYS.includes(k))), badges = new Set(prog.badges);
  const save = () => LS.set('mu-progress', { found: [...found], badges: [...badges] });
  const saveS = () => LS.set('mu-settings', { sens: S.sens, reduced: S.reduced, assisted: S.assisted });
  const intro = el.querySelector('.xi-intro');

  // ---------------- DOM ----------------
  const stage = document.createElement('div'); stage.className = 'xr-stage mu'; stage.tabIndex = 0; stage.setAttribute('aria-label', U.title);
  stage.innerHTML = `
  <div class="xr-canvas"></div><div class="mu-vig" aria-hidden="true"></div><div class="mu-flash" aria-hidden="true"></div>
  <div class="xr-labels" aria-hidden="true"></div>
  <div class="mu-top">
    <button type="button" class="mu-prog" data-act="journal" aria-label="${U.journal}"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" class="t"/><circle cx="18" cy="18" r="15" class="f"/></svg><b></b><span>${U.journal}</span></button>
    <div class="mu-tools">
      <button type="button" class="mu-ic mu-lj" data-act="light" title="${U.light}">✨ <span>${U.light}</span></button>
      <button type="button" class="mu-ic" data-act="settings" title="${U.settings}">⚙️</button>
      <button type="button" class="mu-ic" data-act="pause" title="${U.pause}" aria-label="${U.pause}">❚❚</button>
      <button type="button" class="mu-ic" data-act="full" title="${U.full}">⛶</button>
    </div>
  </div>
  <div class="xr-bubble mu-say" role="status" aria-live="polite"></div>
  <div class="mu-toast" aria-live="polite"></div>
  <div class="mu-near" hidden><span></span><button type="button" class="xbtn pri" data-act="inspect">${U.inspect} (E)</button></div>
  <button type="button" class="mu-guide xbtn" data-act="guide">🧭 ${U.guide}</button>
  <div class="mu-pad" ${touch ? '' : 'hidden'}><div class="mu-joy"><i></i></div></div>
  <div class="mu-ud" ${touch ? '' : 'hidden'}><button type="button" data-ud="1" aria-label="${U.up}">▲</button><button type="button" data-ud="-1" aria-label="${U.down}">▼</button></div>
  <p class="mu-help">${touch ? U.touch : U.keys}</p>
  <aside class="xr-info mu-panel" hidden aria-live="polite"></aside>
  <div class="xr-lj mu-ljbar" hidden><p class="xr-ljt"></p><div class="xr-ljb"><button type="button" data-act="ljskip">${U.skip}</button><span class="xr-dots"></span><button type="button" class="pri" data-act="ljnext">›</button></div></div>
  <div class="mu-cine" hidden><button type="button" class="xbtn" data-act="skipintro">${U.skip} ›</button></div>
  <div class="mu-over mu-pause" hidden><div><h3>${U.paused}</h3><p class="mu-matane">${U.matane}</p>
    <button type="button" class="xbtn pri" data-act="resume">▶ ${U.resume}</button><button type="button" class="xbtn" data-act="journal">📖 ${U.journal}</button><button type="button" class="xbtn" data-act="settings">⚙️ ${U.settings}</button><button type="button" class="xbtn" data-act="restart">↺ ${U.restart}</button>
    <p class="mu-links"><a href="${D.hub}">← ${U.hub}</a> · <a href="${D.other}">${U.other}</a></p></div></div>
  <div class="mu-over mu-journal" hidden><div><button type="button" class="xr-x" data-act="closeover">✕</button><h3>📖 ${U.journal}</h3><div class="mu-jl"></div><h4>🏅 ${U.badges}</h4><div class="mu-bl"></div></div></div>
  <div class="mu-over mu-settings" hidden><div><button type="button" class="xr-x" data-act="closeover">✕</button><h3>⚙️ ${U.settings}</h3>
    <label>${U.sens} <input type="range" min=".3" max="2" step=".1" data-set="sens"></label>
    <label><input type="checkbox" data-set="reduced"> ${U.reduced}</label>
    <label><input type="checkbox" data-set="assisted"> ${U.assisted}</label>
    <label class="mu-tiltrow" hidden><input type="checkbox" data-set="tilt"> ${U.tilt}</label>
    <button type="button" class="xbtn" data-act="resetprog">${U.reset}</button></div></div>`;
  el.appendChild(stage);
  const $ = s => stage.querySelector(s);
  const sayEl = $('.mu-say'), toastEl = $('.mu-toast'), panel = $('.mu-panel'), labelsEl = $('.xr-labels'), nearEl = $('.mu-near');
  let sayT = 0, toastT = 0;
  const say = (t, ms = 4000) => { sayEl.textContent = t; sayEl.classList.add('on'); clearTimeout(sayT); sayT = setTimeout(() => sayEl.classList.remove('on'), ms); };
  const toast = (t, ms = 2600) => { toastEl.innerHTML = t; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), ms); };

  // ---------------- renderer ----------------
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: !touch, powerPreference: 'high-performance' }); } catch (e) { const l = el.querySelector('.xr-load'); l.hidden = false; l.textContent = U.nogl; stage.remove(); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, touch ? 1.5 : 1.75)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  $('.xr-canvas').appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(62, 1, .1, 400);
  const dot = softDot();

  // ======== INTRO SCENE (World 1: Enter the Eye) ========
  const introS = new THREE.Scene(); introS.background = new THREE.Color(0x060a20);
  introS.add(new THREE.HemisphereLight(0xcfe6ff, 0x1a1030, 1.1)); { const l = new THREE.DirectionalLight(0xffffff, 2); l.position.set(3, 4, 8); introS.add(l); }
  const bigEye = createEye(); bigEye.group.scale.setScalar(8); bigEye.group.position.set(0, 0, -30); introS.add(bigEye.group);
  { const sg = new THREE.BufferGeometry(), sp = []; for (let i = 0; i < 900; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(120 + Math.random() * 80); sp.push(v.x, v.y, v.z); }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); introS.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.4, map: dot, color: 0xcfe9ff, transparent: true, depthWrite: false }))); }
  const introMata = createMata(); introMata.object.scale.setScalar(1.6); introS.add(introMata.object);

  // ======== SEA SCENE (Worlds 2 and 3) ========
  const scene = new THREE.Scene(); const FOG = new THREE.Color(0x2b2c6e); scene.background = FOG; scene.fog = new THREE.FogExp2(FOG, .0105);
  scene.add(new THREE.HemisphereLight(0xb9c8ff, 0x3a1a2a, .9));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.2); sun.position.set(0, 0, 1); scene.add(sun);
  const player = new THREE.Vector3(0, 0, 22);
  const wallU = { uDisc: { value: DISC_DIR.clone() }, uFog: { value: FOG.clone() }, uDen: { value: .0105 }, uPlayer: { value: player }, uT: { value: 0 } };
  const wall = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64, 0, Math.PI * 2, Math.acos(IRIS_Z / R), Math.PI - Math.acos(IRIS_Z / R)).rotateX(Math.PI / 2), new THREE.ShaderMaterial({ uniforms: wallU, vertexShader: wallVS, fragmentShader: wallFS, side: THREE.BackSide }));
  scene.add(wall);
  // retinal vessels: arcades from the disc, curving around the macula, with smaller branches
  const vessels = new THREE.Group(); scene.add(vessels);
  const vmat = [new THREE.MeshStandardMaterial({ color: 0xd3483a, roughness: .45, emissive: 0x3a0a06 }), new THREE.MeshStandardMaterial({ color: 0x7c1d18, roughness: .45, emissive: 0x200303 })];
  const vesselCurves = [];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const addVessel = (pts2, rad, kind, keep) => {
    const pts = pts2.map(([x, y]) => onWall(x, y, R - .35 - kind * .12));
    const c = new THREE.CatmullRomCurve3(pts); if (keep) vesselCurves.push(c);
    vessels.add(new THREE.Mesh(new THREE.TubeGeometry(c, Math.max(8, pts.length * 6), rad, 6, false), vmat[kind]));
    return c;
  };
  const arcades = [
    [[DX, .03], [DX + .12, .22], [-.06, .36], [.22, .38], [.5, .3], [.85, .2], [1.2, .12]],
    [[DX, -.03], [DX + .12, -.22], [-.06, -.35], [.22, -.4], [.5, -.33], [.85, -.22], [1.2, -.14]],
    [[DX, .04], [DX - .18, .25], [DX - .45, .42], [DX - .8, .55]],
    [[DX, -.04], [DX - .18, -.27], [DX - .45, -.45], [DX - .8, -.6]],
  ];
  arcades.forEach((a, i) => { for (const k of [0, 1]) addVessel(a.map(([x, y]) => [x + (k ? .015 : -.015), y + (k ? .02 : 0)]), k ? .42 : .34, k, i < 2 && k === 0); });
  // side branches (avoiding the fovea)
  for (const a of arcades) {
    const c = new THREE.SplineCurve(a.map(([x, y]) => new THREE.Vector2(x, y)));
    for (let i = 0; i < 7; i++) {
      const t = .15 + rnd() * .8, p = c.getPoint(t), tan = c.getTangent(t);
      const out = new THREE.Vector2(-tan.y, tan.x); if (out.dot(p) < 0) out.negate(); // mostly away from the macula
      const toward = rnd() < .3; if (toward) out.negate();
      const pts = [[p.x, p.y]]; let q = p.clone(), dir = out.clone().add(tan.clone().multiplyScalar(.6)).normalize();
      for (let s = 0; s < 5; s++) { dir.rotateAround(new THREE.Vector2(), (rnd() - .5) * .5); q = q.clone().add(dir.clone().multiplyScalar(.07 + rnd() * .05)); if (q.length() < .16) break; pts.push([q.x, q.y]); }
      if (pts.length > 2) addVessel(pts, .16 + rnd() * .08, rnd() < .5 ? 0 : 1);
    }
  }
  // nerve fibre layer: faint lines flowing into the disc, with travelling signals
  const fibres = new THREE.Group(); scene.add(fibres); const fibreCurves = [];
  for (let i = 0; i < 26; i++) {
    const ang = i / 26 * Math.PI * 2, r0 = .55 + rnd() * .5;
    const start = [Math.cos(ang) * r0 + .1, Math.sin(ang) * r0 * .9];
    const mid = [(start[0] + DX) / 2 + (Math.abs(start[1]) < .3 && start[0] > 0 ? 0 : 0), start[1] * .45 + Math.sign(start[1] || 1) * (start[0] > 0 ? .3 : 0)];
    const pts = [start, mid, [DX + .02 * Math.cos(ang), .02 * Math.sin(ang)]].map(([x, y]) => onWall(x, y, R - .6));
    const cv = new THREE.CatmullRomCurve3(pts); fibreCurves.push(cv);
    fibres.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(cv.getPoints(40)), new THREE.LineBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: .16 })));
  }
  const signals = []; for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0x9fe7ff, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); s.scale.setScalar(1.1); s.userData = { c: fibreCurves[i * 2 % fibreCurves.length], o: rnd() }; s.visible = false; scene.add(s); signals.push(s); }
  // optic disc: raised rim and a cup you can look into
  const discC = DISC_DIR.clone().multiplyScalar(R - .2);
  const discG = new THREE.Group(); discG.position.copy(discC); discG.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), DISC_DIR.clone().negate()); scene.add(discG);
  { const rim = new THREE.Mesh(new THREE.TorusGeometry(3.6, .55, 10, 40), new THREE.MeshStandardMaterial({ color: 0xf2b88c, roughness: .7 })); discG.add(rim);
    const cup = new THREE.Mesh(new THREE.SphereGeometry(2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xfff1d8, roughness: .8, side: THREE.BackSide })); cup.rotation.x = Math.PI / 2; cup.position.z = .3; discG.add(cup); }
  // fovea: a shallow pit in the macula
  { const prof = []; for (let i = 0; i <= 16; i++) { const r = i / 16 * 3.2; prof.push(new THREE.Vector2(r, -.9 * Math.exp(-r * r / 1.6))); }
    const pit = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), new THREE.MeshStandardMaterial({ color: 0x5a1c14, roughness: .6, side: THREE.DoubleSide }));
    pit.rotation.x = -Math.PI / 2; pit.position.set(0, 0, -R + .25); scene.add(pit); }
  // ======== THE FRONT OF THE EYE: lens, ciliary body, iris, anterior chamber, cornea, drainage angle ========
  const front = new THREE.Group(); scene.add(front);
  const lens = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.MeshPhysicalMaterial({ color: 0xfff4d6, transparent: true, opacity: .34, roughness: .1, emissive: 0x332a10, depthWrite: false, side: THREE.DoubleSide }));
  lens.scale.set(LENS_R, LENS_R, LENS_T); lens.position.z = LENS_Z; front.add(lens);
  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshStandardMaterial({ color: 0xf3d58a, transparent: true, opacity: .22, depthWrite: false }));
  nucleus.scale.set(11, 11, 4); nucleus.position.z = LENS_Z; front.add(nucleus);
  // ciliary processes (a ring of folds behind the iris) and the zonules that hang the lens from them
  const NCP = 72, cpZ = 46, cpR = Math.sqrt(R * R - cpZ * cpZ) - 2.2;
  { const cp = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: 0x8a3d2c, roughness: .8 }), NCP), o3 = new THREE.Object3D(), zp = [];
    for (let i = 0; i < NCP; i++) { const a = i / NCP * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      o3.position.set(c * cpR, sn * cpR, cpZ); o3.rotation.set(0, 0, a); o3.scale.set(2.4, .9, 3.6); o3.updateMatrix(); cp.setMatrixAt(i, o3.matrix);
      for (const dz of [-2.5, 2.5]) zp.push(c * (LENS_R - .3), sn * (LENS_R - .3), LENS_Z + dz * .4, c * (cpR - 2), sn * (cpR - 2), cpZ + dz); }
    front.add(cp); const zg = new THREE.BufferGeometry(); zg.setAttribute('position', new THREE.Float32BufferAttribute(zp, 3));
    front.add(new THREE.LineSegments(zg, new THREE.LineBasicMaterial({ color: 0xf2e6c8, transparent: true, opacity: .55 }))); }
  // iris: textured front (fibres, collarette, crypts), dark pigmented back, pupil ruff
  const irisTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'), m = 256;
    const gr = g.createRadialGradient(m, m, 30, m, m, 256); gr.addColorStop(0, '#2a160c'); gr.addColorStop(.25, '#6b4021'); gr.addColorStop(.55, '#8a5a2e'); gr.addColorStop(.9, '#5a3519'); gr.addColorStop(1, '#3a2010'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 260; i++) { const a = rnd() * Math.PI * 2, r0 = 62 + rnd() * 30, r1 = 150 + rnd() * 100; g.strokeStyle = `rgba(${200 + rnd() * 55 | 0},${150 + rnd() * 60 | 0},${90 + rnd() * 40 | 0},${.12 + rnd() * .2})`; g.lineWidth = 1 + rnd() * 2.5;
      g.beginPath(); g.moveTo(m + Math.cos(a) * r0, m + Math.sin(a) * r0); g.quadraticCurveTo(m + Math.cos(a + .08) * (r0 + r1) / 2, m + Math.sin(a + .08) * (r0 + r1) / 2, m + Math.cos(a) * r1, m + Math.sin(a) * r1); g.stroke(); }
    g.strokeStyle = 'rgba(40,20,10,.5)'; g.lineWidth = 6; g.beginPath(); g.arc(m, m, 100, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 40; i++) { const a = rnd() * Math.PI * 2, r = 105 + rnd() * 120; g.fillStyle = 'rgba(25,12,6,.45)'; g.beginPath(); g.ellipse(m + Math.cos(a) * r, m + Math.sin(a) * r, 4 + rnd() * 8, 2 + rnd() * 4, a, 0, Math.PI * 2); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const irisF = new THREE.Mesh(new THREE.RingGeometry(PUPIL, 31, 72, 2), new THREE.MeshStandardMaterial({ map: irisTex, roughness: .85 })); irisF.position.z = IRIS_Z; front.add(irisF);
  const irisB = new THREE.Mesh(new THREE.RingGeometry(PUPIL, 31, 72, 1), new THREE.MeshStandardMaterial({ color: 0x3a1f14, roughness: .9 })); irisB.rotation.y = Math.PI; irisB.position.z = IRIS_Z - .05; front.add(irisB);
  { const ruff = new THREE.Mesh(new THREE.TorusGeometry(PUPIL, .35, 8, 64), new THREE.MeshStandardMaterial({ color: 0x1c0d07, roughness: .9 })); ruff.position.z = IRIS_Z; front.add(ruff); }
  // cornea: a clear dome; its inner lining (endothelium) is a honeycomb of cells
  const hexTex = (() => { const sz = 16, hh = sz * Math.sqrt(3), c = document.createElement('canvas'); c.width = 240; c.height = Math.round(hh * 9); const g = c.getContext('2d');
    g.strokeStyle = 'rgba(215,238,255,.32)'; g.lineWidth = 1.5;
    for (let col = -1; col <= 10; col++) for (let row = -1; row <= 9; row++) { const cx = col * sz * 1.5, cy = row * hh + (col & 1) * hh / 2; g.beginPath(); for (let k = 0; k <= 6; k++) g.lineTo(cx + sz * Math.cos(k * Math.PI / 3), cy + sz * Math.sin(k * Math.PI / 3)); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(22, 5); return t; })();
  const corneaG = new THREE.SphereGeometry(CORNEA_R, 72, 24, 0, Math.PI * 2, 0, Math.acos((IRIS_Z - CORNEA_C) / CORNEA_R)).rotateX(Math.PI / 2).translate(0, 0, CORNEA_C);
  front.add(new THREE.Mesh(corneaG, new THREE.MeshStandardMaterial({ color: 0xcfeaff, map: hexTex, transparent: true, opacity: .5, roughness: .15, side: THREE.DoubleSide, depthWrite: false, emissive: 0x0b1a2a })));
  // the white sclera just beyond the edge of the cornea (limbus)
  front.add(new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(29.6, 51.6), new THREE.Vector2(32.4, 52.4), new THREE.Vector2(33.4, 54.5), new THREE.Vector2(32.6, 57)], 96).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xe6d6cc, roughness: .8, side: THREE.DoubleSide })));
  // drainage angle: trabecular meshwork (a sieve) with Schlemm's canal just outside it
  const ANG_R = 30.3, ANG_Z = 53;
  const tmTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#d9bd94'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#7a5a3a'; g.lineWidth = 3;
    for (let i = -64; i < 128; i += 12) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 40, 64); g.stroke(); g.beginPath(); g.moveTo(i + 40, 0); g.lineTo(i, 64); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(70, 2); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  { const tm = new THREE.Mesh(new THREE.TorusGeometry(ANG_R, 1.1, 10, 140), new THREE.MeshStandardMaterial({ map: tmTex, roughness: .9 })); tm.position.z = ANG_Z; tm.scale.z = 1.4; front.add(tm);
    const sc = new THREE.Mesh(new THREE.TorusGeometry(ANG_R + 1.6, .55, 8, 140), new THREE.MeshStandardMaterial({ color: 0xc8604f, emissive: 0x3a0e08, transparent: true, opacity: .8, roughness: .4 })); sc.position.z = ANG_Z + .9; front.add(sc); }
  // aqueous humour: made by the ciliary processes, through the pupil, round the anterior chamber, out at the angle
  const aqCurves = [];
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2 + rnd() * .2, b = a + (rnd() - .5) * 1.4;
    const P = (r, z, f) => { const an = a + (b - a) * f; return new THREE.Vector3(Math.cos(an) * r, Math.sin(an) * r, z); };
    aqCurves.push(new THREE.CatmullRomCurve3([P(cpR - 2.5, cpZ + 1, 0), P(14, 50.2, 0), P(PUPIL - 2, 51.4, 0), P(4, 54.5, .1), P(10, 63, .4), P(21, 59, .8), P(ANG_R - 1.6, ANG_Z + .6, 1)])); }
  const NAQ = 90, aqPts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: .9, map: dot, color: 0xbff0ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  aqPts.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NAQ * 3), 3)); const aqO = Array.from({ length: NAQ }, () => [rnd(), (rnd() * 24) | 0]); front.add(aqPts);
  const NSC = 30, scPts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: .7, map: dot, color: 0xffb3a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scPts.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NSC * 3), 3)); front.add(scPts);
  const updAq = t => { const a = aqPts.geometry.attributes.position.array; aqO.forEach(([o, c], i) => { const p = aqCurves[c].getPointAt((t * .045 + o) % 1); a[i * 3] = p.x; a[i * 3 + 1] = p.y; a[i * 3 + 2] = p.z; }); aqPts.geometry.attributes.position.needsUpdate = true;
    const b = scPts.geometry.attributes.position.array; for (let i = 0; i < NSC; i++) { const an = i / NSC * Math.PI * 2 + t * .05; b[i * 3] = Math.cos(an) * (ANG_R + 1.6); b[i * 3 + 1] = Math.sin(an) * (ANG_R + 1.6); b[i * 3 + 2] = ANG_Z + .9; } scPts.geometry.attributes.position.needsUpdate = true; };
  const rideC = new THREE.CatmullRomCurve3([[0, 33, 45.5], [0, 22, 49.2], [0, 11, 50.4], [0, 3, 51], [0, 0, 54], [0, 6, 62], [0, -8, 63], [0, -19, 59], [0, -26.5, 54.6]].map(v => new THREE.Vector3(...v)));
  // the world outside, seen through the cornea (and as light through the pupil)
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(190, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, fog: false, depthWrite: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec3 vD; void main(){ float y = vD.y; vec3 c = mix(vec3(1.,.9,.76), vec3(.55,.78,1.), smoothstep(0.,.6,y)); c = mix(c, vec3(.42,.5,.62), smoothstep(0.,-.5,y)); gl_FragColor = vec4(c,1.);\n#include <colorspace_fragment>\n}' })));
  { const o = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0xfff1cf, transparent: true, opacity: .55, depthWrite: false, fog: false })); o.position.set(0, 0, 125); o.scale.setScalar(110); scene.add(o); }
  const beamU = { uT: { value: 0 }, uCol: { value: new THREE.Color(0xfff2c6) } };
  const beams = new THREE.Group(); scene.add(beams);
  for (const [tx, ty, w] of [[0, 0, 1], [9, 6, .6], [-8, -7, .6]]) {
    const from = new THREE.Vector3(-tx * .25, -ty * .25, 40), to = new THREE.Vector3(tx, ty, -R + 1.5);
    const len = from.distanceTo(to); const g = new THREE.ConeGeometry(6.5 * w, len, 24, 1, true); g.translate(0, -len / 2, 0); // apex at origin (retina), base towards the lens
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: beamU, vertexShader: beamVS, fragmentShader: beamFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.position.copy(to); m.lookAt(from); m.rotateX(-Math.PI / 2); beams.add(m);
  }
  // drifting particles (the vitreous is a clear gel; these are artistic depth cues)
  const NP = touch ? 520 : 900, pgeo = new THREE.BufferGeometry(), pp = [], pr = [];
  for (let i = 0; i < NP; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(Math.cbrt(Math.random()) * 54); pp.push(v.x, v.y, Math.min(v.z, 36)); pr.push(Math.random()); }
  pgeo.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); pgeo.setAttribute('aR', new THREE.Float32BufferAttribute(pr, 1));
  const partU = { uT: { value: 0 }, uS: { value: touch ? 1.6 : 1.3 }, uTex: { value: dot } };
  scene.add(new THREE.Points(pgeo, new THREE.ShaderMaterial({ uniforms: partU, vertexShader: partVS, fragmentShader: partFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  // collagen fibrils: very faint long strands
  const fib = new THREE.Group(); scene.add(fib);
  for (let i = 0; i < 34; i++) { const a = new THREE.Vector3().randomDirection().multiplyScalar(45), b = a.clone().negate().add(new THREE.Vector3().randomDirection().multiplyScalar(20)); const m = a.clone().lerp(b, .5).add(new THREE.Vector3().randomDirection().multiplyScalar(10));
    fib.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(a, m, b).getPoints(30)), new THREE.LineBasicMaterial({ color: 0xd9e2ff, transparent: true, opacity: .07 }))); }
  // floaters: semi-transparent clumps and strands
  const floaters = new THREE.Group(); floaters.position.set(15, 9, -6); scene.add(floaters);
  { const fm = new THREE.MeshStandardMaterial({ color: 0x8a90a8, transparent: true, opacity: .45, roughness: 1, depthWrite: false });
    for (let i = 0; i < 6; i++) { const pts = []; let p = new THREE.Vector3().randomDirection().multiplyScalar(4); for (let k = 0; k < 6; k++) { pts.push(p.clone()); p.add(new THREE.Vector3().randomDirection().multiplyScalar(1.6)); }
      floaters.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, .18 + Math.random() * .2, 6), fm)); }
    for (let i = 0; i < 8; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.4 + Math.random() * .7, 10, 8), fm); b.position.copy(new THREE.Vector3().randomDirection().multiplyScalar(4)); floaters.add(b); } }

  // Mata (player)
  const mata = createMata(); mata.object.scale.setScalar(.9); scene.add(mata.object);
  const lantern = new THREE.PointLight(0xcfe9ff, 40, 30, 1.6); scene.add(lantern);

  // ---------------- landmarks ----------------
  const supArc = vesselCurves[0];
  const LM = {
    vitreous: new THREE.Vector3(0, 2, 10),
    floaters: floaters.position.clone(),
    retina: new THREE.Vector3(.5, .62, -.6).normalize().multiplyScalar(R - 6),
    vessels: supArc.getPointAt(.55).clone().multiplyScalar((R - 4.5) / R),
    macula: new THREE.Vector3(0, 6, -R + 6),
    fovea: new THREE.Vector3(0, 0, -R + 3.2),
    disc: DISC_DIR.clone().multiplyScalar(R - 6).add(new THREE.Vector3(0, 4.5, 0)),
    nerve: DISC_DIR.clone().multiplyScalar(R - 3),
    lens: new THREE.Vector3(0, -3, 31.5),
    ciliary: new THREE.Vector3(0, 29, 41),
    iris: new THREE.Vector3(13, 9, 55.5),
    aqueous: new THREE.Vector3(-4, -5, 59),
    cornea: new THREE.Vector3(3, 5, 63.5),
    angle: new THREE.Vector3(0, -25.5, 54.4),
  };
  const markers = {}; const lab = {};
  for (const k of KEYS) {
    const g = new THREE.Group(); g.position.copy(LM[k]);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0x9fe7ff, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); s.scale.setScalar(4); g.add(s);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, .09, 8, 40), new THREE.MeshBasicMaterial({ color: 0x9fe7ff, transparent: true, opacity: .8, fog: false })); g.add(ring);
    g.userData = { k, s, ring }; scene.add(g); markers[k] = g;
    const d = document.createElement('button'); d.type = 'button'; d.className = 'xr-lab mu-lab'; d.dataset.mark = k; d.textContent = M[k].n; d.tabIndex = -1; labelsEl.appendChild(d); lab[k] = d;
  }
  const paintMarkers = () => KEYS.forEach(k => { const c = found.has(k) ? 0xffd34d : 0x9fe7ff; markers[k].userData.s.material.color.setHex(c); markers[k].userData.ring.material.color.setHex(c); lab[k].classList.toggle('got', found.has(k)); lab[k].textContent = (found.has(k) ? '✓ ' : '') + M[k].n; });

  // burst effect
  const burst = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: .6, map: dot, color: 0xffe08a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  { const a = new Float32Array(60 * 3); burst.geometry.setAttribute('position', new THREE.BufferAttribute(a, 3)); burst.visible = false; scene.add(burst); }
  const burstV = []; let burstT = 0;
  const doBurst = p => { const a = burst.geometry.attributes.position.array; burstV.length = 0; for (let i = 0; i < 60; i++) { a[i * 3] = p.x; a[i * 3 + 1] = p.y; a[i * 3 + 2] = p.z; burstV.push(new THREE.Vector3().randomDirection().multiplyScalar(6 + Math.random() * 6)); } burst.geometry.attributes.position.needsUpdate = true; burst.visible = true; burstT = 1.2; };

  // ---------------- game state ----------------
  let state = 'menu', yaw = Math.PI, pitch = 0, moved = 0, nearK = null, auto = null, follow = null, paused = false, full = false, lit = 0;
  const vel = new THREE.Vector3(), prevP = new THREE.Vector3(), camPos = new THREE.Vector3(0, 2, 28), camLook = new THREE.Vector3();
  const keys = new Set(); let joy = { x: 0, y: 0 }, ud = 0;

  const fwd = () => new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const progress = () => {
    const n = found.size, pct = Math.round(n / KEYS.length * 100);
    $('.mu-prog b').textContent = `${n}/${KEYS.length}`; $('.mu-prog .f').style.strokeDashoffset = String(94.2 * (1 - n / KEYS.length));
    $('.mu-prog').title = `${pct}% ${U.progress}`;
    const lj = $('.mu-lj'); const unlocked = n >= 3; lj.classList.toggle('locked', !unlocked); lj.title = unlocked ? U.light : U.lightlock;
    $('.mu-jl').innerHTML = `<p class="mu-pct"><b>${pct}%</b> ${U.progress}</p>` + [[U.back, BACK], [U.front, FRONTK]].map(([h, ks]) => `<h4>${esc(h)}</h4>` + ks.map(k => `<div class="mu-je ${found.has(k) ? 'got' : ''}"><b>${found.has(k) ? '✓' : '?'} ${esc(M[k].n)}</b>${found.has(k) ? `<p>${esc(M[k].t)}</p>` : ''}</div>`).join('')).join('') + `<p class="xp-warn">${esc(U.safety)}</p><p class="xp-warn">${esc(U.aacg)}</p>`;
    $('.mu-bl').innerHTML = BADGES.map(([b]) => `<span class="mu-badge ${badges.has(b) ? 'got' : ''}">${badges.has(b) ? '🏅' : '🔒'} ${esc(U.badge[b])}</span>`).join('');
    paintMarkers();
  };
  const award = b => { if (badges.has(b)) return; badges.add(b); save(); toast(`🏅 <b>${esc(U.badge[b])}</b>`, 3200); progress(); };
  const checkBadges = () => { for (const [b, need] of BADGES) if (need && need.every(k => found.has(k))) award(b); };
  const LINES = { vitreous: 1, vessels: 2, macula: 3, disc: 4 };
  const discover = k => {
    const first = !found.has(k);
    if (first) { found.add(k); save(); doBurst(markers[k].position); mata.happy(); toast(`✨ ${esc(U.discovered)} <b>${esc(M[k].n)}</b>`); if (found.size === 3) setTimeout(() => toast(`✨ ${esc(U.light)} 🔓`, 3000), 2800); }
    if (k in LINES) say(U.intro_lines[LINES[k]], 4500); else if (k === 'aqueous') say(U.aqline, 5000);
    openPanel(k); checkBadges(); progress();
  };
  const openPanel = k => {
    let extra = '';
    if (k === 'retina') extra = `<div class="mu-cross" aria-label="${esc(U.crossnote)}">${U.cross.map((c, i) => `<div style="--c:${['#d9ecff', '#bcd2ff', '#a7b7f2', '#f2c25a', '#5b3a2e', '#8f2b23'][i]}"><span>${esc(c)}</span></div>`).join('')}<p>⬇ ${esc(U.crossnote)}</p></div>`;
    if (k === 'floaters') extra = `<p class="xp-warn">⚠️ ${esc(U.safety)}</p>`;
    if (k === 'vessels') extra = `<button type="button" class="xr-next" data-act="follow">🩸 ${esc(U.follow)}</button>`;
    if (k === 'aqueous' || k === 'ciliary') extra = `<button type="button" class="xr-next" data-act="ride">💧 ${esc(U.ride)}</button>`;
    if (k === 'angle') extra = `<p class="xp-warn">⚠️ ${esc(U.aacg)}</p>`;
    panel.innerHTML = `<button type="button" class="xr-x" data-act="closepanel" aria-label="${U.close}">✕</button><h3>${esc(M[k].n)}</h3><p>${esc(M[k].t)}</p>${extra}`;
    panel.hidden = false;
  };

  // ---------------- light journey (World 4) ----------------
  const LJP = [new THREE.Vector3(0, 0, 70), new THREE.Vector3(0, 0, 60), new THREE.Vector3(0, 0, IRIS_Z), new THREE.Vector3(0, 0, 42), new THREE.Vector3(0, 0, 8), new THREE.Vector3(0, 0, -R + 3), DISC_DIR.clone().multiplyScalar(R - 2)];
  const ljLight = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0xfff3b0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); ljLight.scale.setScalar(5); ljLight.visible = false; scene.add(ljLight);
  let lj = null; // {i, t}
  const startLJ = () => {
    if (found.size < 3) { toast(U.lightlock); return; }
    closeOver(); panel.hidden = true; state = 'lj'; lj = { i: 0, t: 0, from: LJP[0].clone() }; ljLight.visible = true; ljLight.position.copy(LJP[0]);
    $('.mu-ljbar').hidden = false; say(U.intro_lines[5]); renderLJ();
  };
  const renderLJ = () => { $('.mu-ljbar .xr-ljt').textContent = U.lj[lj.i]; $('.mu-ljbar .xr-dots').innerHTML = U.lj.map((_, i) => `<i class="${i === lj.i ? 'on' : i < lj.i ? 'done' : ''}"></i>`).join(''); };
  const endLJ = (done) => { state = 'play'; lj = null; ljLight.visible = false; $('.mu-ljbar').hidden = true; player.set(0, 0, 18); yaw = Math.PI; pitch = 0; signals.forEach(s => s.visible = found.has('nerve')); if (done) award('light'); };

  // ---------------- controls ----------------
  const cv = renderer.domElement;
  let look = null;
  cv.addEventListener('pointerdown', e => { look = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (!look || e.pointerId !== look.id || state !== 'play' || paused) return; const k = .005 * S.sens; yaw -= (e.clientX - look.x) * k; pitch = Math.max(-1.2, Math.min(1.2, pitch - (e.clientY - look.y) * k)); look.x = e.clientX; look.y = e.clientY; });
  cv.addEventListener('pointerup', e => { if (!look) return; const tap = Math.hypot(e.clientX - look.x0, e.clientY - look.y0) < 6; look = null; if (tap && state === 'play') tapPick(e); });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const tapPick = e => {
    const r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(KEYS.map(k => markers[k].userData.s), false)[0]; if (!hit) return;
    const k = hit.object.parent.userData.k; if (markers[k].position.distanceTo(player) < 16) discover(k); else glideTo(k);
  };
  // the iris is a wall with one door (the pupil), and the lens sits behind it: route around them
  const route = (from, to) => { const fz = from.z > IRIS_Z; if (fz === to.z > IRIS_Z) return [];
    const d = new THREE.Vector2(from.x + to.x, from.y + to.y); if (d.lengthSq() < 1) d.set(0, 1); d.normalize();
    const A = new THREE.Vector3(d.x * 25, d.y * 25, 40), B = new THREE.Vector3(d.x * 12, d.y * 12, 50.2), C = new THREE.Vector3(0, 0, 50.6), E = new THREE.Vector3(0, 0, 55);
    if (fz) return [E, C, B, A];
    return (from.z < 47 && Math.hypot(from.x, from.y) < 26 ? [A] : []).concat([B, C, E]); };
  const glideTo = k => { auto = { k, to: markers[k].position.clone(), path: route(player, markers[k].position) }; follow = null; };
  // keep a point inside the eye (m = clearance): the retina wall, around the lens, through the pupil only, under the cornea
  const cv3 = new THREE.Vector3();
  const confine = (p, prev, m) => {
    let hit = false;
    if (Math.hypot(p.x, p.y) > PUPIL - m * .6) { if (prev.z <= IRIS_Z && p.z > IRIS_Z - m) { p.z = IRIS_Z - m; hit = true; } else if (prev.z > IRIS_Z && p.z < IRIS_Z + m) { p.z = IRIS_Z + m; hit = true; } }
    if (p.z < IRIS_Z) {
      const L = p.length(), lim = R - m - 1.7; if (L > lim) { p.multiplyScalar(lim / L); hit = true; }
      const dz = (p.z - LENS_Z) / (LENS_T + m), rr = Math.hypot(p.x, p.y) / (LENS_R + m), q = rr * rr + dz * dz;
      if (q < 1) { if (q < 1e-6) p.z = LENS_Z - LENS_T - m; else { const k = 1 / Math.sqrt(q); p.x *= k; p.y *= k; p.z = LENS_Z + (p.z - LENS_Z) * k; } hit = true; }
    } else { cv3.set(p.x, p.y, p.z - CORNEA_C); const L = cv3.length(), lim = CORNEA_R - m; if (L > lim) { cv3.multiplyScalar(lim / L); p.set(cv3.x, cv3.y, cv3.z + CORNEA_C); hit = true; } }
    return hit;
  };
  const nextTarget = () => { let best = null, bd = 1e9; for (const k of KEYS) { if (found.has(k)) continue; const d = markers[k].position.distanceTo(player); if (d < bd) { bd = d; best = k; } } return best || KEYS[0]; };
  // joystick
  const pad = $('.mu-pad'), knob = $('.mu-joy i'); let jid = null;
  pad.addEventListener('pointerdown', e => { jid = e.pointerId; pad.setPointerCapture(jid); joyMove(e); e.preventDefault(); });
  pad.addEventListener('pointermove', e => { if (e.pointerId === jid) joyMove(e); });
  const joyEnd = e => { if (e.pointerId !== jid) return; jid = null; joy = { x: 0, y: 0 }; knob.style.transform = ''; };
  pad.addEventListener('pointerup', joyEnd); pad.addEventListener('pointercancel', joyEnd);
  const joyMove = e => { const r = pad.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } joy = { x, y }; knob.style.transform = `translate(${x * 34}px,${y * 34}px)`; };
  stage.querySelectorAll('[data-ud]').forEach(b => { const v = +b.dataset.ud; b.addEventListener('pointerdown', e => { ud = v; e.preventDefault(); }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, () => { ud = 0; })); });
  // tilt steering
  let tilt0 = null; const onTilt = e => { if (!S.tilt || state !== 'play' || paused || e.beta == null) return; if (!tilt0) tilt0 = [e.beta, e.gamma]; joy = { x: Math.max(-1, Math.min(1, (e.gamma - tilt0[1]) / 25)), y: Math.max(-1, Math.min(1, (e.beta - tilt0[0]) / 25)) }; };
  if ('DeviceOrientationEvent' in window && touch) $('.mu-tiltrow').hidden = false;
  // keyboard (only while the game has focus, so page scrolling still works elsewhere)
  const kd = e => {
    if (state === 'menu' || e.target.closest('input')) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { if (!$('.mu-journal').hidden || !$('.mu-settings').hidden) closeOver(); else if (state === 'play' || state === 'lj') setPause(!paused); e.preventDefault(); return; }
    if (k === 'e' && nearK && !paused) { discover(nearK); return; }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift', 'control', 'q', 'z'].includes(k)) { keys.add(k); e.preventDefault(); auto = null; follow = null; }
  };
  const ku = e => keys.delete(e.key.toLowerCase());
  stage.addEventListener('keydown', kd); stage.addEventListener('keyup', ku); stage.addEventListener('blur', () => keys.clear());

  // ---------------- UI ----------------
  const overs = ['.mu-pause', '.mu-journal', '.mu-settings'];
  const closeOver = () => { overs.slice(1).forEach(s => $(s).hidden = true); if (paused) $('.mu-pause').hidden = false; stage.focus({ preventScroll: true }); };
  const setPause = p => { paused = p; $('.mu-pause').hidden = !p; overs.slice(1).forEach(s => $(s).hidden = true); $('[data-act=pause]').textContent = p ? '▶' : '⏸'; keys.clear(); setRun(); if (!p) stage.focus({ preventScroll: true }); };
  const syncSettings = () => { $('[data-set=sens]').value = S.sens; $('[data-set=reduced]').checked = S.reduced; $('[data-set=assisted]').checked = S.assisted; $('[data-set=tilt]').checked = S.tilt; };
  stage.addEventListener('input', e => { const s = e.target.dataset.set; if (!s) return; S[s] = e.target.type === 'checkbox' ? e.target.checked : +e.target.value;
    if (s === 'tilt' && S.tilt) { tilt0 = null; const DOE = window.DeviceOrientationEvent; if (DOE && DOE.requestPermission) DOE.requestPermission().then(r => { if (r !== 'granted') { S.tilt = false; syncSettings(); } }).catch(() => { S.tilt = false; syncSettings(); }); addEventListener('deviceorientation', onTilt); }
    if (s === 'tilt' && !S.tilt) { removeEventListener('deviceorientation', onTilt); joy = { x: 0, y: 0 }; }
    saveS(); });
  stage.addEventListener('click', e => {
    const lb = e.target.closest('[data-mark]'); if (lb) { const k = lb.dataset.mark; if (markers[k].position.distanceTo(player) < 16) discover(k); else glideTo(k); return; }
    const b = e.target.closest('button'); if (!b || !b.dataset.act) return; const a = b.dataset.act;
    if (a === 'inspect' && nearK) discover(nearK);
    else if (a === 'guide') { glideTo(nextTarget()); }
    else if (a === 'follow') { follow = { c: supArc, t: 0, v: .045, s: (R - 4) / R }; auto = null; panel.hidden = true; say(U.intro_lines[2]); }
    else if (a === 'ride') { follow = { c: rideC, t: 0, v: 7 / rideC.getLength(), s: 1 }; auto = null; panel.hidden = true; player.copy(rideC.getPointAt(0)); say(U.aqline, 5000); }
    else if (a === 'closepanel') panel.hidden = true;
    else if (a === 'journal') { $('.mu-pause').hidden = true; $('.mu-journal').hidden = false; if (!paused) { paused = true; setRun(); } }
    else if (a === 'settings') { syncSettings(); $('.mu-pause').hidden = true; $('.mu-settings').hidden = false; if (!paused) { paused = true; setRun(); } }
    else if (a === 'closeover') { overs.slice(1).forEach(s => $(s).hidden = true); if ($('.mu-pause').hidden) { paused = false; setRun(); stage.focus({ preventScroll: true }); } else $('.mu-pause').hidden = false; }
    else if (a === 'pause') setPause(!paused);
    else if (a === 'resume') setPause(false);
    else if (a === 'restart') { setPause(false); endLJ(false); startIntro(); }
    else if (a === 'resetprog') { found.clear(); badges.clear(); save(); progress(); }
    else if (a === 'light') startLJ();
    else if (a === 'ljnext') { if (lj.i < LJP.length - 1) { lj.from = ljLight.position.clone(); lj.i++; lj.t = 0; renderLJ(); } else endLJ(true); }
    else if (a === 'ljskip') endLJ(false);
    else if (a === 'skipintro') toSea();
    else if (a === 'full') { full = !full; el.classList.toggle('xr-full', full); document.documentElement.classList.toggle('xr-lock', full); b.title = full ? U.exitfull : U.full; setTimeout(resize, 60); }
  });
  // close overlays/pause when clicking the dim background
  stage.querySelectorAll('.mu-over').forEach(o => o.addEventListener('click', e => { if (e.target === o && !o.classList.contains('mu-pause')) stage.querySelector('[data-act=closeover]').click(); }));

  // ---------------- intro flow ----------------
  let cine = null;
  const startIntro = () => {
    state = 'intro'; cine = { t: 0 }; $('.mu-cine').hidden = false; stage.classList.add('cinema'); panel.hidden = true;
    say(U.ready, 3500); setTimeout(() => toast(U.scale, 3500), 1600);
  };
  const toSea = () => {
    if (state === 'play') return; state = 'play'; cine = null; $('.mu-cine').hidden = true; stage.classList.remove('cinema');
    const f = $('.mu-flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
    player.set(0, 0, 22); yaw = Math.PI; pitch = 0; vel.set(0, 0, 0); camPos.set(0, 2.5, 28); signals.forEach(s => s.visible = found.has('nerve'));
    setTimeout(() => say(U.intro_lines[0], 4000), 500); stage.focus({ preventScroll: true });
  };
  el.querySelector('[data-go="play"]').addEventListener('click', () => { intro.classList.add('gone'); stage.classList.add('live'); startIntro(); setRun(); });

  // ---------------- update ----------------
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const updatePlay = (dt, t) => {
    const speed = 11, f = fwd(), right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    let ix = joy.x, iy = -joy.y;
    if (keys.has('w') || keys.has('arrowup')) iy += 1; if (keys.has('s') || keys.has('arrowdown')) iy -= 1;
    if (keys.has('d')) ix += 1; if (keys.has('a')) ix -= 1;
    const turn = (keys.has('arrowleft') ? 1 : 0) - (keys.has('arrowright') ? 1 : 0);
    let lift = ud + (keys.has(' ') ? 1 : 0) - (keys.has('shift') || keys.has('control') || keys.has('q') || keys.has('z') ? 1 : 0);
    if (Math.abs(ix) + Math.abs(iy) + Math.abs(lift) > .05) { auto = null; follow = null; }
    yaw += turn * 1.6 * dt * S.sens;
    if (S.assisted) { yaw -= ix * 1.3 * dt * S.sens; ix = 0; if (!look) pitch *= Math.pow(.6, dt); } // assisted: stick turns, view levels out
    const want = new THREE.Vector3().addScaledVector(f, iy).addScaledVector(right, ix).addScaledVector(up, lift);
    if (auto) { const tg = auto.path.length ? auto.path[0] : auto.to; tmp.copy(tg).sub(player); const d = tmp.length();
      if (auto.path.length && d < 2.5) auto.path.shift(); else if (!auto.path.length && d < 7) { const k = auto.k; auto = null; discover(k); } else { want.copy(tmp.normalize()); const ty = Math.atan2(tmp.x, tmp.z), tp = Math.asin(Math.max(-1, Math.min(1, tmp.y))); yaw += Math.atan2(Math.sin(ty - yaw), Math.cos(ty - yaw)) * Math.min(1, dt * 2); pitch += (tp - pitch) * Math.min(1, dt * 2); } }
    if (follow) { follow.t += dt * follow.v; if (follow.t >= 1) follow = null; else { const p = follow.c.getPointAt(follow.t).multiplyScalar(follow.s); tmp.copy(p).sub(player); want.copy(tmp).multiplyScalar(.5); const tg = follow.c.getTangentAt(follow.t); const ty = Math.atan2(tg.x, tg.z); yaw += Math.atan2(Math.sin(ty - yaw), Math.cos(ty - yaw)) * Math.min(1, dt * 1.5); } }
    if (want.lengthSq() > 1) want.normalize();
    vel.lerp(want.multiplyScalar(speed * (follow ? 1.2 : 1)), Math.min(1, dt * 2.2));
    prevP.copy(player); player.addScaledVector(vel, dt); moved += vel.length() * dt; if (moved > 6) award('first');
    // keep inside the eye: soft wall at the retina, front limit behind the lens
    if (confine(player, prevP, 1.3)) vel.multiplyScalar(.6);
    // nearby landmark
    let best = null, bd = 16; for (const k of KEYS) { const d = markers[k].position.distanceTo(player); if (d < bd) { bd = d; best = k; } }
    nearK = best; nearEl.hidden = !best; if (best) nearEl.querySelector('span').textContent = `${U.near}: ${M[best].n}`;
    if (best && bd < 4 && !found.has(best)) discover(best);
    // macula close-up vignette (sharp centre, softer edges)
    const mac = player.distanceTo(LM.fovea); $('.mu-vig').style.opacity = String(Math.max(0, Math.min(1, (16 - mac) / 8)));
    // Mata faces where it is going
    const look2 = vel.lengthSq() > .5 ? vel.clone().normalize() : f;
    mata.object.position.copy(player); mata.object.lookAt(tmp2.copy(player).add(look2));
    mata.update(t, dt, { reducedMotion: S.reduced, moving: vel.lengthSq() > 2 });
    // third-person camera
    const back = f.clone().multiplyScalar(-5.2).add(new THREE.Vector3(0, 1.6, 0));
    const smooth = S.reduced ? 2 : 4;
    camPos.lerp(tmp.copy(player).add(back), Math.min(1, dt * smooth)); confine(camPos, player, .5); camera.position.copy(camPos);
    camLook.lerp(tmp.copy(player).addScaledVector(f, 4), Math.min(1, dt * (smooth + 2))); camera.lookAt(camLook);
  };
  const updateLJ = (dt, t) => {
    const to = LJP[lj.i]; lj.t = Math.min(1, lj.t + dt / (lj.i === 4 || lj.i === 5 ? 3.2 : 1.8));
    const e = lj.t < .5 ? 2 * lj.t * lj.t : 1 - Math.pow(-2 * lj.t + 2, 2) / 2;
    if (lj.i === 6) { const c = fibreCurves[3]; ljLight.position.copy(lj.from).lerp(to, e); } else ljLight.position.copy(lj.from).lerp(to, e);
    signals.forEach(s => s.visible = lj.i === 6);
    mata.object.position.copy(ljLight.position).add(new THREE.Vector3(2.5, 1.2, 1.5)); mata.object.lookAt(ljLight.position); mata.update(t, dt, { reducedMotion: S.reduced });
    const dir = (lj.i < 6 ? new THREE.Vector3(0, 0, -1) : DISC_DIR.clone()).normalize();
    camPos.lerp(tmp.copy(ljLight.position).addScaledVector(dir, -9).add(new THREE.Vector3(3, 2.5, 0)), Math.min(1, dt * 2.5)); camera.position.copy(camPos);
    camLook.lerp(tmp.copy(ljLight.position).addScaledVector(dir, 6), Math.min(1, dt * 3)); camera.lookAt(camLook);
    $('.mu-vig').style.opacity = '0'; nearEl.hidden = true;
  };
  const updateIntro = (dt, t) => {
    cine.t += dt / (S.reduced ? 3 : 6.5); const k = Math.min(1, cine.t), e = k * k * (3 - 2 * k);
    // fly from space towards the pupil of the giant eye
    const z0 = 34, z1 = -30 + 8 * 1.02; camera.position.set(Math.sin(e * 2) * (1 - e) * 6, (1 - e) * 4, z0 + (z1 - z0) * e); camera.lookAt(0, 0, -30);
    introMata.object.position.set(camera.position.x + 1.8 * (1 - e), camera.position.y - 1.2 * (1 - e), camera.position.z - 7);
    introMata.object.lookAt(0, 0, -30); introMata.update(t, dt, { reducedMotion: S.reduced, moving: true });
    bigEye.group.rotation.y = Math.sin(t * .4) * .08 * (1 - e);
    if (k >= 1) toSea();
  };
  const updateLabels = () => {
    const w = cv.clientWidth, h = cv.clientHeight;
    for (const k of KEYS) { const d = lab[k];
      const dist = markers[k].position.distanceTo(camera.position);
      if (state !== 'play' || dist > 34) { d.style.display = 'none'; continue; }
      tmp.copy(markers[k].position).add(new THREE.Vector3(0, 2.6, 0)).project(camera);
      if (tmp.z > 1 || Math.abs(tmp.x) > 1.1 || Math.abs(tmp.y) > 1.1) { d.style.display = 'none'; continue; }
      d.style.display = ''; d.style.opacity = String(Math.min(1, (34 - dist) / 10));
      d.style.transform = `translate(${(tmp.x * .5 + .5) * w}px,${(-tmp.y * .5 + .5) * h}px)`; }
  };

  // ---------------- loop ----------------
  const resize = () => { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cv.style.width = w + 'px'; cv.style.height = h + 'px'; camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(stage);
  const clock = new THREE.Clock(); let t = 0, visible = true, running = false;
  const loop = () => {
    const dt = Math.min(clock.getDelta(), .05); t += dt * (S.reduced ? .4 : 1);
    partU.uT.value = t; beamU.uT.value = t; wallU.uT.value = t;
    if (!S.reduced) { fib.rotation.y = t * .01; floaters.rotation.y = t * .05; floaters.rotation.x = Math.sin(t * .1) * .3; }
    KEYS.forEach((k, i) => { const g = markers[k]; g.userData.ring.lookAt(camera.position); const s = 1 + Math.sin(t * 2 + i) * (S.reduced ? 0 : .15); g.userData.ring.scale.setScalar(s); g.position.y = LM[k].y + (S.reduced ? 0 : Math.sin(t * .8 + i) * .5); });
    updAq(S.reduced ? t * .5 : t);
    signals.forEach(s => { if (!s.visible) return; s.position.copy(s.userData.c.getPointAt((t * .12 + s.userData.o) % 1)); });
    if (burstT > 0) { burstT -= dt; const a = burst.geometry.attributes.position.array; for (let i = 0; i < 60; i++) { a[i * 3] += burstV[i].x * dt; a[i * 3 + 1] += burstV[i].y * dt; a[i * 3 + 2] += burstV[i].z * dt; } burst.geometry.attributes.position.needsUpdate = true; burst.material.opacity = Math.max(0, burstT); if (burstT <= 0) burst.visible = false; }
    if (state === 'intro') { updateIntro(dt, t); renderer.render(introS, camera); updateLabels(); return; }
    if (state === 'play') updatePlay(dt, t); else if (state === 'lj') updateLJ(dt, t);
    else { camera.position.set(Math.sin(t * .1) * 8, 3, 26); camera.lookAt(0, 0, -20); mata.object.position.set(0, 0, 16); mata.update(t, dt, { reducedMotion: S.reduced }); }
    lantern.position.copy(state === 'lj' ? ljLight.position : player).add(new THREE.Vector3(0, 2, 2));
    renderer.render(scene, camera); updateLabels();
  };
  const setRun = () => { const on = visible && !document.hidden && !paused; if (on !== running) { running = on; clock.getDelta(); renderer.setAnimationLoop(on ? loop : null); } };
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; setRun(); }); io.observe(stage);
  const onVis = () => { if (document.hidden && (state === 'play' || state === 'lj') && !paused) setPause(true); setRun(); }; document.addEventListener('visibilitychange', onVis);
  resize(); progress(); syncSettings(); setRun(); el.classList.add('ready');
  el.querySelector('.xr-load').hidden = true;
  el.__dbg = { get state() { return state }, player, camera, discover, startLJ, toSea, glideTo, setView(y, p) { yaw = y; pitch = p; } };

  const watch = setInterval(() => { if (el.isConnected) return;
    clearInterval(watch); renderer.setAnimationLoop(null); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); removeEventListener('deviceorientation', onTilt);
    document.documentElement.classList.remove('xr-lock'); bigEye.dispose(); scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); renderer.dispose(); renderer.forceContextLoss(); }, 1000);
}
