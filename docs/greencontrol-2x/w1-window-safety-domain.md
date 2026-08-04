# W1 – Deterministische Fenster-Safety-Domain

Stand: 4. August 2026

## Status

W1 ist implementiert. Der Block enthält ausschließlich reine, deterministische
Domainlogik. Es wurden keine Datenbank-, API-, UI-, Firmware-, GPIO-, Relais-
oder Hardwareänderungen vorgenommen.

Die neue Domain ist noch nicht mit den bestehenden Firmwarecontrollern
verbunden. CH1 bis CH4 bleiben deshalb unverändert statisch deaktiviert.

## Implementierte Komponenten

### Getrenntes Zustandsmodell

Die Domain trennt:

- Komponentenstatus: `disabled`, `ready`, `fault_latched`,
  `emergency_stopped`,
- Bewegung: `stopped`, `opening`, `closing`,
- Position: `unknown`, `open`, `closed`, `partially_open`,
- ausstehende Richtung und Interlock-Zeit,
- Endschalterzustände,
- Fehlercode,
- Bewegungsstart und letzte Sequenz.

`disabled`, `stopped` und `error` werden nicht als physische Position
verwendet. Nach Neustart ist die Bewegung immer gestoppt. Eine Position wird
nur aus plausiblen Endschaltern abgeleitet; sonst bleibt sie `unknown`.

### Konfigurationsvalidierung

Validiert werden:

- nichtnegative Richtungswechselpause,
- positive getrennte Maximalzeiten für Öffnen und Schließen,
- verpflichtende Endschalter für die Dachfenster-Policy,
- zeitbasierte Seitenfenster-Policy ohne verpflichtende Sensoren.

### Zweiphasige Ausgangsentscheidung

Die Domain steuert keine Hardware. Sie liefert ausschließlich abstrakte
Aktionen:

- `all_off`,
- `drive_open`,
- `drive_close`.

Eine Aktion mit Hardwarewirkung besitzt getrennte Ergebnisse für:

- Ausgangsaktion bestätigt,
- Ausgangsaktion fehlgeschlagen.

Dadurch wird ein Command erst im bestätigten Zweig als `applied` bewertet. Ein
späterer Hardwareadapter darf das ACK nicht vorher veröffentlichen.

### Stop-Preemption

Ein gültiger Stop plant immer zuerst `all_off`, unabhängig von:

- `enabled`,
- Komponentenstatus,
- Fault oder Not-Aus,
- identischer oder veralteter Sequenz,
- normaler Bewegungsfreigabe.

Neue Stop-Sequenzen ergeben nach bestätigtem AUS `applied`, identische
Sequenzen `already_applied` und ältere Sequenzen `superseded`. Die physische
Stop-Aktion wird in allen drei Fällen geplant. Ein nicht bestätigtes AUS führt
zu `failed/relay_write_failed` und `fault_latched`.

### Bewegungs- und Interlockregeln

- Kein direkter Richtungswechsel.
- Gegenrichtung beginnt erst nach bestätigtem `all_off` und Ablauf der Pause.
- Ein neuer Command in bereits laufender gleicher Richtung startet den Timer
  nicht neu.
- Ein aktiver Ziel-Endschalter verlangt bestätigtes AUS.
- Ein Zielwert wird nie als tatsächliche Position übernommen.

### Safety-Ereignisse

Implementiert sind reine Transitionen für:

- lokalen Tick und maximale Laufzeit,
- Endschalteränderungen,
- widersprüchliche oder unerwartete Endschalter,
- fehlende verpflichtende Sensoren,
- Not-Aus,
- Konfigurationsdeaktivierung,
- Ablauf der Richtungswechselpause,
- Ausgangsfehler.

Safety-Ereignisse benötigen keine Netzwerk-, Server- oder Datenbankentscheidung.
Fehler werden verriegelt und führen nicht zu einer automatischen Gegenbewegung
oder Wiederaufnahme.

## Besondere Randfallhärtung

- widersprüchliche Endlagen werden bereits bei der Initialisierung verriegelt,
- ein Fenster darf vom bereits aktiven Ausgangs-Endschalter wegfahren,
- ein neu aktivierter unerwarteter Gegenschalter erzeugt einen Fault,
- rückwärts laufende monotone Zeit führt sicher zu
  `configuration_invalid`,
- ungültige Safety-Konfiguration während einer Bewegung plant `all_off`,
- Dach- und Seitenfensterzustände beeinflussen einander nicht.

## Commits

- `aa4ae48` – Zustandsmodell, Initialisierung und Invarianten,
- `820eadf` – Commandtransitionen, zweiphasige ACK-Semantik und
  Stop-Preemption,
- `fff4268` – Safety-Ereignisse, Endlagen, Laufzeit und Interlock,
- `cf420ea` – adversariale Randfallhärtung.

## Testabdeckung

Die W1-Unit-Tests prüfen mindestens:

- sichere Initialisierung und Neustart,
- getrennte Zustandsdimensionen,
- Konfigurationsvalidierung,
- Open, Close und Stop,
- Stop bei disabled, Fault, Not-Aus sowie alten und identischen Sequenzen,
- Ausgangserfolg und Ausgangsfehler,
- Break-before-make,
- gleichbleibende Richtung ohne Timerneustart,
- Endlagen und Sensorwidersprüche,
- Laufzeitüberschreitung,
- monotone Zeitfehler,
- Not-Aus und Deaktivierung,
- getrennte Dach-/Seiteninstanzen,
- Abwesenheit von Transport-, Datenbank- und Hardwareabhängigkeiten.

## Verbleibend für W2

W2 darf auf dieser Domain aufbauen, ohne deren Safety-Invarianten zu ändern.
Noch nicht Bestandteil von W1 sind:

- persistente Dach- und Seitenfenster-Komponenten,
- getrenntes `enabled`,
- versionierte Konfiguration,
- Öffnungs-/Schließzeiten und Interlockwerte in der Datenbank,
- Sensor- und Hardwarebindings,
- persistenter Komponenten-, Bewegungs- und Fehlerstatus,
- Konfigurationsvalidierung gegen Gerät und Hardwareprofil,
- Staging-Migration und Rollback.

Command-Erzeugung, API-Anpassung, Firmwareintegration, Relais, Endschalter,
Hardwaretests, UI und Automatik bleiben weiterhin W3 bis W9 vorbehalten.

## Abnahmegrenze

W1 gibt keine Fensterbewegung frei. Die statische Sperre von CH1 bis CH4 muss
bis zur späteren Firmware-, Safety- und Hardwareabnahme unverändert bestehen
bleiben.
