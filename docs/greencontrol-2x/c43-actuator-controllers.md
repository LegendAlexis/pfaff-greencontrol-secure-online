# C4.3 – Aktorcontroller

## Umfang und Sicherheitsgrenze

C4.3 führt drei getrennte Controller für Bewässerung, Dachfenster und
Seitenfenster ein. Sie sind noch nicht in den Firmware-Loop integriert.
Heartbeat, bestehende Bewässerungslogik und das Laufzeitverhalten der
installierten Firmware bleiben deshalb unverändert.

Nur der Bewässerungscontroller darf CH5 ansteuern. Dach- und
Seitenfenstercontroller können keine Richtung einschalten. Jeder
Fensterbefehl erzwingt zunächst beide Richtungen AUS und wird anschließend mit
`component_disabled` quittiert. Das öffentliche `emergencyStop()` bildet die
spätere gemeinsame Notfallgrenze, ohne die heutige statische Sperre zu lösen.

## Verarbeitung eines Commands

Vor einer Aktion prüft die gemeinsame Guard-Schicht:

1. Aktor, Operation, ID, Sequenz und vorhandene Zeitangaben,
2. ein noch nicht vom Server bestätigtes ACK desselben Aktors,
3. die zuletzt dauerhaft gespeicherte Sequenz,
4. Duplikate und veraltete Sequenzen.

Ein identisches noch ausstehendes ACK wird unverändert wiederverwendet. Ein
anderes Command wartet, solange für denselben Aktor ein ACK offen ist. Dadurch
wird der einzelne persistente ACK-Slot nicht überschrieben.

Die C3-Abfrage liefert ausschließlich serverseitig noch gültige Commands. Die
Firmware prüft deren typisierte Struktur erneut. Eine lokale Ablaufentscheidung
anhand einer ungesicherten ESP32-Uhr wird bewusst nicht geraten; eine belastbare
lokale Zeitquelle gehört in eine spätere, separat geprüfte Safety-Integration.

## Bewässerung und Reset-Sicherheit

Vor CH5 werden zusätzlich Frostschutz, globale Ausgangsfreigabe und
Verfügbarkeit des Relaisboards geprüft. Die neue Sequenz wird vor dem
Ausgangswechsel in NVS gespeichert. Damit gilt bei einem Reset ein bewusstes
At-most-once-Verhalten: derselbe Command darf nicht ein zweites Mal physisch
ausgeführt werden. Der Nachteil ist ein kleines Fehlerfenster, in dem ein Reset
nach dem Sequenzschreiben, aber vor dem Relaiswechsel einen EIN-Befehl auslassen
kann. Für Bewässerung ist dieser sichere AUS-Zustand der Doppelansteuerung
vorzuziehen; der Zustand wird über ACK und Heartbeat sichtbar.

## Erweiterungsgrenzen

Die Controllergrenzen erlauben spätere Ergänzungen innerhalb des zuständigen
Aktors:

- Dachfenster: eigener Controller, Endschalter, Laufzeiten und
  Richtungswechselpause,
- Seitenfenster: eigener Controller, laufzeitbasierte Position und optionale
  Sensoren,
- beide Fenster: Wetterfreigabe und Not-Stopp über eine übergeordnete
  Safety-Koordination,
- Bewässerung: zusätzliche Freigaben und physische Rückmeldung.

Diese Funktionen werden in C4.3 nicht aktiviert.

## Firmware-Qualitätsbericht

- Flash: 1.062.061 von 1.310.720 Byte (Arduino-Ausgabe: 81 %). Gegenüber
  C4.2 sind das 384 Byte zusätzlich; der verbleibende Flash-Spielraum beträgt
  248.659 Byte.
- RAM: 47.524 von 327.680 Byte (14 %), 280.156 Byte verbleiben. Gegenüber
  C4.2 entsteht kein zusätzlicher statischer RAM-Verbrauch.
- CPU: Controller sind ereignisgetrieben und noch nicht im Loop aktiv; aktuell
  keine Laufzeitlast. Später je Command konstante Prüf- und NVS-Operationen.
- Netzwerk: keine Auswirkung; C4.3 enthält keinen Netzwerkzugriff.
- Boot/Wiederanlauf: noch keine Initialisierung im Sketch. Die persistierte
  Sequenz verhindert spätere doppelte Ausführung; Fenster-`begin()` erzwingt
  beide Richtungen AUS.
- Langzeitrisiken: NVS-Schreiblast entsteht nur pro neuem Command und ACK, nicht
  pro Poll. Das Reset-Fenster zwischen Sequenzpersistenz und Relaiswechsel muss
  bei den Hardwaretests gezielt geprüft werden.

Der Flash-Verbrauch liegt bereits über vier Fünfteln der aktuellen Partition.
Das ist für C4.3 kein Blocker, muss aber ab jetzt in jeder Firmwarephase weiter
beobachtet werden. Vor größeren Bibliotheken oder einer späteren OTA-Einführung
sind Partitionslayout und binäre Größenreserve separat zu prüfen.
