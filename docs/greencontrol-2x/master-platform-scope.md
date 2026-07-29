# Pfaff Platform – Master-Platform-Zielbild

## Ziel

GreenControl 2.x bleibt ein fachlich eigenständiges Modul, wird aber so
geschnitten, dass es später Teil einer größeren Pfaff Platform sein kann.

```text
Pfaff Platform
├── gemeinsame Organisationen, Standorte und Identitäten
├── gemeinsame Benutzer, Rollen und Berechtigungen
├── gemeinsame Geräteidentitäten und Flottenverwaltung
├── gemeinsames Audit und Benachrichtigungen
├── modulare Navigation und Plattform-Shell
└── Module
    ├── GreenControl
    ├── Weather
    ├── Camera
    ├── RobotControl
    ├── Warehouse
    ├── AI
    └── weitere Module
```

## Gemeinsame Plattformdomänen

- Organisation/Betrieb
- Standort
- Benutzeridentität
- Mitgliedschaft, Rolle und Einzelberechtigung
- Geräteidentität, Credential und Presence
- Plugin-Katalog
- Benachrichtigungskanäle
- Audit
- Firmware-/OTA-Katalog
- Backup-/Exportmetadaten
- modulare Navigation

## GreenControl-Domäne

GreenControl besitzt:

- Gewächshäuser
- Komponenten und Hardwarebindungen
- Klima-, Bewässerungs- und Fensterregeln
- Messwerte und Agrarverlauf
- GreenControl-spezifische Warnungen
- Automationen innerhalb der Modulgrenze

GreenControl besitzt nicht die globale Benutzeridentität, Organisation,
Gerätecredential-Implementierung oder plattformweite Benachrichtigung.

## Einfache App und technische Master Platform

Die normale GreenControl-App zeigt:

- aktuellen Zustand und verständliche Warnungen
- fachliche Sollwerte
- Temperatur in °C
- Bewässerungs- und Fensterzeiten in Minuten
- Wind in km/h
- Feuchte in %
- EC in mS/cm
- pH und sensorspezifisch deklarierte NPK-Einheiten
- sichere Bedienaktionen gemäß Rolle

Ausschließlich die Master Platform zeigt oder ändert:

- GPIOs, Relaiskanäle und aktive Logik
- Busse, Adressen, Baudrate und Register
- Hardwareprofile und Treiber
- Rohdaten, Skalierung und Byte-Reihenfolge
- Safety Policies und Fallbacks
- Pluginfreigaben
- globale Firmware- und OTA-Rollouts

Diese Trennung ist eine Berechtigungs- und API-Grenze, nicht nur eine
Darstellungsentscheidung.

## Integrationsprinzipien

- stabile interne APIs und Ereignisse
- IDs aus gemeinsamen Plattformdomänen statt Kopien
- kein direkter Tabellenzugriff zwischen Modulen
- modulbezogene Permissions mit Plattformpräfix
- Audit enthält Modul, Tenant, Akteur und Ziel
- Navigation wird aus freigegebenen Modulen erzeugt
- Datenfreigabe zwischen Modulen ist explizit und tenantgeprüft

## Nicht Bestandteil von GreenControl 2.x

Weather, Camera, RobotControl, Warehouse und AI werden jetzt nicht
implementiert. Vorbereitet werden nur Identitäten, Grenzen, Navigation,
Ereignisse und Erweiterungspunkte.
