# Pfaff GreenControl – Sicherheit und Online-Stellung

## 1. Datenbankmigration
In Supabase SQL Editor `supabase/security_admin_devices_audit.sql` vollständig ausführen.

## 2. Supabase Auth
- Allow new users to sign up: AUS
- Anonymous sign-ins: AUS
- Manual linking: AUS
- Confirm email: EIN
- Rate Limits prüfen und Password/OTP-Limits nicht erhöhen.

## 3. Vercel
Projekt aus GitHub importieren und alle Werte aus `.env.example` als Environment Variables hinterlegen. Secrets niemals mit `NEXT_PUBLIC_` benennen.

## 4. Domain
Empfohlen: `greencontrol.pfaff-biokraeuter.ch`. In Vercel unter Settings > Domains hinzufügen und den angezeigten DNS-CNAME beim Domainanbieter eintragen.

## 5. Supabase URLs
Site URL: `https://greencontrol.pfaff-biokraeuter.ch`
Redirect URLs:
- `https://greencontrol.pfaff-biokraeuter.ch/auth/confirm`
- `https://greencontrol.pfaff-biokraeuter.ch/update-password`
- lokale URLs für Entwicklung zusätzlich behalten.

## 6. Automatische Warnungen
Nach dem Deployment `NEXT_PUBLIC_APP_URL` auf die Online-Domain setzen und `schedule_alert_checker_TEMPLATE.sql` mit Domain und Cron-Secret ausfüllen. Cron-Secret nicht direkt in öffentlich sichtbaren SQL-Dateien speichern; bevorzugt Supabase Vault verwenden.

## 7. Geräte
Jedes Waveshare über Geräteverwaltung registrieren. Das einmal angezeigte Device-Secret nur in der Firmware speichern. Der Endpoint ist `/api/device/heartbeat` mit Headern `X-Device-Id` und `X-Device-Secret`.
