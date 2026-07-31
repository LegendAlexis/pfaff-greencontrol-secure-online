# C5.1 – Hardware-Testvorbereitung und Flash-Gate

## Freigabestatus

Die Firmware ist **statisch buildfähig**, aber noch nicht bedingungslos zum
Flash freigegeben. Der lokale Read-only-Check meldete `No boards found`.
Außerdem dürfen die lokale `GCConfig.h`, Staging-Zugangsdaten und Root-CA nicht
automatisch gelesen werden. Folgende Gates müssen deshalb am Prüfplatz
bestätigt werden:

- erkannter ESP32-S3 und eindeutig bestimmter serieller Port,
- Heartbeat- und Poll-URL zeigen ausschließlich auf dieselbe isolierte
  Staging-Anwendung,
- Root-CA wurde gegen die aktuelle Zertifikatskette des Staging-Hosts geprüft,
- ausschließlich ein isoliertes Staging-Testgerät ist zugeordnet,
- CH1 bis CH4 sind physisch getrennt,
- produktive Bewässerung ist getrennt,
- CH5 trägt ausschließlich eine geeignete sichere Prüflast.

Bis alle Gates erfüllt sind, gilt: **kein Flash**. Zugangsdaten oder Zertifikate
werden weder in dieses Dokument noch in serielle Logs übernommen.

## Prüfaufbau

1. Gewächshausantriebe und Bewässerungsventil spannungsfrei trennen.
2. CH1 bis CH4 unbelegt lassen und mit einem geeigneten Messgerät bestätigen.
3. An CH5 nur eine zur Relaiskontakt- und Versorgungsspannung passende,
   strombegrenzte Prüflast verwenden. Keine Netzspannung ohne qualifizierten
   Elektroaufbau; bevorzugt wird eine sichere Kleinspannungs-Leuchte.
4. Gut erreichbare Spannungsabschaltung bereithalten.
5. Seriellen Monitor auf 115200 Baud öffnen und vollständiges Log mit lokalen
   Zeitstempeln speichern.
6. Ersten Flash mit `GC_ENABLE_OUTPUTS=false` durchführen. Erst TLS, Poll und
   deaktivierte Fenster prüfen. CH5 darf dabei nicht einschalten.
7. Nur nach bestandenem Gate die lokale Testkonfiguration auf
   `GC_ENABLE_OUTPUTS=true` setzen, neu kompilieren und CH5 mit Prüflast testen.

## Empfohlene sichere Diagnoseausgaben

Für den beaufsichtigten Test kann lokal `GC_COMMAND_DIAGNOSTICS=1` gesetzt
werden. Standard ist `0`. Die Ausgaben enthalten weder Geräte-ID noch Secret:

- `C5 TLS CONFIG READY`: HTTPS-URL und PEM sind formal provisioniert; dies ist
  noch kein erfolgreicher Handshake.
- `C5 COMMAND STATE READY`: NVS und Controller wurden initialisiert.
- `C5 POLL OK ack_sent=N commands=N next_ms=N`: TLS/HTTP/Protokoll-Poll war
  erfolgreich.
- `C5 COMMAND STORED actuator=... sequence=... status=...`: Entscheidung und
  ACK wurden dauerhaft gespeichert.
- `C5 ACK CONFIRMED count=N`: C3 hat die gesendeten ACKs bestätigt und die
  lokalen Kopien wurden gelöscht.
- bestehend: WLAN, IP, RSSI, Relaiswechsel, HTTP-Fehler und Safety-Meldungen.

Secrets, komplette HTTP-Header und Response-Bodies dürfen nicht geloggt werden.

## Testmatrix und Soll-Zustände

### T0 – Boot ohne Ausgangsfreigabe

Voraussetzung: `GC_ENABLE_OUTPUTS=false`, Fenster getrennt, CH5-Prüflast aus.

Soll:

- Startbanner, I2C und „Alle Relais AUS“,
- NVS bereit, keine NVS-Sicherheitsmeldung,
- CH1 bis CH5 bleiben AUS,
- DS18B20 liefert plausible Temperatur.

Abbruch: unerwartetes Relaisklicken, Reset-Schleife, I2C-Fehler, Rauch,
Erwärmung oder nicht plausible Versorgung.

### T1 – TLS und Poll gegen Staging

Soll:

- Staging-Identität und beide API-Hosts wurden vorab lokal bestätigt,
- `C5 TLS CONFIG READY`, danach wiederholt `C5 POLL OK`,
- HTTP 200, gültiges Protokoll, `next_ms=1500`,
- kein `setInsecure()` im Pollpfad,
- keine Verbindung zum Hauptprojekt.

Abbruch: anderer Host, Zertifikatsfehler, 401/403, wiederholte Protokollfehler,
Produktionsidentität oder Ausgabe eines Secrets. Ein erfolgreicher realer
`C5 POLL OK` ist der TLS-Nachweis; die formale READY-Zeile allein genügt nicht.

### T2 – Fenstercommands bei deaktivierter Hardware

Je einen neuen `roof_window`- und `side_window`-Command in Staging erzeugen.

Soll:

- ACK jeweils `rejected/component_disabled`,
- tatsächlicher Zustand `disabled/stopped`,
- CH1 bis CH4 bleiben elektrisch AUS,
- keine Bewegung und kein Relaisklicken.

Abbruch: Spannung oder Aktivität an CH1 bis CH4.

### T3 – CH5 mit sicherer Prüflast

Erst nach T0–T2 lokal `GC_ENABLE_OUTPUTS=true` kompilieren. Zuerst einen
`watering off`, danach `watering on` und spätestens nach fünf Sekunden
`watering off` senden.

Soll:

- nur CH5 schaltet,
- ON/OFF jeweils genau ein sichtbarer Zustandswechsel,
- ACK enthält `applied` und den tatsächlichen Zustand,
- Heartbeat meldet denselben tatsächlichen Bewässerungszustand,
- CH1 bis CH4 bleiben AUS.

Abbruch: falscher Kanal, Last bleibt nach OFF aktiv, mehrfache Schaltflanken,
Frostschutz wird umgangen, Erwärmung oder unplausibler Strom.

### T4 – ACK-Verlust und Wiederholung

Nach einem CH5-OFF-Command unmittelbar nach `C5 COMMAND STORED` die
Staging-Netzverbindung unterbrechen. OFF wird gewählt, damit der sichere Zustand
erhalten bleibt.

Soll:

- ACK bleibt in NVS,
- Backoff steigt bis höchstens zehn Sekunden,
- keine zweite physische CH5-Aktion,
- nach Wiederverbindung wird dasselbe ACK erneut gesendet,
- genau ein `C5 ACK CONFIRMED`, danach kein weiteres ACK dieses Commands.

Abbruch: CH5 schaltet erneut oder ein anderes Gerät erhält das ACK.

### T5 – Neustart mit ausstehendem ACK

T4 im getrennten Netzwerk nach gespeichertem OFF-ACK fortsetzen, Gerät
spannungsfrei neu starten und erst danach Staging wieder freigeben.

Soll:

- Boot setzt alle Relais AUS,
- NVS lädt Sequenz und ACK,
- Command wird nicht erneut physisch ausgeführt,
- ACK wird nach WLAN-Wiederkehr bestätigt und gelöscht.

Abbruch: CH5 startet EIN, ACK geht verloren oder Sequenz fällt zurück.

### T6 – längere Offlinezeit und identische Wiederholungen

Gerät mindestens fünf Minuten von Staging trennen. Währenddessen keine
gefährlichen ON-Commands erzeugen. Nach Wiederverbindung denselben bereits
verarbeiteten Command erneut anbieten beziehungsweise dessen ACK-Antwort
gezielt verlieren.

Soll:

- keine Reset-Schleife und kein NVS-Schreiben pro leerem Loop,
- unmittelbarer Poll nach WLAN-Wiederkehr,
- identische Sequenz führt zu `already_applied`, nicht zu einer Relaisaktion,
- identisches endgültiges ACK wird von C3 idempotent akzeptiert.

Abbruch: Watchdog-Reset, Speicherabfall, wiederholtes Schalten oder wachsender
Backoff nach wiederhergestellter Verbindung.

## Risiken des ersten Hardwaretests

- falsche Relaispolarität oder Kanalzuordnung,
- Prüflast mit ungeeigneter Spannung beziehungsweise Stromaufnahme,
- falscher Staging-Host oder falsche CA,
- Legacy-Heartbeat und C3-Command liefern widersprüchliche Bewässerungsziele,
- synchroner HTTP-Aufruf verzögert den Loop im Fehlerfall bis zum Timeout,
- Reset im kleinen Fenster zwischen Sequenzspeicherung und CH5-Wechsel lässt
  sicherheitsgerichtet einen EIN-Command aus,
- 82 % Flash-Belegung begrenzt spätere OTA-/Partitionsoptionen,
- bestehender Legacy-Heartbeat verwendet weiterhin seinen historischen
  TLS-Transport; der verifizierte CA-Nachweis in C5 gilt nur für den Pollpfad.

## Rückfallstrategie

1. Lastversorgung sofort trennen; ESP32 über USB erreichbar lassen, sofern
   sicher.
2. CH5-Prüflast entfernen und alle Aktorkanäle physisch trennen.
3. Die vor C4 vorhandene, praktisch getestete Firmware nur aus dem unveränderten
   Referenzstand wiederherstellen; keine Legacy-Datei aus dem Webprojekt nutzen.
4. Alternativ denselben C5-Build mit `GC_ENABLE_OUTPUTS=false` flashen.
5. Staging-Testcommands schließen oder entfernen; keine Produktionsdaten
   verändern.
6. Serielles Log, Buildhash, Boardoptionen und Zeitpunkt sichern.

## Freigabeentscheidung

Der Quellstand ist nach automatischen Tests und reproduzierbarem Compile ein
**Flash-Kandidat**. Die eigentliche Flash-Freigabe wird erst erteilt, wenn T0-
Voraussetzungen, Staging-Identität, verifizierte Root-CA, serieller Port und
sichere CH5-Prüflast vom Prüfplatz bestätigt sind. T1 liefert anschließend den
realen TLS-Nachweis. Ohne diese Nachweise wäre eine Freigabe geraten.
