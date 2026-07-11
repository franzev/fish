import { A11yPrefs } from "@/components/profile/a11y-prefs";
import { Avatar } from "@/components/chat";
import { CoachCard } from "@/components/profile/coach-card";
import { ConsentRow } from "@/components/profile/consent-row";
import { LogoutButton } from "@/components/auth/logout-button";
import { SettingsRow } from "@/components/profile/settings-row";
import { Card } from "@/components/ui/card";
import { authRedirects } from "@/lib/auth/redirects";
import { getProfileData } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { IconChevronRight } from "@tabler/icons-react";

/* Server Component (NOT "use client") -- mirrors home/page.tsx's wrong-door
   guard + data-fetch + render shape (D-17/read_first). Sketch 003 winner A
   ("Essentials"): identity + coach card + settings, NO primary button
   anywhere on this view (D-06) -- the single Save primary lives ONLY on
   /profile/edit. Progress/metrics are a separate tab, explicitly out of
   scope this phase -- this view never repeats them (sketch-findings-fish). */
export default async function ProfilePage() {
  const data = await getProfileData();

  if (!data) {
    redirect(authRedirects.signedOut);
  }

  if (data.role === "coach") {
    redirect(authRedirects.coachHome);
  }

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-col items-center gap-sm py-md text-center">
        <Avatar name={data.displayName} size="lg" />
        <div>
          <h1 className="text-2xl">{data.displayName}</h1>
          <p className="text-ui text-muted">Learning English</p>
        </div>
      </div>

      <CoachCard coachName={data.coachName} />

      <Card className="divide-y divide-border p-0">
        <SettingsRow
          label="Edit profile"
          control={
            <Link
              href="/profile/edit"
              className="flex min-h-control items-center gap-2xs rounded-control px-sm text-ui-sm text-body underline"
            >
              Edit
              <IconChevronRight size={16} stroke={1.75} aria-hidden="true" />
            </Link>
          }
        />
        <A11yPrefs
          themePref={data.themePref}
          textSizePref={data.textSizePref}
          reducedMotionPref={data.reducedMotionPref}
          timeFormatPref={data.timeFormatPref}
        />
        <ConsentRow
          consented={data.consented}
          consentVersion={data.consentVersion}
        />
        <SettingsRow label="Sign out" control={<LogoutButton />} />
      </Card>
    </div>
  );
}
