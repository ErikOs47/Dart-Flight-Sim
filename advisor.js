/* Dart-Labor – Setup-Berater: Wirkung einzelner Setup-Änderungen und Zielsuche.
   Alle Varianten fliegen mit demselben Wurf (Abwurfwinkel so, dass das Ausgangs-Setup den Bull trifft). */
(function () {
'use strict';
const $ = id => document.getElementById(id), LAB = window.DartLab;
const fmt = (x, d) => x.toLocaleString('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
const sgn = (x, d) => (Math.abs(x) < 0.5 * Math.pow(10, -(d || 0)) ? '±' : x > 0 ? '+' : '−') + fmt(Math.abs(x), d);
const FL = { n2: 'No.2 (Standard)', n6: 'No.6 (Slim)' };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
let base = 0, rows = [], found = [], timer = null, searching = false;

/* ---------- Varianten ---------- */
// Barrel gleicher Form und Länge, anderes Gewicht: Durchmesser ∝ √Masse
const reweigh = (s, dw) => ({ wt: s.wt + dw, dia: s.dia * Math.sqrt((s.wt + dw) / s.wt) });
const VARIANTS = [
  ['Schaft 10 mm kürzer', s => s.shaft >= 15 ? { shaft: s.shaft - 10 } : null],
  ['Schaft 10 mm länger', s => s.shaft <= 50 ? { shaft: s.shaft + 10 } : null],
  ['Spitze 4 mm kürzer', s => s.tip >= 19 ? { tip: s.tip - 4 } : null],
  ['Spitze 4 mm länger', s => s.tip <= 36 ? { tip: s.tip + 4 } : null],
  [s => 'Flight ' + FL[s.shape === 'n2' ? 'n6' : 'n2'], s => ({ shape: s.shape === 'n2' ? 'n6' : 'n2' })],
  ['Barrel 2 g leichter (gleiche Form)', s => s.wt >= 12 ? reweigh(s, -2) : null],
  ['Barrel 2 g schwerer (gleiche Form)', s => s.wt <= 38 ? reweigh(s, 2) : null],
  ['Barrel-Schwerpunkt 8 % weiter vorn', s => s.cg >= 23 ? { cg: s.cg - 8 } : null],
  ['Barrel-Schwerpunkt 8 % weiter hinten', s => s.cg <= 77 ? { cg: s.cg + 8 } : null],
  ['Griff 5 mm weiter vorn', s => s.grip + 5 <= s.bar ? { grip: s.grip + 5 } : null, true],
  ['Griff 5 mm weiter hinten', s => s.grip >= 5 ? { grip: s.grip - 5 } : null, true]
];
function variantName(b, s) {
  const c = [];
  if (s.dartId !== b.dartId || s.wt !== b.wt || s.cg !== b.cg || s.bar !== b.bar) c.push(s.dartId !== b.dartId ? 'Barrel ' + s.name : 'Barrel geändert');
  if (s.shaft !== b.shaft) c.push('Schaft ' + fmt(b.shaft, 1) + ' → ' + fmt(s.shaft, 1) + ' mm');
  if (s.tip !== b.tip) c.push('Spitze ' + fmt(b.tip, 1) + ' → ' + fmt(s.tip, 1) + ' mm');
  if (s.shape !== b.shape) c.push('Flight ' + FL[s.shape]);
  return c;
}

/* ---------- Tabellen ---------- */
// lo: kleiner ist günstiger; abs: näher an 0 günstiger; hi: größer ist günstiger
const COLS = [['Steckwinkel', 'steck', 1, '°', ''], ['Treffhöhe', 'dy', 1, ' mm', 'abs'], ['Anstellw. max.', 'amax', 1, '°', 'lo'], ['Streuung R90', 'r90', 0, ' mm', 'lo'], ['Eindring­tiefe', 'depth', 0, ' mm', 'hi']];
function cells(m, b) {
  return COLS.map(c => {
    const v = m[c[1]];
    if (v == null) return '<div>–</div>';
    if (!b) return '<div>' + (c[1] === 'dy' ? sgn(v, c[2]) : fmt(v, c[2])) + c[3] + '</div>';
    const d = v - b[c[1]], w = c[4], tiny = Math.abs(d) < 0.5 * Math.pow(10, -c[2]);
    const good = !tiny && (w === 'lo' ? d < 0 : w === 'hi' ? d > 0 : w === 'abs' ? Math.abs(v) < Math.abs(b[c[1]]) : false);
    return '<div' + (good ? ' class="g"' : '') + '>' + sgn(d, c[2]) + c[3] + '</div>';
  }).join('');
}
const head = first => '<div class="h">' + first + '</div>' + COLS.map(c => '<div class="h">' + c[0] + '</div>').join('') + '<div class="h"></div>';
const slotName = () => 'Dart ' + (base ? 'A' : 'B');
function goBtn(k, src) { return '<div><button class="go" data-src="' + src + '" data-k="' + k + '" title="Als ' + slotName() + ' laden und vergleichen">→ ' + (base ? 'A' : 'B') + '</button></div>'; }

function renderTable() {
  if (!rows.length) return;
  const b = rows[0].m;
  let h = head('Änderung') + '<div class="base">Ausgangs-Setup</div>' + cells(b, null).replace(/<div>/g, '<div class="base">') + '<div class="base"></div>';
  rows.slice(1).forEach((r, k) => { h += '<div>' + r.name + (r.rough ? '<span class="sub">grobe Annahme</span>' : '') + '</div>' + cells(r.m, b) + goBtn(k + 1, 'v'); });
  $('avt').innerHTML = h;
}
function compute() {
  if ($('adv').open === false) return;
  lastKey = key();
  const b = LAB.setup(base), ang = LAB.aimAngle(b);
  rows = [{ name: 'Ausgang', s: b, m: LAB.metrics(b, ang, true) }];
  VARIANTS.forEach(v => {
    const ch = v[1](b); if (!ch) return;
    const s = Object.assign({}, b, ch, { mod: true });
    rows.push({ name: typeof v[0] === 'function' ? v[0](b) : v[0], s: s, m: LAB.metrics(s, ang, true), rough: !!v[2] });
  });
  $('avn').textContent = LAB.label(base) + ' · Wurf ' + fmt(+$('v').value, 1) + ' m/s, Nickrate ' + fmt(+$('wp').value) + ' °/s · Streuung „' + LAB.sigName() + '“';
  renderTable();
  found = []; $('avr').innerHTML = ''; $('avp').textContent = '';
  if ($('avs').value === '') $('avs').value = Math.round(rows[0].m.steck * 2) / 2;
}
// Nur neu rechnen, wenn sich Ausgangs-Setup, Wurf oder Streuung geändert haben (nicht beim Laden eines Vorschlags in den anderen Platz)
let lastKey = '';
function key() { return JSON.stringify([base, LAB.setup(base), ['v', 'h', 'xb', 'wp', 'dl'].map(id => $(id).value), LAB.sigName(), ['v', 'ang', 'dl', 'wp', 'h'].map(k => $('sg_' + k).value)]); }
function schedule() { clearTimeout(timer); timer = setTimeout(() => { if (!searching && $('adv').open && key() !== lastKey) compute(); }, 350); }

/* ---------- Zielsuche ---------- */
const tick = () => new Promise(r => setTimeout(r, 0));
async function search() {
  if (searching || !rows.length) return;
  searching = true; $('avgo').disabled = true;
  const b = rows[0].s, bm = rows[0].m, ang = LAB.aimAngle(b), goal = $('avg').value;
  const T = +$('avs').value, tol = Math.max(0.2, +$('avtol').value || 1);
  const calmC = $('avc1').checked, tightC = $('avc2').checked, hC = $('avc3').checked, db = $('avc4').checked;
  // Suchraum: Schaft in 5-mm-Schritten, Spitze ±4 mm, beide Flights; optional alle Barrels der Datenbank
  const shafts = [...new Set([b.shaft, 15, 20, 25, 30, 35, 40, 45, 50, 55])].filter(x => x >= 10 && x <= 55);
  const tips = [...new Set([b.tip, b.tip - 4, b.tip + 4])].filter(x => x >= 18 && x <= 38);
  const barrels = [b].concat(db ? LAB.darts().filter(d => d.id !== b.dartId).map(d => LAB.fromDart(d, b)) : []);
  const cand = [];
  let n = 0;
  const total = barrels.length * shafts.length * (db ? 1 : tips.length) * 2;
  for (const br of barrels) {
    for (const sh of shafts) for (const tp of (br === b ? tips : [b.tip])) for (const fl of ['n2', 'n6']) {
      const s = Object.assign({}, br, { shaft: sh, tip: tp, shape: fl, mod: true, mine: br === b ? b.mine : false });
      const m = LAB.metrics(s, ang, false, 0.001);
      n++;
      if (calmC && m.amax > bm.amax + 0.05) continue;
      if (hC && Math.abs(m.dy - bm.dy) > 5) continue;
      const ch = variantName(b, s), mag = Math.abs(sh - b.shaft) / 10 + Math.abs(tp - b.tip) / 4;
      cand.push({ s: s, m: m, ch: ch, k: ch.length + 0.1 * mag });
    }
    if (n % 400 < 20) { $('avp').textContent = 'Prüfe Varianten … ' + Math.round(100 * n / total) + ' %'; await tick(); }
  }
  // Bewertung
  const miss = c => goal === 'steck' ? Math.max(0, Math.abs(c.m.steck - T) - tol) : 0;
  let sorted;
  if (goal === 'steck') sorted = cand.sort((a, c) => (miss(a) - miss(c)) || (a.k - c.k) || (Math.abs(a.m.steck - T) - Math.abs(c.m.steck - T)));
  else if (goal === 'calm') sorted = cand.sort((a, c) => a.m.amax - c.m.amax || a.k - c.k);
  else sorted = cand;
  // Trefferbild für die besten Kandidaten berechnen (teurer)
  const needR = tightC || goal === 'tight';
  let pool = sorted;
  if (goal === 'tight') pool = cand.sort((a, c) => a.m.amax - c.m.amax).slice(0, 80);
  const out = [];
  for (const c of pool) {
    if (out.length >= (goal === 'tight' ? 80 : 8)) break;
    if (needR) { c.m = LAB.metrics(c.s, ang, true, 0.001); if (tightC && c.m.r90 > bm.r90 * 1.02) continue; }
    out.push(c);
    if (out.length % 10 === 0) { $('avp').textContent = 'Berechne Trefferbilder …'; await tick(); }
  }
  if (goal === 'tight') out.sort((a, c) => a.m.r90 - c.m.r90 || a.k - c.k);
  // Duplikate des Ausgangs-Setups entfernen, Top 8 genau nachrechnen
  found = out.filter(c => c.ch.length).slice(0, 8);
  found.forEach(c => { c.m = LAB.metrics(c.s, ang, true); });
  const hit = goal !== 'steck' || found.some(c => miss(c) === 0);
  $('avp').textContent = n + ' Varianten geprüft' + (goal === 'steck' && !hit ? ' – Zielwinkel mit diesen Teilen nicht erreichbar, hier die nächsten.' : '.');
  let h = '';
  if (found.length) {
    h = '<div class="scx"><div class="tbl t7">' + head('Vorschlag') + '<div class="base">Ausgangs-Setup</div>' + cells(rows[0].m, null).replace(/<div>/g, '<div class="base">') + '<div class="base"></div>';
    found.forEach((c, k) => { h += '<div>' + c.ch.join(', ') + (goal === 'steck' ? '<span class="sub">Steckwinkel ' + fmt(c.m.steck, 1) + '°</span>' : '') + '</div>' + cells(c.m, bm) + goBtn(k, 'f'); });
    h += '</div></div>';
  } else h = '<p class="note">Keine Variante erfüllt alle Bedingungen. Bedingungen lockern oder „Auch andere Barrels“ anhaken.</p>';
  $('avr').innerHTML = h;
  searching = false; $('avgo').disabled = false;
}

/* ---------- Bedienung ---------- */
function load(src, k) {
  const it = src === 'v' ? rows[k] : found[k]; if (!it) return;
  const b = rows[0].s, s = JSON.parse(JSON.stringify(it.s));
  const ch = src === 'v' ? [it.name] : it.ch;
  if (s.dartId === b.dartId) s.name = b.name;
  s.name = s.name + ' · ' + ch.join(', ');
  s.mod = false; s.dartId = 'adv-' + Date.now();
  LAB.setSetup(1 - base, s);
  document.getElementById('h-lab').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
$('adv').addEventListener('click', e => { const b = e.target.closest('button.go'); if (b) load(b.dataset.src, +b.dataset.k); });
$('avb').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  base = +b.dataset.i;
  $('avb').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
  $('avs').value = ''; compute();
});
$('avg').addEventListener('change', () => { const on = $('avg').value === 'steck'; $('avsl').hidden = $('avsu').hidden = !on; });
$('avgo').addEventListener('click', search);
$('adv').addEventListener('toggle', () => { if ($('adv').open) compute(); });
LAB.onChange(schedule);
})();
