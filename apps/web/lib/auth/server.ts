import "server-only";

/** Stable facade for server-side auth and role-scoped data loaders. */
export {
  getAuthenticatedShellProfile,
  getClientHomeData,
  getProfileData,
  getRootRedirectPath,
} from "./server-data/profile-loaders";
export {
  getCoachClientDetailData,
  getCoachHomeData,
} from "./server-data/coach-loaders";
export { getChatPageData } from "./server-data/chat-loader";
export type * from "./server-data/types";
