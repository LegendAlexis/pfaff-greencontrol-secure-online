# Phase 1C – lokale Firmware-Buildumgebung

## Umfang

Phase 1C erfasst ausschließlich lokale, nicht geheime Arduino- und
Boardmanager-Metadaten und kompiliert die Phase-1B-Baseline ohne Upload.
Firmwarelogik, Versionsnummer und Hardware wurden nicht verändert.

Nicht gelesen oder ausgegeben wurden:

- `.env.local`,
- die ursprüngliche oder eine lokale `GCConfig.h`,
- WLAN-Passwörter,
- Geräte-Secrets.

## Lokal verifizierte Toolchain

| Bestandteil | Version beziehungsweise Wert |
|---|---|
| Arduino IDE | 2.3.10 |
| In der IDE enthaltene Arduino CLI | 1.5.1 |
| ESP32-Boardpaket/Core | 3.3.10 |
| Zuletzt gespeichertes Boardprofil | ESP32S3 Dev Module |
| FQBN | `esp32:esp32:esp32s3` |
| ArduinoJson | 7.4.3 |
| DallasTemperature | 4.0.6 |
| OneWire | 2.3.8 |

Die FQBN wurde als vollständige Zeichenfolge im lokalen Arduino-IDE-Speicher
gefunden. Dort waren keine expliziten Boardoptionsüberschreibungen
gespeichert. Arduino CLI löst deshalb für diese FQBN die nachfolgenden
lokalen Profilstandards auf.

## Aufgelöste Boardoptionen

| Option | Lokaler Standard |
|---|---|
| Upload Speed | 921600 |
| USB Mode | Hardware CDC and JTAG (`hwcdc`) |
| USB CDC On Boot | Disabled (`default`) |
| USB Firmware MSC On Boot | Disabled (`default`) |
| USB DFU On Boot | Disabled (`default`) |
| Upload Mode | UART0 / Hardware CDC (`default`) |
| CPU Frequency | 240 MHz (`240`) |
| Flash Mode | QIO 80 MHz (`qio`) |
| Flash Size | 4 MB (`4M`) |
| Partition Scheme | Default 4 MB with SPIFFS, 1.2 MB APP / 1.5 MB SPIFFS (`default`) |
| Core Debug Level | None (`none`) |
| PSRAM | Disabled (`disabled`) |
| Arduino Runs On | Core 1 |
| Events Run On | Core 1 |
| Erase All Flash Before Upload | Disabled (`none`) |
| JTAG Adapter | Disabled (`default`) |
| Zigbee Mode | Disabled (`default`) |

Diese Werte sind die lokal definierten Standards des Profils und keine
Messung der tatsächlich bestückten Flash- oder PSRAM-Hardware. Für den
reproduzierten Baseline-Compile sind sie eindeutig; vor einem späteren Flash
müssen Boardhardware und Optionen separat bestätigt werden.

## Compile

Verwendet wurde das bereits versionierte Skript:

`scripts/firmware/compile-current.ps1`

Sinngemäßer Aufruf:

```powershell
& scripts/firmware/compile-current.ps1 `
  -Fqbn "esp32:esp32:esp32s3" `
  -ArduinoCli "<LOKALER_ARDUINO-IDE-PFAD>\arduino-cli.exe"
```

Das Skript:

1. erstellt ein eindeutig benanntes temporäres Verzeichnis,
2. kopiert ausschließlich den kanonischen Sketchordner unter
   `firmware/current/Pfaff_GreenControl_Firmware_v1_3_1_GPIO21_windows_off/`,
3. schließt jede vorhandene `GCConfig.h` aus,
4. erstellt nur temporär eine secret-freie `GCConfig.h` aus
   `GCConfig.example.h`,
5. ruft ausschließlich `arduino-cli compile` auf,
6. entfernt das temporäre Verzeichnis im `finally`-Block.

### Ergebnis

- Exitcode: 0
- Programmspeicher: 1.058.005 von 1.310.720 Byte (80 %)
- Globale Variablen: 47.524 von 327.680 Byte (14 %)
- Verbleibender dynamischer Speicher: 280.156 Byte

## Nachweis: kein Flashen

- Es wurde ausschließlich der CLI-Unterbefehl `compile` verwendet.
- Das Skript besitzt keinen Aufruf von `upload`.
- Es wurde kein serieller Port übergeben.
- Es wurde kein Gerät ausgewählt oder angesprochen.
- Es wurde kein OTA-Aufruf ausgeführt.
- Buildartefakte lagen ausschließlich temporär vor und wurden entfernt.

## Architekturvorbehalt

Die erfasste Umgebung reproduziert die Phase-1B-Baseline. Sie legt weder die
endgültige Firmwarestruktur noch das spätere Hardwareprofil-, Buildmatrix-
oder Releasekonzept fest.
