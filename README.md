# Dart-Labor

Web-App, um Steel-Tip-Darts **vor dem Kauf** per Flugsimulation zu vergleichen. Zwei Darts (A/B) nach Marke und Modell wählen (die Dart-Suche öffnet sich erst beim Antippen von Dart A oder B und schließt sich nach der Auswahl), dann Regler schieben: Flugbahn, Trefferbild und Kennwerte (Streuung, Flugruhe, Steckwinkel, Eindringtiefe) aktualisieren sich live direkt daneben. Die App wirft beide Darts mit **demselben Wurf**: Der Abwurfwinkel wird so eingestellt, dass der Ziel-Dart (wählbar A oder B) den Bull trifft; der andere Dart trifft entsprechend höher oder tiefer (Anzeige „Treffhöhe“ in der Endlage, vergrößert in mm). Die Endlage zeigt beide Darts maßstabsgetreu von der Seite im Board, mit Spitzenbahn, Steckwinkel und Eindringtiefe; der gerade eingestellte Dart ist hervorgehoben, der andere als Ghost.

**Mein Dart:** Die eigenen Pfeile mit gemessenem Gesamtgewicht und Schwerpunkt eintragen (Abschnitt 1). Die App rechnet daraus Barrel-Gewicht und Gewichtsverteilung so zurück, dass das Modell genau diese Werte trifft (Spitze 1,5 g je 25 mm, Schaft 0,02 g/mm und Flight mit den Modellmassen). Der Dart lässt sich in A oder B laden; Änderungen an Spitze, Schaft oder Flight markieren ihn als „angepasst“. So vergleicht man den eigenen Dart mit anderen Darts oder mit einem geänderten Setup.

**Mein Wurf:** Die Wurfstreuung (1 σ von Geschwindigkeit, Abwurfwinkel, Anstellwinkel, Nickrate, Abwurfhöhe) kommt entweder aus der Standardannahme, aus mindestens 3 gemerkten Video-Würfen („Als „Mein Wurf“ übernehmen“, Stichproben-Standardabweichung) oder wird von Hand eingetragen. Die seitliche Streuung sieht die Seitenkamera nicht, sie bleibt bei der Annahme. Die Werte werden als unabhängig behandelt; echte Korrelationen (z. B. langsamer und dafür höher geworfen) fehlen, das Trefferbild ist dadurch eher zu breit. Bei wenigen Würfen ist die gemessene Streuung selbst unsicher, und Messfehler der Video-Auswertung stecken mit drin.

**Setup-Berater (Abschnitt 4):** Ausgangs-Setup (A oder B, z. B. „Mein Dart“) wählen. Die Wirkungstabelle zeigt für einzelne Änderungen (Schaft ±10 mm, Spitze ±4 mm, anderer Flight, Barrel ±2 g bei gleicher Form, Barrel-Schwerpunkt ±8 %, Griff ±5 mm) die Änderung von Steckwinkel, Treffhöhe, maximalem Anstellwinkel, R90 und Eindringtiefe. Alle Varianten fliegen mit demselben Wurf; der Abwurfwinkel ist so gewählt, dass das Ausgangs-Setup den Bull trifft. Die Zielsuche probiert Schaftlängen 15–55 mm, Spitze ±4 mm und beide Flights durch (optional zusätzlich alle Barrels der Datenbank mit deinen Teilen) und sortiert nach Ziel (Steckwinkel auf Zielwert, möglichst ruhiger Flug oder möglichst enges Trefferbild) und nach Zahl der nötigen Änderungen. Jede Zeile lässt sich mit „→ B“ in den anderen Platz laden und dort im Detail vergleichen.

Was die Tabelle im Modell zeigt: Das Trefferbild (R90) ändert sich durch das Setup kaum, es hängt am Wurf. Steckwinkel und Flugruhe lassen sich dagegen spürbar verschieben. Der Flight wirkt am stärksten, ist aber auch der am wenigsten abgesicherte Teil des Modells (Flight-Aerodynamik nur angenähert, siehe Modell).

Den eigenen Wurf kann man per Video messen (Abschnitt 2 der App): Wurf von der Seite filmen, Dart in einigen Bildern markieren, die App berechnet Geschwindigkeit, Abwurfwinkel, Anstellwinkel, Nickrate, Abwurfhöhe und Abstand und übernimmt sie in die Simulation.

Reines HTML/CSS/JavaScript, keine Abhängigkeiten, kein Build.

## Starten

Die Datenbank wird per `fetch` geladen, deshalb über einen Webserver öffnen (nicht per Doppelklick/`file://`, sonst nur 2 Beispiel-Darts):

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

Online: In GitHub unter *Settings → Pages* „Deploy from a branch“, Branch `main`, Ordner `/` wählen. Die App läuft dann unter `https://<user>.github.io/Dart-Flight-Sim/`.

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Oberfläche |
| `style.css` | Layout, Hell/Dunkel-Modus |
| `physics.js` | Physikmodell (ohne DOM, auch in Node lauffähig) |
| `measure.js` | Wurfmessung: Auswertung der Marken, Bildverfolgung (ohne DOM) |
| `app.js` | Vergleich, Zeichnungen, Dart-Auswahl, Regler |
| `video.js` | Oberfläche der Video-Messung |
| `test/run.js` | Rechentests: `node test/run.js` |
| `data/brands.json` | Markenverzeichnis (Name, Datei, Anzahl Darts/Modelle) |
| `data/brands/<marke>.json` | Darts einer Marke, z. B. `harrows.json` |

Eigene Darts („Speichern“) landen nur im `localStorage` des Browsers und erscheinen unter der Marke „Eigene“.

Auswahl, Reglerstellungen und gemerkte Würfe bleiben ebenfalls im `localStorage`.

Nach Änderungen an App oder Daten `DATA_V` in `app.js` und `?v=` in `index.html` erhöhen, sonst zeigen Browser (v. a. Safari) noch die alte Version aus dem Cache.

Neue Marke ergänzen: Datei `data/brands/<id>.json` mit `{"brand": "...", "darts": [...]}` anlegen und in `data/brands.json` eintragen.

## Datenbank

357 Steel-Tip-Darts, ein Eintrag je Modell und Gewicht (Harrows 114, Red Dragon 91, Winmau 90, Target 49, Shot 4, Mission 3, Bullet 2, Bull's 2, Dynasty 1, Koto 1). Nur aktuelle Serien bzw. Pro-Modelle.

Aufgeteilt nach Marke (eine Datei je Marke). In der App sind die Darts nach Marke → Modell → Gewicht gegliedert (161 Modelle).

Felder je Eintrag:

| Feld | Bedeutung |
|---|---|
| `id` | eindeutiger Schlüssel |
| `model` | Modellname ohne Gewicht (gruppiert die Gewichte) |
| `name`, `short` | Anzeigename lang/kurz |
| `bw` | Barrel-Gewicht (g) |
| `len` | Barrel-Länge (mm) |
| `dia` | max. Barrel-Durchmesser (mm) |
| `shape` | Barrel-Form (Gerade, Torpedo, Konisch, …) |
| `bal` | Balance laut Händler (vorn/Mitte/hinten) |
| `cg` | daraus geschätzter Schwerpunkt in % der Barrel-Länge ab Spitze |
| `url` | Quelle (Händlerseite) |
| `note` | optional, z. B. „CG aus Balance-Angabe geschätzt“ |

Quellen der Maße: Händlerangaben von [a-zdarts.com](https://a-zdarts.com) (138 Einträge) und [dartshopper.com](https://www.dartshopper.com) (213 Einträge), Harrows Atrax von [harrowsdarts.com](https://harrowsdarts.com/products/atrax-95) und [dartsonline.com.au](https://www.dartsonline.com.au/products/harrows-atrax-95-tungsten-steel-tip-darts) (6 Einträge), Link je Dart in der App.

## Wurf per Video messen

**Aufnahme:** genau von der Seite (Kamera im rechten Winkel zur Wurflinie, auf Abwurfhöhe, Handy gerade), Zeitlupe mit 120 oder 240 Bildern/s, viel Licht. Im Bild: Hand beim Loslassen und mindestens der erste halbe Meter Flug; für Abwurfhöhe und Abstand zusätzlich der Bull.

**Ablauf in der App:**

1. Video aufnehmen oder wählen. Die Bildrate der Datei wird erkannt; bei Zeitlupe die echte Aufnahme-Bildrate eintragen (z. B. 240).
2. Zum ersten Bild nach dem Loslassen blättern, Spitze und Flight-Ende antippen (Zoom mit Mausrad, Zwei-Finger-Geste oder +/−). Mindestens 3 Bilder, besser 5 bis 10. Das früheste markierte Bild gilt als Abwurf.
3. Optional „Automatisch weiterverfolgen“: ab zwei von Hand markierten Bildern sucht die App den Dart in den folgenden Bildern selbst.
4. Optional Maßstab (Referenzstrecke, sonst Dartlänge) und Höhenpunkt (Bull-Mitte) setzen.
5. „In die Simulation übernehmen“ oder mehrere Würfe merken und den Mittelwert übernehmen. Die Messpunkte erscheinen als □ in Flugbahn und Anstellwinkel-Diagramm, so sieht man, wie gut die Simulation den echten Wurf trifft.

**Rechnung (`measure.js`):**

- Schwerpunkt je Bild aus Spitze und Flight-Ende (Lage des Schwerpunkts aus dem aktiven Dart).
- Geschwindigkeit und Abwurfwinkel: Ausgleichsgerade für x(t), für y(t) mit bekannter Fallbeschleunigung, über die ersten 120 ms.
- Dartwinkel und Nickrate: Parabel (ab 6 Bildern, sonst Gerade) durch den Dartwinkel der ersten 50 ms, Wert und Steigung bei t = 0. Anstellwinkel = Dartwinkel − Abwurfwinkel.
- Nickraten-Regler = gemessene Nickrate − Griff-Anteil des aktiven Darts; so bleibt der Griff-Effekt für den Vergleichsdart erhalten.
- Verfolgung: Doppel-Differenzbild (Minimum der Differenzen zu einem früheren und einem späteren Bild), Schwerpunkt und Hauptachse der bewegten Pixel in einem Suchfeld längs der vorhergesagten Dartachse; Spitze = Flight-Ende + bekannte Dartlänge. Unplausible Treffer brechen die Verfolgung ab.

**Geprüft** nur mit einem synthetischen Video (aus der Simulation gerendert, 240 Bilder/s, Dart 75 px lang, 4 Bilder von Hand, 78 automatisch): v 6,24 statt 6,20 m/s, Abwurfwinkel 19,0° statt 19,7°, Anstellwinkel 2,4° statt 3,0°, Nickrate −405 statt −358 °/s, Höhe 1,66 statt 1,65 m. Mit echten Handyvideos (Wischer, Kompression, Perspektive) ist die Messung ungenauer; die Verfolgung ist dort nicht erprobt.

**Grenzen:** Bei 30 Bildern/s bewegt sich der Dart je Bild um ca. 20 cm und ist verwischt, Nickrate und Anstellwinkel sind dann nicht messbar. Schräge Kamera, Weitwinkel-Verzeichnung und eine Referenzstrecke außerhalb der Wurfebene verfälschen Strecken und Winkel. Seitliche Abweichungen (Gieren) sieht die Seitenansicht nicht. Ein einzelner Wurf ist nicht repräsentativ, deshalb mehrere mitteln.

## Modell

3D-Starrkörper, explizite Integration (Δt 0,5 ms; Streuwürfe 1 ms) vom Abwurf, bis die Spitze die Board-Ebene erreicht.

- **Geometrie/Masse:** Spitze, Barrel (Masse am Schwerpunkt `cg`), Schaft, Flight als Einzelmassen → Gesamtschwerpunkt, Längs- und Quer-Trägheitsmoment.
- **Flight-Aerodynamik:** Umriss als Polygon; Auftriebsanstieg nach Streckung (Helmbold-Näherung) mit Rumpf-Interferenzfaktor; Druckpunkt per Streifentheorie (c/4 je Streifen); zusätzlich Querwiderstand der Platte (C_D 1,17).
- **Rumpf:** Querkraft der Zylinder (C_D 1,1), Stirnwiderstand der Barrel-Stufe (C_D 0,9), Hautreibung laminar (Blasius 1,328/√Re) für alle Teile.
- **Momente:** Rückstellmoment Flight und Rumpf, Nickdämpfung über Anströmung am Druckpunkt (ω × Hebelarm), Rolldämpfung des Drall, Nachlauf-Abschwächung des Flights durch das Barrel.
- **Wurf:** Abwurfwinkel wird per Sekantenverfahren so gesucht, dass die Spitze des Ziel-Darts den Bull trifft; der andere Dart fliegt mit identischem Wurf (Geschwindigkeit, Winkel, Höhe, Nickrate, Anstellwinkel). Treffhöhe = Höhe der Spitze an der Board-Fläche relativ zum Bull. Drall 5 U/s.
- **Streuung:** 24 Würfe mit fester Zufallsfolge (gleich für jeden Dart), gestört werden Abwurfwinkel, Seitenwinkel, Geschwindigkeit, Anstell-/Schiebewinkel, Nick-/Gierrate und Höhe. R90 = Radius um den Mittelpunkt, in dem 90 % liegen.
- **Kennwerte:** Steckwinkel (Neigung beim Auftreffen), max. Anstellwinkel, Nickperiode (lineare Näherung), Eindringtiefe = axiale Energie / Eindringwiderstand.

## Warum treffen Darts bei gleichem Wurf unterschiedlich hoch?

Die Schwerkraft beschleunigt jede Masse gleich, deshalb macht das Gewicht allein bei identischem Abwurf fast keinen Unterschied (Modell, 8 m/s, ohne Nickrate: 18 g vs. 28 g ca. ±0,1 mm; Slim-Flight +0,7 mm; Schwerpunkt hinten +2,3 mm; Barrel 40 statt 50 mm −1,9 mm). Größer wird der Unterschied, wenn der Dart pendelt: Bei Nickrate −400 °/s und 6 m/s lag ein hinten schwerer Dart mit Slim-Flight 16 mm höher als ein vorn schwerer mit Standard-Flight. Ursache ist der Auftrieb des schräg angeströmten Darts, der je nach Setup anders wirkt, und der Griff-Anteil der Nickrate.

Nicht im Modell: dass man einen schwereren Dart in der Praxis oft etwas langsamer wirft. Wer das vergleichen will, stellt die Geschwindigkeit von Hand um oder misst beide Darts per Video.

## Wovon hängt der Steckwinkel ab?

Steckwinkel = Bahnwinkel am Board (wie steil die Flugbahn fällt) + Anstellwinkel des Darts in diesem Moment.

1. **Bahnwinkel:** hängt an Geschwindigkeit und Höhenunterschied Abwurf–Ziel. Langsamer = höherer Bogen = steiler am Board (Atrax-Beispiel, Griff am Schwerpunkt: 6 m/s → ca. 17°, 8 m/s → ca. 8°, 10 m/s → ca. 3°).
2. **Anstellwinkel am Board:** Der Dart pendelt im Flug um seine Flugrichtung (gedämpfte Schwingung, Periode ca. 0,3 s, bei 8 m/s also etwa eine Schwingung bis zum Board). Wie er am Board steht, hängt davon ab, wie stark die Schwingung beim Abwurf angestoßen wird (Nickrate, Anstellwinkel beim Abwurf, Griffposition) und wie schnell sie abklingt (Flight-Größe, Schwerpunkt, Länge). Eine starke Nickrate kann den Dart mit der Spitze nach oben ankommen lassen (negativer Steckwinkel), obwohl die Bahn fällt.

James & Potts (2018) haben 225 Würfe von 19 Amateuren gefilmt: Median 6,0 m/s, Bahn 16,5° nach oben, Dart 19,4° (also +2,9° Anstellwinkel), Nickrate −412 °/s; Wellenlänge der Schwingung 2,16 m, Dämpfung 0,11.

## Annahmen (unsicher)

| Größe | Wert | Anmerkung |
|---|---|---|
| Luftdichte | 1,204 kg/m³ | 20 °C, Meereshöhe |
| Wurfdistanz | Regler, Standard 2,2 m | Schwerpunkt beim Abwurf bis Board-Fläche, ca. Oche 2,37 m minus Armreichweite |
| Bull-Höhe | 1,73 m | Regelmaß |
| Flight No.2 (Standard) | ca. 44 × 35 mm | Quellen uneinheitlich |
| Flight No.6 (Slim) | ca. 44 × 24 mm | Quellen uneinheitlich |
| Griff-Nickimpuls | 0,25 rad/s (≈ 14 °/s) pro mm Abstand Griff–Schwerpunkt, Griff hinter Schwerpunkt → Spitze kippt nach unten | grob geschätzt; Griff 25 mm hinter dem Schwerpunkt ergibt ≈ −400 °/s, passt zur Größenordnung bei James & Potts |
| Nickrate / Anstellwinkel beim Abwurf | Regler, Standard 0 | Amateur-Median: −412 °/s, +2,9° (James & Potts 2018) |
| Eindringwiderstand | 50 N | geschätzt |
| Massen Spitze/Schaft/Flight | 1,5 g je 25 mm / 0,02 g je mm / 0,75 g (No.2), 0,55 g (No.6) | geschätzt; bei „Mein Dart“ steckt der Fehler im zurückgerechneten Barrel, Gesamtmasse und Schwerpunkt stimmen trotzdem |
| Wurfstreuung „Standard“ | 1 σ: 0,12 m/s, 0,36°, 1,2°, 52 °/s, 3 mm | grobe Annahme, nicht gemessen |
| Schwerpunkt aus Balance | vorn 40 %, Mitte 50 %, hinten 58 % | Hersteller veröffentlichen keine Messwerte |
| Referenz-Steckwinkel | ca. 8° | nicht gesichert |

Die Streuung (R90) hängt vor allem an der angenommenen Wurfstreuung, nicht am Dart. Die App ist zum **relativen Vergleich** gedacht, nicht als genaue Vorhersage.

## Quellen

- Dart-Maße: [a-zdarts.com](https://a-zdarts.com), [dartshopper.com](https://www.dartshopper.com)
- Nickperiode/Flugstabilität: Windkanal-Messungen der TU Delft (Nickperiode ca. 0,3 s) als Plausibilitätscheck
- Abwurfparameter und Flugschwingung: D. James, J. Potts, *Experimental validation of dynamic stability analysis applied to dart flight*, Sports Engineering 21 (2018) 347–358, [doi:10.1007/s12283-018-0279-9](https://link.springer.com/article/10.1007/s12283-018-0279-9)
- Weitere Hintergrundinfos zu Flights, Schäften und Balance: gameandentertain, SKIPJACK, DartsNutz, Target Darts

## Ideen

- Weitere Marken und Soft-Tip-Darts
- Mehr Flight-Formen (Kite, Pear, Vortex …)
- Echte Schwerpunkt-Messwerte statt Schätzung aus Balance-Angabe
- Video-Messung mit echten Zeitlupenvideos erproben, Gieren aus zweiter Kamera
