# GreenControl 2.x – Architektur- und Datenflusskarte

Stand: Phase 0.5. Beschreibt den vorhandenen Code und das jeweilige 2.x-Ziel.

## Systemübersicht

```text
Benutzer
  -> Next.js UI
  -> Server Components / Server Actions
  -> Supabase SSR Client
  -> PostgreSQL + RLS

Manager
  -> requireManager() + optional AAL2
  -> Supabase Service-Role Client
  -> PostgreSQL / Supabase Auth Admin

Waveshare
  -> POST /api/device/heartbeat
  -> Geräte-Secret-Prüfung
  -> PostgreSQL
  <- berechnete Zielzustände

Supabase Cron
  -> POST /api/alerts/check
  -> Warnzustände
  -> SMTP
```

## A. Bewässerung manuell EIN

```text
Button „Starten“
 -> toggleWatering(greenhouseId, true)
 -> Session + greenhouse_users prüfen
 -> Frostzustand lesen
 -> watering_target=true, watering_manual_override=true
 -> nächster Geräte-Heartbeat
 -> Frostpriorität erneut prüfen
 -> commands.watering_target=true
 -> GCSafetyController::applyCloudCommands()
 -> setWatering(true)
 -> GCRelayBoard::set(konfigurierter Kanal, true)
 -> nächster Heartbeat meldet watering_on=true
 -> greenhouses + sensor_readings aktualisieren
 -> revalidierte/periodisch aktualisierte UI zeigt Istzustand
```

| Schritt | Datei/Funktion | Datenbank | Sicherheitsprüfung | Fehlerfall | Ziel in 2.x |
|---|---|---|---|---|---|
| Button | `app/greenhouses/[id]/page.tsx` | liest Gewächshaus | Seite prüft Mitgliedschaft | nicht zugewiesen → 404 | Capability-basierte UI |
| Action | `toggleWatering()` | — | Supabase-Session | keine Session | Command Service |
| Zugriff | `authorizedClient()` | `greenhouse_users.role` | Mitglied; Viewer gesperrt | keine Mitgliedschaft | Tenant + Einzelrecht |
| Frostcheck | `toggleWatering()` | `greenhouses.temperature,status` | serverseitig | Frost → Abbruch | zentrale Safety Policy |
| Sollwert | `toggleWatering()` | `watering_target=true`, `watering_manual_override=true` | RLS zusätzlich aktiv | DB-Fehler | versionierter Command |
| Abholung | Heartbeat-Route | `devices`, `greenhouses` | ID, Secret, aktiv | 401/500 | signierter, idempotenter Befehl |
| Priorität | Heartbeat-Route | Temperatur/Status | Frost vor manuell | Sensor fehlt: keine Frostsperre | Safety Engine mit Qualitätsstatus |
| Antwort | Heartbeat-Route | — | autorisiertes Gerät | Transportfehler | Command-ID und Ablaufzeit |
| Relais | `GCSafetyController::setWatering()` | — | lokale Frostsperre | Relaisboard fehlt/blockiert | Komponenten-Runtime |
| Ausgang | `GCRelayBoard::set()` | — | globale Ausgangsfreigabe | I²C-Schreibfehler | bestätigtes Hardware-ACK |
| Istzustand | `GCCloudClient::sendHeartbeat()` | `greenhouses.watering_on`, `sensor_readings.watering_on` | Geräteauth | Antwort/Netzwerkfehler | getrennte desired/reported states |
| UI | Revalidation + Auto-Refresh | liest `watering_on` | Mitgliedschaft/RLS | veraltete Anzeige | Event/Query invalidation |
| Warnung/Audit | aktuell keiner für Schaltvorgang | keine | — | fehlende Nachvollziehbarkeit | Pflicht-Audit und Aktorwarnungen |

## B. Bewässerung automatisch über Zeitplan

```text
Owner/Operator speichert Zeitplan
 -> watering_schedule
 -> „Automatisch“ setzt watering_manual_override=false
    und watering_target=false
 -> Heartbeat liest aktive Zeitpläne
 -> Serverzeit Europe/Zurich
 -> Tages- oder Mitternachtsintervall prüfen
 -> Frostpriorität
 -> Ziel an Firmware
 -> Relais schalten
 -> Istzustand im Folge-Heartbeat
```

| Schritt | Datei/Funktion | Datenbank | Sicherheitsprüfung | Fehlerfall | Ziel in 2.x |
|---|---|---|---|---|---|
| Anlegen | `addSchedule()` | Insert `watering_schedule` | Mitglied, nicht Viewer | DB-/RLS-Fehler | Schedule Service |
| Ändern | `updateSchedule()` | Start, Dauer, enabled | ID plus greenhouse_id | schwache Zeitformatprüfung | Schema + Domainvalidierung |
| Löschen | `deleteSchedule()` | Delete | Mitglied, nicht Viewer | DB-Fehler | Audit + Soft Delete/Version |
| Automatik | `enableAutomatic(...,"watering")` | Override false, Ziel false | Mitglied, nicht Viewer | kein Geräte-ACK | Safe transition state machine |
| Zeitzone | Heartbeat-Helfer | keine | Server kontrolliert | fest auf Zürich | Standortzeitzone |
| Tagesfenster | `isScheduleCurrentlyActive()` | liest aktive Einträge | Geräteauth | ungültige Zeit → inaktiv | geprüfte Rule Engine |
| Mitternacht | gleiche Funktion | Dauer über 24:00 | — | Dauer ≥24h immer aktiv | explizite normalisierte Intervalle |
| Frost | Heartbeat | Temperatur/Status | höchste Priorität | fehlender Sensorwert | Fail-safe Policy definieren |
| Istzustand | Firmware + Folgeheartbeat | `watering_on` | lokale Freigabe | verlorene Rückmeldung | Command-Ack + reported state |

Wochentage, frei wählbare Zeitzonen, Mindestpause, maximale Laufzeit und
Druck-/Wasserstandsverriegelung fehlen.

## C. Temperaturmessung

```text
DS18B20 DATA an GPIO21
 -> GCTemperatureService::readCelsius()
 -> Bereich aus geheimer Konfiguration validieren
 -> GCSafetyController::setTemperature()
 -> lokale Frostsperre
 -> Heartbeat temperature
 -> API validiert −50 < t < 80
 -> greenhouses.temperature + sensor_readings
 -> Dashboard/Gewächshaus/History
```

| Schritt | Datei/Funktion | Datenbank | Sicherheitsprüfung | Fehlerfall | Ziel in 2.x |
|---|---|---|---|---|---|
| Hardware | `GCTemperatureService` | — | GPIO21 fest im Code | kein Sensor | Hardware Binding |
| Intervall | Firmware-Hauptschleife | — | Konstante in `GCConfig.h` | gemäß Vorgabe unbekannt | versionierte Telemetriepolicy |
| Lesen | `readCelsius()` | — | Dallas-Fehler + Grenzwerte | `NAN` | Qualität/Fehlercode mitsenden |
| Lokal | `setTemperature()` | — | Frostschwelle | bei `NAN` keine neue Sperre | definierter Sensorfehler-Fallback |
| Heartbeat | `sendHeartbeat()` | — | `null` bei `NAN` | Netzwerkfehler | gepufferte Messwerte |
| API | Heartbeat-Route | `greenhouses`, `sensor_readings` | Geräteauth + Bereich | außerhalb Bereich → `null` | Plugin-Schema |
| Anzeige | Dashboard/Detail/History | liest Temperatur | Mitglied/RLS | offline/fehlend teilweise unterschiedlich | einheitlicher Quality State |
| Offline | Zeitvergleich zu `last_seen` | — | UI-Logik | Grenzwerte 3/5 Minuten verschieden | zentraler Device Presence Service |

## D. Fenstersteuerung

Die vorhandene Fensterlogik gilt nicht als funktionierende Referenz. Sie bleibt
bis zur Neuimplementierung deaktiviert. Die folgende Zielarchitektur ist eine
bewusste Neuentwicklung.

```text
Web-App setzt weiterhin Dach-/Wand-Ziel
 -> Heartbeat liefert Ziele weiterhin
 -> aktuelle Firmware ignoriert sie
 -> moveRoof()/moveWall() stoppen
 -> RelayBoard blockiert CH1–CH4 für EIN
 -> beide Richtungen bleiben AUS
```

| Schritt | Datei/Funktion | Datenbank | Sicherheitsprüfung | Fehlerfall | Ziel in 2.x |
|---|---|---|---|---|---|
| UI | Detailseite | Fensterfelder | Mitglied | vermittelt fälschlich Bedienbarkeit | disabled-Komponente klar anzeigen |
| Sollwert | `toggleRoofWindow`, `toggleWallWindow` | Targets + Overrides | nicht Viewer | kein Audit/kein Geräte-ACK | Window Command Service |
| Automatikwerte | `updateGreenhouseSettings()` | Öffnen/Schließen | `open > close` | keine Hardwarefreigabe | Component Settings |
| API | Heartbeat | liest/liefert Targets | Geräteauth | Ziel trotz deaktiviertem Aktor | nur enabled Components ausgeben |
| Firmware | `applyCloudCommands()` | — | Fensterbefehle ignoriert | — | generische enabled-Prüfung |
| Ausgang | `GCRelayBoard::permitted()` | — | CH1–CH4 blockiert | — | Hardware Policy |
| Endschalter | `GCInputService`, `update()` | — | stoppt passende Richtung | Verdrahtung unbekannt | getestete Bindings |
| Laufzeit | `GCSafetyController::update()` | — | Maximalzeit vorgesehen | Timer wird bei deaktivierten Moves nie gesetzt | generische Motor-State-Machine |
| Not-Aus | `update()` | — | beide Richtungen → Stopp | nur Softwarezustand geprüft | Hardwareverriegelung + E-Stop |

Spätere Aktivierung erfordert getrennte Komponenten für Dach und Wand,
Öffnen-/Schließen-Kanäle, aktive Logik, beide Endschalter, maximale Laufzeit,
Richtungswechselpause, elektrische Verriegelung, Not-Aus, Timeout, Sensorfehler-
Fallback und bestandenen lastfreien Test.

### Manueller Modus

```text
Benutzer: ÖFFNEN / STOPPEN / SCHLIESSEN
 -> Permission + Komponentenstatus prüfen
 -> Wetter und Temperatur ausdrücklich nicht auswerten
 -> lokale Safety anwenden
 -> Motor fahren oder stoppen
 -> Ergebnis und Istzustand melden
```

Im manuellen Modus sind Wetter- und Temperatureingriffe verboten. Der Modus
dient Wartung, Reparatur und Test. Aktiv bleiben ausschließlich Endschalter,
Laufzeitlimit, Not-Aus und Relaisverriegelung.

### Automatikmodus

```text
Not-Aus/Fehler?
 -> ja: STOPP + FAULT
 -> nein: Regen/Schnee/Wind erfordern Schließen?
          -> ja: SCHLIESSEN
          -> nein: Temperatur >= Öffnungstemperatur?
                   -> ÖFFNEN
                   Temperatur <= Schließungstemperatur?
                   -> SCHLIESSEN
                   sonst
                   -> Zustand halten
```

Priorität ist verbindlich:

1. Not-Aus/Fehler
2. Wetter
3. Temperatur

### Sicherer Bewegungsablauf

```text
ÖFFNEN gewünscht
 -> enabled + Safety Configuration prüfen
 -> Schließen AUS
 -> Richtungswechselpause
 -> Öffnen EIN
 -> Endschalter ODER Timeout ODER Not-Aus ODER Kommunikationsverlust
 -> beide Relais AUS
 -> Istzustand + Grund melden
```

Für Schließen gilt der spiegelbildliche Ablauf.

### Dachfenster

Endschalter beenden die Fahrt regulär. Separate maximale Öffnungs- und
Schließzeiten sind zusätzliche Grenzen. Wird die Endlage nicht erreicht:
Motor AUS, Fehlerzustand und Warnung.

### Fensterwand

Die Fahrt erfolgt zunächst zeitbasiert. Optional ergänzte Sensoren dürfen die
Fahrt beenden; die Zeit bleibt immer Sicherheitsgrenze.

## E. Login

```text
Loginformular -> signInWithPassword()
 -> Supabase Session-Cookies
 -> Proxy auth.getUser()
 -> Profil + is_active
 -> Systemrolle
 -> sensible Aktion: AAL2 prüfen
```

| Schritt | Datei/Funktion | Datenbank/Auth | Sicherheitsprüfung | Fehlerfall | Ziel in 2.x |
|---|---|---|---|---|---|
| Login | `app/login/actions.ts:login` | Supabase Auth | Providerprüfung | konkreter Providerfehler | generischer Fehler + Rate Limit |
| Session | Supabase SSR Clients + `proxy.ts` | Auth-Cookies | `getUser()` | API generell vom Proxy ausgenommen | eigener Session Service |
| Profil | `getCurrentIdentity()` | `profiles` via Service Role | `is_active` | erst nach Auth geprüft | Sperre Teil der Auth |
| Rolle | `requireManager()` | `system_role` | admin/owner | globale statt tenantgebundene Rolle | Permissions |
| MFA | MFA-Client + AAL2 | Supabase Factors | sensible Manageraktion | keine Recovery-Codes im Code | TOTP + Recovery |
| Reset | `resetPasswordForEmail`, Confirm, Update | Supabase Auth | Link/Session | Account Enumeration möglich | gehashter Einmaltoken |
| Einladung | `inviteUserByEmail()` | Auth + Profile + Memberships | Manager + AAL2 | Teiloperationen nicht atomar | transaktionaler Workflow |
| Logout | `auth-actions.ts` | Supabase Auth | Session | — | Session-Widerruf |
| Widerruf | `admin.auth.admin.signOut(...,"global")` | Supabase Auth | Manager + AAL2 | Providerabhängigkeit | eigene Sessiontabelle |

## F. Geräte

```text
Manager + AAL2
 -> zufälliges 32-Byte-Secret
 -> SHA-256-Hash in devices
 -> Klartext einmal anzeigen
 -> Firmware konfiguriert
 -> Heartbeat prüft ID/Secret
```

| Schritt | Datei/Funktion | Datenbank | Sicherheitsprüfung | Fehlerfall | Ziel in 2.x |
|---|---|---|---|---|---|
| Registrierung | `registerDevice()` | Insert `devices` | Manager + AAL2 | keine Tenantprüfung | Onboarding Service |
| Secret | `randomBytes(32)` | nur Hash gespeichert | kryptografischer Zufall | Klartext in URL-Query | einmalige sichere Anzeige |
| Hash | `hashSecret()` | `secret_hash` | SHA-256 | kein Pepper/Keyed Hash | HMAC/geeignete Secret Policy |
| Auth | Heartbeat `equalSecret()` | liest Gerät | timing-safe | kein Replay-Schutz | signierte Requests/Nonce |
| Rotation | `rotateDeviceSecret()` | Hash ersetzen | Manager + AAL2 | sofortiger Cutover | überlappende Rotation |
| Aktivstatus | `toggleDevice()` | `active` | Manager + AAL2 | keine Tenantbindung | Tenant Permission |
| Löschen | `deleteDevice()` | Hard Delete | Manager + AAL2 | Historienbezug/Recovery | Decommission State |
| Online | UI vergleicht `last_seen` | `devices`/`greenhouses` | Manager bzw. Mitglied | verschiedene Schwellen | Presence Service |

## G. Warnungen

```text
Cron -> Bearer-geschützte Route
 -> überwachte Gewächshäuser
 -> offline/frost/critical berechnen
 -> alert_states mit Vorzustand vergleichen
 -> nur bei Zustandswechsel
 -> Benutzerpräferenzen
 -> SMTP
 -> email_notification_log
 -> bei Auflösung Entwarnung
```

| Schritt | Datei/Funktion | Datenbank | Sicherheitsprüfung | Fehlerfall | Ziel in 2.x |
|---|---|---|---|---|---|
| Auslösung | externer Cron | — | Bearer | eingebetteter Wert im Template | Scheduler Identity |
| Erkennung | `candidates()` | `greenhouses` | Service Role | globale Abfrage | tenantgebundener Alert Service |
| Zustand | Alert-Route | `alert_states` | interne Route | DB-Fehler stoppt Lauf | robuste Queue |
| Präferenz | `notification_settings` | pro Benutzer | RLS in UI | nicht greenhouse-/tenantbezogen | Subscription Model |
| Versand | `sendAlertEmail()` | — | SMTP-Env | pro Empfänger abgefangen | Provider Adapter/Retry |
| Protokoll | Route | `email_notification_log` | Service Role | Logfehler nicht geprüft | Delivery Events |
| Entwarnung | Zustandswechsel aktiv → inaktiv | gleiche Tabellen | — | keine Quittierung | Alert Lifecycle |
| Audit | kein `audit_logs`-Eintrag | — | — | Sicherheitslücke | Alert-/Ack-Audit |

## H. Audit-Log

Vorhandene Aktionen:

- `user.invited`
- `user.access_updated`
- `user.invitation_resent`
- `user.sessions_revoked`
- `device.registered`
- `device.secret_rotated`
- `device.enabled`
- `device.disabled`
- `device.deleted`

Gespeicherte Felder:

`actor_user_id`, `action`, `entity_type`, `entity_id`, `greenhouse_id`,
`old_value`, `new_value`, `metadata`, `created_at`.

| Bereich | Heute protokolliert? | Fehlend |
|---|---:|---|
| Benutzer/Geräte | teilweise | fehlgeschlagene Versuche, Reads |
| Login/MFA/Reset | nein | Erfolg, Fehler, Sperre, Enrollment, Recovery |
| Bewässerung/Fenster | nein | Sollwert, Quelle, Ergebnis, Override |
| Zeitpläne/Einstellungen | nein | Create/Update/Delete und Version |
| Warnungen | nur Mail-Log | Entstehung, Quittierung, Entwarnung |
| Firmware/OTA | nein | Version, Rollout, Health, Rollback |
| Backups | nein | Export, Restore, Prüfung |
| Master-/Tenantzugriff | nicht vorhanden | Impersonation und Cross-Tenant-Admin |

Ziel ist ein verpflichtender Audit Service. Ein nicht speicherbarer
sicherheitskritischer Audit-Eintrag muss die zugehörige Mutation je nach
Risikoklasse verhindern oder zuverlässig nachliefern.

## Verbindliche Regression-Grenze

Nur diese Abläufe sind Regression-Baseline:

- DS18B20-Messung an GPIO21
- Temperaturanzeige
- manuelle Bewässerung
- Bewässerungszeitpläne einschließlich Mitternachtswechsel
- Frostschutz
- Heartbeat
- Rückmeldung des tatsächlichen Bewässerungszustands

Insbesondere Fenster, Login, Warnungen und Administration werden zwar
inventarisiert, aber nicht als nachweislich funktionierende Referenz eingestuft.
