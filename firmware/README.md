# Firmware

## Phase-1B-Status

`current/` enthält die unveränderte, praktisch getestete modulare
Firmware-Baseline aus dem Ordner
`Pfaff_GreenControl_Firmware_v1_3_1_GPIO21_windows_off`.

Diese Ablage ist ausschließlich eine nachvollziehbare Versionskontroll- und
Build-Baseline. Sie ist **keine Festlegung der endgültigen Repository- oder
Firmwarearchitektur**. Verzeichnisstruktur, Build-Matrix, Hardwareprofile,
gemeinsame Module und Releaseablage werden erst in einer späteren
Architekturphase festgelegt.

## Abgrenzung

- Aktuelle Buildquelle:
  `firmware/current/Pfaff_GreenControl_Firmware_v1_3_1_GPIO21_windows_off/`
- Legacy-Datei: `/waveshare_greenhouse_frost_safe.ino`
- Die Legacy-Datei bleibt unverändert und ist keine aktuelle Buildquelle.
- `GCConfig.h` ist lokal, geheim und von Git ausgeschlossen.
- `GCConfig.example.h` enthält nur sichere Platzhalter.
- Arduino IDE und `arduino-cli` verwenden denselben kanonischen Sketchordner;
  zusätzliche Include-Pfade oder eine manuell zusammengesetzte Quellstruktur
  sind nicht erforderlich.
- Phase 1B verändert keine Firmwarelogik, aktiviert keine Fenster, flasht kein
  Gerät und implementiert kein OTA.

## Hardware-Baseline

- DS18B20: GPIO21
- Bewässerung: physisch CH5, nullbasierter Firmwarewert 4
- Dachfenster: CH1/CH2 deaktiviert
- Fensterwand: CH3/CH4 deaktiviert
- Fensterbefehle dürfen keine Bewegung auslösen

Hardwareprofile sind als eigenständiges Architekturkonzept in
`docs/greencontrol-2x/hardware-profiles-concept.md` beschrieben. Phase 1B
implementiert noch keine Hardwareprofil-Engine.
