import { AppShell } from "@/components/shell/app-shell";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/* D-06 default-deny: every route inside this (authenticated) group requires
   a session. getUser() is the only server-verified read (never
   getSession() — see apps/web/lib/supabase/server.ts's hard rule comment).
   The public allowlist (/login, /signup, /forgot-password, /reset-password,
   /check-inbox, /expired-link, /auth/confirm, /kit) is enforced
   structurally — those routes live OUTSIDE this group, so this guard never
   wraps them. The per-page "wrong role for THIS page" guard (D-03) is NOT
   here — it lives in each leaf page, because a layout does not cleanly know
   which leaf route it wraps. redirect() throws by design; do not try/catch
   it or the profiles query — let genuine network failures surface to the
   Next.js error boundary instead of silently redirecting to the wrong place. */
export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // Defensive: a session with no profile row should never happen.
    redirect("/login");
  }

  return <AppShell displayName={profile.display_name}>{children}</AppShell>;
}
