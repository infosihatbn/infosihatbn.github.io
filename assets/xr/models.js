// MataUniverse model slot for img2threejs output.
// Off by default. Turn on with ?models=new (remembered) and off with ?models=old.
// Factories live in ./models/<slot>.js (built from website/models-src/*.ts by tools/img2three_port.py):
//   eye.js  - the big intro eyeball, in globe units (radius 1, +Z = cornea), used as is
//   ship.js - Mata's ship, same units as the old ship (nose +Z, seat at 0,.66,-.05 in the craft), used as is
//   mata.js - optional new Mata, scaled to fit the old one
import * as THREE from '/assets/three/three.module.min.js';

export function wantNewModels() {
  try {
    const q = new URLSearchParams(location.search).get('models');
    if (q === 'new' || q === 'old') localStorage.setItem('mu-models', q);
    return (q || localStorage.getItem('mu-models')) === 'new';
  } catch (e) { return false; }
}

async function factory(name, v) {
  try {
    const m = await import('./models/' + name + '.js?v=' + v);
    const f = Object.entries(m).find(([k, x]) => typeof x === 'function' && /^create.*Model$/.test(k));
    return f ? f[1] : (typeof m.default === 'function' ? m.default : null);
  } catch (e) { console.info('[models] no ' + name + ' model yet'); return null; }
}

// Fit a generated group into the same size as the object it replaces.
function fitTo(group, old) {
  const a = new THREE.Box3().setFromObject(old), b = new THREE.Box3().setFromObject(group);
  const sa = a.getSize(new THREE.Vector3()), sb = b.getSize(new THREE.Vector3());
  const k = Math.max(sa.x, sa.y, sa.z) / Math.max(sb.x, sb.y, sb.z || 1e-6);
  if (isFinite(k) && k > 0) group.scale.multiplyScalar(k);
  const cb = new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3());
  group.position.sub(cb.sub(old.getWorldPosition(new THREE.Vector3())));
}

// Hide the old meshes inside holder (sprites such as engine flames stay) and add the new group.
function swapIn(holder, g, fit) {
  if (!g || !g.isObject3D) return null;
  if (fit) { const s = holder.scale.clone(); holder.scale.set(1, 1, 1); holder.updateMatrixWorld(true); fitTo(g, holder); g.position.sub(holder.getWorldPosition(new THREE.Vector3())); holder.scale.copy(s); }
  holder.children.slice().forEach(c => { if (!c.isSprite) c.visible = false; });
  g.name = 'img2threejs'; holder.add(g);
  return g;
}

// Mata blinks every few seconds (both eyes), skipped when motion is reduced.
function addBlink(m) {
  if (!m.hd || !m.hd.clips || !m.hd.clips.blink) return;
  const upd = m.update.bind(m); let next = 1.5;
  m.update = (t, dt, o = {}) => { upd(t, dt, o); if (o.reducedMotion) return; next -= dt;
    if (next <= 0) { m.hd.play('blink'); next = 2.6 + Math.random() * 2.4 + (Math.random() < .2 ? -2.2 : 0); } };
}

// matas: Mata objects ({object, update, happy, hd}); eyes: {group}; ships: Object3D holders;
// riders: Mata objects that get their own ship underneath (the intro dive).
export async function applyNewModels({ matas = [], eyes = [], ships = [], riders = [], build = '' }) {
  const v = build || Date.now();
  const [mk, ek, sk] = await Promise.all([factory('mata', v), factory('eye', v), factory('ship', v)]);
  matas.forEach(addBlink);
  if (mk) matas.forEach(m => {
    const g = swapIn(m.object, mk({}, {}), true); if (!g) return;
    const y0 = g.position.y, upd = m.update.bind(m), hap = m.happy ? m.happy.bind(m) : null;
    let hop = 0;
    m.update = (t, dt, o = {}) => { upd(t, dt, o); hop = Math.max(0, hop - dt * 2);
      g.position.y = y0 + (o.reducedMotion ? 0 : Math.sin(t * 2.2) * .04 + Math.sin(hop * Math.PI) * .25); };
    m.happy = () => { hop = 1; hap && hap(); };
  });
  if (ek) eyes.forEach(e => swapIn(e.group, ek({}, {}), false));
  if (sk) {
    ships.forEach(h => swapIn(h, sk({}, {}), false));
    // in the craft Mata (scale .9) sits at y .66 over the ship (scale .9): same placement under a lone Mata
    riders.forEach(m => { const g = sk({}, {}); g.name = 'img2threejs-ship'; g.position.set(0, -.66 / .9, .05 / .9); m.object.add(g); m.object.scale.multiplyScalar(.62); });
  }
  return { mata: !!mk, eye: !!ek, ship: !!sk, blink: matas.length };
}
