import type { Metadata } from "next";
import { Lexend, Fraunces } from "next/font/google";
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${lexend.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
