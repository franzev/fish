import { redirectIfSignedIn } from "@/features/auth/server";
import { SignupForm } from "./signup-form";

/* Server Component (NOT "use client") — silently forwards an already
   signed-in visitor to their role home (D-05) before ever rendering the
   form. A signed-out visitor falls through to the unchanged client form. */
export default async function SignupPage() {
  await redirectIfSignedIn();
  return <SignupForm />;
}
