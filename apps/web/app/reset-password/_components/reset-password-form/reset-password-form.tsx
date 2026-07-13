"use client";

import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import {
  getAuthFailureReason,
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

        const reason = getAuthFailureReason(result.error);
        // Branch on stable error codes, not copy — each failure gets
        // guidance that can actually succeed on retry.
        if (reason === "samePassword") {
          setError("That's the same password as before. Pick a new one.");
        } else if (
          reason === "sessionMissing"
        ) {
          // Opened directly or the recovery session lapsed — hand off to
          // the resend flow instead of blaming the password.
          router.push("/expired-link?type=recovery");
        } else if (
          reason === "weakPassword" ||
          reason === "validationFailed"
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
    // Bare content block — AuthSplitLayout (the page) owns <main>, the
    // split shell, centering, and the max-w-form column.
    <div className="w-full">
      <h2 className="text-heading-sm">Set a new password</h2>
        <form className="mt-lg space-y-2xs" onSubmit={handleSubmit}>
          <PasswordInput
            label="Password"
            autoFocus
            autoComplete="new-password"
            enterKeyHint="go"
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
    </div>
  );
}
