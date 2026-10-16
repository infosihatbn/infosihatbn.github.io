(()=>{const d=document.documentElement,R=matchMedia('(prefers-reduced-motion: reduce)').matches,main=document.querySelector('main');if(!main)return;
const head=document.querySelector('header.site');
const hn=head&&head.querySelector('.nav');if(hn&&!hn.querySelector('.mo-glint')){const g=document.createElement('span');g.className='mo-glint';g.setAttribute('aria-hidden','true');hn.prepend(g)}
if(!window.__mo){window.__mo=1;let q=0;
 addEventListener('pointermove',e=>{if(q)return;q=requestAnimationFrame(()=>{q=0;const h=document.querySelector('header.site .nav');if(!h)return;const r=h.getBoundingClientRect();if(e.clientY<r.bottom+40){h.style.setProperty('--mx',(e.clientX-r.left)+'px');h.style.setProperty('--my',(e.clientY-r.top)+'px')}})},{passive:true});
 const pb=document.createElement('div');pb.id='mo-prog';pb.setAttribute('aria-hidden','true');document.body.appendChild(pb);
 const sc=()=>{const y=scrollY,m=document.documentElement.scrollHeight-innerHeight;document.body.classList.toggle('mo-sc',y>24);const p=document.getElementById('mo-prog')||document.body.appendChild(pb);
  p.style.display=document.querySelector('.band:not([hidden])')&&m>innerHeight*.6?'':'none';p.style.transform='scaleX('+(m>0?Math.min(1,y/m):0)+')'};
 addEventListener('scroll',()=>requestAnimationFrame(sc),{passive:true});addEventListener('resize',sc);window.__moSc=sc;
 // fold-outs open and close with a soft unfold instead of a jump
 document.addEventListener('click',e=>{const s=e.target.closest('details.sec>summary');if(!s||R||e.target.closest('a'))return;const dt=s.parentElement,b=dt.querySelector(':scope>.sec-body');if(!b||!b.animate)return;
  e.preventDefault();if(dt._a)dt._a.cancel();
  if(!dt.open){dt.open=true;const h=b.scrollHeight;dt._a=b.animate([{height:'0px',opacity:0,transform:'translateY(-6px)'},{height:h+'px',opacity:1,transform:'none'}],{duration:Math.min(700,260+h*.35),easing:'cubic-bezier(.2,.7,.2,1)'});dt._a.onfinish=()=>{dt._a=null}}
  else{const h=b.offsetHeight;b.style.overflow='hidden';dt._a=b.animate([{height:h+'px',opacity:1},{height:'0px',opacity:0}],{duration:Math.min(480,200+h*.2),easing:'cubic-bezier(.4,0,.2,1)'});dt._a.onfinish=()=>{dt.open=false;b.style.overflow='';dt._a=null}}},true);
 // cards lean towards the pointer a little, like a sheet of card being picked up
 if(matchMedia('(hover:hover) and (pointer:fine)').matches&&!R){document.addEventListener('pointermove',e=>{const c=e.target.closest&&e.target.closest('.card,.tp');document.querySelectorAll('.mo-t').forEach(x=>{if(x!==c){x.classList.remove('mo-t');x.style.transform=''}});
  if(!c||c.closest('.rv:not(.in)'))return;const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;c.classList.add('mo-t');c.style.transform='perspective(900px) rotateX('+(-y*4).toFixed(2)+'deg) rotateY('+(x*5).toFixed(2)+'deg) translateY(-3px)'},{passive:true})}
 addEventListener('beforeprint',()=>document.querySelectorAll('.rv').forEach(x=>x.classList.add('in')));
}
window.__moSc&&window.__moSc();
if(R)return;d.classList.add('mo');
// headline: words rise out of a fold one after another
document.querySelectorAll('.band h1').forEach(h=>{if(h.dataset.mo)return;h.dataset.mo=1;let i=0;
 const walk=n=>{[...n.childNodes].forEach(c=>{if(c.nodeType===3){const f=document.createDocumentFragment();c.textContent.split(/(\s+)/).forEach(t=>{if(!t)return;if(/^\s+$/.test(t)){f.appendChild(document.createTextNode(t));return}
  const w=document.createElement('span');w.className='w';const s=document.createElement('span');s.textContent=t;s.style.setProperty('--i',i++);w.appendChild(s);f.appendChild(w)});c.replaceWith(f)}else if(c.nodeType===1)walk(c)})};walk(h)});
// everything else drifts up as it comes into view, a few at a time
const T=[...main.querySelectorAll('.band .byline,.band .band-tools,.content>*:not(.has-side),.main-col>*,.content>aside,.cards>*,.meds>*,.tps>*,.grid>*,.mgrid>*')].filter(e=>!e.closest('.ori')&&!e.classList.contains('rv')&&e.offsetParent!==null);
const io=new IntersectionObserver(es=>{let k=0;es.forEach(en=>{if(!en.isIntersecting)return;const el=en.target;el.style.setProperty('--dl',(k++*70)+'ms');el.classList.add('in');io.unobserve(el);
 setTimeout(()=>{el.classList.remove('rv','in');el.style.removeProperty('--dl');el.style.removeProperty('--rr')},1400+k*70)})},{rootMargin:'0px 0px -6% 0px',threshold:.06});
T.forEach((e,n)=>{e.classList.add('rv');if(e.matches('.cards>*,.tps>*,.grid>*'))e.style.setProperty('--rr',(n%2?.35:-.35)+'deg');io.observe(e)});
})()