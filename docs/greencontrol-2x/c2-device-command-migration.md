# C2 – Device-Command-Migration

## Status

Die SQL-Dateien sind Review-Drafts. Sie wurden weder gegen Staging noch gegen
Produktion ausgeführt. Vor einer Ausführung sind das bekannte Identity Gate,
ein Schema-Preflight und eine ausdrückliche Freigabe erforderlich.

## Zweck und Umfang

`public.device_commands` persistiert zeitkritische, idempotente Befehle für
die drei Kernaktoren:

- `watering` mit `set` und Zustand `on` oder `off`,
- `roof_window` mit `move` und Aktion `open`, `stop` oder `close`,
- `side_window` mit `move` und Aktion `open`, `stop` oder `close`.

C2 verändert keine bestehende Tabelle und enthält keine API-, Firmware-,
Hardware-, Rollen-, Tenant- oder Fenster-Safety-Änderung.

## Schlankes Modell

Die Tabelle speichert nur:

- Command-ID und Protokollversion,
- Zielgerät,
- typisierten Aktor, Befehl und Payload,
- monotone Sequenz,
- Zustellungs- und ACK-Status,
- Erstellungs-, Ablauf-, Zustellungs- und ACK-Zeitpunkte,
- optionalen ACK-Grund und gemeldeten Aktorzustand.

Eine `greenhouse_id` wird nicht dupliziert. Das Gewächshaus ist über
`devices.greenhouse_id` eindeutig ableitbar.

Die Gerätebeziehung verwendet `ON DELETE RESTRICT`. Sobald Commands für ein
Gerät existieren, kann dessen Datensatz nicht mehr physisch gelöscht werden.
Das bewahrt die eindeutige Zuordnung und Command-Historie. Geräte mit Historie
müssen deaktiviert beziehungsweise in einer späteren Gerätephase archiviert
werden. `SET NULL` wurde verworfen, weil es die Zielidentität historischer
Commands verlieren und die Sequenz- sowie Poll-Invarianten aufweichen würde.

Die Identity-Sequenz wird von PostgreSQL atomar erzeugt. Sie ist global
monoton; die Firmware bewertet und speichert den letzten Wert trotzdem
getrennt für `watering`, `roof_window` und `side_window`. Nicht
zusammenhängende Werte sind ausdrücklich zulässig.

## Sicherheit

- RLS ist ab Erstellung aktiviert.
- Es werden keine Policies für `anon` oder `authenticated` angelegt.
- `public`, `anon` und `authenticated` erhalten keine Tabellen- oder
  Sequenzrechte.
- Nur `service_role` erhält die für die spätere serverseitige API benötigten
  expliziten Rechte.
- Der spätere API-Code muss das authentifizierte Gerät ermitteln und jede
  Operation zusätzlich explizit auf dessen `device_id` begrenzen.

Das Datenbankschema validiert die drei bekannten Aktor-/Command-/Payload-
Kombinationen. Weitere Aktoren benötigen später eine additive Erweiterung der
Check-Constraints, aber keine neue Transport- oder Tabellenarchitektur.

## Poll-Index

Der einzige zusätzliche Index umfasst offene Befehle eines Geräts:

```text
(device_id, sequence)
WHERE status IN ('pending', 'delivered')
```

Weitere Indizes werden erst nach realen Abfragemessungen ergänzt.

## Rollback

Der Rollback ist nur für eine isolierte Testdatenbank vorgesehen. Er:

1. startet eine Transaktion,
2. prüft, ob `device_commands` Daten enthält,
3. bricht bei vorhandener Command-Historie vollständig ab,
4. entfernt nur eine leere C2-Tabelle,
5. entfernt dadurch auch deren eigene Identity-Sequenz, Index und Grants.

Ein produktiver Rollback mit vorhandenen Commands muss als
Forward-Recovery geplant werden; Command-Historie wird nicht automatisch
gelöscht.

## Ausführungsreihenfolge nach Freigabe

1. Zielidentität und `transaction_read_only` im Preflight verifizieren.
2. Bestätigen, dass `public.devices(id)` als UUID-Primärschlüssel vorhanden
   ist.
3. Draft in der isolierten Staging-Instanz transaktional anwenden.
4. Tabellen-, Constraint-, Index-, RLS- und Grant-Postflight ausführen.
5. Negative Inserts für ungültige Aktor-/Payload-Kombinationen testen.
6. Prüfen, dass ein Gerät mit Command-Historie nicht gelöscht werden kann.
7. Testdaten entfernen und den Rollback auf der wieder leeren Tabelle testen.
8. Erst danach eine produktionsfähige lineare Migration zur Freigabe
   vorschlagen.
