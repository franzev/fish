import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { ForgotPasswordForm } from "./_components/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthSplitLayout
      headline="It happens to everyone."
      message="A fresh link is one email away. You'll be back in your chat in no time."
      illustrationSrc="/illustrations/forgot-password-reset.svg"
    >
      <ForgotPasswordForm />
    </AuthSplitLayout>
  );
}
