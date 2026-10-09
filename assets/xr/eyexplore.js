// EyeXplore AR: interactive 3D eye (outside, cut in half, inside, light's journey), with real WebXR AR on
// supported phones and an honest "camera view" fallback elsewhere. Mounted by tools/xr.py's loader.
import * as THREE from '/assets/three/three.module.min.js';
import { OrbitControls } from './OrbitControls.js';
import { createEye } from './eyemodel.js';
import { createMata } from './mata3d.js';

const VIEWS = {
  ext: { pos: [2.6, 1.0, 3.9], tgt: [.45, 0, 0], cut: false },
  cut: { pos: [4.3, 1.1, .9], tgt: [0, 0, .05], cut: true, mata: [.9, 1.05, -2.1] },
  in: { pos: [0, .04, .22], tgt: [0, 0, -.45], cut: false },
  light: { pos: [6.2, .7, 1.7], tgt: [0, 0, 1.15], cut: true },
};
const INNER = new Set(['lens', 'vitreous', 'retina', 'macula', 'fovea', 'disc', 'ciliary', 'aqueous', 'choroid']);
const LIGHT_PART = [null, 'cornea', 'aqueous', 'pupil', 'lens', 'vitreous', 'retina', 'nerve'];
const LIGHT_Z = [1.25, 1.0, .76, .7, .36, -.55, -.95, -.95];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LS = { get(k) { try { return JSON.parse(localStorage.getItem(k)) } catch (e) { return null } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) { } } };

export function mount(el, D) {
  const U = D.ui, P = D.parts;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // ---------- DOM ----------
  const intro = el.querySelector('.xi-intro');
  const stage = document.createElement('div'); stage.className = 'xr-stage'; stage.tabIndex = 0; stage.setAttribute('aria-label', U.title);
  stage.innerHTML = `
   <div class="xr-canvas"></div>
   <div class="xr-labels" aria-hidden="true"></div>
   <div class="xr-top">
     <div class="xr-modes" role="tablist">${[['ext', U.m_ext], ['cut', U.m_cut], ['in', U.m_in], ['light', U.m_light]].map(([k, l]) => `<button type="button" role="tab" data-mode="${k}">${l}</button>`).join('')}</div>
     <div class="xr-tools">
       <button type="button" class="xr-ic" data-act="labels" aria-pressed="false" title="${U.labels}">🏷️<span>${U.labels}</span></button>
       <button type="button" class="xr-ic" data-act="reset" title="${U.reset}">⟲<span>${U.reset}</span></button>
       <button type="button" class="xr-ic" data-act="calm" aria-pressed="false" title="${U.pause}">⏸<span>${U.pause}</span></button>
       <button type="button" class="xr-ic" data-act="full" title="⛶">⛶</button>
     </div>
   </div>
   <div class="xr-bubble" role="status" aria-live="polite"></div>
   <aside class="xr-info" hidden aria-live="polite"></aside>
   <div class="xr-lj" hidden><p class="xr-ljt"></p><div class="xr-ljb"><button type="button" data-lj="prev">‹ ${U.prev}</button><span class="xr-dots"></span><button type="button" data-lj="play">▶ ${U.play}</button><button type="button" class="pri" data-lj="next">${U.nxt} ›</button></div></div>
   <div class="xr-bottom">
     <button type="button" class="xr-prog" data-act="parts" aria-expanded="false"><span class="xr-bar"><i></i></span><b></b></button>
     <span class="xr-hint">${U.how}</span>
   </div>
   <div class="xr-drawer" hidden><div class="xr-dh"><b>${U.parts}</b><button type="button" data-act="parts">✕</button></div><div class="xr-plist"></div></div>
   <div class="xr-modal" hidden><div><p>${U.ar_why}</p><div><button type="button" data-act="arno">${U.close}</button><button type="button" class="pri" data-act="argo">${U.ar}</button></div></div></div>`;
  el.appendChild(stage);
  const arOverlay = document.createElement('div'); arOverlay.className = 'xr-ar-ui'; arOverlay.hidden = true;
  arOverlay.innerHTML = `<button type="button" class="xr-arx" data-act="arexit">✕ ${U.exitar}</button><button type="button" class="xr-armove" data-act="armove">${U.move}</button><p class="xr-arhint">${U.ar_place}</p><aside class="xr-info xr-arinfo" hidden></aside>`;
  document.body.appendChild(arOverlay);
  const $ = s => stage.querySelector(s);
  const bubble = $('.xr-bubble'), info = $('.xr-info'), labelsEl = $('.xr-labels'), lj = $('.xr-lj');
  let bubbleT = 0;
  const say = (txt, ms = 3500) => { bubble.textContent = txt; bubble.classList.add('on'); clearTimeout(bubbleT); bubbleT = setTimeout(() => bubble.classList.remove('on'), ms); };

  // ---------- three.js ----------
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { const l = el.querySelector('.xr-load'); l.hidden = false; l.textContent = U.nogl; stage.remove(); arOverlay.remove(); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.localClippingEnabled = true; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.xr.enabled = true;
  $('.xr-canvas').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .02, 60);
  scene.add(new THREE.HemisphereLight(0xd8ecff, 0x24123a, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 4, 5); scene.add(key);
  const rim = new THREE.PointLight(0x7fdcff, 6, 12); rim.position.set(-2.5, 1.5, -3); scene.add(rim);
  const inner = new THREE.PointLight(0xffe2c8, 0, 3); inner.position.set(0, .2, .3); scene.add(inner);
  const world = new THREE.Group(); scene.add(world);
  const eye = createEye(); world.add(eye.group);
  const mata = createMata(); mata.object.position.set(2.05, .25, .2); mata.object.scale.setScalar(.62); scene.add(mata.object);
  // floating particles
  const pg = new THREE.BufferGeometry(); const pp = new Float32Array(260 * 3);
  for (let i = 0; i < 260; i++) { pp[i * 3] = (Math.random() - .5) * 12; pp[i * 3 + 1] = (Math.random() - .5) * 7; pp[i * 3 + 2] = (Math.random() - .5) * 10 - 1; }
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const particles = new THREE.Points(pg, new THREE.PointsMaterial({ size: .06, map: dot, transparent: true, opacity: .55, color: 0x9fe7ff, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(particles);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .08; controls.enablePan = false; controls.rotateSpeed = .7;
  controls.minDistance = 2; controls.maxDistance = 9;

  // ---------- light journey objects ----------
  const lightG = new THREE.Group(); lightG.visible = false; world.add(lightG);
  const X0 = .07;
  const tree = new THREE.Group(); tree.position.set(X0, 0, 3.25);
  { const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, .4, 10), new THREE.MeshStandardMaterial({ color: 0x8a5a33 })); trunk.position.y = -.3; tree.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(.3, .7, 14), new THREE.MeshStandardMaterial({ color: 0x3fae6a, roughness: .7 })); crown.position.y = .15; tree.add(crown);
    const star = new THREE.Mesh(new THREE.SphereGeometry(.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd34d })); star.position.y = .52; tree.add(star); }
  lightG.add(tree);
  const corneaZ = y => .451 + Math.sqrt(.4225 - y * y);
  const Ti = new THREE.Vector3(X0, -.3, -.89), Bi = new THREE.Vector3(X0, .3, -.89);
  const rays = [];
  const mkRay = (from, yc, to, col) => {
    const C = new THREE.Vector3(X0, yc, corneaZ(yc));
    const f = (.66 - C.z) / (to.z - C.z); const Lf = C.clone().lerp(to, f); Lf.y *= .82;
    const path = new THREE.CurvePath(); [from, C, Lf, to].reduce((a, b) => (path.add(new THREE.LineCurve3(a, b)), b));
    const segs = 220, geo = new THREE.TubeGeometry(path, segs, .013, 6, false);
    const zs = []; for (let i = 0; i <= segs; i++) zs.push(path.getPointAt(i / segs).z);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }));
    lightG.add(m); rays.push({ m, zs, segs, path });
  };
  const top = new THREE.Vector3(X0, .55, 3.25), bot = new THREE.Vector3(X0, -.42, 3.25);
  mkRay(top, .4, Ti, 0xffd34d); mkRay(top, .12, Ti, 0xffd34d); mkRay(bot, -.4, Bi, 0x6fe3ff); mkRay(bot, -.12, Bi, 0x6fe3ff);
  // upside-down picture on the retina
  const img = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
    g.translate(32, 64); g.rotate(Math.PI); g.translate(-32, -64);
    g.fillStyle = '#8a5a33'; g.fillRect(27, 84, 10, 30); g.fillStyle = '#3fae6a'; g.beginPath(); g.moveTo(32, 14); g.lineTo(8, 88); g.lineTo(56, 88); g.fill(); g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(32, 12, 7, 0, 7); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const retImg = new THREE.Mesh(new THREE.PlaneGeometry(.3, .6), new THREE.MeshBasicMaterial({ map: img, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  retImg.position.set(X0 + .02, 0, -.86); retImg.rotation.y = Math.PI / 2; retImg.visible = false; lightG.add(retImg);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0xfff3b0, blending: THREE.AdditiveBlending, depthWrite: false })); glow.scale.setScalar(.22); lightG.add(glow);
  const pulses = []; for (let i = 0; i < 4; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0x9fe7ff, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.setScalar(.16); s.visible = false; lightG.add(s); pulses.push(s); }
  let ljStep = 0, ljPlay = false, ljShown = [0, 0, 0, 0], ljTimer = 0;

  // ---------- state ----------
  let mode = 'ext', selected = null, showAll = false, calm = reduced, full = false;
  const found = new Set((LS.get('xr-found') || []).filter(k => P[k]));
  const tween = { t: 1, dur: 1, p0: new THREE.Vector3(), p1: new THREE.Vector3(), q0: new THREE.Vector3(), q1: new THREE.Vector3() };
  const goTo = (pos, tgt, inst) => {
    tween.p0.copy(camera.position); tween.q0.copy(controls.target); tween.p1.set(...pos); tween.q1.set(...tgt);
    if (camera.aspect < 1.1 && mode !== 'in' && mode !== 'light') { const f = Math.min(2.2, 1.15 / Math.pow(camera.aspect, .9)); tween.p1.sub(tween.q1).multiplyScalar(f).add(tween.q1); }
    if (inst || reduced) { camera.position.copy(tween.p1); controls.target.copy(tween.q1); tween.t = 1; } else { tween.t = 0; tween.s = performance.now(); }
  };
  const setMode = (m, inst) => {
    mode = m; let v = VIEWS[m];
    const tall = m === 'light' && camera.aspect < 1.1; world.rotation.x = tall ? -Math.PI / 2 : 0;
    if (tall) v = { pos: [13, -.2, .7], tgt: [0, -.35, 0], cut: true };
    eye.setCut(v.cut); lightG.visible = m === 'light'; lj.hidden = m !== 'light';
    eye.show('vitreous', m !== 'in'); eye.show('cornea', true);
    mata.object.visible = m === 'ext' || m === 'cut';
    mata.object.position.set(...(camera.aspect < 1.1 ? (m === 'cut' ? [.6, -1.5, -1.3] : [.9, -1.45, 1.1]) : (v.mata || [2.05, .25, .2])));
    inner.intensity = m === 'in' ? 2.2 : 0;
    controls.minDistance = m === 'in' ? .15 : 1.6; controls.maxDistance = m === 'in' ? .9 : 14;
    goTo(v.pos, v.tgt, inst);
    stage.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-selected', b.dataset.mode === m));
    if (m === 'light') { info.hidden = true; ljStep = 0; ljShown = [0, 0, 0, 0]; renderLJ(); }
  };

  // ---------- info + discovery ----------
  const total = Object.keys(P).length;
  const renderProg = () => {
    $('.xr-prog b').textContent = `${found.size} / ${total} ${U.found}`;
    $('.xr-bar i').style.width = (found.size / total * 100) + '%';
    $('.xr-plist').innerHTML = D.order.map(k => `<button type="button" data-part="${k}" class="${found.has(k) ? 'got' : ''}${k === selected ? ' on' : ''}">${found.has(k) ? '✓ ' : ''}${esc(P[k].n)}</button>`).join('');
  };
  const infoHTML = k => { const p = P[k]; return `<button type="button" class="xr-x" data-act="close" aria-label="${U.close}">✕</button><h3>${esc(p.n)}</h3>
      <p><b>${U.what}:</b> ${esc(p.what)}</p><p><b>${U.does}</b> ${esc(p.does)}</p><p class="xr-fact"><b>💡 ${U.fact}</b> ${esc(p.fact)}</p>
      ${p.next && P[p.next] ? `<button type="button" class="xr-next" data-part="${p.next}">${U.next}: ${esc(P[p.next].n)} →</button>` : ''}`; };
  const select = (k, fromList) => {
    selected = k; const tgtInfo = arActive ? arOverlay.querySelector('.xr-arinfo') : info;
    if (!k) { tgtInfo.hidden = true; renderProg(); return; }
    tgtInfo.innerHTML = infoHTML(k); tgtInfo.hidden = false;
    if (!found.has(k)) {
      found.add(k); LS.set('xr-found', [...found]); mata.happy();
      say(found.size === total ? U.all : U.yay.replace('{n}', P[k].n));
    }
    if (fromList && !arActive && mode !== 'light') {
      if (INNER.has(k) && mode === 'ext') setMode('cut');
      else if (!INNER.has(k) && mode === 'in') setMode('ext');
      else if (['muscles', 'nerve', 'conjunctiva', 'sclera'].includes(k) && mode === 'cut') setMode('ext');
    }
    renderProg();
  };

  // ---------- picking ----------
  const ray = new THREE.Raycaster(); ray.params.Line.threshold = .02;
  const pickables = []; Object.values(eye.parts).forEach(p => p.meshes.forEach(m => pickables.push(m)));
  const local = new THREE.Vector3();
  const pickRay = () => {
    const hits = ray.intersectObjects(pickables, false).filter(h => {
      if (!h.object.visible) return false;
      local.copy(h.point); eye.group.worldToLocal(local); return !eye.isClipped(local);
    });
    if (!hits.length) return null;
    let k = hits[0].object.userData.part;
    if (eye.cut) { // clicks through the cut face select the fluid you are looking into
      const o = ray.ray.origin.clone(), d = ray.ray.direction.clone();
      const og = eye.group.worldToLocal(o.clone()), dg = eye.group.worldToLocal(o.clone().add(d)).sub(og);
      if (dg.x < -1e-4) { const s = -og.x / dg.x, c = og.clone().addScaledVector(dg, s);
        if (['retina', 'choroid', 'sclera', 'vitreous'].includes(k) && c.length() < .88 && c.z < .33) k = 'vitreous';
        else if (['cornea', 'iris', 'aqueous'].includes(k) && c.z > .74 && c.z < 1.05 && Math.abs(c.y) < .48 && hits[0].object.userData.part !== 'iris') k = 'aqueous'; }
    } else if (k === 'vitreous' && hits[1] && hits[1].distance - hits[0].distance < .04) k = hits[1].object.userData.part;
    return k;
  };
  const ndc = new THREE.Vector2(); let down = null;
  renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6 || arActive) return; down = null;
    const r = renderer.domElement.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera); const k = pickRay(); if (k) select(k);
  });

  // ---------- labels ----------
  const lab = {}; for (const k of D.order) { const d = document.createElement('button'); d.type = 'button'; d.className = 'xr-lab'; d.dataset.part = k; d.textContent = P[k].n; d.tabIndex = -1; labelsEl.appendChild(d); lab[k] = d; }
  const v3 = new THREE.Vector3(), n3 = new THREE.Vector3(), camL = new THREE.Vector3();
  const updateLabels = () => {
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    camL.copy(camera.position); eye.group.worldToLocal(camL);
    for (const k of D.order) {
      const part = eye.parts[k], d = lab[k];
      let show = (showAll || k === selected) && part.anchor && mode !== 'light' && !arActive;
      if (show && mode === 'in' && !['retina', 'macula', 'fovea', 'disc', 'vitreous', 'choroid'].includes(k)) show = k === selected;
      if (show) {
        if (eye.isClipped(part.anchor)) show = false;
        else if (mode !== 'in' && !INNER.has(k) || mode === 'ext') { n3.copy(part.normal); if (n3.dot(v3.copy(camL).sub(part.anchor)) < 0 && k !== selected) show = false; }
        if (mode === 'ext' && INNER.has(k) && k !== selected) show = false;
      }
      if (!show) { d.style.display = 'none'; continue; }
      v3.copy(part.anchor); eye.group.localToWorld(v3); v3.project(camera);
      if (v3.z > 1) { d.style.display = 'none'; continue; }
      d.style.display = ''; d.classList.toggle('on', k === selected);
      d.style.transform = `translate(${(v3.x * .5 + .5) * w}px,${(-v3.y * .5 + .5) * h}px)`;
    }
  };

  // ---------- light journey ----------
  const renderLJ = () => {
    lj.querySelector('.xr-ljt').textContent = U.light[ljStep];
    lj.querySelector('.xr-dots').innerHTML = U.light.map((_, i) => `<i class="${i === ljStep ? 'on' : i < ljStep ? 'done' : ''}"></i>`).join('');
    lj.querySelector('[data-lj=prev]').disabled = ljStep === 0; lj.querySelector('[data-lj=next]').disabled = ljStep === U.light.length - 1;
    lj.querySelector('[data-lj=play]').innerHTML = ljPlay ? `⏸ ${U.pause}` : `▶ ${U.play}`;
    retImg.visible = ljStep >= 6;
    const k = LIGHT_PART[ljStep]; selected = k; if (k && !found.has(k)) { found.add(k); LS.set('xr-found', [...found]); } renderProg();
  };
  const ljUpdate = (t, dt) => {
    const zt = LIGHT_Z[ljStep];
    rays.forEach((r, i) => {
      let n = 0; while (n < r.segs && r.zs[n] > zt) n++;
      ljShown[i] += (n - ljShown[i]) * Math.min(1, dt * (reduced ? 50 : 2.5));
      r.m.geometry.setDrawRange(0, Math.floor(ljShown[i]) * 6 * 6);
    });
    // glow travels along the newest stretch of the first ray
    const r = rays[0], prevZ = ljStep ? LIGHT_Z[ljStep - 1] : 3.2;
    const span = [r.zs.findIndex(z => z <= prevZ), Math.floor(ljShown[0])]; const f = calm ? 1 : (t * .6) % 1;
    const idx = Math.max(0, Math.min(r.segs, Math.round(span[0] + (span[1] - span[0]) * f)));
    glow.position.copy(r.path.getPointAt(idx / r.segs)); glow.visible = ljStep < 7;
    pulses.forEach((s, i) => { s.visible = ljStep === 7; if (s.visible) s.position.copy(eye.nerveCurve.getPointAt(((calm ? i / 4 : t * .35 + i / 4) % 1))); });
    if (ljPlay) { ljTimer += dt; if (ljTimer > 4.5) { ljTimer = 0; if (ljStep < U.light.length - 1) { ljStep++; renderLJ(); } else { ljPlay = false; renderLJ(); } } }
  };

  // ---------- AR (WebXR) and camera view ----------
  let arActive = false, arAnchor = null, hitSrc = null, placed = false, reticle = null, arScale = .1;
  const arBtn = el.querySelector('[data-go=ar]'), note = el.querySelector('[data-arnote]');
  const roomBtns = [el.querySelector('[data-go=room]'), el.querySelector('[data-go=roomcut]')];
  const ua = navigator.userAgent, isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1), isAndroid = /Android/i.test(ua);
  (async () => {
    let ok = false; try { ok = !!(navigator.xr && await navigator.xr.isSessionSupported('immersive-ar')); } catch (e) { }
    if (ok) arBtn.hidden = false;
    if (isIOS || isAndroid) roomBtns.forEach(b => b.hidden = false);
    note.textContent = isIOS ? U.ar_ios : ok ? U.ar_ok : isAndroid ? U.ar_and : U.ar_desk;
  })();
  // Native AR viewers (they track the room themselves): AR Quick Look on iPhone/iPad, Scene Viewer on Android.
  const openRoom = cut => {
    const f = '/assets/xr/' + (cut ? 'eye-cut' : 'eye') + (isIOS ? '.usdz' : '.glb') + '?v=' + D.build, a = document.createElement('a');
    if (isIOS) { a.rel = 'ar'; a.href = f + '#allowsContentScaling=1'; a.appendChild(document.createElement('img')); }
    else a.href = 'intent://arvr.google.com/scene-viewer/1.0?file=' + encodeURIComponent(new URL(f, location.href).href) + '&mode=ar_preferred&title=' + encodeURIComponent(U.title)
      + '#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=' + encodeURIComponent(location.href) + ';end;';
    document.body.appendChild(a); a.click(); a.remove();
  };
  const startAR = async () => {
    $('.xr-modal').hidden = true;
    arOverlay.hidden = false;
    try {
      const session = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], domOverlay: { root: arOverlay } });
      arActive = true; placed = false; arOverlay.hidden = false; info.hidden = true;
      renderer.xr.setReferenceSpaceType('local'); await renderer.xr.setSession(session);
      scene.background = null; particles.visible = false; mata.object.visible = false; lightG.visible = false; eye.setCut(false);
      arAnchor = new THREE.Group(); arAnchor.visible = false; scene.add(arAnchor); arAnchor.add(eye.group); arAnchor.scale.setScalar(arScale);
      if (!reticle) { reticle = new THREE.Mesh(new THREE.RingGeometry(.06, .08, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9fe7ff })); reticle.matrixAutoUpdate = false; }
      reticle.visible = false; scene.add(reticle);
      const viewer = await session.requestReferenceSpace('viewer'); hitSrc = await session.requestHitTestSource({ space: viewer });
      session.addEventListener('select', onSelect); session.addEventListener('end', endAR);
      arOverlay.querySelector('.xr-arhint').textContent = U.ar_place;
    } catch (e) { console.warn(e); arActive = false; arOverlay.hidden = true; say(U.ar_fail, 5000); }
  };
  const onSelect = e => {
    if (!placed && reticle.visible) { arAnchor.position.setFromMatrixPosition(reticle.matrix); arAnchor.position.y += .12; arAnchor.visible = true; placed = true; reticle.visible = false; arOverlay.querySelector('.xr-arhint').textContent = U.ar_placed; return; }
    if (!placed) return;
    const pose = e.frame.getPose(e.inputSource.targetRaySpace, renderer.xr.getReferenceSpace()); if (!pose) return;
    const m = new THREE.Matrix4().fromArray(pose.transform.matrix);
    ray.ray.origin.setFromMatrixPosition(m); ray.ray.direction.set(0, 0, -1).transformDirection(m);
    const k = pickRay(); if (k) select(k);
  };
  const endAR = () => {
    arActive = false; hitSrc = null; arOverlay.hidden = true; world.add(eye.group); if (arAnchor) scene.remove(arAnchor); if (reticle) scene.remove(reticle);
    particles.visible = true; setMode(mode, true); say(U.matane);
  };
  // pinch to scale / drag to turn while in AR
  { let t0 = null;
    arOverlay.addEventListener('touchstart', e => { if (e.target.closest('button,aside')) return; t0 = [...e.touches].map(t => [t.clientX, t.clientY]); t0.s = arScale; t0.r = arAnchor ? arAnchor.rotation.y : 0; }, { passive: true });
    arOverlay.addEventListener('touchmove', e => { if (!t0 || !arAnchor) return; const T = [...e.touches];
      if (T.length === 2 && t0.length === 2) { const d0 = Math.hypot(t0[0][0] - t0[1][0], t0[0][1] - t0[1][1]), d1 = Math.hypot(T[0].clientX - T[1].clientX, T[0].clientY - T[1].clientY); arScale = Math.min(.4, Math.max(.03, t0.s * d1 / d0)); arAnchor.scale.setScalar(arScale); }
      else if (T.length === 1) arAnchor.rotation.y = t0.r + (T[0].clientX - t0[0][0]) / 120; }, { passive: true });
    arOverlay.addEventListener('touchend', () => { t0 = null; });
    arOverlay.querySelectorAll('button').forEach(b => b.addEventListener('beforexrselect', ev => ev.preventDefault()));
    arOverlay.addEventListener('beforexrselect', ev => { if (ev.target.closest('aside')) ev.preventDefault(); });
  }
  // ---------- UI events ----------
  const begin = () => { intro.classList.add('gone'); stage.classList.add('live'); stage.focus({ preventScroll: true }); say(U.hello, 4500); };
  el.querySelector('[data-go="3d"]').addEventListener('click', begin);
  arBtn.addEventListener('click', () => { begin(); $('.xr-modal').hidden = false; });
  roomBtns.forEach((b, i) => b.addEventListener('click', () => openRoom(i === 1)));
  const onClick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.mode) { setMode(b.dataset.mode); return; }
    if (b.dataset.part) { select(b.dataset.part, true); if (b.closest('.xr-drawer') && innerWidth < 700) toggleDrawer(false); return; }
    if (b.dataset.lj) { const a = b.dataset.lj; if (a === 'next') ljStep = Math.min(U.light.length - 1, ljStep + 1); if (a === 'prev') { ljStep = Math.max(0, ljStep - 1); ljShown = ljShown.map(() => 0); } if (a === 'play') { ljPlay = !ljPlay; ljTimer = 0; if (ljPlay && ljStep === U.light.length - 1) { ljStep = 0; ljShown = ljShown.map(() => 0); } } renderLJ(); return; }
    const a = b.dataset.act;
    if (a === 'reset') { setMode(mode); }
    else if (a === 'labels') { showAll = !showAll; b.setAttribute('aria-pressed', showAll); }
    else if (a === 'calm') { calm = !calm; b.setAttribute('aria-pressed', calm); b.firstChild.textContent = calm ? '▶' : '⏸'; }
    else if (a === 'full') { full = !full; el.classList.toggle('xr-full', full); document.documentElement.classList.toggle('xr-lock', full); setTimeout(resize, 50); }
    else if (a === 'parts') toggleDrawer();
    else if (a === 'close') select(null);
    else if (a === 'arno') $('.xr-modal').hidden = true;
    else if (a === 'argo') startAR();
  };
  const toggleDrawer = (on) => { const d = $('.xr-drawer'); const open = on ?? d.hidden; d.hidden = !open; $('.xr-prog').setAttribute('aria-expanded', open); };
  stage.addEventListener('click', onClick);
  arOverlay.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'arexit') renderer.xr.getSession()?.end();
    else if (b.dataset.act === 'armove') { placed = false; arAnchor.visible = false; arOverlay.querySelector('.xr-arhint').textContent = U.ar_place; }
    else if (b.dataset.act === 'close') select(null);
    else if (b.dataset.part) select(b.dataset.part); });
  stage.addEventListener('keydown', e => {
    if (e.target.closest('input,textarea')) return;
    const sp = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target)); let used = true;
    if (e.key === 'ArrowLeft') sp.theta -= .15; else if (e.key === 'ArrowRight') sp.theta += .15;
    else if (e.key === 'ArrowUp') sp.phi = Math.max(.1, sp.phi - .12); else if (e.key === 'ArrowDown') sp.phi = Math.min(Math.PI - .1, sp.phi + .12);
    else if (e.key === '+' || e.key === '=') sp.radius = Math.max(controls.minDistance, sp.radius * .9); else if (e.key === '-') sp.radius = Math.min(controls.maxDistance, sp.radius * 1.1);
    else if (e.key === 'Escape' && full) { onClick({ target: stage.querySelector('[data-act=full]') }); }
    else used = false;
    if (used && /Arrow|\+|=|-/.test(e.key)) { e.preventDefault(); camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sp)); }
  });

  // ---------- loop ----------
  let lastPortrait = null; const resize = () => { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px'; camera.aspect = w / h; camera.updateProjectionMatrix(); const pt = camera.aspect < 1.1; if (lastPortrait !== null && pt !== lastPortrait && !arActive) setMode(mode, true); lastPortrait = pt; };
  const ro = new ResizeObserver(resize); ro.observe(stage);
  const clock = new THREE.Clock(); let t = 0, visible = true, running = false;
  const loop = (time, frame) => {
    const dt = Math.min(clock.getDelta(), .05); if (!calm) t += dt;
    if (frame && arActive) {
      if (!placed && hitSrc) { const hr = frame.getHitTestResults(hitSrc); if (hr.length) { const pose = hr[0].getPose(renderer.xr.getReferenceSpace()); reticle.visible = true; reticle.matrix.fromArray(pose.transform.matrix); } else reticle.visible = false; }
      eye.highlight(selected, t); renderer.render(scene, camera); return;
    }
    if (tween.t < 1) { tween.t = Math.min(1, (performance.now() - tween.s) / 1100); const e = tween.t < .5 ? 2 * tween.t * tween.t : 1 - Math.pow(-2 * tween.t + 2, 2) / 2; camera.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.q0, tween.q1, e); }
    controls.update();
    if (!intro.classList.contains('gone') && !calm) eye.group.rotation.y = Math.sin(t * .3) * .6; else eye.group.rotation.y *= .9;
    mata.update(t, dt, { reducedMotion: calm }); mata.object.lookAt(camera.position.x, mata.object.position.y, camera.position.z);
    particles.rotation.y = t * .01; particles.position.y = Math.sin(t * .2) * .1;
    if (mode === 'light') ljUpdate(t, dt);
    eye.highlight(selected, t);
    renderer.render(scene, camera); updateLabels();
  };
  const setRun = () => { const on = (visible && !document.hidden) || arActive; if (on !== running) { running = on; clock.getDelta(); renderer.setAnimationLoop(on ? loop : null); } };
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; setRun(); }); io.observe(stage);
  const onVis = () => setRun(); document.addEventListener('visibilitychange', onVis);
  el.__dbg = { camera, controls, eye };
  resize(); setMode('ext', true); renderProg(); setRun();
  el.querySelector('.xr-load').hidden = true; el.classList.add('ready');

  // ---------- teardown when the page changes (soft navigation) ----------
  const watch = setInterval(() => { if (el.isConnected) return;
    clearInterval(watch); renderer.setAnimationLoop(null); renderer.xr.getSession()?.end(); io.disconnect(); ro.disconnect();
    document.removeEventListener('visibilitychange', onVis); document.documentElement.classList.remove('xr-lock'); arOverlay.remove();
    eye.dispose(); renderer.dispose(); renderer.forceContextLoss(); }, 1000);
}
