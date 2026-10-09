// A realistic-looking outside view of the eyeball for the MataUniverse intro: wet sclera with fine vessels,
// the four rectus muscles and two obliques with fibre texture, the optic nerve, a detailed iris and a glossy
// cornea that reflects soft studio lights. Radius 1, front of the eye is +Z, left eye (nasal side is -X).
// Procedural textures only (canvas), so nothing extra to download.
import * as THREE from '/assets/three/three.module.min.js';

const rnd = (a, b) => a + Math.random() * (b - a);

// ---------- textures ----------
function scleraTex() {
  const W = 2048, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  // u = around the eye, v = from the limbus (top) to the back of the eye (bottom)
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#b9b5ae'); grd.addColorStop(.035, '#ece8e2'); grd.addColorStop(.25, '#f4efe9'); grd.addColorStop(.7, '#efdcd4'); grd.addColorStop(1, '#e2c3bb');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  // soft blotches so it does not look like plastic
  for (let i = 0; i < 260; i++) { const x = rnd(0, W), y = rnd(0, H), r = rnd(20, 90); const rg = g.createRadialGradient(x, y, 0, x, y, r);
    const pink = Math.random() < .5 + y / H * .4; rg.addColorStop(0, pink ? 'rgba(225,165,160,.13)' : 'rgba(255,255,250,.18)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); }
  // branching vessels: run from the back towards the limbus, thinning as they go
  const vessel = (x, y, w, ang, len, blue, depth) => {
    g.strokeStyle = blue ? `rgba(95,85,165,${.35 + w * .08})` : `rgba(${170 + Math.random() * 30 | 0},40,45,${.32 + w * .1})`;
    g.lineCap = 'round'; let px = x, py = y;
    const steps = len / 6 | 0;
    for (let s = 0; s < steps; s++) {
      ang += rnd(-.28, .28); const nx = px + Math.cos(ang) * 6, ny = py + Math.sin(ang) * 6;
      g.lineWidth = Math.max(.6, w * (1 - s / steps * .6)); g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
      if (depth < 3 && Math.random() < .045) vessel(nx, ny, w * .6, ang + (Math.random() < .5 ? -1 : 1) * rnd(.5, 1.1), len * rnd(.35, .6), blue, depth + 1);
      px = (nx + W) % W; py = ny; if (py < 14) break;
    }
  };
  for (let i = 0; i < 46; i++) vessel(rnd(0, W), rnd(H * .55, H), rnd(1.6, 3.2), -Math.PI / 2 + rnd(-.5, .5), rnd(260, 700), i % 4 === 0, 0);
  // fine conjunctival vessels near the limbus
  for (let i = 0; i < 70; i++) vessel(rnd(0, W), rnd(40, 260), rnd(.6, 1.1), -Math.PI / 2 + rnd(-.8, .8), rnd(40, 160), i % 5 === 0, 2);
  // darker ring right at the limbus
  const lg = g.createLinearGradient(0, 0, 0, 40); lg.addColorStop(0, 'rgba(120,118,112,.75)'); lg.addColorStop(1, 'rgba(120,118,112,0)'); g.fillStyle = lg; g.fillRect(0, 0, W, 40);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}

function irisTex() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), C = S / 2;
  const R = S / 2, P = R * .3; // iris radius, pupil radius
  const base = g.createRadialGradient(C, C, P, C, C, R);
  base.addColorStop(0, '#3a2a12'); base.addColorStop(.12, '#8a6524'); base.addColorStop(.32, '#9b7a33'); base.addColorStop(.45, '#6f8058');
  base.addColorStop(.72, '#5f7f74'); base.addColorStop(.9, '#4c675f'); base.addColorStop(1, '#1f2b27');
  g.fillStyle = base; g.beginPath(); g.arc(C, C, R, 0, Math.PI * 2); g.fill();
  // radial fibres
  for (let i = 0; i < 2600; i++) {
    const a = rnd(0, Math.PI * 2), r0 = P + rnd(0, R * .15), r1 = r0 + rnd(R * .2, R * .65), wob = rnd(-.05, .05);
    const light = Math.random() < .55; g.strokeStyle = light ? `rgba(${200 + rnd(0, 40) | 0},${180 + rnd(0, 40) | 0},${120 + rnd(0, 50) | 0},${rnd(.08, .22)})` : `rgba(20,25,15,${rnd(.1, .25)})`;
    g.lineWidth = rnd(.8, 2.4); g.beginPath(); g.moveTo(C + Math.cos(a) * r0, C + Math.sin(a) * r0);
    g.quadraticCurveTo(C + Math.cos(a + wob) * (r0 + r1) / 2, C + Math.sin(a + wob) * (r0 + r1) / 2, C + Math.cos(a + wob * 2) * r1, C + Math.sin(a + wob * 2) * r1); g.stroke();
  }
  // crypts (small dark pits) and the wavy collarette
  for (let i = 0; i < 70; i++) { const a = rnd(0, Math.PI * 2), r = rnd(R * .42, R * .8), s = rnd(4, 13); g.fillStyle = `rgba(25,30,20,${rnd(.2, .45)})`;
    g.beginPath(); g.ellipse(C + Math.cos(a) * r, C + Math.sin(a) * r, s * .5, s, a, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = 'rgba(205,165,90,.55)'; g.lineWidth = 5; g.beginPath();
  for (let i = 0; i <= 120; i++) { const a = i / 120 * Math.PI * 2, r = R * .44 + Math.sin(a * 13) * 7 + Math.sin(a * 5) * 5; i ? g.lineTo(C + Math.cos(a) * r, C + Math.sin(a) * r) : g.moveTo(C + Math.cos(a) * r, C + Math.sin(a) * r); }
  g.stroke();
  // pupil with a soft ruff, and a dark limbal ring
  const pg = g.createRadialGradient(C, C, P * .9, C, C, P * 1.12); pg.addColorStop(0, '#050505'); pg.addColorStop(.75, '#0a0806'); pg.addColorStop(1, 'rgba(40,25,10,0)');
  g.fillStyle = pg; g.beginPath(); g.arc(C, C, P * 1.12, 0, Math.PI * 2); g.fill();
  const lr = g.createRadialGradient(C, C, R * .86, C, C, R); lr.addColorStop(0, 'rgba(15,22,20,0)'); lr.addColorStop(1, 'rgba(15,22,20,.85)');
  g.fillStyle = lr; g.beginPath(); g.arc(C, C, R, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

function muscleTex() {
  const W = 256, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  // v = 0 at the tendon (insertion), v = 1 at the back. Tendon is pale and shiny, belly is red-pink.
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#efe3dc'); grd.addColorStop(.08, '#e6cfc6'); grd.addColorStop(.17, '#c8796c'); grd.addColorStop(.5, '#b5574c'); grd.addColorStop(1, '#9c4740');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) { const x = rnd(0, W), w = rnd(.6, 2.2), light = Math.random() < .5;
    g.strokeStyle = light ? `rgba(255,215,205,${rnd(.08, .25)})` : `rgba(90,25,25,${rnd(.08, .22)})`; g.lineWidth = w;
    g.beginPath(); g.moveTo(x, rnd(0, H * .3)); g.bezierCurveTo(x + rnd(-6, 6), H * .4, x + rnd(-8, 8), H * .7, x + rnd(-10, 10), H); g.stroke(); }
  // a few small vessels on the muscle
  for (let i = 0; i < 6; i++) { let x = rnd(30, W - 30), y = rnd(H * .2, H * .9); g.strokeStyle = 'rgba(120,20,30,.35)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 18; s++) { x += rnd(-6, 6); y -= rnd(6, 14); g.lineTo(x, y); } g.stroke(); }
  // soft dark edges so the bands read as rounded
  const eg = g.createLinearGradient(0, 0, W, 0); eg.addColorStop(0, 'rgba(60,15,15,.35)'); eg.addColorStop(.18, 'rgba(0,0,0,0)'); eg.addColorStop(.82, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(60,15,15,.35)');
  g.fillStyle = eg; g.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// soft "studio" lights for the wet reflections (the window-shaped highlights on the cornea)
function studioEnv(renderer) {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x1b2230);
  const box = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }));
  { const p = box.geometry.attributes.position, col = []; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 20; const k = .1 + Math.max(0, y) * .2; col.push(k * .9, k, k * 1.2); }
    box.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); }
  s.add(box);
  const panel = (w, h, x, y, z, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k * .97), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); };
  panel(9, 6, -7, 7, 11, 6);    // big key softbox, upper left
  panel(4, 9, 12, 1, 6, 2.2);   // tall strip on the right
  panel(14, 2, 0, -9, 8, 1.2);  // floor bounce
  const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromScene(s, .02); pm.dispose();
  s.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return rt;
}

// a band lying on the globe, following a path of unit vectors, bulging in the middle
function band(path, width, thick, segL = 90, segW = 14) {
  const pos = [], uv = [], idx = [], P = new THREE.Vector3(), Q = new THREE.Vector3(), lat = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= segL; i++) {
    const s = i / segL; path(s, P); path(Math.min(1, s + .002), Q); if (s >= 1) { path(s - .002, Q); Q.sub(P).negate().add(P); }
    lat.copy(P).normalize().cross(Q.sub(P)).normalize();
    const w = width(s), th = thick(s), rad = P.length();
    for (let j = 0; j <= segW; j++) {
      const u = j / segW, a = (u - .5) * w, bul = Math.pow(Math.max(0, 1 - Math.pow((u - .5) * 2, 2)), .6);
      v.copy(P).normalize().multiplyScalar(Math.cos(a)).addScaledVector(lat, Math.sin(a)).normalize().multiplyScalar(rad * (1.004 + th * bul));
      pos.push(v.x, v.y, v.z); uv.push(u, s);
    }
  }
  for (let i = 0; i < segL; i++) for (let j = 0; j < segW; j++) { const a = i * (segW + 1) + j, b = a + segW + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const dirOf = (theta, phi, out) => out.set(Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta));

export function createRealEye(renderer) {
  const group = new THREE.Group(), disposables = [];
  const env = studioEnv(renderer); disposables.push(env);
  const LIMB = Math.asin(.5); // the limbus sits 30 degrees from the front pole

  // sclera
  const sTex = scleraTex(); disposables.push(sTex);
  const sclera = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96, 0, Math.PI * 2, LIMB, Math.PI - LIMB).rotateX(Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ map: sTex, roughness: .42, clearcoat: .7, clearcoatRoughness: .12, envMap: env.texture, envMapIntensity: .9, sheen: .3, sheenColor: new THREE.Color(0xffdcd6), side: THREE.DoubleSide }));
  group.add(sclera);

  // iris (slightly domed towards the pupil) behind the cornea, with a dark eye interior behind it
  const iTex = irisTex(); disposables.push(iTex);
  const ig = new THREE.CircleGeometry(.485, 96, 0, Math.PI * 2); { const p = ig.attributes.position; for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getY(i)); p.setZ(i, .035 * (1 - r / .485)); } ig.computeVertexNormals(); }
  const iris = new THREE.Mesh(ig, new THREE.MeshPhysicalMaterial({ map: iTex, roughness: .55, envMap: env.texture, envMapIntensity: .35 })); iris.position.z = .80; group.add(iris);
  const inside = new THREE.Mesh(new THREE.CircleGeometry(.5, 48), new THREE.MeshBasicMaterial({ color: 0x050303 })); inside.position.z = .78; group.add(inside);

  // cornea: a clear dome that only shows reflections (additive), plus a faint grey rim
  const RC = .78, ZC = .866 - Math.sqrt(RC * RC - .25);
  const cg = new THREE.SphereGeometry(RC, 96, 32, 0, Math.PI * 2, 0, Math.asin(.5 / RC)).rotateX(Math.PI / 2); cg.translate(0, 0, ZC);
  const cornea = new THREE.Mesh(cg, new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: .02, metalness: 0, clearcoat: 1, clearcoatRoughness: 0, envMap: env.texture, envMapIntensity: 2.4, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  cornea.renderOrder = 2; group.add(cornea);
  const haze = new THREE.Mesh(cg.clone(), new THREE.MeshBasicMaterial({ color: 0xbfd2dc, transparent: true, opacity: .025, depthWrite: false })); haze.renderOrder = 1; group.add(haze);

  // extraocular muscles (insertions: medial 5.5 mm, inferior 6.5, lateral 6.9, superior 7.7 behind the limbus; 1 mm ~ .042 here)
  const mTex = muscleTex(); disposables.push(mTex);
  const mMat = new THREE.MeshPhysicalMaterial({ map: mTex, roughness: .5, clearcoat: .45, clearcoatRoughness: .25, envMap: env.texture, envMapIntensity: .7, sheen: .4, sheenColor: new THREE.Color(0xffc8c0), side: THREE.DoubleSide });
  const recti = [['medial', Math.PI, 5.5], ['lateral', 0, 6.9], ['superior', Math.PI / 2, 7.7], ['inferior', -Math.PI / 2, 6.5]];
  for (const [name, phi, mm] of recti) {
    const t0 = LIMB + mm * .042, t1 = 2.75;
    const g = band((s, out) => dirOf(t0 + (t1 - t0) * s, phi, out), s => .44 - .2 * s, s => s < .12 ? .015 + s * .3 : .055 + .03 * Math.sin(Math.PI * Math.min(1, s * 1.3)));
    const m = new THREE.Mesh(g, mMat); m.name = name + '_rectus'; group.add(m);
  }
  // superior oblique tendon runs over the top towards the nose (to the trochlea); inferior oblique wraps underneath
  const arc = (a, b, lift) => (s, out) => { out.copy(a).lerp(b, s).normalize().multiplyScalar(1 + lift * Math.pow(Math.max(0, s - .7) / .3, 2)); return out; };
  const so = band(arc(dirOf(1.75, 1.15, new THREE.Vector3()), dirOf(1.2, 2.15, new THREE.Vector3()), 0), s => .2 - .06 * s, s => .03);
  group.add(Object.assign(new THREE.Mesh(so, mMat), { name: 'superior_oblique' }));
  const io = band(arc(dirOf(1.95, -.75, new THREE.Vector3()), dirOf(1.35, -2.25, new THREE.Vector3()), .08), s => .26 - .06 * s, s => .05);
  group.add(Object.assign(new THREE.Mesh(io, mMat), { name: 'inferior_oblique' }));

  // optic nerve leaving the back, a little to the nasal side
  const nerve = new THREE.Mesh(new THREE.CylinderGeometry(.17, .19, 1.4, 32, 1, true).rotateX(Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: 0xeed9c8, roughness: .5, clearcoat: .4, envMap: env.texture, envMapIntensity: .6 }));
  nerve.position.set(-.18, 0, -1.55); nerve.lookAt(-.4, 0, -3); group.add(nerve);

  return {
    group, cornea, iris,
    dispose() { disposables.forEach(d => d.dispose()); group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
  };
}
