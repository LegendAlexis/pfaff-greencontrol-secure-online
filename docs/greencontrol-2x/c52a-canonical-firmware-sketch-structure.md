# C5.2a – kanonische Firmware-Sketchstruktur

## Ziel und Umfang

Diese isolierte Strukturphase vereinheitlicht die Buildquelle für Arduino IDE
und `arduino-cli`. Sie verändert keine Firmwarelogik, Pinbelegung,
Konfiguration, Relaisfreigabe oder Gerätekommunikation.

## Kanonische Buildquelle

```text
firmware/current/
└── Pfaff_GreenControl_Firmware_v1_3_1_GPIO21_windows_off/
    ├── Pfaff_GreenControl_Firmware_v1_3_1_GPIO21_windows_off.ino
    ├── GCConfig.example.h
    ├── GCConfig.h                 # ausschließlich lokal und ignoriert
    └── GC*.cpp / GC*.h
```

Der Sketchordner und die primäre `.ino` besitzen denselben Namen. Sämtliche
kompilierten `.cpp`- und `.h`-Dateien liegen direkt daneben. Zusätzliche
Include-Pfade oder eine für die Arduino IDE künstlich zusammengesetzte
Quellstruktur sind damit nicht notwendig.

## Buildwege

- Die Arduino IDE öffnet die `.ino` im kanonischen Sketchordner.
- `arduino-cli` erhält denselben Sketchordner als letztes Argument.
- Das secret-freie Regressionstest-Harness kopiert genau diesen Ordner in ein
  temporäres Verzeichnis und ersetzt dort ausschließlich die nicht
  versionierte `GCConfig.h` durch `GCConfig.example.h`.

Für die beaufsichtigte ESP32-S3-Diagnose wird die vollständige FQBN
`esp32:esp32:esp32s3:USBMode=hwcdc,CDCOnBoot=cdc` verwendet.

## Schutz und Rückfall

- `GCConfig.h` bleibt durch `**/GCConfig.h` ignoriert und wird nicht gelesen,
  dokumentiert oder committed.
- `GCConfig.example.h` bleibt versioniert und enthält nur sichere Platzhalter.
- Die Phase ist ein reiner Pfad- und Dokumentationscommit und kann unabhängig
  von Firmwarelogik zurückgesetzt werden.

## Regression

Die Firmwaretests prüfen zusätzlich:

- Übereinstimmung von Sketchordner und `.ino`-Name,
- gemeinsame Ablage aller Firmwarequellen,
- Abwesenheit von `.ino`, `.cpp` und `.h` im Elternordner,
- kanonische Pfade in Manifest und Compile-Harness,
- Git-Schutz der lokalen `GCConfig.h`,
- unveränderte Hardware- und Command-Sicherheitsregeln.
