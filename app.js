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
const PH=window.DartPhys,D=PH.D,RHO=PH.RHO,YB=PH.YB,GK=PH.GK,F_RES=PH.F_RES,K_SCATTER=PH.K_SCATTER,shapeFor=PH.shapeFor,geom=PH.geom,sim3=PH.sim3,solveAng=PH.solveAng,scatter=PH.scatter;
const FF="Barlow,system-ui,sans-serif";

const fmt=(x,d)=>x.toLocaleString('de-DE',{minimumFractionDigits:d||0,maximumFractionDigits:d||0});

/* ---------- Dart-Datenbank (nach Marken, data/brands/*.json) ---------- */
// Startauswahl, falls die Datenbank nicht geladen werden kann (z. B. Aufruf per file://)
const SRC='https://a-zdarts.com/products/';
const SEED=[
{id:'target-aspinall-g2-24',brand:'Target',model:'Target Nathan Aspinall G2',name:'Target Nathan Aspinall G2 (24 g)',short:'Aspinall G2',bw:24,len:50.05,dia:7.07,shape:'Torpedo',bal:'vorn',cg:40,url:SRC+'target-nathan-aspinall-g2-steel-tip-darts-24gm'},
{id:'target-littler-g1-23',brand:'Target',model:'Target Luke Littler G1 Prodigy',name:'Target Luke Littler G1 Prodigy (23 g)',short:'Littler G1',bw:23,len:52,dia:6.5,shape:'Gerade',bal:'Mitte',cg:50,url:SRC+'target-luke-littler-g1-prodigy-swiss-point-steel-tip-darts-23gm'}
];
// Bei jeder Änderung an App oder Daten erhöhen (auch ?v= in index.html), damit Browser keine alte Version aus dem Cache nehmen
const DATA_V='6';
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
function build(s){const p={wt:s.wt,bar:s.bar,dia:s.dia,cg:s.cg,tip:s.tip,shaft:s.shaft,shape:s.shape,size:s.size,wear:0,grip:0,ang:0,h:+$('h').value,v:+$('v').value,xb:+$('xb').value,psi:0,delta:+$('dl').value*D,eps:0,wp:+$('wp').value*D,wy:0,spin:5*2*Math.PI,wind:0};p.grip=p.tip+p.bar-Math.min(s.grip,p.bar);return p}
function calc(i){
const p=build(setups[i]);p.ang=solveAng(p,0.0005);
const res=sim3(p,true),g=geom(p),miss=Math.abs(res.y-YB)>0.01;
let amax=0;res.frames.forEach(f=>{if(f.at>amax)amax=f.at});
const sc=scatter(p,K_SCATTER);let mx=0,my=0;sc.forEach(q=>{mx+=q[0];my+=q[1]});mx/=sc.length;my/=sc.length;
const d=sc.map(q=>Math.hypot(q[0]-mx,q[1]-my)).sort((a,b)=>a-b),r90=d[Math.floor(0.9*(d.length-1))];
const Eax=0.5*g.M*res.vax*res.vax,depth=Math.min(p.tip,Eax/F_RES*1000);
const l=(g.sCP-g.sCG)*1e-3,kw=0.5*RHO*p.v*p.v*g.eta*g.ae.S*g.ae.K1*l/g.I;
const wtot=(p.wp+GK*(g.sCG-p.grip)*(p.v/7))/D;
out[i]={p:p,g:g,res:res,wtot:wtot,sc:sc,miss:miss,steck:-res.th/D,ang:p.ang/D,T:res.T,amax:amax/D,r90:r90,depth:depth,per:2*Math.PI/Math.sqrt(kw),cx:mx,cy:my};
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
['Eindringtiefe',o=>o.depth,v=>fmt(v)+' mm','hi'],
['Nickrate Abwurf',o=>o.wtot,v=>fmt(v)+' °/s','']
];
function labels(){
const s=setups[act];
$('wto').textContent=fmt(s.wt,1)+' g';$('baro').textContent=fmt(s.bar,2)+' mm';$('diao').textContent=fmt(s.dia,2)+' mm';
$('cgo').textContent=s.cg+' %';
$('gro').textContent=s.grip+' mm';$('tipo').textContent=s.tip+' mm';$('sho').textContent=s.shaft+' mm';
$('vo').textContent=fmt(+$('v').value,1)+' m/s';$('ho').textContent=fmt(+$('h').value,2)+' m';$('xbo').textContent=fmt(+$('xb').value,2)+' m';
$('wpo').textContent=fmt(+$('wp').value)+' °/s';$('dlo').textContent=fmt(+$('dl').value,1)+'°';
{const o=out[act],d=o.g.sCG-o.p.grip;$('grn').textContent='Griff '+fmt(Math.abs(d))+' mm '+(Math.abs(d)<3?'am':d>0?'vor dem':'hinter dem')+' Schwerpunkt → Griff-Anteil der Nickrate '+fmt(GK*d*(o.p.v/7)/D)+' °/s (grobe Annahme, siehe README).'}
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
cell('rN',fmt(A.wtot)+' °/s',fmt(B.wtot)+' °/s');
cell('rG',fmt(-A.res.gam/D,1)+'°',fmt(-B.res.gam/D,1)+'°');
$('vA').textContent=rating(A);$('vB').textContent=rating(B);
}

/* ---------- Zeichnen ---------- */
let FL,DT,BD,ED,AA;
let meas=null; // Messpunkte des übernommenen Video-Wurfs: {pts:[{x,y,a}]}, x/y in m ab Abwurf, a = Anstellwinkel (rad)
const wide=()=>matchMedia('(min-width:860px)').matches;
function setup(){
if(wide()){FL=fit($('fl'),170);BD=fit($('bd'),260);AA=fit($('aa'),120)}
else{FL=fit($('fl'),105);BD=fit($('bd'),105);AA=fit($('aa'),78)}
DT=fit($('dt'),110);ED=fit($('ed'),wide()?220:120);
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
const hh=+$('h').value,XB=out[0].p.xb;let y0=Math.min(hh,YB),y1=Math.max(hh,YB);
if(meas)meas.pts.forEach(q=>{if(q.x<=XB){if(hh+q.y<y0)y0=hh+q.y;if(hh+q.y>y1)y1=hh+q.y}});
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
if(meas){c.strokeStyle=P.ink;c.lineWidth=1.2;meas.pts.forEach(q=>{if(q.x<=XB)c.strokeRect(X(q.x)-2.5,Y(hh+q.y)-2.5,5,5)})}
const ex=sy/sx;
c.fillStyle=P.mid;c.font='11px '+FF;c.textAlign='left';
c.fillText((W>300?'Flugbahn seitlich':'Flugbahn')+(ex>1.3?' (Höhe '+fmt(ex)+'×)':'')+(meas?'  □ Video-Messung':''),6,13);
}
// Anstellwinkel über die Flugstrecke: zeigt Pendeln und Abklingen (Flugruhe)
function drawAlpha(){
const c=AA.c,W=AA.W,H=AA.H;c.clearRect(0,0,W,H);
const XB=out[0].p.xb;let m=5;
out.forEach(o=>o.res.frames.forEach(f=>{const a=Math.abs(f.a/D);if(a>m)m=a}));
if(meas)meas.pts.forEach(q=>{const a=Math.abs(q.a/D);if(a>m&&a<45)m=a});
m=Math.ceil(m/5)*5;
const ox=10,sx=(W-24)/XB,top=18,bot=6,X=x=>ox+x*sx,Y=a=>top+(H-top-bot)*(0.5-a/D/(2*m));
c.strokeStyle=P.faint;c.lineWidth=1;c.setLineDash([3,4]);c.beginPath();c.moveTo(X(0),Y(0));c.lineTo(X(XB),Y(0));c.stroke();c.setLineDash([]);
order().forEach(i=>{const o=out[i],on=i===act;
c.globalAlpha=on?1:0.35;c.strokeStyle=COL[i];c.lineWidth=on?2.2:1.5;c.setLineDash(i?[5,3]:[]);c.beginPath();
o.res.frames.forEach((f,k)=>{k?c.lineTo(X(f.x),Y(f.a)):c.moveTo(X(f.x),Y(f.a))});c.stroke();c.setLineDash([]);c.globalAlpha=1;
});
if(meas){c.strokeStyle=P.ink;c.lineWidth=1.2;meas.pts.forEach(q=>{if(q.x<=XB&&Math.abs(q.a/D)<=m)c.strokeRect(X(q.x)-2.5,Y(q.a)-2.5,5,5)})}
c.fillStyle=P.mid;c.font='11px '+FF;c.textAlign='left';
c.fillText(W>300?'Anstellwinkel im Flug (+ = Spitze über der Flugrichtung)':'Anstellwinkel im Flug',6,13);
c.textAlign='right';c.font='10px '+FF;c.fillText('+'+m+'°',W-4,top+8);c.fillText('−'+m+'°',W-4,H-bot);
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
function redraw(){pal();drawEnd();drawFlight();drawAlpha();drawDarts();drawBoard()}
// Neuberechnung höchstens einmal pro Frame, damit die Regler flüssig bleiben
let pending=false;
function recompute(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;pal();calc(0);calc(1);labels();redraw();markLoaded();saveState();notify()})}

/* ---------- Bedienung ---------- */
function setAct(i){
act=i;
['sA','eA'].forEach(id=>$(id).setAttribute('aria-pressed',i===0?'true':'false'));
['sB','eB'].forEach(id=>$(id).setAttribute('aria-pressed',i===1?'true':'false'));
document.querySelector('.ctl').classList.toggle('edB',i===1);
syncUI();labels();redraw();saveState();notify();
}
function setAct0(){['sA','eA'].forEach(id=>$(id).setAttribute('aria-pressed',act===0?'true':'false'));['sB','eB'].forEach(id=>$(id).setAttribute('aria-pressed',act===1?'true':'false'));document.querySelector('.ctl').classList.toggle('edB',act===1)}
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
const THROW=['v','h','xb','wp','dl'];
THROW.forEach(id=>$(id).addEventListener('input',recompute));
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

/* ---------- Zustand merken (localStorage) ---------- */
const ST_KEY='dartlabor.state.v1';
function saveState(){
try{const th={};THROW.forEach(id=>th[id]=+$(id).value);localStorage.setItem(ST_KEY,JSON.stringify({setups:setups,act:act,th:th,meas:meas}))}catch(e){}
}
function loadState(){
try{
const st=JSON.parse(localStorage.getItem(ST_KEY)||'null');if(!st)return;
const num=['wt','bar','dia','cg','tip','shaft','size','grip'];
if(Array.isArray(st.setups)&&st.setups.length===2&&st.setups.every(q=>q&&num.every(k=>isFinite(q[k]))&&BASES_OK(q.shape)))setups=st.setups;
if(st.act===1)act=1;
if(st.th)THROW.forEach(id=>{if(isFinite(st.th[id]))$(id).value=st.th[id]});
if(st.meas&&Array.isArray(st.meas.pts))meas=st.meas;
}catch(e){}
}
function BASES_OK(n){return n==='n2'||n==='n6'}

/* ---------- Schnittstelle für die Video-Messung (video.js) ---------- */
const subs=[];
function notify(){subs.forEach(f=>{try{f()}catch(e){}})}
window.DartLab={
// Dart, mit dem der gefilmte Wurf ausgewertet wird (aktiver Platz)
activeDart:function(){const o=out[act];return o?{slot:act?'B':'A',name:lbl(act),len:o.g.len,sCG:o.g.sCG}:null},
onChange:function(f){subs.push(f)},
// t: {v m/s, h m, xb m, wp °/s (gesamte gemessene Nickrate), dl °}; h und xb optional. Rückgabe: begrenzte Größen
applyThrow:function(t,m){
const lim=[];
const set=(id,val,name)=>{const el=$(id);el.value=val;if(Math.abs(+el.value-val)>(+el.step||1))lim.push(name)};
set('v',t.v,'Geschwindigkeit');
if(t.h!=null)set('h',t.h,'Abwurfhöhe');
if(t.xb!=null)set('xb',t.xb,'Abstand');
// Der Regler ist der Anteil ohne Griff-Effekt: gemessene Nickrate minus Griff-Anteil des aktiven Darts
const o=out[act],grip=PH.gripRate(o.g,{grip:o.p.grip,v:+$('v').value})/D;
set('wp',t.wp-grip,'Nickrate');set('dl',t.dl,'Anstellwinkel');
meas=m||null;recompute();return lim;
},
clearMeas:function(){meas=null;redraw();saveState()}
};

/* ---------- Start ---------- */
loadState();setAct0();setup();syncUI();renderBrands();renderList();recompute();
fetch('data/brands.json?v='+DATA_V).then(r=>{if(!r.ok)throw 0;return r.json()})
.then(ix=>Promise.all(ix.brands.map(b=>fetch('data/'+b.file+'?v='+DATA_V).then(r=>{if(!r.ok)throw 0;return r.json()}).then(j=>{j.darts.forEach(d=>d.brand=j.brand);return{info:b,darts:j.darts}}))))
.then(res=>{
brands=res.map(r=>r.info);darts=[].concat.apply([],res.map(r=>r.darts));
$('dbn').textContent='';renderBrands();renderList();
})
.catch(()=>{$('dbn').textContent='Datenbank (data/brands/) nicht geladen, es werden nur 2 Beispiel-Darts gezeigt. Die App über einen Webserver öffnen, nicht per Doppelklick.'});
})();
