"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getAuthErrorCode,
  signInWithGoogle,
  signInWithPassword,
} from "@/lib/auth/browser";
import { authRedirects } from "@/lib/auth/redirects";
import { IconBrandGoogle, IconEye, IconEyeOff } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

/* Sibling auth form to /signup — mirrors its submit try/catch template.
   D-05: an "email not confirmed" result routes to /check-inbox rather than
   showing an error, so login never scolds, it just routes. Bad credentials
   never reveal which field is wrong (T-02-19). */
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setFormError("");
    setLoading(true);

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
          getAuthErrorCode(result.error) === "email_not_confirmed" ||
          result.error.message.toLowerCase().includes("email not confirmed")
        ) {
          router.push(`/check-inbox?email=${encodeURIComponent(email)}`);
          return;
        }
        setPasswordError(
          "That email and password don't match. Try again?"
        );
        return;
      }

      router.push(authRedirects.clientHome);
    } catch {
      // Thrown means transport failure, not bad credentials — don't tell an
      // offline user their password is wrong.
      setPasswordError(
        "Couldn't reach the server. Check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setPasswordError("");
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
    <main className="flex min-h-dvh items-center justify-center px-page py-2xl">
      <Card className="w-full max-w-form">
        <h1 className="text-xl">Log in</h1>
        <form className="mt-lg" onSubmit={handleSubmit}>
          <div className="space-y-md">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              enterKeyHint="next"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              reserveMessageSpace={false}
              required
            />
            <Input
              label="Password"
              type={passwordVisible ? "text" : "password"}
              autoComplete="current-password"
              enterKeyHint="go"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              notice={passwordError || undefined}
              reserveMessageSpace={false}
              trailingControl={
                <button
                  type="button"
                  aria-label={passwordVisible ? "Hide password" : "Show password"}
                  aria-pressed={passwordVisible}
                  title={passwordVisible ? "Hide password" : "Show password"}
                  className="flex min-h-control min-w-control items-center justify-center rounded-control text-muted transition-colors hover:text-body"
                  onClick={() => setPasswordVisible((visible) => !visible)}
                >
                  {passwordVisible ? (
                    <IconEyeOff size={20} stroke={1.75} aria-hidden="true" />
                  ) : (
                    <IconEye size={20} stroke={1.75} aria-hidden="true" />
                  )}
                </button>
              }
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
              Log in
            </Button>
            <div className="flex justify-center">
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
            </div>
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
      </Card>
    </main>
  );
}
