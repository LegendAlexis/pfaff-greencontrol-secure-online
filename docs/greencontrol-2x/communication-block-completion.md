# Kommunikationsblock – Abschluss

Stand: 4. August 2026

## Ergebnis

Der Kommunikationsblock aus TLS, Legacy-Heartbeat, Command-Poll und
Acknowledgements (ACK) ist funktional abgeschlossen. Die Validierung erfolgte
gegen die isolierte GreenControl-Staging-Umgebung. Es wurden keine neuen
Funktionen eingeführt und keine produktiven Daten verändert.

Die temporäre eindeutige Boot-Kennung wurde entfernt. Die Firmwarediagnose
bleibt als bewusstes Wartungswerkzeug erhalten, ist für den
normalen GreenControl-1.0-Betrieb aber deaktiviert:

```cpp
#define GC_COMMAND_DIAGNOSTICS 0
```

`GC_COMMAND_DIAGNOSTICS=1` ist nur für einen beaufsichtigten Diagnoselauf
zulässig und muss danach wieder auf `0` gestellt werden. Die Diagnoseausgaben
enthalten keine Gerätekennung, Secrets oder vollständigen Auth-Header.

## Abgenommener Kommunikationsweg

1. Der ESP32 verbindet sich mit dem vorgesehenen WLAN.
2. Heartbeat und Poll verwenden HTTPS mit der lokal provisionierten,
   verifizierten Root-CA. `setInsecure()` wird in keinem der beiden Pfade
   verwendet.
3. Der Legacy-Heartbeat bleibt unabhängig und liefert Telemetrie sowie den
   tatsächlichen Bewässerungszustand. Bei Poll-Autorität wendet er keine
   Legacy-Sollwerte als Commands an.
4. Der separate Poll-Endpunkt liefert höchstens einen offenen Command pro
   Aktor und Gerät.
5. Bewässerung, Dachfenster und Seitenfenster besitzen getrennte Sequenzen und
   ACKs. Fenster bleiben weiterhin `component_disabled` und schalten keine
   Relais.
6. Ein ACK bleibt bis zur erfolgreichen Serverbestätigung persistent. Ein
   wiederholter Poll oder ein wiederholtes identisches ACK führt nicht zu einer
   zweiten physischen Ausführung.

## C2 – persistente Command-Basis

Die Migration für `public.device_commands` wurde zunächst vollständig mit
Forward-, Positiv-, Negativ- und Rollback-Tests validiert und danach bewusst
dauerhaft auf Staging angewendet.

Bestätigter Zielzustand:

- Tabelle mit 14 Spalten vorhanden,
- Gerätebeziehung verwendet `ON DELETE RESTRICT`,
- RLS ist aktiv und es bestehen keine Policies für öffentliche Rollen,
- `anon` und `authenticated` besitzen keine Tabellen- oder Sequenzrechte,
- `service_role` besitzt nur die für den Serverpfad bestätigten Rechte,
- die Command-Historie wird bei einer Gerätelöschung nicht automatisch
  entfernt.

Relevante Commits: `31a2aa2`, `5e61eb7`, `77e7b30`, `23fc1bf`.

## C3 und C3.5 – Poll und ACK

Der authentifizierte Poll-Endpunkt wurde in `77cdc28` eingeführt. Der isolierte
Staging-Harness aus `b47ce9b` und die Dokumentation aus `9c27fa6` prüfen:

- korrekte Geräteauthentifizierung und Geräteisolation,
- höchstens einen Command pro Aktor,
- getrennte Commands für Bewässerung, Dachfenster und Seitenfenster,
- wiederholte Auslieferung vor ACK,
- getrennte ACKs pro Aktor,
- idempotente Wiederholung identischer ACKs,
- Abweisung eines Cross-Device-ACK mit HTTP 409,
- vollständige Entfernung aller synthetischen Fixtures.

PostgreSQL liefert UTC-Zeitstempel über PostgREST mit `+00:00` und bis zu sechs
Nachkommastellen. Commit `0ec1788` normalisiert ausschließlich dieses
nachgewiesene Format für die bestehende strikte Domainvalidierung. Alle
anderen Zeitstempelformate und Validierungsregeln bleiben unverändert.

Der abschließende Staging-Lauf meldete:

```text
C3.5 STAGING INTEGRATION PASSED
```

Der unabhängige Read-only-Postflight bestätigte:

```json
{
  "device_commands_exists": true,
  "fixture_greenhouses": 0,
  "fixture_devices": 0,
  "fixture_commands": 0
}
```

## Firmware-Transport und ACK-Lebenszyklus

Relevante Firmware-Commits:

- `f20abcb`: Command-Protokoll und persistenter Zustand,
- `2956c03`: verifizierter TLS-Polltransport,
- `ab890d1`: getrennte Aktorcontroller,
- `f306185`: Poll-, ACK- und Loop-Orchestrierung,
- `33b5e13`: CH5-Safety, eindeutige Poll-Autorität und verifizierter
  Heartbeat-TLS-Pfad,
- `282e55a`: gemeinsamer kanonischer Sketchordner für Arduino IDE und CLI.

Bestätigte Eigenschaften:

- Heartbeat HTTP 200,
- wiederholte erfolgreiche Pollzyklen,
- monotone Sequenzen pro Aktor,
- persistente ACKs bis zur Bestätigung,
- idempotente Poll- und ACK-Wiederholung,
- kein zweites physisches Ausführen eines bereits angewendeten Commands,
- CH1 bis CH4 bleiben deaktiviert,
- CH5 bleibt der einzige physisch vorgesehene Aktorpfad.

## Abnahmekriterien

Der Block gilt als abgeschlossen, weil:

- TLS für Heartbeat und Poll ohne `setInsecure()` funktioniert,
- Heartbeats wiederholt mit HTTP 200 bestätigt wurden,
- der Poll-Endpunkt gültige gespeicherte PostgreSQL-Commands akzeptiert,
- Geräteisolation, One-per-Actor und Cross-Device-Schutz bestanden sind,
- der vollständige ACK-Lebenszyklus einschließlich Wiederholung bestanden ist,
- sämtliche synthetischen Staging-Testdaten entfernt wurden,
- Unit-, Integration-, Firmware- und Migrationstests bestanden sind,
- TypeScript, Lint und der Produktions-Build bestanden sind,
- temporäre Boot- und aktive Diagnosemarkierungen entfernt wurden.

Abschließender automatischer Lauf:

| Prüfung | Ergebnis |
| --- | --- |
| Unit-Tests | 35/35 bestanden |
| Integrationstests | 22/22 bestanden |
| Firmwaretests | 36/36 bestanden |
| Migrationstests | 47/47 bestanden |
| TypeScript | bestanden |
| ESLint | bestanden |
| Secret-freier Next.js-Produktions-Build | bestanden |

Insgesamt wurden 140 automatisierte Tests ohne Fehler abgeschlossen. Der
Build enthielt die dynamischen Routen `/api/device/heartbeat` und
`/api/device/commands/poll`.

## Bewusste Grenze

Dieser Abschluss gibt keine Fensterhardware und keine neuen Funktionen frei.
Er bildet den sauberen Ausgangspunkt für den nächsten separat freizugebenden
Funktionsblock.
