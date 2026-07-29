# GreenControl 2.x – Plugin-Laufzeitmodell

## Pluginumfang

Ein Plugin ist ein versioniertes Funktionspaket und kann enthalten:

- Geräte-/Firmwaretreiberkennung
- Discovery-Regeln
- Konfigurationsschema
- Messwertschema und Einheiten
- Dashboard-Karten
- Diagrammdefinitionen
- Warnungstypen
- Automationsbedingungen
- Automationsaktionen
- Firmware- und Hardwareanforderungen
- Sicherheitsanforderungen
- Testablauf
- Dokumentation und Einrichtungsfragen

Ein CO₂-Plugin bringt damit nicht nur den Sensorzugriff, sondern auch ppm-Werte,
Qualitätsregeln, Dashboard, Verlauf, Warnschwellen und Automationsbedingungen.

Jedes Feld und jeder Messwert deklariert Datentyp, kanonische Einheit,
zulässigen Bereich, Genauigkeit und Anzeigeformat. Die Runtime darf Werte mit
fehlender oder inkompatibler Einheit nicht stillschweigend kombinieren.

## Ebenen

```text
Plugin-Katalog
 -> freigegebene Plugin-Version
 -> Installation im Sichtbarkeitsbereich
 -> Komponenteninstanz
 -> Gerätekonfiguration
 -> Firmware-Treiber
 -> Telemetrie / Aktionen
```

Serverseitige Erweiterungen sind deklarativ oder laufen in kontrollierten,
versionierten Plattformmodulen. Mandanten dürfen keinen beliebigen Code in
Server oder Firmware einschleusen.

## Lebenszyklus

| Operation | Ablauf |
|---|---|
| Definition | Manifest, Schemas, UI, Safety und Tests erstellen |
| Freigabe | Signatur, Review, Kompatibilität und Sicherheitsklasse prüfen |
| Installation | Version in einem erlaubten Sichtbarkeitsbereich verfügbar machen |
| Aktivierung | Komponenteninstanz konfigurieren, testen und freigeben |
| Update | neue Version parallel prüfen, migrieren, simulieren, ausrollen |
| Deaktivierung | Komponenten in Fallback, Automationen stoppen |
| Entfernung | erst ohne aktive Instanzen/Abhängigkeiten; Historie erhalten |

## Versionen und Kompatibilität

- semantische Pluginversion
- unveränderliche veröffentlichte Version
- deklarierte Mindest-/Maximal-Firmware
- unterstützte Hardwareprofile
- Konfigurations-Schema-Version mit Migrationsfunktion
- Telemetrie-Schema-Version
- Abhängigkeiten mit Versionsbereich
- Konflikte und Zyklen werden vor Installation blockiert

Ein Pluginupdate verändert aktive Komponenten nicht automatisch. Es erzeugt
einen Updateplan mit Schema-Migration, Simulation, Test und Rollback.

## Freigabestufen

- `draft`
- `development`
- `test`
- `tenant_approved`
- `master_approved`
- `deprecated`
- `revoked`

Sichtbarkeit:

- Gewächshaus
- Betrieb
- alle eigenen Betriebe
- global nach Master-Freigabe

Private Plugins bleiben ihrem Bereich zugeordnet. Globale Veröffentlichung,
Widerruf und sicherheitsrelevante Updates verlangen Master-Admin, Step-up-MFA
und Audit.

## Runtime

Die Runtime erzeugt aus jeder aktiven Komponenteninstanz:

- validierte Konfiguration
- Ressourcenreservierungen
- Telemetriekanäle
- mögliche Commands
- Warnungsregeln
- Automationsbausteine
- UI-Definitionen
- sicheren Fallback

Treiber- und Plattformversionen werden beim Heartbeat abgeglichen. Fehlt der
Treiber, bleibt die Komponente deaktiviert und wird als
`firmware_driver_required` ausgewiesen.

## UI-Sichten

Plugins liefern getrennte Metadaten für:

- normale App: verständliche fachliche Felder und klar sichtbare Einheiten
- Master Platform: Pins, Kanäle, aktive Logik, Busadressen, Baudrate,
  Skalierung, Rohwerte, Diagnose und Safety-Bindings

Technische Einstellungen werden niemals aufgrund ausgeblendeter UI-Felder
autorisierungsfrei; Zugriff und Änderungen sind serverseitig auf
Master-Berechtigungen begrenzt.
