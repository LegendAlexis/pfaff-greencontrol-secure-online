# Automatische Warnungen einrichten

## Sicherheitsprinzip
- Neue Gewächshäuser haben `monitoring_enabled = false`.
- Dadurch entstehen bei noch nicht installierten Gewächshäusern keine falschen E-Mails.
- Eine Störung erzeugt nur beim Zustandswechsel eine Mail.
- Wenn die Störung behoben ist, wird genau eine Entwarnung versendet.

## 1. Datenbank
In Supabase SQL Editor ausführen:

`supabase/automatic_alerts.sql`

## 2. Lokaler Funktionstest
In `.env.local` ergänzen:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ALERT_CRON_SECRET` (selbst ein langes zufälliges Passwort wählen)
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`

Server neu starten. Dann in PowerShell testen:

```powershell
$headers = @{ Authorization = "Bearer DEIN_ALERT_CRON_SECRET" }
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/alerts/check" -Headers $headers
```

Solange `monitoring_enabled=false` ist, muss `checked: 0` zurückkommen.

## 3. Erstes echtes Gewächshaus aktivieren
Erst wenn der Waveshare zuverlässig `last_seen` schreibt:

```sql
update public.greenhouses
set monitoring_enabled = true
where id = 1;
```

## 4. Online auf Vercel
In Vercel Environment Variables eintragen:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ALERT_CRON_SECRET`
- `ALERT_OFFLINE_AFTER_MINUTES=5`
- `NEXT_PUBLIC_APP_URL=https://DEINE-APP.vercel.app`
- alle SMTP-Werte

Danach neu deployen.

## 5. Automatischen Minutentakt einrichten
In `supabase/schedule_alert_checker_TEMPLATE.sql` URL und Secret ersetzen und im SQL Editor ausführen.

Der Vercel-Hobby-Cron ist nur täglich verfügbar. Deshalb übernimmt Supabase Cron den Minutentakt.
