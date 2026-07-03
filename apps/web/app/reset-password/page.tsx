"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

/* D-08: arrives already signed in via the recovery session that
   /auth/confirm (type=recovery) established — single password field, no
   email re-type. No search params are read here, so no Suspense boundary
   is needed. */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        // Branch on stable error codes, not copy — each failure gets
        // guidance that can actually succeed on retry.
        if (updateError.code === "same_password") {
          setError("That's the same password as before. Pick a new one.");
        } else if (
          updateError.name === "AuthSessionMissingError" ||
          updateError.code === "session_not_found"
        ) {
          // Opened directly or the recovery session lapsed — hand off to
          // the resend flow instead of blaming the password.
          router.push("/expired-link?type=recovery");
        } else if (
          updateError.code === "weak_password" ||
          updateError.code === "validation_failed"
        ) {
          setError("Needs to be at least 8 characters.");
        } else {
          setError("That didn't save. Give it a moment and try again.");
        }
        return;
      }

      router.push("/home");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <Card className="w-full max-w-[440px]">
        <h2 className="text-xl">Set a new password</h2>
        <form className="mt-6 space-y-1" onSubmit={handleSubmit}>
          <Input
            label="Password"
            type="password"
            hint="At least 8 characters."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error || undefined}
            minLength={8}
            required
          />
          <Button type="submit" variant="primary" loading={loading}>
            Set new password
          </Button>
        </form>
      </Card>
    </main>
  );
}
