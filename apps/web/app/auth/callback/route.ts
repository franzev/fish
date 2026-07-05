import { authRedirects } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const fallbackUrl = new URL(authRedirects.signedOut, request.url);

  if (!code) {
    return NextResponse.redirect(fallbackUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(fallbackUrl);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let destination: string = authRedirects.clientHome;

  if (user?.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "coach") {
      destination = authRedirects.coachHome;
    }
  }

  return NextResponse.redirect(new URL(destination, request.url));
}
