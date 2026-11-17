/* Dart-Labor – Steckwinkel per Foto messen: steckende Pfeile von der Seite, je Pfeil Spitze und Flight-Ende antippen.
   Optional eine senkrechte Kante als Referenz gegen Schräglage des Handys. Daraus Wurfgeschwindigkeit abschätzen.
   Das Foto wird nur lokal im Browser gelesen; gespeichert werden nur die Winkel. */
(function () {
'use strict';
const $ = id => document.getElementById(id), LAB = window.DartLab, D = Math.PI / 180;
const fmt = (x, d) => x.toLocaleString('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const CV = $('pc'), img = new Image();
const C_TIP = '#FFB000', C_FL = '#00D5FF', C_V = '#7CFF6B';
const KEY = 'dartlabor.photo.v1';

let ready = false, mode = 'dart', pend = null, vert = null, vpend = null;
let darts = [];                   // [{tip:{x,y}, fl:{x,y}}] in Bildpixeln
let saved = [];                   // gespeicherte Winkel (°), auch ohne Foto
let view = { z: 1, ox: 0, oy: 0 }, cw = 300, ch = 300, base = 1, url = null;
try { const r = JSON.parse(localStorage.getItem(KEY) || 'null'); if (r && Array.isArray(r.angles)) saved = r.angles.filter(isFinite); } catch (e) {}

/* ---------- Winkel ---------- */
// Schräglage des Handys aus der Senkrechten (rad, + = Unterkante nach rechts versetzt)
function roll() {
  if (!vert) return 0;
  let dx = vert.b.x - vert.a.x, dy = vert.b.y - vert.a.y;
  if (dy < 0) { dx = -dx; dy = -dy; }
  return Math.atan2(dx, dy);
}
// Steckwinkel: Winkel der Achse Spitze → Flight-Ende über der Waagerechten (+ = Flight höher als Spitze)
function angle(d) {
  const r = roll(), wx = d.fl.x - d.tip.x, wy = d.fl.y - d.tip.y;
  const down = wx * Math.sin(r) + wy * Math.cos(r), hor = wx * Math.cos(r) - wy * Math.sin(r);
  return Math.atan2(-down, Math.abs(hor)) / D;
}
function angles() { return ready ? darts.map(angle) : saved; }
function store() { try { localStorage.setItem(KEY, JSON.stringify({ angles: angles() })); } catch (e) {} }

/* ---------- Foto laden ---------- */
function load(file) {
  if (!file) return;
  if (url) URL.revokeObjectURL(url);
  url = URL.createObjectURL(file);
  ready = false; darts = []; pend = null; vert = null; vpend = null; view = { z: 1, ox: 0, oy: 0 };
  $('pmsg').textContent = 'Foto wird geladen …';
  img.onload = () => { ready = true; $('pmsg').textContent = ''; $('pwork').hidden = false; resize(); setMode('dart'); render(); };
  img.onerror = () => { $('pmsg').textContent = 'Der Browser kann dieses Bild nicht lesen. Als JPEG oder PNG speichern und erneut wählen.'; };
  img.src = url;   // Browser drehen nach EXIF-Ausrichtung (image-orientation: from-image ist Standard)
}
$('pcam').addEventListener('change', e => load(e.target.files[0]));
$('pfile').addEventListener('change', e => load(e.target.files[0]));

/* ---------- Anzeige ---------- */
function resize() {
  if (!ready) return;
  const w0 = CV.parentElement.clientWidth || 300, W = img.naturalWidth, H = img.naturalHeight;
  ch = Math.min(w0 * H / W, 0.75 * window.innerHeight); cw = ch * W / H;
  if (cw > w0) { cw = w0; ch = cw * H / W; }
  const dpr = window.devicePixelRatio || 1;
  CV.style.width = cw + 'px'; CV.style.height = ch + 'px'; CV.style.margin = '0 auto';
  CV.width = Math.round(cw * dpr); CV.height = Math.round(ch * dpr);
  base = cw / W; fixView(); draw();
}
function fixView() {
  const s = base * view.z;
  view.ox = clamp(view.ox, 0, Math.max(0, img.naturalWidth - cw / s)); view.oy = clamp(view.oy, 0, Math.max(0, img.naturalHeight - ch / s));
}
function mark(c, p, col, label) {
  c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.beginPath(); c.arc(p.x, p.y, 5, 0, 7); c.stroke();
  c.lineWidth = 1.6; c.strokeStyle = col; c.beginPath(); c.arc(p.x, p.y, 5, 0, 7); c.moveTo(p.x - 9, p.y); c.lineTo(p.x + 9, p.y); c.moveTo(p.x, p.y - 9); c.lineTo(p.x, p.y + 9); c.stroke();
  if (label) text(c, label, p.x + 9, p.y - 9, col);
}
function text(c, t, x, y, col) { c.font = '600 12px Barlow,system-ui,sans-serif'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.75)'; c.strokeText(t, x, y); c.fillStyle = col; c.fillText(t, x, y); }
function line(c, a, b, col) {
  c.lineWidth = 3.4; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
  c.lineWidth = 1.6; c.strokeStyle = col; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
}
function draw() {
  if (!ready) return;
  const c = CV.getContext('2d'), dpr = CV.width / cw, s = base * view.z;
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, cw, ch);
  c.drawImage(img, view.ox, view.oy, cw / s, ch / s, 0, 0, cw, ch);
  const S = p => ({ x: (p.x - view.ox) * s, y: (p.y - view.oy) * s });
  if (vert) line(c, S(vert.a), S(vert.b), C_V);
  if (vpend) mark(c, S(vpend), C_V, 'Senkrechte, Punkt 1');
  darts.forEach((d, i) => { const t = S(d.tip), f = S(d.fl); line(c, t, f, '#FFFFFF'); mark(c, t, C_TIP); mark(c, f, C_FL); text(c, (i + 1) + ': ' + fmt(angle(d), 1) + '°', f.x + 8, f.y - 8, '#FFFFFF'); });
  if (pend) mark(c, S(pend), C_TIP, 'Spitze');
}
function hint() {
  $('phint').textContent = mode === 'dart'
    ? (pend ? 'Jetzt das Flight-Ende desselben Pfeils antippen (hinterstes Ende).' : 'Spitze dort antippen, wo sie ins Board geht, dann das Flight-Ende. Zum genauen Treffen vergrößern (+, Mausrad oder zwei Finger).')
    : (vpend ? 'Jetzt einen zweiten Punkt weiter oben oder unten auf derselben senkrechten Kante antippen.' : 'Zwei Punkte auf einer Kante antippen, die in echt senkrecht ist (Cabinet, Türrahmen, Wandecke). Die Board-Fläche eignet sich nicht, wenn sie schräg im Bild liegt.');
}
function setMode(m) {
  mode = m; pend = null; vpend = null;
  $('pmode').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === m ? 'true' : 'false'));
  hint(); draw();
}

/* ---------- Ergebnis ---------- */
function stats(a) {
  const n = a.length, m = a.reduce((p, q) => p + q, 0) / n;
  return { n: n, m: m, sd: n > 1 ? Math.sqrt(a.reduce((p, q) => p + (q - m) * (q - m), 0) / (n - 1)) : null };
}
function render() {
  const a = angles();
  $('pres').hidden = !a.length;
  $('plab').textContent = ready ? darts.length + ' Pfeil(e) markiert' + (vert ? ', Schräglage ' + fmt(roll() / D, 1) + '° ausgeglichen' : '') : '';
  if (!a.length) return;
  const st = stats(a);
  $('plist').innerHTML = '<div class="plist">' + a.map((x, i) => '<span>Pfeil ' + (i + 1) + '</span><span>' + fmt(x, 1) + '°</span>' +
    (ready ? '<button class="del" data-i="' + i + '" aria-label="Pfeil ' + (i + 1) + ' löschen">✕</button>' : '<span></span>')).join('') +
    '<b>Mittel</b><b>' + fmt(st.m, 1) + '°' + (st.sd != null ? ' ± ' + fmt(st.sd, 1) + '°' : '') + '</b><span></span></div>';
  $('pnote').textContent = (ready ? '' : 'Gespeicherte Werte der letzten Messung (Foto nicht gespeichert). ') +
    '+ = Flight höher als die Spitze. ± = Streuung zwischen den Pfeilen (1 σ). ' + (vert ? '' : 'Ohne Senkrechte geht eine Schräglage des Handys 1:1 in den Winkel ein. ') +
    'Schräge Sicht auf die Pfeile verfälscht den Winkel; am genauesten genau von der Seite.';
  store();
}
$('plist').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (!b) return; darts.splice(+b.dataset.i, 1); draw(); render(); });
$('pundo').addEventListener('click', () => { if (pend) pend = null; else darts.pop(); hint(); draw(); render(); });
$('pclr').addEventListener('click', () => { darts = []; pend = null; vert = null; vpend = null; hint(); draw(); render(); });

// Geschwindigkeit, bei der der aktive Dart mit dem gemessenen Winkel steckt (übrige Wurfwerte wie eingestellt)
$('pest').addEventListener('click', () => {
  const a = angles(); if (!a.length) return;
  const st = stats(a), d = LAB.activeDart(), s = LAB.setup(d.slot === 'B' ? 1 : 0);
  const r = LAB.speedForSteck(s, st.m);
  if (!r) { $('pestn').textContent = 'Mit Dart ' + d.slot + ' und den eingestellten Wurfwerten (Höhe, Abstand, Nickrate, Anstellwinkel) ist ' + fmt(st.m, 1) + '° zwischen 4 und 12 m/s nicht erreichbar. Wurfwerte in Abschnitt 4 prüfen.'; return; }
  // Bandbreite aus der Streuung der Pfeile
  const lo = st.sd ? LAB.speedForSteck(s, st.m + st.sd) : null, hi = st.sd ? LAB.speedForSteck(s, st.m - st.sd) : null;
  const vset = LAB.setThrowValue('v', r.v);
  $('pestn').textContent = 'Geschätzt: ' + fmt(r.v, 2) + ' m/s' + (lo && hi ? ' (Bandbreite ' + fmt(lo.v, 2) + '–' + fmt(hi.v, 2) + ' m/s)' : '') +
    ', mit Dart ' + d.slot + ' „' + d.name + '“ und den übrigen Wurfwerten wie eingestellt (Abwurfhöhe ' + fmt(+$('h').value, 2) + ' m, Abstand ' + fmt(+$('xb').value, 2) + ' m, Nickrate ' + fmt(+$('wp').value) + ' °/s, Anstellwinkel ' + fmt(+$('dl').value, 1) + '°). ' +
    'Geschwindigkeits-Regler auf ' + fmt(vset, 1) + ' m/s gesetzt. Im Modell verschieben andere Annahmen für Abwurfhöhe (±10 cm), Nickrate (−412 °/s) oder Abstand (−20 cm) das Ergebnis nur um etwa 0,1–0,2 m/s. Voraussetzung: Der Winkel im Board entspricht fast dem Auftreffwinkel (Einschlag-Modell) und das Foto ist genau von der Seite.';
});

/* ---------- Zeigen, Zoomen, Tippen ---------- */
const pts = new Map(); let moved = false, pinch = null;
const pos = e => { const r = CV.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
function zoomAt(p, z) {
  z = clamp(z, 1, 20);
  const s0 = base * view.z, ix = view.ox + p.x / s0, iy = view.oy + p.y / s0, s1 = base * z;
  view.z = z; view.ox = ix - p.x / s1; view.oy = iy - p.y / s1; fixView(); draw();
}
CV.addEventListener('pointerdown', e => {
  if (!ready) return;
  CV.setPointerCapture(e.pointerId); const p = pos(e); pts.set(e.pointerId, { x: p.x, y: p.y, sx: p.x, sy: p.y });
  if (pts.size === 1) moved = false;
  else if (pts.size === 2) { const a = Array.from(pts.values()); pinch = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), z: view.z }; moved = true; }
});
CV.addEventListener('pointermove', e => {
  const q = pts.get(e.pointerId); if (!q) return;
  const p = pos(e), dx = p.x - q.x, dy = p.y - q.y; q.x = p.x; q.y = p.y;
  if (pts.size === 1) {
    if (Math.hypot(p.x - q.sx, p.y - q.sy) > 8) moved = true;
    if (moved) { const s = base * view.z; view.ox -= dx / s; view.oy -= dy / s; fixView(); draw(); }
  } else if (pts.size === 2 && pinch) {
    const a = Array.from(pts.values()), d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
    zoomAt({ x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 }, pinch.z * d / Math.max(1, pinch.d));
  }
});
function up(e, isTap) {
  if (!pts.has(e.pointerId)) return;
  const single = pts.size === 1; pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
  if (single && isTap && !moved) { const p = pos(e), s = base * view.z; tap({ x: view.ox + p.x / s, y: view.oy + p.y / s }); }
}
CV.addEventListener('pointerup', e => up(e, true));
CV.addEventListener('pointercancel', e => up(e, false));
CV.addEventListener('wheel', e => { if (!ready) return; e.preventDefault(); zoomAt(pos(e), view.z * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
function tap(p) {
  if (mode === 'dart') {
    if (!pend) pend = p; else { darts.push({ tip: pend, fl: p }); pend = null; }
  } else {
    if (!vpend) { vpend = p; vert = null; } else { vert = { a: vpend, b: p }; vpend = null; }
  }
  hint(); draw(); render();
}
$('pmode').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.m); });
$('pzi').addEventListener('click', () => zoomAt({ x: cw / 2, y: ch / 2 }, view.z * 1.6));
$('pzo').addEventListener('click', () => zoomAt({ x: cw / 2, y: ch / 2 }, view.z / 1.6));
$('pzr').addEventListener('click', () => zoomAt({ x: cw / 2, y: ch / 2 }, 1));
window.addEventListener('resize', () => { if (ready) resize(); });
$('pdet').addEventListener('toggle', () => { if (ready) resize(); });
render();
})();
