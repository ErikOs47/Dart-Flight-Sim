/* Dart-Labor – Flugsimulation zum Vergleich von Steel-Tip-Darts.
   Modell und Annahmen: siehe README.md. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
let P={};
let COL=['#1F6FEB','#D6336C'];
function pal(){
const t=document.documentElement.dataset.theme;
const dark=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);
const cs=getComputedStyle(document.documentElement),v=n=>cs.getPropertyValue(n).trim();
P=dark?{ink:'#E7EFEA',mid:'#94A59C',faint:'rgba(255,255,255,0.16)',tipF:'#B4B2A9',barF:'#888780',barS:'#E7EFEA',ring:'rgba(0,0,0,0.4)',shF:'#444441',shS:'#B4B2A9',flF:'#712B13',flS:'#F0997B'}:{ink:'#14201B',mid:'#5A6A63',faint:'rgba(0,0,0,0.12)',tipF:'#B4B2A9',barF:'#5F5E5A',barS:'#2C2C2A',ring:'rgba(255,255,255,0.4)',shF:'#D3D1C7',shS:'#888780',flF:'#F5C4B3',flS:'#993C1D'};
COL=[v('--ca')||'#1F6FEB',v('--cb')||'#D6336C'];
}
const CG='#1D9E75',CPC='#BA7517';
const FF="Barlow,system-ui,sans-serif";

/* ---------- Physik-Konstanten ---------- */
const K_SCATTER=0.6;           // Skalierung der Wurfstreuung
const aeroCache={};
const D=Math.PI/180,G=9.81,RHO=1.204,NU=1.5e-5; // Luft 20 °C
const XB=2.2,YB=1.73;          // Abstand Abwurf–Board (m), Bull-Höhe (m)
const GK=0.25;                 // Griff-Nickimpuls rad/s pro mm Abstand Griff–CG (Annahme)
const F_RES=50;                // Eindringwiderstand Board (N, Annahme)
const CD_STEP=0.9,CD_CYL=1.1,CD_PLATE=1.17,D_SHAFT=4.8,D_TIP=1.6,R_HUB=2.4;
// Flight-Umrisse: Länge mm, Masse g, Halbspannweite über Länge
const BASES={
n2:{L:44,m:0.75,pts:[[0,3],[8,10],[20,15.5],[32,17.5],[40,15],[44,9]]},
n6:{L:44,m:0.55,pts:[[0,3],[8,7.5],[20,11],[32,12],[40,10.5],[44,7]]}
};
// 1-Sigma-Streuung je Wurfparameter
const SIG={ang:0.6*D,psi:0.5*D,v:0.2,delta:2*D,eps:2*D,wp:1.5,wy:1.5,h:0.005};
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
// Feste Zufallsfolge: 24 Würfe, für jeden Dart gleich
const NOISE=(function(){const r=mulberry(20261109),g=()=>{let u=0;while(u===0)u=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*r())};return Array.from({length:24},()=>[g(),g(),g(),g(),g(),g(),g(),g()])})();
function shapeFor(name,sz){const b=BASES[name];return{L:b.L*sz,m:b.m*sz*sz,pts:b.pts.map(q=>[q[0]*sz,q[1]*sz])}}
function prof(sh,u){
const Q=sh.pts;
if(u<=Q[0][0])return Q[0][1];
for(let i=1;i<Q.length;i++){if(u<=Q[i][0]){const a=Q[i-1],b=Q[i];return a[1]+(b[1]-a[1])*(u-a[0])/(b[0]-a[0])}}
return Q[Q.length-1][1];
}
// Flight-Aerodynamik: Fläche, Streckung, Auftriebsanstieg, Druckpunkt (Streifentheorie), Rolldämpfung
function shapeAero(name,sz){
const key=name+'|'+sz;
if(aeroCache[key])return aeroCache[key];
const sh=shapeFor(name,sz),L=sh.L,du=0.1;
let A=0,hmax=0;
for(let u=0;u<L;u+=du){const v=prof(sh,u+du/2);A+=v*du;if(v>hmax)hmax=v}
const Sw=2*A,b=2*hmax,AR=b*b/Sw;
const clA=2*Math.PI*AR/(2+Math.sqrt(AR*AR+4));
const Kwb=1+R_HUB/(hmax+R_HUB);
let sw=0,swx=0,rd=0;
for(let y=R_HUB;y<hmax;y+=0.1){
let le=null,te=null;
for(let u=0;u<=L;u+=0.1){if(prof(sh,u)>=y){if(le===null)le=u;te=u}}
if(le===null)continue;
const c=te-le;sw+=c;swx+=c*(le+0.25*c);rd+=c*y*y*0.1;
}
aeroCache[key]={A:A,S:Sw*1e-6,AR:AR,clA:clA,K1:clA*Kwb,xcp:swx/sw,hmax:hmax,RD:rd*1e-12};
return aeroCache[key];
}
// Massen, Schwerpunkt, Trägheitsmomente, Widerstandsflächen
function geom(p){
const sh=shapeFor(p.shape,p.size),ae=shapeAero(p.shape,p.size),f=p.cg/100;
const mt=1.5*p.tip/25,ms=0.02*p.shaft,mf=sh.m,mb=Math.max(8,p.wt);
const sBar=p.tip+p.bar*f,sh0=p.tip+p.bar,sff=sh0+p.shaft;
const parts=[[mt,p.tip/2,p.tip],[mb,sBar,p.bar],[ms,sh0+p.shaft/2,p.shaft],[mf,sff+sh.L*0.45,sh.L]];
let M=0,Ms=0;parts.forEach(q=>{M+=q[0];Ms+=q[0]*q[1]});
const sCG=Ms/M;let I=0;
parts.forEach(q=>{const m=q[0]*1e-3;I+=m*Math.pow(q[2]*1e-3,2)/12+m*Math.pow((q[1]-sCG)*1e-3,2)});
const db=p.dia;
const Ix=mb*1e-3*Math.pow(db*0.5e-3,2)/2+mt*1e-3*Math.pow(0.8e-3,2)/2+ms*1e-3*Math.pow(2.4e-3,2)/2+mf*1e-3*Math.pow(0.75*ae.hmax*1e-3,2)/3;
const cyl=[[db,p.bar,sBar],[D_SHAFT,p.shaft,sh0+p.shaft/2],[D_TIP,p.tip,p.tip/2]];
let Ac=0,Acx=0;cyl.forEach(c=>{Ac+=c[0]*c[1];Acx+=c[0]*c[1]*c[2]});
const sB=Acx/Ac,sCP=sff+ae.xcp;
const CdAfront=CD_STEP*Math.PI*(Math.pow(db*5e-4,2)-Math.pow(D_TIP*5e-4,2));
const xw=Math.max(0.01,(sCP-sh0)*1e-3),eta=1-Math.min(0.08,0.8*CdAfront/(xw*xw));
return{M:M*1e-3,Mg:M,mb:mb,sCG:sCG,I:I,Ix:Ix,sCP:sCP,sff:sff,sh0:sh0,len:sff+sh.L,db:db,Acyl:Ac*1e-6,lb:(sB-sCG)*1e-3,CdAfront:CdAfront,eta:eta,
lens:[[p.bar*1e-3,Math.PI*db*p.bar*1e-6],[p.shaft*1e-3,Math.PI*D_SHAFT*p.shaft*1e-6],[p.tip*1e-3,Math.PI*D_TIP*p.tip*1e-6],[sh.L*1e-3,8*ae.A*1e-6]],ae:ae};
}
// Hautreibung (Blasius, laminar)
function fricCdA(g,s){let r=0;for(let i=0;i<4;i++){const c=g.lens[i];r+=1.328/Math.sqrt(s*c[0]/NU)*c[1]}return r}
// 3D-Starrkörper-Integration bis zum Board
function sim3(p,keep,dtv){
const g=geom(p),ae=g.ae,dt=dtv||0.0005,l=(g.sCP-g.sCG)*1e-3,lb=g.lb,M=g.M,It=g.I,Ix=g.Ix,Se=ae.S*(1-p.wear),K1=ae.K1,RD=ae.RD,wind=p.wind;
const cgl=Math.cos(p.ang),sgl=Math.sin(p.ang);
let vx=p.v*cgl*Math.cos(p.psi),vy=p.v*sgl,vz=p.v*cgl*Math.sin(p.psi);
let x=0,y=p.h,z=0;
const ge=p.ang+p.delta,ps=p.psi+p.eps;
let ex=Math.cos(ge)*Math.cos(ps),ey=Math.sin(ge),ez=Math.cos(ge)*Math.sin(ps);
const uh=Math.sqrt(Math.max(1e-12,1-ey*ey)),ur=Math.sqrt(Math.max(1e-12,ex*ex+ez*ez));
const wpt=p.wp+GK*(g.sCG-p.grip)*(p.v/7);
const edx0=wpt*(-ey*ex/uh)+p.wy*(-ez/ur),edy0=wpt*((1-ey*ey)/uh),edz0=wpt*(-ey*ez/uh)+p.wy*(ex/ur);
let Lx=It*(ey*edz0-ez*edy0)+Ix*p.spin*ex,Ly=It*(ez*edx0-ex*edz0)+Ix*p.spin*ey,Lz=It*(ex*edy0-ey*edx0)+Ix*p.spin*ez;
let t=0,n=0,phi=0;const fr=[],every=Math.max(1,Math.round(0.002/dt));
while(t<1.5){
const el=ex*Lx+ey*Ly+ez*Lz,pp=el/Ix;
const Ox=(Lx-el*ex)/It,Oy=(Ly-el*ey)/It,Oz=(Lz-el*ez)/It;
const edx=Oy*ez-Oz*ey,edy=Oz*ex-Ox*ez,edz=Ox*ey-Oy*ex;
const rx=vx,ry=vy,rz=vz-wind;
const s=Math.sqrt(rx*rx+ry*ry+rz*rz);
const vax=rx*ex+ry*ey+rz*ez;
const qx=rx-vax*ex,qy=ry-vax*ey,qz=rz-vax*ez;
const cx=qx-l*edx,cy=qy-l*edy,cz=qz-l*edz;
const q=0.5*RHO*s*s,cn=Math.sqrt(cx*cx+cy*cy+cz*cz),pn=Math.sqrt(qx*qx+qy*qy+qz*qz);
const sc=cn/s,sb=pn/s;
if(keep&&n%every===0){
const th=Math.atan2(ey,Math.sqrt(ex*ex+ez*ez)),gam=Math.atan2(vy,Math.sqrt(vx*vx+vz*vz));
let a=th-gam;a=Math.atan2(Math.sin(a),Math.cos(a));
fr.push({t:t,x:x,y:y,z:z,th:th,gam:gam,a:a,at:Math.acos(Math.max(-1,Math.min(1,vax/s))),phi:phi});
}
const cosc=Math.sqrt(Math.max(0,1-sc*sc)),qf=q*g.eta;
const Nf=qf*Se*(K1*sc*cosc+CD_PLATE*sc*sc),Nb=q*CD_CYL*g.Acyl*sb*sb;
let Ffx=0,Ffy=0,Ffz=0,Fbx=0,Fby=0,Fbz=0;
if(cn>1e-9){const k=-Nf/cn;Ffx=k*cx;Ffy=k*cy;Ffz=k*cz}
if(pn>1e-9){const k=-Nb/pn;Fbx=k*qx;Fby=k*qy;Fbz=k*qz}
const Dr=q*(g.CdAfront+fricCdA(g,s))/s;
const ax=(Ffx+Fbx-Dr*rx)/M,ay=(Ffy+Fby-Dr*ry)/M-G,az=(Ffz+Fbz-Dr*rz)/M;
const cpr=4*qf*K1*RD/s*(1-p.wear);
const tfx=ey*Ffz-ez*Ffy,tfy=ez*Ffx-ex*Ffz,tfz=ex*Ffy-ey*Ffx;
const tbx=ey*Fbz-ez*Fby,tby=ez*Fbx-ex*Fbz,tbz=ex*Fby-ey*Fbx;
const Mx=-l*tfx-lb*tbx-cpr*pp*ex,My=-l*tfy-lb*tby-cpr*pp*ey,Mz=-l*tfz-lb*tbz-cpr*pp*ez;
const px=x,py=y,pz=z;
vx+=ax*dt;vy+=ay*dt;vz+=az*dt;
x+=vx*dt;y+=vy*dt;z+=vz*dt;
Lx+=Mx*dt;Ly+=My*dt;Lz+=Mz*dt;
ex+=edx*dt;ey+=edy*dt;ez+=edz*dt;
const en=Math.sqrt(ex*ex+ey*ey+ez*ez);ex/=en;ey/=en;ez/=en;
phi+=pp*dt;t+=dt;n++;
if(x>=XB){
const f=(XB-px)/(x-px),yi=py+f*(y-py),zi=pz+f*(z-pz),Ti=t-dt+f*dt;
const rz2=vz-wind,s2=Math.sqrt(vx*vx+vy*vy+rz2*rz2),vax2=vx*ex+vy*ey+rz2*ez;
const th2=Math.atan2(ey,Math.sqrt(ex*ex+ez*ez)),gam2=Math.atan2(vy,Math.sqrt(vx*vx+vz*vz));
let a2=th2-gam2;a2=Math.atan2(Math.sin(a2),Math.cos(a2));
const at2=Math.acos(Math.max(-1,Math.min(1,vax2/s2)));
if(keep)fr.push({t:Ti,x:XB,y:yi,z:zi,th:th2,gam:gam2,a:a2,at:at2,phi:phi});
return{T:Ti,y:yi,z:zi,th:th2,gam:gam2,a:a2,at:at2,v:s2,vax:vax2,frames:fr};
}
}
return{T:t,y:-9,z:0,th:0,gam:0,a:0,at:0,v:0,vax:0,frames:fr};
}
// Abwurfwinkel per Sekantenverfahren so wählen, dass der Bull getroffen wird
function solveAng(p,dt){
let a0=0.15,a1=0.2;p.ang=a0;let f0=sim3(p,false,dt).y-YB;p.ang=a1;let f1=sim3(p,false,dt).y-YB;
for(let i=0;i<12&&Math.abs(f1)>2e-5;i++){
const a2=a1-f1*(a1-a0)/((f1-f0)||1e-9);
a0=a1;f0=f1;a1=Math.max(0,Math.min(0.75,a2));p.ang=a1;f1=sim3(p,false,dt).y-YB;
}
return a1;
}
function scatter(p,k){
const out=[];
for(let i=0;i<NOISE.length;i++){
const n=NOISE[i],q=Object.assign({},p);
q.ang+=n[0]*SIG.ang*k;q.psi+=n[1]*SIG.psi*k;q.v+=n[2]*SIG.v*k;q.delta+=n[3]*SIG.delta*k;q.eps+=n[4]*SIG.eps*k;q.wp+=n[5]*SIG.wp*k;q.wy+=n[6]*SIG.wy*k;q.h+=n[7]*SIG.h*k;
const r=sim3(q,false,0.001);out.push([r.z*1000,(r.y-YB)*1000]);
}
return out;
}
const fmt=(x,d)=>x.toLocaleString('de-DE',{minimumFractionDigits:d||0,maximumFractionDigits:d||0});

/* ---------- Dart-Datenbank (nach Marken, data/brands/*.json) ---------- */
// Startauswahl, falls die Datenbank nicht geladen werden kann (z. B. Aufruf per file://)
const SRC='https://a-zdarts.com/products/';
const SEED=[
{id:'target-aspinall-g2-24',brand:'Target',model:'Target Nathan Aspinall G2',name:'Target Nathan Aspinall G2 (24 g)',short:'Aspinall G2',bw:24,len:50.05,dia:7.07,shape:'Torpedo',bal:'vorn',cg:40,url:SRC+'target-nathan-aspinall-g2-steel-tip-darts-24gm'},
{id:'target-littler-g1-23',brand:'Target',model:'Target Luke Littler G1 Prodigy',name:'Target Luke Littler G1 Prodigy (23 g)',short:'Littler G1',bw:23,len:52,dia:6.5,shape:'Gerade',bal:'Mitte',cg:50,url:SRC+'target-luke-littler-g1-prodigy-swiss-point-steel-tip-darts-23gm'}
];
// Bei jeder Änderung an App oder Daten erhöhen (auch ?v= in index.html), damit Browser keine alte Version aus dem Cache nehmen
const DATA_V='4';
const LS_KEY='dartlabor.custom.v1',OWN='Eigene';
let brands=[],darts=SEED.slice(),custom=loadCustom(),brandSel='';
function loadCustom(){try{const r=JSON.parse(localStorage.getItem(LS_KEY)||'[]');return Array.isArray(r)?r:[]}catch(e){return[]}}
function saveCustom(){try{localStorage.setItem(LS_KEY,JSON.stringify(custom));return true}catch(e){return false}}
function all(){return darts.concat(custom.map(d=>Object.assign({brand:OWN,model:d.name},d)))}
function byId(id){return all().find(d=>d.id===id)}
// Modellname ohne Markenpräfix, z. B. "Harrows Flux 90%" -> "Flux 90%"
function modelLabel(d){const m=d.model||d.name,b=d.brand||'';return m.toLowerCase().startsWith(b.toLowerCase()+' ')?m.slice(b.length+1):m}

/* ---------- Setups ---------- */
const BASE={tip:25,shaft:30,shape:'n2',size:1,grip:24};
function fromDart(d){return Object.assign({},BASE,{dartId:d.id,name:d.short||d.name,mod:false,wt:d.bw,bar:d.len,dia:d.dia,cg:d.cg})}
let setups=[fromDart(SEED[0]),fromDart(SEED[1])],act=0,out=[null,null];
function fit(cv,h){const dpr=window.devicePixelRatio||1,w=cv.clientWidth||300;cv.style.height=h+'px';cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);return{c:c,W:w,H:h}}
function build(s){const p={wt:s.wt,bar:s.bar,dia:s.dia,cg:s.cg,tip:s.tip,shaft:s.shaft,shape:s.shape,size:s.size,wear:0,grip:0,ang:0,h:+$('h').value,v:+$('v').value,psi:0,delta:0,eps:0,wp:0,wy:0,spin:5*2*Math.PI,wind:0};p.grip=p.tip+p.bar-Math.min(s.grip,p.bar);return p}
function calc(i){
const p=build(setups[i]);p.ang=solveAng(p,0.0005);
const res=sim3(p,true),g=geom(p),miss=Math.abs(res.y-YB)>0.01;
let amax=0;res.frames.forEach(f=>{if(f.at>amax)amax=f.at});
const sc=scatter(p,K_SCATTER);let mx=0,my=0;sc.forEach(q=>{mx+=q[0];my+=q[1]});mx/=sc.length;my/=sc.length;
const d=sc.map(q=>Math.hypot(q[0]-mx,q[1]-my)).sort((a,b)=>a-b),r90=d[Math.floor(0.9*(d.length-1))];
const Eax=0.5*g.M*res.vax*res.vax,depth=Math.min(p.tip,Eax/F_RES*1000);
const l=(g.sCP-g.sCG)*1e-3,kw=0.5*RHO*p.v*p.v*g.eta*g.ae.S*g.ae.K1*l/g.I;
out[i]={p:p,g:g,res:res,sc:sc,miss:miss,steck:-res.th/D,ang:p.ang/D,T:res.T,amax:amax/D,r90:r90,depth:depth,per:2*Math.PI/Math.sqrt(kw),cx:mx,cy:my};
}
function rating(o){
const t=[];
if(o.miss)t.push('Bull bei dieser Geschwindigkeit nicht erreichbar.');
if(o.steck<1)t.push('Steckwinkel unter 1°: Flight steht fast waagerecht oder hängt nach unten.');
else if(o.steck>15)t.push('Steckwinkel über 15°: Dart steckt sehr steil.');
else t.push('Steckwinkel im üblichen Bereich (1–15°).');
t.push(o.amax<5?'Flug ruhig (Anstellwinkel unter 5°).':o.amax<10?'Flug mäßig unruhig (Anstellwinkel '+fmt(o.amax)+'°).':'Flug unruhig (Anstellwinkel '+fmt(o.amax)+'°).');
if(o.depth<8)t.push('Eindringtiefe unter 8 mm: Flight kippt eher nach unten.');
return t.join(' ');
}
function lbl(i){const s=setups[i];return s.name+(s.mod?' (angepasst)':'')}
function cell(id,a,b){$(id+'A').textContent=a;$(id+'B').textContent=b}
// Kompakte Kennwerte direkt unter der Grafik; 'lo' = kleiner ist besser
const KPI=[
['Streuung R90',o=>o.r90,v=>fmt(v)+' mm','lo'],
['Max. Anstellwinkel',o=>o.amax,v=>fmt(v,1)+'°','lo'],
['Steckwinkel',o=>o.steck,v=>fmt(v,1)+'°',''],
['Flugzeit',o=>o.T*1000,v=>fmt(v)+' ms',''],
['Eindringtiefe',o=>o.depth,v=>fmt(v)+' mm','hi']
];
function labels(){
const s=setups[act];
$('wto').textContent=fmt(s.wt,1)+' g';$('baro').textContent=fmt(s.bar,2)+' mm';$('diao').textContent=fmt(s.dia,2)+' mm';
$('cgo').textContent=s.cg+' %';
$('gro').textContent=s.grip+' mm';$('tipo').textContent=s.tip+' mm';$('sho').textContent=s.shaft+' mm';
$('vo').textContent=fmt(+$('v').value,1)+' m/s';$('ho').textContent=fmt(+$('h').value,2)+' m';
$('nA').textContent=lbl(0);$('nB').textContent=lbl(1);
$('lgA').textContent='A '+lbl(0);$('lgB').textContent='B '+lbl(1);
$('lgA').className='la '+(act===0?'act':'ghost');$('lgB').className='lb '+(act===1?'act':'ghost');
$('tA').textContent=setups[0].name;$('tB').textContent=setups[1].name;
$('vtA').textContent=setups[0].name+':';$('vtB').textContent=setups[1].name+':';
const A=out[0],B=out[1];
let h='<span></span><span class="va">A</span><span class="vb">B</span>';
KPI.forEach(k=>{const a=k[1](A),b=k[1](B);let ba='',bb='';
if(k[3]&&Math.abs(a-b)>1e-6*Math.max(1,Math.abs(a))){const aw=k[3]==='lo'?a<b:a>b;ba=aw?' better':'';bb=aw?'':' better'}
h+='<span class="k">'+k[0]+'</span><span class="va'+ba+'">'+k[2](a)+'</span><span class="vb'+bb+'">'+k[2](b)+'</span>'});
$('kpis').innerHTML=h;
cell('rL',fmt(A.g.len)+' mm',fmt(B.g.len)+' mm');
cell('rS',fmt(A.g.sCG)+' mm',fmt(B.g.sCG)+' mm');
cell('rM',fmt(A.g.Mg,1)+' g',fmt(B.g.Mg,1)+' g');
cell('rW',fmt(A.ang,1)+'°',fmt(B.ang,1)+'°');
cell('rT',fmt(A.T*1000)+' ms',fmt(B.T*1000)+' ms');
cell('rK',fmt(A.steck,1)+'°',fmt(B.steck,1)+'°');
cell('rA',fmt(A.amax,1)+'°',fmt(B.amax,1)+'°');
cell('rR',fmt(A.r90)+' mm',fmt(B.r90)+' mm');
cell('rD',fmt(A.depth)+' mm',fmt(B.depth)+' mm');
cell('rP',fmt(A.per,2)+' s',fmt(B.per,2)+' s');
$('vA').textContent=rating(A);$('vB').textContent=rating(B);
}

/* ---------- Zeichnen ---------- */
let FL,DT,BD,ED;
const wide=()=>matchMedia('(min-width:860px)').matches;
function setup(){
if(wide()){FL=fit($('fl'),170);BD=fit($('bd'),260)}
else{FL=fit($('fl'),130);BD=fit($('bd'),130)}
DT=fit($('dt'),110);ED=fit($('ed'),wide()?220:140);
}
function rad(t,b,rr){return rr*(3.4+0.9*b*(1-2*t))}
function drawBody(c,p,g,sc){
const sh=shapeFor(p.shape,p.size),X=s=>-s*sc,b=Math.max(-1,Math.min(1,(0.5-p.cg/100)/0.2)),rr=g.db/6.8;
c.lineJoin='round';
c.fillStyle=P.tipF;c.strokeStyle=P.barS;c.lineWidth=0.8;
c.beginPath();c.moveTo(0,0);c.lineTo(X(p.tip),-1.6*sc);c.lineTo(X(p.tip),1.6*sc);c.closePath();c.fill();c.stroke();
const sr=2.4*sc;
c.fillStyle=P.shF;c.strokeStyle=P.shS;c.lineWidth=1;
c.fillRect(X(g.sh0+p.shaft),-sr,p.shaft*sc,2*sr);c.strokeRect(X(g.sh0+p.shaft),-sr,p.shaft*sc,2*sr);
c.fillStyle=P.flF;c.strokeStyle=P.flS;c.lineWidth=1.1;
[1,-1].forEach(sg=>{c.beginPath();sh.pts.forEach((q,i)=>{const px=X(g.sff+q[0]),py=-sg*q[1]*sc;i?c.lineTo(px,py):c.moveTo(px,py)});c.lineTo(X(g.sff+sh.L),-sg*2*sc);c.closePath();c.fill();c.stroke()});
const N=12;c.fillStyle=P.barF;c.strokeStyle=P.barS;c.lineWidth=1;c.beginPath();
for(let i=0;i<=N;i++){const t=i/N;const px=X(p.tip+p.bar*t),py=-rad(t,b,rr)*sc;i?c.lineTo(px,py):c.moveTo(px,py)}
for(let i=N;i>=0;i--){const t=i/N;c.lineTo(X(p.tip+p.bar*t),rad(t,b,rr)*sc)}
c.closePath();c.fill();c.stroke();
c.strokeStyle=P.ring;c.lineWidth=1;
for(let s=p.tip+8;s<=p.tip+p.bar-8;s+=3.2){const t=(s-p.tip)/p.bar,r=rad(t,b,rr)*sc;c.beginPath();c.moveTo(X(s),-r);c.lineTo(X(s),r);c.stroke()}
}
// Flugbahn: Höhe automatisch überhöht, damit Unterschiede sichtbar sind
function drawFlight(){
const c=FL.c,W=FL.W,H=FL.H;c.clearRect(0,0,W,H);
const hh=+$('h').value;let y0=Math.min(hh,YB),y1=Math.max(hh,YB);
out.forEach(o=>o.res.frames.forEach(f=>{if(f.y<y0)y0=f.y;if(f.y>y1)y1=f.y}));
const pad=0.02;y0-=pad;y1+=pad;
const sx=(W-24)/XB,top=20,bot=8,sy=(H-top-bot)/(y1-y0),ox=10,X=x=>ox+x*sx,Y=y=>top+(y1-y)*sy;
c.strokeStyle=P.faint;c.lineWidth=1;c.setLineDash([3,4]);c.beginPath();c.moveTo(X(0),Y(YB));c.lineTo(X(XB),Y(YB));c.stroke();c.setLineDash([]);
c.fillStyle='#D85A30';c.beginPath();c.arc(X(XB),Y(YB),3.5,0,7);c.fill();
c.strokeStyle=P.mid;c.beginPath();c.arc(X(0),Y(hh),3,0,7);c.stroke();
order().forEach(i=>{const o=out[i],on=i===act;
c.globalAlpha=on?1:0.35;c.strokeStyle=COL[i];c.lineWidth=on?2.4:1.5;c.setLineDash(i?[5,3]:[]);c.beginPath();
o.res.frames.forEach((f,k)=>{k?c.lineTo(X(f.x),Y(f.y)):c.moveTo(X(f.x),Y(f.y))});c.stroke();c.setLineDash([]);c.globalAlpha=1;
});
const ex=sy/sx;
c.fillStyle=P.mid;c.font='11px '+FF;c.textAlign='left';
c.fillText((W>300?'Flugbahn seitlich':'Flugbahn')+(ex>1.3?' (Höhe '+fmt(ex)+'×)':''),6,13);
}
// Ghost zuerst zeichnen, aktiven Dart obendrauf
function order(){return act?[0,1]:[1,0]}
// Endlage: letzte Flugstrecke der Spitze und steckender Dart, Seitenansicht im echten Maßstab (Winkel unverzerrt)
const BOARD_T=0.038; // Boarddicke (m), nur Darstellung
function tipPath(o){
const sCG=o.g.sCG*1e-3;
return o.res.frames.map(f=>({x:f.x+sCG*Math.cos(f.th),y:f.y+sCG*Math.sin(f.th)}));
}
function drawEnd(){
const c=ED.c,W=ED.W,H=ED.H;c.clearRect(0,0,W,H);
const A=out[act];
const pathA=tipPath(A),face=pathA[pathA.length-1].x;
// Maßstab: ca. 2 Dartlängen vor dem Board sichtbar
const span=Math.max(out[0].g.len,out[1].g.len)*1e-3*1.9,bx=W-34,s=(bx-8)/span;
const yc=A.res.y,X=x=>bx+(x-face)*s,Y=y=>H*0.62-(y-yc)*s;
// Board
c.fillStyle=P.faint;c.fillRect(bx,0,BOARD_T*s,H);
c.strokeStyle=P.mid;c.lineWidth=1.5;c.beginPath();c.moveTo(bx,0);c.lineTo(bx,H);c.stroke();
c.fillStyle=P.mid;c.font='10px '+FF;c.save();c.translate(bx+BOARD_T*s/2+4,H/2);c.rotate(-Math.PI/2);c.textAlign='center';c.fillText('Board',0,0);c.restore();
// Bull-Höhe
c.strokeStyle=P.faint;c.setLineDash([2,3]);c.beginPath();c.moveTo(0,Y(YB));c.lineTo(bx,Y(YB));c.stroke();c.setLineDash([]);
order().forEach(i=>{
const o=out[i],on=i===act,tp=tipPath(o),th=o.res.th,d=o.depth*1e-3;
c.globalAlpha=on?1:0.3;
// Bahn der Spitze bis zum Board
c.strokeStyle=COL[i];c.lineWidth=on?2:1.4;c.setLineDash(i?[5,3]:[]);c.beginPath();
let st=false;tp.forEach(q=>{if(X(q.x)<-10)return;st?c.lineTo(X(q.x),Y(q.y)):(c.moveTo(X(q.x),Y(q.y)),st=true)});c.stroke();c.setLineDash([]);
// Dart: Spitze um Eindringtiefe im Board, entlang der Achse
const tf=tp[tp.length-1],tx=X(tf.x)+d*Math.cos(th)*s,ty=Y(tf.y)-d*Math.sin(th)*s;
c.save();c.translate(tx,ty);c.rotate(-th);
if(!on){c.filter='grayscale(1)'}
drawBody(c,o.p,o.g,s*1e-3);
c.restore();
if(on){
// Steckwinkel: Waagerechte und Dartachse
const r=46,ax=X(tf.x),ay=Y(tf.y);
c.strokeStyle=P.mid;c.lineWidth=1;c.setLineDash([3,3]);c.beginPath();c.moveTo(ax,ay);c.lineTo(ax-r-14,ay);c.stroke();c.setLineDash([]);
c.strokeStyle=COL[i];c.lineWidth=1.5;c.beginPath();
const a0=Math.PI,a1=Math.PI-th;c.arc(ax,ay,r,Math.min(a0,a1),Math.max(a0,a1));c.stroke();
c.fillStyle=COL[i];c.font='600 13px '+FF;c.textAlign='right';
c.fillText('Steckwinkel '+fmt(o.steck,1)+'°',ax-8,ay+(o.steck>=0?20:-12));
}
c.globalAlpha=1;
});
const g=out[1-act];
c.fillStyle=P.mid;c.font='11px '+FF;c.textAlign='left';
c.fillText('Endlage von der Seite (maßstabsgetreu)',6,13);
c.fillText((act?'A':'B')+' (Ghost): '+fmt(g.steck,1)+'°, Eindringtiefe '+fmt(g.depth)+' mm',6,H-6);
}
function drawDarts(){
const c=DT.c,W=DT.W,H=DT.H;c.clearRect(0,0,W,H);
const L=Math.max(out[0].g.len,out[1].g.len),sc=Math.min(1.9,(W-24)/L);
out.forEach((o,i)=>{
const y=H/4+i*H/2;
c.save();c.translate(W-10,y+2);
c.globalAlpha=i===act?1:0.45;
drawBody(c,o.p,o.g,sc);
const X=s=>-s*sc;
c.fillStyle=CG;c.strokeStyle='#fff';c.lineWidth=1.5;c.beginPath();c.arc(X(o.g.sCG),0,4,0,7);c.fill();c.stroke();
const cx=X(o.g.sCP);c.strokeStyle=CPC;c.lineWidth=2.2;c.beginPath();c.moveTo(cx-4,-4);c.lineTo(cx+4,4);c.moveTo(cx-4,4);c.lineTo(cx+4,-4);c.stroke();
const gx=X(o.p.grip);c.strokeStyle=P.ink;c.lineWidth=2;c.beginPath();c.moveTo(gx,-10);c.lineTo(gx,10);c.stroke();
c.restore();
c.fillStyle=COL[i];c.font='600 12px '+FF;c.textAlign='left';c.fillText(i?'B':'A',4,y+6);
});
c.fillStyle=P.mid;c.font='10px '+FF;c.textAlign='right';c.fillText('● Schwerpunkt  × Druckpunkt  | Griff',W-6,H-3);
}
function drawBoard(){
const c=BD.c,W=BD.W,H=BD.H;c.clearRect(0,0,W,H);
// Ausschnitt: ±60 mm um den Bull (Single-Bull bis Triple-Ring)
const R=60,s=(Math.min(W,H)/2-4)/R,cx=W/2,cy=H/2,X=z=>cx+z*s,Y=y=>cy-y*s;
c.save();c.beginPath();c.rect(0,0,W,H);c.clip();
c.strokeStyle=P.faint;c.lineWidth=1;
[6.35,15.9,99,107].forEach(r=>{c.beginPath();c.arc(cx,cy,r*s,0,7);c.stroke()});
for(let k=0;k<20;k++){const a=(k*18-9)*D;c.beginPath();c.moveTo(cx+15.9*s*Math.sin(a),cy-15.9*s*Math.cos(a));c.lineTo(cx+107*s*Math.sin(a),cy-107*s*Math.cos(a));c.stroke()}
c.fillStyle='#D85A30';c.beginPath();c.arc(cx,cy,2.5,0,7);c.fill();
out.forEach((o,i)=>{
c.globalAlpha=0.8;c.fillStyle=COL[i];c.strokeStyle=COL[i];c.lineWidth=1.3;o.sc.forEach(q=>{c.beginPath();c.arc(X(q[0]),Y(q[1]),i?3.4:2.4,0,7);i?c.stroke():c.fill()});c.globalAlpha=1;
c.strokeStyle=COL[i];c.lineWidth=1.4;c.setLineDash(i?[4,3]:[]);c.beginPath();c.arc(X(o.cx),Y(o.cy),o.r90*s,0,7);c.stroke();c.setLineDash([]);
});
c.restore();
c.fillStyle=P.mid;c.font='11px '+FF;c.textAlign='left';c.fillText(W>200?'Trefferbild (±60 mm): 24 Würfe je Dart, A ● B ○, Kreis = 90 %':'Trefferbild',6,13);
}
function redraw(){pal();drawEnd();drawFlight();drawDarts();drawBoard()}
// Neuberechnung höchstens einmal pro Frame, damit die Regler flüssig bleiben
let pending=false;
function recompute(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;pal();calc(0);calc(1);labels();redraw();markLoaded()})}

/* ---------- Bedienung ---------- */
function setAct(i){
act=i;
['sA','eA'].forEach(id=>$(id).setAttribute('aria-pressed',i===0?'true':'false'));
['sB','eB'].forEach(id=>$(id).setAttribute('aria-pressed',i===1?'true':'false'));
document.querySelector('.ctl').classList.toggle('edB',i===1);
syncUI();labels();redraw();
}
function syncUI(){
const s=setups[act];
$('wt').value=s.wt;$('bar').value=s.bar;$('dia').value=s.dia;$('cg').value=s.cg;$('tip').value=s.tip;$('gr').value=s.grip;$('sh').value=s.shaft;
$('seg').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.s===s.shape?'true':'false'));
$('nm').value='';
}
function esc(t){const d=document.createElement('div');d.textContent=t==null?'':String(t);return d.innerHTML}
function range(a,d){const lo=Math.min.apply(null,a),hi=Math.max.apply(null,a);return lo===hi?fmt(lo,d):fmt(lo,d)+'–'+fmt(hi,d)}
function renderBrands(){
const el=$('brands'),own=custom.length;
const list=[['',`Alle`,all().length]].concat(brands.map(b=>[b.brand,b.brand,b.count]));
if(own)list.push([OWN,OWN,own]);
el.innerHTML=list.map(b=>'<button data-b="'+esc(b[0])+'" aria-pressed="'+(b[0]===brandSel)+'">'+esc(b[1])+'<small>'+b[2]+'</small></button>').join('');
}
function renderList(){
const q=$('q').value.trim().toLowerCase(),L=$('list');
const items=all().filter(d=>(!brandSel||d.brand===brandSel)&&(!q||(d.name+' '+(d.short||'')+' '+(d.brand||'')).toLowerCase().includes(q)));
// gruppieren: Marke -> Modell -> Gewichte
const groups=new Map();
items.forEach(d=>{const k=(d.brand||'')+'\u0000'+(d.model||d.name);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(d)});
let html='',lastBrand=null,nModels=0;
groups.forEach(ds=>{
ds.sort((a,b)=>a.bw-b.bw);const d0=ds[0];nModels++;
if(!brandSel&&d0.brand!==lastBrand){html+='<div class="bh">'+esc(d0.brand)+'</div>';lastBrand=d0.brand}
const spec=[esc(d0.shape||''),range(ds.map(d=>d.len),1)+' mm','Ø '+range(ds.map(d=>d.dia),2)+' mm','Schwerpunkt '+esc(d0.bal||'')].join(' · ');
html+='<div class="mdl"><div class="t"><b>'+esc(modelLabel(d0))+'</b>'+(d0.url?'<a href="'+esc(d0.url)+'" target="_blank" rel="noopener">Quelle</a>':'')+'</div><div class="s">'+spec+'</div><div class="wts">'+
ds.map(d=>'<button data-id="'+esc(d.id)+'" title="'+esc(d.name)+'">'+fmt(d.bw,1)+' g</button>'+(d.custom?'<button class="del" data-del="'+esc(d.id)+'" aria-label="'+esc(d.name)+' löschen">✕</button>':'')).join('')+'</div></div>';
});
L.innerHTML=html||'<p class="note" style="padding:10px">Kein Treffer. Stelle die Werte unten ein und speichere den Dart mit einem Namen.</p>';
$('cnt').textContent=nModels+' Modelle, '+items.length+' Gewichte';
markLoaded();
}
function markLoaded(){
$('list').querySelectorAll('.wts button[data-id]').forEach(b=>{
b.classList.toggle('inA',setups[0].dartId===b.dataset.id&&!setups[0].mod);
b.classList.toggle('inB',setups[1].dartId===b.dataset.id&&!setups[1].mod)});
}
function loadDart(d){
const s=setups[act];
setups[act]=Object.assign(fromDart(d),{grip:s.grip,tip:s.tip,shaft:s.shaft,shape:s.shape});
syncUI();recompute();
}
$('list').addEventListener('click',e=>{
const b=e.target.closest('button');if(!b)return;
if(b.dataset.del){custom=custom.filter(c=>c.id!==b.dataset.del);saveCustom();renderBrands();renderList();return}
const d=byId(b.dataset.id);if(d)loadDart(d);
});
$('brands').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;brandSel=b.dataset.b;renderBrands();renderList();$('list').scrollTop=0});
const map={wt:'wt',bar:'bar',dia:'dia',cg:'cg',tip:'tip',sh:'shaft',gr:'grip'};
Object.keys(map).forEach(id=>$(id).addEventListener('input',()=>{const s=setups[act];s.mod=s.mod||['wt','bar','dia','cg'].includes(id);s[map[id]]=+$(id).value;recompute()}));
['v','h'].forEach(id=>$(id).addEventListener('input',recompute));
$('seg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;setups[act].shape=b.dataset.s;syncUI();recompute()});
$('sA').addEventListener('click',()=>setAct(0));$('sB').addEventListener('click',()=>setAct(1));
$('eA').addEventListener('click',()=>setAct(0));$('eB').addEventListener('click',()=>setAct(1));
$('q').addEventListener('input',renderList);
$('sv').addEventListener('click',()=>{
const name=$('nm').value.trim();
if(!name){$('svn').textContent='Bitte zuerst einen Namen eintragen.';return}
const s=setups[act],id='u-'+Date.now();
const rec={id:id,name:name,short:name,bw:s.wt,len:s.bar,dia:s.dia,shape:'eigene Angabe',bal:'eigene Angabe',cg:s.cg,custom:true};
custom.push(rec);
if(!saveCustom()){custom.pop();$('svn').textContent='Speichern nicht möglich (Browser-Speicher gesperrt).';return}
setups[act].name=name;setups[act].dartId=id;setups[act].mod=false;$('svn').textContent='Gespeichert unter „Eigene“: '+name;$('nm').value='';
renderBrands();renderList();labels();
});
window.addEventListener('resize',()=>{setup();redraw()});
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',redraw)}catch(e){}

/* ---------- Start ---------- */
setup();syncUI();renderBrands();renderList();recompute();
fetch('data/brands.json?v='+DATA_V).then(r=>{if(!r.ok)throw 0;return r.json()})
.then(ix=>Promise.all(ix.brands.map(b=>fetch('data/'+b.file+'?v='+DATA_V).then(r=>{if(!r.ok)throw 0;return r.json()}).then(j=>{j.darts.forEach(d=>d.brand=j.brand);return{info:b,darts:j.darts}}))))
.then(res=>{
brands=res.map(r=>r.info);darts=[].concat.apply([],res.map(r=>r.darts));
$('dbn').textContent='';renderBrands();renderList();
})
.catch(()=>{$('dbn').textContent='Datenbank (data/brands/) nicht geladen, es werden nur 2 Beispiel-Darts gezeigt. Die App über einen Webserver öffnen, nicht per Doppelklick.'});
})();
