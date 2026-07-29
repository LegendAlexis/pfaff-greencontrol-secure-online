# Aktuelle Firmware-Baseline

## Herkunft und Integrität

Die Firmwaredateien dieses Ordners wurden in Phase 1B unverändert aus
`C:\Users\alexi\Pfaff_GreenControl_Firmware_v1_3_1_GPIO21_windows_off`
übernommen. Beim Kopieren wurden die SHA-256-Dateihashes von Quelle und Ziel
verglichen. `GCConfig.h` wurde ausgeschlossen und nicht gelesen.

Die praktisch bestätigten Funktionen dieser Baseline sind:

- Temperaturmessung mit DS18B20 an GPIO21
- manuelle Bewässerung
- Zeitplanbewässerung
- Bewässerung über physischen Kanal CH5 beziehungsweise Firmwarewert 4

Dach- und Wandfenster sind keine funktionierende Referenz. CH1 bis CH4 bleiben
gesperrt, und Fensterbefehle dürfen keine Bewegung auslösen.

## Lokale Konfiguration

1. `GCConfig.example.h` lokal als `GCConfig.h` kopieren.
2. WLAN-SSID und WLAN-Passwort lokal ergänzen.
3. API-URL, Geräte-ID und Geräte-Secret lokal ergänzen.
4. Alle als unbestätigt dokumentierten Board-, Ein-/Ausgangs- und Zeitwerte
   vor einem Hardwareeinsatz gegen das konkrete Gerät prüfen.
5. `GCConfig.h` niemals committen oder in Logs ausgeben.

Die Vorlage enthält keine echten Zugangsdaten. Ihr API-Platzhalter verwendet
die reservierte Domain `example.invalid`.

## Versionshinweis

Ordner und Sketchname bezeichnen den Stand als v1.3.1. Die unveränderte
serielle Startmeldung meldet weiterhin v1.2.0. Dieser bekannte Widerspruch ist
dokumentiert und wird in Phase 1B nicht korrigiert.

## Architekturvorbehalt

`firmware/current/` ist eine Übergangs-Baseline. Die endgültige Repository-,
Firmware-, Profil-, Build- und Releasestruktur wird erst in einer späteren
Architekturphase festgelegt.
