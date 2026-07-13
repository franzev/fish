import "server-only";

import { getServerServices } from "@/lib/services/runtime/server";
import { redirect } from "next/navigation";
import { getSignedInDestination } from "./auth-use-cases";

/* Inverse of the (authenticated) layout guard: that layout redirects a
   signed-OUT visitor away; this helper redirects a signed-IN visitor away
   from the auth pages (D-05 — /sign-in and /signup are wrong doors once
   already signed in). getUser() only, never getSession() — see
   the auth port's trusted-user lookup. No try/catch:
   redirect() throws by design and must propagate to halt rendering. */
export async function redirectIfSignedIn(): Promise<void> {
  const services = await getServerServices();
  const destination = await getSignedInDestination({
    auth: services.auth,
    profiles: services.database.profiles,
  });
  if (destination) redirect(destination);
}
