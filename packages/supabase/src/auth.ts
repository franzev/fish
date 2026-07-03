import type { UserRole } from "@fish/core/roles";

export interface FishAuthClaims {
  sub: string;
  role: UserRole;
}

export const authRedirects = {
  signedOut: "/",
  // Interim authenticated landing this phase; Phase 3 owns role-based redirects.
  home: "/home",
  clientHome: "/chat",
  coachHome: "/coach",
} as const;
