# Neon Nights Casino

Ein 2D-Casino im Neon-Look zum Herumlaufen. Du steuerst deine eigene Spielfigur durch die Casino-Halle und gehst von Automat zu Automat und von Tisch zu Tisch. Es gibt 8 Spiele, ein gemeinsames Guthaben, Level, Erfolge, eine Bar und ein Bonusrad. Gespielt wird **nur mit Spielgeld**: Es gibt keine echten Einsätze und keine Auszahlungen.

## Starten – ein Doppelklick

| System  | Datei |
|---------|-------|
| Windows | **`START.bat`** doppelklicken |
| macOS   | **`START.command`** doppelklicken (beim ersten Mal: Rechtsklick → Öffnen) |
| Linux   | `./start.sh` |
| Überall | `index.html` im Browser öffnen |

Du willst das Spiel verschicken? **`Neon-Nights-Casino.html`** enthält alles in einer einzigen Datei, ohne Installation und ohne Server.

## Die Casino-Halle

- **Laufen:** mit `WASD` oder den Pfeiltasten, per Klick auf den Boden oder auf dem Handy mit dem Joystick unten links. Ein Klick auf einen Automaten lässt die Figur selbst hinlaufen und das Spiel öffnen.
- **Spielen:** Stell dich vor einen Automaten oder Tisch und drück `E` (oder tippe auf „Spielen“).
- **Deine Figur:** Beim ersten Besuch gestaltest du Name, Haut, Frisur, Haarfarbe, Anzug, Krawatte und Sonnenbrille. Ändern kannst du alles später über das Personen-Symbol oder an der Kasse.
- **Gäste und Dealer** laufen durch die Halle, spielen an den Automaten und stehen an den Tischen.
- **Bar:** Alle 3 Minuten spendiert der Barkeeper einen Drink und ein paar Münzen.
- **Schnellwahl** (Kachel-Symbol oben): springt ohne Laufen direkt an jeden Tisch.

## Die Spiele

| Spiel | Kurzbeschreibung | Quote |
|---|---|---|
| **Lucky Seven Deluxe** | Slot mit 5 Walzen, 10 Linien, Wilds, Freispielen ×2, Auto, Turbo und Schnellstopp | ca. 95 % |
| **Grand Roulette** | Europäisch mit einer Null. Kessel mit echtem Kugellauf; Zahlen, Dutzende, Kolonnen, Rot/Schwarz, Gerade/Ungerade | 97,3 % |
| **Midnight Blackjack** | 6 Decks, Dealer steht auf 17, Blackjack zahlt 3:2, Teilen und Verdoppeln | – |
| **Neon Plinko** | 8/12/16 Reihen, drei Risikostufen, bis 1000× | ca. 99 % |
| **Rocket Crash** | Die Rakete steigt. Wer vor dem Absturz auszahlt, gewinnt. Mit Auto-Auszahlung und Mitspielern | 97 % |
| **Diamond Mines** | 5×5-Feld mit 1–24 Bomben. Jedes Juwel erhöht den Multiplikator | 97 % |
| **Rubbellose** | Mit Maus oder Finger freirubbeln. Drei gleiche Symbole gewinnen bis 100× | ca. 96 % |
| **Würfel-Duell** | Zwei 3D-Würfel. Du setzt auf Unter 7, Genau 7, Über 7 oder Pasch | ca. 96–97 % |

Dazu kommen Level mit Münz-Belohnung, 18 Erfolge und ein Gratis-Bonusrad alle 10 Minuten (bei leerem Konto sofort). Die Soundeffekte werden synthetisiert, und der Spielstand wird im Browser gespeichert.

## Sprachen & Einstellungen

Über das Zahnrad oben stellst du die **Sprache** ein: Deutsch, English, Español, Français oder Türkçe. Die Sprache wechselt sofort, einschließlich Zahlenformaten und Schildern in der Halle. Beim ersten Start wird die Browsersprache übernommen. Dort regelst du auch die **Lautstärke**.

## Steuerung

- Halle: `WASD`/Pfeile laufen · `E` spielen · Klick = hinlaufen
- Slot, Plinko, Roulette, Crash, Mines, Würfel: **Leertaste** startet
- Roulette/Würfel: `R` wiederholt die letzte Wette · Rechtsklick entfernt eine Wette
- Blackjack: `H` Karte · `S` Halten · `D` Verdoppeln · `P` Teilen · `Enter` Austeilen
- `Esc` schließt Fenster

## Für Entwickler

- Einzeldatei neu bauen: `python3 tools/build.py`
- Quoten simulieren: `node tools/simulate.js`
- Reines HTML/CSS/JavaScript ohne Abhängigkeiten und ohne Build-Schritt
- Übersetzungen stehen in `js/i18n-data.js`. Deutsch ist die Quellsprache, und jede Zeile enthält alle 5 Sprachen.
