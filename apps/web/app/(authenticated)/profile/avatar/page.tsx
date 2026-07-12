import { authRedirects } from "@/features/auth/redirects";
import { avatarUploadsEnabled, getProfileData } from "@/features/profile/server";
import { redirect } from "next/navigation";
import { AvatarPhotoEditor } from "@/features/profile/components/avatar-photo-editor";

export default async function AvatarPhotoPage() {
  const data = await getProfileData();
  if (!data) redirect(authRedirects.signedOut);

  return (
    <div className="mx-auto w-full max-w-form">
      <AvatarPhotoEditor
        enabled={avatarUploadsEnabled()}
        userId={data.userId}
        displayName={data.displayName}
        currentAvatarUrl={data.avatarUrl}
        hasAvatar={data.hasAvatar}
      />
    </div>
  );
}
