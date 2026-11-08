// The world outside the eye, seen when you look out through the cornea (Haziq, 2026-11-08: "make it seem like Brunei outside").
// A painted panorama (equirectangular, straight ahead = the middle of the canvas): a soft morning sky, a golden-domed mosque on a
// lagoon (inspired by Brunei, not an exact building), Kampong Ayer stilt houses with boardwalks, a water taxi, palms and green hills.
import * as THREE from '/assets/three/three.module.min.js';

export function paintBrunei(PX = 4096) {
  const c = document.createElement('canvas'); c.width = PX; c.height = PX / 2;
  const W = 4096, H = 2048, g = c.getContext('2d'), HZ = H / 2, cx = W / 2; g.scale(PX / W, PX / W); // drawn in 4096-wide units, so a 60 degree view is about 680 units // horizon in the middle row, straight ahead in the middle column
  let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const lin = (y0, y1, stops) => { const l = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, col]) => l.addColorStop(o, col)); return l; };

  // sky
  g.fillStyle = lin(0, HZ, [[0, '#6fa9de'], [.45, '#9cc7ec'], [.8, '#f6d9c0'], [1, '#ffe2bf']]); g.fillRect(0, 0, W, HZ);
  const sun = g.createRadialGradient(cx + 520, HZ - 330, 0, cx + 520, HZ - 330, 300); sun.addColorStop(0, 'rgba(255,248,225,1)'); sun.addColorStop(.12, 'rgba(255,240,205,.9)'); sun.addColorStop(1, 'rgba(255,230,200,0)');
  g.fillStyle = sun; g.fillRect(0, 0, W, HZ);
  // soft clouds
  for (let i = 0; i < 90; i++) { const x = rnd() * W, y = HZ * (.15 + rnd() * .55), w = 60 + rnd() * 180;
    for (let k = 0; k < 6; k++) { const r = g.createRadialGradient(x + (k - 3) * w * .22, y + Math.sin(k) * 8, 0, x + (k - 3) * w * .22, y + Math.sin(k) * 8, w * .35);
      r.addColorStop(0, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(x - w * 1.2, y - w * .5, w * 2.4, w); } }
  // far hills (Bukit), two layers of rainforest green
  const hills = (base, amp, col, f) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, HZ); for (let x = 0; x <= W; x += 8) g.lineTo(x, HZ - base - amp * (.5 + .5 * Math.sin(x * f + 1.3) * Math.sin(x * f * .37 + 2))); g.lineTo(W, HZ); g.fill(); };
  hills(26, 40, '#a8c3a4', .006); hills(10, 26, '#7fa47e', .011);

  // water
  g.fillStyle = lin(HZ, H, [[0, '#b9d6dc'], [.12, '#7fb3c2'], [.5, '#4f8ea3'], [1, '#2c5f73']]); g.fillRect(0, HZ, W, H - HZ);

  // the mosque on its lagoon: white body, golden onion dome, slim minaret, small domes, arches
  const M = (x0, sc, refl) => {
    g.save(); g.translate(x0, HZ + 6); if (refl) { g.scale(1, -.75); g.globalAlpha = .35; }
    const gold = g.createLinearGradient(-60 * sc, 0, 60 * sc, 0); gold.addColorStop(0, '#b8862b'); gold.addColorStop(.35, '#ffe08a'); gold.addColorStop(.6, '#e9b949'); gold.addColorStop(1, '#9c6f1f');
    g.fillStyle = '#f7f2ea'; g.fillRect(-150 * sc, -70 * sc, 300 * sc, 70 * sc);                                   // prayer hall
    g.fillStyle = '#e8ded0'; g.fillRect(-150 * sc, -12 * sc, 300 * sc, 12 * sc);
    g.fillStyle = '#7a8fa3'; for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(i * 21 * sc - 7 * sc, -14 * sc); g.lineTo(i * 21 * sc - 7 * sc, -40 * sc); g.arc(i * 21 * sc, -40 * sc, 7 * sc, Math.PI, 0); g.lineTo(i * 21 * sc + 7 * sc, -14 * sc); g.fill(); }
    g.fillStyle = '#f7f2ea'; g.fillRect(-46 * sc, -112 * sc, 92 * sc, 44 * sc);                                     // drum
    g.fillStyle = gold; g.beginPath(); g.moveTo(-50 * sc, -110 * sc);                                                // onion dome
    g.bezierCurveTo(-74 * sc, -170 * sc, -20 * sc, -200 * sc, 0, -232 * sc); g.bezierCurveTo(20 * sc, -200 * sc, 74 * sc, -170 * sc, 50 * sc, -110 * sc); g.fill();
    g.fillRect(-2 * sc, -262 * sc, 4 * sc, 32 * sc); g.beginPath(); g.arc(0, -266 * sc, 6 * sc, 0, Math.PI * 2); g.fill();
    for (const sx of [-1, 1]) { g.fillStyle = '#f7f2ea'; g.fillRect(sx * 118 * sc - 12 * sc, -98 * sc, 24 * sc, 30 * sc);  // corner domes
      g.fillStyle = gold; g.beginPath(); g.moveTo(sx * 118 * sc - 15 * sc, -96 * sc); g.quadraticCurveTo(sx * 118 * sc, -150 * sc, sx * 118 * sc + 15 * sc, -96 * sc); g.fill(); }
    g.fillStyle = '#f7f2ea'; g.fillRect(185 * sc, -290 * sc, 22 * sc, 290 * sc);                                    // minaret
    g.fillStyle = '#e3d8c8'; for (let k = 1; k < 5; k++) g.fillRect(181 * sc, -k * 62 * sc, 30 * sc, 6 * sc);
    g.fillStyle = gold; g.beginPath(); g.moveTo(181 * sc, -290 * sc); g.quadraticCurveTo(196 * sc, -340 * sc, 211 * sc, -290 * sc); g.fill();
    g.restore();
  };
  M(cx, 1, true); M(cx, 1, false);
  // a stone royal barge in the lagoon (low, gold trim)
  g.fillStyle = '#efe6d6'; g.beginPath(); g.moveTo(cx - 250, HZ + 30); g.lineTo(cx - 90, HZ + 30); g.lineTo(cx - 110, HZ + 46); g.lineTo(cx - 236, HZ + 46); g.fill(); g.fillStyle = '#d9a843'; g.fillRect(cx - 240, HZ + 28, 140, 4);

  // Kampong Ayer: rows of stilt houses with pastel walls, boardwalks, on both sides
  const WALL = ['#f4c7c3', '#c9e2e6', '#f6e3b4', '#d8e8c8', '#e9d3ec', '#ffffff', '#f2d1b3', '#bcd6ea'], ROOF = ['#8b3a32', '#3f5f73', '#5b4636', '#a3523f', '#2f4858'];
  const village = (x0, x1, y, sc) => {
    g.fillStyle = 'rgba(70,60,50,.8)'; g.fillRect(x0, y + 18 * sc, x1 - x0, 4 * sc);                                // boardwalk
    for (let x = x0; x < x1; x += 8 * sc) g.fillRect(x, y + 18 * sc, 2 * sc, 22 * sc);                               // stilts
    for (let x = x0; x < x1 - 20 * sc;) { const w = (34 + rnd() * 30) * sc, h = (20 + rnd() * 12) * sc;
      g.fillStyle = 'rgba(40,40,40,.85)'; for (let k = 4; k < w; k += 9 * sc) g.fillRect(x + k, y + 16 * sc, 2 * sc, 26 * sc);
      g.fillStyle = WALL[Math.floor(rnd() * WALL.length)]; g.fillRect(x, y + 16 * sc - h, w, h);
      g.fillStyle = 'rgba(60,70,80,.55)'; g.fillRect(x + w * .2, y + 16 * sc - h * .7, w * .18, h * .4); g.fillRect(x + w * .58, y + 16 * sc - h * .7, w * .18, h * .4);
      g.fillStyle = ROOF[Math.floor(rnd() * ROOF.length)]; g.beginPath(); g.moveTo(x - 4 * sc, y + 17 * sc - h); g.lineTo(x + w / 2, y + 2 * sc - h - 10 * sc); g.lineTo(x + w + 4 * sc, y + 17 * sc - h); g.fill();
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, y + 44 * sc, w, 3 * sc);                                 // shimmer under the house
      x += w + (4 + rnd() * 10) * sc; }
  };
  village(cx - 900, cx - 300, HZ + 24, 1.05); village(cx + 260, cx + 920, HZ + 24, 1.05);
  village(cx - 1020, cx - 560, HZ + 70, 1.5); village(cx + 560, cx + 1020, HZ + 74, 1.5);
  village(cx + 1100, cx + 1600, HZ + 20, .9); village(cx - 1600, cx - 1100, HZ + 20, .9);

  // palms on the near banks
  const palm = (x, y, h, lean) => { g.strokeStyle = '#6d5a43'; g.lineWidth = h * .05; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * .5, y - h * .6, x + lean, y - h); g.stroke();
    g.strokeStyle = '#3f7d4f'; g.lineWidth = h * .035; for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, L = h * (.42 + .1 * Math.sin(k * 2)); g.beginPath(); g.moveTo(x + lean, y - h); g.quadraticCurveTo(x + lean + Math.cos(a) * L * .6, y - h - L * .35, x + lean + Math.cos(a) * L, y - h + Math.abs(Math.sin(a)) * L * .55 + L * .1); g.stroke(); } };
  palm(cx - 420, HZ + 30, 120, -14); palm(cx - 380, HZ + 34, 96, 10); palm(cx + 410, HZ + 30, 126, 16); palm(cx + 455, HZ + 36, 88, -8);
  // a water taxi with a little wake
  g.fillStyle = '#2f6d8c'; g.beginPath(); g.moveTo(cx + 120, HZ + 120); g.lineTo(cx + 230, HZ + 120); g.lineTo(cx + 250, HZ + 110); g.lineTo(cx + 110, HZ + 110); g.fill();
  g.fillStyle = '#f3efe6'; g.fillRect(cx + 150, HZ + 98, 50, 12); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + 110, HZ + 118); g.lineTo(cx + 20, HZ + 130); g.moveTo(cx + 110, HZ + 120); g.lineTo(cx + 30, HZ + 140); g.stroke();
  // ripples
  for (let i = 0; i < 2200; i++) { const y = HZ + 8 + Math.pow(rnd(), 1.6) * (H - HZ), w = 6 + (y - HZ) * .12 * rnd(); g.fillStyle = `rgba(255,255,255,${.06 + rnd() * .12})`; g.fillRect(rnd() * W, y, w, 1 + (y - HZ) / 260); }

  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = THREE.RepeatWrapping; return t;
}

// the sky dome that shows the painting (direction -> panorama; straight ahead, +Z, is the middle of the picture)
export function bruneiDome(radius = 190, px = 4096) {
  const map = paintBrunei(px);
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), new THREE.ShaderMaterial({ side: THREE.BackSide, fog: false, depthWrite: false, uniforms: { uMap: { value: map } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform sampler2D uMap; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float u = atan(-d.x, d.z) / 6.2831853 + .5; float v = asin(clamp(d.y,-1.,1.)) / 3.1415927 + .55;   // horizon a little below eye level, so looking out you see the mosque and the village
        gl_FragColor = vec4(texture2D(uMap, vec2(u, v)).rgb, 1.);
        #include <colorspace_fragment>
      }` }));
}
