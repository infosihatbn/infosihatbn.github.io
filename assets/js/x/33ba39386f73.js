
(function(){
const TR=[["calm-ambient.mp3", "Calm Ambient", "Velariomusic"], ["relax.mp3", "Relax", "The Mountain"], ["calm.mp3", "Calm", "MarloweMusic"]],K='is-music',T='is-music-t',VOL=.22;let ti=0;try{ti=+(localStorage.getItem('is-track')||0);if(!TR[ti])ti=0}catch(e){}
const url=i=>new URL('../assets/'+TR[i][0],location.href).href,SRC=url(ti);
const tip=()=>{const m=document.querySelector('.music-tip');if(m&&m.dataset.tpl)m.textContent=m.dataset.tpl.replace('{t}',TR[ti][1]).replace('{a}',TR[ti][2])};
let btn=document.querySelector('.music-btn');if(!btn)return;
let pref='on';try{pref=localStorage.getItem(K)||'on'}catch(e){}
const a=new Audio();a.src=SRC;a.loop=true;a.preload='none';a.volume=0;
try{const t=parseFloat(sessionStorage.getItem(T));if(t)a.currentTime=t}catch(e){}
let want=false;
/* iPhone ignores audio volume, so a fade there never ends: only fade where volume can be set. */
const VOK=(()=>{try{const t=new Audio();t.volume=.5;return Math.abs(t.volume-.5)<.01}catch(e){return false}})();
function ui(){btn.setAttribute('aria-pressed',want);btn.setAttribute('aria-label',want?btn.dataset.on:btn.dataset.off)}
function fade(to,done){clearInterval(a._f);if(!VOK){done&&done();return}let n=0;a._f=setInterval(()=>{if(++n>30||Math.abs(to-a.volume)<=.03){a.volume=to;clearInterval(a._f);done&&done()}else a.volume=Math.max(0,Math.min(1,a.volume+(to>a.volume?.03:-.03)))},40)}
function play(){want=true;ui();if(!a.paused){fade(VOL);return Promise.resolve()}if(VOK)a.volume=0;return a.play().then(()=>{if(!want){a.pause();return}fade(VOL)}).catch(()=>{if(a.paused){want=false;ui()}})}
function stop(){want=false;ui();fade(0,()=>{if(!want)a.pause()})}
function save(){try{sessionStorage.setItem(T,a.currentTime||0)}catch(e){}}
btn.addEventListener('click',e=>{e.stopPropagation();if(want){pref='off';stop()}else{pref='on';play()}try{localStorage.setItem(K,pref)}catch(e){}});
function first(e){if(btn.contains(e.target))return;off();if(pref==='on')play()}
function off(){['pointerdown','keydown','touchstart'].forEach(x=>removeEventListener(x,first,true))}
if(pref==='on'){play().then(()=>{if(!a.paused)off()});['pointerdown','keydown','touchstart'].forEach(x=>addEventListener(x,first,true))}
addEventListener('pagehide',save);
/* Some phones pause audio while the tab is in the background: carry on when the visitor comes back. */
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&pref==='on'&&a.paused&&a.currentTime>0)play()});setInterval(()=>{if(!a.paused)save()},2000);
tip();
window.__isMusic={playing:()=>!a.paused,get:()=>ti,set:i=>{if(!TR[i])return;ti=i;try{localStorage.setItem('is-track',i);sessionStorage.setItem(T,0)}catch(e){}tip();a.pause();a.src=url(i);a.currentTime=0;pref='on';try{localStorage.setItem(K,'on')}catch(e){}play()}};
ui();
/* Keep the music going between pages: while it plays, internal links swap the page content in place instead of reloading. */
const html=u=>fetch(u,{credentials:'same-origin',cache:'no-cache'}).then(r=>{if(!r.ok||!(r.headers.get('content-type')||'').includes('text/html'))throw 0;return r.text()});
function internal(u){return u.origin===location.origin&&!/\.(mp3|pdf|png|jpe?g|svg|json|zip)$/i.test(u.pathname)&&!u.pathname.includes('/embeds/')}
let busy=false;
async function go(url,push){
 if(busy)return;busy=true;
 try{
  const t=await html(url),d=new DOMParser().parseFromString(t,'text/html');
  if(!d.querySelector('main')||!d.querySelector('header.site'))throw 0;
  save();if(push)history.pushState({soft:1},'',url);
  const os=[...document.head.querySelectorAll('style,link[rel=stylesheet]')],ns=[...d.head.querySelectorAll('style,link[rel=stylesheet]')];
  if(os.map(x=>x.outerHTML).join('')!==ns.map(x=>x.outerHTML).join('')){ns.forEach(x=>document.head.appendChild(document.importNode(x,true)));os.forEach(x=>x.remove())}
  {const ob=[...document.body.querySelectorAll(':scope>style')],nb=[...d.body.querySelectorAll(':scope>style')];if(ob.map(x=>x.textContent).join('')!==nb.map(x=>x.textContent).join('')){const ref=ob[0]||document.body.firstChild;nb.forEach(x=>document.body.insertBefore(document.importNode(x,true),ref));ob.forEach(x=>x.remove())}}
  document.title=d.title;document.documentElement.lang=d.documentElement.lang;document.body.className=d.body.className;
  try{window.goatcounter&&goatcounter.count&&goatcounter.count({path:location.pathname,title:d.title})}catch(e){}
  const swap=()=>{
  const keep=document.querySelector('.music'),nh=document.importNode(d.querySelector('header.site'),true),nm=nh.querySelector('.music');
  if(nm&&keep)nm.replaceWith(keep);
  document.querySelector('header.site').replaceWith(nh);
  document.querySelector('main').replaceWith(document.importNode(d.querySelector('main'),true));
  const of=document.querySelector('footer'),nf=d.querySelector('footer');if(of&&nf)of.replaceWith(document.importNode(nf,true));};
  if(document.startViewTransition&&!matchMedia('(prefers-reduced-motion: reduce)').matches){try{await document.startViewTransition(swap).updateCallbackDone}catch(e){swap()}}else swap();
  document.querySelectorAll('body>script:not(#music-js)').forEach(x=>x.remove());
  document.querySelectorAll('main script').forEach(x=>{const t=(x.type||'').toLowerCase();if(t&&t!=='text/javascript'&&t!=='module')return;const n=document.createElement('script');if(t)n.type=t;if(x.src)n.src=x.src;else n.textContent=t==='module'?x.textContent:'{\n'+x.textContent+'\n}';x.replaceWith(n)});
  d.querySelectorAll('body>script:not(#music-js)').forEach(x=>{const n=document.createElement('script');[...x.attributes].forEach(a=>n.setAttribute(a.name,a.value));const t=(x.type||'').toLowerCase();if(x.src)n.async=false;else n.textContent=(t&&t!=='text/javascript')?x.textContent:'{\n'+x.textContent+'\n}';document.body.appendChild(n)});
  const h=new URL(url,location.href).hash;const el=h&&document.getElementById(decodeURIComponent(h.slice(1)));
  if(el)el.scrollIntoView();else scrollTo(0,0);
  const m=document.querySelector('main');if(m){m.setAttribute('tabindex','-1');m.focus({preventScroll:true})}
 }catch(e){location.href=url}
 busy=false}
document.addEventListener('click',e=>{
 if(a.paused||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
 const l=e.target.closest&&e.target.closest('a[href]');if(!l||l.target&&l.target!=='_self'||l.hasAttribute('download')||l.hasAttribute('data-hard'))return;
 const u=new URL(l.href,location.href);if(!internal(u))return;
 if(u.pathname===location.pathname&&u.search===location.search&&u.hash)return;
 e.preventDefault();go(u.href,true)});
history.replaceState(Object.assign({},history.state,{soft:1}),'');
addEventListener('popstate',e=>{if(e.state&&e.state.soft)go(location.href,false)});
})();
