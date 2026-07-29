# Hardwareprofile – Architekturkonzept

## Zweck

Ein Hardwareprofil beschreibt die technischen Fähigkeiten und die feste
Hardwarebelegung einer Geräteklasse. Es ist unabhängig von Zugangsdaten,
Betriebsgeheimnissen und der kundenbezogenen Anlagenkonfiguration.

Hardwareprofile sind ein eigenständiges Architekturkonzept. Phase 1B
dokumentiert lediglich die aktuelle Baseline; sie implementiert weder eine
Profil-Engine noch legt sie das endgültige Dateiformat oder den Ablageort fest.

## Verantwortungsgrenzen

Ein zukünftiges Hardwareprofil kann enthalten:

- Boardtyp, Boardvariante und Prozessor,
- GPIO-, Bus-, Relais- und Eingangsbelegung,
- Zuordnung physischer Kanäle zu nullbasierten Firmwarewerten,
- Active-High-/Active-Low-Eigenschaften,
- Sensor- und Aktortypen,
- Endschalter und lokale Sicherheitseingänge,
- aktivierbare Firmwarefähigkeiten,
- hardwarebezogene Laufzeit- und Sicherheitsgrenzen.

Ein Hardwareprofil enthält niemals:

- WLAN-Zugangsdaten,
- API-Endpunkte mit produktiven Identitäten,
- Geräte-Secrets oder Tokens,
- kundenbezogene Zeitpläne,
- produktive Tenant- oder Betriebsdaten.

`GCConfig.h` ist daher kein Hardwareprofil. Sie bleibt eine lokale,
nicht-versionierte Gerätekonfiguration.

## Phase-1B-Baselineprofil

Arbeitsbezeichnung: `v1_3_1_GPIO21_windows_off`

| Eigenschaft | Wert |
|---|---|
| Boardfamilie | Waveshare ESP32-S3-ETH-8DI-8RO |
| Exakte FQBN | unknown |
| Temperatursensor | DS18B20 |
| Temperatur-Datenpin | GPIO21 |
| Bewässerung | physisch CH5 / Firmwarewert 4 |
| Dachfenster | CH1/CH2 deaktiviert |
| Fensterwand | CH3/CH4 deaktiviert |
| Fensterbewegung | nicht zulässig |

Die Bezeichnung ist eine dokumentierte Baseline und noch kein endgültiger,
maschinenlesbarer Profilbezeichner.

## Spätere Architekturentscheidung

Eine spätere Architekturphase legt fest:

- Schema und Versionierung von Profilen,
- Ablage im Repository,
- Validierung und Vererbung,
- Bindung an Firmwarevarianten,
- sichere Generierung lokaler Konfiguration,
- Kompatibilitäts- und Migrationsregeln,
- Testmatrix für mehrere Boards.

Bis dahin bleibt `firmware/current/` unverändert und das hier beschriebene
Profil rein dokumentarisch.
