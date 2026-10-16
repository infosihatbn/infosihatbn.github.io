// MataUniverse model slot for img2threejs output.
// Off by default. Turn on with ?models=new (remembered) and off with ?models=old.
// Generated factories live in ./models/mata.js and ./models/eye.js (built by tools/img2three_port.py).
import * as THREE from '/assets/three/three.module.min.js';

export function wantNewModels() {
  try {
    const q = new URLSearchParams(location.search).get('models');
    if (q === 'new' || q === 'old') localStorage.setItem('mu-models', q);
    return (q || localStorage.getItem('mu-models')) === 'new';
  } catch (e) { return false; }
}

async function factory(name) {
  try {
    const m = await import('./models/' + name + '.js?v=' + Date.now());
    const f = Object.entries(m).find(([k, v]) => typeof v === 'function' && /^create.*Model$/.test(k));
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

// Swap the visuals of Mata objects ({object, update, happy}) and eye objects ({group}).
// The old rig stays as the parent so position, scale and game logic are unchanged.
export async function applyNewModels({ matas = [], eyes = [] }) {
  const [mk, ek] = await Promise.all([factory('mata'), factory('eye')]);
  const swap = (holder, make) => {
    const g = make({}, {}); if (!g || !g.isObject3D) return;
    const kids = holder.children.slice();
    holder.updateMatrixWorld(true);
    const s = holder.scale.clone(); holder.scale.set(1, 1, 1); holder.updateMatrixWorld(true);
    fitTo(g, holder); g.position.sub(holder.getWorldPosition(new THREE.Vector3()));
    holder.scale.copy(s);
    kids.forEach(c => { c.visible = false; });
    g.name = 'img2threejs'; holder.add(g);
    return g;
  };
  if (mk) matas.forEach(m => {
    const g = swap(m.object, mk); if (!g) return;
    const y0 = g.position.y, upd = m.update.bind(m), hap = m.happy ? m.happy.bind(m) : null;
    let hop = 0;
    m.update = (t, dt, o = {}) => { upd(t, dt, o); hop = Math.max(0, hop - dt * 2);
      g.position.y = y0 + (o.reducedMotion ? 0 : Math.sin(t * 2.2) * .04 + Math.sin(hop * Math.PI) * .25); };
    m.happy = () => { hop = 1; hap && hap(); };
  });
  if (ek) eyes.forEach(e => swap(e.group, ek));
  return { mata: !!mk, eye: !!ek };
}
