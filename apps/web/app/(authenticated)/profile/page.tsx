import { A11yPrefs, CoachCard, ConsentRow, SettingsRow } from "@/features/profile";
import { Avatar } from "@/features/chat";
import { LogoutButton } from "@/features/auth";
import { Card } from "@/components/ui/card";
import { authRedirects } from "@/features/auth/redirects";
import { getProfileData } from "@/features/profile/server";
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

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-col items-center gap-sm py-md text-center">
        <Avatar
          profileId={data.userId}
          src={data.avatarUrl ?? undefined}
          name={data.displayName}
          size="lg"
          alt=""
        />
        <div>
          <h1 className="text-2xl">{data.displayName}</h1>
          <p className="text-ui text-muted">
            {data.role === "client" ? "Learning English" : "Coach"}
          </p>
        </div>
      </div>

      {data.role === "client" && (
        <CoachCard
          coachId={data.coachId}
          coachName={data.coachName}
          avatarUrl={data.coachAvatarUrl}
        />
      )}

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
        {data.role === "client" && (
          <>
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
          </>
        )}
        <SettingsRow label="Sign out" control={<LogoutButton />} />
      </Card>
    </div>
  );
}
