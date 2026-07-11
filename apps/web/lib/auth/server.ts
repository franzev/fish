import "server-only";

/** Stable facade for server-side auth and role-scoped data loaders. */
export {
  getAuthenticatedShellProfile,
  getClientHomeData,
  getRootRedirectPath,
} from "@/features/auth/server";
export { getProfileData } from "@/features/profile/server";
export {
  getCoachClientDetailData,
  getCoachHomeData,
} from "@/features/coach/server";
export { getChatPageData } from "@/features/chat/server/page-data";
export type * from "@/features/auth/contracts";
