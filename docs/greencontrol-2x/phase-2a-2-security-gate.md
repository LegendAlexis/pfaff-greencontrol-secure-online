# Phase 2A.2 Security Gate

Status: minimale Härtung im Hauptprojekt und in Staging angewendet und
read-only nachgewiesen; Deployment-Smoke-Test ausstehend.

## Verifizierte Nachweise

### Cron-Authorization

`ALERT_CRON_SECRET` ist in Vercel konfiguriert. Ob der konfigurierte Wert
mit dem früher versionierten Wert übereinstimmt, konnte ohne Offenlegung
des Laufzeitwerts nicht sicher bestätigt werden.

Der frühere Wert muss deshalb als möglicherweise kompromittiert gelten.
Er war in zwei versionierten Dateien und in der Git-Historie vorhanden.
Beide aktuellen Dateien enthalten jetzt nur noch einen Platzhalter.

Verbindlicher externer Abschluss:

1. neuen kryptografisch zufälligen Wert erzeugen,
2. `ALERT_CRON_SECRET` in Vercel ersetzen,
3. Cron-Aufrufer auf denselben neuen Wert umstellen,
4. neu deployen,
5. bestätigen, dass der alte Wert nicht mehr gültig ist.

Der alte Wert wird nicht dokumentiert oder erneut verwendet. Ein
produktiver POST-Test wurde bewusst nicht ausgeführt, weil er
Alarmverarbeitung und E-Mails auslösen könnte.

### `profiles.system_role`

Nachgewiesener Produktionsstand:

- RLS ist aktiv.
- `anon` und `authenticated` besitzen Tabellenrechte einschließlich
  UPDATE.
- `authenticated` besitzt UPDATE auf `system_role`, `is_active` und
  `mfa_required`.
- Die Policy `users update own profile` begrenzt nur die Zeile auf
  `id = auth.uid()`.

Die Schwachstelle ist real. RLS begrenzt Zeilen, nicht Spalten. Ein
angemeldeter Benutzer kann deshalb seine eigene Profilzeile auswählen
und privilegierte Felder verändern. `is_system_manager()` und der
Anwendungscode vertrauen anschließend `system_role`; eine
Selbsteskalation zu `admin` ist damit möglich.

Minimale Härtung im Draft:

- breites UPDATE für `public`, `anon` und `authenticated` entziehen,
- kein Spalten-UPDATE für öffentliche API-Rollen wieder gewähren,
- das explizite und effektive UPDATE-Recht von `service_role` erhalten,
- bestehende RLS-Policy und Rollenarchitektur unverändert lassen.

Der Anwendungscode wurde vor dieser Entscheidung vollständig geprüft:
Profiladministration erfolgt in `app/users/actions.ts` ausschließlich über
den serverseitigen Admin-Client mit `service_role`. Ein direktes
Profil-UPDATE mit `authenticated` ist nicht Bestandteil der aktuellen App.

### `manual_commands`

Nachgewiesener Produktionsstand:

- RLS ist deaktiviert.
- `anon` und `authenticated` besitzen SELECT, INSERT, UPDATE und DELETE.
- Die aktuelle App und die aktuelle Firmwarebaseline verwenden die
  Tabelle nicht.

Die Schwachstelle ist real. Die Tabelle ist über die öffentlichen
Supabase-Rollen vollständig les- und veränderbar.

Minimale Härtung im Draft:

- RLS aktivieren,
- alle Tabellenrechte für `public`, `anon` und `authenticated` entziehen,
- alle Rechte an der zugehörigen Identity-Sequenz entziehen,
- keine erlaubende Policy hinzufügen.

## Geänderte Dateien

- `AUTOMATISCHE-WARNUNGEN.md`
- `supabase/schedule_alert_checker_TEMPLATE.sql`
- `supabase/migration-drafts/20260730_security_gate_hardening_DRAFT.sql`
- `tests/migration/security-gate-hardening.test.ts`
- `docs/greencontrol-2x/phase-2a-2-security-gate.md`

## Grenzen

- keine Tenant-Migration,
- keine Rollenarchitekturänderung,
- keine Featureänderung,
- keine Firmwareänderung,
- keine Datenbankverbindung,
- keine produktive SQL-Ausführung,
- kein produktiver Cron-Aufruf.

## Testbericht

- Secret-Scan des aktuellen Git-Baums:
  - früherer Cron-Wert: 0 Treffer,
  - fest eingetragene Bearer-Werte: 0 Treffer,
  - sichere Platzhalter: 2 Dateien.
- TypeScript: bestanden.
- ESLint: bestanden.
- Unit-Tests: 15/15 bestanden.
- Integrationstests: 10/10 bestanden.
- Firmwaretests: 7/7 bestanden.
- Migrationstests: 23/23 bestanden, davon 7 Security-Gate-Tests.
- Gesamt: 55/55 Tests bestanden.
- `git diff --check`: bestanden.

Der Produktions-Build wurde nicht ausgeführt. Ein Next.js-Build kann
`.env.local` laden und Build-Time-Code starten. Das wäre mit dem
verbindlichen Verbot, `.env.local` zu lesen oder produktive Systeme zu
kontaktieren, in dieser Sicherheitsphase nicht zuverlässig vereinbar.

## Tatsächlicher Ausführungsstand

Der transaktionale Integrationstest wurde erfolgreich abgeschlossen, jedoch
wegen einer nicht an denselben Verbindungsparameter gebundenen
PowerShell-Session versehentlich gegen das Hauptprojekt statt gegen Staging
ausgeführt. Alle Assertions bestanden und die Transaktion wurde committed.

Die anschließende getrennte Read-only-Prüfung hat eindeutig bestätigt:

- Hauptprojekt `dkfvqgnpwvfzqgdnhypw`: gehärteter Zielzustand,
- Staging `iacplyydjtiirghwixys`: ursprüngliche restriktive
  Schema-only-Baseline, noch nicht gehärtet,
- `service_role` besitzt im Hauptprojekt weiterhin ein explizites und
  effektives UPDATE-Recht auf `public.profiles`,
- `authenticated` besitzt dort kein Profil-UPDATE mehr,
- `manual_commands` hat RLS ohne Allow-Policy,
- `anon` und `authenticated` besitzen weder CRUD- noch Sequenzrechte.

Der Vorgang änderte keine Datenzeilen. Produktion darf bis zum Abschluss der
Nachkontrolle nicht erneut schreibend bearbeitet werden. Alle weiteren
Datenbankwerkzeuge müssen Host, Project Ref und Pooler-Benutzer im selben
Aufruf explizit binden.

## Validierung in Staging

Status: transaktionale Härtung und unabhängiger Read-only-Postflight
bestanden.

Das versionierte Skript
`scripts/database/staging-security-integration.sql` wurde ausschließlich
über explizit im `psql`-Aufruf gebundene Staging-Verbindungsparameter
ausgeführt. Alle acht Phasen bestanden und die Transaktion wurde committed.

Der anschließende Postflight in einer neuen Read-only-Transaktion bestätigte:

- 13 Tabellen, 8 Sequenzen, 5 Funktionen und 2 Public-Trigger,
- 26 unveränderte Policies,
- 13 Tabellen mit aktivem RLS,
- kein Profil-UPDATE für `authenticated`,
- explizites und effektives Profil-UPDATE für `service_role`,
- RLS ohne Allow-Policy für `manual_commands`,
- keine CRUD- oder Sequenzrechte für `anon` und `authenticated`,
- alle bestätigten Tabellen- und Sequenzrechte für `service_role`.

Die Staging-Ausführung enthielt keine produktiven Daten, Geräte,
Integrationen oder Secrets. Das Datenbankpasswort blieb ausschließlich in
der interaktiven lokalen `psql`-Eingabe.

## Abschlussbedingungen

Das Security Gate gilt erst vollständig als geschlossen, wenn:

1. die Cron-Rotation extern bestätigt wurde,
2. der Security-Draft mit explizit gebundener Staging-Identität ausgeführt
   wurde (erfüllt),
3. die negativen Rechteprüfungen dort bestanden wurden (erfüllt),
4. Repository-Tests, Deployment und Smoke-Test bestanden wurden.

Bis dahin bleibt Phase 2A.2c blockiert.
