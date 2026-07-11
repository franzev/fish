"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { resendSignupEmail } from "@/features/auth";
import { useSearchParams } from "next/navigation";
import { type SubmitEvent, useState } from "react";

/* Shared by signup AND unverified-login (D-05) — one screen, one owner.
   Reads ?email= via useSearchParams(), so this must sit under a page-level
   Suspense boundary or `next build` fails ("useSearchParams() should be
   wrapped in a suspense boundary"). */
export function CheckInboxContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [notice, setNotice] = useState("");
  const [resultTone, setResultTone] = useState<"warning" | "success">("success");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    // Belt and braces — the button is disabled without an email, so never
    // call the API with "".
    if (!email) return;
    setLoading(true);
    try {
      const result = await resendSignupEmail(email);
      setResultTone(result.ok ? "success" : "warning");
      setNotice(
        result.ok
          ? "Sent again. Check your inbox."
          : "That didn't send — give it a minute and try again."
      );
    } catch {
      setResultTone("warning");
      setNotice("That didn't send — give it a minute and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    // relative so the notice overlay below can anchor to THIS card's edge
    // without affecting its own box — the card stays exactly where flex
    // centering puts it in every state (D-08: floating overlay, not an
    // in-flow row).
    <Card className="relative w-full max-w-form">
      <h2 className="text-xl">Check your inbox</h2>
      <p className="mt-sm text-body">
        {email
          ? `We sent a link to ${email}. Open it on this device to continue.`
          : "We sent you a link. Open it on this device to continue."}
      </p>
      <form className="mt-lg space-y-2xs" onSubmit={handleSubmit}>
        <Button
          type="submit"
          variant="primary"
          fullWidth={true}
          loading={loading}
          disabled={!email}
        >
          Resend the email
        </Button>
      </form>
      {/* Always-mounted live region so aria-live announces the notice the
          moment it lands; the Alert itself only mounts once there is
          something to say. Positioned OUT of document flow (absolute,
          anchored above the card's top edge) so appearing/disappearing
          never changes the card's own box — the centered card never
          moves (D-08, supersedes the reserved-row approach from the
          previous fix). */}
      <div
        aria-live="polite"
        className="pointer-events-none absolute inset-x-0 bottom-full mb-md"
      >
        {notice && (
          <Alert
            tone={resultTone}
            className="pointer-events-auto animate-fade-in"
          >
            {notice}
          </Alert>
        )}
      </div>
    </Card>
  );
}
