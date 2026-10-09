// 3D version of Mata, the MataKitani mascot (fluffy green body, cream face, big eyes, yellow heart bag).
// Procedural geometry only. Faces +Z. Call update(t, dt) every frame.
import * as THREE from '/assets/three/three.module.min.js';

function furTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#7fb8a2'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, l = 4 + Math.random() * 7, a = Math.random() * Math.PI * 2;
    const v = Math.random();
    g.strokeStyle = v < .5 ? 'rgba(160,210,190,.35)' : 'rgba(70,120,100,.3)';
    g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createMata() {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const fur = new THREE.MeshStandardMaterial({ map: furTexture(), roughness: 1, metalness: 0, color: 0xffffff });
  const cream = new THREE.MeshStandardMaterial({ color: 0xf6ead8, roughness: .95 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b1a14, roughness: .25, metalness: 0 });
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pink = new THREE.MeshBasicMaterial({ color: 0xf2a6a0, transparent: true, opacity: .55 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf2b84b, roughness: .6 });

  // head (big, round) and small body
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), fur); head.scale.set(1.05, .95, .95); head.position.y = .55; body.add(head);
  const torso = new THREE.Mesh(new THREE.SphereGeometry(.62, 28, 20), fur); torso.position.y = -.45; torso.scale.set(1, .95, .9); body.add(torso);
  // cream face patch
  const face = new THREE.Mesh(new THREE.SphereGeometry(.78, 32, 24), cream); face.scale.set(1, .78, .45); face.position.set(0, .45, .6); body.add(face);
  // eyes
  const eyes = [];
  for (const s of [-1, 1]) {
    const eg = new THREE.Group(); eg.position.set(s * .32, .5, .93);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.16, 20, 16), dark); ball.scale.set(1, 1.15, .55); eg.add(ball);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 8), white); hl.position.set(.05, .07, .07); eg.add(hl);
    const hl2 = new THREE.Mesh(new THREE.SphereGeometry(.022, 8, 6), white); hl2.position.set(-.05, -.06, .08); eg.add(hl2);
    body.add(eg); eyes.push(eg);
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(.09, 16), pink); cheek.position.set(s * .5, .3, .93); cheek.lookAt(s * 1.2, .3, 3); body.add(cheek);
  }
  // smile
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(.1, .025, 8, 16, Math.PI), dark); mouth.rotation.z = Math.PI; mouth.position.set(0, .3, .97); body.add(mouth);
  // tufts on top
  for (const [x, z, r, s] of [[-.25, .1, -.4, .3], [0, 0, 0, .36], [.25, .1, .4, .3], [.05, -.25, .1, .26]]) {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(s * .55, s * 1.3, 14), fur); tuft.position.set(x, 1.45, z); tuft.rotation.z = r; body.add(tuft);
  }
  // little orange leaf
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 8), new THREE.MeshStandardMaterial({ color: 0xf5a24b, roughness: .6 })); leaf.scale.set(1.4, .6, .8); leaf.position.set(-.55, 1.25, .3); body.add(leaf);
  // arms
  const arms = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * .55, -.25, .05);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.14, .3, 6, 12), fur); arm.position.set(s * .12, -.18, 0); arm.rotation.z = s * .5; pivot.add(arm);
    body.add(pivot); arms.push(pivot);
  }
  // feet
  for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.SphereGeometry(.2, 14, 10), fur); f.scale.set(1, .6, 1.3); f.position.set(s * .25, -1, .1); body.add(f); }
  // yellow heart bag + strap
  const bag = new THREE.Group(); bag.position.set(.35, -.55, .55); bag.rotation.y = .3;
  const box = new THREE.Mesh(new THREE.BoxGeometry(.42, .32, .14), yellow); bag.add(box);
  const hs = new THREE.Shape(); hs.moveTo(0, -.06); hs.bezierCurveTo(-.1, .0, -.06, .09, 0, .04); hs.bezierCurveTo(.06, .09, .1, 0, 0, -.06);
  const heart = new THREE.Mesh(new THREE.ShapeGeometry(hs), white); heart.position.set(0, 0, .072); bag.add(heart);
  body.add(bag);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(.72, .03, 6, 40, Math.PI * .9), yellow); strap.rotation.set(0, 0, -2.3); strap.position.set(-.05, -.05, .35); strap.scale.set(1, 1, .6); body.add(strap);

  body.traverse(o => { if (o.isMesh) o.castShadow = false; });
  body.scale.setScalar(.5);

  let blinkT = 0, happyT = 0, spinT = 0;
  const api = {
    object: root,
    happy() { happyT = 1.2; spinT = 1; },
    update(t, dt, opts = {}) {
      const calm = opts.reducedMotion;
      body.position.y = calm ? 0 : Math.sin(t * 1.6) * .08;
      body.rotation.z = calm ? 0 : Math.sin(t * .9) * .05;
      // arms paddle gently; wave when happy
      const sw = opts.moving ? 1.6 : .5;
      arms[0].rotation.z = Math.sin(t * 3) * .25 * sw;
      arms[1].rotation.z = happyT > 0 ? -2.2 + Math.sin(t * 14) * .4 : -Math.sin(t * 3) * .25 * sw;
      // blink every ~3 s
      blinkT += dt; const b = blinkT % 3; const sy = b > 2.85 ? .1 : 1; eyes.forEach(e => e.scale.y = sy);
      if (happyT > 0) { happyT -= dt; eyes.forEach(e => e.scale.y = .35); }
      if (spinT > 0 && !calm) { spinT -= dt; body.rotation.y = (1 - spinT) * Math.PI * 2; } else body.rotation.y = 0;
    }
  };
  return api;
}
