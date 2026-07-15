"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "../../lib/supabase/admin";
import { requireManager } from "../../lib/auth/permissions";
import { writeAuditLog } from "../../lib/audit";

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export async function registerDevice(formData: FormData) {
  const { user } = await requireManager(true);
  const greenhouseId = Number(formData.get("greenhouse_id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!Number.isFinite(greenhouseId) || !name) throw new Error("Gerätename und Gewächshaus sind erforderlich");

  const secret = randomBytes(32).toString("base64url");
  const admin = createAdminClient();
  const { data, error } = await admin.from("devices").insert({
    greenhouse_id: greenhouseId,
    name,
    secret_hash: hashSecret(secret),
    active: true,
  }).select("id").single();
  if (error) throw new Error(error.message);

  await writeAuditLog({ actorUserId: user.id, action: "device.registered", entityType: "device", entityId: data.id, greenhouseId, newValue: { name } });
  redirect(`/devices?new_device=${data.id}&secret=${encodeURIComponent(secret)}`);
}

export async function rotateDeviceSecret(formData: FormData) {
  const { user } = await requireManager(true);
  const deviceId = String(formData.get("device_id") ?? "");
  const secret = randomBytes(32).toString("base64url");
  const admin = createAdminClient();
  const { data, error } = await admin.from("devices").update({ secret_hash: hashSecret(secret), updated_at: new Date().toISOString() }).eq("id", deviceId).select("greenhouse_id").single();
  if (error) throw new Error(error.message);
  await writeAuditLog({ actorUserId: user.id, action: "device.secret_rotated", entityType: "device", entityId: deviceId, greenhouseId: data.greenhouse_id });
  redirect(`/devices?new_device=${deviceId}&secret=${encodeURIComponent(secret)}`);
}

export async function toggleDevice(formData: FormData) {
  const { user } = await requireManager(true);
  const deviceId = String(formData.get("device_id") ?? "");
  const active = formData.get("active") === "true";
  const admin = createAdminClient();
  const { data, error } = await admin.from("devices").update({ active, updated_at: new Date().toISOString() }).eq("id", deviceId).select("greenhouse_id,name").single();
  if (error) throw new Error(error.message);
  await writeAuditLog({ actorUserId: user.id, action: active ? "device.enabled" : "device.disabled", entityType: "device", entityId: deviceId, greenhouseId: data.greenhouse_id, metadata: { name: data.name } });
  revalidatePath("/devices");
}
