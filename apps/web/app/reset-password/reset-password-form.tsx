"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getAuthErrorCode,
  getAuthErrorName,
  updatePassword,
} from "@/features/auth";
import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";

/* D-08: arrives already signed in via the recovery session that
   /auth/confirm (type=recovery) established — single password field, no
   email re-type. No search params are read here, so no Suspense boundary
   is needed. */
export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await updatePassword(password);

      if (!result.ok) {
        if (result.error.code !== "auth") {
          setError(
            "Couldn't reach the server. Check your connection and try again."
          );
          return;
        }

        const errorCode = getAuthErrorCode(result.error);
        const errorName = getAuthErrorName(result.error);
        // Branch on stable error codes, not copy — each failure gets
        // guidance that can actually succeed on retry.
        if (errorCode === "same_password") {
          setError("That's the same password as before. Pick a new one.");
        } else if (
          errorName === "AuthSessionMissingError" ||
          errorCode === "session_not_found"
        ) {
          // Opened directly or the recovery session lapsed — hand off to
          // the resend flow instead of blaming the password.
          router.push("/expired-link?type=recovery");
        } else if (
          errorCode === "weak_password" ||
          errorCode === "validation_failed"
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
    <main className="flex min-h-dvh items-center justify-center px-page py-2xl">
      <Card className="w-full max-w-form">
        <h2 className="text-xl">Set a new password</h2>
        <form className="mt-lg space-y-2xs" onSubmit={handleSubmit}>
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
          <Button
            type="submit"
            variant="primary"
            fullWidth={true}
            loading={loading}
          >
            Set new password
          </Button>
        </form>
      </Card>
    </main>
  );
}
