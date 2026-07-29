# GreenControl 2.x – Universal-Firmware-Strategie

## Ziel

GreenControl verwendet nicht eine individuell angepasste Firmware pro
Gewächshaus. Pro unterstütztem Hardwareprofil gibt es eine universelle,
signierte Firmware.

```text
Universelle Firmware
 + Hardwareprofil
 + eingebaute, versionierte Treiber
 + geladene Gerätekonfiguration
 = konkrete Gerätefunktion
```

## Hardwareprofile

Ein Profil beschreibt Board, CPU, Flash, verfügbare GPIOs, reservierte Pins,
Busse, Relais-/Eingangsexpander, aktive Logik, Netzwerkfähigkeiten,
Boot-/Rollback-Support und Ressourcenlimits.

Primärprofil:

`waveshare-esp32-s3-eth-8di-8ro`

Weitere ESP32-/Waveshare-Boards erhalten eigene Profile, aber dieselbe
Konfigurations- und Protokollarchitektur.

## Firmwaremodule

- Boot, Watchdog und sichere Initialisierung
- Netzwerk und lokales Setup-Portal
- Geräteidentität und Protokoll
- Configuration Engine
- Komponenten-Runtime
- Treiber-Registry
- Safety Controller
- Telemetrie und Diagnose
- lokale Persistenz
- OTA mit Signatur, Health-Check und Rollback

## Treibergrenze

Konfiguration kann nur Treiber aktivieren, die in der Firmware vorhanden sind.
Ein vollständig neuer proprietärer Sensor benötigt einmalig:

1. Protokollanalyse,
2. sicheren Treiber,
3. Firmwaretest,
4. signiertes Firmwareupdate.

Danach kann sein Plugin beliebig oft ohne Quellcodeänderung konfiguriert werden.
Neue Instanzen, Pins, Adressen, Einheiten und Regeln benötigen kein eigenes
Firmwarefork.

## Ausgangsprofil

- DS18B20: GPIO21
- Bewässerung: bestätigtes Binding aus dem funktionierenden Stand
- Dach/Wand: getrennte Komponenten, standardmäßig `enabled=false`
- Frostschutz: lokale nicht überschreibbare Safety Policy

Die bestehende Fensterimplementierung wird nicht als Vorlage übernommen. Die
Universal-Firmware erhält dafür später eine neue generische
Bidirectional-Actuator-State-Machine:

- getrennte Dach- und Wandinstanzen
- Befehle Öffnen, Stoppen, Schließen
- Modus `manual` ohne Wetter-/Temperaturautomation
- Modus `automatic` mit Priorität Fehler → Wetter → Temperatur
- Endschalter und/oder zeitbasierte Positionsführung
- getrennte maximale Zeiten pro Richtung
- verpflichtender Stoppzustand vor Richtungswechsel
- lokale Relaisverriegelung und Not-Aus

## Offline-Verhalten

Die Firmware speichert die letzte bestätigte Konfiguration atomar. Bei
Cloudausfall:

- keine neuen Cloudbefehle
- abgelaufene Befehle werden verworfen
- Fenster stoppen
- Bewässerung fällt gemäß Safety Policy auf AUS
- lokale Frost- und Laufzeitregeln bleiben aktiv
- Messwerte werden begrenzt gepuffert
- Diagnose enthält keine Secrets

## OTA

OTA wird nach Hardwareprofil, Firmwareversion und Rolloutgruppe angeboten.
Gerät prüft HTTPS, Signatur und Hash, schreibt in die inaktive Partition,
startet neu und meldet Health. Ohne Bestätigung erfolgt automatisches Rollback.
Globale Rollouts verlangen Master-Admin und MFA; erster Rollout ist genau ein
benanntes Testgerät.

## Aktueller Übergang

Der modulare Stand v1.3.1 bleibt bis zu bestandenen Regressionstests die
funktionale Referenz. Er wird in Phase 0.5 weder kopiert noch verändert.
`GCConfig.h` bleibt außerhalb der Versionskontrolle.

Seine Fensterlogik ist davon ausgenommen: Referenzfunktionen sind nur
Temperatur/GPIO21, Temperaturanzeige, Bewässerung, Zeitpläne einschließlich
Mitternacht, Frostschutz, Heartbeat und Bewässerungs-Istzustand.

## Verbindliche Fenster-Zielarchitektur und Übergangsregel

Die heutige statische Sperre von CH1 bis CH4 ist ausschließlich eine sichere
Entwicklungs- und Regression-Baseline. Sie ist ausdrücklich nicht die
endgültige Fensterarchitektur.

Die universelle GreenControl-2.x-Firmware soll Dachfenster und Fensterwand
technisch vollständig unterstützen. Beide werden als getrennte Komponenten in
derselben universellen Firmware bereitgestellt und über eine bestätigte
Konfiguration der Master Platform unabhängig voneinander aktiviert oder
deaktiviert. Eine spätere Aktivierung darf weder einen Firmwarefork noch eine
Codeänderung erfordern.

Für den Pilotbetrieb gilt zunächst:

- Dachfenster: `enabled=false`
- Fensterwand: `enabled=false`

Bei `enabled=false` bleiben beide Richtungsrelais der jeweiligen Komponente
sicher AUS, Fensterbefehle werden ignoriert, Wetter- und
Temperaturautomationen werden nicht ausgeführt und der Komponentenstatus lautet
`disabled` beziehungsweise „Deaktiviert“.

Bei `enabled=true` wird die vollständige konfigurierte Fensterlogik der
betreffenden Komponente verfügbar. Die Master Platform darf diese
Konfiguration erst nach erfolgreicher Hardware-, Binding- und
Sicherheitsprüfung veröffentlichen. Dachfenster und Fensterwand besitzen
jeweils eigene Relaiskanäle, Aktivstatus, Öffnungs- und
Schließungstemperaturen, Laufzeiten in Minuten, Sensorbindungen, Wetterregeln
und Sicherheitszustände.

Bis eine gesondert freigegebene Fenster-Implementierungsphase diese dynamische
`enabled`-Auswertung implementiert und vollständig testet, bleibt die
statische CH1-bis-CH4-Sperre unverändert bestehen.
