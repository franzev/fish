"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import {
  getAuthFailureReason,
  signInWithGoogle,
  signInWithPassword,
} from "@/features/auth";
import { authRedirects } from "@/features/auth/redirects";
import { useDesktopAutofocus } from "@/hooks/use-desktop-autofocus";
import { IconBrandGoogle } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

/* Sibling auth form to /signup — mirrors its submit try/catch template.
   D-05: an "email not confirmed" result routes to /check-inbox rather than
   showing an error, so sign-in never scolds, it just routes. Bad credentials
   never reveal which field is wrong (T-02-19). */
export interface SignInFormProps {
  defaultCredentials?: {
    email: string;
    password: string;
  };
  showGoogleAuth?: boolean;
}

export function SignInForm({
  defaultCredentials,
  showGoogleAuth = false,
}: SignInFormProps) {
  const router = useRouter();
  const emailRef = useDesktopAutofocus<HTMLInputElement>();
  const [email, setEmail] = useState(defaultCredentials?.email ?? "");
  const [password, setPassword] = useState(defaultCredentials?.password ?? "");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setFormError("");
    setLoading(true);
    let navigationStarted = false;

    try {
      const result = await signInWithPassword({
        email,
        password,
      });

      if (!result.ok) {
        if (result.error.code !== "auth") {
          setPasswordError(
            "Couldn't reach the server. Check your connection and try again."
          );
          return;
        }

        // Stable error code first (survives gotrue copy changes); message
        // match kept as a fallback for older backends.
        if (
          getAuthFailureReason(result.error) === "emailNotConfirmed" ||
          result.error.message.toLowerCase().includes("email not confirmed")
        ) {
          router.push(`/check-inbox?email=${encodeURIComponent(email)}`);
          navigationStarted = true;
          return;
        }
        setPasswordError(
          "That email and password don't match. Try again?"
        );
        return;
      }

      router.push(authRedirects.clientHome);
      navigationStarted = true;
    } catch {
      // Thrown means transport failure, not bad credentials — don't tell an
      // offline user their password is wrong.
      setPasswordError(
        "Couldn't reach the server. Check your connection and try again."
      );
    } finally {
      // A successful push only starts the route transition. Keep the action
      // busy until this form unmounts so it cannot briefly return to idle
      // while the authenticated page is still loading.
      if (!navigationStarted) setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setPasswordError("");
    setFormError("");
    setGoogleLoading(true);
    let navigationStarted = false;

    try {
      const result = await signInWithGoogle();
      if (!result.ok) {
        setFormError(
          "Couldn't start Google sign-in. Check your connection and try again."
        );
      } else {
        navigationStarted = true;
      }
    } catch {
      setFormError(
        "Couldn't start Google sign-in. Check your connection and try again."
      );
    } finally {
      if (!navigationStarted) setGoogleLoading(false);
    }
  }

  return (
    // Bare content block — AuthSplitLayout (the page) owns <main>, the
    // split shell, centering, and the max-w-form column.
    <div className="w-full">
      <h1 className="text-heading-sm">Sign in</h1>
        <form className="mt-lg" onSubmit={handleSubmit}>
          <div className="space-y-md">
            <Input
              ref={emailRef}
              label="Email"
              type="email"
              autoComplete="email"
              inputMode="email"
              enterKeyHint="next"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              reserveMessageSpace={false}
              required
            />
            <PasswordInput
              label="Password"
              autoComplete="current-password"
              enterKeyHint="go"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              notice={passwordError || undefined}
              required
            />
          </div>
          <div className="mt-lg space-y-sm">
            <Button
              type="submit"
              variant="primary"
              fullWidth={true}
              loading={loading}
            >
              Sign in
            </Button>
            {showGoogleAuth && <div className="flex justify-center">
              <Button
                type="button"
                variant="ghost"
                loading={googleLoading}
                onClick={handleGoogleSignIn}
              >
                <span className="inline-flex items-center gap-xs">
                  <IconBrandGoogle size={20} stroke={1.75} aria-hidden="true" />
                  Continue with Google
                </span>
              </Button>
            </div>}
          </div>
          {formError && <Alert tone="error" className="mt-md">{formError}</Alert>}
        </form>
        <p className="mt-page text-center text-ui-sm text-muted">
          New here? <Link href="/signup" className="text-body underline">Create account</Link>
        </p>
        <p className="mt-xs text-center text-ui-sm text-muted">
          <Link href="/forgot-password" className="text-body underline">
            Forgot your password?
          </Link>
        </p>
    </div>
  );
}
