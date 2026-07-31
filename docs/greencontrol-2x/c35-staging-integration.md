# C3.5 – Staging-Integration

## Status

Der identitätsgesicherte Integrationsrunner ist vorbereitet und lokal
statisch getestet. Die echte Ausführung benötigt die ausschließlich lokal
verwahrten Staging-Zugangsdaten. Ergebnisse werden erst nach einem
erfolgreichen Lauf eingetragen.

## Ablauf

1. Exakte Datenbank- und API-Identität des Staging-Projekts prüfen.
2. C2-Migration dauerhaft auf Staging anwenden.
3. RLS, Spaltenzahl und Policy-Ausgangszustand prüfen.
4. Ein isoliertes Testgewächshaus und zwei synthetische Geräte anlegen.
5. Je zwei Commands für Bewässerung, Dach- und Seitenfenster des ersten
   Geräts sowie einen fremden Command für das zweite Gerät anlegen.
6. Den echten Next.js-Route-Handler mit gültiger Geräteauthentifizierung
   ausführen.
7. Geräteisolation und höchstens einen Command pro Aktor prüfen.
8. Wiederholte Auslieferung vor ACK prüfen.
9. getrennte ACKs und wiederholte identische ACKs prüfen.
10. Cross-Device-ACK mit HTTP 409 abweisen.
11. alle Commands, Testgeräte und das Testgewächshaus im `finally` entfernen.
12. bestätigen, dass keine Fixtures verbleiben.

Die Tabelle `public.device_commands` bleibt nach erfolgreichem C3.5 in
Staging bestehen. Nur synthetische Testdaten werden entfernt.

## Secret-Grenze

Der Runner liest keine `.env.local`. Vor der Ausführung müssen
`NEXT_PUBLIC_SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` ausschließlich in
der aktuellen PowerShell-Sitzung auf Staging gesetzt sein. Die Werte werden
nicht ausgegeben oder gespeichert.

## Ergebnis

Noch ausstehend.
