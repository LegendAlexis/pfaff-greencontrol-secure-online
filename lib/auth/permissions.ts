import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";

export type SystemRole = "admin" | "owner" | "operator" | "viewer";

export async function getCurrentIdentity() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id,full_name,email,system_role,is_active,mfa_required")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile?.is_active) redirect("/login?error=Konto%20ist%20deaktiviert");

  return {
    user,
    profile: profile as {
      id: string;
      full_name: string | null;
      email: string | null;
      system_role: SystemRole;
      is_active: boolean;
      mfa_required: boolean;
    },
  };
}

export async function requireManager(requireMfa = false) {
  const identity = await getCurrentIdentity();
  if (!(["admin", "owner"] as SystemRole[]).includes(identity.profile.system_role)) {
    redirect("/dashboard?error=Keine%20Berechtigung");
  }

  if (requireMfa) {
    const supabase = await createClient();
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!data || data.currentLevel !== "aal2") {
      redirect("/security/mfa?message=MFA%20ist%20für%20diese%20Aktion%20erforderlich");
    }
  }

  return identity;
}

export function canAssignRole(actor: SystemRole, target: SystemRole) {
  if (actor === "admin") return true;
  return target !== "admin";
}
