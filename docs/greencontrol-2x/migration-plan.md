# GreenControl 2.x – Migrationsplan

## Empfohlene Reihenfolge

### 0. Bestand und Sicherheitsbaseline

1. Phase-0-Dokumente versionieren.
2. Potenziell offengelegte Werte in Alt-Firmware und Cron-Template
   inventarisieren und außerhalb des Repositorys rotieren.
3. Aktuellen modularen Firmwareordner als unveränderte Referenz in einen
   kontrollierten Quellstand übernehmen, dabei `GCConfig.h` ausschließen.
4. Lint-Baseline bereinigen, ohne Laufzeitverhalten zu ändern.
5. Charakterisierungstests für Heartbeat, Bewässerung, Frostschutz und
   Fenster-Aus-Zustand ergänzen.

### 1A. Regression-Baseline

Vor Datenmodell- oder Architekturänderungen werden ausschließlich die
bestätigten Funktionen abgesichert:

- DS18B20 an GPIO21
- Temperaturanzeige
- manuelle Bewässerung
- Bewässerungszeitpläne
- Mitternachtswechsel
- Frostschutz
- Heartbeat
- Bewässerungs-Istzustand

Die vorhandene Fensterlogik ist keine Funktionsbaseline. Sie bleibt deaktiviert
und wird später nach der neuen Komponenten- und State-Machine-Spezifikation
implementiert. Der konkrete Umfang von Phase 1A steht in
`phase-1a-proposal.md`.

### 1B. Datenmodell feststellen und migrationsfähig machen

1. Produktives Schema ausschließlich über einen sicheren Schemaexport ohne
   Zeilendaten erfassen.
2. SQL-Skripte in eine geordnete, idempotente Migrationshistorie überführen.
3. Backup und Restore in isolierter Umgebung beweisen.
4. Noch keine Spalten löschen oder Auth-Fremdschlüssel verändern.

### 2. Tenant Context und Repository-Grenzen

1. `tenant`, `site` und tenantgebundene Mitgliedschaften additiv einführen.
2. Tenant Context und Permission Service implementieren.
3. Direkte Supabase-Aufrufe vertikal hinter Repositories verschieben.
4. Cross-Tenant-Lese- und Schreibtests als Pflicht-Gate etablieren.

### 3. Rollen und Einzelberechtigungen

Systemrolle und Gewächshausrolle vereinheitlichen, `master_admin` abgrenzen und
feine Rechte serverseitig einführen. Service-Role-Zugriffe erhalten zwingende
Tenant- und Berechtigungsprüfungen.

### 4. Eigenes Login im Parallelbetrieb

Argon2id, Pepper, Sessions, Rotation, Widerruf, Reset, Bestätigung, Sperren,
Rate-Limits, TOTP und Recovery-Codes implementieren. Bestehende Supabase-Nutzer
kontrolliert migrieren. Supabase Auth erst nach getestetem Master-Admin,
Break-glass-Verfahren und Rollback deaktivieren.

### 5. Komponenten und Plugins

Dynamisches Komponentenmodell, Plugin-Registry, Schema-Validierung,
Pin-Konfliktprüfung und Einrichtungsassistent einführen. Bestehende Temperatur-
und Bewässerungskomponenten über kompatible Adapter abbilden.

### 6. Geräteprotokoll und Firmware-Konfiguration

Versionierte Konfiguration, ACK/NACK, letzte gültige Konfiguration,
idempotente Befehle, Offline-Sicherheit und Hardwareprofile implementieren.
DS18B20/GPIO21 und der bestätigte Bewässerungskanal bleiben unverändert.
Fenster bleiben deaktiviert.

### 7. Fenster, Automationen und PWA

Fenster erst nach vollständiger Hardware- und Sicherheitskonfiguration in einem
lastfreien Testmodus aktivierbar machen. Danach Automations-Builder, zusätzliche
Warnungen, Verlauf, CSV, PWA und Web-Push.

### 8. OTA und Backups

Signierte Firmware, Hashprüfung, Testgruppen, Health-Check und Rollback zuerst
auf genau einem Testgerät. Backup-Funktion erst nach realem Restore-Test
freigeben.

## Rollback-Grundsätze

- additive, abwärtskompatible Migrationen
- Feature Flags für neue Auth-, Tenant-, Komponenten- und Gerätepfade
- kein Löschen vor Export und bewiesenem Restore
- alter Login bleibt bis zur Abnahme verfügbar
- Firmware-Rollout beginnt mit einem ausdrücklich benannten Testgerät

## Erste kleine, sichere Umsetzungseinheit

Ein reines Regressionsschutz-Paket ohne Produktionslogikänderung:

1. Tests für Zeitplan innerhalb eines Tages und über Mitternacht,
   manuell EIN/AUS, Automatik und Frostpriorität.
2. Heartbeat-Fixtures für gültiges/ungültiges Secret, Temperaturgrenzen und
   Istzustand.
3. Statischer Firmware-Sicherheitstest: GPIO21 vorhanden; CH1–CH4 blockiert;
   Bewässerungsbefehl bleibt erlaubt; keine Alt-Firmware als Build-Quelle.
4. Erst danach kleine, verhaltensgleiche Extraktion reiner Domainfunktionen.
