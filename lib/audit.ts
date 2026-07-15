import { createAdminClient } from "./supabase/admin";

export async function writeAuditLog(args: {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  greenhouseId?: number | null;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_logs").insert({
    actor_user_id: args.actorUserId ?? null,
    action: args.action,
    entity_type: args.entityType,
    entity_id: args.entityId == null ? null : String(args.entityId),
    greenhouse_id: args.greenhouseId ?? null,
    old_value: args.oldValue ?? null,
    new_value: args.newValue ?? null,
    metadata: args.metadata ?? {},
  });

  if (error) console.error("Audit-Log konnte nicht gespeichert werden:", error.message);
}
