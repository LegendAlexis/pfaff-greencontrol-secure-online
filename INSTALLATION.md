# Pfaff GreenControl V2 – Installation

## 1. Lokaler Test
1. Die vorhandene `.env.local` aus dem bisherigen Projekt in diesen Ordner kopieren.
2. `npm install`
3. `npm run dev`
4. `http://localhost:3000` öffnen.

## 2. Supabase Auth
Unter Authentication > URL Configuration:
- Site URL: `https://smart-greenhouse-nine.vercel.app`
- Redirect URLs:
  - `http://localhost:3000/**`
  - `https://smart-greenhouse-nine.vercel.app/**`

Unter Authentication > Users den Besitzer anlegen:
- `mpfaff@pfaff-biokraeuter.ch`

## 3. SQL
Die Datei `supabase/pfaff_greencontrol_v2.sql` im SQL Editor ausführen.
Danach den am Ende auskommentierten Besitzer-Befehl ohne `--` ausführen.

## 4. Rollen
- `owner`: steuern, Zeiten/Grenzwerte ändern, Benutzer und Gewächshäuser verwalten.
- `operator`: steuern, Zeiten/Grenzwerte ändern.
- `viewer`: nur lesen.

## 5. Mehrere Gewächshäuser
Jedes Gewächshaus hat eine eigene ID. Der jeweilige ESP32 bekommt später eine eigene Konstante, z. B. `GREENHOUSE_ID = 2`.

## 6. Wetterstation
Die Wetterseite ist vorbereitet. Bis die gekaufte Wetterstation Daten schreibt, zeigt sie „Noch nicht verbunden“.

## 7. Diagramme
Die Tabelle `sensor_readings` ist vorbereitet. Der ESP32 muss später zusätzlich regelmäßig Messwerte dort einfügen.

## Sicherheit
Die alte Online-App nicht löschen, bevor V2 lokal funktioniert. Recovery-Codes aus früheren Screenshots in Vercel neu erzeugen.
