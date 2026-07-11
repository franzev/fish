import { Card } from "@/components/ui/card";
import { Suspense } from "react";
import { ExpiredLinkContent } from "./expired-link-content";

export default function ExpiredLinkPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-page py-2xl">
      <Suspense
        fallback={
          <Card className="w-full max-w-form">
            <h2 className="text-xl">That link has expired</h2>
          </Card>
        }
      >
        <ExpiredLinkContent />
      </Suspense>
    </main>
  );
}
