import { ClientList } from "@/components/coach/client-list";
import { EmptyState } from "@/components/home/empty-state";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { IconUsers } from "@tabler/icons-react";

/* Server Component (NOT "use client") — the (authenticated) layout already
   ran getUser(), redirected signed-out visitors, and resolved role/shell.
   This page re-reads getUser() for the user id: Server Components re-execute
   per navigation, so re-reading here is correct, not redundant caching
   (RESEARCH.md Pitfall 5). This page owns only the wrong-door guard (D-03:
   a client landing here is silently forwarded to /home) and the coach
   content itself. */
export default async function CoachHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (profile?.role === "client") {
    redirect("/home");
  }

  // Trust RLS: coach_clients is already scoped to the caller's own coach id by
  // the "coach reads own assignments" policy (0004), and the joined profiles
  // rows are authorized by is_coach_of. No hand-written coach-id filter is
  // added here — RLS is the boundary (AGENTS.md API rule; checkCoachBoundary
  // precedent).
  const { data: rows } = await supabase
    .from("coach_clients")
    .select("client_id, profiles:client_id(id, display_name, email)");

  const clients = (rows ?? [])
    .map((row) => {
      const client = Array.isArray(row.profiles)
        ? row.profiles[0]
        : row.profiles;
      if (!client) return null;
      return {
        id: client.id,
        displayName: client.display_name,
        email: client.email,
      };
    })
    .filter((client): client is NonNullable<typeof client> => client !== null);

  return (
    <>
      <h1 className="mb-6 text-3xl">Your clients</h1>
      {clients.length === 0 ? (
        <EmptyState Icon={IconUsers}>
          <p>Clients assigned to you will show up here.</p>
        </EmptyState>
      ) : (
        <ClientList clients={clients} />
      )}
    </>
  );
}
