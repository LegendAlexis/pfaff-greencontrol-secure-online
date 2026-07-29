# GreenControl 2.x – Legacy-Firmware-Policy

## Klassifikation

`waveshare_greenhouse_frost_safe.ino` ist **Legacy / DO NOT FLASH**.

Sie ist nicht der aktuelle funktionierende Stand und widerspricht dem
verbindlichen Fenster-Aus-Zustand.

## Dokumentierte Risiken

- fest eingetragene WLAN- und Cloudzugangsdaten
- direkte Kopplung an ein bestimmtes Supabase-Projekt und Gewächshaus
- keine Geräte-ID-/Secret-Authentifizierung am aktuellen Heartbeat
- deaktivierte Zertifikatsprüfung
- Fensterrelais sind aktiv ansteuerbar
- abweichende Relaisarchitektur und Kanalannahmen
- lokale Zeitplanauswertung ohne korrekten Mitternachtswechsel
- keine modulare Hardware-/Treiberstruktur
- keine Konfigurationsversion, Bestätigung oder Rollback

Enthaltene Zugangsdaten gelten als potenziell kompromittiert. Ob sie noch aktiv
sind, muss außerhalb des Repositorys geprüft werden. Aktive Werte sind zu
rotieren; der Abschluss wird ohne Geheimwerte auditiert.

## Spätere Archivierung

Nach ausdrücklicher Freigabe:

```text
firmware/
├── README.md
├── current/
│   └── modulare, versionierte Firmware
└── legacy/
    ├── README.md          DO NOT FLASH
    └── waveshare_greenhouse_frost_safe.ino
```

Die Legacy-README nennt:

- Status `DO NOT FLASH`
- ersetzenden Firmwarestand
- bekannte Risiken
- historischen Zweck
- Datum der Stilllegung
- Secret-Rotationsstatus ohne Secretwerte

## Buildschutz

- Legacy-Pfad ist in keinem PlatformIO-/Arduino-CI-Buildziel enthalten.
- CI schlägt fehl, wenn Legacy-Dateien als Produktionsquelle referenziert sind.
- Release-Artefakte stammen nur aus `firmware/current` und einem manifestierten
  Hardwareprofil.
- Firmwarepakete tragen Quellcommit, Version, Profil, Hash und Signatur.
- Flash-Anleitungen nennen niemals Legacy-Dateien.

## Aktuelle Firmware

Der modulare Ordner `Pfaff_GreenControl_Firmware_v1_3_1_GPIO21_windows_off` ist
die funktionale Referenz. Er wird später unter Versionskontrolle übernommen,
ohne `GCConfig.h`. Vorher sind reproduzierbarer Build, Bibliotheksversionen,
Hardwaretest und Klärung der Versionsangabe 1.3.1/1.2.0 erforderlich.

In Phase 0.5 wurde keine Firmwaredatei verschoben oder verändert.

