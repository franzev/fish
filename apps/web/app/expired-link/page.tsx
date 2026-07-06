"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  requestPasswordReset,
  resendSignupEmail,
} from "@/lib/auth/browser";
import { useSearchParams } from "next/navigation";
import { type SubmitEvent, Suspense, useState } from "react";

/* Shared by verify AND reset expired/used links (D-06). Reads ?email= and
   ?type= via useSearchParams(), so this must sit under a page-level
   Suspense boundary or `next build` fails. This is a routing state, never
   a failure — the empty-email guard stays tone="notice", never "error". */
function ExpiredLinkContent() {
  const searchParams = useSearchParams();
  const type = searchParams.get("type") === "recovery" ? "recovery" : "signup";
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [notice, setNotice] = useState("");
  const [resultTone, setResultTone] = useState<"notice" | "warning" | "success">(
    "notice"
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    // The Input's `required` gates real-DOM submission, but the guard stays
    // so jsdom/programmatic submits (and any bypass) still show the calm
    // ask instead of firing the request with an empty address.
    if (!email) {
      setResultTone("notice");
      setNotice("Add your email above, then resend.");
      return;
    }
    // Do NOT clear the notice here (no `setNotice("")`) — a previous notice
    // stays on screen until this attempt resolves and replaces it, so the
    // overlay never blinks out and back in mid-flight.
    setLoading(true);
    try {
      const result =
        type === "recovery"
          ? await requestPasswordReset(email)
          : await resendSignupEmail(email);
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
      <h2 className="text-xl">That link has expired</h2>
      <p className="mt-sm text-body">
        Links only work once, and this one&apos;s had its turn. Send
        yourself a fresh one.
      </p>
      <form className="mt-lg space-y-2xs" onSubmit={handleSubmit}>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Button
          type="submit"
          variant="primary"
          fullWidth={true}
          loading={loading}
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

export default function ExpiredLinkPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-page py-2xl">
      <Suspense
        fallback={
          <Card className="w-full max-w-form">
            <h2 className="text-xl">That link has expired</h2>
          </Card>
        }
      >
        <ExpiredLinkContent />
      </Suspense>
    </main>
  );
}
