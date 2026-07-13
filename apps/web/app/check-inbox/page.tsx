import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { Suspense } from "react";
import { CheckInboxContent } from "./_components/check-inbox-content";

export default function CheckInboxPage() {
  return (
    <AuthSplitLayout
      headline="One email away."
      message="Open the link on this device and you're straight back in."
    >
      <Suspense
        fallback={<h2 className="text-heading-sm">Check your inbox</h2>}
      >
        <CheckInboxContent />
      </Suspense>
    </AuthSplitLayout>
  );
}
