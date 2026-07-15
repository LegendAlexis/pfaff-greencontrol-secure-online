"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (password.length < 10) {
    redirect("/update-password?error=Das Passwort muss mindestens 10 Zeichen haben.");
  }

  if (password !== confirmation) {
    redirect("/update-password?error=Die Passwörter stimmen nicht überein.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/update-password?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.auth.signOut();
  redirect("/login?message=Passwort gespeichert. Bitte jetzt neu anmelden.");
}
