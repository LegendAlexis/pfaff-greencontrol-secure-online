# Blockierte Phase-1A-Tests

## Firmware-Hardwareinvarianten

Folgende Tests können im aktuellen Repository nicht zuverlässig automatisiert
werden:

- DS18B20 der aktuellen modularen Firmware liegt auf GPIO21
- der tatsächlich funktionierende Bewässerungs-Relaiskanal bleibt unverändert
- CH1 bis CH4 bleiben in der aktuellen modularen Firmware deaktiviert
- Fensterbefehle lösen auf dem Gerät keine Bewegung aus

Grund:

Die aktuelle modulare Firmware liegt noch außerhalb des versionierten
`Pfaff-GreenControl-2.x`-Projekts. Der einzige Firmwarestand im Projekt ist die
ausdrücklich veraltete Legacy-Datei. Das Kanalbinding liegt wahrscheinlich in
`GCConfig.h`, deren Inhalt gemäß Sicherheitsvorgabe nicht gelesen werden darf.

Benötigte Freigabe/Information:

1. aktuelle modulare Firmware ohne `GCConfig.h` in einen versionierten
   `firmware/current/`-Pfad übernehmen,
2. funktionierenden Bewässerungskanal separat und ohne Secretinhalte angeben,
3. reproduzierbare Board- und Bibliotheksversionen dokumentieren.

Bis dahin werden keine Werte geraten und keine Hardwareaussagen aus der
Legacy-Datei abgeleitet.
