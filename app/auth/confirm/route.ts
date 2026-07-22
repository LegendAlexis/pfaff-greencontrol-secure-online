import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../../lib/supabase/server";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const requestedNext = searchParams.get("next");

  const supabase = await createClient();

  /*
   * PKCE-Code bestätigen.
   * Bei Einladungen und Passwort-Wiederherstellungen
   * muss der Benutzer zuerst ein Passwort festlegen.
   */
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const destination =
        type === "invite" || type === "recovery"
          ? "/update-password"
          : safeNextPath(requestedNext);

      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  /*
   * Token-Hash aus dem eigenen E-Mail-Link bestätigen.
   */
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      const destination =
        type === "invite" || type === "recovery"
          ? "/update-password"
          : safeNextPath(requestedNext);

      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  return NextResponse.redirect(
    new URL(
      "/login?error=Bestätigung oder Passwort-Link ist ungültig oder abgelaufen.",
      request.url,
    ),
  );
}