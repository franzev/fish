import { LogoutButton } from "@/components/auth/logout-button";
import { PreferenceHydrator } from "@/components/shell/preference-hydrator";
import Image from "next/image";

type ThemePref = "light" | "dark" | null;
type TextSizePref = "default" | "large" | "larger" | null;

interface AppShellProps {
  displayName: string;
  preferences?: {
    themePref?: ThemePref;
    textSizePref?: TextSizePref;
    reducedMotionPref?: boolean | null;
  };
  children: React.ReactNode;
}

/* D-06/D-09/D-10: slim top bar — logo, quiet muted name, ghost logout — over
   a single ~640px centered content column, the SAME width for both roles
   (no per-role branching). The bar carries NO page title (D-11) and NO
   primary-variant button (D-09) — each page owns its own Fraunces heading
   in the content column. LogoutButton is ghost (secondary); the screen's
   primary-action count is ZERO (D-18: "at most one" includes zero). */
export function AppShell({ displayName, preferences, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PreferenceHydrator
        themePref={preferences?.themePref}
        textSizePref={preferences?.textSizePref}
        reducedMotionPref={preferences?.reducedMotionPref}
      />
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <Image src="/logo.svg" alt="FISH" width={32} height={32} />
        <span className="text-ui-sm text-muted">{displayName}</span>
        <LogoutButton />
      </header>
      <main className="mx-auto w-full max-w-content flex-1 px-5 py-12">
        {children}
      </main>
    </div>
  );
}
