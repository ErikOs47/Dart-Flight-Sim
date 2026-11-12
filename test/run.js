/* Rechentests ohne Browser: node test/run.js */
const assert = require('assert');
const PH = require('../physics.js'), ME = require('../measure.js');
const D = PH.D;
function dart(over) {
  return Object.assign({ wt: 24, bar: 50.05, dia: 7.07, cg: 40, tip: 25, shaft: 30, shape: 'n2', size: 1, wear: 0, grip: 51,
    ang: 0, h: 1.65, v: 8, xb: 2.2, psi: 0, delta: 0, eps: 0, wp: 0, wy: 0, spin: 10 * Math.PI, wind: 0 }, over || {});
}
// 1. Physik: Bull wird getroffen, Kennwerte plausibel
{
  const p = dart(); p.ang = PH.solveAng(p, 0.0005);
  const r = PH.sim3(p, true);
  assert(Math.abs(r.y - PH.YB) < 1e-3, 'Bull verfehlt: ' + r.y);
  assert(r.T > 0.2 && r.T < 0.4, 'Flugzeit ' + r.T);
  assert(-r.th / D > 0 && -r.th / D < 20, 'Steckwinkel ' + (-r.th / D));
  console.log('Physik ok: Abwurf', (p.ang / D).toFixed(2), '° Flugzeit', (r.T * 1000).toFixed(0), 'ms Steckwinkel', (-r.th / D).toFixed(2), '°');
}
// 2. Messung: simulierten Wurf in Pixel umrechnen, markieren, Parameter zurückgewinnen
{
  const p = dart({ v: 6.2, wp: -300 * D, delta: 3 * D, grip: 55 }); p.ang = PH.solveAng(p, 0.0005);
  const g = PH.geom(p), r = PH.sim3(p, true), wtot = p.wp + PH.gripRate(g, p);
  const pxm = 900, L = g.len * 1e-3, sc = g.sCG * 1e-3;   // 900 px je Meter, Wurf nach links
  const toPx = (x, y) => ({ x: 1800 - x * pxm, y: 400 - (y - p.h) * pxm });
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
  const marks = [];
  for (let i = 0; i < 20; i++) {           // 240 Bilder/s, 20 Bilder
    const t = i / 240, f = r.frames.reduce((a, b) => Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a);
    const tip = toPx(f.x + sc * Math.cos(f.th), f.y + sc * Math.sin(f.th)), tail = toPx(f.x - (L - sc) * Math.cos(f.th), f.y - (L - sc) * Math.sin(f.th));
    [tip, tail].forEach(q => { q.x += rnd(); q.y += rnd(); });   // ±0,5 px Markierfehler
    marks.push({ t: 1 + t, tip: tip, tail: tail });
  }
  const bull = toPx(p.xb, PH.YB);
  const m = ME.fitThrow(marks, { dartLen: L, cgFrac: sc / L, ref: { x: bull.x, y: bull.y, h: PH.YB, board: true } });
  console.log('Messung: v', m.v.toFixed(2), '±', m.se.v.toFixed(2), '(soll 6.20)  Bahn', (m.gam / D).toFixed(1), '(soll', (p.ang / D).toFixed(1) + ')  Anstell',
    (m.alpha / D).toFixed(1), '±', (m.se.alpha / D).toFixed(1), '(soll 3.0)  Nickrate', (m.wp / D).toFixed(0), '±', (m.se.wp / D).toFixed(0), '(soll', (wtot / D).toFixed(0) + ')  h', m.h.toFixed(3), 'xb', m.xb.toFixed(3));
  assert(m.dir === -1);
  assert(Math.abs(m.v - 6.2) < 0.15, 'v');
  assert(Math.abs(m.gam - p.ang) < 1.5 * D, 'Bahnwinkel');
  assert(Math.abs(m.alpha - 3 * D) < 2.5 * D, 'Anstellwinkel');
  assert(Math.abs(m.wp - wtot) < 120 * D, 'Nickrate');
  assert(Math.abs(m.h - p.h) < 0.01 && Math.abs(m.xb - p.xb) < 0.03, 'Höhe/Abstand');
}
console.log('alle Tests ok');
