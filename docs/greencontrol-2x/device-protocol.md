# GreenControl 2.x – Geräteprotokoll

## Aktueller Heartbeat

Endpunkt: `POST /api/device/heartbeat`

Authentifizierung:

- Header `X-Device-Id`
- Header `X-Device-Secret`
- Gerät wird über UUID gesucht
- Secret wird mit SHA-256 gehasht und timing-safe verglichen
- Gerät muss `active = true` sein

Firmware sendet:

- Status und Firmwareversion
- Temperatur
- Dach-/Wand-Endlagen
- Bewässerungs- und Heizungs-Istzustand
- Druckstatus, WLAN-Signal und Laufzeit

Der aktuelle Server verarbeitet tatsächlich:

- `temperature` im Bereich größer −50 und kleiner 80 °C
- `status`, maximal 40 Zeichen
- `watering_on`
- `roof_window_open`
- `wall_window_open`
- `firmware_version`

Druck, Heizung, WLAN-Signal, Laufzeit und geschlossene Endlagen werden derzeit
vom Server ignoriert.

## Ablauf

```text
Firmware
  -> Heartbeat + ID/Secret
API
  -> Gerät prüfen
  -> devices.last_seen / firmware_version aktualisieren
  -> greenhouses Temperatur, Status, last_seen, watering_on aktualisieren
  -> sensor_readings einfügen
  -> aktive Zeitpläne in Europe/Zurich auswerten
  -> Frostpriorität anwenden
  <- commands mit Zielzuständen
Firmware
  -> Fensterbefehle ignorieren
  -> Bewässerungs-/Heizungsbefehl über Safety Controller anwenden
```

Die serverseitige Zeitplanlogik unterstützt den Mitternachtswechsel. Wochentage
und konfigurierbare Zeitzonen fehlen.

## Zielprotokoll

Das 2.x-Protokoll benötigt Versionen, Konfigurations-ID und Hash, ACK/NACK,
idempotente Befehls-IDs, Ablaufzeiten, Replay-Schutz, Ist-/Sollzustände,
Messwertqualität, Diagnose, letzte gültige Konfiguration und OTA-Zustände.
Lokale Sicherheit bleibt vorrangig.

## Firmwareinvarianten

- DS18B20 bleibt auf GPIO21.
- Der in der geheimen `GCConfig.h` konfigurierte, aktuell funktionierende
  Bewässerungskanal wird ohne Hardwaretest nicht verändert.
- Fenster CH1–CH4 bleiben deaktiviert und AUS.
- Bei Frost wird Bewässerung lokal ausgeschaltet.
- Bei veraltetem Cloudbefehl werden Fenster und Bewässerung gestoppt.

