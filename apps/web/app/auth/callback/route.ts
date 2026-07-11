import { authRedirects } from "@/features/auth/redirects";
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
  const exchange = await services.auth.exchangeCode(code);
  if (!exchange.ok) {
    return NextResponse.redirect(fallbackUrl);
  }

  const userResult = await services.auth.getCurrentUser();
  const user = userResult.ok ? userResult.data : null;

  let destination: string = authRedirects.clientHome;

  if (user?.id) {
    const profile = await services.database.profiles.findRoleById(user.id);
    if (profile.ok && profile.data?.role === "coach") {
      destination = authRedirects.coachHome;
    }
  }

  return NextResponse.redirect(new URL(destination, request.url));
}
