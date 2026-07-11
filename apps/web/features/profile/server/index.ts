import "server-only";

export {
  acceptConsentAction,
  updatePrefsAction,
  updateProfileAction,
} from "./actions";
export type {
  EditProfileState,
  EditProfileValues,
  UpdatePrefsInput,
} from "./actions";
export { getProfileData } from "@/features/auth/server/page-data";
export type { ProfileData } from "@/features/auth/contracts";
