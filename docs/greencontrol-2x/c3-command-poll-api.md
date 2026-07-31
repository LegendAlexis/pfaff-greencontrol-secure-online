# C3 – Command-Poll-API

## Umfang

C3 ergänzt ausschließlich `POST /api/device/commands/poll`. Firmware,
Heartbeat, Hardwaresteuerung und Datenbankschema werden nicht verändert.

Der Endpunkt verwendet die bestehende Geräteauthentifizierung mit
`X-Device-Id` und `X-Device-Secret`. Das Gerät muss existieren und aktiv sein;
das Secret wird weiterhin timing-safe gegen seinen SHA-256-Hash geprüft.

## Anfrage

Die Anfrage verwendet Protokollversion 1, alle drei aktorbezogenen
Sequenzstände und maximal 20 getrennte ACKs:

```json
{
  "protocol_version": 1,
  "firmware_version": "1.3.1",
  "last_applied_sequences": {
    "watering": 3,
    "roof_window": 0,
    "side_window": 0
  },
  "acknowledgements": []
}
```

## Antwort

Der Endpunkt liefert höchstens den neuesten offenen, nicht abgelaufenen
Command je Kernaktor. `poll_after_ms` beträgt 1500. Jede Antwort verwendet
`Cache-Control: no-store`.

```json
{
  "ok": true,
  "protocol_version": 1,
  "server_time": "2026-07-31T12:00:00.000Z",
  "poll_after_ms": 1500,
  "commands": []
}
```

## ACK-Verarbeitung

Vor jeder Änderung werden alle ACK-IDs zusammen gelesen und gegen
Geräte-ID, Aktor und Sequenz geprüft. Fehlt ein Datensatz oder gehört er nicht
zum authentifizierten Gerät, wird der gesamte Batch mit HTTP 409 abgelehnt.

Jede ACK-Aktualisierung filtert nochmals nach:

- Command-ID,
- authentifizierter Geräte-ID,
- Aktor,
- Sequenz.

Wiederholte ACKs mit demselben finalen Status bleiben zulässig und
idempotent. Ein widersprüchliches ACK darf einen bereits final bestätigten
Command nicht umschreiben. Pro Poll sind maximal 20 eindeutige Command-IDs
erlaubt.

## Fehlerverhalten

| Status | Bedeutung |
|---|---|
| 200 | Poll und ACKs erfolgreich |
| 400 | ungültiges JSON oder Protokoll |
| 401 | Gerätezugang fehlt, ist falsch oder Gerät ist deaktiviert |
| 409 | ACK gehört nicht vollständig zum authentifizierten Gerät |
| 500 | Datenbankfehler oder gespeicherter Command verletzt die Domain |

Ein ungültiger gespeicherter Command wird niemals ausgeliefert oder als
zugestellt markiert.

## Heartbeat-Kompatibilität

`POST /api/device/heartbeat` bleibt unverändert und liefert weiterhin den
Bewässerungszielzustand als bestehende Rückfallebene. C3 wird von der
aktuellen Firmware noch nicht aufgerufen.

## Noch nicht enthalten

- Erzeugen von Commands aus App-Aktionen,
- Firmware-Polling,
- physische Relaissteuerung,
- Fensteraktivierung,
- Command-Coalescing oder Ablaufbereinigung,
- Anwendung der C2-Migration auf Produktion.
