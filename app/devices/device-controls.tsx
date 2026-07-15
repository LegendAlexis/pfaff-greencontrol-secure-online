"use client";

import { useState } from "react";

export function CopyDeviceIdButton({ deviceId }: { deviceId: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(deviceId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-lg border border-zinc-700 px-2 py-1 text-xs font-bold hover:bg-zinc-800"
      aria-label="Geräte-ID kopieren"
    >
      {copied ? "Kopiert ✓" : "📋 Kopieren"}
    </button>
  );
}

export function DeleteDeviceButton({ deviceId, deviceName }: { deviceId: string; deviceName: string }) {
  return (
    <button
      type="submit"
      className="rounded-xl border border-red-800 px-3 py-2 text-sm font-bold text-red-300 hover:bg-red-950/40"
      onClick={(event) => {
        const confirmed = window.confirm(
          `Gerät „${deviceName}“ wirklich dauerhaft löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden. Geräte-ID, Secret und Gewächshaus-Zuordnung gehen verloren.`
        );
        if (!confirmed) event.preventDefault();
      }}
    >
      🗑 Löschen
    </button>
  );
}
