# C5.1a – Checkliste für den ersten Flash

Datum: __________  Prüfer: __________  Gerät: __________

COM-Port: __________  Commit: __________

Nur für den beaufsichtigten Staging-Test. Details und Tests T0–T6 stehen in
`c51-hardware-test-and-flash-gate.md`.

## A. Vor dem Einschalten

- [ ] Produktives Bewässerungsventil ist von CH5 getrennt.
- [ ] Dach- und Seitenfenster sind von CH1–CH4 getrennt.
- [ ] CH1–CH4 sind unbelegt; CH5 ist beim ersten Flash noch lastfrei.
- [ ] Sichere Kleinspannungs-Prüflast liegt für den späteren CH5-Test bereit.
- [ ] Last, Versorgung, Sicherung und Relaiskontakt sind passend dimensioniert.
- [ ] Spannungsabschaltung ist sofort erreichbar; Test bleibt beaufsichtigt.

**Abbruch:** unklare Verdrahtung, produktiver Aktor verbunden, ungeeignete
Prüflast oder keine schnelle Abschaltmöglichkeit.

## B. Lokale Staging-Konfiguration

Werte nur lokal prüfen; nichts Geheimes in Chat oder Log kopieren.

- [ ] `GC_API_URL` zeigt ausschließlich auf die Staging-Anwendung.
- [ ] `GC_COMMAND_POLL_URL` zeigt auf dieselbe Staging-Anwendung.
- [ ] Beide Hosts unterscheiden sich eindeutig von Hauptprojekt/Produktion.
- [ ] Geräte-ID und Secret gehören ausschließlich zum aktiven Staging-Gerät.
- [ ] Root-CA wurde gegen die aktuelle Staging-Zertifikatskette geprüft.
- [ ] PEM ist vollständig und enthält keinen Platzhalter.
- [ ] `GC_ENABLE_OUTPUTS=false`.
- [ ] `GC_COMMAND_AUTHORITY_POLL=true`; Legacy-Heartbeat ist nur Telemetrie.
- [ ] `GC_COMMAND_DIAGNOSTICS=1` nur für diesen beaufsichtigten Test.
- [ ] `GCConfig.h` ist weiterhin ignoriert und unversioniert.

**Abbruch:** unbekannter/produktiver Host, falsches Gerät, unsichere CA,
Platzhalter oder aktivierte Ausgänge.

## C. Build und Zielgerät

- [ ] Projektordner: `C:\Users\alexi\Pfaff-GreenControl-2.x`.
- [ ] Buildquelle: ausschließlich
      `firmware/current/Pfaff_GreenControl_Firmware_v1_3_1_GPIO21_windows_off/`.
- [ ] FQBN: `esp32:esp32:esp32s3:USBMode=hwcdc,CDCOnBoot=cdc`;
      ESP32-Core: 3.3.10.
- [ ] Board: ESP32S3 Dev Module; Flash: 4 MB; Partition: `default`.
- [ ] Ein eindeutiger ESP32-COM-Port ist erkannt.
- [ ] Es kann nicht versehentlich ein anderes Gerät geflasht werden.
- [ ] Reiner Compile-Test ist grün.
- [ ] Erwartete Größe: etwa 1.082.101 Byte Flash / 47.892 Byte RAM.
- [ ] Serieller Monitor und Logaufzeichnung sind auf 115200 Baud vorbereitet.
- [ ] Rückfall-Build mit `GC_ENABLE_OUTPUTS=false` ist verfügbar.

**Abbruch:** unklarer Port, abweichendes Board, Compilefehler oder unerklärliche
deutliche Größenabweichung.

## D. Flash-Gate

- [ ] Abschnitte A–C sind vollständig erfüllt.
- [ ] Zweite Kontrolle: keine Aktorlast, Staging, Root-CA, Outputs AUS.
- [ ] Flash ausdrücklich freigegeben durch: ____________________

Ohne diese drei Haken gilt die Firmware als **nicht flashbereit**.

## E. Erwartetes serielles Startbild

Nach dem Flash muss die Reihenfolge erkennbar sein:

1. `Pfaff GreenControl Firmware v1.2.0` (bekannter Versionswiderspruch),
2. `Waveshare ESP32-S3-ETH-8DI-8RO`,
3. `DI1= Dach offen, ... DI5= Druck OK`,
4. `I2C gestartet: ...`,
5. `Relaisboard erkannt. Alle Relais AUS.`,
6. `Fenster CH1-CH4 voruebergehend deaktiviert.`,
7. `DS18B20 Datenpin: GPIO21` und gefundene Sensoranzahl,
8. `Verbinde mit WLAN ...`,
9. `SICHERHEIT: Alle Relais AUS bestaetigt.`,
10. `C5 TLS CONFIG READY`,
11. `C5 COMMAND STATE READY`,
12. `Command-Autoritaet: POLL`,
13. `WLAN verbunden.` mit IP und RSSI,
14. mindestens dreimal `C5 POLL OK ... next_ms=1500`,
15. nach etwa zehn Sekunden plausible Temperatur,
16. nach etwa 30 Sekunden Heartbeat mit HTTP 200.

- [ ] Kein Reset und keine Bootschleife.
- [ ] CH1–CH5 bleiben physisch AUS.
- [ ] Kein NVS-, I2C- oder Sensorfehler.
- [ ] Drei aufeinanderfolgende Polls sind erfolgreich.
- [ ] Heartbeat und Temperatur funktionieren weiterhin.
- [ ] Kein Secret, keine Geräte-ID und kein vollständiger Header im Log.

`C5 TLS CONFIG READY` prüft nur die formale Konfiguration. Erst `C5 POLL OK`
gegen den zuvor bestätigten Staging-Host ist der reale Poll-TLS-Nachweis.

## F. Sofort abbrechen

Versorgung beziehungsweise Lastversorgung sofort trennen bei:

- Aktivität an CH1–CH4,
- Aktivität an CH5 trotz deaktivierter Outputs,
- falschem Kanal oder mehrfachen Schaltflanken,
- Rauch, Geruch, Erwärmung oder auffälligem Strom,
- Reset-/Watchdog-Schleife,
- Produktionsverbindung oder ausgegebenem Secret.

Kontrolliert abbrechen bei wiederholtem TLS-Fehler, HTTP 401/403, ungültigem
Poll-Protokoll, fehlendem `C5 POLL OK`, I2C-/NVS-Fehler, unplausibler
Temperatur oder ausbleibendem Heartbeat.

## G. Kurze Diagnose

**TLS:** beide Staging-Hosts, Gerätezeit, Root-CA/Kette und PEM-Zeilenumbrüche
prüfen. Niemals `setInsecure()` ergänzen.

**Poll:** HTTP-Status, Endpoint `/api/device/commands/poll`, aktives
Staging-Gerät, C2-Tabelle und C3-Staging-Deployment prüfen. Keine Produktion
als Gegenprobe verwenden.

**Hardware/Boot:** serielles Log sichern, Versorgung messen, Aktorkanäle
trennen, I2C/SDA/SCL und Boardprofil prüfen, mit Outputs AUS neu starten und
gegebenenfalls Rückfall-Build verwenden.

## H. Ergebnis

- [ ] Alle Punkte A–E erfüllt.
- [ ] Mindestens drei echte Staging-Polls per TLS erfolgreich.
- [ ] Heartbeat und Temperatur weiterhin funktionsfähig.
- [ ] Alle Relais blieben bei deaktivierten Outputs AUS.
- [ ] Serielles Log und verwendeter Commit gesichert.

Ergebnis: [ ] **BESTANDEN**  [ ] **ABGEBROCHEN**

Bemerkung: _________________________________________________________________

Nur bei **BESTANDEN** darf der getrennte CH5-Prüflasttest mit lokalem
`GC_ENABLE_OUTPUTS=true` neu freigegeben werden. Fenster und produktive
Bewässerung bleiben ausgeschlossen.
