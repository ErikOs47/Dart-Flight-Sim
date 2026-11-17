# CLAUDE.md – Dart-Labor

Übergabe-Dokument für KI-Agenten (Claude Code u. a.) und Entwickler. Für Nutzer ist `README.md` die Doku; dieses Dokument beschreibt, wie der Code aufgebaut ist, was wackelig ist und was als Nächstes ansteht.

## Zweck

Web-App, mit der ein Spieler **vor dem Kauf** Steel-Tip-Darts und Setups (Spitze, Schaft, Flight, Barrel) vergleicht: Flugbahn, Flugruhe, Steckwinkel, Treffhöhe, Trefferbild. Ausgangspunkt ist **sein eigener Wurf** (per Video gemessen) und **sein eigener Dart** (gemessenes Gewicht und Schwerpunkt). Der Nutzer besitzt nur seine eigenen Pfeile; alle anderen Darts kommen aus der Datenbank und werden simuliert.

Ergebnisse sind für den **relativen Vergleich** gedacht, nicht als genaue Vorhersage. Das muss in UI-Texten und Antworten ehrlich bleiben.

## Zusammenarbeit mit dem Nutzer

- Antworten auf **Deutsch**, ohne Einleitungsfloskeln, direkt zum Punkt.
- **Quellen** nennen und erklären, wie ein Ergebnis zustande kommt. Wenn der Nutzer falsch liegt: sagen und mit Fakten belegen.
- Modellgrenzen offen ansprechen (siehe „Bekannte Schwachstellen“), Zahlen aus dem Modell als Modellzahlen kennzeichnen.
- Pull Requests nur auf Wunsch; der Nutzer lässt sie meist direkt mergen („Mach den PR und merge“). Keine Modellnamen in Commits, PRs oder Code.

## Starten, testen, veröffentlichen

```bash
python3 -m http.server 8000      # dann http://localhost:8000 (fetch braucht HTTP, file:// lädt nur 2 Beispiel-Darts)
node test/run.js                 # Rechentests ohne Browser (Physik, Messung, Rückrechnung, Streuung)
```

- Kein Build, keine Abhängigkeiten, kein `package.json`.
- Veröffentlicht über **GitHub Pages** aus `main` (Ordner `/`, `.nojekyll` vorhanden).
- **Cache-Busting:** Nach jeder Änderung an Code oder Daten `DATA_V` in `app.js` **und** alle `?v=` in `index.html` auf denselben neuen Wert erhöhen (aktuell `11`). Sonst zeigt v. a. Safari die alte Version.
- Browser-Tests: Chromium und Playwright sind in Cloud-Sessions vorinstalliert (`require('playwright')`, ggf. `NODE_PATH=$(npm root -g)`). Bisher liegen keine E2E-Tests im Repo (siehe To-dos); geprüft wurde mit Wegwerf-Skripten: Seite laden, Regler per `el.value=…; el.dispatchEvent(new Event('input'))` setzen, Texte/Screenshots prüfen, `pageerror`/Konsole auf Fehler prüfen, Desktop (1200 px) **und** Handy (390 px).

## Architektur

Reines HTML/CSS/JS. Skripte werden in dieser Reihenfolge geladen (`index.html`), jedes ist eine IIFE mit `'use strict'`:

| Datei | Rolle | Globals | DOM |
|---|---|---|---|
| `physics.js` | Physikmodell | `window.DartPhys` (bzw. `module.exports`) | nein, läuft in Node |
| `measure.js` | Auswertung der Video-Marken, Bildverfolgung | `window.DartMeasure` | nein, läuft in Node |
| `app.js` | Dart-Auswahl, Regler, Berechnung, alle Zeichnungen, Zustand | `window.DartLab` | ja |
| `video.js` | Oberfläche der Video-Messung | – (nutzt `DartMeasure`, `DartLab`) | ja |
| `photo.js` | Steckwinkel per Foto messen, Geschwindigkeit schätzen | – (nutzt `DartLab`) | ja |
| `advisor.js` | Setup-Berater (Wirkungstabelle, Zielsuche) | – (nutzt `DartLab`) | ja |
| `style.css` | Layout, Hell/Dunkel (CSS-Variablen `--ca`, `--cb` …) | | |
| `data/brands.json`, `data/brands/<marke>.json` | Dart-Datenbank (357 Darts, 10 Marken) | | |
| `test/run.js` | Rechentests (Node, `assert`) | | |

### Seitenaufbau (Abschnitte in `index.html`)

1. **Darts wählen:** Plätze A/B; die Dart-Suche (Marken, Suchfeld, Liste) ist eingeklappt und öffnet sich beim Antippen von A oder B. Darunter „★ Mein Dart“ (gemessene Werte eintragen).
2. **Eigenen Wurf per Video messen** (`video.js`).
3. **Steckwinkel per Foto messen** (`photo.js`): Spitze + Flight-Ende je Pfeil, optionale Senkrechte gegen Schräglage, Schätzung der Wurfgeschwindigkeit.
4. **Vergleichen und einstellen:** Grafiken (Endlage mit Treffhöhen-Skala, Flugbahn, Trefferbild, Anstellwinkel im Flug), Kennwerte, Regler für Wurf (beide Darts) und Dart-Setup (A/B), Wurfstreuung Standard/„Mein Wurf“.
5. **Setup-Berater** (`advisor.js`).
6. **Alle Kennwerte und Bewertung** (Tabelle).

### Datenfluss

- `setups[0|1]` (in `app.js`): Setup je Platz in **mm / g / % Barrel-Länge**: `wt, bar, dia, cg, tip, shaft, shape ('n2'|'n6'), size, grip`, dazu `dartId, name, mod, mine`.
- `build(setup)` → Physik-Parameter `p` (Wurfwerte aus den Reglern, Winkel in rad).
- `recompute()` bündelt Neuberechnungen per `requestAnimationFrame` → `calcAll()` → `labels()` → `redraw()` → `saveState()` → `notify()` (Abonnenten über `DartLab.onChange`).
- **Gleicher Wurf:** `calcAll()` sucht den Abwurfwinkel für den Ziel-Dart (`ref`, Umschalter „Wurf zielt mit“) per `solveAng`; **beide** Darts fliegen mit diesem Winkel. Die Treffhöhe des anderen Darts ist die Abweichung vom Bull.
- `out[i]`: Ergebnisse je Platz (`steck` = im Board, `steck0` = beim Auftreffen, `held`, `dy, amax, r90, depth, T, per, wtot, sc, res, g, p` …).

### `window.DartLab` (Schnittstelle von `app.js`)

`activeDart()`, `onChange(f)`, `applyThrow(t, meas)`, `clearMeas()`, `setThrowProfile(t, sd, n)`, `setup(i)`, `label(i)`, `darts()`, `fromDart(d, keep)`, `sigName()`, `aimAngle(s)`, `metrics(s, ang, full, dt)`, `setSetup(i, s)`, `speedForSteck(s, winkel)`, `setThrowValue(id, wert)`. Neue Module sollen über diese Schnittstelle arbeiten, nicht über interne Variablen von `app.js`.

### Zustand im Browser (`localStorage`, alle Zugriffe in `try/catch`)

| Schlüssel | Inhalt |
|---|---|
| `dartlabor.state.v1` | Setups A/B, aktiver Platz, Ziel-Dart, Wurf-Regler, Messpunkte, Streuungs-Modus und -Werte |
| `dartlabor.custom.v1` | eigene gespeicherte Darts (Marke „Eigene“) |
| `dartlabor.mine.v1` | „Mein Dart“ (Gesamtmasse, Schwerpunkt ab Spitze, Längen, Flight) |
| `dartlabor.throws.v1` | gemerkte Video-Würfe |
| `dartlabor.photo.v1` | zuletzt per Foto gemessene Steckwinkel (nur Winkel, kein Bild) |

Bei inkompatiblen Formatänderungen den Schlüssel hochzählen (`.v2`), nicht still alte Daten falsch lesen. Geladene Werte immer validieren (`isFinite`, erlaubte `shape`).

### Datenbankformat

`data/brands.json`: `{brands:[{id, brand, file, count, models}]}`. Je Marke `{brand, darts:[{id, model, name, short, bw, len, dia, shape, bal, cg, url, note?}]}`. `cg` ist **geschätzt** aus der Händlerangabe `bal` (vorn 40 %, Mitte 50 %, hinten 58 %). Neue Marke: Datei anlegen, in `brands.json` eintragen, `count`/`models` pflegen, README-Zahlen anpassen.

## Physikmodell (`physics.js`) in Kürze

- 3D-Starrkörper, explizite Integration (Δt 0,5 ms; Streuwürfe und Suche 1 ms). Koordinaten: **x zum Board, y nach oben, z seitlich**; Start im Schwerpunkt bei `(0, h, 0)`.
- **Abbruch, wenn die Spitze** die Board-Ebene `x = p.xb` erreicht; Treffpunkt und Treffhöhe beziehen sich auf die Spitze.
- Massen: Spitze 1,5 g je 25 mm, Schaft 0,02 g/mm, Flight 0,75 g (No.2) / 0,55 g (No.6), Barrel als Punktmasse bei `cg`.
- Flight: Polygon-Umriss, Auftriebsanstieg nach Helmbold, Rumpf-Interferenz, Druckpunkt per Streifentheorie, Plattenwiderstand. Rumpf: Querkraft, Stirnwiderstand, laminare Hautreibung. Nick-/Rolldämpfung, Nachlauf-Abschwächung des Flights.
- Griff: zusätzliche Nickrate `GK · (Schwerpunkt − Griff) · v/7` mit `GK = 0,25 rad/s pro mm` (**Annahme**).
- Drall fest 5 U/s, Luftdichte 1,204 kg/m³, Eindringwiderstand 50 N.
- `impact(p, r, g, Q)`: Einschlag in der Seitenebene. Spitze seitlich festgehalten, dringt mit `F_RES` ein; Dart dreht um die Spitze (Startdrehrate aus Drehimpuls um die Spitze, nutzt `r.vx, r.vy, r.wz` aus `sim3`), Board-Haltemoment `Q_HOLD · e²` (Annahme 1000 N/m²), Schwerkraft. Liefert `steck` (im Board), `held`, `e`. Ergebnis im Modell: fest steckende Darts kippen nur 0–2° nach.
- `build(s, ov)`: `ov` überschreibt einzelne Wurfwerte (z. B. `{v}` für die Geschwindigkeitsschätzung).
- `scatter(p, k, sig)`: 24 Würfe mit fester Zufallsfolge (für alle Darts gleich); `sig` = eigene Streuung in SI, sonst Standard `SIG · K_SCATTER`.
- `fromMeasured(m)`: rechnet aus gemessener Gesamtmasse und Gesamtschwerpunkt Barrel-Gewicht und Barrel-Schwerpunkt so zurück, dass das Modell die Messwerte exakt trifft.
- Einheiten: `physics.js` intern SI und rad; Setups in mm/g/%; UI in °, °/s, mm.

Plausibilitätscheck gegen James & Potts 2018 (Sports Engineering 21, 347–358, doi:10.1007/s12283-018-0279-9): Pendel-Wellenlänge Modell 2,17 m vs. gemessen 2,16 m, Dämpfung 0,13 vs. 0,11 (22 g, 6 m/s, No.2; deren genauer Dart ist unbekannt).

## Video-Messung (`measure.js`, `video.js`)

- Marken: Spitze + Flight-Ende je Bild. Schwerpunkt je Bild aus der Schwerpunktlage des **aktiven** Darts.
- `fitThrow`: x(t) linear, y(t) mit bekannter Fallbeschleunigung, über die ersten 120 ms → v, Abwurfwinkel. Dartwinkel: Parabel (ab 6 Bildern) über die ersten 50 ms → Dartwinkel, Nickrate; Anstellwinkel = Dartwinkel − Abwurfwinkel. Maßstab aus Dartlänge oder Referenzstrecke; Höhe/Abstand aus Höhenpunkt (Bull).
- `trackStep`: Doppel-Differenzbild, gewichtete Hauptachse in einem Rechteck längs der vorhergesagten Achse; Spitze = Flight-Ende + bekannte Länge; Abbruch bei unplausibler Länge/Drehung.
- Der Nickraten-Regler enthält **ohne** Griff-Anteil: übernommen wird `gemessen − gripRate(aktiver Dart)`.
- Getestet nur mit **synthetischem** Video (aus der Simulation gerendert, 240 fps).

## Coding-Konventionen

- **Keine Abhängigkeiten, kein Build, kein Framework.** Externe Ressourcen nur Google Fonts.
- `physics.js` und `measure.js` bleiben **DOM-frei** und in Node testbar. Neue Rechenlogik dorthin, mit Test in `test/run.js`.
- Zwei Code-Stile existieren: `physics.js`/`app.js` sehr dicht (kurze Namen, wenig Leerzeichen), `measure.js`/`video.js`/`advisor.js` lesbar mit 2 Leerzeichen. Beim Ändern den Stil der jeweiligen Datei beibehalten; neue Dateien im lesbaren Stil.
- Kommentare und UI-Texte auf **Deutsch**. Zahlen über `fmt(x, Nachkommastellen)` (de-DE) bzw. `sgn()` für Vorzeichen (± / + / −). Einheiten mit Leerzeichen („6,2 m/s“, „12 mm“), Grad ohne („7,2°“).
- Annahmen im Code kommentieren und im README unter „Annahmen (unsicher)“ eintragen.
- Canvas: `fit(canvas, höhe)` für devicePixelRatio; Farben aus `pal()` (Hell/Dunkel); A = `--ca` (blau, durchgezogen), B = `--cb` (pink, gestrichelt); aktiver Dart kräftig, der andere als Ghost.
- Layout muss bei 390 px Breite ohne horizontales Scrollen funktionieren (breite Tabellen in `.scx` scrollbar).
- Neue Wurf-Regler: in `THROW` eintragen (Speichern/Laden) und in `build()` verwenden. Neue Setup-Felder: `fromDart`, `syncUI`, `labels`, `map`, Validierung in `loadState`.
- Rechenintensives in `advisor.js` in Häppchen mit `await tick()` aufteilen, damit die Seite bedienbar bleibt.
- Nach Änderungen: `node test/run.js`, Browser-Check Desktop + Handy, `DATA_V`/`?v=` erhöhen, README aktualisieren.

## Bekannte Schwachstellen

Nach Einfluss auf die Aussagekraft sortiert:

1. **Schwerpunkt der Datenbank-Darts geschätzt** (aus „vorn/Mitte/hinten“). Schwerpunkt und Massenverteilung bestimmen Pendeln und Steckwinkel stark. Für den eigenen Dart gelöst durch „Mein Dart“, für Fremd-Darts nicht.
2. **Einschlag-Modell vereinfacht** (Schritt 3, umgesetzt): 2D, Board-Haltemoment `Q_HOLD` grob geschätzt, kein Abprallen, keine Verformung des Boards. Ergebnis „kippt kaum nach“ hängt daran, dass das Board fest hält; mit einem Foto allein lässt sich `Q_HOLD` nicht von der Wurfgeschwindigkeit trennen (dafür Video + Foto desselben Wurfs).
3. **Griff-Nickimpuls `GK` ist erfunden** (nur Größenordnung an J&P angepasst). Gerade die Nickrate verursacht die größten Unterschiede zwischen Setups. Mit nur einem eigenen Dart lässt sich Hand- und Dart-Anteil nicht trennen.
4. **Flight-Aerodynamik nicht validiert** (Re ≈ 16 000, Kreuzflügel, Abschattung durch das Barrel pauschal max. 8 %). Der Flight hat im Modell den größten Effekt (Slim statt Standard bei −400 °/s: −17° Steckwinkel) – als „großer Effekt“ lesen, nicht als exakte Zahl.
5. **Streuung:** Standardwerte sind Annahmen; „Mein Wurf“ behandelt die Parameter als unabhängig (echte Korrelationen fehlen → Trefferbild eher zu breit); seitliche Streuung immer Annahme. R90 hängt fast nur am Wurf, kaum am Setup.
6. **Video-Messung nicht mit echten Videos erprobt** (Bewegungsunschärfe, Kompression, Perspektive, Weitwinkel). Nur Seitenansicht: kein Gieren. Bei 30 fps sind Nickrate und Anstellwinkel nicht messbar.
7. **Gleicher Wurf** heißt gleiche Geschwindigkeit; dass man schwerere Darts in der Praxis etwas langsamer wirft, fehlt.
8. Kleinteil-Massen (Spitze, Schaft, Flight) geschätzt; Drall fest; nur zwei Flight-Formen; nur Steel-Tip.

## Offene To-dos

Mit dem Nutzer abgesprochene Reihenfolge (Schritt 1–3 sind erledigt):

- [x] Schritt 1: „Mein Dart“ (gemessene Werte) und „Mein Wurf“ (eigene Streuung)
- [x] Schritt 2: Setup-Berater (Wirkungstabelle, Zielsuche)
- [x] Schritt 3: Einschlag-Modell (Steckwinkel im Board, Abkippen) und Steckwinkel per Foto. Erstes Nutzerfoto (3 Pfeile, Winkel 24–29°, Mittel 25,7° ± 2,7° nach Schräglagen-Ausgleich 1,2°) → im Modell ≈ 5,3 m/s mit Aspinall G2 als Platzhalter; der Nutzer hat „Mein Dart“ noch nicht eingetragen.
- [ ] **Schritt 4: Kalibrierung** – 2–3 Modellfaktoren (Flight-Auftrieb, Dämpfung, `GK`) so anpassen, dass die Simulation die gemessenen Würfe mit dem eigenen Dart nachbildet; Restfehler anzeigen. Braucht echte Zeitlupenvideos des Nutzers.
- [ ] Video-Messung mit echten Handyvideos testen und Tracker nachschärfen.
- [ ] Kennwert **Fehlertoleranz** (mm Abweichung pro typischem Wurffehler, z. B. pro 0,1 m/s und pro 100 °/s) als Alternative zu R90.
- [ ] Ergebnisse als Bandbreite statt Einzelwert (Unsicherheit von `GK`, Schwerpunkt).
- [ ] Bauteil-Datenbank für Schäfte, Flights, Spitzen (Länge, Masse); weitere Flight-Formen (Kite, Pear, Vortex …).
- [ ] Dartsmind: keine öffentliche API/kein dokumentierter Export gefunden (Stand Nov. 2026). Falls der Nutzer eine Exportdatei liefert → Import der Trefferpositionen als echtes Trefferbild (inkl. seitlicher Streuung).
- [ ] Playwright-Smoke-Test ins Repo (`test/e2e.js`), inkl. synthetischem Wurfvideo.
- [ ] Optional: Ablenkung durch bereits steckende Darts (Gruppieren), Soft-Tip.
