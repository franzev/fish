import { Card } from "@/components/ui/card";
import { LogoutButton } from "@/components/auth/logout-button";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/* Server Component (NOT "use client") — reads getUser(), the only
   server-side-verified read (see RESEARCH.md Pitfall 1 on the trust
   difference vs. the cookie-trusting alternative this file must avoid).
   A signed-out visitor must never see authenticated UI here, even before
   Phase 3's full route protection (review HIGH, T-02-27) — that's what
   makes the AUTH-06 logout check assert a concrete behavior instead of an
   undefined one. No role redirects this phase; /home is neutral (D-01). */
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <Card className="w-full max-w-[440px]">
        <h2 className="text-xl">You&apos;re signed in</h2>
        <p className="mt-3 text-body">
          This confirms your session — nothing else lives here yet.
        </p>
        <div className="mt-6">
          <LogoutButton />
        </div>
      </Card>
    </main>
  );
}
