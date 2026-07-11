import { getRootRedirectPath } from "@/features/auth/server";
import { redirect } from "next/navigation";

/* Pure redirect (D-02) — this file renders nothing. Every branch redirects:
   signed-out -> /login, client -> /home, coach -> /coach. Role is resolved
   server-side via getUser() (network-verified), never trusted from a
   client-supplied value. Replaces the stale pre-monochrome showcase. */
export default async function RootPage() {
  redirect(await getRootRedirectPath());
}
