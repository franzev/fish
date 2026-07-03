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
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleResend() {
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.resend({ type: "signup", email });
      setResent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-[440px]">
      <h2 className="text-xl">Check your inbox</h2>
      <p className="mt-3 text-body">
        We sent a link to {email}. Open it on this device to continue.
      </p>
      <div className="mt-6 space-y-5">
        <Button
          type="button"
          variant="primary"
          loading={loading}
          onClick={handleResend}
        >
          Resend the email
        </Button>
        {resent && (
          <Alert tone="notice">Sent again. Check your inbox.</Alert>
        )}
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
