import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import {
  isGoogleAuthAvailable,
  redirectIfSignedIn,
} from "@/features/auth/server";
import { SignupForm } from "./_components/signup-form";

/* Server Component (NOT "use client") — silently forwards an already
   signed-in visitor to their role home (D-05) before ever rendering the
   form. A signed-out visitor falls through to the unchanged client form. */
export default async function SignupPage() {
  await redirectIfSignedIn();
  return (
    <AuthSplitLayout
      headline="Learn together."
      message="Your coach keeps the path clear, so you can focus on using English with confidence."
      illustrationSrc="/illustrations/sign-up-teamwork.svg"
    >
      <SignupForm showGoogleAuth={isGoogleAuthAvailable()} />
    </AuthSplitLayout>
  );
}
