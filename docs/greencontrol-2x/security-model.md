# GreenControl 2.x – Sicherheitsmodell

## Aktueller Stand

Authentifizierung erfolgt vollständig über Supabase Auth. Browser und Server
verwenden Supabase-SSR-Cookies. Nicht öffentliche Seiten werden im Next.js
Proxy durch `auth.getUser()` geschützt.

Login-Funktionen:

- E-Mail/Passwort
- öffentliche Registrierung im Code; laut Betriebsdokumentation soll Signup
  in Supabase deaktiviert sein
- E-Mail-Bestätigung über PKCE oder OTP-Hash
- Passwort-Reset und Passwortänderung
- globaler Session-Widerruf durch Manager
- Supabase TOTP-MFA und AAL2-Step-up

Es gibt keine eigenen Argon2id-Hashes, keinen Pepper, keine eigene
Sessiontabelle, keine Recovery-Code-Verwaltung und kein anwendungsseitiges
Login-Rate-Limiting.

## Aktuelles Berechtigungsmodell

Systemrollen:

- `admin`
- `owner`
- `operator`
- `viewer`

Gewächshausrollen:

- `owner`
- `operator`
- `viewer`

`requireManager()` erlaubt `admin` und `owner`. Mit Parameter `true` wird AAL2
verlangt. `authorizedClient()` prüft Mitgliedschaft je Gewächshaus und
verweigert nur `viewer` das Schreiben.

RLS schützt Profile, Mitgliedschaften, Gewächshäuser, Zeitpläne, Warnungen,
Messwerte und Benachrichtigungen teilweise. Administrative Seiten verwenden
häufig den Service-Role-Client und umgehen RLS.

## Kritische Befunde

1. Das Cron-SQL-Template enthält einen fest eingetragenen Bearer-Wert. Er wird
   nicht dokumentiert und ist zu rotieren.
2. Die veraltete Web-App-Firmware enthält fest eingetragene Netzwerk- und
   Cloudzugangsdaten. Sie darf nicht weiterverwendet werden; betroffene Werte
   sind als potenziell kompromittiert zu behandeln.
3. Login und Reset geben konkrete Supabase-Fehler weiter.
4. `signup()` ist im Code öffentlich erreichbar; Sicherheit hängt von einer
   externen Supabase-Einstellung ab.
5. `is_active` wird erst nach erfolgreicher Supabase-Anmeldung geprüft.
6. `is_system_manager()` berücksichtigt in einer SQL-Variante `is_active`
   nicht.
7. Admin-/Owner-Rechte sind global und noch nicht tenantgebunden.
8. Neue Geräte-Secrets erscheinen in einer URL-Query und können in
   Historie/Logs geraten.
9. Geräte-Secrets sind einfache SHA-256-Digests ohne serverseitigen Pepper.
10. Heartbeat besitzt keine Nonce, Sequenznummer oder Replay-Abwehr.
11. CSP erlaubt `unsafe-inline` und `unsafe-eval`.
12. Audit-Fehler verhindern die eigentliche Aktion nicht.
13. Nicht alle Steuerungs- und Einstellungsaktionen werden auditiert.

## Zielmodell

Jeder Zugriff prüft Session, Kontostatus, serverseitigen Tenant Context,
Ressourcenzugehörigkeit, Einzelberechtigung und gegebenenfalls frisches
Step-up-MFA. Browser und Geräte sind nicht vertrauenswürdig. Secrets, Tokens,
WLAN-Passwörter und Recovery-Codes werden weder geloggt noch in URLs
transportiert.

Eigenes Login wird erst parallel eingeführt und verwendet Argon2id, optionalen
Pepper, rotierende widerrufbare HTTP-only-Sessions, gehashte Einmal-Tokens,
Kontosperren, generische Fehler, Rate-Limits, TOTP und gehashte Recovery-Codes.

