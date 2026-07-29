# GreenControl 2.x – Testplan

## Aktuelle Testlage

Es existieren keine Unit-, Integrations- oder E2E-Tests und keine entsprechenden
Package-Skripte. Der Build ist erfolgreich. Lint ist mit 8 Fehlern und
3 Warnungen nicht grün.

## Teststufen

- TypeScript und Next.js Build
- ESLint
- Unit Tests für Domain- und Sicherheitsregeln
- Integrationstests für Repositories, Datenbank, Auth, Mail und Protokoll
- E2E-Tests für Login, Rollen, Steuerung und PWA
- Hardware-in-the-loop ohne angeschlossene Lasten
- Restore- und OTA-Rollback-Tests

## Pflichtfälle

- Login, generische Fehler, Bestätigung, Reset, MFA und Session-Widerruf
- Mandant A kann Mandant B weder lesen noch verändern
- Rollen und Einzelrechte einschließlich Step-up-MFA
- Betrieb, Standort, Gewächshaus und Gerät anlegen
- Geräte-ID, gültiges/ungültiges Secret, deaktiviertes Gerät und Heartbeat
- Temperaturgrenzen und DS18B20 an GPIO21
- manuelle Bewässerung EIN/AUS
- Zeitplan innerhalb eines Tages und über Mitternacht
- Frostschutz hat Vorrang vor manuell und Zeitplan
- Wechsel manuell zu automatisch beginnt sicher AUS
- Pin- und Kanalkonflikte
- Fenster deaktiviert: CH1–CH4 AUS und Befehle ignoriert
- Fenster später aktiviert: Verriegelung, Endlagen, Timeout, Richtungswechsel
- Warnzustandswechsel, Entwarnung, Mail und Audit
- Plugin-Schema, Discovery und unbekannter Sensor
- OTA-Signatur, Hash, Neustart-Health-Check und Rollback
- PWA-Installation, Offline-Anzeige und keine veralteten Gefahrbefehle
- Backup-Export und realer Restore

## Hardware-Testmodus

Alle Ausgänge starten AUS. Tests sind einzeln, kurzlebig und auditiert. Der
Modus prüft Relais, DS18B20, Eingänge/Endschalter, Druck, Netzwerk, Heartbeat und
OTA ohne angeschlossene Lasten. Laufzeitlimit, gegenseitige Verriegelung,
Not-Aus und automatische Rückkehr zu AUS sind Pflicht.

## Phase-0-Abnahme

- keine Produktionslogik geändert
- keine Migration ausgeführt
- kein Login ersetzt
- keine Firmware verändert
- aktuelle Firmware eindeutig identifiziert
- veraltete Firmware markiert
- Build-Ergebnis und Lint-Schulden dokumentiert

## Ergänzungen aus Phase 0.5

### Vollständige Datenflüsse

- manuell EIN vom UI-Button bis zum bestätigten Relais-Istzustand
- manuell AUS und verlorener Heartbeat
- Zeitplan speichern, ändern, löschen und auswerten
- Temperatur von GPIO21 bis Dashboard und Historie
- Login, Reset, Einladung, MFA, Logout und Session-Widerruf
- Gerätelebenszyklus von Registrierung bis Stilllegung
- Warnung, Zustandswechsel, Versandfehler und Entwarnung
- Auditvollständigkeit pro sicherheitsrelevanter Mutation

### Configuration Engine

- gültige Konfiguration laden, validieren, atomar anwenden und bestätigen
- alte, gleiche, übersprungene und manipulierte Version ablehnen
- Signatur- und Hashfehler
- Firmware-/Hardwareprofil-Inkompatibilität
- GPIO-, Relais-, I²C-, UART-, Timer- und Bindingkonflikte
- Teilanwendung darf nie sichtbar werden
- Neustart mit letzter bestätigter Konfiguration
- Cloud-Ausfall und abgelaufene Befehle
- Rollback nach Boot- oder Health-Fehler
- gewünschte, angewandte und bestätigte Version bleiben unterscheidbar

### Plugin-Lebenszyklus

- Definition und Schemafehler
- Installation nach Sichtbarkeitsbereich
- fehlende/zyklische Abhängigkeiten
- Firmware- und Hardwarekompatibilität
- Aktivierung nur nach Test
- Update mit Schema-Migration, Simulation und Rollback
- Deaktivierung setzt zuerst sicheren Fallback
- Entfernung mit aktiven Instanzen wird blockiert
- private Plugins bleiben tenantisoliert
- globale Freigabe verlangt Master-Admin und Step-up-MFA

### Fensterkomponenten

- `enabled=false`: beide Relais AUS, Commands ignoriert, Automation aus
- Dach und Wand als getrennte Komponenten
- Fensterlogik wird nicht gegen die bestehende Implementierung als
  Funktionsreferenz getestet, sondern gegen die neue Spezifikation
- manueller Modus akzeptiert Öffnen, Stoppen und Schließen
- manueller Modus ignoriert Regen, Schnee, Wind und Temperatur vollständig
- lokale Safety bleibt im manuellen Modus aktiv
- Stoppen schaltet beide Richtungen sofort AUS
- `enabled=true` ohne Endschalter oder Safety Policy wird abgelehnt
- Öffnen/Schließen nie gleichzeitig
- Richtungswechselpause
- Dachfenster: Endschalterstopp in beiden Richtungen
- Dachfenster: getrennte maximale Öffnungs- und Schließzeit
- Dachfenster: fehlende Endlage innerhalb Zeit → AUS, Fehler und Warnung
- Fensterwand: getrennte zeitbasierte Öffnungs- und Schließfahrt
- Fensterwand: optionaler Sensor beendet Fahrt
- Fensterwand: Zeit bleibt trotz Sensor Sicherheitsgrenze
- Automatikpriorität Not-Aus/Fehler vor Wetter vor Temperatur
- Regen, Schnee und Wind können in Automatik Schließen erzwingen
- ab Öffnungstemperatur öffnen
- bis Schließungstemperatur schließen
- Hysteresebereich hält Zustand
- Befehls- und Kommunikations-Timeout
- Not-Aus
- Sensorfehler-Fallback

### Mandantenkontext und Master Platform

- jeder Repositoryaufruf verlangt Tenant Context
- Cross-Tenant-Read, -Write und IDOR werden abgewiesen
- Service-Role-Pfade prüfen Tenant und Permission
- Masterzugriff ist getrennt, MFA-geschützt und auditiert
- Modulereignisse überschreiten Grenzen nur über definierte Verträge

### Pilot Pfaff Bio Kräuter

- ein Betrieb, Standort und Gewächshaus ohne Codeänderung
- bestehendes Gerät und Zeitpläne verlustfrei zuordnen
- Testmodus schaltet nichts unbestätigt
- Testwarnungen sind markiert
- Simulation verändert keine Aktoren
- OTA erreicht nur das benannte Testgerät
- produktive Aktivierung erst nach allen Abnahmekriterien
- Rückfall stellt den vorherigen Stand wieder her

### Legacy-Firmware-Schutz

- CI-/Buildziel enthält keine Datei aus `firmware/legacy`
- Referenz auf `waveshare_greenhouse_frost_safe.ino` lässt Build scheitern
- Release-Artefakt enthält Hardwareprofil, Commit, Hash und Signatur
- Secret-Scanner erkennt fest eingetragene Credentials
- GPIO21- und Bewässerungsregression laufen gegen die aktuelle Firmware
- CH1–CH4-Blockade bleibt bis zur freigegebenen Komponentenaktivierung erhalten

### Verbindliche Regression-Baseline

Positive Regressionstests werden zunächst ausschließlich für folgende
nachweislich funktionierende Funktionen angelegt:

- DS18B20 an GPIO21
- Temperaturanzeige
- manuelle Bewässerung
- Bewässerungszeitpläne
- Mitternachtswechsel
- Frostschutz
- Heartbeat
- Bewässerungs-Istzustand

Fenster sind ausdrücklich nicht Teil dieser bestehenden Funktionsbaseline.

### Übergang von statischer Sperre zu dynamischer Fensteraktivierung

Die Tests müssen zwei zeitlich getrennte Sicherheitsstufen unterscheiden.

Aktuelle Baseline, bis zur freigegebenen Fenster-Implementierungsphase:

- CH1 bis CH4 sind statisch blockiert.
- Kein Fensterbefehl darf eine Bewegung auslösen.
- Die bestehende Fensterlogik ist keine positive Funktionsreferenz.
- Die Sperre darf vor Implementierung und vollständiger Freigabe nicht
  gelockert werden.

Zieltests der späteren universellen Fensterimplementierung:

- Dachfenster und Fensterwand sind getrennte Komponenten.
- Pilotstart setzt beide Komponenten auf `enabled=false`.
- Bei `enabled=false` bleiben beide Richtungsrelais AUS.
- Bei `enabled=false` werden Befehle sowie Wetter- und
  Temperaturautomationen ignoriert.
- Bei `enabled=false` wird der Status „Deaktiviert“ gemeldet und angezeigt.
- Die Aktivierung einer Komponente verändert den Zustand der anderen nicht.
- `enabled=true` wird ohne bestandene Hardware-, Binding-, Sensor- und
  Safety-Prüfung abgelehnt.
- Nach gültiger Aktivierung ist die vollständige konfigurierte Fensterlogik
  ohne Firmware- oder Codeänderung verfügbar.
- Relaiskanäle, Temperaturen, Laufzeiten in Minuten, Sensoren, Wetterregeln und
  Sicherheitszustände werden je Komponente getrennt validiert.
- Ein Wechsel zurück zu `enabled=false` stoppt eine laufende Bewegung und
  bestätigt beide Relais als AUS.
- Neustart, Konfigurationsrollback und Kommunikationsausfall dürfen eine
  deaktivierte Komponente niemals implizit aktivieren.

Die spätere Ablösung der statischen CH1-bis-CH4-Sperre ist erst zulässig, wenn
alle dynamischen Aktivierungs-, Safety-, Zustands- und Rollbacktests bestanden
sind.

### Einheiten und UI-Trennung

- jedes numerische Fachfeld zeigt eine Einheit
- Temperatur: °C
- Bewässerungs- und Fensterzeiten: Minuten
- Wind: km/h
- Boden- und Luftfeuchtigkeit: %
- EC: mS/cm
- pH: korrekt als pH gekennzeichnet
- NPK: Einheit aus Sensorschema
- API lehnt inkompatible Einheiten ab
- normale App enthält keine technischen Pin-/Busfelder
- technische Einstellungen sind nur mit Master-Berechtigung erreichbar
