import { ChatIdentityGuard } from "@/features/auth";
import { AppShell } from "@/components/shell/app-shell";
import { authRedirects } from "@/features/auth/redirects";
import { getAuthenticatedShellProfile } from "@/features/auth/server";
import { friendsFeatureEnabled } from "@/features/friends/server";
import { redirect } from "next/navigation";
import { CallPopover, CallProvider } from "@/features/calls";
import { NotificationProvider } from "@/features/notifications";
import { getNotificationShellData } from "@/features/notifications/server";
import { PresenceProvider } from "@/features/presence/components/presence-provider/presence-provider";
import { loadMessagePopoverAction } from "@/features/chat/server";

/* D-06 default-deny: every route inside this (authenticated) group requires
   a session. getUser() is the only server-verified read (never
   untrusted client session data).
   The public allowlist (/sign-in, /signup, /forgot-password, /reset-password,
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

  const notifications = await getNotificationShellData();

  return (
    <PresenceProvider
      userId={profile.userId}
      timeFormatPref={profile.timeFormatPref}
    >
      <NotificationProvider
        userId={profile.userId}
        initialPage={notifications.page}
        initialSummary={notifications.summary}
        initialAttention={notifications.attention}
      >
        <CallProvider
          userId={profile.userId}
        >
          <ChatIdentityGuard userId={profile.userId} />
          <AppShell
            displayName={profile.displayName}
            avatarUrl={profile.avatarUrl}
            profileId={profile.userId}
            role={profile.role}
            friendsNavEnabled={friendsFeatureEnabled()}
            loadMessagePopoverAction={loadMessagePopoverAction}
            preferences={{
              themePref: profile.themePref,
              reducedMotionPref: profile.reducedMotionPref,
              timeFormatPref: profile.timeFormatPref,
            }}
          >
            {children}
          </AppShell>
          <CallPopover />
        </CallProvider>
      </NotificationProvider>
    </PresenceProvider>
  );
}
