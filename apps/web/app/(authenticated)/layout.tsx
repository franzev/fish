import { ChatIdentityGuard } from "@/features/auth";
import { AppShell } from "@/components/shell/app-shell";
import { authRedirects } from "@/features/auth/redirects";
import { getAuthenticatedShellProfile } from "@/features/auth/server";
import { friendsFeatureEnabled } from "@/features/friends/server";
import { redirect } from "next/navigation";
import { CallProvider } from "@/features/calls";

/* D-06 default-deny: every route inside this (authenticated) group requires
   a session. getUser() is the only server-verified read (never
   untrusted client session data).
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
  const profile = await getAuthenticatedShellProfile();

  if (!profile) {
    // Defensive: a session with no profile row should never happen.
    redirect(authRedirects.signedOut);
  }

  return (
    <CallProvider
      userId={profile.userId}
      homeHref={profile.role === "coach" ? "/coach" : "/home"}
    >
      <ChatIdentityGuard userId={profile.userId} />
      <AppShell
        displayName={profile.displayName}
        role={profile.role}
        friendsNavEnabled={friendsFeatureEnabled()}
        preferences={{
          themePref: profile.themePref,
          textSizePref: profile.textSizePref,
          reducedMotionPref: profile.reducedMotionPref,
          timeFormatPref: profile.timeFormatPref,
        }}
      >
        {children}
      </AppShell>
    </CallProvider>
  );
}
