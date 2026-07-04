import { authRedirects } from "@fish/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/* Pure redirect (D-02) — this file renders nothing. Every branch redirects:
   signed-out -> /login, client -> /home, coach -> /coach. Role is resolved
   server-side via getUser() (network-verified), never trusted from a
   client-supplied value. Replaces the stale pre-monochrome showcase. */
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(authRedirects.signedOut);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  redirect(
    profile?.role === "coach" ? authRedirects.coachHome : authRedirects.clientHome
  );
}
