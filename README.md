# Dart-Labor

Web-App, um Steel-Tip-Darts **vor dem Kauf** per Flugsimulation zu vergleichen. Zwei Darts (A/B) nach Marke und Modell wählen, dann Regler schieben: Flugbahn, Trefferbild und Kennwerte (Streuung, Flugruhe, Steckwinkel, Eindringtiefe) aktualisieren sich live direkt daneben. Die App wirft beide Darts automatisch auf den Bull. Die Endlage zeigt beide Darts maßstabsgetreu von der Seite im Board, mit Spitzenbahn, Steckwinkel und Eindringtiefe; der gerade eingestellte Dart ist hervorgehoben, der andere als Ghost.

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
| `app.js` | Physikmodell, Vergleich, Zeichnungen, Dart-Auswahl |
| `data/brands.json` | Markenverzeichnis (Name, Datei, Anzahl Darts/Modelle) |
| `data/brands/<marke>.json` | Darts einer Marke, z. B. `harrows.json` |

Eigene Darts („Speichern“) landen nur im `localStorage` des Browsers und erscheinen unter der Marke „Eigene“.

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

## Modell

3D-Starrkörper, explizite Integration (Δt 0,5 ms; Streuwürfe 1 ms) vom Abwurf bis zur Board-Ebene.

- **Geometrie/Masse:** Spitze, Barrel (Masse am Schwerpunkt `cg`), Schaft, Flight als Einzelmassen → Gesamtschwerpunkt, Längs- und Quer-Trägheitsmoment.
- **Flight-Aerodynamik:** Umriss als Polygon; Auftriebsanstieg nach Streckung (Helmbold-Näherung) mit Rumpf-Interferenzfaktor; Druckpunkt per Streifentheorie (c/4 je Streifen); zusätzlich Querwiderstand der Platte (C_D 1,17).
- **Rumpf:** Querkraft der Zylinder (C_D 1,1), Stirnwiderstand der Barrel-Stufe (C_D 0,9), Hautreibung laminar (Blasius 1,328/√Re) für alle Teile.
- **Momente:** Rückstellmoment Flight und Rumpf, Nickdämpfung über Anströmung am Druckpunkt (ω × Hebelarm), Rolldämpfung des Drall, Nachlauf-Abschwächung des Flights durch das Barrel.
- **Wurf:** Abwurfwinkel wird je Dart per Sekantenverfahren so gesucht, dass der Bull getroffen wird. Drall 5 U/s.
- **Streuung:** 24 Würfe mit fester Zufallsfolge (gleich für jeden Dart), gestört werden Abwurfwinkel, Seitenwinkel, Geschwindigkeit, Anstell-/Schiebewinkel, Nick-/Gierrate und Höhe. R90 = Radius um den Mittelpunkt, in dem 90 % liegen.
- **Kennwerte:** Steckwinkel (Neigung beim Auftreffen), max. Anstellwinkel, Nickperiode (lineare Näherung), Eindringtiefe = axiale Energie / Eindringwiderstand.

## Wovon hängt der Steckwinkel ab?

Steckwinkel = Bahnwinkel am Board (wie steil die Flugbahn fällt) + Anstellwinkel des Darts in diesem Moment.

1. **Bahnwinkel:** hängt an Geschwindigkeit und Höhenunterschied Abwurf–Ziel. Langsamer = höherer Bogen = steiler am Board (Atrax-Beispiel, Griff am Schwerpunkt: 6 m/s → ca. 17°, 8 m/s → ca. 8°, 10 m/s → ca. 3°).
2. **Anstellwinkel am Board:** Der Dart pendelt im Flug um seine Flugrichtung (gedämpfte Schwingung, Periode ca. 0,3 s, bei 8 m/s also etwa eine Schwingung bis zum Board). Wie er am Board steht, hängt davon ab, wie stark die Schwingung beim Abwurf angestoßen wird (Nickrate, Anstellwinkel beim Abwurf, Griffposition) und wie schnell sie abklingt (Flight-Größe, Schwerpunkt, Länge). Eine starke Nickrate kann den Dart mit der Spitze nach oben ankommen lassen (negativer Steckwinkel), obwohl die Bahn fällt.

James & Potts (2018) haben 225 Würfe von 19 Amateuren gefilmt: Median 6,0 m/s, Bahn 16,5° nach oben, Dart 19,4° (also +2,9° Anstellwinkel), Nickrate −412 °/s; Wellenlänge der Schwingung 2,16 m, Dämpfung 0,11.

## Annahmen (unsicher)

| Größe | Wert | Anmerkung |
|---|---|---|
| Luftdichte | 1,204 kg/m³ | 20 °C, Meereshöhe |
| Wurfdistanz | 2,2 m | Abwurf bis Board, ca. Oche 2,37 m minus Armreichweite |
| Bull-Höhe | 1,73 m | Regelmaß |
| Flight No.2 (Standard) | ca. 44 × 35 mm | Quellen uneinheitlich |
| Flight No.6 (Slim) | ca. 44 × 24 mm | Quellen uneinheitlich |
| Griff-Nickimpuls | 0,25 rad/s (≈ 14 °/s) pro mm Abstand Griff–Schwerpunkt, Griff hinter Schwerpunkt → Spitze kippt nach unten | grob geschätzt; Griff 25 mm hinter dem Schwerpunkt ergibt ≈ −400 °/s, passt zur Größenordnung bei James & Potts |
| Nickrate / Anstellwinkel beim Abwurf | Regler, Standard 0 | Amateur-Median: −412 °/s, +2,9° (James & Potts 2018) |
| Eindringwiderstand | 50 N | geschätzt |
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
- Wurfgeschwindigkeit per Video messen
