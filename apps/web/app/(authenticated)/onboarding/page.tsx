import { EmptyState } from "@/components/chat";
import { authRedirects } from "@/lib/auth/redirects";
import { getClientOnboardingData } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import {
  finalizeOnboardingAttemptAction,
  saveOnboardingAnswerAction,
} from "./actions";
import { OnboardingClientFlow } from "./onboarding-client-flow";

/* Server Component (NOT "use client"). It loads the single active assessment
   through Supabase/RLS, then OnboardingClientFlow renders OnboardingConversation
   with the server actions above. The route offers one assigned flow and no
   judgement output. */
export default async function OnboardingPage() {
  const data = await getClientOnboardingData();

  if (!data) {
    redirect(authRedirects.signedOut);
  }

  if (data.role === "coach") {
    redirect(authRedirects.coachHome);
  }

  if (!data.onboarding) {
    return (
      <EmptyState
        title="Nothing to answer yet"
        description="Your coach will add the next step when it is ready."
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-6">
      <div className="space-y-2">
        <h1 className="font-display text-heading text-foreground">
          Let&apos;s get your coach a little context
        </h1>
        <p className="text-copy text-body">
          Answer one question at a time. We save as you go.
        </p>
      </div>
      <OnboardingClientFlow
        onboarding={data.onboarding}
        saveAction={saveOnboardingAnswerAction}
        finalizeAction={finalizeOnboardingAttemptAction}
      />
    </div>
  );
}
