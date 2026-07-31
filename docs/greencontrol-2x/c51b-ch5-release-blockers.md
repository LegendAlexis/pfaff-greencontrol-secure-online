# C5.1b – Behebung der CH5-Freigabesperren

## Ergebnis

Die vier im Readiness Review identifizierten CH5-Sperren wurden mit kleinen,
isolierten Änderungen behoben. Fenster bleiben deaktiviert. Es wurde weder
geflasht noch eine externe Umgebung kontaktiert.

## Relaiszustand bei I²C-Fehlern

`GCRelayBoard` berechnet einen angeforderten Zustand jetzt zunächst separat.
Der bestätigte `logicalState_` wird erst nach erfolgreichem I²C-Schreiben
übernommen. Bei einem Schreibfehler:

- bleibt der zuletzt bestätigte Zustand erhalten,
- wird ein eindeutiger Fehler seriell ausgegeben,
- meldet der Controller keinen unbestätigten Sollzustand als Ist-Zustand,
- kann ein späterer OFF-Versuch erneut ausgeführt werden.

`allOff()` gibt jetzt einen booleschen Erfolg zurück und meldet fehlendes Board
oder I²C-Fehler. Ohne physische Rückmeldung bleibt der Cache der zuletzt
erfolgreich geschriebene, nicht ein elektrisch gemessener Relaiszustand.

## Temperatur-Fail-Safe

Bewässerung EIN ist nur zulässig, wenn:

- mindestens eine Temperaturmessung vorliegt,
- sie nicht `NAN` ist,
- sie höchstens 30 Sekunden alt ist,
- sie über der Frostschutzgrenze liegt,
- Ausgänge lokal freigegeben sind.

Fehlende, ungültige oder veraltete Temperatur sperrt EIN sicher mit
`rejected/frost_lock`. AUS bleibt unabhängig von Temperatur, Frost und globaler
Ausgangsfreigabe möglich. Der Sketch übergibt neben dem Messwert nun den echten
Messzeitpunkt; Pollzyklen aktualisieren das Alter nicht künstlich.

## Eindeutige Command-Autorität

`GC_COMMAND_AUTHORITY_POLL` wählt genau einen Steuerpfad:

- `true`: C5-Modus. Poll verarbeitet Commands; Heartbeat bleibt reine
  Telemetrie und wendet seine Legacy-Sollwerte nicht an.
- `false`: rückwärtskompatibler Übergangsmodus für bestehende lokale
  Installationen; Poll verarbeitet keine Commands.

Die eingecheckte sichere Vorlage verwendet `true`. Ältere lokale
`GCConfig.h`-Dateien ohne den Schalter fallen bewusst auf Legacy zurück und
müssen vor C5 lokal ergänzt werden. Dieser Fallback verhindert einen
unbeabsichtigten Funktionswechsel bestehender Installationen, ist aber nicht
für die CH5-Freigabe zulässig.

## Heartbeat-TLS

Der Heartbeat verwendet kein `setInsecure()` mehr. Wie der Pollpfad verlangt
er:

- HTTPS,
- die lokal provisionierte `GC_TLS_ROOT_CA_PEM`,
- vollständige PEM-Grenzen,
- keinen Platzhalter.

Bei ungültiger TLS-Konfiguration fällt der Heartbeat geschlossen aus. Device-ID
und Secret werden weiterhin nur als HTTPS-Header gesendet und nicht geloggt.

## Speicher und Laufzeit

- Flash: 1.083.181 von 1.310.720 Byte (82 %), 227.539 Byte verbleiben.
- Änderung gegenüber C5.1: +1.080 Byte.
- RAM: 47.892 von 327.680 Byte (14 %), 279.788 Byte verbleiben.
- Statischer RAM gegenüber C5.1: unverändert.
- CPU: nur konstante Alters- und Authority-Prüfungen; praktisch vernachlässigbar.
- Netzwerk: keine zusätzliche Anfrage. Heartbeat und Poll prüfen nun beide CA,
  behalten aber ihre bisherigen Intervalle.
- Boot: Outputs werden bestätigt AUS geschrieben; Poll-ON ist bis zur ersten
  gültigen Temperaturmessung gesperrt.
- Wiederanlauf: gespeicherte Sequenzen/ACKs bleiben erhalten; ein ON-Command
  kann nach Neustart nicht vor einer aktuellen Temperatur ausgeführt werden.

## Verbleibende bekannte Risiken

- Kein physischer CH5-Rückmeldekontakt; I²C-Erfolg ist keine mechanische
  Kontaktbestätigung.
- Synchroner Heartbeat/Poll kann den Loop bei Netzwerkproblemen verzögern.
- Der installierte ESP32-Core prüft in seiner aktuellen Buildkonfiguration
  Zertifikatszeiträume nicht vollständig.
- Pollantworten ohne Content-Length können vor der nachgelagerten
  8192-Byte-Prüfung zusätzlichen Heap belegen.
- NVS ist noch nicht an Geräte-/Umgebungsidentität gebunden.
- Der Legacy-Modus bleibt als Übergang erhalten und muss später entfernt
  werden, sobald die C3-Command-Erzeugung alle Bestandsfunktionen übernimmt.

Diese Punkte blockieren den beaufsichtigten CH5-Prüflasttest nicht, bleiben aber
vor produktiver Bewässerung beziehungsweise 24/7-Freigabe zu bearbeiten oder
praktisch zu validieren.

## Erneute Flash-Bewertung

Der Code ist **flashbereit mit bekannten Restrisiken**. Die eigentliche
Freigabe bleibt an C5.1a gebunden: eindeutiger Port, Staging-Hosts, verifizierte
CA, Poll-Autorität, erster Flash mit Outputs AUS und anschließend separat
freigegebene sichere CH5-Prüflast. Ohne diese Prüfplatznachweise bleibt
`flashingAllowed=false`.
