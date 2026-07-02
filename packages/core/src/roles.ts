export const userRoles = ["client", "coach"] as const;

export type UserRole = (typeof userRoles)[number];

export function isUserRole(value: string): value is UserRole {
  return userRoles.includes(value as UserRole);
}
