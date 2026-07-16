"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "../../lib/supabase/admin";
import { canAssignRole, requireManager, type SystemRole } from "../../lib/auth/permissions";
import { writeAuditLog } from "../../lib/audit";

const allowedRoles: SystemRole[] = ["admin", "owner", "operator", "viewer"];

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function inviteUser(formData: FormData) {
  const { user: actor, profile: actorProfile } = await requireManager(true);
  const email = text(formData, "email").toLowerCase();
  const fullName = text(formData, "full_name");
  const role = text(formData, "system_role") as SystemRole;
  const greenhouseIds = formData.getAll("greenhouse_ids").map(Number).filter(Number.isFinite);

  if (!email || !email.includes("@")) throw new Error("Gültige E-Mail-Adresse erforderlich");
  if (!allowedRoles.includes(role) || !canAssignRole(actorProfile.system_role, role)) {
    throw new Error("Diese Rolle darf nicht vergeben werden");
  }

  const admin = createAdminClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/confirm?next=/update-password`;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name: fullName || email },
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Einladung konnte nicht erstellt werden");

  const { error: profileError } = await admin.from("profiles").upsert({
    id: data.user.id,
    full_name: fullName || email,
    email,
    system_role: role,
    is_active: true,
    mfa_required: role === "admin" || role === "owner",
  }, { onConflict: "id" });
  if (profileError) throw new Error(profileError.message);

  if (greenhouseIds.length > 0) {
    const greenhouseRole = role === "viewer" ? "viewer" : role === "operator" ? "operator" : "owner";
    const { error: membershipError } = await admin.from("greenhouse_users").upsert(
      greenhouseIds.map((greenhouseId) => ({ greenhouse_id: greenhouseId, user_id: data.user!.id, role: greenhouseRole })),
      { onConflict: "greenhouse_id,user_id" },
    );
    if (membershipError) throw new Error(membershipError.message);
  }

  await admin.from("notification_settings").upsert({
    user_id: data.user.id,
    email_address: email,
    email_enabled: false,
    offline_alerts: true,
    frost_alerts: true,
    critical_alerts: true,
  }, { onConflict: "user_id" });

  await writeAuditLog({
    actorUserId: actor.id,
    action: "user.invited",
    entityType: "user",
    entityId: data.user.id,
    newValue: { email, fullName, role, greenhouseIds },
  });

  redirect("/users?message=Einladung%20wurde%20gesendet");
}

export async function updateUserAccess(formData: FormData) {
  const { user: actor, profile: actorProfile } = await requireManager(true);
  const userId = text(formData, "user_id");
  const fullName = text(formData, "full_name");
  const role = text(formData, "system_role") as SystemRole;
  const isActive = formData.get("is_active") === "on";
  const mfaRequired = formData.get("mfa_required") === "on";
  const greenhouseIds = formData.getAll("greenhouse_ids").map(Number).filter(Number.isFinite);

  if (!userId || !allowedRoles.includes(role) || !canAssignRole(actorProfile.system_role, role)) {
    throw new Error("Ungültige Benutzeränderung");
  }

  const admin = createAdminClient();
  const { data: oldProfile, error: oldError } = await admin
    .from("profiles")
    .select("full_name,email,system_role,is_active,mfa_required")
    .eq("id", userId)
    .single();
  if (oldError) throw new Error(oldError.message);

  if (oldProfile.system_role === "admin" && (role !== "admin" || !isActive)) {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("system_role", "admin")
      .eq("is_active", true);
    if ((count ?? 0) <= 1) throw new Error("Der letzte aktive Administrator kann nicht entfernt werden");
  }

  if (actor.id === userId && !isActive) throw new Error("Das eigene Konto kann nicht deaktiviert werden");

  const { error: updateError } = await admin.from("profiles").update({
    full_name: fullName || oldProfile.email,
    system_role: role,
    is_active: isActive,
    mfa_required: mfaRequired || role === "admin" || role === "owner",
    updated_at: new Date().toISOString(),
  }).eq("id", userId);
  if (updateError) throw new Error(updateError.message);

  const { error: deleteError } = await admin.from("greenhouse_users").delete().eq("user_id", userId);
  if (deleteError) throw new Error(deleteError.message);

  if (greenhouseIds.length > 0) {
    const greenhouseRole = role === "viewer" ? "viewer" : role === "operator" ? "operator" : "owner";
    const { error: membershipError } = await admin.from("greenhouse_users").insert(
      greenhouseIds.map((greenhouseId) => ({ greenhouse_id: greenhouseId, user_id: userId, role: greenhouseRole })),
    );
    if (membershipError) throw new Error(membershipError.message);
  }

  await writeAuditLog({
    actorUserId: actor.id,
    action: "user.access_updated",
    entityType: "user",
    entityId: userId,
    oldValue: oldProfile,
    newValue: { fullName, role, isActive, mfaRequired, greenhouseIds },
  });

  revalidatePath("/users");
}

export async function resendInvitation(formData: FormData) {
  const { user: actor } = await requireManager(true);
  const email = text(formData, "email").toLowerCase();
  const admin = createAdminClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/confirm?next=/update-password`;
  const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (error) throw new Error(error.message);
  await writeAuditLog({ actorUserId: actor.id, action: "user.invitation_resent", entityType: "user", metadata: { email } });
  redirect("/users?message=Einladung%20erneut%20gesendet");
}

export async function revokeSessions(formData: FormData) {
  const { user: actor } = await requireManager(true);
  const userId = text(formData, "user_id");
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.signOut(userId, "global");
  if (error) throw new Error(error.message);
  await writeAuditLog({ actorUserId: actor.id, action: "user.sessions_revoked", entityType: "user", entityId: userId });
  revalidatePath("/users");
}

export async function createTemporaryPassword() {
  return randomBytes(18).toString("base64url");
}
