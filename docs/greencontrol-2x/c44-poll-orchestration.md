# C4.4 – Poll-Orchestrierung und Loop-Integration

## Ablauf

Der Firmware-Loop ruft den Command-Orchestrator nur bei bestehender
WLAN-Verbindung auf. Der bestehende Heartbeat-Block bleibt unverändert,
behält seinen eigenen 30-Sekunden-Takt und wird vor einem gleichzeitig
anstehenden Poll ausgeführt.

Ein Pollzyklus läuft in dieser Reihenfolge:

1. bis zu ein persistentes ACK je Aktor aus NVS laden,
2. persistierte Sequenzen und ACK-Snapshot an C3 senden,
3. bei Netzwerk-, TLS-, HTTP- oder Protokollfehler nichts löschen,
4. nur nach HTTP 200 die exakt gesendeten ACKs lokal entfernen,
5. erst danach neue Commands an genau einen Aktorcontroller übergeben,
6. Controllerentscheidung und neues ACK wieder dauerhaft in NVS speichern.

Scheitert das Entfernen eines bestätigten ACKs, werden keine neuen Commands
verarbeitet. Das ACK wird beim nächsten Poll erneut gesendet. C3 akzeptiert die
identische endgültige Bestätigung idempotent.

## Fehlerszenarien

### Neustart mit ausstehendem ACK

ACK und Sequenz liegen in NVS. Nach dem Neustart werden sie erneut geladen und
gesendet. Der bereits ausgeführte Command wird nicht erneut an den Controller
übergeben. Fenstercontroller erzwingen beim Start zusätzlich beide Richtungen
AUS.

### Netzwerkunterbruch über mehrere Pollzyklen

Der Poll-Client behält seine ACKs nicht im RAM, sondern der Orchestrator lädt
sie für jeden Versuch erneut aus NVS. Fehler löschen weder ACK noch Sequenz.
Der vorhandene Backoff begrenzt die Versuche auf 1,5, 3, 6 und maximal
10 Sekunden. Es gibt keine Fensterbewegung; CH5 behält den zuletzt gesetzten
Zustand und unterliegt weiterhin dem bestehenden Safety-Controller.

### Wiederverbindung nach längerer Offlinezeit

Zuerst werden ausstehende ACKs und Sequenzen übertragen. C3 liefert je Aktor
höchstens den neuesten offenen, nicht abgelaufenen Command. Veraltete oder
identische Sequenzen werden lokal nicht erneut ausgeführt.

### Mehrfach identischer Command

Ein offenes identisches ACK wird direkt wiederverwendet. Ist das ACK bereits
bestätigt, verhindert die persistierte Sequenz eine erneute Aktion und erzeugt
`already_applied`. CH5 erhält daher keinen zweiten physischen Zustandswechsel.

### Mehrfach identisches ACK

Bei verloren gegangener HTTP-Antwort bleibt das ACK in NVS. Es wird bis zu
einem erfolgreichen HTTP-200-Poll identisch wiederholt. Erst danach wird exakt
der gesendete Snapshot gelöscht.

## Aktoren und sicherer Zustand

- Bewässerung: ausschließlich CH5 kann physisch geschaltet werden.
- Dachfenster: logisch integriert, CH1/CH2 bleiben AUS und antworten mit
  `component_disabled`.
- Seitenfenster: logisch integriert, CH3/CH4 bleiben AUS und antworten mit
  `component_disabled`.
- NVS nicht verfügbar: Poll- und Command-Verarbeitung bleiben vollständig aus.

## Laufzeit- und 24/7-Bewertung

- Flash: 1.082.101 von 1.310.720 Byte (82 %), 228.619 Byte verbleiben.
  Die aktive C4.4-Orchestrierung benötigt gegenüber C4.3 zusätzlich
  20.040 Byte.
- RAM: 47.892 von 327.680 Byte (14 %), 279.788 Byte verbleiben. Gegenüber
  C4.3 sind das 368 Byte zusätzlicher statischer RAM-Verbrauch.
- CPU: Nicht fällige Loop-Aufrufe enden nach einer wrap-sicheren Terminprüfung
  und lesen kein NVS. NVS-, JSON- und TLS-Arbeit entsteht nur bei einem
  tatsächlich fälligen Poll.
- Netzwerk: ein Poll ungefähr alle 1,5 Sekunden bei Erfolg; Keep-Alive wird
  verwendet, Backoff begrenzt Fehlerlast.
- Boot: Relaisboard wird zuerst auf AUS initialisiert, danach NVS und
  Controller; ohne NVS keine Command-Ausführung.
- Langzeitrisiken: Der synchrone HTTPS-Poll kann bei einem langsamen Server den
  gemeinsamen Loop bis zum konfigurierten Request-Timeout blockieren. Der
  Heartbeat-Code ist unabhängig, kann dadurch aber zeitlich verzögert werden.
  Eine separate Task wäre eine größere Architekturänderung und wird nicht
  ungefragt in C4.4 eingeführt.
- Koexistenz: Der unveränderte Heartbeat kann weiterhin seine bisherigen
  Bewässerungs-Sollwerte anwenden. Bis dieser Legacy-Pfad in einer eigenen
  freigegebenen Phase konsolidiert wird, muss der Hardwaretest prüfen, dass
  Heartbeat-Sollwert und C3-Command nicht widersprüchlich verwendet werden.
- NVS-Verschleiß: ACKs werden gelesen, aber nur bei neuen Entscheidungen
  geschrieben und nach Serverbestätigung gelöscht; kein Schreibvorgang pro
  leerem Poll.

Mit 82 % Flash-Belegung ist die aktuelle Partition noch ausreichend, aber die
Reserve ist für spätere OTA-Doppelpartitionen oder größere TLS-/Safety-Bausteine
nicht mehr großzügig. Das Partitionslayout muss vor OTA verbindlich geprüft
werden.
