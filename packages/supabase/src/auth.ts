import type { UserRole } from "@fish/core/roles";

export interface FishAuthClaims {
  sub: string;
  role: UserRole;
}

export const authRedirects = {
  signedOut: "/login",
  clientHome: "/home",
  coachHome: "/coach",
} as const;
