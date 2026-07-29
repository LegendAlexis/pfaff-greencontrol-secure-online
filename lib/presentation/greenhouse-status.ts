export const DEFAULT_OFFLINE_AFTER_MS = 90_000;

export function isRecentHeartbeat(
  lastSeen: string | null | undefined,
  thresholdMs: number,
  nowMs = Date.now(),
) {
  if (!lastSeen) return false;
  const timestamp = new Date(lastSeen).getTime();
  return Number.isFinite(timestamp) && nowMs - timestamp < thresholdMs;
}

export function getDeviceState(
  lastSeen: string | null | undefined,
  nowMs = Date.now(),
  offlineAfterMs = DEFAULT_OFFLINE_AFTER_MS,
) {
  if (!lastSeen) return { online: false, label: "Noch kein Signal" };

  const timestamp = new Date(lastSeen).getTime();
  if (Number.isNaN(timestamp)) {
    return { online: false, label: "Ungültiger Status" };
  }

  const ageMs = Math.max(0, nowMs - timestamp);
  if (ageMs < offlineAfterMs) return { online: true, label: "Online" };

  const minutes = Math.floor(ageMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  return {
    online: false,
    label:
      days > 0
        ? `Offline seit ${days} Tag${days === 1 ? "" : "en"}`
        : hours > 0
          ? `Offline seit ${hours} Std.`
          : `Offline seit ${Math.max(1, minutes)} Min.`,
  };
}

export function formatTemperature(
  value: number | string | null | undefined,
) {
  const temperature = Number(value);
  return value !== null &&
    value !== undefined &&
    Number.isFinite(temperature)
    ? `${temperature.toFixed(1)} °C`
    : "— °C";
}
