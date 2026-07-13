import { Wordmark } from "@/components/brand/wordmark";
import { ReactNode } from "react";

/* Shared shell for every signed-out page (/sign-in, /signup, /forgot-password,
 *  /reset-password, /check-inbox, /expired-link). Split screen on large
 *  viewports: the form column stays first in DOM and on screen; a calm brand
 *  panel sits beside it with a short welcome. The panel is supportive, never
 *  competing — monochrome fills only, so the page's single primary action
 *  (inside the form) keeps the strongest contrast. On small screens the
 *  panel disappears and the form column owns the viewport. */
export interface AuthSplitLayoutProps {
  /** Short serif headline on the large-screen brand panel. */
  headline: string;
  /** One supportive sentence under the headline. */
  message: string;
  children: ReactNode;
}

/* A school of fish drifting the same way, one a little ahead — the product
   promise (follow one clear next step) as a quiet monochrome graphic.
   Decorative only: hidden from assistive tech, inherits currentColor so the
   token ladder keeps it calm in both themes. */
const SCHOOL = [
  { x: 330, y: 52, scale: 1.2, opacity: 0.9 },
  { x: 208, y: 26, scale: 0.85, opacity: 0.4 },
  { x: 156, y: 108, scale: 0.95, opacity: 0.5 },
  { x: 58, y: 66, scale: 0.75, opacity: 0.3 },
  { x: 244, y: 158, scale: 0.9, opacity: 0.45 },
  { x: 104, y: 198, scale: 0.7, opacity: 0.3 },
  { x: 284, y: 226, scale: 0.8, opacity: 0.35 },
];

function SchoolOfFish() {
  return (
    <svg
      viewBox="0 0 480 280"
      className="w-full max-w-content text-muted"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <g id="auth-fish">
          <ellipse cx="26" cy="12" rx="14" ry="8" />
          <path d="M16 12 2 3v18Z" />
        </g>
      </defs>
      {SCHOOL.map(({ x, y, scale, opacity }) => (
        <use
          key={`${x}-${y}`}
          href="#auth-fish"
          fill="currentColor"
          opacity={opacity}
          transform={`translate(${x} ${y}) scale(${scale})`}
        />
      ))}
    </svg>
  );
}

export function AuthSplitLayout({
  headline,
  message,
  children,
}: AuthSplitLayoutProps) {
  return (
    <main className="lg:grid lg:min-h-dvh lg:grid-cols-2">
      <div className="flex min-h-dvh flex-col px-page py-page lg:min-h-full lg:px-2xl">
        <Wordmark className="self-start" />
        <div className="flex flex-1 items-center justify-center py-2xl">
          <div className="w-full max-w-form">{children}</div>
        </div>
      </div>
      <aside className="hidden bg-surface-2 lg:flex lg:flex-col lg:justify-center lg:gap-2xl lg:px-2xl lg:py-2xl xl:px-4xl">
        <SchoolOfFish />
        <div>
          <p className="font-serif text-display font-semibold text-foreground">
            {headline}
          </p>
          <p className="mt-md max-w-form text-lead text-body">{message}</p>
        </div>
      </aside>
    </main>
  );
}
