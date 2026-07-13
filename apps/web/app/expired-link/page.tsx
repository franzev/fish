import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { Suspense } from "react";
import { ExpiredLinkContent } from "./_components/expired-link-content";

export default function ExpiredLinkPage() {
  return (
    <AuthSplitLayout
      headline="No rush."
      message="Links only work once. Send yourself a fresh one whenever you're ready."
    >
      <Suspense
        fallback={<h2 className="text-heading-sm">That link has expired</h2>}
      >
        <ExpiredLinkContent />
      </Suspense>
    </AuthSplitLayout>
  );
}
