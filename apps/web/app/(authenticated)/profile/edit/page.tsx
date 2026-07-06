import { authRedirects } from "@/lib/auth/redirects";
import { getProfileData } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { EditProfileForm } from "./edit-profile-form";

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

  if (data.role === "coach") {
    redirect(authRedirects.coachHome);
  }

  return (
    <main className="flex min-h-dvh items-start justify-center px-page py-2xl">
      <EditProfileForm
        initial={{
          displayName: data.displayName,
          goal: data.goal,
          locale: data.locale ?? "",
          timezone: data.timezone ?? "",
        }}
      />
    </main>
  );
}
