// MataKitani offline support. Pages: network first, saved copy when offline. Files: saved copy, refreshed in the background.
const V='infosihat-20261008233557',CORE=["./", "./english/", "./eye-clinics/", "./klinik-mata/", "./manifest.webmanifest", "./assets/logo-128.png", "./assets/dark.css?v=20261008233557", "./offline.html"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>Promise.all(CORE.map(u=>c.add(new Request(u,{cache:'reload'})).catch(()=>{})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n.startsWith('infosihat-')&&n!==V).map(n=>caches.delete(n)))).then(()=>self.clients.claim()))});
const net=async(req,key)=>{try{const r=await fetch(req);if(r.ok){const c=await caches.open(V);c.put(key||req,r.clone())}return r}catch(err){return null}};
self.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='GET')return;const u=new URL(req.url);
 if(/\.(mp3|m4a|mp4)$/i.test(u.pathname)||req.headers.has('range'))return;
 const own=u.origin===location.origin,fonts=/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);if(!own&&!fonts)return;
 if(req.mode==='navigate'||u.pathname.endsWith('.json')){
  const key=new URL(u.pathname,u.origin).href;
  e.respondWith((async()=>(await net(req,key))||(await caches.match(key))||(await caches.match(req,{ignoreSearch:true}))||(req.mode==='navigate'?(await caches.match('./offline.html'))||Response.error():Response.error()))());return}
 e.respondWith((async()=>{const hit=await caches.match(req);const fresh=net(req);if(hit){e.waitUntil(fresh);return hit}return (await fresh)||Response.error()})())});
