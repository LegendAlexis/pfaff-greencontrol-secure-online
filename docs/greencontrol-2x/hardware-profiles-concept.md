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

## Fensterfähigkeit und Komponentenaktivierung

Ein Hardwareprofil beschreibt, ob und wie die Hardware Dachfenster und
Fensterwand technisch unterstützen kann. Es aktiviert die Komponenten nicht
selbst. Hardwarefähigkeit und betrieblicher Aktivstatus bleiben getrennte
Konzepte:

- Das Hardwareprofil beschreibt verfügbare Relaiskanäle, aktive Logik,
  Sensoranschlüsse, Endschalter und Sicherheitsgrenzen.
- Die Master-Platform-Konfiguration verwaltet `enabled` und die
  betriebsspezifischen Regeln jeder Komponenteninstanz.
- Die universelle Firmware enthält die technisch vollständige Fensterlogik.

Dachfenster und Fensterwand erhalten getrennte Profilbindungen für:

- Öffnungs- und Schließrelais,
- optionale beziehungsweise verpflichtende Sensoren,
- Endschalter,
- maximale Laufzeiten und lokale Safety-Fähigkeiten.

Der Pilot verwendet zunächst für beide Komponenten `enabled=false`. In diesem
Zustand bleiben die jeweiligen Richtungsrelais AUS, Fensterbefehle und
Automationen sind wirkungslos und der Status lautet „Deaktiviert“. Eine spätere
Aktivierung erfolgt ausschließlich durch eine validierte Master-Platform-
Konfiguration nach erfolgreicher Hardware- und Sicherheitsprüfung; ein
Firmwarefork ist nicht vorgesehen.

Die Phase-1B-/1C-Baseline blockiert CH1 bis CH4 statisch. Diese Sperre ist kein
Zielmerkmal des Hardwareprofils. Sie wird erst in einer später freigegebenen
Fenster-Implementierungsphase durch die dynamische, komponentenbezogene
`enabled`-Auswertung ersetzt und bleibt bis dahin unverändert.
