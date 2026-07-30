# Phase 2A.2 Security Gate

Status: minimale Härtung im Hauptprojekt angewendet und read-only
nachgewiesen; Staging-Abgleich und Deployment-Smoke-Test ausstehend.

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

Status: strukturelle Read-only-Baseline bestätigt; Härtung ausstehend.

Der Harness `scripts/database/invoke-security-gate-test.ps1` führt genau
drei Schritte aus:

| Schritt | Erwartetes Verhalten | Tatsächliches Verhalten | Rückfall |
| --- | --- | --- | --- |
| Preflight | Testinstanz entspricht der nachgewiesenen verwundbaren Baseline | ausstehend | keine Änderung; nur Metadatenabfrage |
| minimale Härtung | nur Profilgrants und `manual_commands` werden abgesichert | ausstehend | Testinstanz verwerfen und aus der Baseline neu aufbauen |
| Postflight | privilegierte Profilupdates und öffentlicher Zugriff sind verweigert; fünf Funktionen und zwei Public-Trigger bleiben vorhanden | ausstehend | keine Änderung; nur Metadatenabfrage |

Sicherheitsgrenzen des Harness:

- verweigert Übereinstimmung mit Produktionshost oder
  Produktions-Project-Ref,
- verlangt ausdrücklich `-ExecuteOnDisposableTest`,
- akzeptiert ausschließlich SQL-Dateien im Repository,
- verwendet ausschließlich den fest definierten Security-Draft,
- verlangt PostgreSQL Client 17.x,
- nimmt kein Passwort als Parameter entgegen,
- lässt `psql` das Passwort interaktiv abfragen,
- enthält keine Tenant- oder Featuremigration.

Beispiel für die lokale Ausführung; sämtliche Platzhalter müssen mit den
nicht geheimen Identitäten der beiden Projekte ersetzt werden:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File scripts/database/invoke-security-gate-test.ps1 `
  -TargetHost "<TEST_HOST>" `
  -TargetProjectRef "<TEST_PROJECT_REF>" `
  -ProductionHost "<PRODUCTION_HOST>" `
  -ProductionProjectRef "<PRODUCTION_PROJECT_REF>" `
  -DatabaseUser "<TEST_DATABASE_USER>" `
  -ExecuteOnDisposableTest
```

Das Testdatenbankpasswort wird ausschließlich in der interaktiven
`psql`-Abfrage eingegeben. Es darf nicht in Chat, Befehlszeile,
Repository oder Bericht erscheinen.

Neue statische Validierungstests:

- Ausführung ohne ausdrücklichen Testschalter wird verweigert.
- Übereinstimmung einer der Produktionsidentitäten wird verweigert.
- Pre-/Postflight enthalten keine DML, Tenant- oder Featureänderung.
- Postflight prüft alle drei privilegierten Profilspalten.
- Postflight prüft RLS, Tabellenrechte, Sequenzrechte und fehlende
  Allow-Policies für `manual_commands`.
- Postflight prüft den Fortbestand der fünf Funktionen und zwei
  Public-Trigger.

## Abschlussbedingungen

Das Security Gate gilt erst vollständig als geschlossen, wenn:

1. die Cron-Rotation extern bestätigt wurde,
2. der Security-Draft mit explizit gebundener Staging-Identität ausgeführt
   wurde,
3. die negativen Rechteprüfungen dort bestanden wurden,
4. Repository-Tests, Deployment und Smoke-Test bestanden wurden.

Bis dahin bleibt Phase 2A.2c blockiert.
