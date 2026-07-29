# GreenControl 2.x – Komponentenlebenszyklus

## Lebenszyklus

```text
DISCOVERED
 -> DRAFT
 -> CONFIGURED
 -> VALIDATED
 -> TEST_READY
 -> TESTING
 -> VERIFIED
 -> ENABLED
 -> ACTIVE
 -> DEGRADED / FAULT
 -> DISABLED
 -> RETIRED
```

## Zustände

| Zustand | Bedeutung | Aktoren |
|---|---|---|
| `discovered` | Hardwarekandidat gefunden | immer AUS |
| `draft` | unvollständige Eingaben | immer AUS |
| `configured` | Angaben vollständig | weiterhin AUS |
| `validated` | Schema/Ressourcen konfliktfrei | weiterhin AUS |
| `test_ready` | Testplan und Berechtigung vorhanden | AUS |
| `testing` | zeitlich begrenzter Einzeltest | nur bestätigte Testaktion |
| `verified` | Testnachweis bestanden | noch AUS |
| `enabled` | für Betrieb freigegeben | Safety Policy gilt |
| `active` | Runtime und Telemetrie gesund | Sollzustände zulässig |
| `degraded` | eingeschränkte Qualität | definierter Fallback |
| `fault` | Sicherheits-/Treiberfehler | sicherer Fallback |
| `disabled` | bewusst abgeschaltet | Ausgänge AUS, Befehle ignoriert |
| `retired` | außer Betrieb | keine Befehle, Historie bleibt |

## Aktivierung

Aktivierung verlangt:

- Tenant- und Komponentenrecht
- bei Aktoren Step-up-MFA
- freigegebene Pluginversion
- kompatibles Hardwareprofil und Firmware
- konfliktfreie Bindings
- vollständige Safety Policy
- bestandenen Test
- veröffentlichte und bestätigte Gerätekonfiguration
- Audit-Eintrag

## Änderungen

Settings- oder Bindingänderungen erzeugen eine neue Komponentenversion und eine
neue Gerätekonfiguration. Bei gefährlichen Änderungen wird die Komponente
zunächst deaktiviert. Direkte Mutation der aktiven Konfiguration ist verboten.

## Deaktivierung und Entfernung

Deaktivierung setzt zuerst den sicheren Fallback, wartet auf Gerätebestätigung
und beendet danach Automationsbindungen. Entfernung ist erst danach möglich.
Messwerte, Warnungen, Audit und frühere Versionen bleiben erhalten.

## Fehlerbehandlung

- fehlende Telemetrie → `degraded`, dann je Policy `fault`
- ungültiger Sensorwert → nicht für neue Safety-Entscheidung verwenden
- Befehls-Timeout → Aktor-Fallback
- Geräteoffline → lokale Policy, Plattform markiert Zustand unbekannt
- Pluginfehler → betroffene Komponenten isolieren
- Konflikt nach Update → gesamte neue Konfiguration ablehnen

## Fenster-State-Machine

Fenster werden neu implementiert; die bestehende Fensterlogik ist keine
Regression-Baseline.

```text
DISABLED
 -> IDLE
 -> OPENING / CLOSING
 -> IDLE an Endlage oder nach zeitbasierter Fahrt

OPENING/CLOSING
 -> STOPPING
 -> IDLE

jeder aktive Zustand
 -> FAULT bei Not-Aus, Verriegelungsfehler, Laufzeitüberschreitung
 -> beide Relais AUS
```

Ein Richtungswechsel läuft immer über `STOPPING`, beide Relais AUS und eine
konfigurierte Pause. Ein direkter Wechsel von Öffnen zu Schließen oder
umgekehrt ist unzulässig.

Der Modus ist orthogonal zum Bewegungszustand:

- `manual`: nur Benutzerbefehle Öffnen/Stoppen/Schließen
- `automatic`: Wetter- und Temperaturentscheidungen

Lokale Safety gilt in beiden Modi.

## Fensteraktivierung im Komponentenlebenszyklus

Dachfenster und Fensterwand durchlaufen den Lebenszyklus vollständig getrennt.
Eine verifizierte Dachfensterkomponente berechtigt nicht zur Aktivierung der
Fensterwand und umgekehrt.

Der Pilotzustand beider Komponenten ist `disabled`:

- `roofWindow.enabled=false`
- `wallWindow.enabled=false`

Im Zustand `disabled` bleiben beide Richtungsrelais der jeweiligen Komponente
AUS, Befehle werden ignoriert, Automationen laufen nicht und der gemeldete
Status ist „Deaktiviert“.

Der Übergang von `verified` über `enabled` nach `active` benötigt pro
Fensterkomponente:

1. bestätigte Relaisbindings,
2. geprüfte Sensoren beziehungsweise dokumentierte zeitbasierte Führung,
3. gültige Öffnungs- und Schließungstemperaturen,
4. getrennte maximale Laufzeiten in Minuten,
5. geprüfte Wetterregeln,
6. bestandene Verriegelungs-, Endschalter-, Timeout- und Not-Aus-Tests,
7. eine veröffentlichte und vom Gerät bestätigte Konfiguration.

Nach erfolgreicher Prüfung aktiviert die Master Platform die bereits in der
universellen Firmware vorhandene Komponentenlogik. Dafür darf keine
Firmware- oder Codeänderung notwendig sein.

Die heutige statische CH1-bis-CH4-Sperre bleibt bis zur separat freigegebenen
Implementierung und Verifikation dieser dynamischen Lebenszyklussteuerung
unverändert. Sie ist nur eine sichere Übergangsbaseline.
