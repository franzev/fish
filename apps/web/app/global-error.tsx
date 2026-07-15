"use client";

import { Button } from "@/components/ui/button";
import { reportOperationalError } from "@/lib/observability/reporter";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportOperationalError(error, {
      operation: "app.globalError",
      handled: false,
      recoverable: false,
      runtime: "browser",
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-foreground">
        <main className="mx-auto flex min-h-screen max-w-form items-center px-page py-xl">
          <section className="w-full rounded-card bg-surface p-lg text-center">
            <h1 className="text-heading-sm">
              This page was interrupted
            </h1>
            <p className="mt-sm text-body">
              Your work is still here. Try opening the page again.
            </p>
            <Button className="mt-lg" onClick={reset}>
              Try again
            </Button>
          </section>
        </main>
      </body>
    </html>
  );
}
