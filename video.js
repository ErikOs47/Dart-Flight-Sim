/* Dart-Labor – Wurf per Video messen: Video laden, Bild für Bild blättern, Dart markieren,
   automatisch weiterverfolgen, Ergebnis in die Simulation übernehmen.
   Rechnung: measure.js. Das Video wird nur lokal im Browser gelesen. */
(function () {
'use strict';
const $ = id => document.getElementById(id), ME = window.DartMeasure, LAB = window.DartLab, D = Math.PI / 180;
const fmt = (x, d) => x.toLocaleString('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
const V = $('vv'), CV = $('vc');
const off = document.createElement('canvas'), octx = off.getContext('2d', { willReadFrequently: true });
const C_TIP = '#FFB000', C_TAIL = '#00D5FF', C_SCALE = '#7CFF6B', C_REF = '#FF5AD1';
const TH_KEY = 'dartlabor.throws.v1';

let url = null, ready = false, busy = false;
let fileFps = 30, nFrames = 1, cur = { k: 0, tv: 0 };
let marks = new Map();          // Bildnummer -> {tv, tip, tail, auto}
let pend = null, mode = 'mark';
let scaleRef = null, scalePend = null, refPt = null;
let view = { z: 1, ox: 0, oy: 0 }, cw = 300, ch = 170, base = 1;
let result = null;
const cache = new Map();        // Graustufenbilder für die Verfolgung
let throws = [];
try { const r = JSON.parse(localStorage.getItem(TH_KEY) || '[]'); if (Array.isArray(r)) throws = r; } catch (e) {}

const msg = t => { $('vmsg').textContent = t; };
const stat = t => { $('vstat').textContent = t; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const capFps = () => +$('vcf').value > 0 ? +$('vcf').value : fileFps;

/* ---------- Video laden ---------- */
function load(file) {
  if (!file) return;
  ready = false; marks = new Map(); pend = null; scaleRef = null; scalePend = null; refPt = null; result = null; cache.clear();
  view = { z: 1, ox: 0, oy: 0 };
  if (url) URL.revokeObjectURL(url);
  url = URL.createObjectURL(file);
  msg('Video wird geladen …'); stat('');
  V.src = url; V.load();
}
$('vcam').addEventListener('change', e => load(e.target.files[0]));
$('vfile').addEventListener('change', e => load(e.target.files[0]));
V.addEventListener('error', () => msg('Der Browser kann dieses Video nicht lesen. Als MP4 (H.264) oder WebM speichern und erneut wählen.'));
V.addEventListener('loadeddata', init);

// Bildrate der Datei aus den Zeitstempeln einiger abgespielter Bilder
function detectFps() {
  return new Promise(res => {
    if (!V.requestVideoFrameCallback) { res(30); return; }
    const ts = []; let done = false;
    const fin = () => {
      if (done) return; done = true; V.pause();
      const d = []; for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] > 1e-4) d.push(ts[i] - ts[i - 1]);
      if (d.length < 3) { res(30); return; }
      let f = 1 / ME.median(d);
      [24, 25, 30, 48, 50, 60, 90, 100, 120, 240].forEach(c => { if (Math.abs(f - c) / c < 0.04) f = c; });
      res(f);
    };
    const cb = (n, m) => { ts.push(m.mediaTime); if (ts.length >= 14) fin(); else if (!done) V.requestVideoFrameCallback(cb); };
    V.requestVideoFrameCallback(cb);
    const p = V.play(); if (p && p.catch) p.catch(fin);
    setTimeout(fin, 1500);
  });
}
async function init() {
  if (ready || !V.videoWidth) return;
  const s = Math.min(1, 1920 / Math.max(V.videoWidth, V.videoHeight));
  off.width = Math.round(V.videoWidth * s); off.height = Math.round(V.videoHeight * s);
  fileFps = await detectFps();
  $('vff').value = Math.round(fileFps * 100) / 100; $('vcf').value = Math.round(fileFps);
  setFrames();
  $('vwork').hidden = false; resize(); ready = true;
  msg(''); setMode('mark'); renderResult();
  await goto(0);
}
function setFrames() {
  nFrames = isFinite(V.duration) ? Math.max(1, Math.floor(V.duration * fileFps)) : 3000;
  $('vpos').max = nFrames - 1;
}

/* ---------- Bild anfahren ---------- */
function seek(t) {
  return new Promise(res => {
    let done = false, mt = null;
    const fin = () => { if (done) return; done = true; res(mt != null ? mt : V.currentTime); };
    if (V.requestVideoFrameCallback) V.requestVideoFrameCallback((n, m) => { mt = m.mediaTime; fin(); });
    V.addEventListener('seeked', () => setTimeout(fin, V.requestVideoFrameCallback ? 150 : 0), { once: true });
    setTimeout(fin, 2000);
    V.currentTime = t;
  });
}
const grab = () => octx.drawImage(V, 0, 0, off.width, off.height);
async function show(k) {
  k = clamp(k, 0, nFrames - 1);
  const tv = await seek((k + 0.5) / fileFps);
  cur = { k: k, tv: tv }; grab();
}
let seeking = false, want = null;
async function goto(k) {
  if (busy) return;
  want = k; if (seeking) return; seeking = true;
  while (want !== null) { const kk = want; want = null; await show(kk); }
  seeking = false; pend = null; ui(); draw();
}

/* ---------- Anzeige ---------- */
function resize() {
  if (!off.width) return;
  const w0 = CV.parentElement.clientWidth || 300;
  ch = Math.min(w0 * off.height / off.width, 0.75 * window.innerHeight); cw = ch * off.width / off.height;
  const dpr = window.devicePixelRatio || 1;
  CV.style.width = cw + 'px'; CV.style.height = ch + 'px'; CV.style.margin = '0 auto';
  CV.width = Math.round(cw * dpr); CV.height = Math.round(ch * dpr);
  base = cw / off.width; fixView();
}
function fixView() {
  const s = base * view.z;
  view.ox = clamp(view.ox, 0, Math.max(0, off.width - cw / s)); view.oy = clamp(view.oy, 0, Math.max(0, off.height - ch / s));
}
function dot(c, p, col, label) {
  c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.beginPath(); c.arc(p.x, p.y, 6, 0, 7); c.stroke();
  c.lineWidth = 1.6; c.strokeStyle = col; c.beginPath(); c.arc(p.x, p.y, 6, 0, 7); c.moveTo(p.x - 10, p.y); c.lineTo(p.x + 10, p.y); c.moveTo(p.x, p.y - 10); c.lineTo(p.x, p.y + 10); c.stroke();
  if (label) text(c, label, p.x + 10, p.y - 10, col);
}
function text(c, t, x, y, col) {
  c.font = '600 12px Barlow,system-ui,sans-serif'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.75)'; c.strokeText(t, x, y); c.fillStyle = col; c.fillText(t, x, y);
}
function line(c, a, b, col, w) {
  c.lineWidth = w + 2; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
  c.lineWidth = w; c.strokeStyle = col; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
}
function draw() {
  if (!off.width) return;
  const c = CV.getContext('2d'), dpr = CV.width / cw, s = base * view.z;
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, cw, ch);
  c.imageSmoothingEnabled = view.z < 4;
  c.drawImage(off, view.ox, view.oy, cw / s, ch / s, 0, 0, cw, ch);
  const S = p => ({ x: (p.x - view.ox) * s, y: (p.y - view.oy) * s });
  // Marken der anderen Bilder (dünn), aktuelles Bild kräftig
  marks.forEach((m, k) => { if (k !== cur.k) { c.globalAlpha = 0.55; line(c, S(m.tail), S(m.tip), m.auto ? '#FFFFFF' : C_TIP, 1); c.globalAlpha = 1; } });
  const m = marks.get(cur.k);
  if (m && !pend) { line(c, S(m.tail), S(m.tip), '#FFFFFF', 1.4); dot(c, S(m.tip), C_TIP, 'Spitze'); dot(c, S(m.tail), C_TAIL, 'Flight'); }
  if (pend) dot(c, S(pend), C_TIP, 'Spitze');
  if (scaleRef) { line(c, S(scaleRef.a), S(scaleRef.b), C_SCALE, 1.6); dot(c, S(scaleRef.a), C_SCALE); dot(c, S(scaleRef.b), C_SCALE, 'Referenz'); }
  if (scalePend) dot(c, S(scalePend), C_SCALE, 'Referenz, Punkt 1');
  if (refPt) dot(c, S(refPt), C_REF, 'Höhenpunkt');
}
function ui() {
  $('vpos').value = cur.k;
  const t0 = marks.size ? Math.min.apply(null, Array.from(marks.values()).map(m => m.tv)) : null;
  const dt = t0 == null ? '' : ' · ' + fmt((cur.tv - t0) * fileFps / capFps() * 1000) + ' ms nach Abwurf';
  $('vlab').textContent = 'Bild ' + (cur.k + 1) + ' / ' + nFrames + dt + ' · ' + marks.size + ' markiert';
  hint();
}
function hint() {
  const d = LAB.activeDart(); let t = '';
  if (mode === 'mark') t = pend ? 'Jetzt das Flight-Ende antippen (hinterstes Ende des Darts).'
    : 'Zum ersten Bild blättern, in dem der Dart die Hand verlassen hat. Spitze antippen, dann das Flight-Ende. Das früheste markierte Bild zählt als Abwurf. Mindestens 3 Bilder, besser 5 bis 10.';
  else if (mode === 'scale') t = scalePend ? 'Jetzt das zweite Ende der Referenzstrecke antippen.'
    : 'Optional. Ohne Referenz dient die Länge von Dart ' + (d ? d.slot + ' (' + fmt(d.len) + ' mm)' : '') + ' als Maßstab. Genauer: beide Enden einer bekannten Strecke antippen, die gleich weit von der Kamera entfernt ist wie die Wurflinie.';
  else t = 'Optional, für Abwurfhöhe und Abstand: einen Punkt bekannter Höhe antippen, am besten die Bull-Mitte.';
  $('vhint').textContent = t;
}
function setMode(m) {
  mode = m; pend = null; scalePend = null;
  $('vmode').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === m ? 'true' : 'false'));
  $('vo-scale').hidden = m !== 'scale'; $('vo-ref').hidden = m !== 'ref';
  hint(); draw();
}

/* ---------- Zeigen, Zoomen, Tippen ---------- */
const pts = new Map(); let moved = false, pinch = null;
const pos = e => { const r = CV.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
function zoomAt(p, z) {
  z = clamp(z, 1, 16);
  const s0 = base * view.z, ix = view.ox + p.x / s0, iy = view.oy + p.y / s0, s1 = base * z;
  view.z = z; view.ox = ix - p.x / s1; view.oy = iy - p.y / s1; fixView(); draw();
}
CV.addEventListener('pointerdown', e => {
  if (!ready || busy) return;
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
CV.addEventListener('keydown', e => {
  const st = { ArrowLeft: -1, ArrowRight: 1, PageUp: -10, PageDown: 10 }[e.key];
  if (st) { e.preventDefault(); goto(cur.k + st); }
});
function tap(p) {
  if (mode === 'mark') {
    if (!pend) { pend = p; hint(); draw(); return; }
    marks.set(cur.k, { tv: cur.tv, tip: pend, tail: p });
    pend = null; compute();
    if (cur.k < nFrames - 1) goto(cur.k + 1); else { ui(); draw(); }
  } else if (mode === 'scale') {
    if (!scalePend) { scalePend = p; scaleRef = null; } else { scaleRef = { a: scalePend, b: p }; scalePend = null; }
    hint(); draw(); compute();
  } else { refPt = p; draw(); compute(); }
}

/* ---------- Automatische Verfolgung ---------- */
async function gray(k) {
  if (cache.has(k)) return cache.get(k);
  const tv = await seek((k + 0.5) / fileFps); grab();
  const W = off.width, H = off.height, d = octx.getImageData(0, 0, W, H).data, g = new Uint8Array(W * H);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8;
  const e = { g: g, tv: tv }; cache.set(k, e);
  if (cache.size > 8) cache.delete(cache.keys().next().value);
  return e;
}
async function autoTrack() {
  if (!ready || busy) return;
  const ks = Array.from(marks.keys()).sort((a, b) => a - b);
  if (ks.length < 2) { stat('Zuerst den Dart in zwei Bildern von Hand markieren (am besten direkt aufeinanderfolgend).'); return; }
  busy = true; $('vauto').disabled = true;
  const W = off.width, H = off.height, m0 = marks.get(ks[0]), L = Math.hypot(m0.tip.x - m0.tail.x, m0.tip.y - m0.tail.y);
  const mid = m => ({ x: (m.tip.x + m.tail.x) / 2, y: (m.tip.y + m.tail.y) / 2 });
  let a = ks[ks.length - 2], b = ks[ks.length - 1], added = 0, why = 'Höchstzahl erreicht';
  try {
    for (let i = 0; i < 80; i++) {
      const st = b - a, k = b + st;
      if (k >= nFrames) { why = 'Videoende'; break; }
      const ma = marks.get(a), mb = marks.get(b), ca = mid(ma), cb = mid(mb), dx = cb.x - ca.x, dy = cb.y - ca.y, step = Math.hypot(dx, dy);
      if (step < 0.03 * L) { why = 'Dart bewegt sich nicht mehr'; break; }
      // Vergleichsbilder so weit entfernt, dass der Dart sich dort nicht mehr mit sich selbst überdeckt
      const n = clamp(Math.ceil(1.3 * L / (step / st)), 1, 40);
      const Gk = await gray(k), Gp = k - n >= 0 ? await gray(k - n) : null, Gn = k + n < nFrames ? await gray(k + n) : null;
      const pr = { cx: cb.x + dx, cy: cb.y + dy, ux: (mb.tip.x - mb.tail.x) / L, uy: (mb.tip.y - mb.tail.y) / L, L: L, R: 1.2 * L + 0.5 * step };
      const r = ME.trackStep(Gk.g, Gp && Gp.g, Gn && Gn.g, W, H, pr);
      if (!r || Math.hypot((r.tip.x + r.tail.x) / 2 - pr.cx, (r.tip.y + r.tail.y) / 2 - pr.cy) > 0.6 * step + 0.2 * L) { why = 'Dart in Bild ' + (k + 1) + ' nicht sicher erkannt'; break; }
      marks.set(k, { tv: Gk.tv, tip: r.tip, tail: r.tail, auto: true }); added++; a = b; b = k;
      stat('Verfolge … Bild ' + (k + 1));
    }
  } catch (e) { why = 'Fehler beim Lesen des Videos'; }
  await show(b); busy = false; $('vauto').disabled = false;
  compute(); ui(); draw();
  stat(added + ' Bilder automatisch markiert (Ende: ' + why + '). ' + (added < 3
    ? 'Kurz nach dem Loslassen stört oft die Wurfhand, oder der Dart ist zu unscharf: 2 bis 3 weitere Bilder von Hand markieren und erneut starten.'
    : 'Bitte durchblättern und prüfen; eine falsche Marke durch erneutes Antippen von Spitze und Flight-Ende ersetzen oder löschen.'));
}

/* ---------- Auswertung ---------- */
function compute() {
  const d = LAB.activeDart();
  result = null;
  if (d && marks.size >= 3) {
    const cf = capFps(), arr = Array.from(marks.values()).map(m => ({ t: m.tv * fileFps / cf, tip: m.tip, tail: m.tail }));
    const opt = { dartLen: d.len * 1e-3, cgFrac: d.sCG / d.len };
    const Lr = +$('vsv').value;
    if (scaleRef && Lr > 0) opt.scale = Lr * 1e-3 / Math.hypot(scaleRef.a.x - scaleRef.b.x, scaleRef.a.y - scaleRef.b.y);
    if (refPt && isFinite(+$('vrv').value)) opt.ref = { x: refPt.x, y: refPt.y, h: +$('vrv').value, board: $('vrl').value === 'bull' };
    result = ME.fitThrow(arr, opt); if (result) result.scaled = !!opt.scale;
  }
  renderResult();
}
const pm = (x, d) => isFinite(x) ? ' ± ' + fmt(x, d) : '';
function renderResult() {
  const r = result; $('vres').hidden = !r;
  if (!r) { if (ready && marks.size) stat('Noch ' + (3 - marks.size) + ' Bild(er) markieren, dann erscheint das Ergebnis.'); return; }
  const d = LAB.activeDart();
  const rows = [
    ['Geschwindigkeit', fmt(r.v, 2) + pm(r.se.v, 2) + ' m/s', 'Amateure (Median): 6,0 m/s'],
    ['Abwurfwinkel (Flugbahn)', fmt(r.gam / D, 1) + pm(r.se.gam / D, 1) + '°', 'Amateure: 16,5° · die Simulation berechnet ihn selbst'],
    ['Dartwinkel beim Abwurf', fmt(r.th0 / D, 1) + pm(r.se.th0 / D, 1) + '°', 'Amateure: 19,4°'],
    ['Anstellwinkel', fmt(r.alpha / D, 1) + pm(r.se.alpha / D, 1) + '°', 'Dartwinkel minus Abwurfwinkel · Amateure: +2,9°'],
    ['Nickrate', fmt(r.wp / D) + pm(r.se.wp / D, 0) + ' °/s', 'minus = Spitze kippt nach unten · Amateure: −412 °/s'],
    ['Abwurfhöhe', r.h == null ? '–' : fmt(r.h, 2) + ' m', r.h == null ? 'Höhenpunkt fehlt (Reiter „Höhe / Board“)' : 'Schwerpunkt des Darts beim Abwurf'],
    ['Abstand Abwurf–Board', r.xb == null ? '–' : fmt(r.xb, 2) + ' m', r.xb == null ? 'dafür die Bull-Mitte als Höhenpunkt setzen' : 'waagerecht bis zur Board-Fläche'],
    ['Grundlage', r.n + ' Bilder über ' + fmt(r.dur * 1000) + ' ms', 'Maßstab ' + fmt(r.scale * 1000, 2) + ' mm/px (' + (r.scaled ? 'Referenzstrecke' : 'Dartlänge') + '), Dart ' + fmt(r.lenPx) + ' px lang, Bahn-Abweichung ' + fmt(r.rms * 1000, 1) + ' mm']
  ];
  $('vtbl').innerHTML = '<div class="h">Größe</div><div class="h">Messwert</div><div class="h x">Einordnung</div>' +
    rows.map(q => '<div class="k">' + q[0] + '</div><div>' + q[1] + '</div><div class="x">' + q[2] + '</div>').join('');
  $('vwarn').innerHTML = r.warn.map(w => '<p class="warn">⚠ ' + w + '</p>').join('');
  $('vnote').textContent = 'Ausgewertet mit Dart ' + d.slot + ' „' + d.name + '“ (Länge ' + fmt(d.len) + ' mm, Schwerpunkt ' + fmt(d.sCG) + ' mm ab Spitze). Mit einem anderen Dart gefilmt? Dann diesen zuerst als aktiven Dart einstellen. ± = Unsicherheit aus der Streuung der Marken (1 σ), ohne Fehler durch Kameraperspektive. Vergleichswerte: James & Potts 2018.';
  stat('');
}
function applied(lim, t) {
  $('vapp').textContent = 'Übernommen: Geschwindigkeit, Nickrate, Anstellwinkel' + (t.h != null ? ', Abwurfhöhe' : '') + (t.xb != null ? ', Abstand' : '') + '.' +
    (t.h == null ? ' Abwurfhöhe und Abstand bleiben wie eingestellt (kein Höhenpunkt).' : '') +
    (lim.length ? ' Am Reglerende begrenzt: ' + lim.join(', ') + '.' : '') + ' Der Nickraten-Regler zeigt den Wert ohne Griff-Anteil; die Summe steht unter „Nickrate Abwurf“.';
}
$('vapply').addEventListener('click', () => {
  if (!result) return;
  const r = result, t = { v: r.v, h: r.h, xb: r.xb, wp: r.wp / D, dl: r.alpha / D };
  applied(LAB.applyThrow(t, { pts: r.pts.map(q => ({ x: q.x, y: q.y, a: q.a })) }), t);
  document.getElementById('h-lab').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

/* ---------- Gemerkte Würfe ---------- */
function saveThrows() { try { localStorage.setItem(TH_KEY, JSON.stringify(throws)); } catch (e) {} }
function mean(k) { const a = throws.map(t => t[k]).filter(x => x != null && isFinite(x)); return a.length ? a.reduce((p, q) => p + q, 0) / a.length : null; }
// Standardabweichung (Stichprobe, n − 1), null bei weniger als 3 Werten
function sdev(k) { const a = throws.map(t => t[k]).filter(x => x != null && isFinite(x)); if (a.length < 3) return null; const m = a.reduce((p, q) => p + q, 0) / a.length; return Math.sqrt(a.reduce((p, q) => p + (q - m) * (q - m), 0) / (a.length - 1)); }
function renderThrows() {
  $('vlist').hidden = !throws.length;
  if (!throws.length) return;
  const row = (n, t, del) => '<div class="k">' + n + '</div><div>' + fmt(t.v, 2) + '</div><div>' + fmt(t.gam, 1) + '°</div><div>' + fmt(t.alpha, 1) + '°</div><div>' + fmt(t.wp) + '</div><div>' + (t.hs || (t.h == null ? '–' : fmt(t.h, 2))) + '</div><div>' + del + '</div>';
  const m = { v: mean('v'), gam: mean('gam'), alpha: mean('alpha'), wp: mean('wp'), h: mean('h') };
  $('vthrows').innerHTML = ['Wurf', 'm/s', 'Abwurf', 'Anstell', '°/s', 'Höhe m', ''].map(h => '<div class="h">' + h + '</div>').join('') +
    throws.map((t, i) => row(i + 1, t, '<button class="del" data-i="' + i + '" aria-label="Wurf ' + (i + 1) + ' löschen">✕</button>')).join('') + row('<b>Mittel</b>', m, '') +
    (throws.length >= 3 ? row('Streuung ±', { v: sdev('v'), gam: sdev('gam'), alpha: sdev('alpha'), wp: sdev('wp'), hs: sdev('h') == null ? '–' : fmt(sdev('h') * 1000) + ' mm' }, '') : '');
}
$('vkeep').addEventListener('click', () => {
  if (!result) return;
  const r = result; throws.push({ v: r.v, gam: r.gam / D, alpha: r.alpha / D, wp: r.wp / D, h: r.h, xb: r.xb });
  saveThrows(); renderThrows(); stat('Wurf ' + throws.length + ' gemerkt. Für einen stabilen Mittelwert mehrere Würfe messen.');
});
$('vthrows').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (!b) return; throws.splice(+b.dataset.i, 1); saveThrows(); renderThrows(); });
$('vlclr').addEventListener('click', () => { throws = []; saveThrows(); renderThrows(); });
$('vmean').addEventListener('click', () => {
  if (!throws.length) return;
  const t = { v: mean('v'), h: mean('h'), xb: mean('xb'), wp: mean('wp'), dl: mean('alpha') };
  const n = throws.length, sd = { v: sdev('v'), ang: sdev('gam'), dl: sdev('alpha'), wp: sdev('wp') }, sh = sdev('h');
  if (sh != null) sd.h = sh * 1000;
  Object.keys(sd).forEach(k => { if (sd[k] == null) delete sd[k]; });
  const lim = LAB.setThrowProfile(t, sd, n);
  $('vlist').scrollIntoView({ block: 'nearest' });
  stat('Mittelwert aus ' + n + ' Würfen übernommen' + (n >= 3 ? ', Streuung als „Mein Wurf“ gesetzt.' : '. Für die Streuung mindestens 3 Würfe merken.') + (lim.length ? ' Am Reglerende begrenzt: ' + lim.join(', ') + '.' : ''));
  document.getElementById('h-lab').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

/* ---------- Bedienelemente ---------- */
$('vmode').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.m); });
[['vb10', -10], ['vb1', -1], ['vf1', 1], ['vf10', 10]].forEach(q => $(q[0]).addEventListener('click', () => goto(cur.k + q[1])));
$('vpos').addEventListener('input', () => goto(+$('vpos').value));
$('vzi').addEventListener('click', () => zoomAt({ x: cw / 2, y: ch / 2 }, view.z * 1.6));
$('vzo').addEventListener('click', () => zoomAt({ x: cw / 2, y: ch / 2 }, view.z / 1.6));
$('vzr').addEventListener('click', () => zoomAt({ x: cw / 2, y: ch / 2 }, 1));
$('vauto').addEventListener('click', autoTrack);
$('vdel').addEventListener('click', () => { marks.delete(cur.k); pend = null; compute(); ui(); draw(); });
$('vclr').addEventListener('click', () => { marks = new Map(); pend = null; compute(); ui(); draw(); stat(''); });
$('vsl').addEventListener('change', () => { if (+$('vsl').value) $('vsv').value = $('vsl').value; compute(); });
$('vsv').addEventListener('input', () => { $('vsl').value = '0'; compute(); });
$('vsx').addEventListener('click', () => { scaleRef = null; scalePend = null; draw(); compute(); });
$('vrl').addEventListener('change', () => { const v = $('vrl').value; if (v === 'bull') $('vrv').value = 1.73; else if (v === 'floor') $('vrv').value = 0; compute(); });
$('vrv').addEventListener('input', () => { if ($('vrl').value !== 'bull' || +$('vrv').value !== 1.73) $('vrl').value = +$('vrv').value === 0 ? 'floor' : 'own'; compute(); });
$('vrx').addEventListener('click', () => { refPt = null; draw(); compute(); });
$('vcf').addEventListener('input', () => { compute(); ui(); });
$('vff').addEventListener('change', () => {
  const f = +$('vff').value; if (!(f > 0) || !ready) return;
  // Marken auf die neue Bildzählung umschlüsseln
  const nm = new Map(); marks.forEach(m => nm.set(Math.floor(m.tv * f + 1e-3), m));
  fileFps = f; marks = nm; cache.clear(); setFrames(); compute(); goto(Math.floor(cur.tv * f + 1e-3));
});
window.addEventListener('resize', () => { if (ready) { resize(); draw(); } });
$('vdet').addEventListener('toggle', () => { if (ready) { resize(); draw(); } });
LAB.onChange(() => { if (ready) { if (marks.size >= 3) compute(); hint(); } });
renderThrows();
})();
