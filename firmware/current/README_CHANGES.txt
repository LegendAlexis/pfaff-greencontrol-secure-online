Pfaff GreenControl - korrigierte Version

Es wurden nur diese zwei Funktionen angepasst:

1. DS18B20 Temperatursensor:
   DATA -> GPIO21
   GND  -> G
   VDD  -> 3V3

2. Fenster voruebergehend deaktiviert:
   CH1 Dach AUF  gesperrt
   CH2 Dach ZU   gesperrt
   CH3 Wand AUF  gesperrt
   CH4 Wand ZU   gesperrt

Bewässerung, Cloud/API, WLAN und die übrige Logik bleiben bestehen.
Die vorhandene GCConfig.h muss in den gleichnamigen Arduino-Sketchordner
Pfaff_GreenControl_Firmware_v1_3_1_GPIO21_windows_off kopiert werden.
