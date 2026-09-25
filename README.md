# Neon Nights Casino

Ein 2D-Casino im Neon-Look mit drei Spielen, einem gemeinsamen Guthaben, Levels, Erfolgen und einem Bonusrad. Gespielt wird **nur mit Spielgeld**: Es gibt keine echten Einsätze und keine Auszahlungen.

## Starten – ein Doppelklick

| System  | Datei |
|---------|-------|
| Windows | **`START.bat`** doppelklicken |
| macOS   | **`START.command`** doppelklicken (beim ersten Mal: Rechtsklick → Öffnen) |
| Linux   | `./start.sh` |
| Überall | `index.html` im Browser öffnen |

Du willst das Spiel verschicken? **`Neon-Nights-Casino.html`** enthält alles in einer einzigen Datei. Einfach öffnen, ohne Installation und ohne Server.

Für die Originalschriften (Bungee, Rubik) braucht der Browser Internet. Offline springen Ersatzschriften ein, und das Spiel läuft trotzdem.

## Die Spiele

**Lucky Seven Deluxe (Slot)**: 5 Walzen, 3 Reihen, 10 Gewinnlinien. Die Krone (WILD) ersetzt jedes Symbol. Ab 3 Bonus-Sternen gibt es 8, 12 oder 20 Freispiele mit doppelten Gewinnen. Liegen zwei Sterne, laufen die übrigen Walzen spannungsvoll länger. Dazu kommen Auto-Spin, Turbo und Schnellstopp (während des Drehens erneut drücken). Die Auszahlungsquote liegt bei ca. 95 %.

**Neon Plinko**: 8, 12 oder 16 Reihen, drei Risikostufen, bis 1000×. Mehrere Kugeln dürfen gleichzeitig fallen, im Auto-Modus auch am Stück. Die Auszahlungsquote liegt bei ca. 99 %.

**Midnight Blackjack**: 6 Decks. Der Dealer steht auf allen 17, Blackjack zahlt 3:2. Du kannst verdoppeln und teilen (geteilte Asse bekommen je eine Karte).

**Rund ums Spiel**: XP für jeden Einsatz, Level-Belohnungen, 12 Erfolge, ein Gratis-Bonusrad alle 10 Minuten und ein Rettungsdreh bei leerem Konto. Die Soundeffekte erzeugt das Spiel selbst per WebAudio. Der Spielstand wird im Browser gespeichert.

## Steuerung

- Slot/Plinko: **Leertaste** dreht bzw. lässt eine Kugel fallen
- Blackjack: **H** Karte · **S** Halten · **D** Verdoppeln · **P** Teilen · **Enter** Austeilen
- **Esc** schließt Fenster

## Für Entwickler

- Einzeldatei neu bauen: `python3 tools/build.py`
- Quoten simulieren: `node tools/simulate.js`
- Reines HTML/CSS/JavaScript ohne Abhängigkeiten und ohne Build-Schritt
