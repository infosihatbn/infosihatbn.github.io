(()=>{const sky=document.getElementById('sky');if(!sky||sky.querySelector('canvas'))return;const cv=document.createElement('canvas');sky.appendChild(cv);const x=cv.getContext('2d');
const R=matchMedia('(prefers-reduced-motion: reduce)').matches;let W=0,H=0,dp=1;function rs(){dp=Math.min(devicePixelRatio||1,1.5);W=innerWidth;H=innerHeight;cv.width=W*dp;cv.height=H*dp}rs();addEventListener('resize',rs);
let sd=11;const r=()=>(sd=sd*16807%2147483647)/2147483647;const N=innerWidth<700?12:26;
const S=[...Array(N)].map(()=>{const n=r()<.5?3:4,p=[];for(let i=0;i<n;i++){const a=i/n*6.283+r()*.9,d=.55+r()*.45;p.push([Math.cos(a)*d,Math.sin(a)*d])}return{x:r(),y:r(),z:.25+r()*.85,a:r()*6.3,va:(r()-.5)*.25,vx:(r()-.5)*.006,vy:-(.003+r()*.008),p,f:r()}});
const D=[...Array(innerWidth<700?50:110)].map(()=>({x:r(),y:r(),z:r(),ph:r()*6.3}));
let mx=0,my=0,tx=0,ty=0,cx=-9e3,cy=-9e3;addEventListener('pointermove',e=>{tx=e.clientX/innerWidth*2-1;ty=e.clientY/innerHeight*2-1;cx=e.clientX;cy=e.clientY},{passive:true});document.addEventListener('pointerleave',()=>{cx=cy=-9e3});
let last=performance.now(),f0=0;function draw(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(document.hidden||(f0&&document.documentElement.classList.contains('mk-still'))||(f0&&document.documentElement.classList.contains('mk-scrolling'))){requestAnimationFrame(draw);return}f0=1;
 const dk=document.documentElement.dataset.theme==='dark';mx+=(tx-mx)*.04;my+=(ty-my)*.04;x.setTransform(dp,0,0,dp,0,0);x.clearRect(0,0,W,H);
 for(const d of D){if(!R){d.y-=dt*.004*(.3+d.z);if(d.y<-.02)d.y=1.02}const tw=.5+.5*Math.sin(now/1000*(.6+d.z)+d.ph),px=d.x*W+mx*8*d.z,py=d.y*H+my*8*d.z;
  x.fillStyle=dk?'rgba(220,232,255,'+(.15+.45*tw*d.z)+')':'rgba(255,255,255,'+(.35+.55*tw)+')';x.fillRect(px,py,d.z>.8?1.6:1,d.z>.8?1.6:1)}
 for(const s of S){if(!R){s.x+=s.vx*dt;s.y+=s.vy*dt*(.4+s.z);s.a+=s.va*dt;if(s.y<-.08){s.y=1.08;s.x=r()}if(s.x<-.08)s.x=1.08;if(s.x>1.08)s.x=-.08}
  // paper shards drift away from the pointer like a force field (idea from Haziq's Soda reference)
  const bx=s.x*W+mx*26*s.z,by=s.y*H+my*18*s.z,ex=bx-cx,ey=by-cy,dd=Math.hypot(ex,ey)||1;let gx=0,gy=0,sp=1;if(!R&&dd<260){const f=(260-dd)/260;gx=ex/dd*f*110*(.5+s.z);gy=ey/dd*f*110*(.5+s.z);sp=1+f*6}
  s.rx=(s.rx||0)+(gx-(s.rx||0))*.08;s.ry=(s.ry||0)+(gy-(s.ry||0))*.08;if(!R)s.a+=s.va*dt*(sp-1)*3;
  const sz=9+s.z*26,px=bx+s.rx,py=by+s.ry,c=Math.cos(s.a),si=Math.sin(s.a),P=s.p.map(([u,v])=>[px+(u*c-v*si)*sz,py+(u*si+v*c)*sz*(.6+.4*Math.abs(Math.sin(s.a*.7+s.f*6)))]);
  const al=dk?.1+s.z*.22:.35+s.z*.35;for(let k=0;k<2;k++){x.beginPath();x.moveTo(P[0][0],P[0][1]);const q=k?P.slice(Math.ceil(P.length/2)-1):P.slice(0,Math.ceil(P.length/2)+1);for(const [a,b] of q)x.lineTo(a,b);if(k)x.lineTo(P[0][0],P[0][1]);x.closePath();
   x.fillStyle=dk?(k?'rgba(150,175,225,'+al+')':'rgba(95,120,175,'+al+')'):(k?'rgba(255,255,255,'+al+')':'rgba(205,222,245,'+al+')');x.fill()}}
 if(!R)requestAnimationFrame(draw)}
requestAnimationFrame(draw);if(R)new MutationObserver(()=>requestAnimationFrame(draw)).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']})})()