import { redirectIfSignedIn } from "@/features/auth/server";
import type { Metadata } from "next";
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
  return <LandingPage />;
}
