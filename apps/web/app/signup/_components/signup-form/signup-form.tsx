"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import {
  getAuthFailureReason,
  signInWithGoogle,
  signUpWithPassword,
} from "@/features/auth";
import { IconBrandGoogle } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";

/* First form-with-state screen in the repo (theme-toggle.tsx is the only
   prior "use client" precedent, but it has no async call). Signup always
   creates a client (AUTH-01) — role is never read from this form, only
   display_name is sent as metadata; the handle_new_user trigger hard-codes
   role='client' server-side regardless of what a client sends here. */
export interface SignupFormProps {
  showGoogleAuth?: boolean;
}

export function SignupForm({ showGoogleAuth = false }: SignupFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError("");
    setConfirmPasswordError("");
    setFormError("");

    if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords don't match yet.");
      return;
    }

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
          getAuthFailureReason(result.error) === "userAlreadyExists" ||
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

  async function handleGoogleSignIn() {
    setEmailError("");
    setConfirmPasswordError("");
    setFormError("");
    setGoogleLoading(true);

    try {
      const result = await signInWithGoogle();
      if (!result.ok) {
        setFormError(
          "Couldn't start Google sign-in. Check your connection and try again."
        );
      }
    } catch {
      setFormError(
        "Couldn't start Google sign-in. Check your connection and try again."
      );
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    // Bare content block — AuthSplitLayout (the page) owns <main>, the
    // split shell, centering, and the max-w-form column.
    <div className="w-full">
      <h2 className="text-heading-sm">Create your account</h2>
        <form className="mt-lg space-y-2xs" onSubmit={handleSubmit}>
          <Input
            label="Name"
            autoFocus
            autoComplete="name"
            enterKeyHint="next"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            enterKeyHint="next"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError || undefined}
            required
          />
          <PasswordInput
            label="Password"
            autoComplete="new-password"
            enterKeyHint="next"
            hint="At least 8 characters."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <PasswordInput
            label="Confirm password"
            autoComplete="new-password"
            enterKeyHint="go"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setConfirmPasswordError("");
            }}
            error={confirmPasswordError || undefined}
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
          {showGoogleAuth && <Button
            type="button"
            variant="secondary"
            fullWidth={true}
            loading={googleLoading}
            onClick={handleGoogleSignIn}
          >
            <span className="inline-flex items-center gap-xs">
              <IconBrandGoogle size={20} stroke={1.75} aria-hidden="true" />
              Sign up with Google
            </span>
          </Button>}
        </form>
        <p className="mt-page text-center text-ui-sm text-muted">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-body underline">
            Sign in
          </Link>
        </p>
    </div>
  );
}
