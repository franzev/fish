"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

/* Shared by signup AND unverified-login (D-05) — one screen, one owner.
   Reads ?email= via useSearchParams(), so this must sit under a page-level
   Suspense boundary or `next build` fails ("useSearchParams() should be
   wrapped in a suspense boundary"). */
function CheckInboxContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleResend() {
    // Belt and braces — the button is disabled without an email, so never
    // call the API with "".
    if (!email) return;
    setNotice("");
    setLoading(true);
    try {
      const supabase = createClient();
      // supabase-js returns failures as { error } (rate limits included) —
      // never promise "sent" when nothing was sent.
      const { error } = await supabase.auth.resend({ type: "signup", email });
      setNotice(
        error
          ? "That didn't send — give it a minute and try again."
          : "Sent again. Check your inbox."
      );
    } catch {
      setNotice("That didn't send — give it a minute and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-[440px]">
      <h2 className="text-xl">Check your inbox</h2>
      <p className="mt-3 text-body">
        {email
          ? `We sent a link to ${email}. Open it on this device to continue.`
          : "We sent you a link. Open it on this device to continue."}
      </p>
      <div className="mt-6 space-y-5">
        <Button
          type="button"
          variant="primary"
          loading={loading}
          disabled={!email}
          onClick={handleResend}
        >
          Resend the email
        </Button>
        {notice && <Alert tone="notice">{notice}</Alert>}
      </div>
    </Card>
  );
}

export default function CheckInboxPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <Suspense
        fallback={
          <Card className="w-full max-w-[440px]">
            <h2 className="text-xl">Check your inbox</h2>
          </Card>
        }
      >
        <CheckInboxContent />
      </Suspense>
    </main>
  );
}
