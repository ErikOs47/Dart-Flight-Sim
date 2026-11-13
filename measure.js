/* Dart-Labor – Wurfmessung aus Video: Auswertung der Markierungen und Bildverfolgung.
   Ohne DOM, läuft auch in Node (Tests). Verfahren: siehe README.md, Abschnitt „Wurf per Video messen“. */
(function (root) {
'use strict';
const G = 9.81;

// Ausgleichsgerade y = a + b·t mit Standardfehlern (sa, sb) und Reststreuung (rms)
function linfit(t, y) {
  const n = t.length;
  let st = 0, sy = 0;
  for (let i = 0; i < n; i++) { st += t[i]; sy += y[i]; }
  const tm = st / n, ym = sy / n;
  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (t[i] - tm) * (t[i] - tm); sxy += (t[i] - tm) * (y[i] - ym); }
  const b = sxx > 0 ? sxy / sxx : 0, a = ym - b * tm;
  let sse = 0;
  for (let i = 0; i < n; i++) { const r = y[i] - a - b * t[i]; sse += r * r; }
  const s2 = n > 2 ? sse / (n - 2) : NaN;
  return { a: a, b: b, sa: Math.sqrt(s2 * (1 / n + tm * tm / sxx)), sb: Math.sqrt(s2 / sxx), rms: Math.sqrt(sse / n) };
}
// Ausgleichsparabel y = a + b·t + c·t² mit Standardfehlern für a und b
function quadfit(t, y) {
  const n = t.length, S = [0, 0, 0, 0, 0], T = [0, 0, 0];
  for (let i = 0; i < n; i++) { let p = 1; for (let k = 0; k < 5; k++) { S[k] += p; if (k < 3) T[k] += p * y[i]; p *= t[i]; } }
  const A = [[S[0], S[1], S[2]], [S[1], S[2], S[3]], [S[2], S[3], S[4]]];
  const c = (i, j) => { const r = [0, 1, 2].filter(q => q !== i), k = [0, 1, 2].filter(q => q !== j); return ((i + j) % 2 ? -1 : 1) * (A[r[0]][k[0]] * A[r[1]][k[1]] - A[r[0]][k[1]] * A[r[1]][k[0]]); };
  const det = A[0][0] * c(0, 0) + A[0][1] * c(0, 1) + A[0][2] * c(0, 2);
  const inv = [0, 1, 2].map(i => [0, 1, 2].map(j => c(j, i) / det));
  const co = inv.map(r => r[0] * T[0] + r[1] * T[1] + r[2] * T[2]);
  let sse = 0;
  for (let i = 0; i < n; i++) { const r = y[i] - co[0] - co[1] * t[i] - co[2] * t[i] * t[i]; sse += r * r; }
  const s2 = n > 3 ? sse / (n - 3) : NaN;
  return { a: co[0], b: co[1], c: co[2], sa: Math.sqrt(s2 * inv[0][0]), sb: Math.sqrt(s2 * inv[1][1]), rms: Math.sqrt(sse / n) };
}
function median(a) { const s = a.slice().sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

/* Wurfparameter aus markierten Bildern.
   marks: [{t, tip:{x,y}, tail:{x,y}}]  t = echte Zeit (s), Punkte in Bildpixeln (y nach unten)
   opt:   dartLen (m), cgFrac (Schwerpunkt ab Spitze / Gesamtlänge),
          scale (m/px, optional – sonst aus der markierten Dartlänge),
          ref {x, y, h, board} (optional: Punkt bekannter Höhe h in m; board = Punkt liegt auf der Board-Fläche)
   Das früheste markierte Bild gilt als Abwurf (t = 0). */
function fitThrow(marks, opt) {
  const m = marks.slice().sort((a, b) => a.t - b.t), n = m.length;
  if (n < 3) return null;
  const lens = m.map(q => Math.hypot(q.tip.x - q.tail.x, q.tip.y - q.tail.y));
  const lenPx = median(lens);
  const scale = opt.scale || opt.dartLen / lenPx;
  const f = opt.cgFrac, t0 = m[0].t;
  const cg = m.map(q => ({ x: q.tip.x + f * (q.tail.x - q.tip.x), y: q.tip.y + f * (q.tail.y - q.tip.y) }));
  const dir = cg[n - 1].x >= cg[0].x ? 1 : -1;            // Wurfrichtung im Bild
  const t = m.map(q => q.t - t0);
  const X = cg.map(c => dir * (c.x - cg[0].x) * scale);   // m, in Wurfrichtung
  const Y = cg.map(c => -(c.y - cg[0].y) * scale);        // m, nach oben
  // Bahn: x linear (Luftwiderstand über die kurze Strecke vernachlässigt), y mit bekannter Fallbeschleunigung.
  // Nur die ersten 120 ms, sofern dort mindestens 5 Bilder liegen: danach bremst die Luft den Dart merklich,
  // und der Auftrieb des pendelnden Darts verbiegt die Bahn.
  let kb = t.findIndex(x => x > 0.12); if (kb < 5) kb = n;
  const tb = t.slice(0, kb);
  const fx = linfit(tb, X.slice(0, kb)), fy = linfit(tb, Y.slice(0, kb).map((y, i) => y + 0.5 * G * tb[i] * tb[i]));
  const vx = fx.b, vy = fy.b, v = Math.hypot(vx, vy), gam = Math.atan2(vy, vx);
  // Dartwinkel (Spitze über Flight = positiv), stetig fortgesetzt
  const th = [];
  m.forEach((q, i) => {
    let a = Math.atan2(-(q.tip.y - q.tail.y), dir * (q.tip.x - q.tail.x));
    if (i) { while (a - th[i - 1] > Math.PI) a -= 2 * Math.PI; while (a - th[i - 1] < -Math.PI) a += 2 * Math.PI; }
    th.push(a);
  });
  // Nickrate und Dartwinkel beim Abwurf: Fit über die ersten 50 ms. Der Dart pendelt (Periode ca. 0,3 s),
  // die Nickrate ändert sich also schon in dieser Zeit: ab 6 Bildern Parabel (Steigung bei t = 0), sonst Gerade.
  let k = t.findIndex(x => x > 0.05); if (k < 0) k = n; if (k < 3) k = Math.min(n, 3);
  const ft = k >= 6 ? quadfit(t.slice(0, k), th.slice(0, k)) : linfit(t.slice(0, k), th.slice(0, k));
  const res = {
    n: n, scale: scale, dir: dir, lenPx: lenPx, dur: t[n - 1],
    v: v, gam: gam, th0: ft.a, alpha: ft.a - gam, wp: ft.b,
    se: {
      v: Math.hypot(fx.sb * Math.cos(gam), fy.sb * Math.sin(gam)),
      gam: Math.hypot(fx.sb * Math.sin(gam), fy.sb * Math.cos(gam)) / v,
      wp: ft.sb, th0: ft.sa
    },
    rms: Math.hypot(fx.rms, fy.rms),
    h: null, xb: null, warn: [],
    pts: t.map((ti, i) => ({ t: ti, x: X[i], y: Y[i], a: th[i] - Math.atan2(vy - G * ti, vx) }))
  };
  res.se.alpha = Math.hypot(res.se.th0, res.se.gam);
  if (opt.ref) {
    res.h = opt.ref.h + (opt.ref.y - cg[0].y) * scale + fy.a;   // Höhe des Schwerpunkts beim Abwurf (aus dem Fit)
    if (opt.ref.board) res.xb = dir * (opt.ref.x - cg[0].x) * scale - fx.a;
  }
  // Plausibilität
  const stepPx = Math.hypot(cg[n - 1].x - cg[0].x, cg[n - 1].y - cg[0].y) / Math.max(1, n - 1);
  const spread = (Math.max.apply(null, lens) - Math.min.apply(null, lens)) / lenPx;
  if (n < 5) res.warn.push('Nur ' + n + ' Bilder markiert: Nickrate und Anstellwinkel sind dann unsicher. Besser 5 oder mehr.');
  if (lenPx < 40) res.warn.push('Der Dart ist im Bild nur ' + Math.round(lenPx) + ' px lang. Für brauchbare Winkel näher herangehen oder höher auflösen (Ziel: über 80 px).');
  if (stepPx > 0.7 * lenPx) res.warn.push('Der Dart bewegt sich zwischen den markierten Bildern um mehr als 70 % seiner Länge. Bei so niedriger Bildrate ist er meist verwischt: Geschwindigkeit brauchbar, Nickrate und Anstellwinkel nicht. Zeitlupe (120 oder 240 Bilder/s) verwenden.');
  if (spread > 0.15) res.warn.push('Die markierte Dartlänge schwankt um ' + Math.round(spread * 100) + ' %. Marken prüfen (Spitze und Flight-Ende vertauscht oder ungenau?).');
  if (!opt.scale && spread <= 0.15 && lenPx < 80) res.warn.push('Maßstab aus der Dartlänge: bei kleinem Dart im Bild ungenau. Besser eine Referenzstrecke setzen.');
  if (v < 3 || v > 15) res.warn.push('Geschwindigkeit ' + v.toFixed(1) + ' m/s liegt außerhalb des üblichen Bereichs (ca. 5–8 m/s). Bildrate und Maßstab prüfen.');
  return res;
}

/* Bildverfolgung: sucht den Dart in Bild k nahe der vorhergesagten Position.
   Gk, Gp, Gn: Graustufenbilder (Uint8, W×H) von Bild k, einem früheren und einem späteren Bild
   (Gp oder Gn darf fehlen). Bewegte Pixel = Minimum der beiden Differenzbilder
   (Doppel-Differenz), danach gewichtete Hauptachsenanalyse.
   pr: {cx, cy, ux, uy, L, R}  Vorhersage: Mitte, Achsrichtung Flight→Spitze, Dartlänge und Suchradius (px)
   Rückgabe {tip, tail, q} oder null, wenn nichts Verlässliches gefunden wurde. */
function trackStep(Gk, Gp, Gn, W, H, pr) {
  const R = Math.ceil(pr.R);
  const x0 = Math.max(0, Math.round(pr.cx - R)), x1 = Math.min(W, Math.round(pr.cx + R));
  const y0 = Math.max(0, Math.round(pr.cy - R)), y1 = Math.min(H, Math.round(pr.cy + R));
  const w = x1 - x0, h = y1 - y0;
  if (w < 8 || h < 8) return null;
  const Dm = new Float32Array(w * h);
  let s = 0, s2 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y + y0) * W + x + x0;
    const d1 = Gp ? Math.abs(Gk[i] - Gp[i]) : 255, d2 = Gn ? Math.abs(Gk[i] - Gn[i]) : 255;
    const d = Math.min(d1, d2);
    Dm[y * w + x] = d; s += d; s2 += d * d;
  }
  const N = w * h, mean = s / N, sd = Math.sqrt(Math.max(0, s2 / N - mean * mean));
  const thr = Math.max(10, mean + 2 * sd);
  // Schwerpunkt der bewegten Pixel, schrittweise um die Vorhersage eingegrenzt
  let cx = pr.cx - x0, cy = pr.cy - y0, m = 0;
  // Suchfeld: Rechteck längs der vorhergesagten Dartachse (hält z. B. den Wurfarm draußen)
  const gl = 0.8 * pr.L, gw = 0.3 * pr.L;
  for (let it = 0; it < 4; it++) {
    let sx = 0, sy = 0; m = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = Dm[y * w + x] - thr;
      if (d <= 0) continue;
      const dx = x - cx, dy = y - cy;
      if (Math.abs(dx * pr.ux + dy * pr.uy) > gl || Math.abs(dy * pr.ux - dx * pr.uy) > gw) continue;
      m += d; sx += d * x; sy += d * y;
    }
    if (m < 20 * pr.L) return null;   // zu wenig Bewegung im Suchfenster
    cx = sx / m; cy = sy / m;
  }
  // Hauptachse
  let sxx = 0, sxy = 0, syy = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Dm[y * w + x] - thr;
    if (d <= 0) continue;
    const dx = x - cx, dy = y - cy;
    if (Math.abs(dx * pr.ux + dy * pr.uy) > gl || Math.abs(dy * pr.ux - dx * pr.uy) > gw) continue;
    sxx += d * dx * dx; sxy += d * dx * dy; syy += d * dy * dy;
  }
  sxx /= m; sxy /= m; syy /= m;
  const tr = sxx + syy, df = Math.sqrt(Math.max(0, (sxx - syy) * (sxx - syy) / 4 + sxy * sxy));
  const l1 = tr / 2 + df, l2 = Math.max(1e-6, tr / 2 - df);
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let ux = Math.cos(ang), uy = Math.sin(ang);
  if (ux * pr.ux + uy * pr.uy < 0) { ux = -ux; uy = -uy; }
  // Ausdehnung entlang der Achse (3-%- und 97-%-Quantil der Gewichte)
  const band = Math.max(3, 3 * Math.sqrt(l2)), nb = Math.ceil(3 * pr.L) + 1, hist = new Float32Array(nb);
  let hm = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Dm[y * w + x] - thr;
    if (d <= 0) continue;
    const dx = x - cx, dy = y - cy, p = dx * ux + dy * uy, o = -dx * uy + dy * ux;
    if (Math.abs(o) > band || Math.abs(p) > 1.1 * pr.L) continue;
    const b = Math.round(p + 1.5 * pr.L);
    if (b < 0 || b >= nb) continue;
    hist[b] += d; hm += d;
  }
  let acc = 0, lo = 0, hi = nb - 1;
  for (let b = 0; b < nb; b++) { acc += hist[b]; if (acc >= 0.03 * hm) { lo = b; break; } }
  acc = 0;
  for (let b = nb - 1; b >= 0; b--) { acc += hist[b]; if (acc >= 0.03 * hm) { hi = b; break; } }
  const smin = lo - 1.5 * pr.L, len = hi - lo, el = l1 / l2;
  // unplausibel: nicht länglich, falsche Länge oder um mehr als ca. 25° gegen die Vorhersage gedreht
  if (el < 2.5 || len < 0.5 * pr.L || len > 1.25 * pr.L || ux * pr.ux + uy * pr.uy < 0.9) return null;
  // Das Flight-Ende ist gut sichtbar, die dünne Spitze oft nicht: Spitze = Flight-Ende + bekannte Länge
  const tail = { x: x0 + cx + ux * smin, y: y0 + cy + uy * smin };
  return { tail: tail, tip: { x: tail.x + ux * pr.L, y: tail.y + uy * pr.L }, q: el, len: len };
}

const api = { linfit: linfit, quadfit: quadfit, median: median, fitThrow: fitThrow, trackStep: trackStep };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DartMeasure = api;
})(typeof window !== 'undefined' ? window : globalThis);
