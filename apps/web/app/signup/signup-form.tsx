"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAuthErrorCode, signUpWithPassword } from "@/lib/auth/browser";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

/* First form-with-state screen in the repo (theme-toggle.tsx is the only
   prior "use client" precedent, but it has no async call). Signup always
   creates a client (AUTH-01) — role is never read from this form, only
   display_name is sent as metadata; the handle_new_user trigger hard-codes
   role='client' server-side regardless of what a client sends here. */
export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError("");
    setFormError("");
    setLoading(true);

    try {
      const result = await signUpWithPassword({
        email,
        password,
        displayName: name,
      });

      if (!result.ok) {
        // Confirmations-off environments surface an explicit error here.
        // Stable error code first (survives gotrue copy changes); message
        // match kept as a fallback for older backends.
        if (
          getAuthErrorCode(result.error) === "user_already_exists" ||
          result.error.message.toLowerCase().includes("already registered")
        ) {
          setEmailError(
            "That email's already in use. Try logging in instead?"
          );
        } else {
          setFormError(
            "Something needs your attention before you can continue. Try again in a moment."
          );
        }
        return;
      }

      // Confirmations-on (production config): an existing confirmed email
      // returns error: null with an obfuscated fake user whose identities
      // array is empty — and sends no email. Surface the existing-account
      // copy instead of routing to /check-inbox to wait for nothing.
      if (result.data.identityCount === 0) {
        setEmailError("That email's already in use. Try logging in instead?");
        return;
      }

      router.push(`/check-inbox?email=${encodeURIComponent(email)}`);
    } catch {
      setFormError(
        "Something needs your attention before you can continue. Try again in a moment."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <Card className="w-full max-w-[440px]">
        <h2 className="text-xl">Create your account</h2>
        <form className="mt-6 space-y-1" onSubmit={handleSubmit}>
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError || undefined}
            required
          />
          <Input
            label="Password"
            type="password"
            hint="At least 8 characters."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          {formError && <Alert tone="error">{formError}</Alert>}
          <Button
            type="submit"
            variant="primary"
            fullWidth={true}
            loading={loading}
          >
            Create account
          </Button>
        </form>
        <p className="mt-5 text-center text-[14px] text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-body underline">
            Log in
          </Link>
        </p>
      </Card>
    </main>
  );
}
