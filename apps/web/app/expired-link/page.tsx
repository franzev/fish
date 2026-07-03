"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

/* Shared by verify AND reset expired/used links (D-06). Reads ?email= and
   ?type= via useSearchParams(), so this must sit under a page-level
   Suspense boundary or `next build` fails. This is a routing state, never
   a failure — Alert stays tone="notice", never "error". */
function ExpiredLinkContent() {
  const searchParams = useSearchParams();
  const type = searchParams.get("type") === "recovery" ? "recovery" : "signup";
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The Input's `required` gates real-DOM submission, but the guard stays
    // so jsdom/programmatic submits (and any bypass) still show the calm
    // ask instead of firing the request with an empty address.
    if (!email) {
      setNotice("Add your email above, then resend.");
      return;
    }
    setNotice("");
    setLoading(true);
    try {
      const supabase = createClient();
      // supabase-js returns failures as { error } (rate limits included) —
      // never promise "sent" when nothing was sent.
      const { error } =
        type === "recovery"
          ? await supabase.auth.resetPasswordForEmail(email)
          : await supabase.auth.resend({ type: "signup", email });
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
      <h2 className="text-xl">That link has expired</h2>
      <p className="mt-3 text-body">
        Links only work once, and this one&apos;s had its turn. Send
        yourself a fresh one.
      </p>
      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Button type="submit" variant="primary" loading={loading}>
          Resend the email
        </Button>
        {notice && <Alert tone="notice">{notice}</Alert>}
      </form>
    </Card>
  );
}

export default function ExpiredLinkPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <Suspense
        fallback={
          <Card className="w-full max-w-[440px]">
            <h2 className="text-xl">That link has expired</h2>
          </Card>
        }
      >
        <ExpiredLinkContent />
      </Suspense>
    </main>
  );
}
