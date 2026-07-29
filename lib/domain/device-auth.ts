import { createHash, timingSafeEqual } from "node:crypto";

export type DeviceCredentials = {
  deviceId: string;
  deviceSecret: string;
};

export function readDeviceCredentials(
  headers: Pick<Headers, "get">,
): DeviceCredentials | null {
  const deviceId = headers.get("x-device-id")?.trim();
  const deviceSecret = headers.get("x-device-secret")?.trim();

  return deviceId && deviceSecret ? { deviceId, deviceSecret } : null;
}

export function hashDeviceSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function verifyDeviceSecret(secret: string, hashHex: string) {
  const supplied = Buffer.from(hashDeviceSecret(secret), "hex");
  const stored = Buffer.from(hashHex, "hex");

  return (
    supplied.length === stored.length &&
    timingSafeEqual(supplied, stored)
  );
}

export function isAuthorizedDevice<
  T extends { active: boolean; secret_hash: string },
>(
  device: T | null | undefined,
  suppliedSecret: string,
): device is T {
  return Boolean(
    device?.active &&
      verifyDeviceSecret(suppliedSecret, device.secret_hash),
  );
}
