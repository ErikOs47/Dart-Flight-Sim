/* Dart-Labor – Physikmodell (3D-Starrkörper, Flight-Aerodynamik).
   Ohne DOM, läuft auch in Node (Tests). Modell und Annahmen: siehe README.md. */
(function(root){
'use strict';
/* ---------- Physik-Konstanten ---------- */
const K_SCATTER=0.6;           // Skalierung der Wurfstreuung
const aeroCache={};
const D=Math.PI/180,G=9.81,RHO=1.204,NU=1.5e-5; // Luft 20 °C
const YB=1.73;                 // Bull-Höhe (m); Abstand Abwurf–Board ist Wurfparameter p.xb
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
const XB=p.xb,sc0=g.sCG*1e-3;
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
const px=x+sc0*ex,py=y+sc0*ey,pz=z+sc0*ez;
vx+=ax*dt;vy+=ay*dt;vz+=az*dt;
x+=vx*dt;y+=vy*dt;z+=vz*dt;
Lx+=Mx*dt;Ly+=My*dt;Lz+=Mz*dt;
ex+=edx*dt;ey+=edy*dt;ez+=edz*dt;
const en=Math.sqrt(ex*ex+ey*ey+ez*ez);ex/=en;ey/=en;ez/=en;
phi+=pp*dt;t+=dt;n++;
const tx=x+sc0*ex,ty=y+sc0*ey,tz=z+sc0*ez;
if(tx>=XB){
// Spitze erreicht die Board-Ebene: Treffpunkt der Spitze interpolieren
const f=(XB-px)/(tx-px),yi=py+f*(ty-py),zi=pz+f*(tz-pz),Ti=t-dt+f*dt;
const rz2=vz-wind,s2=Math.sqrt(vx*vx+vy*vy+rz2*rz2),vax2=vx*ex+vy*ey+rz2*ez;
const th2=Math.atan2(ey,Math.sqrt(ex*ex+ez*ez)),gam2=Math.atan2(vy,Math.sqrt(vx*vx+vz*vz));
let a2=th2-gam2;a2=Math.atan2(Math.sin(a2),Math.cos(a2));
const at2=Math.acos(Math.max(-1,Math.min(1,vax2/s2)));
if(keep)fr.push({t:Ti,x:XB-sc0*ex,y:yi-sc0*ey,z:zi-sc0*ez,th:th2,gam:gam2,a:a2,at:at2,phi:phi});
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
// Gesamte Nickrate beim Abwurf (rad/s): Regler-Anteil + Griff-Anteil
function gripRate(g,p){return GK*(g.sCG-p.grip)*(p.v/7)}
const api={D:D,G:G,RHO:RHO,YB:YB,GK:GK,F_RES:F_RES,K_SCATTER:K_SCATTER,shapeFor:shapeFor,geom:geom,sim3:sim3,solveAng:solveAng,scatter:scatter,gripRate:gripRate};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DartPhys=api;
})(typeof window!=='undefined'?window:globalThis);
