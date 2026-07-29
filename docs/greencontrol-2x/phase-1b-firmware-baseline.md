# Phase 1B – aktuelle Firmware-Baseline unter Versionskontrolle

## Ergebnis und Grenze

Phase 1B übernimmt den praktisch getesteten modularen Firmwarestand
`v1_3_1_GPIO21_windows_off` unverändert nach `firmware/current/`.
`GCConfig.h` ist davon ausdrücklich ausgeschlossen.

Diese Struktur ist eine Baseline für Integrität, Regressionstests und einen
später reproduzierbaren Compile-Test. Sie ist keine Entscheidung über die
endgültige GreenControl-2.x-Repository- oder Firmwarearchitektur.

## Bestätigte Hardware- und Funktionsbaseline

| Bereich | Bestätigter Stand |
|---|---|
| Temperatur | DS18B20 an GPIO21 |
| Bewässerung | physisch CH5, nullbasierter Firmwarewert 4 |
| Dachfenster | CH1/CH2 deaktiviert |
| Fensterwand | CH3/CH4 deaktiviert |
| Fensterbefehle | dürfen keine Bewegung auslösen |
| Praktisch getestet | Temperatur, manuelle Bewässerung, Zeitplanbewässerung |

Weitere Regressionseigenschaften der GreenControl-Anwendung bleiben durch die
Phase-1A-Tests geschützt. Phase 1B verändert weder Web-App- noch
Firmwarelogik.

## Versionswiderspruch

Der Quellordner und der Sketchname führen v1.3.1. Die unveränderte serielle
Startmeldung führt v1.2.0. Beide Werte werden als getrennte Evidenz im
Buildmanifest gespeichert. Phase 1B ändert weder Startmeldung noch
Versionsnummer.

## Konfigurations- und Geheimnisschutz

- `GCConfig.h` wurde nicht übernommen und nicht gelesen.
- Git ignoriert jede `GCConfig.h`.
- `GCConfig.example.h` ist ausdrücklich erlaubt.
- Die Vorlage enthält ausschließlich Platzhalter und `example.invalid`.
- Lokale Zugangsdaten werden weder getestet noch protokolliert.

## Compile-Test

`scripts/firmware/compile-current.ps1` bereitet einen temporären Sketch vor,
erzeugt dort aus der sicheren Vorlage eine temporäre `GCConfig.h` und ruft
ausschließlich `arduino-cli compile` auf. Das Skript enthält keinen Upload-,
Flash- oder OTA-Befehl und entfernt sein temporäres Verzeichnis immer.

Der Compile-Test bleibt blockiert, bis Arduino CLI, dessen Version, die
ESP32-Core-Version und eine verifizierte FQBN verfügbar sind. Es wird nichts
installiert und kein Boardprofil geraten.

## Architekturvorbehalt

Erst eine spätere Architekturphase entscheidet insbesondere über:

- endgültige Firmwareverzeichnisse,
- Trennung von Kern, Treibern und Hardwareprofilen,
- Buildvarianten und Build-Matrix,
- Konfigurationsgenerierung,
- Test- und Releaseartefakte,
- OTA- und Rollbackstruktur.

Die Phase-1B-Dateien dürfen in dieser späteren Phase migriert werden, ohne die
hier festgehaltene funktionale Baseline zu verlieren.
