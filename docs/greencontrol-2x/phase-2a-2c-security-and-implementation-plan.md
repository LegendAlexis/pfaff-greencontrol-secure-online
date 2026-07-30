# Sicherheits- und Umsetzungsplan vor Phase 2A.2c

Status: Planungsstand vom 30. Juli 2026. Keine Implementierung, keine
Migration und keine Datenbankverbindung.

## Entscheidung

Phase 2A.2c darf noch nicht beginnen. Der Review hat drei kritische
Sicherheits-Gates ergeben:

1. Ein fest eingetragener Cron-Authorization-Wert ist in zwei
   versionierten Dateien und in der Git-Historie enthalten.
2. Die produktive RLS-Policy erlaubt Benutzern das Update ihrer eigenen
   `profiles`-Zeile. Ohne separat eingeschränkte Spaltenrechte könnten
   Benutzer `system_role`, `is_active` oder `mfa_required` selbst ändern.
3. `manual_commands` hat kein RLS. Grants/ACLs fehlen im Schemaexport und
   müssen deshalb bis zum Gegenbeweis als potenziell offen gelten.

Diese Punkte werden vor weiteren Migrationen behandelt oder durch
verlässliche, separat geprüfte Metadaten als nicht ausnutzbar
nachgewiesen.

## Prioritätsdefinition

- **Kritisch:** möglicher unmittelbarer Secretmissbrauch, unautorisierte
  Rechteausweitung oder ungeschützter Steuerungszugriff; blockiert weitere
  Migrationen.
- **Hoch:** konkrete mandantenübergreifende Daten- oder
  Verwaltungsbefugnis; muss vor Aktivierung des Multi-Tenant-Pfads
  geschlossen sein.
- **Mittel:** Integritäts-, Reproduzierbarkeits- oder
  Defense-in-Depth-Risiko; darf nur mit klarer Übergangsgrenze bestehen.
- **Niedrig:** hauptsächlich Wartbarkeit, Dokumentation oder spätere
  Optimierung.

## Geplante Migrationspakete

Die Namen sind Planungsbezeichnungen, keine existierenden Dateien.

| Kürzel | Geplanter Zweck |
| --- | --- |
| `SEC-0` | operative Secretrotation und Bereinigung ohne SQL |
| `SEC-1` | RLS-/Grant-Härtung für `profiles` und `manual_commands` |
| `BASE-1` | kanonische, bereinigte Ist-Baseline für isolierte Testaufbauten |
| `BASE-2` | reproduzierbare Funktionen, Trigger und fehlende Policies |
| `DATA-1` | Datenqualitätsprüfung vor Foreign Keys oder Feldkonsolidierung |
| `DATA-2` | referenzielle Integrität und gezielte Indizes |
| `NOTIFY-1` | kontrollierte Konsolidierung der Benachrichtigungsfelder |
| `TENANT-1` | überarbeiteter Forward-/Rollback-Draft aus Block 2A.1 |
| `TENANT-2` | Tenant Context und tenantgebundene RLS-Policies |
| `LEGACY-1` | späterer, separat freigegebener Rückbau ungenutzter Objekte |

## Umsetzungsreihenfolge

1. **Gate 0 – sofortige Sicherheitsbehandlung:** `SEC-0`, ACL-Nachweis,
   anschließend `SEC-1` als Review-Draft und isolierter Test.
2. **Gate 1 – reproduzierbarer Teststand:** Produktionsschema in die
   wegwerfbare Testinstanz laden, `BASE-1` und `BASE-2` gegen den
   Referenzexport beweisen.
3. **Gate 2 – Datenqualität:** ausschließlich in der Testinstanz
   synthetische beziehungsweise freigegebene Testdaten prüfen; `DATA-1`.
4. **Gate 3 – additive Tenantgrundlage:** A14/A15 im 2A.1-Draft nach
   Review entscheiden; `TENANT-1` anwenden und zurückrollen.
5. **Gate 4 – Tenant-Isolation:** serverseitiger Tenant Context und
   `TENANT-2`; negative Mandantentests müssen vollständig grün sein.
6. **Gate 5 – Bereinigung:** `NOTIFY-1`, `DATA-2` und später
   `LEGACY-1` jeweils separat, nur nach Nutzungs- und Datenbeweis.

## Plan für die 18 Abweichungen

### A01 – Unvollständige Basismigrationen

- **Priorität:** hoch
- **Sicherheitsauswirkungen:** Ein Testaufbau kann unbemerkt andere RLS-,
  Trigger- oder Constraint-Eigenschaften als Produktion besitzen.
- **Risiko:** falsche Sicherheitstests und nicht reproduzierbare
  Migrationen.
- **Betroffene Migrationen:** historische SQL-Dateien nur als Referenz;
  neu geplant `BASE-1`.
- **Reihenfolge:** Gate 1, nach den kritischen Sicherheits-Gates.
- **Erwartete Tests:** Aufbau einer leeren Testinstanz; Objektmanifest für
  Tabellen, Spalten, Typen, Defaults, Constraints, Trigger, Funktionen,
  RLS, Policies und Indizes; erneuter Schema-only-Diff.
- **Rollback-Auswirkungen:** Testinstanz verwerfen und neu aufbauen;
  keine Produktionseinwirkung.
- **Empfehlung:** Vereinfachen.

### A02 – Doppelte Evolutionsskripte

- **Priorität:** mittel
- **Sicherheitsauswirkungen:** Je nach Reihenfolge können ältere Policies
  oder Trigger wieder aktiv werden.
- **Risiko:** nicht deterministischer Neuaufbau und Policy-Drift.
- **Betroffene Migrationen:** `phase1_auth_multi_greenhouse.sql`,
  `pfaff_greencontrol_v2.sql`, `notification_settings.sql`,
  `automatic_alerts.sql`, später `BASE-1`.
- **Reihenfolge:** gemeinsam mit A01 in Gate 1.
- **Erwartete Tests:** genau ein freigegebener Aufbaupfad; wiederholter
  Aufbau liefert identischen Schemahash; historische Skripte werden nicht
  automatisch erneut ausgeführt.
- **Rollback-Auswirkungen:** nur Auswahl des Buildpfads zurücknehmen;
  historische Dateien bleiben unangetastet.
- **Empfehlung:** Vereinfachen.

### A03 – Doppelte Benachrichtigungsspalten

- **Priorität:** mittel
- **Sicherheitsauswirkungen:** Empfänger- und Opt-in-Werte können
  auseinanderlaufen; Warnungen könnten an unerwartete Adressen gehen.
- **Risiko:** Datenschutzfehler oder verlorene Warnkonfiguration.
- **Betroffene Migrationen:** `notification_settings.sql`, neu
  `DATA-1` und `NOTIFY-1`.
- **Reihenfolge:** nach Tenant-Isolation; nicht Teil des ersten
  Tenant-Drafts.
- **Erwartete Tests:** Feldnutzungsinventar, Konfliktfälle beider
  Feldgruppen, idempotenter Backfill, E-Mail-Regression,
  Null-/Opt-in-Tests.
- **Rollback-Auswirkungen:** Legacy-Spalten bis zum Ende behalten;
  Rückfall durch Umschalten des App-Lesepfads, keine sofortigen Drops.
- **Empfehlung:** Vereinfachen.

### A04 – Fehlende Funktion `handle_new_notification_settings()`

- **Priorität:** mittel
- **Sicherheitsauswirkungen:** Trigger läuft mit erhöhten Rechten; nicht
  versioniertes Verhalten erschwert Berechtigungsprüfung.
- **Risiko:** unterschiedliche Profileinstellungen in Test und
  Produktion.
- **Betroffene Migrationen:** neu `BASE-2`; Auth-Trigger separat
  nachweisen.
- **Reihenfolge:** Gate 1.
- **Erwartete Tests:** neuer Auth-Benutzer erhält genau eine
  Einstellung; keine fremde Benutzer-ID; idempotenter Konfliktfall;
  eingeschränkter `search_path`; Funktions-ACL.
- **Rollback-Auswirkungen:** Funktionsdefinition auf vorherigen,
  dokumentierten Stand zurücksetzen; bestehende Datensätze nicht löschen.
- **Empfehlung:** Beibehalten.

### A05 – Globale Managerzuweisung bei neuen Gewächshäusern

- **Priorität:** hoch
- **Sicherheitsauswirkungen:** globale Admin-/Owner-Rollen erhalten
  automatisch Zugriff auf jedes neue Gewächshaus.
- **Risiko:** mandantenübergreifende Rechteausweitung.
- **Betroffene Migrationen:** neu `BASE-2`, später `TENANT-2`.
- **Reihenfolge:** Verhalten in Gate 1 reproduzierbar dokumentieren, vor
  Freigabe eines zweiten Tenants in Gate 4 ersetzen.
- **Erwartete Tests:** Organisation A erhält keine Mitgliedschaft für
  Gewächshaus B; nur explizite Mitgliedschaften; Legacy-Pilot bleibt
  erreichbar.
- **Rollback-Auswirkungen:** Featurepfad auf Legacy-Mitgliedschaften
  zurückschalten; entfernten Trigger nur nach gesichertem
  Wiederherstellungsskript deaktivieren.
- **Empfehlung:** Verwerfen als Zielmodell.

### A06 – Nicht versionierter Updated-at-Trigger

- **Priorität:** niedrig
- **Sicherheitsauswirkungen:** geringe direkte Auswirkung; Zeitstempel
  sind jedoch für Audit und Konflikterkennung relevant.
- **Risiko:** veraltete Änderungszeit und falsche Diagnose.
- **Betroffene Migrationen:** neu `BASE-2`.
- **Reihenfolge:** Gate 1.
- **Erwartete Tests:** Insert behält Default; Update verändert
  `updated_at`; Trigger kann keine fremden Spalten verändern.
- **Rollback-Auswirkungen:** Trigger/Funktion auf vorherige Definition
  zurücksetzen; keine Datenlöschung.
- **Empfehlung:** Beibehalten.

### A07 – Abweichende und identitätsgebundene `handle_new_user()`-Logik

- **Priorität:** hoch
- **Sicherheitsauswirkungen:** Systemrollen werden anhand fest
  eingetragener Identitäten vergeben.
- **Risiko:** falsche Privilegien, schwer prüfbare
  Administratorzuweisung und erneute Einführung historischer Kontenlogik.
- **Betroffene Migrationen:** `phase1_auth_multi_greenhouse.sql`,
  `pfaff_greencontrol_v2.sql`, `notification_settings.sql`, neu
  `BASE-2` und später `TENANT-2`.
- **Reihenfolge:** Gate 1 exakt erfassen; vor Tenantfreigabe in Gate 4
  durch neutrale Profilanlage plus explizite Rollenvergabe ersetzen.
- **Erwartete Tests:** unbekannter Benutzer startet ohne erhöhte Rolle;
  Wiederanmeldung ändert Rolle nicht; Rollenvergabe nur durch erlaubten
  Adminpfad; Auditnachweis.
- **Rollback-Auswirkungen:** neutrale Profilanlage beibehalten;
  Rollenzuweisung nicht automatisch zurückrollen.
- **Empfehlung:** Verwerfen als Zielmodell.

### A08 – Zwei DELETE-Policies fehlen im Repository

- **Priorität:** mittel
- **Sicherheitsauswirkungen:** physisches Löschen von
  Benachrichtigungseinstellungen kann Audit- und Opt-in-Nachweise
  entfernen.
- **Risiko:** Produktions- und Testberechtigungen unterscheiden sich.
- **Betroffene Migrationen:** `notification_settings.sql`, neu
  `BASE-2`.
- **Reihenfolge:** Gate 1 dokumentieren; fachliche Entscheidung vor
  `NOTIFY-1`.
- **Erwartete Tests:** Benutzer nur eigener Datensatz; Managerpfad
  tenantgebunden; Viewer keine Fremdlöschung; bevorzugter Resetpfad.
- **Rollback-Auswirkungen:** Policy kann separat wiederhergestellt
  werden; gelöschte Daten sind nicht durch Schema-Rollback
  wiederherstellbar.
- **Empfehlung:** Vereinfachen.

### A09 – `manual_commands` ohne RLS und Foreign Key

- **Priorität:** kritisch
- **Sicherheitsauswirkungen:** potenziell öffentlicher Lese- oder
  Schreibzugriff auf Steuerungsfelder; Grants sind noch unbekannt.
- **Risiko:** unautorisierte Befehle, Datenoffenlegung oder verwaiste
  Steuerungszeilen.
- **Betroffene Migrationen:** sofort `SEC-1`; später `LEGACY-1`.
- **Reihenfolge:** Gate 0 vor jeder weiteren Migration.
- **Erwartete Tests:** Anon und Authenticated können weder lesen noch
  schreiben; Service Role nur über explizit autorisierten Serverpfad;
  aktueller App- und Firmwarepfad verwendet die Tabelle nicht;
  Grant-/ACL-Nachweis.
- **Rollback-Auswirkungen:** RLS/REVOKE nur auf isolierter Testinstanz
  zurückrollen; produktiv erst nach Nutzungsnachweis. Kein Tabellen-Drop.
- **Empfehlung:** Verwerfen als neuer Apppfad.

### A10 – Fehlende Foreign Keys für Zeitpläne und Warnungen

- **Priorität:** mittel
- **Sicherheitsauswirkungen:** verwaiste Zeilen können
  Tenantzuordnungen umgehen oder unklar machen.
- **Risiko:** Migration scheitert an Bestandsdaten; versehentliche
  Cross-Tenant-Zuordnung.
- **Betroffene Migrationen:** neu `DATA-1` und `DATA-2`.
- **Reihenfolge:** Datenprüfung nach Gate 1; Constraints erst nach
  erfolgreichem Backfill.
- **Erwartete Tests:** Orphan-Report, ungültige Inserts scheitern,
  gewünschtes `ON DELETE`-Verhalten, Zeitplan- und Warnungsregression.
- **Rollback-Auswirkungen:** Constraints können ohne Datenverlust
  entfernt werden; bereinigte Daten werden nicht automatisch
  zurückverändert.
- **Empfehlung:** Beibehalten der Beziehungen, Constraints später
  ergänzen.

### A11 – Fehlende Beziehungsindizes

- **Priorität:** niedrig
- **Sicherheitsauswirkungen:** langsame RLS-Prüfungen können
  Verfügbarkeitsprobleme verstärken.
- **Risiko:** unnötige Schreibkosten bei pauschaler Indexierung oder
  langsame Tenantabfragen ohne Index.
- **Betroffene Migrationen:** neu `DATA-2`, zusätzlich geplante Indizes
  in `TENANT-1`.
- **Reihenfolge:** nach funktionalen Tenanttests, vor Lasttest.
- **Erwartete Tests:** `EXPLAIN` auf synthetischem Volumen,
  Indexnutzung, Schreibregression, keine doppelten Indizes.
- **Rollback-Auswirkungen:** Indexe einzeln entfernbar; keine
  Datenänderung.
- **Empfehlung:** Vereinfachen.

### A12 – Global lesbare Wetterdaten

- **Priorität:** hoch vor zweitem Tenant, mittel im Einzelpilot
- **Sicherheitsauswirkungen:** jeder authentifizierte Benutzer sieht alle
  Wetterdaten.
- **Risiko:** Standort- und Betriebsdaten werden tenantübergreifend
  offengelegt.
- **Betroffene Migrationen:** `pfaff_greencontrol_v2.sql`, später
  `TENANT-2`.
- **Reihenfolge:** vor Freigabe eines zweiten Betriebs in Gate 4.
- **Erwartete Tests:** Betrieb A liest Wetter von A, nicht B; anonyme
  Zugriffe scheitern; Pilotdaten bleiben sichtbar.
- **Rollback-Auswirkungen:** alte globale SELECT-Policy nur als
  zeitlich begrenzter Pilot-Rückfall, nie bei mehreren Tenants.
- **Empfehlung:** Vereinfachen durch Standortzuordnung.

### A13 – Globale Manager- und Service-Role-Rechte

- **Priorität:** kritisch für Multi-Tenant-Freigabe, hoch im aktuellen
  Einzelbetrieb
- **Sicherheitsauswirkungen:** Owner/Admin sehen und ändern über
  Service-Role-Pfade derzeit globale Benutzer, Geräte und Logs.
- **Risiko:** vollständiger mandantenübergreifender Verwaltungszugriff.
- **Betroffene Migrationen:** `security_admin_devices_audit.sql`,
  `notification_settings.sql`, neu `TENANT-2`; zusätzlich spätere
  Änderungen im Servercode.
- **Reihenfolge:** Tenant Context vor Master-Platform- oder
  Zweittenant-Freigabe; keine Service-Role-Abfrage ohne
  Ressourcenzuordnung.
- **Erwartete Tests:** A kann B weder lesen noch ändern; manipulierte IDs
  scheitern; Owner nicht global; `master_admin` bewusst global und
  auditiert; Service-Role-Helfer verlangt Tenant Context.
- **Rollback-Auswirkungen:** neuer Tenantpfad per Feature Flag
  deaktivierbar; keine Rückkehr zu globalem Zugriff bei mehreren
  Betrieben.
- **Empfehlung:** Verwerfen als Zielmodell.

### A14 – Check-Constraint erlaubt kein `master_admin`

- **Priorität:** mittel
- **Sicherheitsauswirkungen:** unklare Rollenübersetzung kann zu
  versehentlicher globaler Berechtigung führen.
- **Risiko:** Draft erwartet einen nicht speicherbaren Wert.
- **Betroffene Migrationen:** Forward-/Rollback-Draft aus 2A.1,
  zukünftig `TENANT-1`.
- **Reihenfolge:** vor Anwendung von `TENANT-1`.
- **Erwartete Tests:** Legacy-`admin` funktioniert im Übergang;
  `master_admin` wird erst nach eigener Migration akzeptiert; keine
  automatische Rolleneskalation.
- **Rollback-Auswirkungen:** Rollenwert nicht automatisch zurückbenennen;
  Constraintänderung nur nach Datenprüfung rückbauen.
- **Empfehlung:** Vereinfachen und zunächst `admin` beibehalten.

### A15 – Organisation/Standort-Konsistenz nicht erzwungen

- **Priorität:** hoch
- **Sicherheitsauswirkungen:** Ressource könnte Organisation A und einem
  Standort von B zugeordnet werden.
- **Risiko:** widersprüchlicher Tenant Context und Datenleck.
- **Betroffene Migrationen:** Forward-/Rollback-Draft aus 2A.1,
  zukünftig `TENANT-1`.
- **Reihenfolge:** Draft vor 2A.2c nicht automatisch ändern; Entscheidung
  vor erster Anwendung in Gate 3.
- **Erwartete Tests:** Cross-Organization-Site-Zuweisung scheitert;
  korrekte Zuordnung gelingt; nullable Legacyzeilen bleiben erlaubt;
  Rollbacktest.
- **Rollback-Auswirkungen:** Konsistenzconstraint separat entfernbar;
  bereits widersprüchliche Daten müssen vor Rollback geklärt werden.
- **Empfehlung:** Beibehalten des Modells, einfache Integritätsregel
  ergänzen.

### A16 – Legacy-RLS verwendet Tenantspalten noch nicht

- **Priorität:** hoch
- **Sicherheitsauswirkungen:** neue Tenantspalten allein trennen keine
  Gewächshäuser, Geräte, Messwerte, Warnungen oder Zeitpläne.
- **Risiko:** falsche Annahme, Multi-Tenancy sei nach `TENANT-1`
  vollständig aktiv.
- **Betroffene Migrationen:** bestehende RLS-Skripte nur als Referenz;
  neu `TENANT-2`.
- **Reihenfolge:** nullable Schema und Backfill zuerst; RLS-Umschaltung
  erst danach in Gate 4.
- **Erwartete Tests:** vollständige A/B-Negativmatrix pro Tabelle und
  Operation; Legacy-Pilot; Service Role; Viewer/Operator/Owner.
- **Rollback-Auswirkungen:** Feature Flag kann neue Apppfade stoppen;
  RLS-Rückfall nur solange exakt ein Tenant existiert.
- **Empfehlung:** Beibehalten als gestufte Migration.

### A17 – Auth-Trigger und Privilegien nicht im Export

- **Priorität:** kritisch als Nachweis-Gate für A09 und
  Profil-Eskalation, sonst mittel
- **Sicherheitsauswirkungen:** unbekannte Grants können RLS-Lücken
  ausnutzbar oder entschärft machen; Triggerrechte sind unbewiesen.
- **Risiko:** Sicherheitsbewertung auf unvollständigen Metadaten.
- **Betroffene Migrationen:** keine automatische Änderung; gezielter
  ACL-/Trigger-Metadatenexport, danach `SEC-1`/`BASE-2`.
- **Reihenfolge:** Gate 0.
- **Erwartete Tests:** Schema-only-Metadatenabfrage für
  `information_schema.role_table_grants`, Funktions-ACLs, Owner und
  Trigger auf `auth.users`; keine Nutzdaten.
- **Rollback-Auswirkungen:** reiner Nachweis hat keinen Rollback;
  spätere Grantänderungen müssen spiegelbildlich dokumentiert werden.
- **Empfehlung:** Beibehalten des minimalen Exports, gezielten
  Sicherheitsnachweis ergänzen.

### A18 – Authorization-Wert im Cron-Template

- **Priorität:** kritisch
- **Sicherheitsauswirkungen:** jeder mit Repository- oder
  Historienzugriff könnte einen noch gültigen Cron-Endpunkt auslösen.
- **Risiko:** unautorisierte Service-Role-Verarbeitung,
  Warnmailauslösung und Ressourcenmissbrauch.
- **Betroffene Migrationen:** keine SQL-Migration; `SEC-0`,
  anschließend sichere Cron-Konfiguration.
- **Reihenfolge:** erster Schritt in Gate 0.
- **Erwartete Tests:** alter Wert erhält 401; neuer Wert nur aus sicherer
  Laufzeitkonfiguration; Repository- und Historien-Secret-Scan; Endpoint
  akzeptiert keine fehlenden/falschen Werte.
- **Rollback-Auswirkungen:** keine Reaktivierung des alten Werts;
  Rückfall nur durch erneute Rotation auf einen dritten, neuen Wert.
- **Empfehlung:** Verwerfen.

## Sicherheitsreview

### S01 – Versionierter Cron-Authorization-Wert

- **Bewertung:** kritisch
- **Nachweis:** gleicher Wert in Cron-Template und Betriebsdokumentation;
  seit Commit `d9d16c5` in der Git-Historie.
- **Auswirkung:** möglicher Aufruf eines Endpunkts, der mit Service Role
  globale Alarm- und Empfängerdaten verarbeitet.
- **Plan:** Gültigkeit sofort außerhalb des Repositorys prüfen, Wert
  rotieren, alten Wert widerrufen, aktuelle Dateien bereinigen,
  Git-Historie nicht als Secretaufbewahrung betrachten. Historienrewrite
  nur separat und koordiniert; Rotation ist zwingend.
- **Gate:** alter Wert muss nachweislich ungültig sein, bevor weitere
  Migrationen beginnen.

### S02 – Mögliche Selbsteskalation über `profiles`

- **Bewertung:** kritisch
- **Nachweis:** produktive Policy erlaubt Update der eigenen Zeile ohne
  sichtbare Spaltenbegrenzung; `system_role`, `is_active` und
  `mfa_required` liegen in derselben Tabelle. Grants wurden nicht
  exportiert.
- **Auswirkung:** möglicher Wechsel zu `admin`, anschließender Zugriff auf
  globale Manager- und Service-Role-Pfade.
- **Plan:** zuerst Spaltengrants/ACLs nachweisen. Falls nicht bereits
  geschützt: direkte Updates privilegierter Spalten für `authenticated`
  entziehen; eigene Profiländerung auf sichere Felder begrenzen;
  Rollenänderungen nur über auditierten Serverpfad.
- **Tests:** Angreifer kann Name gegebenenfalls ändern, aber niemals
  Rolle, Aktivstatus oder MFA-Pflicht; RLS- und REST-Negativtests.

### S03 – `manual_commands` ohne RLS

- **Bewertung:** kritisch bis ACL-Gegenbeweis
- **Nachweis:** Produktion aktiviert kein RLS; Tabelle besitzt
  Steuerungsfelder. ACLs fehlen im Export.
- **Auswirkung:** potenziell öffentlicher Lese-/Schreibzugriff über
  PostgREST.
- **Plan:** Grants nachweisen; RLS aktivieren und standardmäßig
  verweigern oder Rechte vollständig entziehen; keine neue Nutzung.
- **Tests:** Anon/Authenticated vollständig verweigert; keine Regression
  der aktuellen Firmwarebaseline.

### S04 – Publishable Supabase-Key im Legacy-Sketch

- **Bewertung:** mittel, in Kombination mit S03 hoch
- **Nachweis:** versionierter `sb_publishable_...`-Wert im
  Legacy-Firmware-Sketch, seit Commit `1642e3a`.
- **Auswirkung:** Publishable Keys sind keine vertraulichen
  Service-Schlüssel, ermöglichen aber den öffentlichen API-Zugriff, den
  RLS und Grants sicher begrenzen müssen.
- **Plan:** nicht als Secret behandeln, aber nicht als
  Sicherheitskontrolle verwenden; Legacy-Datei bleibt keine Buildquelle;
  nach RLS-/Grant-Prüfung optional durch Beispielwert ersetzen.

### S05 – Globale Service-Role-Verwendung

- **Bewertung:** hoch
- **Nachweis:** Benutzer-, Geräte- und Logseiten sowie Server Actions
  verwenden Service Role nach einer globalen Admin/Owner-Prüfung, ohne
  Organisation oder Ressourcenzuordnung.
- **Auswirkung:** Owner kann globale Benutzer, Geräte, Gewächshäuser und
  Logs sehen oder verwalten.
- **Plan:** zentraler serverseitiger Tenant Context; jede Adminabfrage
  verlangt Organisation und geprüfte Ressource; globaler Zugriff nur für
  ausdrücklich definierten `master_admin`.

### S06 – Alarmempfänger nicht einem Gewächshaus zugeordnet

- **Bewertung:** hoch
- **Nachweis:** Cron lädt alle aktivierten Empfänger und sendet für jedes
  überwachte Gewächshaus an jeden passenden Empfänger.
- **Auswirkung:** Gewächshausname, Status und Warntext können an Benutzer
  anderer Gewächshäuser oder späterer Organisationen gelangen.
- **Plan:** Empfänger über Organisations-/Gewächshausmitgliedschaft
  filtern; Tenant Context auch im Cronjob erzwingen.

### S07 – Geräte-Secrets in URL-Queryparametern

- **Bewertung:** hoch
- **Nachweis:** Registrierung und Rotation leiten mit
  `?secret=...` weiter.
- **Auswirkung:** Secret kann in Browserhistorie, Screenshots,
  Telemetrie, Logs oder Referrer gelangen.
- **Plan:** einmalige serverseitige Übergabe oder kurzlebige,
  nicht persistierte Anzeige; `no-store`; URL niemals als
  Secrettransport.

### S08 – Geräte-Heartbeat: Service Role und Missbrauchsschutz

- **Bewertung:** mittel
- **Nachweis:** Geräte-ID plus Secret wird geprüft und Abfragen sind auf
  das gefundene Gerät/Gewächshaus begrenzt; es fehlen jedoch sichtbare
  Rate-/Body-Limits. Fehlertexte werden teilweise zurückgegeben.
- **Auswirkung:** Schreiblast/DoS und interne Fehlermetadaten; später
  fehlender Tenantnachweis.
- **Plan:** Bodygrenze, Rate Limit, generische externe Fehler,
  strukturierte interne Logs; Device-Tenant-Zuordnung nach Backfill
  zwingend prüfen.

### S09 – Cron-Endpunkt: Vergleich, Rate Limit und Fehlerausgabe

- **Bewertung:** mittel zusätzlich zu S01
- **Nachweis:** einfacher Stringvergleich, keine sichtbare
  Wiederholungsbegrenzung, interne Fehlermeldung im 500-Response.
- **Auswirkung:** Timing-/DoS-Härtung unvollständig und
  Informationsleck für einen Tokeninhaber.
- **Plan:** konstante Vergleichsfunktion, kontrollierte Laufhäufigkeit,
  generische Responses, interne Korrelation/Auditierung.

### S10 – `SECURITY DEFINER`-Funktionen

- **Bewertung:** hoch bis Owner/ACL-Nachweis, danach mittel
- **Nachweis:** mehrere produktive Trigger-/Hilfsfunktionen laufen als
  `SECURITY DEFINER`; einige setzen `search_path = public`, Owner und ACL
  sind nicht exportiert.
- **Auswirkung:** bei manipulierbaren Objekten oder zu breiten
  Execute-Rechten Privilegieneskalation.
- **Plan:** Owner, Execute-Grants und Public-Schema-CREATE-Rechte
  nachweisen; `search_path = ''`; alle Objekte vollständig qualifizieren;
  `PUBLIC`-Execute entziehen und minimal gewähren.

### S11 – RLS-Policy-Design

- **Bewertung:** kritisch für `profiles`/`manual_commands`, hoch für
  Tenant-Isolation
- **Nachweis:** S02/S03 sowie globale Wetter- und Managerpolicies.
- **Auswirkung:** Rolleneskalation, öffentliche Tabelle oder
  Cross-Tenant-Lesen.
- **Plan:** Deny-by-default, getrennte Select-/Mutationstests pro Rolle,
  keine Sicherheit nur durch UI oder Service Role.

### S12 – Rollenmodell und Privilege Escalation

- **Bewertung:** hoch
- **Nachweis:** `owner` gilt global als Manager, darf weitere Owner
  vergeben und verwendet globale Service-Role-Pfade; Trigger vergeben
  Rollen anhand fester Identitäten.
- **Auswirkung:** laterale und vertikale Rechteausweitung.
- **Plan:** `master_admin` strikt von organisationsgebundenem `owner`
  trennen; Rollenzuweisung ressourcengebunden; kein identitätsbasierter
  Trigger; letzte-Master-Schutz und Audit.

### S13 – MFA-Grenze

- **Bewertung:** mittel
- **Nachweis:** schreibende Manageraktionen verlangen überwiegend AAL2,
  globale Benutzer-, Geräte- und Auditlisten sind bereits mit AAL1
  sichtbar. Die MFA-Pflicht liegt zudem in der aktuell selbst
  aktualisierbaren Profilzeile.
- **Auswirkung:** kompromittierte AAL1-Sitzung sieht sensitive
  Verwaltungsdaten.
- **Plan:** S02 zuerst schließen; AAL2 auch für sensible Masterseiten
  prüfen; serverseitig erzwingen.

### S14 – Auditdaten und personenbezogene Daten

- **Bewertung:** mittel
- **Nachweis:** Auditlogs speichern alte/neue Werte und Metadaten;
  Manager sehen globale Logs; keine sichtbare Aufbewahrungsregel.
- **Auswirkung:** unnötige PII-Speicherung und tenantübergreifende
  Einsicht.
- **Plan:** Tenant-ID, Feld-Allowlist, Redaction, Aufbewahrungsfrist und
  tenantgebundene Lesepolicy.

### S15 – SQL-Injection

- **Bewertung:** niedrig; kein konkreter Fund
- **Nachweis:** App verwendet Supabase Query Builder und feste
  Spalten-/Tabellennamen; keine dynamische rohe SQL-Ausführung gefunden.
- **Restrisiko:** zukünftige RPCs, dynamische Filter oder
  Migrationsskripte.
- **Plan:** parametrisierte APIs beibehalten; keine Stringverkettung für
  SQL; negative Eingabetests.

### S16 – XSS und HTML-E-Mail

- **Bewertung:** niedrig
- **Nachweis:** Alarmfelder werden überwiegend escaped. Im
  Testmail-HTML wird eine benutzerkontrollierte Empfängerangabe nicht
  explizit escaped.
- **Auswirkung:** begrenzte HTML-Manipulation in einer an den Benutzer
  selbst gesendeten Testmail.
- **Plan:** alle dynamischen HTML-Werte einheitlich escapen und
  E-Mail-Adresse strikt validieren.

### S17 – Offene Registrierung und Auth-Flächen

- **Bewertung:** mittel
- **Nachweis:** Login-Actions enthalten einen Signup-Pfad; tatsächliche
  Supabase-Projekteinstellung wurde nicht geprüft.
- **Auswirkung:** unerwartete Kontenanlage, Ressourcenverbrauch; RLS muss
  Konten ohne Mitgliedschaft vollständig isolieren.
- **Plan:** Pilotentscheidung Invite-only; Projekteinstellung und UI
  abstimmen; Konto ohne Mitgliedschaft sieht keine Betriebsdaten.

### S18 – Fehler- und Secret-Hygiene

- **Bewertung:** mittel
- **Nachweis:** keine `.env`, privaten Schlüssel oder `GCConfig.h`
  versioniert; Ignore-Regeln sind vorhanden. Einige Serverpfade geben
  Backendfehlermeldungen an Redirects oder API-Responses weiter.
- **Auswirkung:** interne Schema-/Providerdetails können offengelegt
  werden.
- **Plan:** externe generische Fehlercodes, interne strukturierte Logs
  ohne Secrets; verpflichtender Secret-Scan im CI.

### S19 – Abhängigkeiten

- **Bewertung:** niedrig
- **Nachweis:** `npm audit --offline` meldet für 446 erfasste
  Abhängigkeiten keine bekannte Schwachstelle. Der Offlinebestand ist
  kein vollständiger aktueller Advisory-Nachweis.
- **Plan:** vor produktiver Freigabe kontrollierten Online-Audit und
  reproduzierbaren Lockfile-Build durchführen.

### S20 – Sichere Weiterleitungen

- **Bewertung:** niedrig; kein konkreter Fund
- **Nachweis:** Auth- und MFA-Rücksprünge akzeptieren nur lokale Pfade und
  blockieren `//`.
- **Plan:** Verhalten mit externen URLs, Backslashes und kodierten
  Varianten automatisiert testen.

## Erwartetes Testprogramm vor 2A.2c

### Sicherheits-Gate-Tests

1. Alter Cron-Wert: zwingend 401.
2. Falscher/fehlender Cron-Wert: 401 ohne interne Details.
3. Eigener Profilupdateversuch auf `system_role`, `is_active`,
   `mfa_required`: verweigert.
4. Anon/Auth-Zugriff auf `manual_commands`: vollständig verweigert.
5. ACL-/Owner-/Execute-Inventar für alle `SECURITY DEFINER`-Funktionen.
6. Repository- und Historien-Secret-Scan ohne gültige Secrets.

### Tenant-Negativmatrix

Für jede Ressource und Operation:

- Organisation A liest B nicht.
- Organisation A ändert B nicht.
- Owner bleibt in eigener Organisation.
- Operator steuert nur erlaubte Komponenten.
- Viewer schreibt nichts.
- `master_admin`-Zugriff ist ausdrücklich, AAL2-geschützt und auditiert.
- Service Role ohne vollständigen Tenant Context wird im Servercode
  abgewiesen.

Ressourcen:

- Organisationen und Standorte
- Organisationsmitgliedschaften
- Gewächshäuser
- Geräte
- Zeitpläne
- Messwerte
- Warnungen und Alarmzustände
- Benachrichtigungseinstellungen und E-Mail-Logs
- Wetterdaten
- Auditlogs

### Regression und Rollback

- Temperatur, manuelle Bewässerung, Zeitpläne einschließlich
  Mitternacht, Frostschutz, Heartbeat und tatsächlicher
  Bewässerungszustand bleiben grün.
- CH1 bis CH4 bleiben statisch blockiert.
- Forward und Rollback laufen ausschließlich in der wegwerfbaren
  Testinstanz.
- Schema vor Forward entspricht nach Rollback wieder dem erwarteten
  Baseline-Manifest.
- Keine Tests kontaktieren Produktion oder Geräte.

## Freigabegates

### Gate A – vor jeder weiteren Migration

- S01 rotiert und alter Wert nachweislich ungültig.
- S02 durch ACL-Nachweis oder getestete Härtung geschlossen.
- S03 durch ACL-Nachweis und Deny-by-default geschlossen.

### Gate B – vor Anwendung des Tenant-Drafts in Test

- A01/A02 liefern einen reproduzierbaren Teststand.
- A14 ist bewusst entschieden.
- A15 besitzt eine geprüfte Konsistenzregel.
- Forward-/Rollback-Diff ist reviewed.

### Gate C – vor Aktivierung eines zweiten Tenants

- A05, A07, A12, A13 und A16 sind im Zielpfad geschlossen.
- vollständige Tenant-Negativmatrix ist grün.
- kein Service-Role-Aufruf verarbeitet Benutzerdaten ohne Tenant Context.

## Bewusst nicht Teil dieses Plans

- produktive Migration,
- Änderung des 2A.1-Forward- oder Rollback-Drafts,
- Firmwareänderung,
- OTA,
- neue Fenstersteuerung,
- Loginersatz,
- dynamische Plugin Runtime,
- Configuration Engine,
- Historienrewrite ohne eigene Freigabe.

## Nächste Entscheidung

Vor Phase 2A.2c ist eine kleine, separat freizugebende Sicherheitsphase
`2A.2-security-gate` erforderlich. Sie soll ausschließlich:

1. Rotation beziehungsweise Ungültigkeitsnachweis des Cron-Werts,
2. sicheren ACL-/Grant-/Trigger-Metadatenexport ohne Nutzdaten,
3. minimalen Review-Draft für Profilspalten und `manual_commands`,
4. isolierte Negativtests

umfassen. Erst nach erfolgreichem Review dieses Gates wird Phase 2A.2c
freigegeben.
