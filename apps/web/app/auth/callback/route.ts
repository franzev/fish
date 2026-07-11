import { authRedirects } from "@/features/auth/redirects";
import { completeOAuthSignIn } from "@/features/auth/server/auth-use-cases";
import { getServerServices } from "@/lib/services/runtime/server";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const fallbackUrl = new URL(authRedirects.signedOut, request.url);

  if (!code) {
    return NextResponse.redirect(fallbackUrl);
  }

  const services = await getServerServices();
  const destination = await completeOAuthSignIn(code, {
    auth: services.auth,
    profiles: services.database.profiles,
  });

  return NextResponse.redirect(new URL(destination, request.url));
}
