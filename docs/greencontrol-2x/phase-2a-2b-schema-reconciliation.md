# Phase 2A.2b – Abgleich des Produktionsschemas

Status: abgeschlossen am 30. Juli 2026. Analyse einer lokal
bereitgestellten Referenzdatei; keine Datenbankverbindung und keine
SQL-Ausführung.

## Umfang und Nachweis

Referenz:

- Datei: `greencontrol-schema-only.sql`
- Quelle: außerhalb des Entwicklungsrepositorys
- Größe: 28.910 Bytes / 1.011 Zeilen
- SHA-256:
  `E1BD8BD9207A3F19FDDE3C772F33C4047348F2A2A89CE4B698963E0904546073`
- Server: PostgreSQL 17.6
- Exportwerkzeug: `pg_dump` 17.10
- Exportumfang: Schema `public`, Plain SQL, ohne Owner und Privilegien

Der Vergleich umfasst:

- den vollständigen Inhalt des bereitgestellten `public`-Exports,
- alle SQL-Dateien unter `supabase/`,
- den Forward- und Rollback-Draft aus Block 2A.1,
- die im Anwendungscode verwendeten Tabellen und Felder.

Nicht prüfbar sind aufgrund der freigegebenen Exportparameter:

- Objekte und Trigger außerhalb von `public`, insbesondere Trigger auf
  `auth.users`,
- Rollen, Grants und ACLs, weil der Export mit `--no-privileges` erstellt
  wurde,
- Dateninhalt, Zeilenzahlen und Datenqualität,
- Supabase-Systemschemas wie `auth`, `storage`, `vault` und `realtime`.

## Schema-only-Verifikation

Das Gate ist bestanden.

- keine `COPY`-Anweisung,
- kein `COPY ... FROM stdin`,
- keine pg_dump-Sektion `Data for Name`,
- keine Rollen- oder Benutzeranlage,
- kein `\connect`,
- keine erkennbare Passwort-, API-Key- oder Secret-Zuweisung,
- vollständige Start- und Abschlussmarkierung von `pg_dump`.

Die drei gefundenen `INSERT`-Anweisungen liegen innerhalb von
Triggerfunktionen. Sie beschreiben zukünftiges Laufzeitverhalten und sind
keine exportierten Tabellenzeilen.

## Produktionsinventar

### Tabellen und Spalten

| Tabelle | Produktionsspalten | Schlüssel / Checks |
| --- | --- | --- |
| `alert_states` | `source_type`, `source_id`, `alert_type`, `active`, `activated_at`, `resolved_at`, `details`, `updated_at` | PK aus Quelle, ID und Alarmtyp; Check für `offline`, `frost`, `critical` |
| `audit_logs` | `id`, `actor_user_id`, `action`, `entity_type`, `entity_id`, `greenhouse_id`, `old_value`, `new_value`, `metadata`, `created_at` | PK `id` |
| `devices` | `id`, `greenhouse_id`, `name`, `secret_hash`, `active`, `firmware_version`, `last_seen`, `created_at`, `updated_at` | UUID-PK; Unique aus Gewächshaus und Name |
| `email_notification_log` | `id`, `user_id`, `greenhouse_id`, `warning_key`, `subject`, `status`, `provider_message_id`, `error_message`, `created_at`, `sent_at` | PK; Status-Check |
| `greenhouse_users` | `greenhouse_id`, `user_id`, `role`, `created_at` | zusammengesetzter PK; Rollen-Check |
| `greenhouses` | `id`, `created_at`, `name`, Dach-/Wand-Temperaturen, Auto-/Ist-/Ziel-/Override-Zustände, Warnfelder, Temperatur, Feuchte, Endschalter, `last_seen`, `monitoring_enabled` | PK `id` |
| `manual_commands` | `id`, `greenhouse_id`, `roof_window_command`, `wall_window_command`, `watering_command`, `auto_mode`, `created_at` | PK `id` |
| `notification_settings` | `user_id`, `enabled`, `recipient_email`, `notify_offline`, `notify_frost`, `notify_critical`, `updated_at`, `email_address`, `email_enabled`, `offline_alerts`, `frost_alerts`, `critical_alerts`, `created_at` | PK `user_id` |
| `profiles` | `id`, `full_name`, `email`, `created_at`, `system_role`, `is_active`, `mfa_required`, `updated_at` | PK; Rollen-Check |
| `sensor_readings` | `id`, `greenhouse_id`, `temperature`, `roof_window_open`, `wall_window_open`, `watering_on`, `created_at` | PK `id` |
| `warning_logs` | `id`, `greenhouse_id`, `message`, `priority`, `type`, `active`, `created_at`, `resolved_at` | PK `id` |
| `watering_schedule` | `id`, `greenhouse_id`, `start_time`, `duration_minutes`, `enabled`, `created_at` | PK `id` |
| `weather_station` | `id`, `rain`, `wind_speed`, `created_at`, `temperature`, `humidity`, `last_seen`, `wind_gust`, `pressure`, `wind_direction`, `status` | PK `id` |

Identitätsspalten bestehen für acht Bigint-Primärschlüssel. `devices.id`
verwendet `gen_random_uuid()`.

### Foreign Keys

Produktion enthält zehn Foreign Keys:

1. `audit_logs.actor_user_id -> auth.users.id` (`SET NULL`)
2. `audit_logs.greenhouse_id -> greenhouses.id` (`SET NULL`)
3. `devices.greenhouse_id -> greenhouses.id` (`CASCADE`)
4. `email_notification_log.greenhouse_id -> greenhouses.id` (`CASCADE`)
5. `email_notification_log.user_id -> auth.users.id` (`SET NULL`)
6. `greenhouse_users.greenhouse_id -> greenhouses.id` (`CASCADE`)
7. `greenhouse_users.user_id -> auth.users.id` (`CASCADE`)
8. `notification_settings.user_id -> auth.users.id` (`CASCADE`)
9. `profiles.id -> auth.users.id` (`CASCADE`)
10. `sensor_readings.greenhouse_id -> greenhouses.id` (`CASCADE`)

### Funktionen und Trigger

Funktionen:

- `assign_managers_to_new_greenhouse()`
- `handle_new_notification_settings()`
- `handle_new_user()`
- `is_system_manager()`
- `set_notification_settings_updated_at()`

Trigger auf Tabellen im Schema `public`:

- `assign_managers_after_greenhouse_insert` auf `greenhouses`
- `notification_settings_set_updated_at` auf `notification_settings`

Der Repository-Code definiert zusätzlich einen Trigger auf `auth.users`.
Seine produktive Existenz ist mit einem reinen `public`-Export nicht
nachweisbar.

### RLS und Policies

RLS ist auf zwölf Tabellen aktiv. `manual_commands` ist die einzige
Produktionstabelle ohne aktiviertes RLS.

Die 26 produktiven Policies decken ab:

- Mitglieder lesen Gewächshäuser, Zeitpläne, Sensorhistorie und Warnungen.
- Owner/Operator bearbeiten Gewächshaus, Zeitpläne und Warnungen.
- Benutzer lesen eigene Mitgliedschaften, Profile,
  Benachrichtigungseinstellungen und E-Mail-Logs.
- Benutzer ändern eigene Profile und Benachrichtigungseinstellungen.
- Manager lesen Geräte, Audit-Logs, Profile, Alarmzustände,
  Benachrichtigungseinstellungen und E-Mail-Logs.
- Manager verwalten Benachrichtigungseinstellungen.
- Authentifizierte Benutzer lesen Wetterdaten.

### Indizes

Zusätzlich zu den impliziten PK-/Unique-Indizes bestehen nur:

- `audit_logs_created_at_idx`
- `devices_greenhouse_id_idx`

## Abweichungen und Empfehlungen

### A01 – Unvollständige Basismigrationen

**Abweichung:** Für `greenhouses`, `manual_commands`, `warning_logs`,
`watering_schedule` und `weather_station` existiert im Repository keine
vollständige `CREATE TABLE`-Migration. `pfaff_greencontrol_v2.sql` ergänzt
lediglich Wetterspalten. Die Produktion ist deshalb nicht allein aus den
Repository-Migrationen reproduzierbar.

**Technische Begründung:** Eine neue Testdatenbank kann aus dem Repository
nicht zuverlässig bis zum Produktionsstand aufgebaut werden.

**Empfehlung: Vereinfachen.** Nach dem Review eine einzige bereinigte
Baseline für den bestehenden Schema-Iststand erstellen; historische
Skripte nicht nachträglich zu einer scheinbaren linearen Historie umbauen.

### A02 – Doppelte Evolutionsskripte

**Abweichung:** `phase1_auth_multi_greenhouse.sql` und
`pfaff_greencontrol_v2.sql` definieren dieselben Tabellen, Policies,
Funktion und Auth-Trigger in unterschiedlichen Entwicklungsständen.
`notification_settings.sql` verändert `profiles` und dieselben Policies
erneut.

**Technische Begründung:** Reihenfolgeabhängige `CREATE POLICY`- und
Funktionsdefinitionen erschweren reproduzierbare Neuinstallationen.

**Empfehlung: Vereinfachen.** Bestehende Dateien als historische Quellen
beibehalten, für Testaufbau später aber eine eindeutig geordnete Baseline
und danach lineare Migrationen verwenden.

### A03 – Nicht dokumentierte Legacy-Spalten in `notification_settings`

**Abweichung:** Produktion enthält parallel die alten Felder
`enabled`, `recipient_email`, `notify_offline`, `notify_frost`,
`notify_critical` und die neueren App-Felder `email_address`,
`email_enabled`, `offline_alerts`, `frost_alerts`, `critical_alerts`.
Die vollständige Doppelstruktur wird in keiner Repository-Datei erzeugt.

**Technische Begründung:** Zwei Feldgruppen repräsentieren dieselbe
fachliche Einstellung und können auseinanderlaufen.

**Empfehlung: Vereinfachen.** In 2A.2b nichts entfernen. Später Nutzung
ermitteln, einen kanonischen Satz bestimmen, kontrolliert übertragen und
Legacy-Felder erst nach Kompatibilitätstest abbauen.

### A04 – Produktionsfunktion `handle_new_notification_settings()` fehlt

**Abweichung:** Die Funktion ist produktiv vorhanden, aber in keiner
Repository-SQL-Datei definiert.

**Technische Begründung:** Ihr Verhalten kann aus dem Repository nicht
reproduziert oder versioniert überprüft werden.

**Empfehlung: Beibehalten.** Zunächst unverändert in eine spätere
Ist-Baseline aufnehmen; ihre Verwendung und der zugehörige Auth-Trigger
müssen mit einem separat freigegebenen Auth-Schema-Nachweis geprüft werden.

### A05 – Produktionsfunktion und Trigger zur Managerzuweisung fehlen

**Abweichung:** `assign_managers_to_new_greenhouse()` und
`assign_managers_after_greenhouse_insert` existieren nur in Produktion.
Sie weisen globale Manager automatisch jedem neuen Gewächshaus zu.

**Technische Begründung:** Das Verhalten widerspricht langfristig einer
strikten Organisationszuordnung, ist aber Teil des aktuellen
Kompatibilitätsmodells.

**Empfehlung: Verwerfen.** Nicht sofort löschen. Für den späteren
Multi-Tenant-Pfad durch explizite Organisationsmitgliedschaften ersetzen
und erst nach Pilot- und Regressionstest kontrolliert deaktivieren.

### A06 – Updated-at-Trigger ist nicht versioniert

**Abweichung:** `set_notification_settings_updated_at()` und
`notification_settings_set_updated_at` existieren in Produktion, fehlen
aber im Repository.

**Technische Begründung:** Ohne Trigger kann `updated_at` bei direkten
Updates veralten; ein Neuaufbau verhält sich anders als Produktion.

**Empfehlung: Beibehalten.** Unverändert in eine spätere Ist-Baseline
übernehmen und das Muster später konsistent auf tatsächlich benötigte
Tabellen anwenden.

### A07 – `handle_new_user()` weicht vom Repository ab

**Abweichung:** Die Produktionsfunktion setzt beim Anlegen eines Profils
zusätzlich eine Systemrolle anhand fest eingebauter Benutzeridentitäten
und aktualisiert bei Konflikten Name und E-Mail. Die im Repository
vorhandenen Varianten haben abweichende Spalten und Konfliktlogik.

**Technische Begründung:** Produktionsverhalten ist
identitätsgebunden, reihenfolgeabhängig und nicht aus dem aktuellen
Repository reproduzierbar.

**Empfehlung: Verwerfen.** Die automatische Profilanlage beibehalten,
aber die identitätsbasierte Rollenzuweisung später durch einen expliziten,
getesteten Administrationspfad ersetzen. Keine Änderung vor Pilot- und
Auth-Review.

### A08 – Zwei DELETE-Policies fehlen im Repository

**Abweichung:** Produktion enthält zusätzlich
`users delete own notification settings` und
`managers delete all notification settings`. Die übrigen 24
Policy-Namen stimmen mit dem kumulierten Repositorybestand überein.

**Technische Begründung:** Neuaufbau aus Repository-SQL hätte andere
Löschberechtigungen als Produktion.

**Empfehlung: Vereinfachen.** Vor Übernahme klären, ob physisches Löschen
fachlich erforderlich ist. Vorzugsweise Einstellungen zurücksetzen oder
deaktivieren, statt den Datensatz zu löschen.

### A09 – `manual_commands` ohne RLS und ohne Foreign Key

**Abweichung:** Die Tabelle besitzt weder RLS noch einen Foreign Key von
`greenhouse_id` auf `greenhouses`. Sie wird vom aktuellen App-Code nicht
verwendet.

**Technische Begründung:** Bei API-Freigabe wäre ein mandantenübergreifender
Zugriff möglich; verwaiste Gewächshausreferenzen sind zulässig.

**Empfehlung: Verwerfen.** Als Legacy-Objekt zunächst unangetastet lassen,
aber nicht in neue Apppfade integrieren. Nutzung vor einem späteren,
separat freigegebenen Rückbau nachweisen.

### A10 – Fehlende Foreign Keys für Zeitpläne und Warnungen

**Abweichung:** `watering_schedule.greenhouse_id` und
`warning_logs.greenhouse_id` besitzen produktiv keine Foreign Keys,
obwohl App und RLS-Policies die Beziehung voraussetzen.

**Technische Begründung:** Verwaiste Zeilen sind möglich und
Tenantzuordnung kann nicht allein durch Datenbankintegrität bewiesen
werden.

**Empfehlung: Beibehalten.** Die fachliche Beziehung beibehalten; nach
einem Datenqualitätscheck in einer späteren Migration echte Foreign Keys
ergänzen. Nicht ungeprüft im 2A.1-Draft hinzufügen.

### A11 – Wenige explizite Indizes auf Beziehungen

**Abweichung:** Mehrere produktive FK- und Filterspalten besitzen keinen
eigenen Index, darunter `greenhouse_users.user_id`,
`sensor_readings.greenhouse_id` und die Referenzen der E-Mail-Logs.

**Technische Begründung:** RLS-Unterabfragen und Historienabfragen können
mit wachsendem Datenbestand unnötig teuer werden.

**Empfehlung: Vereinfachen.** Nur durch reale Abfragepfade begründete
Indizes ergänzen; zuerst Tenant- und Sensorhistorienpfade messen, keine
pauschale Indexierung.

### A12 – Wetterdaten sind global lesbar

**Abweichung:** `weather_station` hat keine Gewächshaus-, Standort- oder
Organisationszuordnung. Die SELECT-Policy erlaubt allen
authentifizierten Benutzern alle Wetterzeilen.

**Technische Begründung:** Das aktuelle Einzelbetriebsmodell ist
funktionsfähig, aber nicht mandantenfähig.

**Empfehlung: Vereinfachen.** Während der additiven Migration
rückwärtskompatibel lassen; vor Aufnahme eines zweiten Betriebs eine
explizite Standortzuordnung und tenantgebundene Policy einführen.

### A13 – Globale Managerrechte bleiben außerhalb des Tenant Context

**Abweichung:** `is_system_manager()` und mehrere produktive Policies
verwenden nur `profiles.system_role`. Auch Service-Role-Pfade im aktuellen
Anwendungscode greifen noch ohne Organisationskontext auf Benutzerdaten
zu.

**Technische Begründung:** Das ist mit mehreren unabhängigen Betrieben
nicht ausreichend isoliert.

**Empfehlung: Verwerfen.** Nicht als Zielmodell weiterführen.
Übergangsweise für Kompatibilität beibehalten und schrittweise durch den
serverseitigen Tenant Context aus Block 2A ersetzen.

### A14 – Produktions-Check erlaubt kein `master_admin`

**Abweichung:** `profiles_system_role_check` erlaubt nur `admin`,
`owner`, `operator`, `viewer`. Der 2A.1-Draft prüft in
`is_platform_master()` zusätzlich auf `master_admin`, ändert den Check
aber absichtlich nicht.

**Technische Begründung:** Der zusätzliche Wert ist aktuell nicht
speicherbar; nur der Legacy-Wert `admin` kann den Plattformpfad nutzen.

**Empfehlung: Vereinfachen.** Für 2A zunächst `admin` als
Kompatibilitätswert verwenden. Eine Rollenumbenennung erst in einer
eigenen, getesteten Phase durchführen.

### A15 – Organisations- und Standortkonsistenz im Draft nicht erzwungen

**Abweichung:** Der 2A.1-Draft fügt `organization_id` und `site_id`
separat zu Gewächshäusern und Geräten hinzu. Foreign Keys beweisen nicht,
dass der gewählte Standort zur gleichen Organisation gehört.

**Technische Begründung:** Fehlerhafte Kombinationen könnten eine
Ressource gleichzeitig zwei Tenantpfaden zuordnen.

**Empfehlung: Beibehalten.** Das additive Grundmodell beibehalten, den
Forward-Draft aber erst nach Review um eine einfache, eindeutig testbare
Konsistenzregel ergänzen. Keine automatische Draftänderung in 2A.2b.

### A16 – Bestehende RLS-Policies verwenden neue Tenantspalten noch nicht

**Abweichung:** Der 2A.1-Draft schützt neue Organisationstabellen, ändert
aber absichtlich nicht die Policies von `greenhouses`, `devices`,
Zeitplänen, Messwerten und Warnungen.

**Technische Begründung:** Direkt nach der additiven Schemaänderung bleibt
die Legacy-Mitgliedschaft maßgeblich; vollständige Mandantentrennung ist
damit noch nicht abgeschlossen.

**Empfehlung: Beibehalten.** Das ist für die kleine,
rückwärtskompatible Migration richtig. Tenantfähige Apppfade dürfen erst
nach Backfill, Tenant-Context-Tests und einer separaten RLS-Phase
freigegeben werden.

### A17 – Export kann Auth-Trigger und Privilegien nicht bestätigen

**Abweichung:** Repository-SQL definiert mindestens einen Trigger auf
`auth.users` und Function-Grants. Der freigegebene Export enthält weder
das Schema `auth` noch Privilegien.

**Technische Begründung:** Ein vollständiger Vergleich dieser Objekte ist
mit `--schema=public --no-privileges` technisch unmöglich.

**Empfehlung: Beibehalten.** Den Produktionsschutz und den begrenzten
Exportumfang beibehalten. Vor Auth-Umbauten gezielt einen sicheren,
metadatenbasierten Nachweis der betroffenen Trigger und Grants erstellen;
für 2A.2c ist das nicht erforderlich.

### A18 – Sensitiver Platzhalter im Cron-Template

**Abweichung:** Das Repository enthält in
`schedule_alert_checker_TEMPLATE.sql` einen fest eingetragenen
Authorization-Wert. Dieses Cron-Objekt gehört wegen des reinen
`public`-Exports nicht zum Produktionsvergleich.

**Technische Begründung:** Selbst wenn der Wert nur ein historischer
Platzhalter ist, darf er nicht als vertrauenswürdig gelten oder in neue
Umgebungen übernommen werden.

**Empfehlung: Verwerfen.** Wert als kompromittiert behandeln und später
in einer separat freigegebenen Sicherheitskorrektur durch sichere lokale
Konfiguration ersetzen. In 2A.2b wird die Datei nicht verändert.

## Abgleich mit Block 2A.1

Durch den Export bestätigt:

- `auth.users.id` und `profiles.id` verwenden UUID.
- `profiles.id` referenziert `auth.users.id`.
- `greenhouses.id` ist Bigint.
- `devices.id` ist UUID.
- `devices.greenhouse_id` ist Bigint und referenziert `greenhouses.id`.
- `gen_random_uuid()` wird bereits produktiv verwendet.
- `greenhouses` besitzt noch kein `updated_at`.
- `devices` besitzt bereits `updated_at`.
- Keine der geplanten Tenanttabellen oder Tenantspalten existiert
  im Produktionsschema.
- Der bestehende Rollenwert für Plattformadministration lautet `admin`.

Der Forward- und Rollback-Draft wurden nicht verändert. Vor einer
Ausführung sind mindestens A14 und A15 zu entscheiden. A01 ist die
Voraussetzung für einen reproduzierbaren Aufbau der wegwerfbaren
Testinstanz.

## Abschlussbewertung

**🟢 Beibehalten**

- additiven Ansatz des 2A.1-Drafts,
- bestehende IDs und Legacy-Beziehungen,
- nullable Tenantspalten während Backfill und Kompatibilitätsphase,
- getrennte, wegwerfbare Testinstanz,
- bestehende Funktionen bis zu jeweils eigenen Regressionstests.

**🟡 Vereinfachen**

- eine kanonische Ist-Baseline statt mehrerer überlappender
  Installationsskripte,
- doppelte Benachrichtigungsspalten,
- Rollenbezeichnung während 2A zunächst bei `admin`,
- Indizes nur nach belegten Zugriffspfaden,
- Wetterdaten später einfach an Standort statt an technische
  Sondermodelle binden.

**🔴 Verwerfen**

- globale Managerzuweisung als langfristiges Tenantmodell,
- identitätsgebundene Rollenzuweisung in Triggerfunktionen,
- neue Nutzung der ungeschützten Legacy-Tabelle `manual_commands`,
- globale Manager-/Service-Role-Zugriffe als Zielarchitektur,
- fest eingetragene Authorization-Werte in SQL-Templates.

## Ergebnis und Gate für 2A.2c

Phase 2A.2b ist fachlich abgeschlossen. Das Produktionsschema ist nun
innerhalb des freigegebenen `public`-Umfangs vollständig inventarisiert
und mit Repository sowie Block 2A.1 abgeglichen.

Es wurden keine automatischen Korrekturen vorgenommen. Phase 2A.2c darf
erst nach Review dieses Berichts und ausdrücklicher Freigabe beginnen.
