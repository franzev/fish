import type { EmailTokenKind } from "@/lib/services";
import { verifyEmailLink } from "@/features/auth/server/auth-use-cases";
import { getServerServices } from "@/lib/services/runtime/server";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Token-hash email verification/reset handler (RESEARCH.md Pattern 2).
 * Distinct from OAuth's /auth/callback, which exchanges provider auth codes.
 * Both signup verification (type=email) and password reset
 * (type=recovery) route through this single handler (D-02).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  const tokenKinds: Record<string, EmailTokenKind> = {
    email: "email",
    signup: "signup",
    invite: "invite",
    magiclink: "magicLink",
    recovery: "recovery",
    email_change: "emailChange",
  };
  const type = rawType ? tokenKinds[rawType] ?? null : null;
  // D-08: land signed-in at /home. Only same-origin relative paths are
  // honored — `new URL(next, base)` would let an absolute ("https://evil"),
  // protocol-relative ("//evil"), or backslash ("/\evil") value override the
  // base and turn a legitimate confirmation link into an open redirect.
  const rawNext = searchParams.get("next") ?? "/home";
  const next =
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//") &&
    !rawNext.includes("\\")
      ? rawNext
      : "/home";

  if (token_hash && type) {
    const services = await getServerServices();
    if (await verifyEmailLink(token_hash, type, services.auth)) {
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
