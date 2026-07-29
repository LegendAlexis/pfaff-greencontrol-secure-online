# GreenControl 2.x – Zielarchitektur

Status: Phase-0-Entwurf, noch nicht implementiert.

## Aktuelle Architektur

```text
Browser / Next.js App Router UI
              |
      Server Components
      Server Actions / API
       /       |        \
Supabase SSR  Service    SMTP
Auth + RLS    Role Key   Mail
       \       |        /
         Supabase Cloud
        Auth + PostgreSQL
              |
   /api/device/heartbeat
              |
     Waveshare ESP32-S3
 modulare Firmware v1.3.1
```

UI und Server Actions greifen direkt auf Supabase-Tabellen zu. Domain Services
und Repository-Abstraktionen fehlen. Administrative Seiten benutzen teilweise
den Service-Role-Client und umgehen RLS; die Anwendungsprüfung ist dort die
einzige Schutzschicht.

## Zielschichten

```text
PWA / Admin- und Betriebs-UI
              |
      Server Actions / API
              |
 Auth Service + Tenant Context + Permission Service
              |
         Domain Services
  ┌───────────┼───────────┬──────────┐
  │           │           │          │
Devices   Automation    Alerts     OTA/Backup
  │           │           │          │
  └───────────┴─────┬─────┴──────────┘
                    |
             Repository Ports
                    |
      PostgreSQL-/Supabase-Adapter

Plugin Registry -> Komponenten -> Firmware-Treiber
Device Protocol <-> Hardwareprofile <-> ESP32
Audit Service <- alle sicherheitsrelevanten Aktionen
```

## Schichtengrenzen

- UI enthält keine Persistenz- oder Sicherheitsregeln.
- Server Actions/API validieren Eingabe, Session, Tenant und Berechtigung.
- Domain Services tragen Bewässerungs-, Fenster-, Automations- und
  Sicherheitsregeln.
- Repositories verlangen einen serverseitigen Tenant Context.
- Supabase bleibt zunächst PostgreSQL-Host, ist aber kein Domain-Interface.
- Geräteprotokoll, Konfigurationen und Befehle werden versioniert.
- Plugin-Registry beschreibt dynamische Komponenten, Schemas und Treiber.
- Firmware behält lokale Sicherheitsautorität.

## Ziel-Mandantenmodell

`tenant` (Betrieb) ist die oberste Datenisolation. Darunter liegen Standorte,
Gewächshäuser, Geräte und Komponenten. Jeder mandantenbezogene Datensatz trägt
eine `tenant_id`. `master_admin` arbeitet über einen gesonderten, auditierten
Pfad; alle anderen Rollen bleiben auf erlaubte Betriebe beschränkt.

Pfaff Bio Kräuter wird nach erfolgreicher Isolation und Restore-Vorbereitung als
erster Pilotbetrieb angelegt, nicht vorher.

