# GreenControl 2.x – Plugin-Spezifikation

Status: Phase-0-Zielentwurf; noch keine Plugin-Implementierung vorhanden.

## Manifest

```json
{
  "pluginId": "vendor.model.capability",
  "version": "1.0.0",
  "manufacturer": "example",
  "models": ["model"],
  "category": "sensor",
  "interfaces": ["onewire"],
  "configSchema": {},
  "measurementSchema": {},
  "discoveryRules": [],
  "minimumFirmwareVersion": "0.0.0",
  "securityRequirements": {},
  "uiMetadata": {},
  "driverId": "builtin:driver",
  "approvalStatus": "draft",
  "visibility": "greenhouse",
  "hardwareProfiles": ["waveshare-esp32-s3-eth-8di-8ro"]
}
```

## Regeln

- stabile Plugin-ID und unveränderliche semantische Version
- versionierte JSON-Schemas für Konfiguration und Messwerte
- kanonische Einheiten und Messwertqualität
- registrierte Treiberkennung statt beliebigem Mandantencode
- maschinenlesbare Pin-, Kanal-, Bus- und Adressansprüche
- erzwingbare Firmware-Mindestversion und Hardwareprofile
- serverseitige Prüfung von Freigabe und Sichtbarkeit
- Aktoren starten deaktiviert und in sicherem Testmodus

Sichtbarkeit:

- nur Gewächshaus
- gesamter Betrieb
- alle eigenen Betriebe
- global nach Master-Freigabe und Step-up-MFA

## Discovery und Assistent

Discovery darf I²C, OneWire, UART, Modbus/RS485, unterstütztes USB und Netzwerk
prüfen. Ergebnisse sind Kandidaten mit Konfidenz und Rohbefund. Gefährliche
Aktoren werden nie automatisch aktiviert.

Der Assistent beginnt fachspracharm mit Gerätetyp, Funktion,
Hersteller/Modell, Dokumentation, Kabeln und Anschluss. GPIO, Adresse, Baudrate,
Register, Datentyp, Byte-Reihenfolge, Skalierung und Einheit erscheinen erst im
erweiterten Modus. Proprietäre unbekannte Protokolle werden als
„Firmware-Treiber erforderlich“ markiert.

Der Boden-Multisensor wird erst nach Ermittlung seines realen Protokolls als
Plugin spezifiziert.

