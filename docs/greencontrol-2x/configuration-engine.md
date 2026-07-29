# GreenControl 2.x – Configuration Engine

## Ziel

Eine zentrale Configuration Engine ersetzt fest codierte Spezialfälle.
Fenster, Bewässerung, Heizung, Lüfter, Sensoren und Kameras verwenden dasselbe
Komponentenmodell. Unterschiede liegen in Plugin, Binding, Settings und Safety
Policy.

## Konfigurationshülle

```json
{
  "schemaVersion": 1,
  "deviceId": "device-uuid",
  "configVersion": 12,
  "hardwareProfile": "waveshare-esp32-s3-eth-8di-8ro",
  "generatedAt": "2026-07-29T10:00:00Z",
  "minimumFirmwareVersion": "2.0.0",
  "components": []
}
```

Jede Komponente enthält:

```json
{
  "componentId": "component-uuid",
  "pluginId": "pfaff.watering.relay",
  "pluginVersion": "1.0.0",
  "enabled": false,
  "deviceId": "device-uuid",
  "hardwareBinding": {},
  "settings": {},
  "safetyPolicy": {},
  "automationBindings": [],
  "telemetry": {},
  "fallbackState": {}
}
```

## Zustandsmaschine

```text
DRAFT
 -> VALIDATING
 -> VALID
 -> PUBLISHED
 -> OFFERED
 -> DOWNLOADED
 -> DEVICE_VALIDATED
 -> APPLIED
 -> CONFIRMED

Fehler:
VALIDATING/DOWNLOADED/DEVICE_VALIDATED
 -> REJECTED mit Fehlercodes

Laufzeitfehler:
APPLIED
 -> ROLLBACK_PENDING
 -> vorherige CONFIRMED-Version
```

## Ablauf

1. Plattform erzeugt eine unveränderliche Konfigurationsversion.
2. Serverseitige Validierung prüft Schema, Pluginversionen, Berechtigungen,
   Hardwareprofil und Ressourcen.
3. Publizierung signiert Manifest und Payload.
4. Gerät lädt nur eine höhere ausdrücklich angebotene Version.
5. Gerät prüft Signatur, Hash, Schema, Firmwarekompatibilität und Bindings.
6. Gerät berechnet den vollständigen Ressourcenplan, ohne Ausgänge zu ändern.
7. Ungültige Konfiguration wird mit strukturiertem Fehler abgelehnt.
8. Gültige Konfiguration wird atomar angewendet.
9. Gerät meldet Version, Komponentenstatus und Health.
10. Erst nach Health-Check wird die Version bestätigt.
11. Letzte bestätigte Konfiguration bleibt lokal erhalten.

## Konfliktprüfung

Vor Anwendung werden mindestens geprüft:

- doppelter GPIO
- doppelter Relaiskanal
- unvereinbare Ein-/Ausgangsmodi
- I²C-Adresskonflikt pro Bus
- OneWire-Pin und Pull-up-Anforderung
- UART-/RS485-Port, Baudrate und Richtungspin
- Timer-/PWM-Konflikte
- Versorgung/Spannung laut Hardwaremetadaten
- Komponentenabhängigkeiten
- Firmwaretreiber und Mindestversion
- reservierte Pins des Hardwareprofils
- gegensätzliche Relais eines Motors

## Fallback

| Komponententyp | Standard-Fallback |
|---|---|
| Bewässerung | AUS |
| Fenster | beide Richtungen AUS |
| Heizung | projektspezifisch; harte Temperatur-Safety lokal |
| Lüfter | projektspezifischer sicherer Zustand |
| Beleuchtung | AUS |
| Sensor | letzter Wert als veraltet markieren, nicht als aktuell verwenden |
| Kamera | Aufnahme/Stream AUS, sofern keine Safety-Aufgabe |

Cloud-Ausfall bewirkt keine unkontrollierte Fortsetzung. Zeitkritische lokale
Safety-Regeln bleiben aktiv. Ob eine Automation offline weiterlaufen darf, ist
explizit versioniert und benötigt sichere lokale Daten.

## Versionierung und Rollback

- Versionen sind pro Gerät streng monoton.
- Jede Version referenziert ihre Vorgängerversion.
- Bestätigte Versionen sind unveränderlich.
- Rollback ist eine neue auditable Operation mit Zielversion.
- Gerät verwirft Teilanwendungen.
- Bootfehler oder fehlender Health-Check aktivieren die letzte bestätigte
  Version.
- Plattform zeigt gewünschte, angewandte und bestätigte Version getrennt.

## Fenster als normale Komponente

`enabled=false` bedeutet unabhängig vom Plugin:

- beide Ausgangsrichtungen AUS
- neue Befehle abweisen
- Automationen überspringen
- Zustand als `disabled` melden

`enabled=true` ist nur zulässig, wenn beide Kanäle, aktive Logik, Endschalter,
Laufzeitlimit, Richtungswechselpause, Verriegelung, Not-Aus und sicherer
Testnachweis vorhanden sind. Dach und Wand sind getrennte Instanzen desselben
Fenster-Plugins.

## Verbindliches Fenster-Konfigurationsmodell

Dachfenster und Fensterwand sind vollständig getrennte Komponenten. Jede
Instanz besitzt mindestens:

- `enabled`
- `mode`: `manual` oder `automatic`
- `openingTemperatureC`
- `closingTemperatureC`
- `maximumOpeningTimeMinutes`
- `maximumClosingTimeMinutes`
- Öffnen-/Schließen-Binding
- eigene Sensorbindungen
- Endschalterkonfiguration
- Not-Aus- und Verriegelungspolicy
- aktuellen Bewegungs-, Fehler- und Positionszustand

Es gilt zwingend:

`openingTemperatureC > closingTemperatureC`

### Manueller Modus

Zulässige Befehle:

- Öffnen
- Stoppen
- Schließen

Wetter und Temperatur dürfen im manuellen Modus niemals automatisch
eingreifen. Aktiv bleiben ausschließlich lokale Sicherheitsfunktionen:

- nie Öffnen und Schließen gleichzeitig
- Stoppen schaltet beide Richtungen sofort AUS
- Endschalter
- maximale Laufzeit
- Not-Aus
- Relaisverriegelung

### Automatikmodus

Nur im Automatikmodus werden Wetter und Temperatur ausgewertet:

1. Not-Aus oder Fehler
2. Wetter: Regen, Schnee und Wind
3. Temperatur

Temperatur-Hysterese:

- Temperatur ab Öffnungstemperatur → öffnen
- Temperatur bis Schließungstemperatur → schließen
- dazwischen → aktuellen Zustand halten

### Dachfenster

Das Dachfenster besitzt Endschalter. Der jeweilige Endschalter beendet die
Fahrt. Maximale Öffnungs- und Schließzeiten wirken zusätzlich als
Sicherheitsgrenze. Wird die erwartete Endlage nicht rechtzeitig erreicht:

- beide Motorrichtungen AUS
- Komponente in Fehlerzustand
- Warnung erzeugen
- keine neue Fahrt ohne definierte Quittierung/Reset

### Fensterwand

Die Fensterwand fährt zunächst zeitbasiert. Maximale Öffnungs- und
Schließzeiten bestimmen die sichere Fahrtgrenze. Später ergänzte Sensoren
beenden die Fahrt vorzeitig; die Zeitgrenze bleibt immer aktiv.

## Einheitenmodell

Einheiten sind Bestandteil der Feld- und Messwertdefinition, nicht bloß
Beschriftung. Speicherung, Validierung, API und Anzeige verwenden kanonische
Einheiten:

| Größe | Kanonische Einheit |
|---|---|
| Temperatur | °C |
| Bewässerungsdauer | Minuten |
| Fenster-Öffnungszeit | Minuten |
| Fenster-Schließzeit | Minuten |
| Wind | km/h |
| Bodenfeuchtigkeit | % |
| Luftfeuchtigkeit | % |
| EC | mS/cm |
| pH | dimensionslos, Anzeige `pH` |
| NPK | sensorspezifisch, Einheit im Plugin verpflichtend |

Jedes Eingabefeld und jede Anzeige zeigt seine Einheit. Technische Bindings,
Pins, aktive Logik, Busparameter und Rohwerte erscheinen ausschließlich in der
Master Platform. Die normale App zeigt nur fachlich notwendige Einstellungen.
