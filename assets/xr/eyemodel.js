// Procedural anatomical model of a LEFT human eye for EyeXplore AR and MataUniverse.
// Units: eye radius = 1 (about 12 mm). Front of the eye faces +Z; nasal side is -X
// (so the optic disc and optic nerve sit on the -X side, kept visible in the cutaway).
import * as THREE from '/assets/three/three.module.min.js';

const V2 = (r, z) => new THREE.Vector2(Math.max(r, 0), z);
const arc = (R, a0, a1, n = 48, cz = 0) => { // profile points on a circle, polar angle from the back pole
  const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push(V2(R * Math.sin(a), cz - R * Math.cos(a))); } return p;
};
const DEG = Math.PI / 180;
export const DISC_DIR = new THREE.Vector3(-Math.sin(21 * DEG), 0, -Math.cos(21 * DEG));

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function irisTex() {
  return canvasTex(512, 512, (g, w) => {
    const c = w / 2;
    const gr = g.createRadialGradient(c, c, 60, c, c, 256);
    gr.addColorStop(0, '#3b2414'); gr.addColorStop(.35, '#6b4423'); gr.addColorStop(.8, '#4a2e17'); gr.addColorStop(1, '#2a1a0e');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 260; i++) {
      const a = Math.random() * Math.PI * 2, r0 = 70 + Math.random() * 30, r1 = 180 + Math.random() * 70;
      g.strokeStyle = `rgba(${150 + Math.random() * 60},${100 + Math.random() * 40},${50 + Math.random() * 30},${.25 + Math.random() * .3})`;
      g.lineWidth = 1 + Math.random() * 2; g.beginPath();
      g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
      g.quadraticCurveTo(c + Math.cos(a + .05) * (r0 + r1) / 2, c + Math.sin(a + .05) * (r0 + r1) / 2, c + Math.cos(a) * r1, c + Math.sin(a) * r1); g.stroke();
    }
    g.strokeStyle = 'rgba(200,150,90,.5)'; g.lineWidth = 6; g.beginPath(); g.arc(c, c, 115, 0, Math.PI * 2); g.stroke(); // collarette
  });
}
function scleraTex() {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#f6f1e8'; g.fillRect(0, 0, w, h);
    // faint conjunctival/episcleral vessels near the front (v=1 end of the lathe is the limbus)
    for (let i = 0; i < 40; i++) {
      let x = Math.random() * w, y = h * (.55 + Math.random() * .4);
      g.strokeStyle = `rgba(200,60,60,${.12 + Math.random() * .18})`; g.lineWidth = .8 + Math.random(); g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (Math.random() - .5) * 18; y += 6 + Math.random() * 8; g.lineTo(x, Math.min(y, h)); }
      g.stroke();
    }
  });
}
function discTex() {
  return canvasTex(128, 128, (g, w) => {
    const c = w / 2, gr = g.createRadialGradient(c, c, 4, c, c, 64);
    gr.addColorStop(0, '#fff6dc'); gr.addColorStop(.3, '#fbe7b5'); gr.addColorStop(.7, '#f0b88a'); gr.addColorStop(1, 'rgba(230,140,110,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
}
function maculaTex() {
  return canvasTex(128, 128, (g, w) => {
    const c = w / 2, gr = g.createRadialGradient(c, c, 0, c, c, 64);
    gr.addColorStop(0, 'rgba(90,25,20,.95)'); gr.addColorStop(.12, 'rgba(120,40,30,.8)'); gr.addColorStop(.5, 'rgba(150,60,40,.45)'); gr.addColorStop(1, 'rgba(160,70,50,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
}

// Sphere cap of radius R, angular radius ang (rad), centred on direction dir, facing inward.
function cap(R, ang, dir, mat) {
  const g = new THREE.SphereGeometry(R, 24, 6, 0, Math.PI * 2, 0, ang);
  const m = new THREE.Mesh(g, mat);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return m;
}
// Map tangent-plane coords (x, y) around the back pole onto the sphere of radius R
const onBack = (x, y, R) => new THREE.Vector3(x, y, -1).normalize().multiplyScalar(R);

function ribbon(points, w0, w1, mat, th = .07) {
  // flat strap with thickness (outer and inner faces plus edges), following the globe
  const pos = [], idx = [], uv = [], N = points.length;
  for (let i = 0; i < N; i++) {
    const p = points[i], t = points[Math.min(i + 1, N - 1)].clone().sub(points[Math.max(i - 1, 0)]).normalize();
    const n = p.clone().normalize(), s = new THREE.Vector3().crossVectors(n, t).normalize(), up = new THREE.Vector3().crossVectors(t, s).normalize();
    const w = (w0 + (w1 - w0) * i / (N - 1)) / 2, v = i / (N - 1);
    const o = p.clone().addScaledVector(up, th / 2), q = p.clone().addScaledVector(up, -th / 2);
    for (const [c, side] of [[o, 1], [o, -1], [q, -1], [q, 1]]) { pos.push(...c.clone().addScaledVector(s, side * w * (c === q ? .92 : 1)).toArray()); uv.push(side > 0 ? 1 : 0, v); }
    if (i) { const a = 4 * (i - 1), b = 4 * i; for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; idx.push(a + k, b + k, a + k2, a + k2, b + k, b + k2); } }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}
function muscleTex() {
  return canvasTex(64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#e9e1d2'); gr.addColorStop(.1, '#c7685b'); gr.addColorStop(.2, '#b2453b'); gr.addColorStop(1, '#9c3a32');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let x = 2; x < w; x += 4) { g.strokeStyle = `rgba(255,190,170,${.12 + Math.random() * .12})`; g.beginPath(); g.moveTo(x, h * .1); g.lineTo(x + (Math.random() - .5) * 3, h); g.stroke(); }
  });
}

export function createEye(opts = {}) {
  const group = new THREE.Group();
  const L = new THREE.Group(); L.rotation.x = Math.PI / 2; group.add(L); // lathe space: (r, y) -> y becomes +Z
  const clip = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.001)];
  const parts = {}; const mats = [];
  const add = (key, mesh, parent = group) => {
    (parts[key] = parts[key] || { meshes: [], anchor: null }).meshes.push(mesh);
    mesh.userData.part = key; parent.add(mesh);
    const ms = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    ms.forEach(m => { if (!mats.includes(m)) { m.userData.base = { e: (m.emissive ? m.emissive.clone() : null), o: m.opacity }; mats.push(m); } });
    return mesh;
  };
  const lathe = (pts, seg = 64) => new THREE.LatheGeometry(pts, seg);
  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ side: THREE.DoubleSide, roughness: .7 }, o));
  const phys = (o) => new THREE.MeshPhysicalMaterial(Object.assign({ side: THREE.DoubleSide, roughness: .08, transparent: true, depthWrite: false, clearcoat: 1 }, o));

  // Sclera: back pole to limbus (limbus radius 0.5, polar angle 150 deg)
  add('sclera', new THREE.Mesh(lathe(arc(1, 0, 150 * DEG)), std({ map: scleraTex(), roughness: .55 })), L);
  add('choroid', new THREE.Mesh(lathe(arc(.968, 0, 136 * DEG)), std({ color: 0x5e241d, roughness: .9 })), L);
  add('retina', new THREE.Mesh(lathe(arc(.94, 0, 122 * DEG)), std({ color: 0xd8714f, roughness: .85 })), L);
  // Conjunctiva: thin clear skin over the front of the sclera, folding back at the fornix
  add('conjunctiva', new THREE.Mesh(lathe(arc(1.014, 104 * DEG, 150 * DEG, 24)), phys({ color: 0xffdcd6, opacity: .22, roughness: .2 })), L);
  // Cornea: radius 0.65 (7.8 mm) dome meeting the sclera at the limbus
  const cz = .866 - Math.sqrt(.65 * .65 - .25);
  const corneaPts = []; for (let i = 0; i <= 32; i++) { const r = .5 * i / 32; corneaPts.push(V2(r, cz + Math.sqrt(.65 * .65 - r * r))); }
  add('cornea', new THREE.Mesh(lathe(corneaPts), phys({ color: 0xd6efff, opacity: .28, ior: 1.376 })), L);
  // Aqueous humour: space between cornea and iris/lens
  const aq = []; for (let i = 0; i <= 20; i++) { const r = .48 * i / 20; aq.push(V2(r, cz + Math.sqrt(.63 * .63 - r * r))); }
  aq.push(V2(.54, .745), V2(.52, .728), V2(.16, .728), V2(.16, .672), V2(0, .686));
  add('aqueous', new THREE.Mesh(lathe(aq.reverse()), phys({ color: 0x8fdcff, opacity: .16, clearcoat: 0 })), L);
  // Lens: biconvex, equator radius 0.38 (4.5 mm), about 4 mm thick
  const lensPts = []; for (let i = 0; i <= 24; i++) { const a = Math.PI / 2 * i / 24; lensPts.push(V2(.38 * Math.sin(a), .515 + .17 * Math.cos(a))); }
  for (let i = 1; i <= 24; i++) { const a = Math.PI / 2 + Math.PI / 2 * i / 24; lensPts.push(V2(.38 * Math.sin(a), .515 + .16 * Math.cos(a))); }
  add('lens', new THREE.Mesh(lathe(lensPts.reverse()), phys({ color: 0xfff1c2, opacity: .6, roughness: .2 })), L);
  // Ciliary body: ring of muscle behind the iris root; zonules hold the lens
  add('ciliary', new THREE.Mesh(lathe([V2(.66, .75), V2(.56, .72), V2(.47, .62), V2(.52, .58), V2(.79, .56), V2(.66, .75)]), std({ color: 0x7a3a2a, roughness: .8 })), L);
  const zon = []; for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; for (const dz of [.03, -.03]) zon.push(.47 * Math.cos(a), .47 * Math.sin(a), .61, .38 * Math.cos(a + .03), .38 * Math.sin(a + .03), .515 + dz); }
  const zg = new THREE.BufferGeometry(); zg.setAttribute('position', new THREE.Float32BufferAttribute(zon, 3));
  add('ciliary', new THREE.LineSegments(zg, new THREE.LineBasicMaterial({ color: 0xe8dcc0, transparent: true, opacity: .7 })));
  // Vitreous humour
  const vit = [V2(0, .352), V2(.25, .40), V2(.37, .48), V2(.5, .56)].concat(arc(.936, 122 * DEG, 0, 40));
  add('vitreous', new THREE.Mesh(lathe(vit), phys({ color: 0xc4cfff, opacity: .1, clearcoat: 0 })), L);
  // Iris + pupil (in front of the lens)
  const iris = add('iris', new THREE.Mesh(new THREE.RingGeometry(.16, .55, 64, 1), std({ map: irisTex(), roughness: .8 })));
  iris.position.z = .728;
  // planar UVs for the ring so the radial texture lines up
  { const p = iris.geometry.attributes.position, uv = iris.geometry.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 1.1 + .5, p.getY(i) / 1.1 + .5); }
  const pupil = add('pupil', new THREE.Mesh(new THREE.CircleGeometry(.16, 48), new THREE.MeshBasicMaterial({ color: 0x050608, transparent: true, opacity: .9, side: THREE.DoubleSide })));
  pupil.position.z = .726;
  // Macula, fovea, optic disc (caps on the retina, seen from inside)
  const back = new THREE.Vector3(0, 0, -1);
  add('macula', cap(.936, .21, back, new THREE.MeshBasicMaterial({ map: maculaTex(), transparent: true, side: THREE.DoubleSide, depthWrite: false })));
  add('fovea', cap(.933, .035, back, new THREE.MeshBasicMaterial({ color: 0x4a120d, side: THREE.DoubleSide })));
  add('disc', cap(.934, .085, DISC_DIR, new THREE.MeshBasicMaterial({ map: discTex(), transparent: true, side: THREE.DoubleSide })));
  // Retinal blood vessels: arcades from the disc around the macula
  const vessels = [];
  const dx = DISC_DIR.x / -DISC_DIR.z; // disc position in tangent coords
  const branches = [
    [[dx, .02], [dx + .1, .2], [-.05, .34], [.25, .36], [.55, .25], [.95, .1]],
    [[dx, -.02], [dx + .1, -.2], [-.05, -.33], [.25, -.38], [.55, -.28], [.95, -.15]],
    [[dx, .03], [dx - .2, .2], [dx - .5, .35], [dx - .8, .45]],
    [[dx, -.03], [dx - .2, -.22], [dx - .5, -.38], [dx - .8, -.5]],
    [[.0, .34], [.15, .6], [.2, .9]], [[.0, -.33], [.12, -.62], [.2, -.95]],
    [[dx + .1, .2], [dx - .05, .55], [dx - .1, .9]], [[dx + .1, -.2], [dx - .05, -.55], [dx - .1, -.9]],
    [[.25, .36], [.12, .15]], [[.25, -.38], [.12, -.16]]
  ];
  // tangent coords: disc on the nasal (-X) side, arcades sweep temporally (+X) around the macula
  for (const [bi, b] of branches.entries()) {
    for (const [k, col, off] of [[0, 0xc8402f, .012], [1, 0x7e1c17, -.012]]) {
      const pts = b.map(([x, y]) => onBack(x + off * .5, y + off, .928 - k * .001));
      const curve = new THREE.CatmullRomCurve3(pts);
      const r = (bi < 4 ? .011 : .007) * (k ? 1.25 : 1);
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, r, 5, false), new THREE.MeshStandardMaterial({ color: col, roughness: .5 }));
      vessels.push(curve); add('retina', m);
    }
  }
  // Optic nerve leaving the back of the eye, heading back and towards the nose
  const nCurve = new THREE.CatmullRomCurve3([DISC_DIR.clone().multiplyScalar(.93), DISC_DIR.clone().multiplyScalar(1.25), new THREE.Vector3(-.62, 0, -1.6), new THREE.Vector3(-.8, 0, -2.35)]);
  add('nerve', new THREE.Mesh(new THREE.TubeGeometry(nCurve, 30, .15, 20, true), std({ color: 0xefe2c4, roughness: .6 })));
  // Extraocular muscles: the four rectus muscles (insertion distance from the limbus in brackets)
  const apex = new THREE.Vector3(-.35, 0, -3.1);
  const mus = std({ map: muscleTex(), roughness: .65 });
  for (const [alpha, ins] of [[Math.PI, 124], [0, 115], [Math.PI / 2, 113], [-Math.PI / 2, 120]]) { // medial, lateral, superior, inferior
    const pts = [];
    for (let i = 0; i <= 18; i++) { const ph = (ins - (ins - 32) * i / 18) * DEG; pts.push(new THREE.Vector3(Math.sin(ph) * Math.cos(alpha), Math.sin(ph) * Math.sin(alpha), -Math.cos(ph)).multiplyScalar(1.035)); }
    const last = pts[pts.length - 1]; for (let i = 1; i <= 6; i++) pts.push(last.clone().lerp(apex, i / 6));
    add('muscles', ribbon(pts, .62, .2, mus));
  }
  // Anchor points for labels (and the outward normal used to hide labels facing away)
  const A = (k, v, n) => { parts[k].anchor = v; parts[k].normal = n || v.clone().normalize(); };
  A('cornea', new THREE.Vector3(0, .25, 1.07)); A('conjunctiva', new THREE.Vector3(0, .82, .62)); A('sclera', new THREE.Vector3(.7, .55, .1));
  A('iris', new THREE.Vector3(.38, .05, .73), new THREE.Vector3(0, 0, 1)); A('pupil', new THREE.Vector3(0, 0, .73), new THREE.Vector3(0, 0, 1));
  A('lens', new THREE.Vector3(0, -.2, .55), new THREE.Vector3(1, 0, 0)); A('ciliary', new THREE.Vector3(0, -.6, .64), new THREE.Vector3(1, 0, 0));
  A('aqueous', new THREE.Vector3(0, .2, .85), new THREE.Vector3(1, 0, 0)); A('vitreous', new THREE.Vector3(0, .3, -.1), new THREE.Vector3(1, 0, 0));
  A('retina', new THREE.Vector3(0, .82, -.45), new THREE.Vector3(1, 0, 0)); A('choroid', new THREE.Vector3(0, -.85, -.42), new THREE.Vector3(1, 0, 0));
  A('macula', new THREE.Vector3(0, .1, -.93), new THREE.Vector3(1, 0, .4)); A('fovea', new THREE.Vector3(0, -.02, -.93), new THREE.Vector3(1, 0, .4));
  A('disc', DISC_DIR.clone().multiplyScalar(.93), new THREE.Vector3(1, 0, .4)); A('nerve', new THREE.Vector3(-.7, 0, -1.9), new THREE.Vector3(0, 1, 0));
  A('muscles', new THREE.Vector3(0, 1.04, -.2));

  let cut = false;
  const api = {
    group, parts, vessels, nerveCurve: nCurve,
    setCut(on) {
      cut = on; mats.forEach(m => { m.clippingPlanes = on ? clip : null; m.needsUpdate = true; });
    },
    get cut() { return cut; },
    isClipped(p) { return cut && p.x > 0.002; }, // p in group-local space
    highlight(key, t = 0) {
      for (const [k, part] of Object.entries(parts)) for (const mesh of part.meshes) {
        const ms = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of ms) {
          const b = m.userData.base; const on = k === key;
          if (m.emissive) m.emissive.setRGB(on ? .25 + .15 * Math.sin(t * 4) : b.e.r, on ? .55 + .15 * Math.sin(t * 4) : b.e.g, on ? .6 + .15 * Math.sin(t * 4) : b.e.b);
          if (m.transparent && b.o < .6) m.opacity = on ? Math.min(.55, b.o + .3) : b.o;
          if (m.isMeshBasicMaterial && !m.transparent) m.color.offsetHSL(0, 0, 0);
        }
      }
    },
    show(key, vis) { parts[key].meshes.forEach(m => m.visible = vis); },
    dispose() { group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); }
  };
  return api;
}
