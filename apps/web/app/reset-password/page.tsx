import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { ResetPasswordForm } from "./_components/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthSplitLayout
      headline="Almost back."
      message="Choose a new password and pick up right where you left off."
    >
      <ResetPasswordForm />
    </AuthSplitLayout>
  );
}
