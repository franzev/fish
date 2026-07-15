import { redirectIfSignedIn } from "@/features/auth/server";
import {
  parseThemePreference,
  THEME_PREFERENCE_COOKIE,
} from "@/lib/prefs/theme-preference";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LandingPage } from "./_components/landing-page";

export const metadata: Metadata = {
  title: "FISH — English coaching that fits how your brain works",
};

/* Public front door. A signed-in visitor is forwarded to their role home
   (client -> /home, coach -> /coach) exactly like /sign-in and /signup do;
   a signed-out visitor gets the landing page instead of a bounce to
   /sign-in. Role is resolved server-side via getUser() (network-verified),
   never trusted from a client-supplied value. */
export default async function RootPage() {
  await redirectIfSignedIn();
  const cookieStore = await cookies();
  const initialTheme = parseThemePreference(
    cookieStore.get(THEME_PREFERENCE_COOKIE)?.value
  );

  return <LandingPage initialTheme={initialTheme} />;
}
