import { type NextRequest } from "next/server";
import { refreshSupabaseSession } from "@/lib/services/supabase/proxy";

/** Next.js 16 proxy entry (renamed from middleware.ts) — session refresh only. */
export async function proxy(request: NextRequest) {
  return await refreshSupabaseSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and images — the session
     * refresh only matters for navigations that can read auth state.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
