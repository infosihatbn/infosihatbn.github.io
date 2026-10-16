// Cloth effect from Canvas UI by David Haz (github.com/DavidHDev/canvas-ui, commit a04a99b), MIT + Commons Clause licence.
// MataKitani patch (2026-10-16): the fabric is see-through wherever the banner is see-through (gaps between slides, rounded corners),
// instead of filling them with a backing colour (Haziq saw black behind the banners).
// Bundled for MataKitani (Haziq, 2026-10-16), used on the home banner behind ?cloth=1.
var qe=new WeakMap;function Ye(E,d){let r=window.visualViewport?.scale||1,h=Math.min(window.devicePixelRatio||1,2)*r,M=Math.max(E.clientWidth,1),l=Math.max(E.clientHeight,1),w=8192;if(d){let e=qe.get(d);e===void 0&&(e=Math.min(w,d.getParameter(d.MAX_TEXTURE_SIZE),d.getParameter(d.MAX_RENDERBUFFER_SIZE)),qe.set(d,e)),w=e}return Math.min(h,w/Math.max(M,l),Math.sqrt(16777216/(M*l)))}function $e(E){let d=window.visualViewport,r=0,h=!1,M=()=>{r||h||(r=requestAnimationFrame(()=>{r=0,E()}))},l=new ResizeObserver(M);return window.addEventListener("resize",M,{passive:!0}),d?.addEventListener("resize",M,{passive:!0}),{observe(w,e){l.observe(w,e)},unobserve(w){l.unobserve(w)},disconnect(){h=!0,l.disconnect(),cancelAnimationFrame(r),window.removeEventListener("resize",M),d?.removeEventListener("resize",M)}}}function je(E,d){"content"in E?(E.setAttribute("content","drawable"),d.setAttribute("drawable","")):E.setAttribute("layoutsubtree","")}function Qe(E,d,r){let h=d.drawElementImage(r,0,0),M=E;h&&typeof M.updateElementGeometry=="function"&&M.updateElementGeometry(r,{canvasTransform:h})}function Ze(E){let d=E.getBoundingClientRect(),r=()=>{d=E.getBoundingClientRect()},h=new ResizeObserver(r);return h.observe(E),window.addEventListener("resize",r,{passive:!0}),window.addEventListener("scroll",r,{capture:!0,passive:!0}),{get current(){return d},destroy(){h.disconnect(),window.removeEventListener("resize",r),window.removeEventListener("scroll",r,!0)}}}var ct={pin:"top",wind:3,speed:.5,amplitude:30,drape:40,brush:2.05,brushSize:150,damping:1,light:.5,sheen:.1,shadow:.25,cornerRadius:20,backing:"auto",perspective:1200},lt=`#version 300 es
precision highp float;
layout(location = 0) in vec2 aGrid;
layout(location = 1) in vec4 aData;
layout(location = 2) in vec2 aOffset;
uniform vec2 uRes;
uniform vec2 uOut;
uniform float uBleed;
uniform float uFocal;
out vec2 vUv;
out vec3 vNormal;
out float vFold;
out vec2 vLocal;

void main () {
  vUv = aGrid;
  float z = aData.x;
  vec2 nxy = aData.yz;
  vNormal = vec3(nxy, sqrt(max(1.0 - dot(nxy, nxy), 0.04)));
  vFold = aData.w;

  vLocal = aGrid * uRes;
  vec2 px = vLocal + aOffset + vec2(uBleed);
  vec2 ndc = (px / uOut) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  float w = (uFocal - z) / uFocal;
  gl_Position = vec4(ndc, -z / uFocal, w);
}`,Je=`
float fabricDist (vec2 p, vec2 size, float radius) {
  vec2 half_ = size * 0.5;
  float r = min(radius, min(half_.x, half_.y));
  vec2 q = abs(p - half_) - (half_ - vec2(r));
  return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - r;
}`,ut=`#version 300 es
precision highp float;
in vec2 vUv;
in vec3 vNormal;
in float vFold;
in vec2 vLocal;
out vec4 outColor;
uniform sampler2D uContent;
uniform float uMaxX;
uniform float uLight;
uniform float uSheen;
uniform vec3 uBacking;
uniform vec2 uRes;
uniform float uRadius;
uniform float uDark;
${Je}

void main () {
  vec2 uv = clamp(vUv, vec2(0.001), vec2(uMaxX - 0.001, 0.999));
  vec4 tex = texture(uContent, uv);
  vec3 fabric = tex.a > 0.004 ? tex.rgb : uBacking;

  vec3 n = normalize(vNormal);
  vec3 lightDir = normalize(vec3(-0.3, 0.42, 0.86));
  float diffFlat = 0.58 + 0.42 * lightDir.z;
  float diff = 0.58 + 0.42 * dot(n, lightDir);
  float shade = mix(1.0, (diff / diffFlat) * vFold, uLight);
  vec3 lit = fabric * shade;

  vec3 halfway = normalize(lightDir + vec3(0.0, 0.0, 1.0));
  float specFlat = pow(halfway.z, 34.0);
  float spec =
    max(pow(max(dot(n, halfway), 0.0), 34.0) - specFlat, 0.0) /
    (1.0 - specFlat);
  lit += uSheen * spec * mix(vec3(1.0), fabric, 0.35);

  float broadFlat = pow(halfway.z, 6.0);
  float broad =
    max(pow(max(dot(n, halfway), 0.0), 6.0) - broadFlat, 0.0) /
    (1.0 - broadFlat);
  lit += uDark * uLight * 0.3 * broad * vec3(1.0);

  float d = fabricDist(vLocal, uRes, uRadius);

  float hemT = smoothstep(0.0, 6.0, -d);
  lit *= mix(1.0, mix(0.93, 1.0, hemT), uLight * (1.0 - uDark));
  lit += vec3(uDark * uLight * 0.08 * (1.0 - hemT));

  float alpha = clamp(0.5 - d, 0.0, 1.0);
  outColor = vec4(clamp(lit, 0.0, 1.0), 1.0) * alpha * tex.a;
}`,mt=`#version 300 es
precision highp float;
layout(location = 0) in vec2 aGrid;
layout(location = 1) in vec4 aData;
layout(location = 2) in vec2 aOffset;
uniform vec2 uRes;
uniform vec2 uOut;
uniform float uBleed;
out vec2 vLocal;
out float vLift;

void main () {
  float z = aData.x;
  vLift = z;
  vLocal = aGrid * uRes;
  vec2 px =
    vLocal + aOffset + vec2(uBleed) + vec2(10.0, 14.0) + vec2(0.3, 0.42) * z;
  vec2 ndc = (px / uOut) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  gl_Position = vec4(ndc, 0.0, 1.0);
}`,ft=`#version 300 es
precision highp float;
in vec2 vLocal;
in float vLift;
out vec4 outColor;
uniform float uShadow;
uniform vec2 uRes;
uniform float uRadius;
uniform float uDark;
${Je}

void main () {
  float d = fabricDist(vLocal, uRes, uRadius);
  float a = uShadow * smoothstep(0.0, 30.0, -d);

  a *= mix(1.0, 0.55, clamp(vLift / 50.0, 0.0, 1.0));

  a *= mix(1.0, 0.55, uDark);
  vec3 tint = vec3(uDark);
  outColor = vec4(tint * a, a);
}`,c=96,o=c+1,ue=1/120,me=30,dt=.55,ht=5,N=48;function vt(){if(typeof document>"u")return!1;let E=document.createElement("canvas"),d=E.getContext("2d");return!!(d&&typeof d.drawElementImage=="function"&&typeof E.requestPaint=="function")}function pt(E,d={}){let r={...ct,...d},{source:h,content:M,output:l}=E,w=l.parentElement??l;l.style.top=`${-N}px`,l.style.left=`${-N}px`,l.style.right=`${-N}px`,l.style.bottom=`${-N}px`,l.style.width=`calc(100% + ${N*2}px)`,l.style.height=`calc(100% + ${N*2}px)`;let e=l.getContext("webgl2",{alpha:!0,depth:!1,stencil:!1,antialias:!0,premultipliedAlpha:!0});if(!e||e.isContextLost())return null;let X=h.getContext("2d"),Q=h,k=!!(X&&typeof X.drawElementImage=="function"&&typeof Q.requestPaint=="function");k&&je(h,M);let Ce=()=>{},Fe=()=>{};k&&(Q.onpaint=()=>Fe());function Le(t,n){let a=e.createShader(t);return e.shaderSource(a,n),e.compileShader(a),e.getShaderParameter(a,e.COMPILE_STATUS)||console.error("Cloth shader error:",e.getShaderInfoLog(a)),a}function De(t,n){let a=Le(e.VERTEX_SHADER,t),s=Le(e.FRAGMENT_SHADER,n),i=e.createProgram();e.attachShader(i,a),e.attachShader(i,s),e.linkProgram(i);let p={},g=e.getProgramParameter(i,e.ACTIVE_UNIFORMS);for(let f=0;f<g;f++){let u=e.getActiveUniform(i,f);p[u.name]=e.getUniformLocation(i,u.name)}return{program:i,vert:a,frag:s,uniforms:p}}let y=De(lt,ut),L=De(mt,ft),fe=new Float32Array(o*o*2);for(let t=0;t<o;t++)for(let n=0;n<o;n++){let a=(t*o+n)*2;fe[a]=n/c,fe[a+1]=t/c}let S=new Uint32Array(c*c*6),G=0;for(let t=0;t<c;t++)for(let n=0;n<c;n++){let a=t*o+n,s=a+1,i=a+o,p=i+1;S[G++]=a,S[G++]=i,S[G++]=s,S[G++]=s,S[G++]=i,S[G++]=p}let de=e.createVertexArray();e.bindVertexArray(de);let _e=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,_e),e.bufferData(e.ARRAY_BUFFER,fe,e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0);let he=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,he),e.bufferData(e.ARRAY_BUFFER,o*o*4*4,e.DYNAMIC_DRAW),e.enableVertexAttribArray(1),e.vertexAttribPointer(1,4,e.FLOAT,!1,0,0);let ve=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,ve),e.bufferData(e.ARRAY_BUFFER,o*o*2*4,e.DYNAMIC_DRAW),e.enableVertexAttribArray(2),e.vertexAttribPointer(2,2,e.FLOAT,!1,0,0);let Ie=e.createBuffer();e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,Ie),e.bufferData(e.ELEMENT_ARRAY_BUFFER,S,e.STATIC_DRAW),e.bindVertexArray(null);let Z=e.createTexture();e.bindTexture(e.TEXTURE_2D,Z),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,new Uint8Array([0,0,0,0]));let Be=1;Fe=()=>{if(k)try{X.reset(),Qe(h,X,M),e.bindTexture(e.TEXTURE_2D,Z),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,h),X.reset(),Ce()}catch{}};function pe(){let t=Ye(l,e),n=Math.max(1,Math.round(l.clientWidth*t)),a=Math.max(1,Math.round(l.clientHeight*t));if((l.width!==n||l.height!==a)&&(l.width=n,l.height=a),Be=Math.min(1,Math.max(.05,M.clientWidth/Math.max(w.clientWidth,1))),k){let s=Math.max(1,Math.round(h.clientWidth*t)),i=Math.max(1,Math.round(h.clientHeight*t));(h.width!==s||h.height!==i)&&(h.width=s,h.height=i),Q.requestPaint()}}let D=new Float32Array(o*o),V=new Float32Array(o*o),J=new Float32Array(o*o),q=new Float32Array(o*o*4),K=new Float32Array(o*o*2),A=new Float32Array(o*o),Se=new Float32Array(o),Oe=new Float32Array(o),be=new Float32Array(o);for(let t=0;t<o;t++)be[t]=Math.pow(t/c,1.3);let xe=Math.random()*60,ee=.5,Pe=1,z={x:-1e5,y:-1e5,inside:!1},v={x:-1e5,y:-1e5,vx:0,vy:0,s:0};function Ue(t,n){return r.pin==="top"?[n,t]:r.pin==="bottom"?[c-n,t]:r.pin==="left"?[t,n]:[c-t,n]}function Ke(t){let n=Math.max(r.speed,0);xe+=t*n;let a=xe,s=ht*Math.max(r.wind,0)*ee,i=Math.PI*2/(c/1.5),p=Math.PI*2/(c/3.8),g=Math.PI*2/(c/2.2),f=me*i,u=me*p,x=1.8*Math.sin(.23*a);for(let m=0;m<o;m++)Se[m]=Math.sin(i*m-f*a+x)+.45*Math.sin(p*m+u*a*.8+3);for(let m=0;m<o;m++)Oe[m]=(.7+.3*Math.sin(g*m-1.7*a))*be[m];let R=me*me,b=t*t,P=Math.exp(-Math.min(Math.max(r.damping,.05),8)*t);for(let m=0;m<o;m++){let I=Math.max(m-1,0)*o,T=Math.min(m+1,c)*o,U=m*o;for(let F=0;F<o;F++){let C=U+F,H=U+Math.max(F-1,0),$=U+Math.min(F+1,c),B=D[C],ce=D[H]+D[$]+D[I+F]+D[T+F]-4*B,[le,at]=Ue(F,m),rt=s*Se[at]*Oe[le],it=R*ce-dt*B+rt,st=2*B-V[C]+b*it,j=B+(st-B)*P;j>3.5?j=3.5:j<-3.5&&(j=-3.5),J[C]=j}}for(let m=0;m<o;m++){let I=m,T=0;r.pin==="bottom"?T=c:r.pin==="left"?(I=0,T=m):r.pin==="right"&&(I=c,T=m),J[T*o+I]=0}let W=V;V=D,D=J,J=W}function et(t,n,a){if(r.brush<=0||v.s<.01)return;let s=n/c,i=a/c,p=Math.max(r.brushSize,12),g=p/s,f=p/i,u=v.x/s,x=v.y/i,R=Math.max(Math.ceil(u-2.5*g),0),b=Math.min(Math.floor(u+2.5*g),c),P=Math.max(Math.ceil(x-2.5*f),0),W=Math.min(Math.floor(x+2.5*f),c),m=1.1*Math.min(r.brush,3)*v.s,I=Math.min(t*4,1);for(let T=P;T<=W;T++){let U=(T-x)/f,F=T*o;for(let C=R;C<=b;C++){let H=(C-u)/g,$=Math.exp(-(H*H+U*U));if($<.02)continue;let B=F+C,ce=I*$,le=m*$;D[B]+=(le-D[B])*ce,V[B]+=(le-V[B])*ce}}}function te(t,n,a,s,i){let p=a*a;for(let g=0;g<o;g++){let f=g*n;K[(f+s*t)*2+i]=0;let u=0;for(let x=s+1;x<o;x++){let R=f+x*t,b=A[R]-A[R-t];u+=a-Math.sqrt(Math.max(p-b*b,0)),K[R*2+i]=-u}u=0;for(let x=s-1;x>=0;x--){let R=f+x*t,b=A[R]-A[R+t];u+=a-Math.sqrt(Math.max(p-b*b,0)),K[R*2+i]=u}}}function tt(t,n){let a=t/c,s=n/c,i=c>>1;r.pin==="top"||r.pin==="bottom"?(te(o,1,s,r.pin==="top"?0:c,1),te(1,o,a,i,0)):(te(1,o,a,r.pin==="left"?0:c,0),te(o,1,s,i,1))}function nt(t,n){let a=Math.max(r.amplitude,0),s=r.drape*(.3+.7*ee),i=t/c,p=n/c,g=0;for(let f=0;f<o;f++){let u=f*o;for(let x=0;x<o;x++){let R=u+x,b=D[R];g=Math.max(g,Math.abs(b));let[P]=Ue(x,f);A[R]=a*Math.tanh(b)+s*be[P]}}Pe=g;for(let f=0;f<o;f++){let u=Math.max(f-1,0)*o,x=Math.min(f+1,c)*o,R=f*o;for(let b=0;b<o;b++){let P=R+b,W=R+Math.max(b-1,0),m=R+Math.min(b+1,c),I=(A[m]-A[W])/(2*i),T=(A[x+b]-A[u+b])/(2*p),U=1/Math.hypot(I,T,1),C=1-(A[W]+A[m]+A[u+b]+A[x+b]-4*A[P])*.01;C<.86?C=.86:C>1.06&&(C=1.06);let H=P*4;q[H]=A[P],q[H+1]=-I*U,q[H+2]=-T*U,q[H+3]=C}}tt(t,n)}let O=[1,1,1],Ee=document.createElement("canvas");Ee.width=Ee.height=1;let Y=Ee.getContext("2d",{willReadFrequently:!0});function ne(){if(r.backing!=="auto"){O=r.backing;return}if(O=[1,1,1],Y){let t=M;for(;t;){let n=getComputedStyle(t).backgroundColor;if(n&&n!=="transparent"){Y.clearRect(0,0,1,1),Y.fillStyle=n,Y.fillRect(0,0,1,1);let[a,s,i,p]=Y.getImageData(0,0,1,1).data;if(p>0){O=[a/255,s/255,i/255];break}}t=t.parentElement}}}let oe=window.matchMedia("(prefers-reduced-motion: reduce)"),ge=oe.matches;pe(),ne();function ot(){let t=Math.max(w.clientWidth,1),n=Math.max(w.clientHeight,1),a=Math.max(l.clientWidth,1),s=Math.max(l.clientHeight,1),i=Math.min(Math.max(r.light,0),1),p=Math.max(r.cornerRadius,0),g=Math.min(Math.max(r.shadow,0),1),f=.299*O[0]+.587*O[1]+.114*O[2],u=Math.min(Math.max((.5-f)/.35,0),1);e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,l.width,l.height),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA),e.bindVertexArray(de),e.bindBuffer(e.ARRAY_BUFFER,he),e.bufferSubData(e.ARRAY_BUFFER,0,q),e.bindBuffer(e.ARRAY_BUFFER,ve),e.bufferSubData(e.ARRAY_BUFFER,0,K),e.useProgram(L.program),e.uniform2f(L.uniforms.uRes,t,n),e.uniform2f(L.uniforms.uOut,a,s),e.uniform1f(L.uniforms.uBleed,N),e.uniform1f(L.uniforms.uShadow,g),e.uniform1f(L.uniforms.uRadius,p),e.uniform1f(L.uniforms.uDark,u),e.drawElements(e.TRIANGLES,S.length,e.UNSIGNED_INT,0),e.useProgram(y.program),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,Z),e.uniform1i(y.uniforms.uContent,0),e.uniform2f(y.uniforms.uRes,t,n),e.uniform2f(y.uniforms.uOut,a,s),e.uniform1f(y.uniforms.uBleed,N),e.uniform1f(y.uniforms.uFocal,Math.max(r.perspective,200)),e.uniform1f(y.uniforms.uMaxX,Be),e.uniform1f(y.uniforms.uLight,i),e.uniform1f(y.uniforms.uSheen,Math.max(r.sheen,0)),e.uniform1f(y.uniforms.uRadius,p),e.uniform1f(y.uniforms.uDark,u),e.uniform3f(y.uniforms.uBacking,O[0],O[1],O[2]),e.drawElements(e.TRIANGLES,S.length,e.UNSIGNED_INT,0),e.bindVertexArray(null)}let Re=0,Me=performance.now(),ae=0,we=!1,re=!1,ie=!0;function He(t){if(we)return;if(!ie){re=!1;return}let n=Math.min((t-Me)/1e3,1/20);Me=t;let a=Math.max(w.clientWidth,1),s=Math.max(w.clientHeight,1);if(!ge){let i=xe,p=Math.max(.55+.35*Math.sin(i*.31+1.3)+.25*Math.sin(i*.83)*(.5+.5*Math.sin(i*.17)),.15);ee+=(p-ee)*Math.min(n*2,1);let g=z.inside&&r.brush>0?1:0,f=z.inside?8:2.5;v.s+=(g-v.s)*Math.min(n*f,1);let u=14;for(v.vx+=((z.x-v.x)*u*u-2*u*v.vx)*n,v.vy+=((z.y-v.y)*u*u-2*u*v.vy)*n,v.x+=v.vx*n,v.y+=v.vy*n,et(n,a,s),ae=Math.min(ae+n,ue*5);ae>=ue;)Ke(ue),ae-=ue}if(nt(a,s),ot(),ge||r.wind<=.001&&Pe<.004&&v.s<.01){re=!1;return}Re=requestAnimationFrame(He)}function _(){k&&(we||re||!ie||(re=!0,Me=performance.now(),Re=requestAnimationFrame(He)))}Ce=_,_();function ze(){ge=oe.matches,_()}oe.addEventListener("change",ze);let ye=0;function Ae(){ne(),_(),window.clearTimeout(ye),ye=window.setTimeout(()=>{ne(),_()},300)}let Ne=new MutationObserver(Ae);Ne.observe(document.documentElement,{attributes:!0,attributeFilter:["class","style","data-theme"]});let ke=window.matchMedia("(prefers-color-scheme: dark)");ke.addEventListener("change",Ae);let Te=$e(()=>{pe(),_()});Te.observe(l),Te.observe(M);let Ge=new IntersectionObserver(t=>{ie=t[t.length-1]?.isIntersecting??!0,ie&&_()});Ge.observe(l);let se=w,We=Ze(w);function Xe(t){if(!k)return;let n=We.current,a=t.clientX-n.left,s=t.clientY-n.top;v.s<.01&&(v.x=a,v.y=s,v.vx=0,v.vy=0),z.x=a,z.y=s,z.inside=!0,_()}function Ve(){z.inside=!1}return se.addEventListener("pointermove",Xe),se.addEventListener("pointerleave",Ve),{setOptions(t){Object.entries(t).some(([n,a])=>r[n]!==a)&&(Object.assign(r,t),ne(),_())},resize(){pe(),_()},destroy(){we=!0,We.destroy(),cancelAnimationFrame(Re),Te.disconnect(),Ge.disconnect(),Ne.disconnect(),ke.removeEventListener("change",Ae),window.clearTimeout(ye),oe.removeEventListener("change",ze),se.removeEventListener("pointermove",Xe),se.removeEventListener("pointerleave",Ve),e.deleteTexture(Z),e.deleteProgram(y.program),e.deleteShader(y.vert),e.deleteShader(y.frag),e.deleteProgram(L.program),e.deleteShader(L.vert),e.deleteShader(L.frag),e.deleteBuffer(_e),e.deleteBuffer(he),e.deleteBuffer(ve),e.deleteBuffer(Ie),e.deleteVertexArray(de),k&&(Q.onpaint=null)}}}export{pt as createCloth,vt as supportsHtmlInCanvas};
