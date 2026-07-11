"use client";

import { SettingsRow } from "../settings-row";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { acceptConsentAction } from "@/features/profile/server/actions";
import { useState } from "react";

// Bumped only when the terms/privacy agreement materially changes.
const CURRENT_CONSENT_VERSION = "2026-07";

interface ConsentRowProps {
  consented: boolean;
  consentVersion: string | null;
}

/* D-12: one combined terms + privacy consent, recorded as versioned fields
   through the same safe-write path as the edit form (updateSafeFields).
   Calm, non-blocking -- no gate, no dialog, just a settings-row affordance.
   Once accepted for the current version, the row goes quiet (plain text,
   matching every other settled settings row) rather than staying tappable
   forever. */
export function ConsentRow({ consented, consentVersion }: ConsentRowProps) {
  const [accepted, setAccepted] = useState(
    consented && consentVersion === CURRENT_CONSENT_VERSION
  );
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (accepted) {
    return (
      <SettingsRow
        label="Your agreement"
        control={<span className="text-ui-sm text-muted">Accepted</span>}
      />
    );
  }

  async function handleAccept() {
    setPending(true);
    setNotice(null);
    try {
      await acceptConsentAction(CURRENT_CONSENT_VERSION);
      setAccepted(true);
    } catch {
      setNotice("That didn’t save yet. Give it a moment and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <SettingsRow
        label="Your agreement"
        control={
          <Button
            type="button"
            variant="secondary"
            loading={pending}
            onClick={handleAccept}
          >
            Review &amp; accept
          </Button>
        }
      />
      {notice && (
        <div className="px-md pb-md">
          <Alert role="status" tone="notice">
            {notice}
          </Alert>
        </div>
      )}
    </>
  );
}
