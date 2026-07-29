# Pilotmigration – Pfaff Bio Kräuter

## Ausgangsumfang

- Betrieb: Pfaff Bio Kräuter
- ein Standort
- ein bestehendes Gewächshaus
- bestehender Waveshare ESP32-S3-ETH-8DI-8RO
- DS18B20 auf GPIO21
- bestehende funktionierende Bewässerung
- Fenster deaktiviert
- Frostschutz aktiv
- bestehende Zeitpläne übernehmen

In Phase 0.5 werden keine produktiven Pilotdaten angelegt.

## Vorbereitung

1. Produktives Schema ohne Zeilendaten sichern und dokumentieren.
2. Konfigurations- und Datenbackup erstellen und Restore isoliert testen.
3. Istwerte festhalten: Geräte-ID, Firmwarestand, Zeitpläne, Zeitzone,
   Relaisbinding und Warnungseinstellungen.
4. Aktuellen modularen Firmwarestand reproduzierbar bauen.
5. GPIO21, Bewässerungsbinding und Fenster-Aus-Zustand lastfrei testen.
6. Tenant-Isolation und Rollen vollständig automatisiert prüfen.

## Testmodus

- keine unbestätigte Aktorschaltung
- alle Aktoren beginnen AUS
- Relais nur einzeln, bewusst und zeitbegrenzt testen
- Fenster bleiben deaktiviert
- Bewässerungstest mit sichtbarer Bestätigung und maximaler Testdauer
- Warnungen tragen Kennzeichnung `TEST`
- Automationen dürfen simuliert werden, schalten aber nicht
- OTA nur auf ausdrücklich benanntem Testgerät
- jede Aktion und jedes Ergebnis wird auditiert
- Abbruch setzt alle Ausgänge in sicheren Zustand

## Produktivmodus

Der Wechsel ist ein expliziter, MFA-geschützter Freigabevorgang. Er aktiviert
nur verifizierte Komponenten. Zeitpläne werden versioniert übernommen und vor
Aktivierung simuliert. Die bisherige Konfiguration bleibt als
Wiederherstellungspunkt verfügbar.

## Abnahmekriterien

- Betrieb A/B-Isolation durch Negativtests bewiesen
- Owner, Operator und Viewer korrekt geprüft
- Master-Admin und Recovery funktionieren
- DS18B20 auf GPIO21 liefert plausible Werte und Sensorfehler
- manuelle Bewässerung EIN/AUS erfolgreich
- alle übernommenen Zeitpläne einschließlich Mitternacht geprüft
- Frostschutz verhindert manuelle und automatische Bewässerung
- Istzustand folgt dem Sollzustand und Timeout wird erkannt
- Fenster CH1–CH4 bleiben AUS und ignorieren Befehle
- Heartbeat, Offline-Erkennung, Warnung und Entwarnung funktionieren
- Audit ist vollständig
- Backup wurde tatsächlich restauriert
- Rückkehr zum bisherigen Stand ist dokumentiert und geprobt
- Build, Lint, Unit, Integration und E2E sind grün
- keine Secrets im Repository

Die Fenstersteuerung gehört nicht zur funktionierenden Pilot-Baseline. Eine
spätere Fenstererprobung ist ein eigenes Abnahmeprojekt mit neuer Architektur.
Bis dahin bleiben Dachfenster und Fensterwand deaktiviert.

## Rückfall

Bei Abnahmefehlern werden neue Komponenten deaktiviert, alle Aktoren sicher
ausgeschaltet und die letzte bestätigte Konfiguration wiederhergestellt. Kein
Schema- oder Auth-Rollback darf produktive Daten verlieren.
