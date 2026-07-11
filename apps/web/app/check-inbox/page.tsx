import { Card } from "@/components/ui/card";
import { Suspense } from "react";
import { CheckInboxContent } from "./_components/check-inbox-content";

export default function CheckInboxPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-page py-2xl">
      <Suspense
        fallback={
          <Card className="w-full max-w-form">
            <h2 className="text-xl">Check your inbox</h2>
          </Card>
        }
      >
        <CheckInboxContent />
      </Suspense>
    </main>
  );
}
