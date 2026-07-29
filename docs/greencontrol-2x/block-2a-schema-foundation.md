# Block 2A – Schemafundament und Migrationssicherheit

Status: Phase 2A.1, Entwurf. Keine Migration wurde ausgeführt.

## Zweck und Grenze

Dieser Entwurf führt Organisationen, Standorte und
Organisationsmitgliedschaften additiv ein. Bestehende Gewächshaus-,
Geräte-, Zeitplan-, Messwert- und Benutzerbeziehungen bleiben erhalten.

Die SQL-Dateien unter `supabase/migration-drafts/` sind nicht für Produktion
freigegeben. Vor jeder Ausführung sind zwingend erforderlich:

1. sicherer Schema-only-Export des tatsächlichen Supabase-Schemas,
2. Abgleich aller Tabellen, Spalten, Typen, Constraints, Trigger und Policies,
3. isolierte lokale oder getrennte Testdatenbank,
4. erfolgreiche Vorher-/Nachher- und Rollbacktests,
5. separate Freigabe einer späteren ausführbaren Migration.

## Bekannte Bestandsobjekte

Im Repository eindeutig definiert oder verwendet:

- `profiles`
- `greenhouse_users`
- `sensor_readings`
- `notification_settings`
- `email_notification_log`
- `alert_states`
- `audit_logs`
- `devices`

Verwendet, aber im Repository nicht vollständig mit ihrem aktuellen
`CREATE TABLE` dokumentiert:

- `greenhouses`
- `watering_schedule`
- `warning_logs`
- `weather_station`

## Markierte Annahmen

Der Draft nimmt vorläufig an:

- `auth.users.id` ist `uuid`.
- `profiles.id` referenziert `auth.users.id`.
- `greenhouses` und `devices` existieren bereits.
- `devices.greenhouse_id` bleibt unverändert.
- Supabase stellt `gen_random_uuid()` bereit.
- die Legacy-Systemrolle `admin` bleibt während des Übergangs bestehen.

Nicht angenommen werden:

- der Primärschlüsseltyp von `greenhouses`,
- der Primärschlüsseltyp von `devices`,
- vollständige produktive RLS-Policies,
- vorhandene Trigger für `updated_at`,
- eine bereits vorhandene Tenantzuordnung.

## Additives Zielmodell

### `organizations`

- neuer UUID-Primärschlüssel
- `name` und eindeutiger `slug`
- `deployment_stage`: `pilot` oder `production`
- `lifecycle_status`: `active` oder `archived`
- `created_at` und `updated_at`

### `sites`

- neuer UUID-Primärschlüssel
- verpflichtende `organization_id`
- Name, organisationsweit eindeutiger Slug und Zeitzone
- Pilot-/Produktivstatus und Aktiv-/Archivstatus
- `created_at` und `updated_at`

### `organization_members`

- zusammengesetzter Schlüssel aus Organisation und Benutzer
- Rollen `owner`, `operator`, `viewer`
- Mitgliedschaftsstatus `active` oder `archived`
- bestehende `greenhouse_users` bleiben parallel erhalten

### Bestehende Tabellen

`greenhouses` und `devices` erhalten zunächst ausschließlich nullable
Tenantspalten. Sie werden in 2A.1 weder befüllt noch verpflichtend gemacht.
Bestehende IDs und Fremdschlüssel werden nicht ersetzt.

## RLS-Entwurf

Neue Tabellen erhalten Row Level Security. Zwei kleine serverseitige
Hilfsfunktionen lösen die aktuelle Identität und aktive
Organisationsmitgliedschaft auf, ohne rekursive Policies auf
`organization_members` zu erzeugen.

Der bestehende globale Wert `admin` wird im Draft ausschließlich als
Übergangsbezeichnung für den späteren `master_admin` akzeptiert. Es findet
keine Rollenumbenennung und kein Rollen-Backfill statt.

Service-Role-Zugriffe umgehen RLS technisch. Deshalb bleibt unabhängig von
RLS die verbindliche Anwendungsregel:

> Kein benutzerbezogener Service-Role-Zugriff ohne expliziten serverseitigen
> Tenant Context und Ressourcenzuordnung.

## Noch fehlende Entscheidungen vor 2A.2

- vollständiges Schema der vier nur teilweise bekannten Tabellen
- vorhandene produktive RLS-Policies und Hilfsfunktionen
- tatsächliche Datentypen und Constraints der Bestandsobjekte
- Name des ersten Pfaff-Standorts
- Reichweite von Organisationsrollen
- dauerhafter Umgang mit `profiles.system_role = 'admin'`
- lokale oder getrennte Supabase-/PostgreSQL-Testumgebung

## Rollbackregel

Der Rollback-Draft ist ausschließlich für eine isolierte Testdatenbank
bestimmt. Er verweigert den Rückbau, sobald:

- Organisationen, Standorte oder Mitgliedschaften existieren oder
- eine bestehende Gewächshaus- oder Gerätezeile bereits Tenantwerte trägt.

In einer späteren Produktion wird primär der neue Apppfad deaktiviert. Neue
Tenantdaten werden nicht automatisch durch ein Schema-Rollback gelöscht.

## Nicht Teil von 2A.1

- Anwendung des SQL-Drafts
- produktive Pilotdaten
- Datenbackfill
- Master-Platform-Seiten
- Tenant Context im Laufzeitcode
- Änderungen an Temperatur, Bewässerung, Frostschutz, Heartbeat oder Fenstern
- Firmwareänderungen
