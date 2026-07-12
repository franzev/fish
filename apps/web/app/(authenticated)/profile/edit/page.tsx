import { authRedirects } from "@/features/auth/redirects";
import { avatarUploadsEnabled, getProfileData } from "@/features/profile/server";
import { redirect } from "next/navigation";
import { EditProfileForm } from "./_components/edit-profile-form";

/* Server Component -- same wrong-door guard as /profile. Prefills the form
   from the same getProfileData() read Task 1 built. A hard refresh re-runs
   this component, re-fetching from the DB -- unsaved typed text is gone,
   last-saved values reappear (D-07, free from Server Components). This is
   the ONLY screen carrying a primary action (D-06): Save. */
export default async function EditProfilePage() {
  const data = await getProfileData();

  if (!data) {
    redirect(authRedirects.signedOut);
  }

  return (
    <div className="mx-auto w-full max-w-form">
      <EditProfileForm
        role={data.role}
        userId={data.userId}
        avatarUrl={data.avatarUrl}
        avatarEnabled={avatarUploadsEnabled()}
        initial={{
          displayName: data.displayName,
          goal: data.goal,
          locale: data.locale ?? "",
          timezone: data.timezone ?? "",
        }}
      />
    </div>
  );
}
