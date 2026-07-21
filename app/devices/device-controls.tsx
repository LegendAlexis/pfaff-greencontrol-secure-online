"use client";

import { useState } from "react";

type CopyValueButtonProps = {
  value: string;
  label: string;
  copiedLabel?: string;
  className?: string;
};

export function CopyValueButton({ value, label, copiedLabel = "Kopiert ✓", className = "" }: CopyValueButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Zum Kopieren markieren:", value);
    }
  }

  return (
    <button type="button" onClick={copy} className={`gc-copy-button ${className}`}>
      {copied ? copiedLabel : label}
    </button>
  );
}

export function CopyDeviceIdButton({ deviceId }: { deviceId: string }) {
  return <CopyValueButton value={deviceId} label="ID kopieren" />;
}

export function CopySecretButton({ secret }: { secret: string }) {
  return <CopyValueButton value={secret} label="Secret kopieren" className="gc-copy-button-secret" />;
}

export function DeleteDeviceButton({ deviceId, deviceName }: { deviceId: string; deviceName: string }) {
  return (
    <button
      type="submit"
      className="gc-device-action gc-device-action-danger"
      onClick={(event) => {
        const confirmed = window.confirm(
          `Gerät „${deviceName}“ wirklich dauerhaft löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden. Geräte-ID, Secret und Gewächshaus-Zuordnung gehen verloren.`
        );
        if (!confirmed) event.preventDefault();
      }}
    >
      Löschen
    </button>
  );
}
