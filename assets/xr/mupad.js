// MataUniverse phone controller (Haziq, 2026-10-15): opened by scanning the QR code on the big screen (?pad=<id>).
// Two thumb sticks and a few big buttons; inputs go to the game over a direct WebRTC link (PeerJS, vendored in /assets/xr).
export function mount(el, D) {
  const U = D.ui, id = new URLSearchParams(location.search).get('pad') || '';
  const intro = el.querySelector('.xi-intro'); if (intro) intro.remove(); el.querySelector('.xr-load').hidden = true; el.classList.add('ready', 'mp-on');
  const w = document.createElement('div'); w.className = 'mp';
  w.innerHTML = `<p class="mp-st" role="status">${U.pad_conn}</p>
  <div class="mp-row">
    <div class="mp-stick" data-s="m" aria-label="${U.pad_move}"><i></i><span>${U.pad_move}</span></div>
    <div class="mp-mid">
      <button type="button" class="mp-b mp-fire" data-b="fire">${U.fire}</button>
      <button type="button" class="mp-b mp-ok" data-b="ok">${U.inspect2}</button>
      <div class="mp-ud"><button type="button" class="mp-b" data-ud="1" aria-label="${U.up}">▲</button><button type="button" class="mp-b" data-ud="-1" aria-label="${U.down}">▼</button></div>
      <div class="mp-ud"><button type="button" class="mp-b mp-s" data-b="guide">${U.guide2}</button><button type="button" class="mp-b mp-s" data-b="pause">${U.pause2}</button></div>
    </div>
    <div class="mp-stick" data-s="l" aria-label="${U.pad_look}"><i></i><span>${U.pad_look}</span></div>
  </div>`;
  el.appendChild(w);
  const st = w.querySelector('.mp-st'), S = { x: 0, y: 0, lx: 0, ly: 0, ud: 0 };
  let conn = null, dirty = true, last = 0;
  const send = o => { try { if (conn && conn.open) conn.send(o); } catch (e) { } };
  // thumb sticks
  w.querySelectorAll('.mp-stick').forEach(pad => {
    const knob = pad.querySelector('i'), k = pad.dataset.s; let pid = null;
    const mv = e => { const r = pad.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2.4), y = (e.clientY - r.top - r.height / 2) / (r.height / 2.4); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
      if (k === 'm') { S.x = x; S.y = y; } else { S.lx = x; S.ly = y; } knob.style.transform = `translate(${x * 42}px,${y * 42}px)`; dirty = true; };
    pad.addEventListener('pointerdown', e => { pid = e.pointerId; pad.setPointerCapture(pid); mv(e); e.preventDefault(); });
    pad.addEventListener('pointermove', e => { if (e.pointerId === pid) mv(e); });
    const end = e => { if (e.pointerId !== pid) return; pid = null; if (k === 'm') { S.x = S.y = 0; } else { S.lx = S.ly = 0; } knob.style.transform = ''; dirty = true; };
    pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
  });
  w.querySelectorAll('[data-b]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); send({ b: b.dataset.b }); if (navigator.vibrate) navigator.vibrate(10); b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 150); }));
  { const fb = w.querySelector('[data-b=fire]'); if (fb) { fb.addEventListener('pointerdown', () => { S.f = 1; dirty = true; }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => fb.addEventListener(t, () => { S.f = 0; dirty = true; })); } } // held fire keeps the laser going
  w.querySelectorAll('[data-ud]').forEach(b => { const v = +b.dataset.ud; b.addEventListener('pointerdown', e => { e.preventDefault(); S.ud = v; dirty = true; }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, () => { S.ud = 0; dirty = true; })); });
  // stick values: on change, and every 250 ms so the game knows we are still here
  const tick = setInterval(() => { const now = performance.now(); if (dirty || now - last > 250) { send(S); dirty = false; last = now; } }, 50);
  let lock = null; const wake = () => { try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(l => lock = l).catch(() => { }); } catch (e) { } };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  const s = document.createElement('script'); s.src = '/assets/xr/peerjs.min.js';
  s.onerror = () => { st.textContent = U.rm_err; };
  s.onload = () => {
    const peer = new window.Peer();
    peer.on('open', () => { conn = peer.connect(id); conn.on('open', () => { st.textContent = U.pad_ready; st.classList.add('ok'); wake(); send(S); }); conn.on('close', () => { st.textContent = U.pad_lost; st.classList.remove('ok'); }); });
    peer.on('error', () => { st.textContent = U.pad_lost; st.classList.remove('ok'); });
    const watch = setInterval(() => { if (el.isConnected) return; clearInterval(watch); clearInterval(tick); try { peer.destroy(); } catch (e) { } if (lock) lock.release(); }, 1000);
  };
  document.head.appendChild(s);
}
