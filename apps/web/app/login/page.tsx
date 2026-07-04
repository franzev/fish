"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { authRedirects } from "@fish/supabase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

/* Sibling auth form to /signup — mirrors its submit try/catch template.
   D-05: an "email not confirmed" result routes to /check-inbox rather than
   showing an error, so login never scolds, it just routes. Bad credentials
   never reveal which field is wrong (T-02-19). */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Stable error code first (survives gotrue copy changes); message
        // match kept as a fallback for older backends.
        if (
          error.code === "email_not_confirmed" ||
          error.message.toLowerCase().includes("email not confirmed")
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

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <Card className="w-full max-w-[440px]">
        <h2 className="text-xl">Log in</h2>
        <form className="mt-6 space-y-1" onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            notice={passwordError || undefined}
            required
          />
          <Button type="submit" variant="primary" loading={loading}>
            Log in
          </Button>
        </form>
        <p className="mt-5 text-center text-[14px] text-muted">
          New here? <Link href="/signup" className="text-body underline">Create account</Link>
        </p>
        <p className="mt-2 text-center text-[14px] text-muted">
          <Link href="/forgot-password" className="text-body underline">
            Forgot your password?
          </Link>
        </p>
      </Card>
    </main>
  );
}
