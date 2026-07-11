import "server-only";

import { createClient } from "@/lib/supabase/server";
import { authRedirects } from "@fish/supabase/auth";
import { redirect } from "next/navigation";

/* Inverse of the (authenticated) layout guard: that layout redirects a
   signed-OUT visitor away; this helper redirects a signed-IN visitor away
   from the auth pages (D-05 — /login and /signup are wrong doors once
   already signed in). getUser() only, never getSession() — see
   apps/web/lib/supabase/server.ts's hard rule comment. No try/catch:
   redirect() throws by design and must propagate to halt rendering. */
export async function redirectIfSignedIn(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  redirect(
    profile?.role === "coach"
      ? authRedirects.coachHome
      : authRedirects.clientHome
  );
}
