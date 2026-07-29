# GreenControl 2.x – Vorschlag Phase 1A

## Ziel

Phase 1A schafft ein belastbares Sicherheitsnetz um die acht bestätigten
Baseline-Funktionen. Sie verändert weder Datenbankschema noch Login noch
Firmwareverhalten und implementiert noch keine Fenstersteuerung.

## Umfang

### 1. Testinfrastruktur

- leichtgewichtiges Unit-Test-Framework passend zu Next.js 16 einrichten
- getrennte Testordner für Unit und Integration vorbereiten
- Scripts für TypeScript, Lint, Unit und Build vereinheitlichen
- CI-fähigen lokalen Gesamtbefehl definieren

Vor Auswahl oder Konfiguration werden die installierten Next.js-16-Dokumente
gemäß `AGENTS.md` gelesen.

### 2. Charakterisierung der Bewässerungsregeln

Bestehendes Verhalten zunächst durch Tests festschreiben:

- manuell EIN
- manuell AUS
- Zeitplan aktiv/inaktiv
- mehrere Zeitpläne
- Intervall innerhalb eines Tages
- Mitternachtswechsel
- Dauer mindestens 24 Stunden
- ungültige Startzeit und Dauer
- Froststatus
- Temperatur ≤ 0 °C
- manueller Override gegenüber Zeitplan
- Wechsel zu Automatik setzt Sollwert zunächst AUS

Wo nötig dürfen reine Berechnungsfunktionen verhaltensgleich extrahiert werden.
Die Heartbeat-Antwort und Datenbankfelder bleiben unverändert.

### 3. Heartbeat-Vertrag

- Request-/Response-Fixtures ohne echte Secrets
- fehlende ID/Secret → 401
- unbekanntes, falsches oder deaktiviertes Gerät → 401
- gültige Temperatur und Grenzwerte
- `watering_on` als tatsächlicher Zustand
- Firmwareversion und `last_seen`
- Sensor-Reading-Insert
- berechneter Bewässerungsbefehl

Externe Supabase-Zugriffe werden in Tests durch kontrollierte Adapter/Fakes
ersetzt; keine produktive Datenbank wird angesprochen.

### 4. GPIO21- und Firmware-Referenzschutz

Noch ohne Firmwareänderung:

- statischer Test/Nachweis für DS18B20 an GPIO21 im aktuellen modularen Stand
- Legacy-Datei als `DO NOT FLASH` in Test-/Buildregeln vormerken
- keine Fensterfunktion als positive Regression festschreiben
- aktuellen Fenster-Aus-Zustand nur als Safety Guard prüfen

### 5. Temperaturanzeige

- gültiger Messwert mit °C
- fehlender Wert
- ungültiger Wert
- Offlinezustand
- keine Verwechslung von gespeichertem Altwert und aktuellem Messwert

### 6. Verhaltensneutrale Baseline-Bereinigung

- bestehende 8 Lint-Fehler und 3 Warnungen beheben, soweit ohne
  Funktionsänderung möglich
- `any` durch lokale Typen ersetzen
- Zeitbestimmung außerhalb unreiner Renderpfade erfassen
- MFA-Effect regelkonform stabilisieren
- keine UI-, Auth- oder Domain-Neugestaltung

## Ausdrücklich nicht enthalten

- Datenbankmigrationen
- eigenes Login
- Tenant-Modell
- Configuration Engine
- Plugin Runtime
- neue Fensterlogik
- Firmwareänderungen oder Flashen
- OTA
- produktive Daten oder Pilotanlage
- Secret-Rotation selbst; diese bleibt eine externe Betriebsmaßnahme

## Abnahme

- alle acht Baseline-Funktionen sind durch nachvollziehbare Tests abgedeckt
- Build, TypeScript und Lint sind grün
- Unit-Tests sind grün
- Tests greifen nicht auf Produktion zu
- keine Secretwerte in Fixtures oder Logs
- Git-Diff enthält nur Testinfrastruktur, Tests und nachweislich
  verhaltensneutrale Typ-/Lint-Korrekturen
- Fenster bleiben deaktiviert und sind nicht als funktionierend deklariert

## Rückfall

Phase 1A wird als kleiner eigener Commit umgesetzt. Testinfrastruktur und jede
verhaltensneutrale Codebereinigung werden getrennt commitbar gehalten. Bei einer
unerwarteten Verhaltensänderung wird die betreffende Extraktion verworfen,
nicht die Baseline angepasst.

