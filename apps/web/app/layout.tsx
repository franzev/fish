import { getAuthenticatedShellProfile } from "@/features/auth/server";
import {
  parseThemePreference,
  THEME_PREFERENCE_COOKIE,
} from "@/lib/prefs/theme-preference";
import type { Metadata } from "next";
import { Lexend, Fraunces } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

// Lexend — readability-tuned sans for body and UI (proven to reduce
// reading distance for neurodivergent readers; fits the ADHD audience).
const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
  display: "swap",
});

// Fraunces — warm serif for headings/display.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FISH",
  description: "English coaching that fits how your brain works.",
  icons: {
    icon: "/icon.svg",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, cookieStore] = await Promise.all([
    getAuthenticatedShellProfile(),
    cookies(),
  ]);
  const visitorTheme = parseThemePreference(
    cookieStore.get(THEME_PREFERENCE_COOKIE)?.value
  );
  const theme = profile?.themePref ?? visitorTheme;

  return (
    <html
      lang="en"
      className={`${lexend.variable} ${fraunces.variable}`}
      data-theme={theme ?? undefined}
      data-reduced-motion={
        profile?.reducedMotionPref == null
          ? undefined
          : String(profile.reducedMotionPref)
      }
      data-time-format={profile?.timeFormatPref ?? undefined}
    >
      <body>{children}</body>
    </html>
  );
}
