# C4.2 – Sicherer Firmware-Poll-Transport

## Umfang

C4.2 implementiert den HTTPS-Transport für
`POST /api/device/commands/poll`. Der Client ist noch nicht in den
Firmware-Loop integriert und kann daher weder Commands abrufen noch Aktoren
beeinflussen. Heartbeat, Safety Controller und Relaiscode bleiben
unverändert.

## TLS-Strategie

Der ESP32 prüft den Server über eine lokal provisionierte Root-CA im
PEM-Format:

```cpp
secureClient.setCACert(GC_TLS_ROOT_CA_PEM);
```

Der Client verweigert den Start, wenn:

- die Poll-URL nicht mit `https://` beginnt,
- PEM-Anfang oder PEM-Ende fehlt,
- die Konfiguration noch `REPLACE_` enthält.

`setInsecure()` wird im Poll-Transport nicht verwendet. Die konkrete Root-CA
wird nicht geraten: Sie muss lokal gegen die tatsächliche Zertifikatskette des
API-Hosts verifiziert und in der nicht versionierten `GCConfig.h` hinterlegt
werden.

Diese Strategie ist klein und mit der vorhandenen ESP32-Core-Version
kompatibel. Nachteil: Ein Wechsel der Root-CA benötigt lokale Wartung und bis
zur späteren Konfigurations-/OTA-Infrastruktur ein neues Firmware-Artefakt.
Ein verwaltetes Trust-Bundle wäre eine spätere, separat freizugebende
Verbesserung.

Der bestehende Heartbeat verwendet weiterhin seinen unveränderten Transport.
Die dort vorhandene Altlast `setInsecure()` wird durch C4.2 weder kopiert noch
behoben, weil der Heartbeat ausdrücklich außerhalb dieses Scopes liegt.

## Poll und Backoff

- Start- und Erfolgsintervall: 1500 ms,
- Serverwert `poll_after_ms`: zulässig zwischen 500 und 10000 ms,
- Backoff: 1500, 3000, 6000, 10000 ms,
- erfolgreicher Poll setzt den Backoff zurück,
- WLAN-, HTTP-, Größen- und JSON-Fehler planen einen Retry,
- Verbindungen werden nach Fehlern geschlossen und später neu aufgebaut.

Der HTTP-Client verwendet Keep-Alive, um nicht alle 1,5 Sekunden einen neuen
TLS-Handshake zu erzwingen. Connect- und Request-Timeout sind auf drei
beziehungsweise fünf Sekunden begrenzt. Antworten über 8192 Byte werden
abgewiesen.

## ACK-Wiederholung

Der Transport erhält die aktuell in NVS gespeicherten ACKs bei jedem fälligen
Poll erneut. Er verändert oder löscht sie nicht. Erst der spätere
Command-Prozessor darf ACKs nach einem vollständig erfolgreichen HTTP-200-
und Protokoll-Poll aus NVS entfernen. Geht Request oder Response verloren,
bleiben die ACKs erhalten und werden erneut übertragen.

## Secret-Grenze

- Geräte-ID und Secret werden ausschließlich als Header übertragen.
- Sie werden nicht seriell ausgegeben.
- `GCConfig.h` bleibt ignoriert und wird nicht gelesen oder versioniert.
- Die eingecheckte Vorlage enthält nur ungültige Platzhalter.

## Noch nicht enthalten

- Aufruf aus `loop()`,
- Command-Verarbeitung,
- NVS-ACK-Löschung,
- Bewässerungscontroller,
- Fenstercontroller,
- Relaiszugriff oder Hardwaretest.
