import "server-only";

import { getServerServices } from "@/lib/services/runtime/server";
import { authRedirects } from "../redirects";
import { redirect } from "next/navigation";

/* Inverse of the (authenticated) layout guard: that layout redirects a
   signed-OUT visitor away; this helper redirects a signed-IN visitor away
   from the auth pages (D-05 — /login and /signup are wrong doors once
   already signed in). getUser() only, never getSession() — see
   the auth port's trusted-user lookup. No try/catch:
   redirect() throws by design and must propagate to halt rendering. */
export async function redirectIfSignedIn(): Promise<void> {
  const services = await getServerServices();
  const userResult = await services.auth.getCurrentUser();
  const user = userResult.ok ? userResult.data : null;

  if (!user) {
    return;
  }

  const profileResult = await services.database.profiles.findRoleById(user.id);
  const profile = profileResult.ok ? profileResult.data : null;

  redirect(
    profile?.role === "coach"
      ? authRedirects.coachHome
      : authRedirects.clientHome
  );
}
