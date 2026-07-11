"use client";

import "client-only";

export { ChatIdentityGuard } from "./components/chat-identity-guard";
export { LogoutButton } from "./components/logout-button";
export {
  getAuthErrorCode,
  getAuthErrorName,
  requestPasswordReset,
  resendSignupEmail,
  signInWithGoogle,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  updatePassword,
} from "./client/browser";
export { useLogout } from "./client/use-logout";
