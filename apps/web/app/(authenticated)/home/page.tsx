import { EmptyState } from "@/components/home/empty-state";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { IconSparkles } from "@tabler/icons-react";

/* Server Component (NOT "use client") — the (authenticated) layout already
   ran getUser(), redirected signed-out visitors, and resolved role/shell.
   This page re-reads getUser() for the user id: Server Components re-execute
   per navigation, so re-reading here is correct, not redundant caching
   (RESEARCH.md Pitfall 5). This page owns only the wrong-door guard (D-03:
   a coach landing here is silently forwarded to /coach) and the client
   content itself. */
export default async function ClientHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user!.id)
    .single();

  if (profile?.role === "coach") {
    redirect("/coach");
  }

  const firstName = profile?.display_name.split(" ")[0] ?? "";

  const { data: assignment } = await supabase
    .from("coach_clients")
    .select("coach_id")
    .eq("client_id", user!.id)
    .maybeSingle();

  let coachName: string | null = null;
  if (assignment) {
    const { data: coach } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", assignment.coach_id)
      .single();
    coachName = coach?.display_name ?? null;
  }

  return (
    <>
      <h1 className="mb-6 text-3xl">Welcome back, {firstName}</h1>
      <EmptyState Icon={IconSparkles}>
        {coachName ? (
          <p>Your coach {coachName} is setting things up.</p>
        ) : (
          <p>We&apos;re getting things ready for you.</p>
        )}
      </EmptyState>
    </>
  );
}
