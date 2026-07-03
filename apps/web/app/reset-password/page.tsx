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
        setError("Needs to be at least 8 characters.");
        return;
      }

      router.push("/home");
    } catch {
      setError("Needs to be at least 8 characters.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <Card className="w-full max-w-[440px]">
        <h2 className="text-xl">Set a new password</h2>
        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
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
