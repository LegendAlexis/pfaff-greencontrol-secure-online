# GreenControl 2.x – Bestandsanalyse

Stand: 29. Juli 2026  
Phase: 0 – ausschließlich Analyse und Dokumentation

## Verbindliche Arbeitsbasis

- Entwicklungsordner: `C:\Users\alexi\Pfaff-GreenControl-2.x`
- Branch: `greencontrol-2x`
- Ausgangscommit: `c596bd2`
- Referenz: `C:\Users\alexi\pfaff-greencontrol-secure-online`
- Backup: `C:\Users\alexi\Pfaff-GreenControl-Backup-vor-Umbau`
- Aktuelle Firmware:
  `C:\Users\alexi\Pfaff_GreenControl_Firmware_v1_3_1_GPIO21_windows_off`

Referenz und Backup wurden nicht verändert. `.env.local` und `GCConfig.h`
wurden weder gelesen noch dokumentiert.

## Projektstruktur

```text
Pfaff-GreenControl-2.x/
├── app/                         Next.js App Router
│   ├── api/
│   │   ├── alerts/check/        geschützter Warnungs-Cron
│   │   └── device/heartbeat/    Geräte-Heartbeat und Befehlsantwort
│   ├── auth/confirm/            Supabase PKCE/OTP-Bestätigung
│   ├── dashboard/               Gewächshausübersicht
│   ├── devices/                 Geräteverwaltung
│   ├── greenhouses/[id]/        Steuerung und Zeitpläne
│   ├── history/                 Temperaturverlauf
│   ├── login/                   Login, Registrierung, Reset
│   ├── logs/                    Audit-Anzeige
│   ├── notifications/           Warnmail-Einstellungen
│   ├── security/mfa/            TOTP-MFA
│   ├── update-password/         Passwort setzen/ändern
│   ├── users/                   Benutzerverwaltung
│   └── weather/                 Wetterstationsansicht
├── lib/                         Auth, Supabase, Audit und Mail
├── public/                      Standard-SVGs; keine PWA-Artefakte
├── supabase/                    sechs manuelle SQL-Skripte/Templates
├── waveshare_greenhouse_frost_safe.ino
│                                veraltete monolithische Firmwarekopie
└── package.json                 Next.js 16.2.6, React 19.2.4

Separater Firmwareordner/
├── Pfaff_GreenControl_Firmware_v1_3_1_GPIO21_windows_off.ino
├── GCCloudClient.{h,cpp}
├── GCInputService.{h,cpp}
├── GCRelayBoard.{h,cpp}
├── GCSafetyController.{h,cpp}
├── GCTemperatureService.{h,cpp}
├── GCWifiService.{h,cpp}
├── GCConfig.h                   geheim; nicht gelesen
└── README_CHANGES.txt
```

## Verbindliche Regression-Baseline

Als funktionierende und bei jeder späteren Änderung zu bewahrende Baseline
gelten ausschließlich:

- Temperaturmessung über DS18B20 an GPIO21
- Temperaturanzeige
- manuelle Bewässerung
- Bewässerungszeitpläne
- Zeitpläne über Mitternacht
- Frostschutz
- Heartbeat
- Rückmeldung des tatsächlichen Bewässerungszustands

Andere im Code vorhandene Funktionen werden weiterhin inventarisiert und
gesichert behandelt, gelten aber nicht allein aufgrund ihres Vorhandenseins als
funktionierende Regression-Referenz.

Die Fenstersteuerung ist ausdrücklich **keine funktionierende Referenz**. Der
aktuelle deaktivierte Zustand ist nur eine Sicherheitsinvariante bis zur
späteren Neuimplementierung.

## Baseline-Prüfungen

- `npm run build`: erfolgreich; Next.js 16.2.6, TypeScript und 14 App-Routen
  wurden gebaut.
- `npm run lint`: fehlgeschlagen mit 8 Fehlern und 3 Warnungen.
- Unit-, Integrations- und E2E-Testskripte: nicht vorhanden.
- Firmware-Build und Hardwaretest: in Phase 0 nicht ausgeführt.

Lint-Befunde sind mehrere explizite `any`, `Date.now()` in
Server-Component-Renderpfaden, MFA-State-Updates aus einem Effect, ein
unbenutzter Parameter und ein unoptimiertes QR-Code-`img`.

## Firmwareentscheidung

Der eindeutige aktuelle funktionierende Firmwarestand ist der separate,
modulare Ordner:

`Pfaff_GreenControl_Firmware_v1_3_1_GPIO21_windows_off`

Begründung:

- expliziter Änderungsnachweis für DS18B20 an GPIO21
- Fensterkanäle CH1 bis CH4 werden am Relaisboard und im Safety Controller
  blockiert
- Bewässerungsbefehle werden über den aktuellen Geräte-Heartbeat verarbeitet
- modularisierte Dienste für Cloud, WLAN, Temperatur, Eingänge, Relais und
  Sicherheit
- entspricht dem vom Betreiber bestätigten funktionierenden Zustand

Die Datei `waveshare_greenhouse_frost_safe.ino` im Web-App-Projekt ist
**veraltet, widersprüchlich und nicht als Flash-Quelle zu verwenden**:

- monolithisch und direkt an Supabase REST gekoppelt
- enthält fest eingetragene Zugangsdaten; sie werden hier nicht wiedergegeben
- deaktiviert Fenster nicht, sondern kann Dach und Wand ansteuern
- nutzt eine abweichende Relaiszuordnung
- besitzt keine Geräte-ID-/Secret-Authentifizierung am Heartbeat
- verwendet unsichere TLS-Zertifikatsprüfung
- berechnet Zeitpläne lokal und behandelt Mitternachtswechsel nicht korrekt

Offene Inkonsistenz: Ordner und Hauptdatei nennen Version 1.3.1, die
Startausgabe nennt noch Version 1.2.0. Der Wert in `GCConfig.h` wurde gemäß
Vorgabe nicht gelesen.

## Datenbanktabellen

Aus den SQL-Dateien eindeutig definiert:

| Tabelle | Zweck |
|---|---|
| `profiles` | Auth-Profil, Systemrolle, Aktivstatus, MFA-Pflicht |
| `greenhouse_users` | Benutzer–Gewächshaus-Zuordnung und lokale Rolle |
| `sensor_readings` | Temperatur sowie Fenster-/Bewässerungs-Istzustände |
| `notification_settings` | persönliche Warnmail-Einstellungen |
| `email_notification_log` | Versandstatus von Warnmails |
| `alert_states` | aktiver/aufgelöster Warnzustand |
| `audit_logs` | sicherheitsrelevante Änderungen |
| `devices` | Gerät, Gewächshaus, Secret-Hash, Status und Firmwareversion |

Vom Code und den SQL-Änderungen vorausgesetzt, aber im Repository nicht mit
vollständigem `CREATE TABLE` definiert:

| Tabelle | Verwendete Felder / Zweck |
|---|---|
| `greenhouses` | Name, Temperatur, Status, Heartbeat, Soll-/Istzustände, Overrides, Grenzwerte, Warnung, Monitoring |
| `watering_schedule` | Gewächshaus, Startzeit, Dauer, Aktivstatus |
| `warning_logs` | Warnhistorie je Gewächshaus |
| `weather_station` | Wetterwerte, Status und Heartbeat |

Der reale produktive Schemazustand wurde nicht abgefragt, weil dies Zugang zu
Secrets bzw. einem externen Produktivsystem erfordern würde.

## API-Routen

| Methode und Route | Aufgabe | Schutz |
|---|---|---|
| `POST /api/device/heartbeat` | Geräteauth, Zustand speichern, Zeitplan/Frost auswerten, Befehle liefern | Geräte-ID und Secret |
| `POST /api/alerts/check` | Warnzustände prüfen, Zustandswechsel mailen und protokollieren | Bearer-Cron-Secret |
| `GET /auth/confirm` | PKCE-Code oder OTP-Hash bestätigen | Einmalcode/-token |

Weitere Mutationen laufen als Next.js Server Actions: Login, Signup, Reset,
Logout, Passwortänderung, Steuerung, Zeitpläne, Benachrichtigungen,
Benutzerverwaltung und Geräteverwaltung.

## Bewässerungs- und Fensterlogik

Bewässerung:

1. UI setzt `watering_target` und `watering_manual_override`.
2. Heartbeat liest aktive Zeitpläne, sofern kein manueller Override aktiv ist.
3. Zeitplan wird in `Europe/Zurich` einschließlich Mitternachtswechsel geprüft.
4. Frost hat Vorrang und erzwingt Ziel AUS.
5. Firmware wendet das Ziel über den Safety Controller an.
6. Firmware meldet den Istzustand zurück.

Es fehlen Wochentage, konfigurierbare Zeitzone, maximale Bewässerungslaufzeit,
Mindestpause, Druck-/Wasserstandsverriegelung und idempotente Befehle.

Fenster:

- Die Web-App kann weiterhin Sollwerte und Temperaturgrenzen setzen.
- Der Heartbeat liefert Dach-/Wandziele weiterhin aus.
- Nur die aktuelle modulare Firmware macht sie sicher wirkungslos:
  Cloudbefehle werden ignoriert, Bewegungsfunktionen stoppen und CH1–CH4 sind
  für EIN blockiert.
- Die alte `.ino` widerspricht diesem Sicherheitszustand und darf nicht
  geflasht werden.

Die spätere Fenstersteuerung wird nicht aus der bestehenden Logik
weiterentwickelt, sondern als neue, einfachere Komponentenarchitektur
implementiert. Dachfenster und Fensterwand werden getrennt konfiguriert und
getestet.

Pfaff Bio Kräuter ist als erster Pilotbetrieb vorgesehen. In Phase 0 wurde kein
produktiver Datensatz angelegt.
