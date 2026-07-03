import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Token-hash email verification/reset handler (RESEARCH.md Pattern 2).
 * Distinct from OAuth's /auth/callback — this project uses no OAuth.
 * Both signup verification (type=email) and password reset
 * (type=recovery) route through this single handler (D-02).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/home"; // D-08: land signed-in at /home

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // D-06: missing/invalid/consumed token (including scanner pre-fetch) ->
  // calm expired-link screen, never a raw error. Forward a type hint so the
  // resend screen calls the correct method (recovery vs signup).
  const expiredLinkUrl = new URL("/expired-link", request.url);
  expiredLinkUrl.searchParams.set(
    "type",
    type === "recovery" ? "recovery" : "signup"
  );
  const email = searchParams.get("email");
  if (email) {
    expiredLinkUrl.searchParams.set("email", email);
  }
  return NextResponse.redirect(expiredLinkUrl);
}
