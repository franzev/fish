"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/features/auth";
import { useDesktopAutofocus } from "@/hooks/use-desktop-autofocus";
import Link from "next/link";
import { type SubmitEvent, useState } from "react";

/* Single-field reset-request form. D-07: the same success copy renders
   whether or not the email has an account — no enumeration branch, no
   "no account found" path. The destination after clicking the emailed link
   is controlled by the recovery template's own hardcoded routing param
   (see supabase/templates/recovery.html), not by a query string smuggled
   through redirectTo here (review HIGH) — so resetPasswordForEmail is
   called with the email only. */
export function ForgotPasswordForm() {
  const emailRef = useDesktopAutofocus<HTMLInputElement>();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      await requestPasswordReset(email);
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }

  return (
    // Bare content block — AuthSplitLayout (the page) owns <main>, the
    // split shell, centering, and the max-w-form column.
    <div className="w-full">
      <h2 className="text-heading-sm">Reset your password</h2>
        {submitted ? (
          <div className="mt-lg">
            <Alert tone="notice">
              If that address has an account, a reset link is on its way.
            </Alert>
          </div>
        ) : (
          <>
            <p className="mt-sm text-body">
              Enter the email on your account and we&apos;ll send you a reset
              link.
            </p>
            <form className="mt-lg space-y-2xs" onSubmit={handleSubmit}>
              <Input
                ref={emailRef}
                label="Email"
                type="email"
                autoComplete="email"
                inputMode="email"
                enterKeyHint="send"
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
                Send reset link
              </Button>
            </form>
          </>
        )}
      <p className="mt-page text-center text-ui-sm">
        <Link href="/sign-in" className="text-body underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
