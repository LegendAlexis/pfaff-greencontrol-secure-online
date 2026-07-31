# C3.5 – Staging-Integration

## Status

Abgeschlossen. Der identitätsgesicherte Integrationsrunner wurde am
31. Juli 2026 erfolgreich gegen das GreenControl-Staging-Projekt
`iacplyydjtiirghwixys` ausgeführt.

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

Vom lokalen, secret-freien Ergebnisbericht bestätigt:

- C2-Migration wurde erfolgreich auf Staging angewendet und bleibt dort
  bestehen.
- Geräteisolation und höchstens ein Command je Aktor wurden bestätigt.
- Bewässerung, Dachfenster und Seitenfenster wurden getrennt ausgeliefert.
- erneute Auslieferung vor ACK war idempotent,
- aktorspezifische ACKs wurden gespeichert,
- wiederholte identische ACKs blieben idempotent,
- ein Cross-Device-ACK wurde mit HTTP 409 abgewiesen,
- sämtliche synthetischen Commands, Geräte und das Testgewächshaus wurden
  entfernt.

Abschlussstatus:

```text
C3.5 STAGING INTEGRATION PASSED
passed-fixtures-removed-c2-retained
```

Es wurden keine Firmware, Hardware, Heartbeat-Logik oder Produktionsdaten
verändert.
