import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import {
  getDevLoginCredentials,
  isGoogleAuthAvailable,
  redirectIfSignedIn,
} from "@/features/auth/server";
import { SignInForm } from "./_components/sign-in-form";

/* Server Component (NOT "use client") — silently forwards an already
   signed-in visitor to their role home (D-05) before ever rendering the
   form. A signed-out visitor falls through to the unchanged client form. */
export default async function SignInPage() {
  await redirectIfSignedIn();
  return (
    <AuthSplitLayout
      headline="Welcome back."
      message="Your conversations are right where you left them. Continue when you're ready."
      illustrationSrc="/illustrations/sign-in-fish-bowl.svg"
    >
      <SignInForm
        defaultCredentials={getDevLoginCredentials()}
        showGoogleAuth={isGoogleAuthAvailable()}
      />
    </AuthSplitLayout>
  );
}
