# GreenControl 2.x – Offene Fragen und Empfehlungen

## Bereits aus dem Code beantwortet

| Frage | Antwort |
|---|---|
| Welche Web-App ist Basis? | `Pfaff-GreenControl-2.x`, Commit `c596bd2`, Branch `greencontrol-2x` |
| Welche Firmware ist aktuell? | separater modularer Ordner v1.3.1 GPIO21 windows off |
| Temperaturpin? | GPIO21 ist direkt in `GCTemperatureService.cpp` festgelegt |
| Sind Fenster deaktiviert? | ja; Befehle ignoriert und CH1–CH4 für EIN blockiert |
| Wo wird der Zeitplan ausgewertet? | serverseitig in der Heartbeat-Route |
| Zeitzone? | fest `Europe/Zurich` |
| Mitternachtswechsel? | in aktueller Heartbeat-Logik unterstützt |
| Geräteauthentifizierung? | UUID + Secret; SHA-256-Hash und timing-safe Vergleich |
| Pilot? | Pfaff Bio Kräuter, zunächst ein Standort und ein Gewächshaus |

## Noch offen

### 1. Bewässerungs-Relaiskanal

- Warum offen: Binding liegt wahrscheinlich in `GCConfig.h`, die nicht gelesen
  werden darf.
- Wo zu finden: Betreiberunterlagen, lastfreier Hardwaretest oder ausdrückliche
  Angabe.
- Optionen: nullbasierter Firmwarekanal oder physische CH-Nummer.
- Empfehlung: physische Beschriftung und Codewert gemeinsam dokumentieren,
  ohne Secrets aus der Konfigurationsdatei offenzulegen.

### 2. Tatsächlich geflashter Firmwarestand

- Warum offen: Firmwareordner besitzt kein Git und kein Geräteattest.
- Wo zu finden: serielle Bootmeldung, Heartbeat-Feld `firmware_version`,
  Flash-Protokoll.
- Optionen: modularer 1.3.1-Stand oder abweichender lokaler Build.
- Empfehlung: auf dem Gerät nur Version/Build-ID auslesen, noch nicht flashen.

### 3. Firmware-Buildumgebung

- Warum offen: kein PlatformIO-Projekt, Lockfile oder Bibliotheksmanifest.
- Wo zu finden: Arduino IDE, Board Manager und installierte Libraries.
- Empfehlung: exakte Board-, Core- und Bibliotheksversionen vom funktionierenden
  Rechner erfassen und danach reproduzierbaren Build einrichten.

### 4. Versionswiderspruch 1.3.1/1.2.0

- Warum offen: Hauptdatei meldet 1.2.0; Ordner nennt 1.3.1; Konfigurationswert
  ist tabu.
- Empfehlung: zunächst als „1.3.1-Kandidat mit falschem Banner“ behandeln und
  erst nach Geräte-/Buildnachweis korrigieren.

### 5. Secret-Rotation

- Warum offen: Rotation ist externer Zustand und darf nicht aus Secretdateien
  abgeleitet werden.
- Wo zu prüfen: WLAN-Router, Supabase/Vercel, Cron/Vault.
- Empfehlung: alle in Legacy-Quellen oder Templates enthaltenen Werte rotieren
  und Rotation ohne Werte protokollieren.

### 6. Produktives Datenbankschema

- Warum offen: SQL-Dateien setzen vier Basistabellen voraus und bilden keine
  lückenlose Migration.
- Wo zu finden: sicherer Schema-only-Export aus PostgreSQL/Supabase.
- Empfehlung: Export ohne Daten und ohne Secrets bereitstellen; keine
  Migration ausführen.

### 7. Produktive Domain und Offline-Schwellen

- Warum offen: Dokumentation nennt verschiedene Domains; UI nutzt je Ansicht
  3 oder 5 Minuten.
- Empfehlung: kanonische Domain festlegen und eine zentrale Presence Policy
  mit vorgeschlagenen 5 Minuten plus „degraded“-Vorstufe definieren.

### 8. Testgerät

- Warum offen: keine eindeutige Gerätebezeichnung oder Seriennummer vorhanden.
- Empfehlung: ein Waveshare physisch kennzeichnen und ausdrücklich als
  lastfreies Pilot-Testgerät freigeben.

### 9. Standortmodell Pfaff Bio Kräuter

- Vorgabe beantwortet den Pilot: zunächst ein Standort.
- Offen bleibt, ob langfristig weitere Standorte geplant sind.
- Empfehlung: Datenmodell sofort mehrstandortfähig bauen, im Pilot aber nur
  einen Standort anlegen.

### 10. Sensorfehler bei Frost

- Warum offen: aktuelle Logik sperrt bei `NAN` nicht zwingend neu.
- Optionen: Bewässerung immer sperren; nur laufende Bewässerung stoppen;
  begrenzte Fortsetzung mit letztem gültigem Messwert.
- Empfehlung: bei fehlendem vertrauenswürdigem Frostwert Bewässerungsstart
  sperren und laufende Bewässerung sicher stoppen, bis fachlich bestätigt.

